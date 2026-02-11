import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE = 500;

async function processScheduledResume(params: {
  campaignId: string;
  fromEmail: string;
  fromName: string;
  replyTo: string;
  emailFormat: string;
}) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { campaignId, fromEmail, fromName, replyTo, emailFormat } = params;

  console.log(`[scheduled-resume] Starting for campaign ${campaignId}`);

  try {
    // Fetch ALL pending email_send IDs for this campaign
    const allPendingIds: string[] = [];
    let offset = 0;
    const PAGE = 1000;

    while (true) {
      const { data, error } = await supabase
        .from("email_sends")
        .select("id")
        .eq("campaign_id", campaignId)
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .range(offset, offset + PAGE - 1);

      if (error) {
        console.error(`[scheduled-resume] Error fetching pending:`, error);
        break;
      }
      if (!data || data.length === 0) break;

      allPendingIds.push(...data.map((r: any) => r.id));
      if (data.length < PAGE) break;
      offset += PAGE;
    }

    console.log(`[scheduled-resume] Found ${allPendingIds.length} pending sends`);

    if (allPendingIds.length === 0) {
      console.log(`[scheduled-resume] Nothing to send, exiting`);
      return;
    }

    // Split into batches of 500 and call send-campaign-emails sequentially
    const totalBatches = Math.ceil(allPendingIds.length / BATCH_SIZE);
    let successBatches = 0;
    let failedBatches = 0;

    for (let i = 0; i < allPendingIds.length; i += BATCH_SIZE) {
      const batchIds = allPendingIds.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;

      console.log(`[scheduled-resume] Sending batch ${batchNum}/${totalBatches} (${batchIds.length} IDs)`);

      try {
        const response = await fetch(
          `${supabaseUrl}/functions/v1/send-campaign-emails`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${supabaseAnonKey}`,
            },
            body: JSON.stringify({
              campaignId,
              fromEmail,
              fromName,
              replyTo,
              emailFormat,
              resumePending: true,
              contactIds: batchIds,
            }),
          }
        );

        if (!response.ok) {
          const text = await response.text();
          console.error(`[scheduled-resume] Batch ${batchNum} HTTP ${response.status}: ${text}`);
          failedBatches++;
        } else {
          const result = await response.json();
          console.log(`[scheduled-resume] Batch ${batchNum} OK:`, JSON.stringify(result));
          successBatches++;
        }
      } catch (err: any) {
        console.error(`[scheduled-resume] Batch ${batchNum} error: ${err.message}`);
        failedBatches++;
      }

      // Small delay between batches
      if (i + BATCH_SIZE < allPendingIds.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    console.log(`[scheduled-resume] DONE: ${successBatches}/${totalBatches} batches OK, ${failedBatches} failed`);

  } catch (error: any) {
    console.error("[scheduled-resume] Fatal error:", error);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { campaignId, fromEmail, fromName, replyTo, emailFormat } = body;

    if (!campaignId || !fromEmail || !fromName) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields: campaignId, fromEmail, fromName" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[scheduled-resume] Received request for campaign ${campaignId}, starting background processing`);

    // Process in background so cron doesn't timeout
    (globalThis as any).EdgeRuntime?.waitUntil?.(
      processScheduledResume({ campaignId, fromEmail, fromName, replyTo: replyTo || fromEmail, emailFormat: emailFormat || "text" })
    ) || processScheduledResume({ campaignId, fromEmail, fromName, replyTo: replyTo || fromEmail, emailFormat: emailFormat || "text" });

    return new Response(
      JSON.stringify({ success: true, message: "Scheduled resume started in background" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[scheduled-resume] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
