import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Base } from '@/components/BasesList';
import { LinkedInContact } from '@/types/contact';

export function useBases() {
  const [bases, setBases] = useState<Base[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchBases = useCallback(async () => {
    try {
      // Fetch bases with contact count
      const { data: basesData, error: basesError } = await supabase
        .from('bases')
        .select('*')
        .order('created_at', { ascending: false });

      if (basesError) throw basesError;

      // Get contact counts for each base
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
      // Insert contacts one by one to handle duplicates gracefully
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
            // Check if it's a duplicate error
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

      // Refresh bases to update counts
      await fetchBases();

      return { added, duplicates };
    } catch (error) {
      console.error('Error adding contacts:', error);
      toast.error('Erro ao adicionar contatos');
      return { added: 0, duplicates: 0 };
    }
  };

  const loadBaseContacts = async (baseId: string): Promise<LinkedInContact[]> => {
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('base_id', baseId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Map database contacts to LinkedInContact format
      return (data || []).map((c) => {
        // Use full_data if available for complete contact info
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
          // Spread any additional fields from full_data (like headline, companySize, etc.)
          ...(typeof fullData === 'object' ? fullData : {}),
        };
        
        // Ensure our mapped values take precedence over full_data
        mappedContact.id = c.id;
        mappedContact.linkedin = c.linkedin_url || '';
        mappedContact.createdAt = new Date(c.created_at);
        
        return mappedContact;
      });
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
      const { data, error } = await supabase
        .from('email_sends')
        .select('contact_id, contacts!inner(base_id)')
        .eq('contacts.base_id', baseId)
        .eq('status', 'bounced');

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
    deleteContacts,
    getBouncedContactIds,
    updateContact,
    refreshBases: fetchBases,
  };
}
