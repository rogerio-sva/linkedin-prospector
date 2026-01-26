import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@2.0.0";

declare const EdgeRuntime: { waitUntil: (promise: Promise<any>) => void };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Configuration
const BATCH_SIZE = 500; // Contacts per batch
const SUB_BATCH_SIZE = 50; // For fetching contact details
const RESEND_BATCH_SIZE = 100; // For Resend API
const DELAY_BETWEEN_BATCHES_MS = 100;

interface ResumeRequest {
  campaignId: string;
  baseIds: string[];
  templateId: string;
  fromEmail: string;
  fromName: string;
  replyTo?: string;
  emailType?: "personal" | "corporate" | "both";
  emailFormat?: "text" | "html";
}

// Sanitize contact name for RFC compliance
function sanitizeName(name: string | null | undefined): string {
  if (!name) return "";
  return name.replace(/[<>,;:"'\[\]()\\]/g, "").replace(/\s+/g, " ").trim();
}

// Capitalize first letter of each word
function capitalizeWords(str: string | null | undefined): string {
  if (!str) return "";
  return str.toLowerCase().replace(/(?:^|\s)\S/g, (a) => a.toUpperCase());
}

async function processResumeCampaign(params: ResumeRequest) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const resendApiKey = Deno.env.get("RESEND_API_KEY")!;
  const resendApiKey2 = Deno.env.get("RESEND_API_KEY_2");

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const resend = new Resend(resendApiKey);
  const resend2 = resendApiKey2 ? new Resend(resendApiKey2) : null;

  const { 
    campaignId, 
    baseIds, 
    templateId, 
    fromEmail, 
    fromName, 
    replyTo,
    emailType = "both",
    emailFormat = "text"
  } = params;

  console.log(`[resume-campaign] Starting background process for campaign ${campaignId}`);

  try {
    // Fetch template
    const { data: template, error: templateError } = await supabase
      .from("email_templates")
      .select("subject, body")
      .eq("id", templateId)
      .single();

    if (templateError || !template) {
      console.error(`[resume-campaign] Template not found: ${templateId}`);
      return;
    }

    // Get suppressed emails
    const { data: suppressedData } = await supabase
      .from("suppressed_emails")
      .select("email");
    const suppressedEmails = new Set((suppressedData || []).map((s: any) => s.email.toLowerCase()));

    // Get undeliverable emails from validation
    const { data: invalidData } = await supabase
      .from("email_validations")
      .select("email")
      .eq("status", "undeliverable");
    const invalidEmails = new Set((invalidData || []).map((e: any) => e.email.toLowerCase()));

    let totalSent = 0;
    let totalFailed = 0;
    let totalSuppressed = 0;
    let totalInvalid = 0;

    // Process each base
    for (const baseId of baseIds) {
      console.log(`[resume-campaign] Processing base ${baseId}`);

      let offset = 0;
      let hasMore = true;
      let processedInBase = 0;

      while (hasMore) {
        // Fetch contacts
        const { data: rawContacts, error: rawError } = await supabase
          .from("contacts")
          .select("id")
          .eq("base_id", baseId)
          .or("email.not.is.null,personal_email.not.is.null")
          .order("created_at", { ascending: true })
          .range(offset, offset + BATCH_SIZE * 2 - 1);

        if (rawError) {
          console.error(`[resume-campaign] Error fetching contacts:`, rawError);
          break;
        }

        const allIds = (rawContacts || []).map((c: any) => c.id);
        if (allIds.length === 0) {
          hasMore = false;
          break;
        }

        // Check which haven't been sent to yet (in smaller batches)
        const unsentIds: string[] = [];
        for (let i = 0; i < allIds.length && unsentIds.length < BATCH_SIZE; i += 100) {
          const batchIds = allIds.slice(i, i + 100);
          const { data: sentData } = await supabase
            .from("email_sends")
            .select("contact_id")
            .eq("campaign_id", campaignId)
            .in("contact_id", batchIds);

          const sentSet = new Set((sentData || []).map((s: any) => s.contact_id));
          for (const id of batchIds) {
            if (!sentSet.has(id) && unsentIds.length < BATCH_SIZE) {
              unsentIds.push(id);
            }
          }
        }

        if (unsentIds.length === 0) {
          offset += BATCH_SIZE * 2;
          if (allIds.length < BATCH_SIZE * 2) {
            hasMore = false;
          }
          continue;
        }

        console.log(`[resume-campaign] Processing ${unsentIds.length} contacts for base ${baseId} (offset ${offset})`);

        // Fetch contact details in sub-batches
        const contacts: any[] = [];
        for (let i = 0; i < unsentIds.length; i += SUB_BATCH_SIZE) {
          const subBatch = unsentIds.slice(i, i + SUB_BATCH_SIZE);
          const { data: contactData, error: contactError } = await supabase
            .from("contacts")
            .select("id, first_name, full_name, email, personal_email")
            .in("id", subBatch);

          if (contactError) {
            console.error(`[resume-campaign] Error fetching contact details:`, contactError);
            continue;
          }
          contacts.push(...(contactData || []));
        }

        // Prepare emails
        const emailsToSend: any[] = [];
        const emailRecords: any[] = [];

        for (const contact of contacts) {
          // Determine which email to use
          let targetEmail: string | null = null;
          if (emailType === "personal" && contact.personal_email) {
            targetEmail = contact.personal_email;
          } else if (emailType === "corporate" && contact.email) {
            targetEmail = contact.email;
          } else if (emailType === "both") {
            targetEmail = contact.personal_email || contact.email;
          }

          if (!targetEmail) continue;

          const emailLower = targetEmail.toLowerCase();

          // Check suppression
          if (suppressedEmails.has(emailLower)) {
            totalSuppressed++;
            continue;
          }

          // Check validation
          if (invalidEmails.has(emailLower)) {
            totalInvalid++;
            continue;
          }

          // Prepare personalization
          const firstName = capitalizeWords(contact.first_name || contact.full_name?.split(" ")[0]);
          const fullName = capitalizeWords(contact.full_name);
          const safeName = sanitizeName(fullName);

          // Render template
          const subject = template.subject
            .replace(/\{\{firstName\}\}/g, firstName || "")
            .replace(/\{\{fullName\}\}/g, fullName || "");
          
          const bodyText = template.body
            .replace(/\{\{firstName\}\}/g, firstName || "")
            .replace(/\{\{fullName\}\}/g, fullName || "");

          emailsToSend.push({
            from: `${fromName} <${fromEmail}>`,
            to: safeName ? `${safeName} <${targetEmail}>` : targetEmail,
            reply_to: replyTo || fromEmail,
            subject,
            ...(emailFormat === "text" ? { text: bodyText } : { html: bodyText }),
          });

          emailRecords.push({
            campaign_id: campaignId,
            contact_id: contact.id,
            recipient_email: targetEmail,
            recipient_name: safeName || null,
            subject,
            body: bodyText,
            status: "pending",
            sender_domain: fromEmail.split("@")[1],
          });
        }

        if (emailsToSend.length === 0) {
          offset += BATCH_SIZE * 2;
          continue;
        }

        // Send in batches via Resend
        let currentResend = resend;
        let useBackup = false;

        for (let i = 0; i < emailsToSend.length; i += RESEND_BATCH_SIZE) {
          const batchEmails = emailsToSend.slice(i, i + RESEND_BATCH_SIZE);
          const batchRecords = emailRecords.slice(i, i + RESEND_BATCH_SIZE);

          try {
            // Insert records first
            const { data: insertedRecords, error: insertError } = await supabase
              .from("email_sends")
              .insert(batchRecords)
              .select("id, contact_id");

            if (insertError) {
              console.error(`[resume-campaign] Insert error:`, insertError);
              totalFailed += batchEmails.length;
              continue;
            }

            // Send via Resend
            const response = await currentResend.batch.send(batchEmails);

            if (response.error) {
              // Try backup key if available
              if (resend2 && !useBackup && response.error.message?.includes("rate")) {
                console.log(`[resume-campaign] Switching to backup Resend key`);
                currentResend = resend2;
                useBackup = true;
                // Retry with backup
                const retryResponse = await currentResend.batch.send(batchEmails);
                if (retryResponse.error) {
                  throw new Error(retryResponse.error.message);
                }
              } else {
                throw new Error(response.error.message);
              }
            }

            // Update records with Resend IDs
            const responseData = (response.data as any)?.data || response.data || [];
            const dataArray = Array.isArray(responseData) ? responseData : [];
            for (let j = 0; j < dataArray.length; j++) {
              const resendId = dataArray[j]?.id;
              const record = insertedRecords?.[j];
              if (resendId && record) {
                await supabase
                  .from("email_sends")
                  .update({ resend_id: resendId, status: "sent", sent_at: new Date().toISOString() })
                  .eq("id", record.id);
              }
            }

            totalSent += batchEmails.length;
            processedInBase += batchEmails.length;

            if (totalSent % 500 === 0) {
              console.log(`[resume-campaign] Progress: ${totalSent} sent, ${totalFailed} failed`);
            }

          } catch (sendError: any) {
            console.error(`[resume-campaign] Send error:`, sendError);
            totalFailed += batchEmails.length;
          }

          // Small delay between sub-batches
          await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES_MS));
        }

        offset += BATCH_SIZE * 2;
        
        // Check if we've processed fewer than expected
        if (allIds.length < BATCH_SIZE * 2) {
          hasMore = false;
        }
      }

      console.log(`[resume-campaign] Completed base ${baseId}: ${processedInBase} emails sent`);
    }

    // Update campaign status
    await supabase
      .from("email_campaigns")
      .update({ 
        status: totalFailed > 0 && totalSent === 0 ? "failed" : "completed",
        sent_at: new Date().toISOString()
      })
      .eq("id", campaignId);

    console.log(`[resume-campaign] COMPLETED: ${totalSent} sent, ${totalFailed} failed, ${totalSuppressed} suppressed, ${totalInvalid} invalid`);

  } catch (error: any) {
    console.error("[resume-campaign] Fatal error:", error);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    return new Response(
      JSON.stringify({ success: false, error: "RESEND_API_KEY not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const body: ResumeRequest = await req.json();
    const { campaignId, baseIds, templateId, fromEmail, fromName } = body;

    if (!campaignId || !baseIds?.length || !templateId || !fromEmail || !fromName) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[resume-campaign] Initiating background process for campaign ${campaignId}`);

    // Start background processing
    EdgeRuntime.waitUntil(processResumeCampaign(body));

    // Return immediately
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Campaign resume started in background",
        campaignId,
        baseIds
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[resume-campaign] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
