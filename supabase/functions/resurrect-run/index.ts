import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const APIFY_API_TOKEN = Deno.env.get('APIFY_API_TOKEN');
    if (!APIFY_API_TOKEN) {
      throw new Error('APIFY_API_TOKEN is not configured');
    }

    const { runId, timeoutSecs = 3600, memoryMbytes } = await req.json();
    
    if (!runId) {
      throw new Error('runId is required');
    }

    console.log(`Resurrecting run ${runId} with timeout ${timeoutSecs}s`);

    // Build query params for resurrect
    const params = new URLSearchParams({
      token: APIFY_API_TOKEN,
      timeout: timeoutSecs.toString(),
    });
    
    if (memoryMbytes) {
      params.append('memory', memoryMbytes.toString());
    }

    // Call Apify resurrect endpoint
    const resurrectUrl = `https://api.apify.com/v2/actor-runs/${runId}/resurrect?${params.toString()}`;
    
    const response = await fetch(resurrectUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to resurrect run:', errorText);
      throw new Error(`Failed to resurrect run: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const runData = data.data;
    
    console.log(`Run ${runId} resurrected successfully. New status: ${runData?.status}`);

    return new Response(JSON.stringify({
      success: true,
      status: runData?.status || 'RUNNING',
      runId: runData?.id || runId,
      datasetId: runData?.defaultDatasetId,
      message: 'Busca retomada com sucesso! Continuando de onde parou.',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error resurrecting run:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ 
      success: false,
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
