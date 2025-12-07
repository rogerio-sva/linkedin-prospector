import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Map of common location aliases to Apify-accepted values
const locationAliases: Record<string, string> = {
  'brasil': 'brazil',
  'brazil': 'brazil',
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
  // Brazilian states - must use exact Apify format
  'rio de janeiro': 'state of rio de janeiro, brazil',
  'rj': 'state of rio de janeiro, brazil',
  'são paulo': 'state of são paulo, brazil',
  'sp': 'state of são paulo, brazil',
  'minas gerais': 'minas gerais, brazil',
  'mg': 'minas gerais, brazil',
  'bahia': 'bahia, brazil',
  'ba': 'bahia, brazil',
  'paraná': 'paraná, brazil',
  'pr': 'paraná, brazil',
  'rio grande do sul': 'state of rio grande do sul, brazil',
  'rs': 'state of rio grande do sul, brazil',
  'santa catarina': 'santa catarina, brazil',
  'sc': 'santa catarina, brazil',
  'pernambuco': 'pernambuco, brazil',
  'pe': 'pernambuco, brazil',
  'ceará': 'ceará, brazil',
  'ce': 'ceará, brazil',
  'goiás': 'goiás, brazil',
  'go': 'goiás, brazil',
  'distrito federal': 'federal district, brazil',
  'df': 'federal district, brazil',
  'brasília': 'federal district, brazil',
};

// Map Portuguese seniority levels to Apify-accepted values
const seniorityAliases: Record<string, string> = {
  'fundador': 'Founder',
  'proprietário': 'Owner',
  'c-level': 'C-Level',
  'diretor': 'Director',
  'vp': 'VP',
  'head': 'Head',
  'gerente': 'Manager',
  'sênior': 'Senior',
  'júnior': 'Entry',
  'estagiário': 'Trainee',
};

// Map Portuguese functional levels to Apify-accepted values
const functionalAliases: Record<string, string> = {
  'finanças': 'Finance',
  'produto': 'Product',
  'engenharia': 'Engineering',
  'design': 'Design',
  'rh': 'HR',
  'ti': 'IT',
  'jurídico': 'Legal',
  'marketing': 'Marketing',
  'operações': 'Operations',
  'vendas': 'Sales',
  'suporte': 'Support',
  'c-level': 'C-Level',
};

// Map Portuguese funding options to Apify-accepted values
const fundingAliases: Record<string, string> = {
  'seed': 'Seed',
  'anjo': 'Angel',
  'série a': 'Series A',
  'série b': 'Series B',
  'série c': 'Series C',
  'série d': 'Series D',
  'série e': 'Series E',
  'série f': 'Series F',
  'venture': 'Venture',
  'dívida': 'Debt',
  'conversível': 'Convertible',
  'private equity': 'PE',
  'outro': 'Other',
};

function normalizeLocation(location: string): string {
  const normalized = location.toLowerCase().trim();
  return locationAliases[normalized] || normalized;
}

function normalizeSeniority(value: string): string {
  const normalized = value.toLowerCase().trim();
  return seniorityAliases[normalized] || value;
}

function normalizeFunctional(value: string): string {
  const normalized = value.toLowerCase().trim();
  return functionalAliases[normalized] || value;
}

function normalizeFunding(value: string): string {
  const normalized = value.toLowerCase().trim();
  return fundingAliases[normalized] || value;
}

serve(async (req) => {
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
    if (filters.seniorityLevel?.length) {
      apifyInput.seniority_level = filters.seniorityLevel.map((s: string) => normalizeSeniority(s));
    }
    if (filters.functionalLevel?.length) {
      apifyInput.functional_level = filters.functionalLevel.map((f: string) => normalizeFunctional(f));
    }
    
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
    if (filters.funding?.length) {
      apifyInput.funding = filters.funding.map((f: string) => normalizeFunding(f));
    }
    
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

    const runData = await runResponse.json();
    const runId = runData.data.id;
    const datasetId = runData.data.defaultDatasetId;
    const status = runData.data.status;
    
    console.log(`Actor run started. Run ID: ${runId}, Dataset ID: ${datasetId}, Status: ${status}`);

    // Return immediately with the run info - frontend will poll for status
    return new Response(JSON.stringify({ 
      success: true,
      runId,
      datasetId,
      status,
      message: 'Busca iniciada! Acompanhe o progresso abaixo.',
      fetchCount: apifyInput.fetch_count,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in search-leads function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
