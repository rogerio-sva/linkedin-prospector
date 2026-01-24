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

interface ContactWithBounce {
  id: string;
  email: string | null;
  personal_email: string | null;
  linkedin_url: string | null;
  base_id: string;
  full_name: string | null;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Starting bounce cleanup with case-insensitive matching...");

    // Use the SQL function for case-insensitive email matching
    const { data: allContactsWithBounce, error: rpcError } = await supabase
      .rpc('find_contacts_with_bounced_emails') as { data: ContactWithBounce[] | null; error: any };

    if (rpcError) {
      throw new Error(`Failed to find bounced contacts: ${rpcError.message}`);
    }

    if (!allContactsWithBounce || allContactsWithBounce.length === 0) {
      console.log("No contacts with bounced emails found");
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

    console.log(`Found ${allContactsWithBounce.length} contacts with bounced emails (case-insensitive)`);

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

    const BATCH_SIZE = 50;

    // Process contacts with LinkedIn - clear email and reset stage
    if (contactsWithLinkedIn.length > 0) {
      const linkedInIds = contactsWithLinkedIn.map(c => c.id);

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
