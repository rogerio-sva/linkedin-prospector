import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// Domain to API Key mapping for multiple Resend accounts
const DOMAIN_API_KEY_MAP: Record<string, string | undefined> = {
  'dominions.com.br': Deno.env.get("RESEND_API_KEY"),
  'academiadoperito.com': Deno.env.get("RESEND_API_KEY"),
  'fatopericias.com.br': Deno.env.get("RESEND_API_KEY_2"),
};

// Get the correct Resend API key based on sender email domain
function getResendApiKey(fromEmail: string): string {
  const domain = fromEmail.split('@')[1]?.toLowerCase();
  const apiKey = DOMAIN_API_KEY_MAP[domain];
  
  if (apiKey) {
    console.log(`[Resend] Using API key for domain: ${domain}`);
    return apiKey;
  }
  
  // Fallback to default API key
  console.log(`[Resend] Domain ${domain} not mapped, using default RESEND_API_KEY`);
  return Deno.env.get("RESEND_API_KEY") || '';
}

// Get Resend instance for a specific sender email
function getResendClient(fromEmail: string): Resend {
  const apiKey = getResendApiKey(fromEmail);
  return new Resend(apiKey);
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  campaignId?: string;
  templateId: string;
  baseId?: string;
  fromEmail: string;
  fromName: string;
  replyTo?: string;
  emailType?: "personal" | "corporate" | "both";
  emailFormat?: "text" | "html";
  contactIds?: string[];
  batchMode?: boolean;
  testRecipient?: {
    email: string;
    name: string;
  };
  testSubject?: string;
  testBody?: string;
}

interface Contact {
  id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  email: string | null;
  personal_email: string | null;
  company_name: string | null;
  job_title: string | null;
  city: string | null;
  industry: string | null;
}

interface Template {
  id: string;
  name: string;
  subject: string;
  body: string;
}

interface BatchEmailItem {
  from: string;
  to: string[];
  reply_to: string;
  subject: string;
  html?: string;
  text?: string;
}

