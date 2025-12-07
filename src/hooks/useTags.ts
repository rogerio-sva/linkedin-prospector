import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Tag {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface ContactTag {
  id: string;
  contact_id: string;
  tag_id: string;
  created_at: string;
}

export const useTags = () => {
  const [tags, setTags] = useState<Tag[]>([]);
  const [contactTags, setContactTags] = useState<ContactTag[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTags = async () => {
    try {
      const { data, error } = await supabase
        .from("tags")
        .select("*")
        .order("name");

      if (error) throw error;
      setTags(data || []);
    } catch (error) {
      console.error("Error fetching tags:", error);
    }
  };

  const fetchContactTags = async (contactIds?: string[]) => {
    try {
      let query = supabase.from("contact_tags").select("*");
      
      if (contactIds && contactIds.length > 0) {
        query = query.in("contact_id", contactIds);
      }

      const { data, error } = await query;

      if (error) throw error;
      setContactTags(data || []);
    } catch (error) {
      console.error("Error fetching contact tags:", error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await fetchTags();
      await fetchContactTags();
      setIsLoading(false);
    };
    loadData();
  }, []);

  const createTag = async (name: string, color: string): Promise<Tag | null> => {
    try {
      const { data, error } = await supabase
        .from("tags")
        .insert({ name: name.trim(), color })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          toast.error("Já existe uma tag com esse nome");
          return null;
        }
        throw error;
      }

      setTags((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      toast.success(`Tag "${name}" criada!`);
      return data;
    } catch (error) {
      console.error("Error creating tag:", error);
      toast.error("Erro ao criar tag");
      return null;
    }
  };

  const updateTag = async (tagId: string, name: string, color: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("tags")
        .update({ name: name.trim(), color })
        .eq("id", tagId);

      if (error) {
        if (error.code === "23505") {
          toast.error("Já existe uma tag com esse nome");
          return false;
        }
        throw error;
      }

      setTags((prev) =>
        prev
          .map((t) => (t.id === tagId ? { ...t, name: name.trim(), color } : t))
          .sort((a, b) => a.name.localeCompare(b.name))
      );
      toast.success("Tag atualizada!");
      return true;
    } catch (error) {
      console.error("Error updating tag:", error);
      toast.error("Erro ao atualizar tag");
      return false;
    }
  };

  const deleteTag = async (tagId: string): Promise<boolean> => {
    try {
      const { error } = await supabase.from("tags").delete().eq("id", tagId);

      if (error) throw error;

      setTags((prev) => prev.filter((t) => t.id !== tagId));
      setContactTags((prev) => prev.filter((ct) => ct.tag_id !== tagId));
      toast.success("Tag excluída!");
      return true;
    } catch (error) {
      console.error("Error deleting tag:", error);
      toast.error("Erro ao excluir tag");
      return false;
    }
  };

  const addTagToContact = async (contactId: string, tagId: string): Promise<boolean> => {
    try {
      const existing = contactTags.find(
        (ct) => ct.contact_id === contactId && ct.tag_id === tagId
      );
      if (existing) return true;

      const { data, error } = await supabase
        .from("contact_tags")
        .insert({ contact_id: contactId, tag_id: tagId })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") return true; // Already exists
        throw error;
      }

      setContactTags((prev) => [...prev, data]);
      return true;
    } catch (error) {
      console.error("Error adding tag to contact:", error);
      return false;
    }
  };

  const removeTagFromContact = async (contactId: string, tagId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("contact_tags")
        .delete()
        .eq("contact_id", contactId)
        .eq("tag_id", tagId);

      if (error) throw error;

      setContactTags((prev) =>
        prev.filter((ct) => !(ct.contact_id === contactId && ct.tag_id === tagId))
      );
      return true;
    } catch (error) {
      console.error("Error removing tag from contact:", error);
      return false;
    }
  };

  const addTagToContacts = async (contactIds: string[], tagId: string): Promise<number> => {
    try {
      const existingPairs = new Set(
        contactTags
          .filter((ct) => ct.tag_id === tagId)
          .map((ct) => ct.contact_id)
      );

      const newEntries = contactIds
        .filter((id) => !existingPairs.has(id))
        .map((contact_id) => ({ contact_id, tag_id: tagId }));

      if (newEntries.length === 0) return 0;

      const { data, error } = await supabase
        .from("contact_tags")
        .insert(newEntries)
        .select();

      if (error) throw error;

      setContactTags((prev) => [...prev, ...(data || [])]);
      return newEntries.length;
    } catch (error) {
      console.error("Error adding tag to contacts:", error);
      return 0;
    }
  };

  const removeTagFromContacts = async (contactIds: string[], tagId: string): Promise<number> => {
    try {
      const { error } = await supabase
        .from("contact_tags")
        .delete()
        .in("contact_id", contactIds)
        .eq("tag_id", tagId);

      if (error) throw error;

      const removedCount = contactTags.filter(
        (ct) => contactIds.includes(ct.contact_id) && ct.tag_id === tagId
      ).length;

      setContactTags((prev) =>
        prev.filter(
          (ct) => !(contactIds.includes(ct.contact_id) && ct.tag_id === tagId)
        )
      );
      return removedCount;
    } catch (error) {
      console.error("Error removing tag from contacts:", error);
      return 0;
    }
  };

  const getTagsForContact = (contactId: string): Tag[] => {
    const tagIds = contactTags
      .filter((ct) => ct.contact_id === contactId)
      .map((ct) => ct.tag_id);
    return tags.filter((t) => tagIds.includes(t.id));
  };

  const getContactsWithTag = (tagId: string): string[] => {
    return contactTags
      .filter((ct) => ct.tag_id === tagId)
      .map((ct) => ct.contact_id);
  };

  return {
    tags,
    contactTags,
    isLoading,
    createTag,
    updateTag,
    deleteTag,
    addTagToContact,
    removeTagFromContact,
    addTagToContacts,
    removeTagFromContacts,
    getTagsForContact,
    getContactsWithTag,
    refreshContactTags: fetchContactTags,
  };
};
