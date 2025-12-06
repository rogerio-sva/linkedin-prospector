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
  'Founder',
  'Owner',
  'C-Level',
  'Director',
  'VP',
  'Head',
  'Manager',
  'Senior',
  'Entry',
  'Trainee',
] as const;

export const FUNCTIONAL_LEVELS = [
  'C-Level',
  'Finance',
  'Product',
  'Engineering',
  'Design',
  'HR',
  'IT',
  'Legal',
  'Marketing',
  'Operations',
  'Sales',
  'Support',
] as const;

export const COMPANY_SIZES = [
  '0-1',
  '2-10',
  '11-20',
  '21-50',
  '51-100',
  '101-200',
  '201-500',
  '501-1000',
  '1001-2000',
  '2001-5000',
  '10000+',
] as const;

export const REVENUE_OPTIONS = [
  { value: '100K', label: '$100K' },
  { value: '500K', label: '$500K' },
  { value: '1M', label: '$1M' },
  { value: '5M', label: '$5M' },
  { value: '10M', label: '$10M' },
  { value: '50M', label: '$50M' },
  { value: '100M', label: '$100M' },
  { value: '500M', label: '$500M' },
  { value: '1B', label: '$1B' },
  { value: '10B', label: '$10B' },
] as const;

export const FUNDING_OPTIONS = [
  'Seed',
  'Angel',
  'Series A',
  'Series B',
  'Series C',
  'Series D',
  'Series E',
  'Series F',
  'Venture',
  'Debt',
  'Convertible',
  'PE',
  'Other',
] as const;

export const EMAIL_STATUS_OPTIONS = [
  { value: 'validated', label: 'Validado' },
  { value: 'not_validated', label: 'Não validado' },
  { value: 'unknown', label: 'Desconhecido' },
] as const;
