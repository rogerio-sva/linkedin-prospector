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
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY not configured");
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
      .select("id, resend_id, status, contact_id, recipient_email")
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

    // Process emails in batches of 10 to avoid rate limits
    const batchSize = 10;
    for (let i = 0; i < emailSends.length; i += batchSize) {
      const batch = emailSends.slice(i, i + batchSize);
      
      await Promise.all(
        batch.map(async (emailSend) => {
          try {
            // Fetch email status from Resend API
            const resendResponse = await fetch(
              `https://api.resend.com/emails/${emailSend.resend_id}`,
              {
                headers: {
                  Authorization: `Bearer ${RESEND_API_KEY}`,
                },
              }
            );

            if (!resendResponse.ok) {
              const errorText = await resendResponse.text();
              console.error(`[sync-email-status] Resend API error for ${emailSend.resend_id}: ${errorText}`);
              result.errors++;
              return;
            }

            const resendData = await resendResponse.json();
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
        })
      );

      // Small delay between batches to avoid rate limits
      if (i + batchSize < emailSends.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
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
