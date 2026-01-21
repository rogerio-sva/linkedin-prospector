import { useState } from "react";
import { Trash2, RefreshCw, AlertTriangle, Linkedin, ExternalLink, CheckCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface BouncePendingStats {
  total: number;
  withLinkedIn: number;
  withoutLinkedIn: number;
  byBase: { baseId: string; baseName: string; count: number }[];
  oldestBounce: string | null;
  newestBounce: string | null;
}

export const BounceCleanupPanel = () => {
  const queryClient = useQueryClient();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Fetch pending bounces statistics
  const { data: stats, isLoading, refetch } = useQuery({
    queryKey: ["pending-bounce-cleanup-stats"],
    queryFn: async (): Promise<BouncePendingStats> => {
      // Get all permanent bounces from suppressed_emails
      const { data: suppressedEmails, error: suppressedError } = await supabase
        .from("suppressed_emails")
        .select("email, source_contact_id, created_at")
        .or("reason.eq.bounced,reason.eq.complained")
        .in("bounce_type", ["Permanent", "Complaint"]);

      if (suppressedError) throw suppressedError;

      if (!suppressedEmails || suppressedEmails.length === 0) {
        return {
          total: 0,
          withLinkedIn: 0,
          withoutLinkedIn: 0,
          byBase: [],
          oldestBounce: null,
          newestBounce: null,
        };
      }

      // Get unique emails that bounced
      const bouncedEmails = [...new Set(suppressedEmails.map(s => s.email.toLowerCase()))];

      // Find contacts that still have these emails
      const { data: contactsWithBounce, error: contactsError } = await supabase
        .from("contacts")
        .select("id, email, personal_email, linkedin_url, base_id")
        .or(`email.in.(${bouncedEmails.map(e => `"${e}"`).join(",")}),personal_email.in.(${bouncedEmails.map(e => `"${e}"`).join(",")})`);

      if (contactsError) throw contactsError;

      if (!contactsWithBounce || contactsWithBounce.length === 0) {
        return {
          total: 0,
          withLinkedIn: 0,
          withoutLinkedIn: 0,
          byBase: [],
          oldestBounce: null,
          newestBounce: null,
        };
      }

      // Get base names
      const baseIds = [...new Set(contactsWithBounce.map(c => c.base_id))];
      const { data: bases } = await supabase
        .from("bases")
        .select("id, name")
        .in("id", baseIds);

      const baseMap = new Map(bases?.map(b => [b.id, b.name]) || []);

      // Calculate stats
      const withLinkedIn = contactsWithBounce.filter(c => c.linkedin_url).length;
      const withoutLinkedIn = contactsWithBounce.filter(c => !c.linkedin_url).length;

      // Group by base
      const byBaseMap = new Map<string, number>();
      contactsWithBounce.forEach(c => {
        byBaseMap.set(c.base_id, (byBaseMap.get(c.base_id) || 0) + 1);
      });

      const byBase = Array.from(byBaseMap.entries()).map(([baseId, count]) => ({
        baseId,
        baseName: baseMap.get(baseId) || "Desconhecida",
        count,
      })).sort((a, b) => b.count - a.count);

      // Get date range
      const dates = suppressedEmails.map(s => new Date(s.created_at).getTime());
      const oldestBounce = dates.length > 0 ? new Date(Math.min(...dates)).toISOString() : null;
      const newestBounce = dates.length > 0 ? new Date(Math.max(...dates)).toISOString() : null;

      return {
        total: contactsWithBounce.length,
        withLinkedIn,
        withoutLinkedIn,
        byBase,
        oldestBounce,
        newestBounce,
      };
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Execute cleanup mutation
  const cleanupMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("execute-bounce-cleanup", {
        body: {},
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Limpeza concluída: ${data.emailsCleared} emails limpos, ${data.contactsDeleted} contatos deletados`);
      queryClient.invalidateQueries({ queryKey: ["pending-bounce-cleanup-stats"] });
      queryClient.invalidateQueries({ queryKey: ["crm-contacts"] });
      queryClient.invalidateQueries({ queryKey: ["bases"] });
    },
    onError: (error) => {
      toast.error(`Erro na limpeza: ${error.message}`);
    },
  });

  const handleCleanup = () => {
    setShowConfirmDialog(false);
    cleanupMutation.mutate();
  };

  if (isLoading) {
    return (
      <Card className="p-4 shadow-card">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Carregando estatísticas de bounces...</span>
        </div>
      </Card>
    );
  }

  if (!stats || stats.total === 0) {
    return (
      <Card className="p-4 shadow-card">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-green-500/10">
            <CheckCircle className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <h3 className="font-medium text-foreground">Nenhum bounce pendente</h3>
            <p className="text-sm text-muted-foreground">Todos os contatos com bounce já foram limpos.</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => refetch()} className="ml-auto">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card className="p-4 shadow-card">
        <div className="flex items-start gap-4">
          <div className="p-2 rounded-lg bg-amber-500/10">
            <Trash2 className="h-5 w-5 text-amber-600" />
          </div>
          
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-foreground">Bounces Pendentes de Limpeza</h3>
              <Badge variant="secondary" className="bg-amber-500/10 text-amber-700 border-amber-500/20">
                {stats.total} contatos
              </Badge>
            </div>

            <p className="text-sm text-muted-foreground mb-3">
              Contatos com emails inválidos detectados via webhook desde{" "}
              {stats.oldestBounce && format(new Date(stats.oldestBounce), "dd/MM/yyyy", { locale: ptBR })}
            </p>

            <div className="flex flex-wrap gap-4 text-sm mb-3">
              <div className="flex items-center gap-1.5">
                <Linkedin className="h-4 w-4 text-blue-600" />
                <span className="text-muted-foreground">Com LinkedIn:</span>
                <span className="font-medium text-foreground">{stats.withLinkedIn}</span>
                <span className="text-xs text-muted-foreground">(limpar email)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <ExternalLink className="h-4 w-4 text-orange-600" />
                <span className="text-muted-foreground">Externos:</span>
                <span className="font-medium text-foreground">{stats.withoutLinkedIn}</span>
                <span className="text-xs text-muted-foreground">(deletar)</span>
              </div>
            </div>

            {stats.byBase.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {stats.byBase.slice(0, 5).map((base) => (
                  <Badge key={base.baseId} variant="outline" className="text-xs">
                    {base.baseName}: {base.count}
                  </Badge>
                ))}
                {stats.byBase.length > 5 && (
                  <Badge variant="outline" className="text-xs">
                    +{stats.byBase.length - 5} bases
                  </Badge>
                )}
              </div>
            )}

            {stats.newestBounce && (
              <p className="text-xs text-muted-foreground">
                Último bounce: {format(new Date(stats.newestBounce), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button 
              variant="default" 
              size="sm" 
              onClick={() => setShowConfirmDialog(true)}
              disabled={cleanupMutation.isPending}
            >
              {cleanupMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Limpando...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Executar Limpeza
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Confirmar Limpeza de Bounces
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>Esta ação irá processar {stats.total} contatos com emails inválidos:</p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>
                    <strong>{stats.withLinkedIn}</strong> contatos com LinkedIn terão o email limpo e stage resetado para "Novo Lead"
                  </li>
                  <li>
                    <strong>{stats.withoutLinkedIn}</strong> contatos sem LinkedIn serão deletados permanentemente
                  </li>
                </ul>
                <p className="text-amber-600 font-medium">Esta ação não pode ser desfeita.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleCleanup}>
              Confirmar Limpeza
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
