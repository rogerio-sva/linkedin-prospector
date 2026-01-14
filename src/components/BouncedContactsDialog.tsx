import { useState } from "react";
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
import { 
  Download, Trash2, AlertTriangle, XCircle, 
  Loader2, CheckCircle2, RefreshCcw 
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

interface BouncedSend {
  id: string;
  contact_id: string;
  recipient_email: string;
  recipient_name: string | null;
  bounced_at: string;
  bounce_type: string | null;
  bounce_message: string | null;
}

export const BouncedContactsDialog = ({
  open,
  onOpenChange,
  campaignId,
  campaignName,
}: BouncedContactsDialogProps) => {
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Fetch bounced sends for this campaign
  const { data: bouncedSends = [], isLoading, refetch } = useQuery({
    queryKey: ["bounced-sends", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_sends")
        .select("id, contact_id, recipient_email, recipient_name, bounced_at, bounce_type, bounce_message")
        .eq("campaign_id", campaignId)
        .not("bounced_at", "is", null)
        .order("bounced_at", { ascending: false });

      if (error) throw error;
      return data as BouncedSend[];
    },
    enabled: open && !!campaignId,
  });

  // Delete contacts mutation
  const deleteContactsMutation = useMutation({
    mutationFn: async (contactIds: string[]) => {
      // First delete contact_tags
      await supabase
        .from("contact_tags")
        .delete()
        .in("contact_id", contactIds);

      // Then delete contacts
      const { error } = await supabase
        .from("contacts")
        .delete()
        .in("id", contactIds);

      if (error) throw error;
      return contactIds.length;
    },
    onSuccess: (count) => {
      toast.success(`${count} contato(s) excluído(s) com sucesso`);
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["bounced-sends", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["campaign-metrics", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["bases"] });
      refetch();
    },
    onError: (error) => {
      console.error("Error deleting contacts:", error);
      toast.error("Erro ao excluir contatos");
    },
  });

  const handleSelectAll = () => {
    if (selectedIds.size === bouncedSends.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(bouncedSends.map((s) => s.contact_id)));
    }
  };

  const handleSelectOne = (contactId: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(contactId)) {
      newSelected.delete(contactId);
    } else {
      newSelected.add(contactId);
    }
    setSelectedIds(newSelected);
  };

  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) return;
    deleteContactsMutation.mutate(Array.from(selectedIds));
  };

  const handleExportCSV = () => {
    if (bouncedSends.length === 0) return;

    const headers = ["Email", "Nome", "Tipo Bounce", "Mensagem", "Data Bounce"];
    const rows = bouncedSends.map((s) => [
      s.recipient_email,
      s.recipient_name || "",
      s.bounce_type || "N/A",
      s.bounce_message || "",
      s.bounced_at ? format(new Date(s.bounced_at), "dd/MM/yyyy HH:mm") : "",
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-red-500" />
            Emails com Bounce - {campaignName}
          </DialogTitle>
          <DialogDescription>
            {bouncedSends.length} email(s) retornaram com erro. Você pode exportar ou excluir esses contatos.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-2 py-2">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
              disabled={bouncedSends.length === 0}
            >
              {selectedIds.size === bouncedSends.length && bouncedSends.length > 0 
                ? "Desmarcar Todos" 
                : "Selecionar Todos"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading}
            >
              <RefreshCcw className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              disabled={bouncedSends.length === 0}
            >
              <Download className="h-4 w-4 mr-1" />
              Exportar CSV
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteSelected}
              disabled={selectedIds.size === 0 || deleteContactsMutation.isPending}
            >
              {deleteContactsMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-1" />
              )}
              Excluir {selectedIds.size > 0 ? `(${selectedIds.size})` : ""}
            </Button>
          </div>
        </div>

        <ScrollArea className="h-[400px] rounded-md border">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : bouncedSends.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <CheckCircle2 className="h-12 w-12 mb-2 text-green-500/50" />
              <p>Nenhum bounce encontrado nesta campanha</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">
                    <Checkbox
                      checked={selectedIds.size === bouncedSends.length && bouncedSends.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Mensagem</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bouncedSends.map((send) => (
                  <TableRow key={send.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(send.contact_id)}
                        onCheckedChange={() => handleSelectOne(send.contact_id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium text-sm">
                      {send.recipient_email}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {send.recipient_name || "-"}
                    </TableCell>
                    <TableCell>
                      {getBounceTypeBadge(send.bounce_type)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                      {send.bounce_message || "-"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {send.bounced_at 
                        ? format(new Date(send.bounced_at), "dd/MM/yy HH:mm", { locale: ptBR })
                        : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
