import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ApifyRunResponse {
  data: {
    id: string;
    status: string;
    defaultDatasetId: string;
  };
}

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

// Map of common location aliases to Apify-accepted values
const locationAliases: Record<string, string> = {
  'brasil': 'brazil',
  'estados unidos': 'united states',
  'eua': 'united states',
  'usa': 'united states',
  'uk': 'united kingdom',
  'reino unido': 'united kingdom',
  'alemania': 'germany',
  'alemanha': 'germany',
  'frança': 'france',
  'espanha': 'spain',
  'itália': 'italy',
  'japão': 'japan',
  'china': 'china',
  'índia': 'india',
  'rússia': 'russia',
  'canadá': 'canada',
  'méxico': 'mexico',
  'argentina': 'argentina',
  'portugal': 'portugal',
  'holanda': 'netherlands',
  'países baixos': 'netherlands',
  'suíça': 'switzerland',
  'áustria': 'austria',
  'bélgica': 'belgium',
  'suécia': 'sweden',
  'noruega': 'norway',
  'dinamarca': 'denmark',
  'finlândia': 'finland',
  'polônia': 'poland',
  'irlanda': 'ireland',
  'austrália': 'australia',
  'nova zelândia': 'new zealand',
  'coreia do sul': 'south korea',
  'emirados árabes': 'united arab emirates',
  'arábia saudita': 'saudi arabia',
};

// Normalize location values to Apify-accepted format
function normalizeLocation(location: string): string {
  const normalized = location.toLowerCase().trim();
  return locationAliases[normalized] || normalized;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const APIFY_API_TOKEN = Deno.env.get('APIFY_API_TOKEN');
    if (!APIFY_API_TOKEN) {
      console.error('APIFY_API_TOKEN not configured');
      throw new Error('APIFY_API_TOKEN is not configured');
    }

    const filters = await req.json();
    console.log('Received search filters:', JSON.stringify(filters));

    // Build Apify input from filters
    const apifyInput: Record<string, unknown> = {};
    
    // People targeting
    if (filters.contactJobTitle?.length) apifyInput.contact_job_title = filters.contactJobTitle;
    if (filters.contactNotJobTitle?.length) apifyInput.contact_not_job_title = filters.contactNotJobTitle;
    if (filters.seniorityLevel?.length) apifyInput.seniority_level = filters.seniorityLevel;
    if (filters.functionalLevel?.length) apifyInput.functional_level = filters.functionalLevel;
    
    // Location Include - normalize values
    if (filters.contactLocation?.length) {
      apifyInput.contact_location = filters.contactLocation.map((loc: string) => normalizeLocation(loc));
    }
    if (filters.contactCity?.length) apifyInput.contact_city = filters.contactCity;
    
    // Location Exclude
    if (filters.contactNotLocation?.length) apifyInput.contact_not_location = filters.contactNotLocation;
    if (filters.contactNotCity?.length) apifyInput.contact_not_city = filters.contactNotCity;
    
    // Email quality
    if (filters.emailStatus?.length) apifyInput.email_status = filters.emailStatus;
    
    // Company targeting
    if (filters.companyDomain?.length) apifyInput.company_domain = filters.companyDomain;
    if (filters.size?.length) apifyInput.size = filters.size;
    if (filters.companyIndustry?.length) apifyInput.company_industry = filters.companyIndustry;
    if (filters.companyNotIndustry?.length) apifyInput.company_not_industry = filters.companyNotIndustry;
    if (filters.companyKeywords?.length) apifyInput.company_keywords = filters.companyKeywords;
    if (filters.companyNotKeywords?.length) apifyInput.company_not_keywords = filters.companyNotKeywords;
    if (filters.minRevenue) apifyInput.min_revenue = filters.minRevenue;
    if (filters.maxRevenue) apifyInput.max_revenue = filters.maxRevenue;
    if (filters.funding?.length) apifyInput.funding = filters.funding;
    
    // General
    apifyInput.fetch_count = filters.fetchCount || 1000;
    if (filters.fileName) apifyInput.file_name = filters.fileName;

    console.log('Apify input:', JSON.stringify(apifyInput));

    // Start actor run using the unique actor ID
    const actorId = 'IoSHqwTR9YGhzccez';
    const runUrl = `https://api.apify.com/v2/acts/${actorId}/runs?token=${APIFY_API_TOKEN}`;
    
    console.log('Starting Apify actor run...');
    const runResponse = await fetch(runUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(apifyInput),
    });

    if (!runResponse.ok) {
      const errorText = await runResponse.text();
      console.error('Failed to start actor run:', errorText);
      throw new Error(`Failed to start actor run: ${errorText}`);
    }

    const runData: ApifyRunResponse = await runResponse.json();
    const runId = runData.data.id;
    const datasetId = runData.data.defaultDatasetId;
    console.log(`Actor run started. Run ID: ${runId}, Dataset ID: ${datasetId}`);

    // Poll for completion
    const statusUrl = `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_API_TOKEN}`;
    let status = runData.data.status;
    let attempts = 0;
    const maxAttempts = 120; // 10 minutes max

    while (status !== 'SUCCEEDED' && status !== 'FAILED' && status !== 'ABORTED' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      attempts++;
      
      const statusResponse = await fetch(statusUrl);
      const statusData = await statusResponse.json();
      status = statusData.data.status;
      console.log(`Polling attempt ${attempts}: Status = ${status}`);
    }

    if (status !== 'SUCCEEDED') {
      console.error(`Actor run did not succeed. Final status: ${status}`);
      throw new Error(`Actor run failed with status: ${status}`);
    }

    // Fetch dataset items
    console.log('Fetching dataset items...');
    const datasetUrl = `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_API_TOKEN}`;
    const datasetResponse = await fetch(datasetUrl);
    
    if (!datasetResponse.ok) {
      const errorText = await datasetResponse.text();
      console.error('Failed to fetch dataset:', errorText);
      throw new Error(`Failed to fetch dataset: ${errorText}`);
    }

    const items: ApifyDatasetItem[] = await datasetResponse.json();
    console.log(`Fetched ${items.length} items from dataset`);
    
    // Log the first item to see the actual structure
    if (items.length > 0) {
      console.log('Sample item structure:', JSON.stringify(items[0]));
    }

    // Transform to our format
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

    console.log(`Returning ${contacts.length} transformed contacts`);

    return new Response(JSON.stringify({ contacts, count: contacts.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in search-leads function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
