import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { LinkedInContact } from "@/types/contact";

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  variables: string[];
  createdAt: Date;
  updatedAt: Date;
}

export const AVAILABLE_VARIABLES = [
  { key: "firstName", label: "Primeiro Nome", example: "João" },
  { key: "lastName", label: "Sobrenome", example: "Silva" },
  { key: "fullName", label: "Nome Completo", example: "João Silva" },
  { key: "companyName", label: "Empresa", example: "Empresa XYZ" },
  { key: "jobTitle", label: "Cargo", example: "Diretor de Marketing" },
  { key: "email", label: "Email", example: "joao@empresa.com" },
  { key: "city", label: "Cidade", example: "São Paulo" },
  { key: "industry", label: "Indústria", example: "Tecnologia" },
] as const;

export const useEmailTemplates = () => {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTemplates = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("email_templates")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setTemplates(
        data.map((t) => ({
          id: t.id,
          name: t.name,
          subject: t.subject,
          body: t.body,
          variables: t.variables || [],
          createdAt: new Date(t.created_at),
          updatedAt: new Date(t.updated_at),
        }))
      );
    } catch (error) {
      console.error("Error fetching templates:", error);
      toast.error("Erro ao carregar templates");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const createTemplate = async (
    name: string,
    subject: string,
    body: string
  ): Promise<EmailTemplate | null> => {
    try {
      const variables = extractVariables(subject + " " + body);

      const { data, error } = await supabase
        .from("email_templates")
        .insert({ name, subject, body, variables })
        .select()
        .single();

      if (error) throw error;

      const newTemplate: EmailTemplate = {
        id: data.id,
        name: data.name,
        subject: data.subject,
        body: data.body,
        variables: data.variables || [],
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
      };

      setTemplates((prev) => [newTemplate, ...prev]);
      toast.success("Template criado com sucesso!");
      return newTemplate;
    } catch (error) {
      console.error("Error creating template:", error);
      toast.error("Erro ao criar template");
      return null;
    }
  };

  const updateTemplate = async (
    id: string,
    name: string,
    subject: string,
    body: string
  ): Promise<boolean> => {
    try {
      const variables = extractVariables(subject + " " + body);

      const { error } = await supabase
        .from("email_templates")
        .update({ name, subject, body, variables })
        .eq("id", id);

      if (error) throw error;

      setTemplates((prev) =>
        prev.map((t) =>
          t.id === id
            ? { ...t, name, subject, body, variables, updatedAt: new Date() }
            : t
        )
      );
      toast.success("Template atualizado!");
      return true;
    } catch (error) {
      console.error("Error updating template:", error);
      toast.error("Erro ao atualizar template");
      return false;
    }
  };

  const deleteTemplate = async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("email_templates")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setTemplates((prev) => prev.filter((t) => t.id !== id));
      toast.success("Template excluído!");
      return true;
    } catch (error) {
      console.error("Error deleting template:", error);
      toast.error("Erro ao excluir template");
      return false;
    }
  };

  const renderTemplate = (
    template: EmailTemplate,
    contact: LinkedInContact
  ): { subject: string; body: string } => {
    const replacements: Record<string, string> = {
      firstName: contact.firstName || "",
      lastName: contact.lastName || "",
      fullName: contact.fullName || "",
      companyName: contact.companyName || "",
      jobTitle: contact.jobTitle || "",
      email: contact.email || "",
      city: contact.city || "",
      industry: contact.industry || "",
    };

    let renderedSubject = template.subject;
    let renderedBody = template.body;

    Object.entries(replacements).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
      renderedSubject = renderedSubject.replace(regex, value);
      renderedBody = renderedBody.replace(regex, value);
    });

    return { subject: renderedSubject, body: renderedBody };
  };

  return {
    templates,
    isLoading,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    renderTemplate,
    refreshTemplates: fetchTemplates,
  };
};

// Helper function to extract variables from text
function extractVariables(text: string): string[] {
  const regex = /\{\{(\w+)\}\}/g;
  const matches = new Set<string>();
  let match;
  while ((match = regex.exec(text)) !== null) {
    matches.add(match[1]);
  }
  return Array.from(matches);
}
