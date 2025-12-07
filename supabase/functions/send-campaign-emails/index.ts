import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  campaignId?: string;
  templateId: string;
  baseId: string;
  fromEmail: string;
  fromName: string;
  contactIds?: string[]; // Optional: specific contacts, otherwise all from base
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

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { templateId, baseId, fromEmail, fromName, contactIds, campaignId }: EmailRequest = await req.json();

    console.log("Starting campaign email send:", { templateId, baseId, fromEmail, fromName, contactIdsCount: contactIds ? contactIds.length : 0 });

    // Validate required fields
    if (!templateId || !baseId || !fromEmail || !fromName) {
      throw new Error("Campos obrigatórios: templateId, baseId, fromEmail, fromName");
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

    // Fetch contacts from base
    let query = supabase
      .from("contacts")
      .select("id, first_name, last_name, full_name, email, personal_email, company_name, job_title, city, industry")
      .eq("base_id", baseId);

    if (contactIds && contactIds.length > 0) {
      query = query.in("id", contactIds);
    }

    const { data: contacts, error: contactsError } = await query;

    if (contactsError) {
      console.error("Contacts error:", contactsError);
      throw new Error("Erro ao buscar contatos");
    }

    if (!contacts || contacts.length === 0) {
      throw new Error("Nenhum contato encontrado na base");
    }

    console.log(`Found ${contacts.length} contacts to send emails`);

    // Filter contacts with valid emails
    const contactsWithEmail = contacts.filter((c: Contact) => c.email || c.personal_email);

    if (contactsWithEmail.length === 0) {
      throw new Error("Nenhum contato com email válido encontrado");
    }

    console.log(`${contactsWithEmail.length} contacts have valid emails`);

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

    // Send emails
    const results = {
      sent: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const contact of contactsWithEmail) {
      const recipientEmail = contact.email || contact.personal_email;
      const recipientName = contact.full_name || contact.first_name || "Contato";
      
      try {
        const { subject, body } = renderTemplate(template, contact);

        // Convert plain text body to HTML
        const htmlBody = body
          .split("\n")
          .map((line: string) => `<p>${line || "&nbsp;"}</p>`)
          .join("");

        console.log(`Sending email to ${recipientEmail}...`);

        const emailResponse = await resend.emails.send({
          from: `${fromName} <${fromEmail}>`,
          to: [recipientEmail],
          subject: subject,
          html: htmlBody,
        });

        console.log(`Email sent to ${recipientEmail}:`, emailResponse);

        // Record successful send
        await supabase.from("email_sends").insert({
          campaign_id: activeCampaignId,
          contact_id: contact.id,
          recipient_email: recipientEmail,
          recipient_name: recipientName,
          subject: subject,
          body: body,
          status: "sent",
          resend_id: emailResponse.data?.id || null,
          sent_at: new Date().toISOString(),
        });

        results.sent++;
      } catch (emailError: any) {
        console.error(`Failed to send email to ${recipientEmail}:`, emailError);

        // Record failed send
        await supabase.from("email_sends").insert({
          campaign_id: activeCampaignId,
          contact_id: contact.id,
          recipient_email: recipientEmail,
          recipient_name: recipientName,
          subject: template.subject,
          body: template.body,
          status: "failed",
          error_message: emailError.message || "Erro desconhecido",
        });

        results.failed++;
        results.errors.push(`${recipientEmail}: ${emailError.message}`);
      }

      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Update campaign status
    const finalStatus = results.failed === contactsWithEmail.length ? "failed" : "completed";
    await supabase
      .from("email_campaigns")
      .update({ 
        status: finalStatus, 
        sent_at: new Date().toISOString() 
      })
      .eq("id", activeCampaignId);

    console.log("Campaign completed:", results);

    return new Response(
      JSON.stringify({
        success: true,
        campaignId: activeCampaignId,
        results,
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
