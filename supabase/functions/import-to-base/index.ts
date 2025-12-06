import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ApifyDatasetItem {
  first_name?: string;
  last_name?: string;
  full_name?: string;
  job_title?: string;
  headline?: string;
  functional_level?: string;
  seniority_level?: string;
  email?: string;
  mobile_number?: string;
  personal_email?: string;
  linkedin?: string;
  city?: string;
  state?: string;
  country?: string;
  company_name?: string;
  company_domain?: string;
  company_website?: string;
  company_linkedin?: string;
  company_linkedin_uid?: string;
  company_size?: string;
  industry?: string;
  company_description?: string;
  company_annual_revenue?: string;
  company_annual_revenue_clean?: number;
  company_total_funding?: string;
  company_total_funding_clean?: number;
  company_founded_year?: number;
  company_phone?: string;
  company_street_address?: string;
  company_city?: string;
  company_state?: string;
  company_country?: string;
  company_postal_code?: string;
  company_full_address?: string;
  company_market_cap?: string;
  keywords?: string[];
  company_technologies?: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const APIFY_API_TOKEN = Deno.env.get('APIFY_API_TOKEN');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!APIFY_API_TOKEN) throw new Error('APIFY_API_TOKEN is not configured');
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error('Supabase not configured');

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const { runIds, baseId, baseName } = await req.json();
    
    if (!runIds || !Array.isArray(runIds) || runIds.length === 0) {
      throw new Error('runIds array is required');
    }

    let targetBaseId = baseId;
    
    // Create base if name provided and no baseId
    if (!targetBaseId && baseName) {
      const { data: newBase, error: baseError } = await supabase
        .from('bases')
        .insert({ name: baseName })
        .select()
        .single();
      
      if (baseError) throw new Error(`Failed to create base: ${baseError.message}`);
      targetBaseId = newBase.id;
      console.log(`Created base: ${targetBaseId}`);
    }
    
    if (!targetBaseId) {
      throw new Error('baseId or baseName is required');
    }

    let totalAdded = 0;
    let totalDuplicates = 0;
    const errors: string[] = [];

    for (const runId of runIds) {
      try {
        console.log(`Processing run: ${runId}`);
        
        // Get run status and datasetId
        const statusUrl = `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_API_TOKEN}`;
        const statusResponse = await fetch(statusUrl);
        
        if (!statusResponse.ok) {
          errors.push(`Run ${runId}: Failed to fetch (${statusResponse.status})`);
          continue;
        }
        
        const statusData = await statusResponse.json();
        const datasetId = statusData.data?.defaultDatasetId;
        
        if (!datasetId) {
          errors.push(`Run ${runId}: No dataset found`);
          continue;
        }
        
        if (statusData.data?.status !== 'SUCCEEDED') {
          errors.push(`Run ${runId}: Status is ${statusData.data?.status}`);
          continue;
        }

        // Fetch dataset items
        console.log(`Fetching dataset: ${datasetId}`);
        const datasetUrl = `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_API_TOKEN}`;
        const datasetResponse = await fetch(datasetUrl);
        
        if (!datasetResponse.ok) {
          errors.push(`Dataset ${datasetId}: Failed to fetch`);
          continue;
        }

        const items: ApifyDatasetItem[] = await datasetResponse.json();
        console.log(`Got ${items.length} items from dataset ${datasetId}`);

        // Insert contacts
        for (const item of items) {
          const contactData = {
            base_id: targetBaseId,
            first_name: item.first_name || null,
            last_name: item.last_name || null,
            full_name: item.full_name || `${item.first_name || ''} ${item.last_name || ''}`.trim() || null,
            job_title: item.job_title || null,
            email: item.email || null,
            personal_email: item.personal_email || null,
            mobile_number: item.mobile_number || null,
            company_phone: item.company_phone || null,
            linkedin_url: item.linkedin || null,
            company_name: item.company_name || null,
            company_website: item.company_website || null,
            industry: item.industry || null,
            city: item.city || null,
            state: item.state || null,
            country: item.country || null,
            seniority_level: item.seniority_level || null,
            full_data: JSON.parse(JSON.stringify(item)),
          };

          const { error: insertError } = await supabase
            .from('contacts')
            .insert([contactData]);

          if (insertError) {
            if (insertError.code === '23505') {
              totalDuplicates++;
            } else {
              console.error('Insert error:', insertError);
            }
          } else {
            totalAdded++;
          }
        }
        
        console.log(`Run ${runId}: Added ${items.length} contacts`);
      } catch (runError) {
        const msg = runError instanceof Error ? runError.message : 'Unknown error';
        errors.push(`Run ${runId}: ${msg}`);
        console.error(`Error processing run ${runId}:`, runError);
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      baseId: targetBaseId,
      totalAdded,
      totalDuplicates,
      errors: errors.length > 0 ? errors : undefined,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
