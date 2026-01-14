import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface CRMStage {
  id: string;
  name: string;
  color: string;
  position: number;
  created_at: string;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string | null;
  is_active: boolean;
  created_at: string;
}

export interface ContactActivity {
  id: string;
  contact_id: string;
  activity_type: string;
  description: string | null;
  performed_by: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface CRMContact {
  id: string;
  base_id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  personal_email: string | null;
  linkedin_url: string | null;
  job_title: string | null;
  company_name: string | null;
  company_website: string | null;
  industry: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  mobile_number: string | null;
  company_phone: string | null;
  seniority_level: string | null;
  crm_stage: string | null;
  assigned_to: string | null;
  linkedin_contacted_at: string | null;
  last_activity_at: string | null;
  notes: string | null;
  created_at: string;
}

export function useCRMStages() {
  return useQuery({
    queryKey: ["crm-stages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_stages")
        .select("*")
        .order("position");
      
      if (error) throw error;
      return data as CRMStage[];
    },
  });
}

export function useTeamMembers() {
  return useQuery({
    queryKey: ["team-members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_members")
        .select("*")
        .eq("is_active", true)
        .order("name");
      
      if (error) throw error;
      return data as TeamMember[];
    },
  });
}

export function useContactActivities(contactId: string | null) {
  return useQuery({
    queryKey: ["contact-activities", contactId],
    queryFn: async () => {
      if (!contactId) return [];
      
      const { data, error } = await supabase
        .from("contact_activities")
        .select("*")
        .eq("contact_id", contactId)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as ContactActivity[];
    },
    enabled: !!contactId,
  });
}

export function useCRMContacts(baseId: string | null, stage?: string, assignedTo?: string) {
  return useQuery({
    queryKey: ["crm-contacts", baseId, stage, assignedTo],
    queryFn: async () => {
      if (!baseId) return [];
      
      let query = supabase
        .from("contacts")
        .select("*")
        .eq("base_id", baseId)
        .order("last_activity_at", { ascending: false, nullsFirst: false });
      
      if (stage) {
        query = query.eq("crm_stage", stage);
      }
      
      if (assignedTo) {
        query = query.eq("assigned_to", assignedTo);
      }
      
      const { data, error } = await query.limit(500);
      
      if (error) throw error;
      return data as CRMContact[];
    },
    enabled: !!baseId,
  });
}

export function useUpdateContactStage() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ contactId, stage, performedBy }: { contactId: string; stage: string; performedBy?: string }) => {
      // Update contact stage
      const { error: updateError } = await supabase
        .from("contacts")
        .update({ 
          crm_stage: stage,
          last_activity_at: new Date().toISOString()
        })
        .eq("id", contactId);
      
      if (updateError) throw updateError;
      
      // Log activity
      const { error: activityError } = await supabase
        .from("contact_activities")
        .insert({
          contact_id: contactId,
          activity_type: "stage_change",
          description: `Movido para estágio: ${stage}`,
          performed_by: performedBy || null,
        });
      
      if (activityError) throw activityError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-contacts"] });
      queryClient.invalidateQueries({ queryKey: ["contact-activities"] });
    },
    onError: (error) => {
      toast.error("Erro ao atualizar estágio: " + error.message);
    },
  });
}

export function useMarkLinkedInContacted() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ contactId, performedBy }: { contactId: string; performedBy?: string }) => {
      const now = new Date().toISOString();
      
      const { error: updateError } = await supabase
        .from("contacts")
        .update({ 
          linkedin_contacted_at: now,
          last_activity_at: now
        })
        .eq("id", contactId);
      
      if (updateError) throw updateError;
      
      const { error: activityError } = await supabase
        .from("contact_activities")
        .insert({
          contact_id: contactId,
          activity_type: "linkedin_contacted",
          description: "Contatado via LinkedIn",
          performed_by: performedBy || null,
        });
      
      if (activityError) throw activityError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-contacts"] });
      queryClient.invalidateQueries({ queryKey: ["contact-activities"] });
      toast.success("Marcado como contatado no LinkedIn");
    },
    onError: (error) => {
      toast.error("Erro: " + error.message);
    },
  });
}

export function useAssignContact() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ contactId, assignedTo, performedBy }: { contactId: string; assignedTo: string; performedBy?: string }) => {
      const { error: updateError } = await supabase
        .from("contacts")
        .update({ 
          assigned_to: assignedTo,
          last_activity_at: new Date().toISOString()
        })
        .eq("id", contactId);
      
      if (updateError) throw updateError;
      
      const { error: activityError } = await supabase
        .from("contact_activities")
        .insert({
          contact_id: contactId,
          activity_type: "assigned",
          description: `Atribuído para: ${assignedTo}`,
          performed_by: performedBy || null,
        });
      
      if (activityError) throw activityError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-contacts"] });
      queryClient.invalidateQueries({ queryKey: ["contact-activities"] });
      toast.success("Contato atribuído");
    },
    onError: (error) => {
      toast.error("Erro: " + error.message);
    },
  });
}

export function useAddActivity() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      contactId, 
      activityType, 
      description, 
      performedBy 
    }: { 
      contactId: string; 
      activityType: string; 
      description: string; 
      performedBy?: string 
    }) => {
      const { error: activityError } = await supabase
        .from("contact_activities")
        .insert({
          contact_id: contactId,
          activity_type: activityType,
          description,
          performed_by: performedBy || null,
        });
      
      if (activityError) throw activityError;
      
      const { error: updateError } = await supabase
        .from("contacts")
        .update({ last_activity_at: new Date().toISOString() })
        .eq("id", contactId);
      
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-contacts"] });
      queryClient.invalidateQueries({ queryKey: ["contact-activities"] });
      toast.success("Atividade registrada");
    },
    onError: (error) => {
      toast.error("Erro: " + error.message);
    },
  });
}

export function useUpdateContactNotes() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ contactId, notes }: { contactId: string; notes: string }) => {
      const { error } = await supabase
        .from("contacts")
        .update({ notes })
        .eq("id", contactId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-contacts"] });
      toast.success("Notas atualizadas");
    },
    onError: (error) => {
      toast.error("Erro: " + error.message);
    },
  });
}

export function useCreateTeamMember() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ name, email }: { name: string; email?: string }) => {
      const { error } = await supabase
        .from("team_members")
        .insert({ name, email: email || null });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      toast.success("Membro adicionado à equipe");
    },
    onError: (error) => {
      toast.error("Erro: " + error.message);
    },
  });
}

export function useDeleteTeamMember() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase
        .from("team_members")
        .update({ is_active: false })
        .eq("id", memberId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      toast.success("Membro removido");
    },
    onError: (error) => {
      toast.error("Erro: " + error.message);
    },
  });
}
