import { useState, useEffect } from "react";
import { Loader2, Trash2, RefreshCw, CheckCircle, AlertTriangle, Play, XCircle } from "lucide-react";
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
  const [isStarting, setIsStarting] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Fetch pending emails count
  const { data: pendingStats } = useQuery({
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
    refetchInterval: 10000,
  });

  // Fetch latest job
  const { data: latestJob, refetch: refetchJob } = useQuery({
    queryKey: ["cleanup-job", activeJobId],
    queryFn: async () => {
      if (activeJobId) {
        const { data, error } = await supabase
          .from("cleanup_jobs")
          .select("*")
          .eq("id", activeJobId)
          .single();
        
        if (error) throw error;
        return data as CleanupJob;
      }

      // Get latest running or recent job
      const { data, error } = await supabase
        .from("cleanup_jobs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      return data as CleanupJob | null;
    },
    refetchInterval: (query) => {
      const job = query.state.data;
      if (job?.status === "running") return 2000;
      return false;
    },
  });

  useEffect(() => {
    if (latestJob?.status === "running" && !activeJobId) {
      setActiveJobId(latestJob.id);
    }
  }, [latestJob, activeJobId]);

  const startCleanup = async () => {
    setIsStarting(true);
    try {
      const response = await supabase.functions.invoke("global-bounce-cleanup", {
        body: { action: "start" },
      });

      if (response.error) throw response.error;

      const result = response.data;
      setActiveJobId(result.jobId);
      
      toast.success("Limpeza global iniciada!", {
        description: `Processando ${pendingStats?.pendingSync || 0} emails em background...`,
        duration: 5000,
      });

      // Refetch stats
      queryClient.invalidateQueries({ queryKey: ["pending-sync-stats"] });
      queryClient.invalidateQueries({ queryKey: ["cleanup-job"] });
      refetchJob();
    } catch (error: any) {
      console.error("Error starting cleanup:", error);
      toast.error("Erro ao iniciar limpeza", {
        description: error.message,
      });
    } finally {
      setIsStarting(false);
    }
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

  const progress = latestJob?.total_to_sync 
    ? Math.round((latestJob.synced_count / latestJob.total_to_sync) * 100)
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

      {/* Progress (if job running) */}
      {latestJob?.status === "running" && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">{getPhaseName(latestJob.phase)}</span>
            <span className="text-sm font-medium">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground mt-2">
            {latestJob.synced_count.toLocaleString()} / {latestJob.total_to_sync.toLocaleString()} sincronizados
          </p>
        </div>
      )}

      {/* Results (if completed or partial) */}
      {latestJob && (latestJob.status === "completed" || latestJob.status === "partial") && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4 text-center">
          <div className="p-2 rounded bg-blue-500/10">
            <p className="text-lg font-semibold text-blue-600">{latestJob.synced_count}</p>
            <p className="text-xs text-muted-foreground">Sincronizados</p>
          </div>
          <div className="p-2 rounded bg-red-500/10">
            <p className="text-lg font-semibold text-red-600">{latestJob.bounces_found}</p>
            <p className="text-xs text-muted-foreground">Bounces</p>
          </div>
          <div className="p-2 rounded bg-orange-500/10">
            <p className="text-lg font-semibold text-orange-600">{latestJob.emails_cleared}</p>
            <p className="text-xs text-muted-foreground">Emails limpos</p>
          </div>
          <div className="p-2 rounded bg-purple-500/10">
            <p className="text-lg font-semibold text-purple-600">{latestJob.contacts_deleted}</p>
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

      {/* Action Button */}
      <div className="flex items-center gap-2">
        <Button
          onClick={startCleanup}
          disabled={isStarting || latestJob?.status === "running"}
          className="flex-1"
          variant={latestJob?.status === "partial" ? "default" : "outline"}
        >
          {isStarting || latestJob?.status === "running" ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processando...
            </>
          ) : latestJob?.status === "partial" ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Continuar ({pendingStats?.pendingSync?.toLocaleString()} restantes)
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-2" />
              Iniciar Limpeza Global
            </>
          )}
        </Button>
      </div>

      {/* Estimated time */}
      {pendingStats?.pendingSync && pendingStats.pendingSync > 0 && latestJob?.status !== "running" && (
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <AlertTriangle className="h-3 w-3" />
          <span>
            Tempo estimado: ~{estimatedTimeMinutes > 60 
              ? `${Math.floor(estimatedTimeMinutes / 60)}h ${estimatedTimeMinutes % 60}min`
              : `${estimatedTimeMinutes} min`
            } (processando 200 emails por execução)
          </span>
        </div>
      )}
    </Card>
  );
}
