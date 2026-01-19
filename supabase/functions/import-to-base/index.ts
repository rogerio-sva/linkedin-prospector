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
    
    const { runIds, baseId, baseName, skipExisting } = await req.json();
    
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

    // Get existing emails/linkedin URLs to skip duplicates if requested
    let existingEmails = new Set<string>();
    let existingLinkedins = new Set<string>();
    
    if (skipExisting) {
      // Paginate through ALL existing contacts (Supabase default limit is 1000)
      const PAGE_SIZE = 1000;
      let page = 0;
      let hasMore = true;
      
      while (hasMore) {
        const { data: existingContacts, error: fetchError } = await supabase
          .from('contacts')
          .select('email, linkedin_url')
          .eq('base_id', targetBaseId)
          .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
        
        if (fetchError) {
          console.error('Error fetching existing contacts:', fetchError);
          break;
        }
        
        if (existingContacts && existingContacts.length > 0) {
          existingContacts.forEach(c => {
            if (c.email) existingEmails.add(c.email.toLowerCase());
            if (c.linkedin_url) existingLinkedins.add(c.linkedin_url.toLowerCase());
          });
          console.log(`Fetched page ${page + 1}: ${existingContacts.length} existing contacts`);
          page++;
          hasMore = existingContacts.length === PAGE_SIZE;
        } else {
          hasMore = false;
        }
      }
      console.log(`Found ${existingEmails.size} existing emails, ${existingLinkedins.size} existing linkedins total`);
    }

    let totalAdded = 0;
    let totalDuplicates = 0;
    const errors: string[] = [];
    const BATCH_SIZE = 500;

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
        
        const runStatus = statusData.data?.status;
        // Allow SUCCEEDED, FAILED, or TIMED-OUT runs - they may still have data in the dataset
        if (!['SUCCEEDED', 'FAILED', 'TIMED-OUT'].includes(runStatus)) {
          errors.push(`Run ${runId}: Status is ${runStatus} - waiting for completion`);
          continue;
        }
        console.log(`Run ${runId} has status ${runStatus}, attempting to fetch dataset data...`);

        // Fetch ALL dataset items (Apify defaults to 1000, we need all)
        console.log(`Fetching dataset: ${datasetId}`);
        const allItems: ApifyDatasetItem[] = [];
        let offset = 0;
        const fetchLimit = 1000; // Apify max per request
        
        while (true) {
          const datasetUrl = `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_API_TOKEN}&limit=${fetchLimit}&offset=${offset}`;
          const datasetResponse = await fetch(datasetUrl);
          
          if (!datasetResponse.ok) {
            errors.push(`Dataset ${datasetId}: Failed to fetch at offset ${offset}`);
            break;
          }

          const batch: ApifyDatasetItem[] = await datasetResponse.json();
          console.log(`Fetched ${batch.length} items at offset ${offset}`);
          
          if (batch.length === 0) break;
          
          allItems.push(...batch);
          offset += fetchLimit;
          
          // Safety: if we got less than limit, we're done
          if (batch.length < fetchLimit) break;
        }

        const items = allItems;
        console.log(`Got ${items.length} total items from dataset ${datasetId}`);

        // Prepare contacts for batch insert
        const contactsToInsert = [];
        
        for (const item of items) {
          // Skip duplicates if skipExisting is true
          if (skipExisting) {
            const email = item.email?.toLowerCase();
            const linkedin = item.linkedin?.toLowerCase();
            
            if ((email && existingEmails.has(email)) || (linkedin && existingLinkedins.has(linkedin))) {
              totalDuplicates++;
              continue;
            }
            
            // Add to tracking sets
            if (email) existingEmails.add(email);
            if (linkedin) existingLinkedins.add(linkedin);
          }
          
          contactsToInsert.push({
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
          });
        }

        // Batch insert
        console.log(`Inserting ${contactsToInsert.length} contacts in batches of ${BATCH_SIZE}`);
        
        for (let i = 0; i < contactsToInsert.length; i += BATCH_SIZE) {
          const batch = contactsToInsert.slice(i, i + BATCH_SIZE);
          
          const { error: insertError, data: insertedData } = await supabase
            .from('contacts')
            .insert(batch)
            .select('id');

          if (insertError) {
            console.error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} error:`, insertError);
            // Try inserting one by one for this batch to identify problem rows
            for (const contact of batch) {
              const { error: singleError } = await supabase
                .from('contacts')
                .insert([contact]);
              
              if (singleError) {
                if (singleError.code === '23505') {
                  totalDuplicates++;
                }
              } else {
                totalAdded++;
              }
            }
          } else {
            totalAdded += insertedData?.length || batch.length;
          }
          
          console.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: inserted ${batch.length} contacts (total: ${totalAdded})`);
        }
        
        console.log(`Run ${runId}: Added ${totalAdded} contacts, ${totalDuplicates} duplicates`);
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