// Sanitize name to prevent "Invalid to field" errors from Resend
function sanitizeName(name: string | null | undefined): string {
  if (!name) return "";
  
  // Remove characters that break RFC 5322 email format
  return name
    .replace(/[<>,"';\\[\]()]/g, '') // Remove problematic characters
    .replace(/\s+/g, ' ')             // Normalize whitespace
    .trim()
    .substring(0, 50);                // Limit length
}

function renderTemplate(template: Template, contact: Contact): { subject: string; body: string } {
  const replacements: Record<string, string> = {
    firstName: contact.first_name || "",
    lastName: contact.last_name || "",
    fullName: contact.full_name || "",
    companyName: contact.company_name || "",
    jobTitle: contact.job_title || "",
    email: contact.email || contact.personal_email || "",
    city: contact.city || "",
    industry: contact.industry || "",
  };

  let renderedSubject = template.subject;
  let renderedBody = template.body;

  Object.entries(replacements).forEach(([key, value]) => {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
    renderedSubject = renderedSubject.replace(regex, value);
    renderedBody = renderedBody.replace(regex, value);
  });

  return { subject: renderedSubject, body: renderedBody };
}

// Send emails using Resend Batch API (up to 100 emails per request)
// OPTIMIZED: Batch database inserts for better performance
async function sendEmailsWithBatchAPI(
  supabase: any,
  resend: Resend,
  template: Template,
  contactsWithEmail: Contact[],
  campaignId: string,
  fromEmail: string,
  fromName: string,
  replyTo: string,
  emailType: string,
  emailFormat: "text" | "html" = "text"
): Promise<{ sent: number; failed: number; suppressed: number; invalidEmails: number; errors: string[] }> {
  console.log(`[BatchAPI] Sending ${contactsWithEmail.length} emails for campaign ${campaignId}`);
  
  // Get emails to check
  const emailsToCheck = contactsWithEmail.map(c => {
    if (emailType === "personal") return c.personal_email;
    if (emailType === "corporate") return c.email;
    return c.personal_email || c.email;
  }).filter(Boolean) as string[];
  
  // Fetch suppressed emails to filter out
  const { data: suppressedEmails } = await supabase
    .from("suppressed_emails")
    .select("email")
    .in("email", emailsToCheck);
  
  const suppressedSet = new Set((suppressedEmails || []).map((s: { email: string }) => s.email.toLowerCase()));
  console.log(`[BatchAPI] Found ${suppressedSet.size} suppressed emails to skip`);
  
  // Fetch email validations to filter out undeliverable emails
  const { data: emailValidations } = await supabase
    .from("email_validations")
    .select("email, status")
    .in("email", emailsToCheck);
  
  const undeliverableSet = new Set(
    (emailValidations || [])
      .filter((v: { email: string; status: string }) => v.status === "undeliverable")
      .map((v: { email: string }) => v.email.toLowerCase())
  );
  console.log(`[BatchAPI] Found ${undeliverableSet.size} undeliverable emails to skip`);
  
  // Filter out suppressed and undeliverable contacts
  let filteredContacts = contactsWithEmail.filter(c => {
    const targetEmail = emailType === "personal" 
      ? c.personal_email 
      : emailType === "corporate" 
        ? c.email 
        : (c.personal_email || c.email);
    return targetEmail && !suppressedSet.has(targetEmail.toLowerCase());
  });
  
  const suppressedCount = contactsWithEmail.length - filteredContacts.length;
  
  // Now filter out undeliverable emails
  const beforeUndeliverableFilter = filteredContacts.length;
  filteredContacts = filteredContacts.filter(c => {
    const targetEmail = emailType === "personal" 
      ? c.personal_email 
      : emailType === "corporate" 
        ? c.email 
        : (c.personal_email || c.email);
    return targetEmail && !undeliverableSet.has(targetEmail.toLowerCase());
  });
  
  const invalidEmailsCount = beforeUndeliverableFilter - filteredContacts.length;
  console.log(`[BatchAPI] Filtered ${suppressedCount} suppressed, ${invalidEmailsCount} undeliverable, ${filteredContacts.length} remaining`);
  
  const results = {
    sent: 0,
    failed: 0,
    suppressed: suppressedCount,
    invalidEmails: invalidEmailsCount,
    errors: [] as string[],
  };

  // If all contacts are filtered out, return early
  if (filteredContacts.length === 0) {
    console.log(`[BatchAPI] All contacts are filtered out, nothing to send`);
    return results;
  }

  const BATCH_SIZE = 100; // Resend allows up to 100 emails per batch request
  
  // Split contacts into batches of 100
  for (let i = 0; i < filteredContacts.length; i += BATCH_SIZE) {
    const batchContacts = filteredContacts.slice(i, i + BATCH_SIZE);
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(filteredContacts.length / BATCH_SIZE);
    
    console.log(`[BatchAPI] Processing batch ${batchNumber}/${totalBatches} (${batchContacts.length} emails)`);
    
    // Prepare batch email data
    const batchEmails: any[] = [];
    const contactMap: Map<string, { contact: Contact; recipientEmail: string; recipientName: string; subject: string; body: string }> = new Map();
    
    for (const contact of batchContacts) {
      let recipientEmail: string;
      if (emailType === "personal") {
        recipientEmail = contact.personal_email!;
      } else if (emailType === "corporate") {
        recipientEmail = contact.email!;
      } else {
        recipientEmail = contact.personal_email || contact.email!;
      }
      const recipientName = sanitizeName(contact.full_name || contact.first_name) || "Contato";
      
      const { subject, body } = renderTemplate(template, contact);
      
      // Build email based on format
      const emailPayload: any = {
        from: `${fromName} <${fromEmail}>`,
        to: [recipientEmail],
        reply_to: replyTo,
        subject: subject,
      };
      
      if (emailFormat === "html") {
        emailPayload.html = body
          .split("\n")
          .map((line: string) => `<p>${line || "&nbsp;"}</p>`)
          .join("");
      } else {
        // Plain text - better for deliverability
        emailPayload.text = body;
      }
      
      batchEmails.push(emailPayload);
      
      contactMap.set(recipientEmail, { contact, recipientEmail, recipientName, subject, body });
    }
    
    try {
      // Use Resend Batch API
      console.log(`[BatchAPI] Sending batch request with ${batchEmails.length} emails (format: ${emailFormat})...`);
      const batchResponse = await resend.batch.send(batchEmails);
      
      console.log(`[BatchAPI] Batch response:`, JSON.stringify(batchResponse));
      
      if (batchResponse.error) {
        console.error(`[BatchAPI] Batch error:`, batchResponse.error);
        
        // Batch insert all failed records
        const failedEmailSends: any[] = [];
        for (const [email, data] of contactMap) {
          failedEmailSends.push({
            campaign_id: campaignId,
            contact_id: data.contact.id,
            recipient_email: data.recipientEmail,
            recipient_name: data.recipientName,
            subject: data.subject,
            body: data.body,
            status: "failed",
            error_message: (batchResponse.error as any).message || "Erro no batch",
          });
          results.failed++;
          results.errors.push(`${email}: ${(batchResponse.error as any).message}`);
        }
        
        // Single batch insert for all failures
        if (failedEmailSends.length > 0) {
          await supabase.from("email_sends").insert(failedEmailSends);
        }
        
        // Check for rate limit or quota errors
        const errorName = (batchResponse.error as any).name;
        if (errorName === "daily_quota_exceeded") {
          console.log("[BatchAPI] Daily quota exceeded, stopping...");
          break;
        }
        if (errorName === "rate_limit_exceeded") {
          console.log("[BatchAPI] Rate limited, waiting 2 seconds...");
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
        
        continue;
      }
      
      // Process successful batch response
      // Resend Batch API returns {"data":{"data":[...]}} structure
      const responseData = (batchResponse.data as any)?.data || batchResponse.data;
      if (responseData && Array.isArray(responseData)) {
        const emailEntries = Array.from(contactMap.entries());
        const now = new Date().toISOString();
        
        // Accumulators for batch DB operations
        const successEmailSends: any[] = [];
        const failedEmailSends: any[] = [];
        const successContactIds: string[] = [];
        const successActivities: any[] = [];
        
        for (let j = 0; j < responseData.length; j++) {
          const result = responseData[j];
          const [email, data] = emailEntries[j];
          
          if (result.id) {
            // Success - accumulate for batch insert
            const senderDomain = fromEmail.split('@')[1]?.toLowerCase() || null;
            successEmailSends.push({
              campaign_id: campaignId,
              contact_id: data.contact.id,
              recipient_email: data.recipientEmail,
              recipient_name: data.recipientName,
              subject: data.subject,
              body: data.body,
              status: "sent",
              resend_id: result.id,
              sent_at: now,
              sender_domain: senderDomain,
            });
            
            successContactIds.push(data.contact.id);
            
            successActivities.push({
              contact_id: data.contact.id,
              activity_type: "email_sent",
              description: `Email enviado: ${data.subject}`,
              performed_by: null,
              metadata: {
                campaign_id: campaignId,
                recipient_email: data.recipientEmail,
                resend_id: result.id
              }
            });
            
            results.sent++;
          } else {
            // Individual email failed - accumulate
            failedEmailSends.push({
              campaign_id: campaignId,
              contact_id: data.contact.id,
              recipient_email: data.recipientEmail,
              recipient_name: data.recipientName,
              subject: data.subject,
              body: data.body,
              status: "failed",
              error_message: "Erro ao enviar",
            });
            results.failed++;
            results.errors.push(`${email}: Erro ao enviar`);
          }
        }
        
        // BATCH DB OPERATIONS - Much faster than individual inserts
        const dbStartTime = Date.now();
        
        // Insert all successful email_sends in one operation
        if (successEmailSends.length > 0) {
          const { error: emailSendsError } = await supabase.from("email_sends").insert(successEmailSends);
          if (emailSendsError) {
            console.error(`[BatchAPI] Error batch inserting email_sends:`, emailSendsError);
          }
        }
        
        // Insert all failed email_sends in one operation
        if (failedEmailSends.length > 0) {
          const { error: failedEmailSendsError } = await supabase.from("email_sends").insert(failedEmailSends);
          if (failedEmailSendsError) {
            console.error(`[BatchAPI] Error batch inserting failed email_sends:`, failedEmailSendsError);
          }
        }
        
        // Batch update contacts - update crm_stage for all successful contacts
        if (successContactIds.length > 0) {
          const { error: contactsUpdateError } = await supabase
            .from("contacts")
            .update({ 
              crm_stage: "Email Enviado",
              last_activity_at: now
            })
            .in("id", successContactIds)
            .or("crm_stage.is.null,crm_stage.eq.Novo Lead,crm_stage.eq.");
          
          if (contactsUpdateError) {
            console.error(`[BatchAPI] Error batch updating contacts:`, contactsUpdateError);
          }
        }
        
        // Batch insert all activities
        if (successActivities.length > 0) {
          const { error: activitiesError } = await supabase.from("contact_activities").insert(successActivities);
          if (activitiesError) {
            console.error(`[BatchAPI] Error batch inserting activities:`, activitiesError);
          }
        }
        
        const dbTime = Date.now() - dbStartTime;
        console.log(`[BatchAPI] Batch ${batchNumber} DB operations completed in ${dbTime}ms`);
      }
      
      console.log(`[BatchAPI] Batch ${batchNumber} completed: ${results.sent} sent, ${results.failed} failed`);
      
    } catch (batchError: any) {
      console.error(`[BatchAPI] Batch ${batchNumber} exception:`, batchError);
      
      // Batch insert all failed records
      const failedEmailSends: any[] = [];
      for (const [email, data] of contactMap) {
        failedEmailSends.push({
          campaign_id: campaignId,
          contact_id: data.contact.id,
          recipient_email: data.recipientEmail,
          recipient_name: data.recipientName,
          subject: data.subject,
          body: data.body,
          status: "failed",
          error_message: batchError.message || "Erro desconhecido",
        });
        results.failed++;
        results.errors.push(`${email}: ${batchError.message}`);
      }
      
      if (failedEmailSends.length > 0) {
        await supabase.from("email_sends").insert(failedEmailSends);
      }
    }
    
    // Reduced delay between batch requests (50ms instead of 100ms)
    if (i + BATCH_SIZE < filteredContacts.length) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  console.log(`[BatchAPI] All batches completed:`, results);
  return results;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { 
      templateId, 
      baseId, 
      fromEmail, 
      fromName, 
      replyTo, 
      emailType = "personal",
      emailFormat = "text",
      contactIds, 
      campaignId, 
      batchMode = false,
      testRecipient, 
      testSubject, 
      testBody 
    }: EmailRequest = await req.json();

    console.log("Starting email send:", { templateId, baseId, fromEmail, fromName, replyTo, emailType, emailFormat, batchMode, contactIdsCount: contactIds?.length, testRecipient });

    if (!fromEmail || !fromName) {
      throw new Error("Campos obrigatórios: fromEmail, fromName");
    }

    // Handle direct test send (synchronous - quick)
    if (testRecipient && testSubject && testBody) {
      // Support both string and object format for testRecipient
      const recipientEmail = typeof testRecipient === 'string' 
        ? testRecipient 
        : testRecipient.email;
        
      console.log(`Sending test email to ${recipientEmail} (format: ${emailFormat})...`);
      
      const emailPayload: any = {
        from: `${fromName} <${fromEmail}>`,
        to: [recipientEmail],
        reply_to: replyTo || fromEmail,
        subject: testSubject,
      };
      
      if (emailFormat === "html") {
        emailPayload.html = testBody
          .split("\n")
          .map((line: string) => `<p>${line || "&nbsp;"}</p>`)
          .join("");
      } else {
        emailPayload.text = testBody;
      }

      // Get Resend client based on sender domain
      const resendClient = getResendClient(fromEmail);
      const emailResponse = await resendClient.emails.send(emailPayload);

      console.log("Test email sent:", emailResponse);

      return new Response(
        JSON.stringify({
          success: true,
          testSend: true,
          resendId: emailResponse.data?.id,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // For campaign sends, require templateId and baseId
    if (!templateId || !baseId) {
      throw new Error("Campos obrigatórios para campanha: templateId, baseId");
    }

    // For batch mode, contactIds is required
    if (batchMode && (!contactIds || contactIds.length === 0)) {
      throw new Error("Batch mode requires contactIds");
    }

    // Fetch template
    const { data: template, error: templateError } = await supabase
      .from("email_templates")
      .select("*")
      .eq("id", templateId)
      .single();

    if (templateError || !template) {
      console.error("Template error:", templateError);
      throw new Error("Template não encontrado");
    }

    console.log("Template loaded:", template.name);

    // Fetch contacts by IDs (batch mode)
    if (batchMode && contactIds && contactIds.length > 0) {
      // Fetch contacts in sub-batches of 100 IDs to avoid URL length limits
      const CONTACT_FETCH_BATCH_SIZE = 100;
      let allFetchedContacts: Contact[] = [];
      
      console.log(`[BatchMode] Fetching ${contactIds.length} contacts in sub-batches of ${CONTACT_FETCH_BATCH_SIZE}`);
      
      for (let i = 0; i < contactIds.length; i += CONTACT_FETCH_BATCH_SIZE) {
        const batchIds = contactIds.slice(i, i + CONTACT_FETCH_BATCH_SIZE);
        const subBatchNum = Math.floor(i / CONTACT_FETCH_BATCH_SIZE) + 1;
        const totalSubBatches = Math.ceil(contactIds.length / CONTACT_FETCH_BATCH_SIZE);
        
        console.log(`[BatchMode] Fetching sub-batch ${subBatchNum}/${totalSubBatches} (${batchIds.length} IDs)`);
        
        const { data: batchContacts, error: batchError } = await supabase
          .from("contacts")
          .select("id, first_name, last_name, full_name, email, personal_email, company_name, job_title, city, industry")
          .in("id", batchIds);
        
        if (batchError) {
          console.error(`[BatchMode] Error fetching sub-batch ${subBatchNum}:`, batchError);
          throw new Error("Erro ao buscar contatos");
        }
        
        if (batchContacts) {
          allFetchedContacts = allFetchedContacts.concat(batchContacts);
        }
      }
      
      const contacts = allFetchedContacts;

      if (!contacts || contacts.length === 0) {
        throw new Error("Nenhum contato encontrado");
      }

      console.log(`[BatchMode] Total fetched: ${contacts.length} contacts for batch`);

      // Filter contacts based on email type preference
      const contactsWithEmail = contacts.filter((c: Contact) => {
        if (emailType === "personal") return c.personal_email;
        if (emailType === "corporate") return c.email;
        return c.email || c.personal_email;
      });

      if (contactsWithEmail.length === 0) {
        throw new Error("Nenhum contato com email válido encontrado para o tipo selecionado");
      }

      console.log(`${contactsWithEmail.length} contacts have valid emails for type: ${emailType}`);

      // Get Resend client based on sender domain
      const resendClient = getResendClient(fromEmail);

      // Process batch using Batch API
      const results = await sendEmailsWithBatchAPI(
        supabase,
        resendClient,
        template,
        contactsWithEmail,
        campaignId!,
        fromEmail,
        fromName,
        replyTo || fromEmail,
        emailType,
        emailFormat
      );

      return new Response(
        JSON.stringify({
          success: true,
          batchMode: true,
          sent: results.sent,
          failed: results.failed,
          suppressed: results.suppressed,
          invalidEmails: results.invalidEmails,
          errors: results.errors,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Legacy mode: fetch all contacts from base (for backwards compatibility)
    let allContacts: Contact[] = [];
    let offset = 0;
    const pageSize = 1000;
    
    while (true) {
      let query = supabase
        .from("contacts")
        .select("id, first_name, last_name, full_name, email, personal_email, company_name, job_title, city, industry")
        .eq("base_id", baseId)
        .range(offset, offset + pageSize - 1);

      if (contactIds && contactIds.length > 0) {
        query = query.in("id", contactIds);
      }

      const { data: batch, error: contactsError } = await query;

      if (contactsError) {
        console.error("Contacts error:", contactsError);
        throw new Error("Erro ao buscar contatos");
      }
      
      if (!batch || batch.length === 0) break;
      
      allContacts = [...allContacts, ...batch];
      
      if (batch.length < pageSize) break;
      offset += pageSize;
    }

    const contacts = allContacts;

    if (!contacts || contacts.length === 0) {
      throw new Error("Nenhum contato encontrado na base");
    }

    console.log(`Found ${contacts.length} contacts to send emails`);

    // Filter contacts based on email type preference
    const contactsWithEmail = contacts.filter((c: Contact) => {
      if (emailType === "personal") return c.personal_email;
      if (emailType === "corporate") return c.email;
      return c.email || c.personal_email;
    });

    if (contactsWithEmail.length === 0) {
      throw new Error("Nenhum contato com email válido encontrado para o tipo selecionado");
    }

    console.log(`${contactsWithEmail.length} contacts have valid emails for type: ${emailType}`);

    // Get Resend client based on sender domain
    const resendClient = getResendClient(fromEmail);

    // Create or update campaign
    let activeCampaignId = campaignId;
    if (!activeCampaignId) {
      const { data: campaign, error: campaignError } = await supabase
        .from("email_campaigns")
        .insert({
          name: `Campanha - ${template.name} - ${new Date().toLocaleDateString("pt-BR")}`,
          template_id: templateId,
          base_id: baseId,
          status: "sending",
          total_recipients: contactsWithEmail.length,
        })
        .select()
        .single();

      if (campaignError) {
        console.error("Campaign creation error:", campaignError);
        throw new Error("Erro ao criar campanha");
      }

      activeCampaignId = campaign.id;
      console.log("Campaign created:", activeCampaignId);
    } else {
      await supabase
        .from("email_campaigns")
        .update({ status: "sending", total_recipients: contactsWithEmail.length })
        .eq("id", activeCampaignId);
    }

    // Process using Batch API
    const results = await sendEmailsWithBatchAPI(
      supabase,
      resendClient,
      template,
      contactsWithEmail,
      activeCampaignId!,
      fromEmail,
      fromName,
      replyTo || fromEmail,
      emailType,
      emailFormat
    );

    // Update campaign status
    const finalStatus = results.failed === contactsWithEmail.length ? "failed" : "completed";
    await supabase
      .from("email_campaigns")
      .update({ 
        status: finalStatus, 
        sent_at: new Date().toISOString() 
      })
      .eq("id", activeCampaignId);

    return new Response(
      JSON.stringify({
        success: true,
        campaignId: activeCampaignId,
        sent: results.sent,
        failed: results.failed,
        errors: results.errors,
        totalRecipients: contactsWithEmail.length,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-campaign-emails:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
