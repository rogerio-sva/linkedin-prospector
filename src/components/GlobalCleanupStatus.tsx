import { useState, useEffect, useRef } from "react";
import { Loader2, Trash2, RefreshCw, CheckCircle, AlertTriangle, Play, XCircle, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface CleanupJob {
  id: string;
  status: string;
  phase: string;
  total_to_sync: number;
  synced_count: number;
  bounces_found: number;
  emails_cleared: number;
  contacts_deleted: number;
  crm_reset: number;
  errors_count: number;
  started_at: string | null;
  completed_at: string | null;
  last_error: string | null;
}

export function GlobalCleanupStatus() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [autoContinue, setAutoContinue] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);
  const queryClient = useQueryClient();
  const autoContinueRef = useRef(autoContinue);

  // Keep ref in sync with state
  useEffect(() => {
    autoContinueRef.current = autoContinue;
  }, [autoContinue]);

  // Fetch pending emails count
  const { data: pendingStats, refetch: refetchStats } = useQuery({
    queryKey: ["pending-sync-stats"],
    queryFn: async () => {
      const { count: pendingCount } = await supabase
        .from("email_sends")
        .select("*", { count: "exact", head: true })
        .not("resend_id", "is", null)
        .in("status", ["pending", "sent"]);

      const { count: bouncedCount } = await supabase
        .from("email_sends")
        .select("*", { count: "exact", head: true })
        .not("bounced_at", "is", null);

      return {
        pendingSync: pendingCount || 0,
        currentBounces: bouncedCount || 0,
      };
    },
    refetchInterval: autoContinue ? 5000 : 30000,
  });

  // Fetch latest job
  const { data: latestJob, refetch: refetchJob } = useQuery({
    queryKey: ["cleanup-job-latest"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cleanup_jobs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      return data as CleanupJob | null;
    },
    refetchInterval: isProcessing ? 2000 : 10000,
  });

  const processChunk = async () => {
    setIsProcessing(true);
    try {
      const response = await supabase.functions.invoke("global-bounce-cleanup", {
        body: { action: "start" },
      });

      if (response.error) throw response.error;

      const result = response.data;
      setLastResult(result);
      
      // Refetch stats
      await refetchStats();
      await refetchJob();

      if (result.status === "partial" && autoContinueRef.current) {
        // Auto-continue after a short delay
        console.log("Auto-continuing to next chunk...");
        setTimeout(() => {
          if (autoContinueRef.current) {
            processChunk();
          }
        }, 1000);
      } else if (result.status === "completed") {
        setAutoContinue(false);
        toast.success("Limpeza global completa!", {
          description: `${result.emailsCleared} emails limpos, ${result.contactsDeleted} contatos removidos.`,
          duration: 10000,
        });
        setIsProcessing(false);
      } else if (result.status === "failed") {
        setAutoContinue(false);
        toast.error("Erro na limpeza", {
          description: result.message,
        });
        setIsProcessing(false);
      } else {
        setIsProcessing(false);
      }
    } catch (error: any) {
      console.error("Error processing chunk:", error);
      toast.error("Erro ao processar", {
        description: error.message,
      });
      setAutoContinue(false);
      setIsProcessing(false);
    }
  };

  const startWithAutoContinue = () => {
    setAutoContinue(true);
    processChunk();
  };

  const stopAutoContinue = () => {
    setAutoContinue(false);
    setIsProcessing(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "running":
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Executando</Badge>;
      case "completed":
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20"><CheckCircle className="h-3 w-3 mr-1" />Concluído</Badge>;
      case "partial":
        return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20"><RefreshCw className="h-3 w-3 mr-1" />Parcial</Badge>;
      case "failed":
        return <Badge className="bg-red-500/10 text-red-600 border-red-500/20"><XCircle className="h-3 w-3 mr-1" />Falhou</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPhaseName = (phase: string) => {
    switch (phase) {
      case "sync": return "Sincronizando status...";
      case "cleanup": return "Limpando bounces...";
      case "complete": return "Concluído";
      default: return phase;
    }
  };

  const job = lastResult || latestJob;
  const progress = job?.total_to_sync 
    ? Math.round(((job.synced || job.synced_count || 0) / job.total_to_sync) * 100)
    : 0;

  const estimatedTimeMinutes = pendingStats?.pendingSync 
    ? Math.ceil((pendingStats.pendingSync * 0.5) / 60)
    : 0;

  return (
    <Card className="p-4 shadow-card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Trash2 className="h-5 w-5 text-red-500" />
          <h3 className="font-semibold text-foreground">Limpeza Global de Bounces</h3>
        </div>
        {latestJob && getStatusBadge(latestJob.status)}
      </div>

      {/* Current Stats */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="p-3 rounded-lg bg-muted/50">
          <p className="text-xs text-muted-foreground">Emails pendentes</p>
          <p className="text-lg font-semibold text-foreground">{pendingStats?.pendingSync?.toLocaleString() || 0}</p>
        </div>
        <div className="p-3 rounded-lg bg-muted/50">
          <p className="text-xs text-muted-foreground">Bounces atuais</p>
          <p className="text-lg font-semibold text-red-600">{pendingStats?.currentBounces?.toLocaleString() || 0}</p>
        </div>
      </div>

      {/* Progress (if processing) */}
      {(isProcessing || latestJob?.status === "running" || latestJob?.status === "partial") && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">
              {isProcessing ? getPhaseName(job?.phase || "sync") : "Progresso"}
            </span>
            <span className="text-sm font-medium">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-muted-foreground">
              {(job?.synced || job?.synced_count || 0).toLocaleString()} / {(job?.total_to_sync || 0).toLocaleString()} sincronizados
            </p>
            {autoContinue && (
              <Badge variant="outline" className="text-xs">
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Auto-processando
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Results */}
      {job && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4 text-center">
          <div className="p-2 rounded bg-blue-500/10">
            <p className="text-lg font-semibold text-blue-600">{job.synced || job.synced_count || 0}</p>
            <p className="text-xs text-muted-foreground">Sincronizados</p>
          </div>
          <div className="p-2 rounded bg-red-500/10">
            <p className="text-lg font-semibold text-red-600">{job.bouncesFound || job.bounces_found || 0}</p>
            <p className="text-xs text-muted-foreground">Bounces</p>
          </div>
          <div className="p-2 rounded bg-orange-500/10">
            <p className="text-lg font-semibold text-orange-600">{job.emailsCleared || job.emails_cleared || 0}</p>
            <p className="text-xs text-muted-foreground">Emails limpos</p>
          </div>
          <div className="p-2 rounded bg-purple-500/10">
            <p className="text-lg font-semibold text-purple-600">{job.contactsDeleted || job.contacts_deleted || 0}</p>
            <p className="text-xs text-muted-foreground">Deletados</p>
          </div>
        </div>
      )}

      {/* Error message */}
      {latestJob?.last_error && (
        <div className="mb-4 p-2 rounded bg-red-500/10 border border-red-500/20">
          <p className="text-xs text-red-600">{latestJob.last_error}</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        {autoContinue ? (
          <Button
            onClick={stopAutoContinue}
            variant="destructive"
            className="flex-1"
          >
            <Pause className="h-4 w-4 mr-2" />
            Pausar Processamento
          </Button>
        ) : isProcessing ? (
          <Button
            disabled
            className="flex-1"
            variant="outline"
          >
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Processando chunk...
          </Button>
        ) : (
          <>
            <Button
              onClick={startWithAutoContinue}
              disabled={pendingStats?.pendingSync === 0 && latestJob?.status === "completed"}
              className="flex-1"
              variant={latestJob?.status === "partial" ? "default" : "outline"}
            >
              <Play className="h-4 w-4 mr-2" />
              {latestJob?.status === "partial" 
                ? `Continuar (${pendingStats?.pendingSync?.toLocaleString()} restantes)`
                : "Iniciar Limpeza"
              }
            </Button>
            {latestJob?.status === "partial" && (
              <Button
                onClick={processChunk}
                variant="outline"
                title="Processar apenas 1 chunk"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            )}
          </>
        )}
      </div>

      {/* Estimated time */}
      {pendingStats?.pendingSync && pendingStats.pendingSync > 0 && !isProcessing && (
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <AlertTriangle className="h-3 w-3" />
          <span>
            Tempo estimado: ~{estimatedTimeMinutes > 60 
              ? `${Math.floor(estimatedTimeMinutes / 60)}h ${estimatedTimeMinutes % 60}min`
              : `${estimatedTimeMinutes} min`
            } (100 emails por chunk, ~50s cada)
          </span>
        </div>
      )}
    </Card>
  );
}
