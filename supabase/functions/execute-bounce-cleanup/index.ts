import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CleanupResult {
  success: boolean;
  emailsCleared: number;
  contactsDeleted: number;
  crmReset: number;
  errors: string[];
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Starting bounce cleanup...");

    // Get all permanent bounces from suppressed_emails
    const { data: suppressedEmails, error: suppressedError } = await supabase
      .from("suppressed_emails")
      .select("email, source_contact_id, created_at")
      .or("reason.eq.bounced,reason.eq.complained")
      .in("bounce_type", ["Permanent", "Complaint"]);

    if (suppressedError) {
      throw new Error(`Failed to fetch suppressed emails: ${suppressedError.message}`);
    }

    if (!suppressedEmails || suppressedEmails.length === 0) {
      console.log("No suppressed emails found");
      return new Response(
        JSON.stringify({
          success: true,
          emailsCleared: 0,
          contactsDeleted: 0,
          crmReset: 0,
          errors: [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${suppressedEmails.length} suppressed emails`);

    // Get unique emails that bounced (case-insensitive)
    const bouncedEmails = [...new Set(suppressedEmails.map(s => s.email.toLowerCase()))];
    console.log(`Unique bounced emails: ${bouncedEmails.length}`);

    // Find contacts that still have these emails - process in batches to avoid URL length limits
    const BATCH_SIZE = 50;
    const allContactsWithBounce: any[] = [];

    for (let i = 0; i < bouncedEmails.length; i += BATCH_SIZE) {
      const batch = bouncedEmails.slice(i, i + BATCH_SIZE);
      const emailList = batch.map(e => `"${e}"`).join(",");

      const { data: batchContacts, error: batchError } = await supabase
        .from("contacts")
        .select("id, email, personal_email, linkedin_url, base_id, full_name")
        .or(`email.in.(${emailList}),personal_email.in.(${emailList})`);

      if (batchError) {
        console.error(`Error fetching batch ${i}: ${batchError.message}`);
        continue;
      }

      if (batchContacts) {
        allContactsWithBounce.push(...batchContacts);
      }
    }

    console.log(`Found ${allContactsWithBounce.length} contacts with bounced emails`);

    if (allContactsWithBounce.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          emailsCleared: 0,
          contactsDeleted: 0,
          crmReset: 0,
          errors: [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Separate contacts with and without LinkedIn
    const contactsWithLinkedIn = allContactsWithBounce.filter(c => c.linkedin_url);
    const contactsWithoutLinkedIn = allContactsWithBounce.filter(c => !c.linkedin_url);

    console.log(`Contacts with LinkedIn: ${contactsWithLinkedIn.length}`);
    console.log(`Contacts without LinkedIn: ${contactsWithoutLinkedIn.length}`);

    const result: CleanupResult = {
      success: true,
      emailsCleared: 0,
      contactsDeleted: 0,
      crmReset: 0,
      errors: [],
    };

    // Process contacts with LinkedIn - clear email and reset stage
    if (contactsWithLinkedIn.length > 0) {
      const linkedInIds = contactsWithLinkedIn.map(c => c.id);

      // Process in batches
      for (let i = 0; i < linkedInIds.length; i += BATCH_SIZE) {
        const batchIds = linkedInIds.slice(i, i + BATCH_SIZE);

        const { error: updateError } = await supabase
          .from("contacts")
          .update({
            email: null,
            personal_email: null,
            crm_stage: "Novo Lead",
          })
          .in("id", batchIds);

        if (updateError) {
          result.errors.push(`Error updating batch ${i}: ${updateError.message}`);
          console.error(`Error updating contacts: ${updateError.message}`);
        } else {
          result.emailsCleared += batchIds.length;
          result.crmReset += batchIds.length;
        }
      }

      // Log activities for cleared contacts
      const activities = contactsWithLinkedIn.map(c => ({
        contact_id: c.id,
        activity_type: "bounce_cleanup",
        description: `Email limpo devido a bounce permanente. Contato mantido para prospecção via LinkedIn.`,
        performed_by: "Sistema",
        metadata: { action: "email_cleared", had_linkedin: true },
      }));

      // Insert activities in batches
      for (let i = 0; i < activities.length; i += BATCH_SIZE) {
        const batchActivities = activities.slice(i, i + BATCH_SIZE);
        await supabase.from("contact_activities").insert(batchActivities);
      }
    }

    // Process contacts without LinkedIn - delete them
    if (contactsWithoutLinkedIn.length > 0) {
      const externalIds = contactsWithoutLinkedIn.map(c => c.id);

      // First, log activities before deletion
      const deleteActivities = contactsWithoutLinkedIn.map(c => ({
        contact_id: c.id,
        activity_type: "bounce_cleanup",
        description: `Contato deletado devido a bounce permanente (sem LinkedIn).`,
        performed_by: "Sistema",
        metadata: { action: "contact_deleted", had_linkedin: false, contact_name: c.full_name },
      }));

      for (let i = 0; i < deleteActivities.length; i += BATCH_SIZE) {
        const batchActivities = deleteActivities.slice(i, i + BATCH_SIZE);
        await supabase.from("contact_activities").insert(batchActivities);
      }

      // Delete contacts in batches
      for (let i = 0; i < externalIds.length; i += BATCH_SIZE) {
        const batchIds = externalIds.slice(i, i + BATCH_SIZE);

        const { error: deleteError } = await supabase
          .from("contacts")
          .delete()
          .in("id", batchIds);

        if (deleteError) {
          result.errors.push(`Error deleting batch ${i}: ${deleteError.message}`);
          console.error(`Error deleting contacts: ${deleteError.message}`);
        } else {
          result.contactsDeleted += batchIds.length;
        }
      }
    }

    console.log(`Cleanup complete: ${result.emailsCleared} cleared, ${result.contactsDeleted} deleted`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("Cleanup error:", errorMessage);
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        emailsCleared: 0,
        contactsDeleted: 0,
        crmReset: 0,
        errors: [errorMessage],
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
