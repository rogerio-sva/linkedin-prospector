export interface LinkedInContact {
  id: string;
  // Personal Data
  firstName: string;
  lastName: string;
  fullName: string;
  jobTitle: string;
  headline?: string;
  seniorityLevel?: string;
  functionalLevel?: string;
  // Contact
  email?: string;
  personalEmail?: string;
  mobileNumber?: string;
  linkedin: string;
  // Person Location
  city?: string;
  state?: string;
  country?: string;
  // Company
  companyName?: string;
  companyDomain?: string;
  companyWebsite?: string;
  companyLinkedIn?: string;
  companyLinkedInUid?: string;
  companySize?: string;
  industry?: string;
  companyDescription?: string;
  companyAnnualRevenue?: string;
  companyAnnualRevenueClean?: number;
  companyTotalFunding?: string;
  companyTotalFundingClean?: number;
  companyFoundedYear?: number;
  companyPhone?: string;
  // Company Address
  companyStreetAddress?: string;
  companyCity?: string;
  companyState?: string;
  companyCountry?: string;
  companyPostalCode?: string;
  companyFullAddress?: string;
  companyMarketCap?: string;
  // Other
  keywords?: string[];
  companyTechnologies?: string[];
  createdAt: Date;
}

export interface SearchQuery {
  id: string;
  query: string;
  filters: SearchFilters;
  resultsCount: number;
  createdAt: Date;
  contacts: LinkedInContact[];
}

export interface SearchFilters {
  // People targeting
  contactJobTitle?: string[];
  contactNotJobTitle?: string[];
  seniorityLevel?: string[];
  functionalLevel?: string[];
  // Location (Include)
  contactLocation?: string[];
  contactCity?: string[];
  // Location (Exclude)
  contactNotLocation?: string[];
  contactNotCity?: string[];
  // Email quality
  emailStatus?: string[];
  // Company targeting
  companyDomain?: string[];
  size?: string[];
  companyIndustry?: string[];
  companyNotIndustry?: string[];
  companyKeywords?: string[];
  companyNotKeywords?: string[];
  minRevenue?: string;
  maxRevenue?: string;
  funding?: string[];
  // General
  fetchCount?: number;
  fileName?: string;
}

export const SENIORITY_LEVELS = [
  'Fundador',
  'Proprietário',
  'C-Level',
  'Diretor',
  'VP',
  'Head',
  'Gerente',
  'Sênior',
  'Júnior',
  'Estagiário',
] as const;

export const FUNCTIONAL_LEVELS = [
  'C-Level',
  'Finanças',
  'Produto',
  'Engenharia',
  'Design',
  'RH',
  'TI',
  'Jurídico',
  'Marketing',
  'Operações',
  'Vendas',
  'Suporte',
] as const;

export const COMPANY_SIZES = [
  '1-10',
  '11-20',
  '21-50',
  '51-100',
  '101-200',
  '201-500',
  '501-1000',
  '1001-2000',
  '2001-5000',
  '5001-10000',
  '10001-20000',
  '20001-50000',
  '50000+',
] as const;

export const REVENUE_OPTIONS = [
  { value: '100K', label: 'R$ 500 mil' },
  { value: '500K', label: 'R$ 2,5 milhões' },
  { value: '1M', label: 'R$ 5 milhões' },
  { value: '5M', label: 'R$ 25 milhões' },
  { value: '10M', label: 'R$ 50 milhões' },
  { value: '50M', label: 'R$ 250 milhões' },
  { value: '100M', label: 'R$ 500 milhões' },
  { value: '500M', label: 'R$ 2,5 bilhões' },
  { value: '1B', label: 'R$ 5 bilhões' },
  { value: '10B', label: 'R$ 50 bilhões' },
] as const;

export const FUNDING_OPTIONS = [
  'Seed',
  'Anjo',
  'Série A',
  'Série B',
  'Série C',
  'Série D',
  'Série E',
  'Série F',
  'Venture',
  'Dívida',
  'Conversível',
  'Private Equity',
  'Outro',
] as const;

export const EMAIL_STATUS_OPTIONS = [
  { value: 'validated', label: 'Validado' },
  { value: 'not_validated', label: 'Não validado' },
  { value: 'unknown', label: 'Desconhecido' },
] as const;
