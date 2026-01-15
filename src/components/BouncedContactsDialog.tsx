import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Download, Trash2, AlertTriangle, XCircle, 
  Loader2, CheckCircle2, RefreshCcw, Linkedin, 
  Mail, MailX, Users, ArrowLeft
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface BouncedContactsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  campaignName: string;
}

interface BouncedContact {
  id: string;
  contact_id: string;
  recipient_email: string;
  recipient_name: string | null;
  bounced_at: string;
  bounce_type: string | null;
  bounce_message: string | null;
  linkedin_url: string | null;
}

export const BouncedContactsDialog = ({
  open,
  onOpenChange,
  campaignId,
  campaignName,
}: BouncedContactsDialogProps) => {
  const queryClient = useQueryClient();
  const [selectedLinkedIn, setSelectedLinkedIn] = useState<Set<string>>(new Set());
  const [selectedExternal, setSelectedExternal] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<string>("linkedin");

  // Fetch bounced sends for this campaign with LinkedIn info
  const { data: bouncedContacts = [], isLoading, refetch } = useQuery({
    queryKey: ["bounced-sends-detailed", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_sends")
        .select(`
          id, 
          contact_id, 
          recipient_email, 
          recipient_name, 
          bounced_at, 
          bounce_type, 
          bounce_message,
          contacts!inner(linkedin_url)
        `)
        .eq("campaign_id", campaignId)
        .not("bounced_at", "is", null)
        .order("bounced_at", { ascending: false });

      if (error) throw error;
      
      return (data || []).map((send: any) => ({
        id: send.id,
        contact_id: send.contact_id,
        recipient_email: send.recipient_email,
        recipient_name: send.recipient_name,
        bounced_at: send.bounced_at,
        bounce_type: send.bounce_type,
        bounce_message: send.bounce_message,
        linkedin_url: send.contacts?.linkedin_url || null,
      })) as BouncedContact[];
    },
    enabled: open && !!campaignId,
  });

  // Separate contacts by LinkedIn status
  const linkedInContacts = bouncedContacts.filter(c => c.linkedin_url && c.linkedin_url.trim() !== '');
  const externalContacts = bouncedContacts.filter(c => !c.linkedin_url || c.linkedin_url.trim() === '');

  // Reset selections when data changes
  useEffect(() => {
    setSelectedLinkedIn(new Set());
    setSelectedExternal(new Set());
  }, [bouncedContacts]);

  // Clean emails mutation (for LinkedIn contacts)
  const cleanEmailsMutation = useMutation({
    mutationFn: async (contactIds: string[]) => {
      let cleaned = 0;
      
      for (const contactId of contactIds) {
        const contact = linkedInContacts.find(c => c.contact_id === contactId);
        if (!contact) continue;

        // Clear email and reset CRM stage
        const { error: updateError } = await supabase
          .from("contacts")
          .update({ 
            email: null,
            crm_stage: 'Novo Lead',
          })
          .eq("id", contactId);

        if (!updateError) {
          cleaned++;
          
          // Log activity
          await supabase.from("contact_activities").insert({
            contact_id: contactId,
            activity_type: "email_cleaned",
            description: `Email inválido removido: ${contact.recipient_email}. Contato mantido (possui LinkedIn). CRM resetado para Novo Lead.`,
            metadata: { 
              cleaned_email: contact.recipient_email,
              campaign_id: campaignId,
            },
          });
        }
      }
      
      return cleaned;
    },
    onSuccess: (count) => {
      toast.success(`${count} email(s) limpo(s). Contatos mantidos e CRM resetado para "Novo Lead"`);
      setSelectedLinkedIn(new Set());
      queryClient.invalidateQueries({ queryKey: ["bounced-sends-detailed", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["campaign-metrics", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["bases"] });
      refetch();
    },
    onError: (error) => {
      console.error("Error cleaning emails:", error);
      toast.error("Erro ao limpar emails");
    },
  });

  // Delete contacts mutation (for external contacts without LinkedIn)
  const deleteContactsMutation = useMutation({
    mutationFn: async (contactIds: string[]) => {
      // Delete contact_tags first
      await supabase
        .from("contact_tags")
        .delete()
        .in("contact_id", contactIds);

      // Delete contact_activities
      await supabase
        .from("contact_activities")
        .delete()
        .in("contact_id", contactIds);

      // Delete contacts
      const { error } = await supabase
        .from("contacts")
        .delete()
        .in("id", contactIds);

      if (error) throw error;
      return contactIds.length;
    },
    onSuccess: (count) => {
      toast.success(`${count} contato(s) excluído(s) com sucesso`);
      setSelectedExternal(new Set());
      queryClient.invalidateQueries({ queryKey: ["bounced-sends-detailed", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["campaign-metrics", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["bases"] });
      refetch();
    },
    onError: (error) => {
      console.error("Error deleting contacts:", error);
      toast.error("Erro ao excluir contatos");
    },
  });

  const handleSelectAllLinkedIn = () => {
    if (selectedLinkedIn.size === linkedInContacts.length) {
      setSelectedLinkedIn(new Set());
    } else {
      setSelectedLinkedIn(new Set(linkedInContacts.map(c => c.contact_id)));
    }
  };

  const handleSelectAllExternal = () => {
    if (selectedExternal.size === externalContacts.length) {
      setSelectedExternal(new Set());
    } else {
      setSelectedExternal(new Set(externalContacts.map(c => c.contact_id)));
    }
  };

  const handleSelectLinkedIn = (contactId: string) => {
    const newSelected = new Set(selectedLinkedIn);
    if (newSelected.has(contactId)) {
      newSelected.delete(contactId);
    } else {
      newSelected.add(contactId);
    }
    setSelectedLinkedIn(newSelected);
  };

  const handleSelectExternal = (contactId: string) => {
    const newSelected = new Set(selectedExternal);
    if (newSelected.has(contactId)) {
      newSelected.delete(contactId);
    } else {
      newSelected.add(contactId);
    }
    setSelectedExternal(newSelected);
  };

  const handleCleanEmails = () => {
    if (selectedLinkedIn.size === 0) return;
    cleanEmailsMutation.mutate(Array.from(selectedLinkedIn));
  };

  const handleDeleteContacts = () => {
    if (selectedExternal.size === 0) return;
    deleteContactsMutation.mutate(Array.from(selectedExternal));
  };

  const handleExportCSV = () => {
    if (bouncedContacts.length === 0) return;

    const headers = ["Email", "Nome", "Tipo Bounce", "LinkedIn", "Mensagem", "Data Bounce"];
    const rows = bouncedContacts.map((c) => [
      c.recipient_email,
      c.recipient_name || "",
      c.bounce_type || "N/A",
      c.linkedin_url || "",
      c.bounce_message || "",
      c.bounced_at ? format(new Date(c.bounced_at), "dd/MM/yyyy HH:mm") : "",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `bounces_${campaignName.replace(/\s+/g, "_")}_${format(new Date(), "yyyyMMdd")}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast.success("CSV exportado com sucesso");
  };

  const getBounceTypeBadge = (type: string | null) => {
    if (!type) return <Badge variant="secondary">Desconhecido</Badge>;
    
    if (type.toLowerCase().includes("hard") || type.toLowerCase().includes("permanent")) {
      return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Hard</Badge>;
    }
    return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20"><AlertTriangle className="h-3 w-3 mr-1" />Soft</Badge>;
  };

  const renderContactTable = (
    contacts: BouncedContact[],
    selectedIds: Set<string>,
    onSelectOne: (id: string) => void,
    onSelectAll: () => void,
    showLinkedIn: boolean
  ) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[40px]">
            <Checkbox
              checked={selectedIds.size === contacts.length && contacts.length > 0}
              onCheckedChange={onSelectAll}
            />
          </TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Nome</TableHead>
          {showLinkedIn && <TableHead>LinkedIn</TableHead>}
          <TableHead>Tipo</TableHead>
          <TableHead>Data</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {contacts.map((contact) => (
          <TableRow key={contact.id}>
            <TableCell>
              <Checkbox
                checked={selectedIds.has(contact.contact_id)}
                onCheckedChange={() => onSelectOne(contact.contact_id)}
              />
            </TableCell>
            <TableCell className="font-medium text-sm">
              {contact.recipient_email}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {contact.recipient_name || "-"}
            </TableCell>
            {showLinkedIn && (
              <TableCell>
                {contact.linkedin_url ? (
                  <a 
                    href={contact.linkedin_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline flex items-center gap-1"
                  >
                    <Linkedin className="h-3 w-3" />
                    Ver
                  </a>
                ) : "-"}
              </TableCell>
            )}
            <TableCell>
              {getBounceTypeBadge(contact.bounce_type)}
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">
              {contact.bounced_at 
                ? format(new Date(contact.bounced_at), "dd/MM/yy HH:mm", { locale: ptBR })
                : "-"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-red-500" />
            Gerenciar Bounces - {campaignName}
          </DialogTitle>
          <DialogDescription>
            {bouncedContacts.length} email(s) com bounce. 
            <span className="text-blue-600 ml-1">{linkedInContacts.length} com LinkedIn</span> • 
            <span className="text-amber-600 ml-1">{externalContacts.length} externos</span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-2 py-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCcw className="h-4 w-4 mr-1" />
            Atualizar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            disabled={bouncedContacts.length === 0}
          >
            <Download className="h-4 w-4 mr-1" />
            Exportar CSV
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : bouncedContacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <CheckCircle2 className="h-12 w-12 mb-2 text-green-500/50" />
            <p>Nenhum bounce encontrado nesta campanha</p>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="linkedin" className="flex items-center gap-2">
                <Linkedin className="h-4 w-4" />
                Com LinkedIn ({linkedInContacts.length})
              </TabsTrigger>
              <TabsTrigger value="external" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Externos ({externalContacts.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="linkedin" className="mt-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-2">
                    <Linkedin className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                        Contatos com LinkedIn
                      </p>
                      <p className="text-xs text-blue-700 dark:text-blue-300">
                        O email será limpo, mas o contato será mantido para prospecção via LinkedIn. CRM resetado para "Novo Lead".
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleCleanEmails}
                    disabled={selectedLinkedIn.size === 0 || cleanEmailsMutation.isPending}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {cleanEmailsMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <MailX className="h-4 w-4 mr-1" />
                    )}
                    Limpar Emails {selectedLinkedIn.size > 0 ? `(${selectedLinkedIn.size})` : ""}
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAllLinkedIn}
                    disabled={linkedInContacts.length === 0}
                  >
                    {selectedLinkedIn.size === linkedInContacts.length && linkedInContacts.length > 0 
                      ? "Desmarcar Todos" 
                      : "Selecionar Todos"}
                  </Button>
                </div>

                <ScrollArea className="h-[300px] rounded-md border">
                  {linkedInContacts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-8">
                      <Linkedin className="h-8 w-8 mb-2 opacity-50" />
                      <p>Nenhum contato com LinkedIn nesta campanha</p>
                    </div>
                  ) : (
                    renderContactTable(
                      linkedInContacts,
                      selectedLinkedIn,
                      handleSelectLinkedIn,
                      handleSelectAllLinkedIn,
                      true
                    )
                  )}
                </ScrollArea>
              </div>
            </TabsContent>

            <TabsContent value="external" className="mt-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between bg-amber-50 dark:bg-amber-950/20 p-3 rounded-lg border border-amber-200 dark:border-amber-800">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                    <div>
                      <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                        Contatos Externos (sem LinkedIn)
                      </p>
                      <p className="text-xs text-amber-700 dark:text-amber-300">
                        Estes contatos serão completamente excluídos, pois não há outro meio de contato disponível.
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDeleteContacts}
                    disabled={selectedExternal.size === 0 || deleteContactsMutation.isPending}
                  >
                    {deleteContactsMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 mr-1" />
                    )}
                    Excluir Contatos {selectedExternal.size > 0 ? `(${selectedExternal.size})` : ""}
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAllExternal}
                    disabled={externalContacts.length === 0}
                  >
                    {selectedExternal.size === externalContacts.length && externalContacts.length > 0 
                      ? "Desmarcar Todos" 
                      : "Selecionar Todos"}
                  </Button>
                </div>

                <ScrollArea className="h-[300px] rounded-md border">
                  {externalContacts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-8">
                      <CheckCircle2 className="h-8 w-8 mb-2 text-green-500 opacity-50" />
                      <p>Nenhum contato externo sem LinkedIn</p>
                    </div>
                  ) : (
                    renderContactTable(
                      externalContacts,
                      selectedExternal,
                      handleSelectExternal,
                      handleSelectAllExternal,
                      false
                    )
                  )}
                </ScrollArea>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
};
