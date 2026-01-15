import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CleanupResult {
  jobId: string;
  status: string;
  phase: string;
  synced: number;
  bouncesFound: number;
  emailsCleared: number;
  contactsDeleted: number;
  crmReset: number;
  errors: number;
  remaining: number;
  message: string;
}

// Rate limiting: 2 requests per second = 500ms between requests
const RATE_LIMIT_DELAY = 500;
const BATCH_SIZE = 200; // Process 200 emails per execution (~100 seconds)

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, jobId } = await req.json();

    // Action: status - Get current job status
    if (action === "status") {
      const { data: job, error } = await supabase
        .from("cleanup_jobs")
        .select("*")
        .eq("id", jobId)
        .single();

      if (error) {
        return new Response(JSON.stringify({ error: "Job not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify(job), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: start - Start a new cleanup job or continue existing
    if (action === "start") {
      // Check for existing running job
      const { data: existingJob } = await supabase
        .from("cleanup_jobs")
        .select("*")
        .eq("status", "running")
        .single();

      let job = existingJob;

      if (!job) {
        // Count total emails to sync
        const { count: totalToSync } = await supabase
          .from("email_sends")
          .select("*", { count: "exact", head: true })
          .not("resend_id", "is", null)
          .in("status", ["pending", "sent"]);

        // Create new job
        const { data: newJob, error: createError } = await supabase
          .from("cleanup_jobs")
          .insert({
            status: "running",
            phase: "sync",
            total_to_sync: totalToSync || 0,
            synced_count: 0,
            bounces_found: 0,
            emails_cleared: 0,
            contacts_deleted: 0,
            crm_reset: 0,
            errors_count: 0,
            started_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (createError) {
          console.error("Error creating job:", createError);
          throw createError;
        }
        job = newJob;
      }

      // Start background processing using waitUntil for Deno Deploy
      const processPromise = processCleanup(supabase, job.id, resendApiKey);
      
      // @ts-ignore - EdgeRuntime is available in Supabase Edge Functions
      if (typeof globalThis.EdgeRuntime !== "undefined") {
        // @ts-ignore
        globalThis.EdgeRuntime.waitUntil(processPromise);
      } else {
        // Fallback: don't await, let it run in background
        processPromise.catch(err => console.error("Background process error:", err));
      }

      const result: CleanupResult = {
        jobId: job.id,
        status: "running",
        phase: job.phase,
        synced: job.synced_count,
        bouncesFound: job.bounces_found,
        emailsCleared: job.emails_cleared,
        contactsDeleted: job.contacts_deleted,
        crmReset: job.crm_reset,
        errors: job.errors_count,
        remaining: job.total_to_sync - job.synced_count,
        message: "Processamento iniciado em background",
      };

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in global-bounce-cleanup:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function processCleanup(supabase: any, jobId: string, resendApiKey: string | undefined) {
  console.log(`Starting cleanup job ${jobId}`);

  try {
    // ========== PHASE 1: SYNC EMAIL STATUS ==========
    await supabase
      .from("cleanup_jobs")
      .update({ phase: "sync" })
      .eq("id", jobId);

    // Get pending emails to sync
    const { data: emailsToSync, error: fetchError } = await supabase
      .from("email_sends")
      .select("id, resend_id, contact_id, recipient_email, status")
      .not("resend_id", "is", null)
      .in("status", ["pending", "sent"])
      .limit(BATCH_SIZE);

    if (fetchError) {
      console.error("Error fetching emails:", fetchError);
      throw fetchError;
    }

    console.log(`Found ${emailsToSync?.length || 0} emails to sync`);

    let syncedCount = 0;
    let bouncesFound = 0;
    let errorsCount = 0;

    if (resendApiKey && emailsToSync && emailsToSync.length > 0) {
      for (const email of emailsToSync) {
        try {
          // Rate limiting delay
          await delay(RATE_LIMIT_DELAY);

          // Fetch status from Resend API
          const response = await fetch(`https://api.resend.com/emails/${email.resend_id}`, {
            headers: {
              Authorization: `Bearer ${resendApiKey}`,
            },
          });

          if (!response.ok) {
            if (response.status === 429) {
              console.log("Rate limit hit, waiting...");
              await delay(2000);
              continue;
            }
            console.error(`Resend API error for ${email.resend_id}: ${response.status}`);
            errorsCount++;
            continue;
          }

          const resendData = await response.json();
          const lastEvent = resendData.last_event;

          // Prepare update based on status
          const updateData: any = {};

          if (lastEvent === "delivered") {
            updateData.status = "delivered";
            updateData.delivered_at = resendData.delivered_at || new Date().toISOString();
          } else if (lastEvent === "bounced") {
            updateData.status = "bounced";
            updateData.bounced_at = resendData.bounced_at || new Date().toISOString();
            updateData.bounce_type = resendData.bounce_type || "unknown";
            updateData.bounce_message = resendData.bounce_message || null;
            bouncesFound++;

            // Add to suppression list
            const isPermanent = resendData.bounce_type === "permanent" || 
                               resendData.bounce_type === "hard" ||
                               !resendData.bounce_type;

            if (isPermanent) {
              await supabase
                .from("suppressed_emails")
                .upsert({
                  email: email.recipient_email.toLowerCase(),
                  reason: "bounce",
                  bounce_type: resendData.bounce_type || "permanent",
                  source_contact_id: email.contact_id,
                  original_error: resendData.bounce_message,
                }, { onConflict: "email" });
            }
          } else if (lastEvent === "complained") {
            updateData.status = "complained";
            updateData.complained_at = new Date().toISOString();
            
            // Add to suppression list
            await supabase
              .from("suppressed_emails")
              .upsert({
                email: email.recipient_email.toLowerCase(),
                reason: "complaint",
                source_contact_id: email.contact_id,
              }, { onConflict: "email" });
          } else if (lastEvent === "opened") {
            updateData.status = "delivered";
            updateData.delivered_at = updateData.delivered_at || new Date().toISOString();
            updateData.opened_at = resendData.opened_at || new Date().toISOString();
          } else if (lastEvent === "clicked") {
            updateData.status = "delivered";
            updateData.delivered_at = updateData.delivered_at || new Date().toISOString();
            updateData.clicked_at = resendData.clicked_at || new Date().toISOString();
          }

          if (Object.keys(updateData).length > 0) {
            await supabase
              .from("email_sends")
              .update(updateData)
              .eq("id", email.id);
          }

          syncedCount++;

          // Update progress every 10 emails
          if (syncedCount % 10 === 0) {
            await supabase
              .from("cleanup_jobs")
              .update({
                synced_count: syncedCount,
                bounces_found: bouncesFound,
                errors_count: errorsCount,
              })
              .eq("id", jobId);
          }
        } catch (emailError) {
          console.error(`Error processing email ${email.id}:`, emailError);
          errorsCount++;
        }
      }
    }

    // Update sync phase results
    await supabase
      .from("cleanup_jobs")
      .update({
        synced_count: syncedCount,
        bounces_found: bouncesFound,
        errors_count: errorsCount,
      })
      .eq("id", jobId);

    console.log(`Sync phase complete: ${syncedCount} synced, ${bouncesFound} bounces found`);

    // ========== PHASE 2: CLEANUP BOUNCED CONTACTS ==========
    await supabase
      .from("cleanup_jobs")
      .update({ phase: "cleanup" })
      .eq("id", jobId);

    // Get all contacts with permanent bounces (via email_sends)
    const { data: bouncedEmails, error: bouncedError } = await supabase
      .from("email_sends")
      .select("contact_id, recipient_email, bounce_type")
      .not("bounced_at", "is", null);

    if (bouncedError) {
      console.error("Error fetching bounced emails:", bouncedError);
      throw bouncedError;
    }

    console.log(`Found ${bouncedEmails?.length || 0} bounced emails to process`);

    // Get unique contact IDs
    const contactIds = [...new Set(bouncedEmails?.map((e: any) => e.contact_id) || [])];
    
    console.log(`Processing ${contactIds.length} unique contacts with bounces`);

    let emailsCleared = 0;
    let contactsDeleted = 0;
    let crmReset = 0;

    // Process contacts in batches of 50 to avoid URL length limits
    const CONTACT_BATCH_SIZE = 50;
    
    for (let i = 0; i < contactIds.length; i += CONTACT_BATCH_SIZE) {
      const batchIds = contactIds.slice(i, i + CONTACT_BATCH_SIZE);
      
      // Fetch contact details for this batch
      const { data: batchContacts, error: contactsError } = await supabase
        .from("contacts")
        .select("id, linkedin_url, email, personal_email")
        .in("id", batchIds);

      if (contactsError) {
        console.error("Error fetching contacts batch:", contactsError);
        continue; // Continue with next batch instead of failing entirely
      }

      for (const contact of batchContacts || []) {
        const hasLinkedIn = contact.linkedin_url && contact.linkedin_url.trim() !== "";

        if (hasLinkedIn) {
          // Clear email fields and reset CRM stage
          const updateFields: any = { crm_stage: "Novo Lead" };
          
          if (contact.email) {
            updateFields.email = null;
            emailsCleared++;
          }
          if (contact.personal_email) {
            updateFields.personal_email = null;
            emailsCleared++;
          }

          await supabase
            .from("contacts")
            .update(updateFields)
            .eq("id", contact.id);

          crmReset++;

          // Log activity
          await supabase
            .from("contact_activities")
            .insert({
              contact_id: contact.id,
              activity_type: "email_cleaned",
              description: "Email limpo automaticamente após bounce permanente (limpeza global)",
              performed_by: "Sistema",
            });
        } else {
          // Delete contact without LinkedIn
          // First delete related records
          await supabase
            .from("contact_tags")
            .delete()
            .eq("contact_id", contact.id);

          await supabase
            .from("contact_activities")
            .delete()
            .eq("contact_id", contact.id);

          await supabase
            .from("contacts")
            .delete()
            .eq("id", contact.id);

          contactsDeleted++;
        }
      }
    }

    // ========== PHASE 3: COMPLETE ==========
    // Check if more emails need syncing
    const { count: remainingCount } = await supabase
      .from("email_sends")
      .select("*", { count: "exact", head: true })
      .not("resend_id", "is", null)
      .in("status", ["pending", "sent"]);

    const finalStatus = (remainingCount || 0) > 0 ? "partial" : "completed";

    await supabase
      .from("cleanup_jobs")
      .update({
        status: finalStatus,
        phase: "complete",
        synced_count: syncedCount,
        bounces_found: bouncesFound,
        emails_cleared: emailsCleared,
        contacts_deleted: contactsDeleted,
        crm_reset: crmReset,
        errors_count: errorsCount,
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    console.log(`Cleanup job ${jobId} ${finalStatus}:`);
    console.log(`  - Synced: ${syncedCount}`);
    console.log(`  - Bounces found: ${bouncesFound}`);
    console.log(`  - Emails cleared: ${emailsCleared}`);
    console.log(`  - Contacts deleted: ${contactsDeleted}`);
    console.log(`  - CRM reset: ${crmReset}`);
    console.log(`  - Remaining to sync: ${remainingCount || 0}`);

  } catch (error: any) {
    console.error(`Cleanup job ${jobId} failed:`, error);
    await supabase
      .from("cleanup_jobs")
      .update({
        status: "failed",
        last_error: error.message,
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobId);
  }
}
