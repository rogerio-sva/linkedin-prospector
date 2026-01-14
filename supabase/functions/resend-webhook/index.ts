import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature",
};

interface ResendWebhookEvent {
  type: string;
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject: string;
    created_at: string;
    // For click events
    click?: {
      link: string;
      timestamp: string;
    };
    // For bounce events
    bounce?: {
      type: string;
      message: string;
    };
  };
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const event: ResendWebhookEvent = await req.json();
    console.log("Received Resend webhook event:", event.type, event.data?.email_id);

    const emailId = event.data?.email_id;
    if (!emailId) {
      console.error("No email_id in webhook event");
      return new Response(JSON.stringify({ error: "No email_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find the email send record by resend_id (include contact_id for activity logging)
    const { data: emailSend, error: findError } = await supabase
      .from("email_sends")
      .select("id, contact_id, opened_count, clicked_count, clicked_links, opened_at, clicked_at")
      .eq("resend_id", emailId)
      .maybeSingle();

    if (findError) {
      console.error("Error finding email send:", findError);
      return new Response(JSON.stringify({ error: "Database error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!emailSend) {
      console.log("Email send not found for resend_id:", emailId);
      return new Response(JSON.stringify({ message: "Email not found, ignoring" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // Helper function to create contact activity
    const contactId = emailSend.contact_id;
    async function createActivity(activityType: string, description: string, metadata?: Record<string, any>) {
      if (!contactId) return;
      try {
        await supabase.from("contact_activities").insert({
          contact_id: contactId,
          activity_type: activityType,
          description: description,
          performed_by: null,
          metadata: metadata || {}
        });
        console.log(`Activity created: ${activityType} for contact ${contactId}`);
      } catch (err) {
        console.error(`Error creating activity ${activityType}:`, err);
      }
    }

    const now = new Date().toISOString();
    let updateData: Record<string, any> = {};

    switch (event.type) {
      case "email.sent":
        updateData = { status: "sent", sent_at: now };
        break;

      case "email.delivered":
        updateData = { status: "delivered", delivered_at: now };
        // Create activity for email delivered
        await createActivity("email_delivered", "Email entregue com sucesso");
        break;

      case "email.opened":
        updateData = {
          opened_at: emailSend.opened_at || now,
          opened_count: (emailSend.opened_count || 0) + 1,
        };
        break;

      case "email.clicked":
        const currentLinks = emailSend.clicked_links || [];
        const clickedLink = event.data.click?.link;
        if (clickedLink && !currentLinks.includes(clickedLink)) {
          currentLinks.push(clickedLink);
        }
        updateData = {
          clicked_at: emailSend.clicked_at || now,
          clicked_count: (emailSend.clicked_count || 0) + 1,
          clicked_links: currentLinks,
        };
        break;

      case "email.bounced":
        updateData = {
          status: "bounced",
          bounced_at: now,
          bounce_type: event.data.bounce?.type || "unknown",
          bounce_message: event.data.bounce?.message || "Unknown bounce",
        };
        
        // Create activity for bounce
        await createActivity(
          "email_bounced", 
          `Email retornou: ${event.data.bounce?.message || "Bounce"}`,
          { bounce_type: event.data.bounce?.type }
        );
        
        // Auto-add permanent bounces to suppression list
        if (event.data.bounce?.type === "Permanent") {
          const recipientEmail = event.data.to?.[0];
          if (recipientEmail) {
            console.log(`Adding permanent bounce to suppression list: ${recipientEmail}`);
            await supabase.from("suppressed_emails").upsert({
              email: recipientEmail,
              reason: "hard_bounce",
              source_contact_id: contactId || null,
              bounce_type: event.data.bounce.type,
              original_error: event.data.bounce.message,
            }, { onConflict: "email" });
          }
        }
        break;

      case "email.complained":
        updateData = {
          status: "complained",
          complained_at: now,
        };
        
        // Auto-add complaints to suppression list
        const complainedEmail = event.data.to?.[0];
        if (complainedEmail) {
          console.log(`Adding complaint to suppression list: ${complainedEmail}`);
          await supabase.from("suppressed_emails").upsert({
            email: complainedEmail,
            reason: "complaint",
          }, { onConflict: "email" });
        }
        break;

      case "email.delivery_delayed":
        updateData = {
          delivery_delayed_at: now,
        };
        console.log("Delivery delayed for:", emailId);
        break;

      case "email.failed":
        updateData = {
          status: "failed",
          error_message: event.data.bounce?.message || "Email failed to send",
        };
        console.log("Email failed for:", emailId);
        break;

      default:
        console.log("Unhandled event type:", event.type);
    }

    if (Object.keys(updateData).length > 0) {
      const { error: updateError } = await supabase
        .from("email_sends")
        .update(updateData)
        .eq("id", emailSend.id);

      if (updateError) {
        console.error("Error updating email send:", updateError);
        return new Response(JSON.stringify({ error: "Update failed" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log("Successfully updated email send:", emailSend.id, "with:", updateData);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error processing webhook:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
