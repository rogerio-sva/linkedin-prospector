import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Base } from '@/components/BasesList';
import { LinkedInContact } from '@/types/contact';
import { ContactFiltersState } from '@/components/ContactFilters';

export interface PaginatedContactsResult {
  contacts: LinkedInContact[];
  totalCount: number;
}

const mapDbContactToLinkedInContact = (c: any): LinkedInContact => {
  const fullData = (c.full_data as Record<string, unknown>) || {};
  
  const mappedContact: LinkedInContact = {
    id: c.id,
    firstName: c.first_name || '',
    lastName: c.last_name || '',
    fullName: c.full_name || '',
    jobTitle: c.job_title || '',
    email: c.email || '',
    personalEmail: c.personal_email || '',
    mobileNumber: c.mobile_number || '',
    companyPhone: c.company_phone || '',
    linkedin: c.linkedin_url || '',
    companyName: c.company_name || '',
    companyWebsite: c.company_website || '',
    industry: c.industry || '',
    city: c.city || '',
    state: c.state || '',
    country: c.country || '',
    seniorityLevel: c.seniority_level || '',
    createdAt: new Date(c.created_at),
    ...(typeof fullData === 'object' ? fullData : {}),
  };
  
  mappedContact.id = c.id;
  mappedContact.linkedin = c.linkedin_url || '';
  mappedContact.createdAt = new Date(c.created_at);
  
  return mappedContact;
};

