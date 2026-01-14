import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface BaseReport {
  baseId: string;
  baseName: string;
  totalContacts: number;
  withEmail: number;
  withLinkedIn: number;
  emailSent: number;
  linkedInContacted: number;
  byStage: Record<string, number>;
}

export interface TeamReport {
  memberId: string;
  memberName: string;
  assignedLeads: number;
  activitiesCount: number;
  stageChanges: number;
}

export function useBaseReports() {
  return useQuery({
    queryKey: ["base-reports"],
    queryFn: async () => {
      // Get all bases
      const { data: bases, error: basesError } = await supabase
        .from("bases")
        .select("id, name");
      
      if (basesError) throw basesError;
      
      const reports: BaseReport[] = [];
      
      for (const base of bases || []) {
        // Get contact stats for this base
        const { data: contacts, error: contactsError } = await supabase
          .from("contacts")
          .select("id, email, personal_email, linkedin_url, crm_stage, linkedin_contacted_at")
          .eq("base_id", base.id);
        
        if (contactsError) throw contactsError;
        
        const contactIds = contacts?.map(c => c.id) || [];
        
        // Get email sends count
        let emailSentCount = 0;
        if (contactIds.length > 0) {
          const { count, error: emailError } = await supabase
            .from("email_sends")
            .select("*", { count: "exact", head: true })
            .in("contact_id", contactIds.slice(0, 100)) // Limit for performance
            .eq("status", "sent");
          
          if (!emailError) {
            emailSentCount = count || 0;
          }
        }
        
        // Calculate stats
        const byStage: Record<string, number> = {};
        let withEmail = 0;
        let withLinkedIn = 0;
        let linkedInContacted = 0;
        
        for (const contact of contacts || []) {
          if (contact.email || contact.personal_email) withEmail++;
          if (contact.linkedin_url) withLinkedIn++;
          if (contact.linkedin_contacted_at) linkedInContacted++;
          
          const stage = contact.crm_stage || "Novo Lead";
          byStage[stage] = (byStage[stage] || 0) + 1;
        }
        
        reports.push({
          baseId: base.id,
          baseName: base.name,
          totalContacts: contacts?.length || 0,
          withEmail,
          withLinkedIn,
          emailSent: emailSentCount,
          linkedInContacted,
          byStage,
        });
      }
      
      return reports;
    },
  });
}

export function useTeamReports() {
  return useQuery({
    queryKey: ["team-reports"],
    queryFn: async () => {
      // Get all team members
      const { data: members, error: membersError } = await supabase
        .from("team_members")
        .select("id, name")
        .eq("is_active", true);
      
      if (membersError) throw membersError;
      
      const reports: TeamReport[] = [];
      
      for (const member of members || []) {
        // Get assigned leads count
        const { count: assignedCount, error: assignedError } = await supabase
          .from("contacts")
          .select("*", { count: "exact", head: true })
          .eq("assigned_to", member.name);
        
        if (assignedError) throw assignedError;
        
        // Get activities count
        const { count: activitiesCount, error: activitiesError } = await supabase
          .from("contact_activities")
          .select("*", { count: "exact", head: true })
          .eq("performed_by", member.name);
        
        if (activitiesError) throw activitiesError;
        
        // Get stage changes count
        const { count: stageChanges, error: stageError } = await supabase
          .from("contact_activities")
          .select("*", { count: "exact", head: true })
          .eq("performed_by", member.name)
          .eq("activity_type", "stage_change");
        
        if (stageError) throw stageError;
        
        reports.push({
          memberId: member.id,
          memberName: member.name,
          assignedLeads: assignedCount || 0,
          activitiesCount: activitiesCount || 0,
          stageChanges: stageChanges || 0,
        });
      }
      
      return reports;
    },
  });
}

export function useGlobalStats() {
  return useQuery({
    queryKey: ["global-stats"],
    queryFn: async () => {
      // Total contacts
      const { count: totalContacts } = await supabase
        .from("contacts")
        .select("*", { count: "exact", head: true });
      
      // Contacts with email
      const { count: withEmail } = await supabase
        .from("contacts")
        .select("*", { count: "exact", head: true })
        .not("email", "is", null);
      
      // Contacts with LinkedIn
      const { count: withLinkedIn } = await supabase
        .from("contacts")
        .select("*", { count: "exact", head: true })
        .not("linkedin_url", "is", null);
      
      // LinkedIn contacted
      const { count: linkedInContacted } = await supabase
        .from("contacts")
        .select("*", { count: "exact", head: true })
        .not("linkedin_contacted_at", "is", null);
      
      // Total emails sent
      const { count: emailsSent } = await supabase
        .from("email_sends")
        .select("*", { count: "exact", head: true })
        .eq("status", "sent");
      
      // Total activities
      const { count: totalActivities } = await supabase
        .from("contact_activities")
        .select("*", { count: "exact", head: true });
      
      // Stage distribution
      const { data: stageData } = await supabase
        .from("contacts")
        .select("crm_stage");
      
      const stageDistribution: Record<string, number> = {};
      for (const contact of stageData || []) {
        const stage = contact.crm_stage || "Novo Lead";
        stageDistribution[stage] = (stageDistribution[stage] || 0) + 1;
      }
      
      return {
        totalContacts: totalContacts || 0,
        withEmail: withEmail || 0,
        withLinkedIn: withLinkedIn || 0,
        linkedInContacted: linkedInContacted || 0,
        emailsSent: emailsSent || 0,
        totalActivities: totalActivities || 0,
        stageDistribution,
      };
    },
  });
}
