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
const BATCH_SIZE = 100; // Process 100 emails per execution (~50 seconds)

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
    
    // Load all Resend API keys for multi-account support
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const resendApiKey2 = Deno.env.get("RESEND_API_KEY_2");
    
    // Domain to API key mapping
    const domainApiKeyMap: Record<string, string | undefined> = {
      'fatopericias.com.br': resendApiKey2,
      // Default domains use primary key
    };

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, jobId, auto_mode } = await req.json();

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
      // Check for existing running/partial job
      const { data: existingJob } = await supabase
        .from("cleanup_jobs")
        .select("*")
        .in("status", ["running", "partial"])
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      let job = existingJob;

      // In auto_mode from cron, only process if there's a pending job
      if (auto_mode && !job) {
        console.log("Cron triggered but no pending jobs - skipping");
        return new Response(JSON.stringify({ 
          status: "idle", 
          message: "No pending cleanup jobs" 
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

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
      } else {
        // Resume existing job
        await supabase
          .from("cleanup_jobs")
          .update({ status: "running" })
          .eq("id", job.id);
      }

      // Process synchronously (not in background) to avoid timeout issues
      const result = await processCleanupChunk(supabase, job, resendApiKey, domainApiKeyMap);

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

async function processCleanupChunk(
  supabase: any, 
  job: any, 
  defaultResendApiKey: string | undefined,
  domainApiKeyMap: Record<string, string | undefined>
): Promise<CleanupResult> {
  const jobId = job.id;
  console.log(`Processing chunk for job ${jobId}, current synced: ${job.synced_count}`);

  try {
    let syncedCount = job.synced_count || 0;
    let bouncesFound = job.bounces_found || 0;
    let emailsCleared = job.emails_cleared || 0;
    let contactsDeleted = job.contacts_deleted || 0;
    let crmReset = job.crm_reset || 0;
    let errorsCount = job.errors_count || 0;

    // ========== PHASE 1: SYNC EMAIL STATUS ==========
    if (job.phase === "sync" || !job.phase) {
      await supabase
        .from("cleanup_jobs")
        .update({ phase: "sync", status: "running" })
        .eq("id", jobId);

      // Get pending emails to sync - use last_processed_id for cursor-based pagination
      // Include sender_domain for multi-account API key selection
      let query = supabase
        .from("email_sends")
        .select("id, resend_id, contact_id, recipient_email, status, sender_domain")
        .not("resend_id", "is", null)
        .in("status", ["pending", "sent"])
        .order("id", { ascending: true })
        .limit(BATCH_SIZE);

      if (job.last_processed_id) {
        query = query.gt("id", job.last_processed_id);
      }

      const { data: emailsToSync, error: fetchError } = await query;

      if (fetchError) {
        console.error("Error fetching emails:", fetchError);
        throw fetchError;
      }

      console.log(`Found ${emailsToSync?.length || 0} emails to sync in this chunk`);

      // LOOP DETECTION: If query returns 0 but there are still pending emails, reset cursor
      if ((emailsToSync?.length || 0) === 0 && job.last_processed_id) {
        const { count: stillPending } = await supabase
          .from("email_sends")
          .select("*", { count: "exact", head: true })
          .not("resend_id", "is", null)
          .in("status", ["pending", "sent"]);

        if ((stillPending || 0) > 0) {
          console.log(`LOOP DETECTED: 0 results but ${stillPending} pending. Resetting cursor.`);
          await supabase
            .from("cleanup_jobs")
            .update({ last_processed_id: null })
            .eq("id", jobId);
          
          // Refetch without cursor - include sender_domain
          const { data: retryEmails } = await supabase
            .from("email_sends")
            .select("id, resend_id, contact_id, recipient_email, status, sender_domain")
            .not("resend_id", "is", null)
            .in("status", ["pending", "sent"])
            .order("id", { ascending: true })
            .limit(BATCH_SIZE);
          
          if (retryEmails && retryEmails.length > 0) {
            // Replace emailsToSync reference and continue processing
            Object.assign(emailsToSync || [], retryEmails);
          }
        }
      }

      if (defaultResendApiKey && emailsToSync && emailsToSync.length > 0) {
        let lastProcessedId = job.last_processed_id;
        let chunkSynced = 0;
        let chunkBounces = 0;

        for (const email of emailsToSync) {
          try {
            // Rate limiting delay
            await delay(RATE_LIMIT_DELAY);

            // Select the correct API key based on sender_domain
            const apiKeyToUse = email.sender_domain 
              ? (domainApiKeyMap[email.sender_domain] || defaultResendApiKey)
              : defaultResendApiKey;
            
            if (!apiKeyToUse) {
              console.error(`No API key available for domain: ${email.sender_domain}`);
              errorsCount++;
              lastProcessedId = email.id;
              continue;
            }

            // Fetch status from Resend API with the correct key
            const response = await fetch(`https://api.resend.com/emails/${email.resend_id}`, {
              headers: {
                Authorization: `Bearer ${apiKeyToUse}`,
              },
            });

            if (!response.ok) {
              if (response.status === 429) {
                console.log("Rate limit hit, waiting...");
                await delay(2000);
                // Don't skip, retry on next chunk
                break;
              }
              
              // Handle permanent API errors (404 = email not found in Resend)
              if (response.status === 404) {
                console.log(`Email ${email.resend_id} not found in Resend, marking as failed`);
                await supabase
                  .from("email_sends")
                  .update({ status: "failed", error_message: "Email not found in Resend (404)" })
                  .eq("id", email.id);
                chunkSynced++;
                lastProcessedId = email.id;
                continue;
              }
              
              // Handle 403 Forbidden - invalid or expired API key
              if (response.status === 403) {
                console.log(`API key unauthorized for ${email.resend_id} (domain: ${email.sender_domain}), marking as failed`);
                await supabase
                  .from("email_sends")
                  .update({ 
                    status: "failed", 
                    error_message: `API key unauthorized for domain ${email.sender_domain} (403 Forbidden)` 
                  })
                  .eq("id", email.id);
                chunkSynced++;
                lastProcessedId = email.id;
                continue;
              }
              
              console.error(`Resend API error for ${email.resend_id}: ${response.status}`);
              errorsCount++;
              lastProcessedId = email.id;
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
              chunkBounces++;

              // Add ALL bounces to suppression list (Resend suppresses transients too)
              const isTransient = resendData.bounce_type === "Transient" || 
                                 resendData.bounce_type === "transient" ||
                                 resendData.bounce_type === "soft";
              
              await supabase
                .from("suppressed_emails")
                .upsert({
                  email: email.recipient_email.toLowerCase(),
                  reason: isTransient ? "soft_bounce" : "bounce",
                  bounce_type: resendData.bounce_type || "permanent",
                  source_contact_id: email.contact_id,
                  original_error: resendData.bounce_message,
                }, { onConflict: "email" });
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

            chunkSynced++;
            lastProcessedId = email.id;

            // Update progress every 20 emails
            if (chunkSynced % 20 === 0) {
              await supabase
                .from("cleanup_jobs")
                .update({
                  synced_count: syncedCount + chunkSynced,
                  bounces_found: bouncesFound + chunkBounces,
                  errors_count: errorsCount,
                  last_processed_id: lastProcessedId,
                })
                .eq("id", jobId);
            }
          } catch (emailError) {
            console.error(`Error processing email ${email.id}:`, emailError);
            errorsCount++;
            lastProcessedId = email.id;
          }
        }

        syncedCount += chunkSynced;
        bouncesFound += chunkBounces;

        // Update job with final chunk results
        await supabase
          .from("cleanup_jobs")
          .update({
            synced_count: syncedCount,
            bounces_found: bouncesFound,
            errors_count: errorsCount,
            last_processed_id: lastProcessedId,
          })
          .eq("id", jobId);

        console.log(`Chunk complete: synced ${chunkSynced}, bounces ${chunkBounces}`);
      }

      // Check if there are more emails to sync
      const { count: remainingCount } = await supabase
        .from("email_sends")
        .select("*", { count: "exact", head: true })
        .not("resend_id", "is", null)
        .in("status", ["pending", "sent"]);

      if ((remainingCount || 0) > 0) {
        // More to sync - return partial status
        await supabase
          .from("cleanup_jobs")
          .update({ status: "partial" })
          .eq("id", jobId);

        return {
          jobId,
          status: "partial",
          phase: "sync",
          synced: syncedCount,
          bouncesFound,
          emailsCleared,
          contactsDeleted,
          crmReset,
          errors: errorsCount,
          remaining: remainingCount || 0,
          message: `Sincronizado ${syncedCount} emails. Restam ${remainingCount}. Processando automaticamente...`,
        };
      }

      // Sync complete, move to cleanup phase
      await supabase
        .from("cleanup_jobs")
        .update({ phase: "cleanup", last_processed_id: null })
        .eq("id", jobId);
      
      job.phase = "cleanup";
    }

    // ========== PHASE 2: CLEANUP BOUNCED CONTACTS ==========
    if (job.phase === "cleanup") {
      console.log("Starting cleanup phase");

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
          continue;
        }

        for (const contact of batchContacts || []) {
          try {
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

              // Also delete email_sends for this contact
              await supabase
                .from("email_sends")
                .delete()
                .eq("contact_id", contact.id);

              await supabase
                .from("contacts")
                .delete()
                .eq("id", contact.id);

              contactsDeleted++;
            }
          } catch (contactError) {
            console.error(`Error processing contact ${contact.id}:`, contactError);
            errorsCount++;
          }
        }
      }

      // ========== PHASE 3: COMPLETE ==========
      await supabase
        .from("cleanup_jobs")
        .update({
          status: "completed",
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

      console.log(`Cleanup job ${jobId} completed:`);
      console.log(`  - Synced: ${syncedCount}`);
      console.log(`  - Bounces found: ${bouncesFound}`);
      console.log(`  - Emails cleared: ${emailsCleared}`);
      console.log(`  - Contacts deleted: ${contactsDeleted}`);
      console.log(`  - CRM reset: ${crmReset}`);

      return {
        jobId,
        status: "completed",
        phase: "complete",
        synced: syncedCount,
        bouncesFound,
        emailsCleared,
        contactsDeleted,
        crmReset,
        errors: errorsCount,
        remaining: 0,
        message: `Limpeza completa! ${emailsCleared} emails limpos, ${contactsDeleted} contatos removidos.`,
      };
    }

    // Default return
    return {
      jobId,
      status: job.status,
      phase: job.phase,
      synced: syncedCount,
      bouncesFound,
      emailsCleared,
      contactsDeleted,
      crmReset,
      errors: errorsCount,
      remaining: 0,
      message: "Job state unknown",
    };
  } catch (error: any) {
    console.error(`Error in processCleanupChunk for job ${jobId}:`, error);

    // Update job with error status
    await supabase
      .from("cleanup_jobs")
      .update({
        status: "failed",
        last_error: error.message,
      })
      .eq("id", jobId);

    return {
      jobId,
      status: "failed",
      phase: job.phase,
      synced: job.synced_count || 0,
      bouncesFound: job.bounces_found || 0,
      emailsCleared: job.emails_cleared || 0,
      contactsDeleted: job.contacts_deleted || 0,
      crmReset: job.crm_reset || 0,
      errors: (job.errors_count || 0) + 1,
      remaining: 0,
      message: `Erro: ${error.message}`,
    };
  }
}
