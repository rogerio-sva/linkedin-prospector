export interface LinkedInContact {
  id: string;
  fullName: string;
  firstName: string;
  lastName: string;
  headline: string;
  profileUrl: string;
  email?: string;
  phone?: string;
  company?: string;
  position?: string;
  location?: string;
  connectionDegree?: string;
  profileImage?: string;
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
  keywords?: string;
  location?: string;
  company?: string;
  title?: string;
  industry?: string;
  connectionDegree?: string;
  limit?: number;
}
