import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to update search run status in database
const updateSearchRunStatus = async (runId: string, status: string, outputCount?: number, errorMessage?: string) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseClient = createClient(supabaseUrl, supabaseKey);
    
    const updateData: Record<string, unknown> = { status };
    if (outputCount !== undefined) {
      updateData.output_count = outputCount;
    }
    if (errorMessage) {
      updateData.error_message = errorMessage;
    }
    
    const { error } = await supabaseClient
      .from('search_runs')
      .update(updateData)
      .eq('run_id', runId);
    
    if (error) {
      console.error('Failed to update search run status:', error);
    } else {
      console.log(`Updated search run ${runId} status to ${status}`);
    }
  } catch (err) {
    console.error('Database error updating search run:', err);
  }
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
    if (!APIFY_API_TOKEN) {
      throw new Error('APIFY_API_TOKEN is not configured');
    }

    const { datasetId: providedDatasetId, runId: providedRunId, checkStatusOnly } = await req.json();
    
    let datasetId = providedDatasetId;
    let runId = providedRunId;
    
    // If datasetId was provided but looks like it might be a runId, try to detect
    // Run IDs and Dataset IDs are both alphanumeric but we can check by trying to fetch as run first
    if (datasetId && !runId) {
      // Try to fetch as a run first to see if it's a runId
      const testRunUrl = `https://api.apify.com/v2/actor-runs/${datasetId}?token=${APIFY_API_TOKEN}`;
      try {
        const testResponse = await fetch(testRunUrl);
        if (testResponse.ok) {
          const testData = await testResponse.json();
          if (testData.data?.defaultDatasetId) {
            console.log(`Detected ${datasetId} as a runId, converting to datasetId`);
            runId = datasetId;
            datasetId = testData.data.defaultDatasetId;
          }
        }
      } catch (e) {
        // Ignore, treat as datasetId
        console.log(`Treating ${datasetId} as datasetId (not a runId)`);
      }
    }
    
    // Check run status and get datasetId if only runId provided
    if (runId) {
      const statusUrl = `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_API_TOKEN}`;
      const statusResponse = await fetch(statusUrl);
      
      if (!statusResponse.ok) {
        throw new Error(`Failed to fetch run status: ${statusResponse.status}`);
      }
      
      const statusData = await statusResponse.json();
      const runStatus = statusData.data?.status;
      const stats = statusData.data?.stats || {};
      
      // Get datasetId from run if not provided
      if (!datasetId && statusData.data?.defaultDatasetId) {
        datasetId = statusData.data.defaultDatasetId;
        console.log(`Got datasetId from run: ${datasetId}`);
      }
      
      console.log(`Run ${runId} status: ${runStatus}`);
      
      // If only checking status, still update DB for terminal states before returning
      if (checkStatusOnly) {
        const isTerminal = ['SUCCEEDED', 'FAILED', 'ABORTED', 'TIMED-OUT'].includes(runStatus);
        if (isTerminal) {
          const isFailed = runStatus === 'FAILED' || runStatus === 'ABORTED';
          await updateSearchRunStatus(
            runId,
            runStatus,
            stats.outputRecordCount || 0,
            isFailed ? 'Busca falhou ou foi abortada' : undefined
          );
        }
        
        return new Response(JSON.stringify({ 
          status: runStatus,
          datasetId,
          stats: {
            inputRecordCount: stats.inputRecordCount || 0,
            outputRecordCount: stats.outputRecordCount || 0,
            durationMs: stats.runTimeSecs ? stats.runTimeSecs * 1000 : 0,
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      if (runStatus === 'RUNNING' || runStatus === 'READY') {
        return new Response(JSON.stringify({ 
          status: runStatus,
          message: 'A busca ainda está em andamento.',
          datasetId,
          stats: {
            inputRecordCount: stats.inputRecordCount || 0,
            outputRecordCount: stats.outputRecordCount || 0,
            durationMs: stats.runTimeSecs ? stats.runTimeSecs * 1000 : 0,
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      if (runStatus !== 'SUCCEEDED') {
        const isTimedOut = runStatus === 'TIMED-OUT';
        const isFailed = runStatus === 'FAILED' || runStatus === 'ABORTED';
        
        // Update status in database for terminal states
        if (isTimedOut || isFailed) {
          await updateSearchRunStatus(
            runId, 
            runStatus, 
            stats.outputRecordCount || 0,
            isFailed ? 'Busca falhou ou foi abortada' : undefined
          );
        }
        
        return new Response(JSON.stringify({ 
          status: runStatus,
          datasetId,
          message: isTimedOut 
            ? 'A busca expirou. Você pode retomar de onde parou.' 
            : `A busca terminou com status: ${runStatus}`,
          error: isFailed ? 'Busca falhou ou foi abortada' : undefined,
          canResurrect: isTimedOut,
          stats: {
            inputRecordCount: stats.inputRecordCount || 0,
            outputRecordCount: stats.outputRecordCount || 0,
            durationMs: stats.runTimeSecs ? stats.runTimeSecs * 1000 : 0,
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (!datasetId) {
      throw new Error('datasetId or runId is required');
    }

    console.log(`Fetching dataset: ${datasetId}`);
    const datasetUrl = `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_API_TOKEN}`;
    const datasetResponse = await fetch(datasetUrl);
    
    if (!datasetResponse.ok) {
      const errorText = await datasetResponse.text();
      console.error('Failed to fetch dataset:', errorText);
      throw new Error(`Failed to fetch dataset: ${errorText}`);
    }

    const items: ApifyDatasetItem[] = await datasetResponse.json();
    console.log(`Fetched ${items.length} items from dataset`);

    const contacts = items.map((item, index) => ({
      id: `lead-${Date.now()}-${index}`,
      firstName: item.first_name || '',
      lastName: item.last_name || '',
      fullName: item.full_name || `${item.first_name || ''} ${item.last_name || ''}`.trim(),
      jobTitle: item.job_title || '',
      headline: item.headline,
      seniorityLevel: item.seniority_level,
      functionalLevel: item.functional_level,
      email: item.email,
      personalEmail: item.personal_email,
      mobileNumber: item.mobile_number,
      linkedin: item.linkedin || '',
      city: item.city,
      state: item.state,
      country: item.country,
      companyName: item.company_name,
      companyDomain: item.company_domain,
      companyWebsite: item.company_website,
      companyLinkedIn: item.company_linkedin,
      companyLinkedInUid: item.company_linkedin_uid,
      companySize: item.company_size,
      industry: item.industry,
      companyDescription: item.company_description,
      companyAnnualRevenue: item.company_annual_revenue,
      companyAnnualRevenueClean: item.company_annual_revenue_clean,
      companyTotalFunding: item.company_total_funding,
      companyTotalFundingClean: item.company_total_funding_clean,
      companyFoundedYear: item.company_founded_year,
      companyPhone: item.company_phone,
      companyStreetAddress: item.company_street_address,
      companyCity: item.company_city,
      companyState: item.company_state,
      companyCountry: item.company_country,
      companyPostalCode: item.company_postal_code,
      companyFullAddress: item.company_full_address,
      companyMarketCap: item.company_market_cap,
      keywords: item.keywords,
      companyTechnologies: item.company_technologies,
      createdAt: new Date().toISOString(),
    }));

    // Update status to SUCCEEDED in database
    if (runId) {
      await updateSearchRunStatus(runId, 'SUCCEEDED', contacts.length);
    }

    return new Response(JSON.stringify({ 
      status: 'SUCCEEDED',
      contacts, 
      count: contacts.length 
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
