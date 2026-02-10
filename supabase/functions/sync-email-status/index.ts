import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailStatusResult {
  synced: number;
  bounced: number;
  delivered: number;
  suppressed: number;
  delayed: number;
  errors: number;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const RESEND_API_KEY_2 = Deno.env.get("RESEND_API_KEY_2");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY not configured");
    }

    // Map domains to their API keys
    function getResendKeyForDomain(domain: string | null): string {
      if (domain === "fatopericias.com.br" && RESEND_API_KEY_2) {
        return RESEND_API_KEY_2;
      }
      return RESEND_API_KEY!;
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { campaignId, limit = 500 } = await req.json();

    console.log(`[sync-email-status] Starting sync for campaign: ${campaignId || 'all'}, limit: ${limit}`);

    // Fetch email_sends with resend_id that need status update
    let query = supabase
      .from("email_sends")
      .select("id, resend_id, status, contact_id, recipient_email, sender_domain")
      .not("resend_id", "is", null)
      .in("status", ["pending", "sent"])
      .limit(limit);

    if (campaignId) {
      query = query.eq("campaign_id", campaignId);
    }

    const { data: emailSends, error: fetchError } = await query;

    if (fetchError) {
      throw fetchError;
    }

    if (!emailSends || emailSends.length === 0) {
      console.log("[sync-email-status] No emails to sync");
      return new Response(
        JSON.stringify({ synced: 0, bounced: 0, delivered: 0, suppressed: 0, delayed: 0, errors: 0, message: "No emails to sync" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[sync-email-status] Found ${emailSends.length} emails to sync`);

    const result: EmailStatusResult = {
      synced: 0,
      bounced: 0,
      delivered: 0,
      suppressed: 0,
      delayed: 0,
      errors: 0,
    };

    // Helper to fetch with rate-limit retry
    async function fetchResendEmail(resendId: string, apiKey: string): Promise<{ ok: boolean; data?: Record<string, unknown>; skip?: boolean }> {
      for (let attempt = 0; attempt < 3; attempt++) {
        const resp = await fetch(`https://api.resend.com/emails/${resendId}`, {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (resp.ok) {
          return { ok: true, data: await resp.json() };
        }
        if (resp.status === 404) {
          return { ok: false, skip: true };
        }
        if (resp.status === 429) {
          console.log(`[sync-email-status] Rate limited on ${resendId}, waiting ${(attempt + 1) * 2}s...`);
          await new Promise((r) => setTimeout(r, (attempt + 1) * 2000));
          continue;
        }
        const errorText = await resp.text();
        console.error(`[sync-email-status] Resend API error for ${resendId}: ${errorText}`);
        return { ok: false };
      }
      return { ok: false };
    }

    // Process emails sequentially, ~1.5 req/s to respect Resend 2 req/s limit
    for (let i = 0; i < emailSends.length; i++) {
      const emailSend = emailSends[i];
      try {
        const apiKey = getResendKeyForDomain(emailSend.sender_domain);
        const fetchResult = await fetchResendEmail(emailSend.resend_id, apiKey);
        
        if (fetchResult.skip) {
          console.log(`[sync-email-status] Email ${emailSend.resend_id} not found in Resend, skipping`);
          continue;
        }
        if (!fetchResult.ok || !fetchResult.data) {
          result.errors++;
          continue;
        }

        const resendData = fetchResult.data;
        const lastEvent = resendData.last_event;

            console.log(`[sync-email-status] Email ${emailSend.resend_id} last_event: ${lastEvent}`);

            // Map Resend last_event to our status
            const updates: Record<string, unknown> = {};

            if (lastEvent === "delivered") {
              updates.status = "delivered";
              updates.delivered_at = resendData.delivered_at || new Date().toISOString();
              result.delivered++;
            } else if (lastEvent === "bounced") {
              updates.status = "bounced";
              updates.bounced_at = resendData.bounced_at || new Date().toISOString();
              updates.bounce_type = "Permanent"; // Resend only reports permanent bounces
              updates.bounce_message = resendData.bounce?.message || "Email bounced";
              result.bounced++;

              // Add to suppressed_emails
              await supabase.from("suppressed_emails").upsert(
                {
                  email: emailSend.recipient_email,
                  reason: "bounce",
                  bounce_type: "Permanent",
                  original_error: resendData.bounce?.message || "Email bounced",
                  source_contact_id: emailSend.contact_id,
                },
                { onConflict: "email" }
              );

              // Log activity for CRM
              await supabase.from("contact_activities").insert({
                contact_id: emailSend.contact_id,
                activity_type: "email_bounced",
                description: `Email bounce detectado via sincronização: ${emailSend.recipient_email}`,
                metadata: { bounce_type: "Permanent", synced: true },
              });
            } else if (lastEvent === "opened") {
              updates.status = "delivered";
              updates.delivered_at = resendData.delivered_at || new Date().toISOString();
              updates.opened_at = resendData.opened_at || new Date().toISOString();
              updates.opened_count = (resendData.opens || []).length || 1;
              result.delivered++;
            } else if (lastEvent === "clicked") {
              updates.status = "delivered";
              updates.delivered_at = resendData.delivered_at || new Date().toISOString();
              updates.clicked_at = resendData.clicked_at || new Date().toISOString();
              updates.clicked_count = (resendData.clicks || []).length || 1;
              result.delivered++;
            } else if (lastEvent === "complained") {
              updates.status = "complained";
              updates.complained_at = resendData.complained_at || new Date().toISOString();

              // Add to suppressed_emails
              await supabase.from("suppressed_emails").upsert(
                {
                  email: emailSend.recipient_email,
                  reason: "complaint",
                  bounce_type: null,
                  original_error: "Spam complaint",
                  source_contact_id: emailSend.contact_id,
                },
                { onConflict: "email" }
              );
            } else if (lastEvent === "suppressed") {
              // Email suprimido pelo Resend (bounce/complaint anterior em qualquer conta)
              updates.status = "bounced";
              updates.bounced_at = new Date().toISOString();
              updates.bounce_type = "Suppressed";
              updates.bounce_message = "Email suprimido pelo Resend (suppression list)";
              result.bounced++;
              result.suppressed++;

              // Add to suppressed_emails
              await supabase.from("suppressed_emails").upsert(
                {
                  email: emailSend.recipient_email,
                  reason: "resend_suppression",
                  bounce_type: "Suppressed",
                  original_error: "Email na lista de supressão global do Resend",
                  source_contact_id: emailSend.contact_id,
                },
                { onConflict: "email" }
              );

              // Log activity for CRM
              await supabase.from("contact_activities").insert({
                contact_id: emailSend.contact_id,
                activity_type: "email_suppressed",
                description: `Email suprimido pelo Resend: ${emailSend.recipient_email}`,
                metadata: { reason: "resend_suppression", synced: true },
              });
            } else if (lastEvent === "delivery-delayed") {
              // Entrega atrasada - apenas registrar sem bloquear
              updates.delivery_delayed_at = new Date().toISOString();
              result.delayed++;
            }

            if (Object.keys(updates).length > 0) {
              const { error: updateError } = await supabase
                .from("email_sends")
                .update(updates)
                .eq("id", emailSend.id);

              if (updateError) {
                console.error(`[sync-email-status] Update error for ${emailSend.id}:`, updateError);
                result.errors++;
              } else {
                result.synced++;
              }
            }
      } catch (err) {
        console.error(`[sync-email-status] Error processing ${emailSend.resend_id}:`, err);
        result.errors++;
      }

      // Delay 550ms between requests to stay under 2 req/s Resend limit
      if (i < emailSends.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 550));
      }
    }

    console.log(`[sync-email-status] Sync complete:`, result);

    return new Response(
      JSON.stringify({
        ...result,
        message: `Sincronização concluída: ${result.synced} atualizados, ${result.bounced} bounces (${result.suppressed} suprimidos), ${result.delivered} entregues, ${result.delayed} atrasados, ${result.errors} erros`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[sync-email-status] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