export function useBases() {
  const [bases, setBases] = useState<Base[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchBases = useCallback(async () => {
    try {
      const { data: basesData, error: basesError } = await supabase
        .from('bases')
        .select('*')
        .order('created_at', { ascending: false });

      if (basesError) throw basesError;

      const basesWithCounts = await Promise.all(
        (basesData || []).map(async (base) => {
          const { count } = await supabase
            .from('contacts')
            .select('*', { count: 'exact', head: true })
            .eq('base_id', base.id);
          
          return {
            ...base,
            contact_count: count || 0,
          };
        })
      );

      setBases(basesWithCounts);
    } catch (error) {
      console.error('Error fetching bases:', error);
      toast.error('Erro ao carregar bases');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBases();
  }, [fetchBases]);

  const createBase = async (name: string, description: string): Promise<Base | null> => {
    try {
      const { data, error } = await supabase
        .from('bases')
        .insert({ name, description: description || null })
        .select()
        .single();

      if (error) throw error;

      const newBase = { ...data, contact_count: 0 };
      setBases((prev) => [newBase, ...prev]);
      toast.success(`Base "${name}" criada com sucesso`);
      return newBase;
    } catch (error) {
      console.error('Error creating base:', error);
      toast.error('Erro ao criar base');
      return null;
    }
  };

  const deleteBase = async (baseId: string): Promise<void> => {
    try {
      const { error } = await supabase
        .from('bases')
        .delete()
        .eq('id', baseId);

      if (error) throw error;

      setBases((prev) => prev.filter((b) => b.id !== baseId));
      toast.success('Base excluída com sucesso');
    } catch (error) {
      console.error('Error deleting base:', error);
      toast.error('Erro ao excluir base');
    }
  };

  const addContactsToBase = async (
    baseId: string,
    contacts: LinkedInContact[]
  ): Promise<{ added: number; duplicates: number }> => {
    let added = 0;
    let duplicates = 0;

    try {
      for (const contact of contacts) {
        const contactData = {
          base_id: baseId,
          first_name: contact.firstName || null,
          last_name: contact.lastName || null,
          full_name: contact.fullName || null,
          job_title: contact.jobTitle || null,
          email: contact.email || null,
          personal_email: contact.personalEmail || null,
          mobile_number: contact.mobileNumber || null,
          company_phone: contact.companyPhone || null,
          linkedin_url: contact.linkedin || null,
          company_name: contact.companyName || null,
          company_website: contact.companyWebsite || null,
          industry: contact.industry || null,
          city: contact.city || null,
          state: contact.state || null,
          country: contact.country || null,
          seniority_level: contact.seniorityLevel || null,
          full_data: JSON.parse(JSON.stringify(contact)),
        };

        try {
          const { error } = await supabase
            .from('contacts')
            .insert([contactData]);

          if (error) {
            if (error.code === '23505') {
              duplicates++;
            } else {
              console.error('Error inserting contact:', error);
            }
          } else {
            added++;
          }
        } catch (err) {
          duplicates++;
        }
      }

      await fetchBases();

      return { added, duplicates };
    } catch (error) {
      console.error('Error adding contacts:', error);
      toast.error('Erro ao adicionar contatos');
      return { added: 0, duplicates: 0 };
    }
  };

  // New paginated function for server-side pagination
  const loadBaseContactsPage = async (
    baseId: string,
    page: number,
    pageSize: number,
    filters: ContactFiltersState,
    bouncedContactIds: string[] = []
  ): Promise<PaginatedContactsResult> => {
    try {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      // Build the query with filters applied server-side
      let query = supabase
        .from('contacts')
        .select('*', { count: 'exact' })
        .eq('base_id', baseId);

      // Apply text search filter
      if (filters.search) {
        const searchTerm = `%${filters.search}%`;
        query = query.or(
          `full_name.ilike.${searchTerm},first_name.ilike.${searchTerm},last_name.ilike.${searchTerm},email.ilike.${searchTerm},personal_email.ilike.${searchTerm},company_name.ilike.${searchTerm},job_title.ilike.${searchTerm}`
        );
      }

      // Apply exact match filters
      if (filters.jobTitle) {
        query = query.eq('job_title', filters.jobTitle);
      }
      if (filters.company) {
        query = query.eq('company_name', filters.company);
      }
      if (filters.industry) {
        query = query.eq('industry', filters.industry);
      }
      if (filters.city) {
        query = query.eq('city', filters.city);
      }

      // Apply has email filter
      if (filters.hasEmail === 'yes') {
        query = query.not('email', 'is', null).neq('email', '');
      } else if (filters.hasEmail === 'no') {
        query = query.or('email.is.null,email.eq.');
      }

      // Apply has phone filter
      if (filters.hasPhone === 'yes') {
        query = query.or('mobile_number.neq.,company_phone.neq.');
      } else if (filters.hasPhone === 'no') {
        query = query.or('mobile_number.is.null,mobile_number.eq.').or('company_phone.is.null,company_phone.eq.');
      }

      // Apply bounced filter (needs to be done client-side for now)
      if (filters.isBounced === 'yes' && bouncedContactIds.length > 0) {
        query = query.in('id', bouncedContactIds);
      } else if (filters.isBounced === 'no' && bouncedContactIds.length > 0) {
        query = query.not('id', 'in', `(${bouncedContactIds.join(',')})`);
      }

      // Apply ordering and pagination
      query = query.order('created_at', { ascending: false }).range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;

      return {
        contacts: (data || []).map(mapDbContactToLinkedInContact),
        totalCount: count || 0,
      };
    } catch (error) {
      console.error('Error loading contacts page:', error);
      toast.error('Erro ao carregar contatos');
      return { contacts: [], totalCount: 0 };
    }
  };

  // Get unique filter values for a base (for dropdown options)
  const getFilterOptions = async (baseId: string) => {
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('job_title, company_name, industry, city')
        .eq('base_id', baseId);

      if (error) throw error;

      const jobTitles = new Set<string>();
      const companies = new Set<string>();
      const industries = new Set<string>();
      const cities = new Set<string>();

      (data || []).forEach((c) => {
        if (c.job_title) jobTitles.add(c.job_title);
        if (c.company_name) companies.add(c.company_name);
        if (c.industry) industries.add(c.industry);
        if (c.city) cities.add(c.city);
      });

      return {
        jobTitles: Array.from(jobTitles).sort(),
        companies: Array.from(companies).sort(),
        industries: Array.from(industries).sort(),
        cities: Array.from(cities).sort(),
      };
    } catch (error) {
      console.error('Error fetching filter options:', error);
      return { jobTitles: [], companies: [], industries: [], cities: [] };
    }
  };

  // Keep the old function for backwards compatibility (used by SendCampaignDialog)
  const loadBaseContacts = async (baseId: string): Promise<LinkedInContact[]> => {
    try {
      const PAGE_SIZE = 1000;
      let allData: any[] = [];
      let page = 0;
      let hasMore = true;

      while (hasMore) {
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        const { data, error } = await supabase
          .from('contacts')
          .select('*')
          .eq('base_id', baseId)
          .order('created_at', { ascending: false })
          .range(from, to);

        if (error) throw error;

        if (data && data.length > 0) {
          allData = [...allData, ...data];
          page++;
          hasMore = data.length === PAGE_SIZE;
        } else {
          hasMore = false;
        }
      }

      return allData.map(mapDbContactToLinkedInContact);
    } catch (error) {
      console.error('Error loading contacts:', error);
      toast.error('Erro ao carregar contatos da base');
      return [];
    }
  };

  const deleteContacts = async (contactIds: string[]): Promise<number> => {
    if (contactIds.length === 0) return 0;

    try {
      // Delete from contact_tags first (foreign key)
      await supabase
        .from('contact_tags')
        .delete()
        .in('contact_id', contactIds);

      // Delete from contacts
      const { error } = await supabase
        .from('contacts')
        .delete()
        .in('id', contactIds);

      if (error) throw error;

      // Refresh bases to update counts
      await fetchBases();

      return contactIds.length;
    } catch (error) {
      console.error('Error deleting contacts:', error);
      toast.error('Erro ao excluir contatos');
      return 0;
    }
  };

  const getBouncedContactIds = async (baseId: string): Promise<string[]> => {
    try {
      // Get all bounced email sends for contacts in this base
      // Using bounced_at instead of status to catch all bounces
      const { data, error } = await supabase
        .from('email_sends')
        .select('contact_id, contacts!inner(base_id)')
        .eq('contacts.base_id', baseId)
        .not('bounced_at', 'is', null);

      if (error) throw error;

      // Return unique contact IDs
      const contactIds = [...new Set((data || []).map(d => d.contact_id))];
      return contactIds;
    } catch (error) {
      console.error('Error fetching bounced contacts:', error);
      return [];
    }
  };

  const updateContact = async (
    contactId: string,
    updates: {
      email?: string | null;
      personal_email?: string | null;
      mobile_number?: string | null;
      company_phone?: string | null;
    }
  ): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('contacts')
        .update(updates)
        .eq('id', contactId);

      if (error) throw error;

      toast.success('Contato atualizado com sucesso');
      return true;
    } catch (error) {
      console.error('Error updating contact:', error);
      toast.error('Erro ao atualizar contato');
      return false;
    }
  };

  return {
    bases,
    isLoading,
    createBase,
    deleteBase,
    addContactsToBase,
    loadBaseContacts,
    loadBaseContactsPage,
    getFilterOptions,
    deleteContacts,
    getBouncedContactIds,
    updateContact,
    refreshBases: fetchBases,
  };
}
