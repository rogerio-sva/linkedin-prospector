import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, CheckCircle2, XCircle, Clock, Users, AlertTriangle, RotateCcw } from "lucide-react";
import { LinkedInContact } from "@/types/contact";
import { toast } from "sonner";

interface SearchProgressProps {
  runId: string;
  datasetId: string;
  fetchCount: number;
  onComplete: (contacts: LinkedInContact[]) => void;
  onCancel: () => void;
}

export const SearchProgress = ({ 
  runId, 
  datasetId, 
  fetchCount, 
  onComplete, 
  onCancel 
}: SearchProgressProps) => {
  const [status, setStatus] = useState<string>("RUNNING");
  const [progress, setProgress] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [outputCount, setOutputCount] = useState(0);
  const [isFetching, setIsFetching] = useState(false);
  const [isResurrecting, setIsResurrecting] = useState(false);
  const [currentDatasetId, setCurrentDatasetId] = useState(datasetId);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const checkStatus = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke("fetch-dataset", {
        body: { runId, datasetId: currentDatasetId, checkStatusOnly: true },
      });

      if (error) {
        console.error("Status check error:", error);
        return;
      }

      setStatus(data.status);
      
      // Update datasetId if returned (useful after resurrect)
      if (data.datasetId) {
        setCurrentDatasetId(data.datasetId);
      }
      
      if (data.stats) {
        const output = data.stats.outputRecordCount || 0;
        setOutputCount(output);
        // Estimate progress based on output vs expected
        const estimatedProgress = Math.min((output / fetchCount) * 100, 95);
        setProgress(estimatedProgress);
      }

      if (data.status === "SUCCEEDED") {
        setProgress(100);
        fetchResults();
      } else if (data.status === "FAILED" || data.status === "ABORTED") {
        toast.error("A busca falhou ou foi cancelada");
      } else if (data.status === "TIMED-OUT") {
        toast.warning("A busca expirou. Você pode retomar de onde parou.");
      }
    } catch (err) {
      console.error("Error checking status:", err);
    }
  }, [runId, currentDatasetId, fetchCount]);

  const fetchResults = async () => {
    setIsFetching(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-dataset", {
        body: { runId, datasetId: currentDatasetId },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data.contacts) {
        const fetchedContacts = data.contacts.map((contact: LinkedInContact) => ({
          ...contact,
          createdAt: new Date(contact.createdAt),
        }));
        onComplete(fetchedContacts);
        toast.success(`${fetchedContacts.length} contatos encontrados!`);
      }
    } catch (err) {
      console.error("Error fetching results:", err);
      toast.error("Erro ao buscar resultados");
    } finally {
      setIsFetching(false);
    }
  };

  const handleResurrect = async () => {
    setIsResurrecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("resurrect-run", {
        body: { runId, timeoutSecs: 3600 }, // 1 hour additional timeout
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data.success) {
        setStatus("RUNNING");
        if (data.datasetId) {
          setCurrentDatasetId(data.datasetId);
        }
        toast.success("Busca retomada! Continuando de onde parou...");
      } else {
        throw new Error(data.error || "Falha ao retomar busca");
      }
    } catch (err) {
      console.error("Error resurrecting run:", err);
      toast.error(`Erro ao retomar busca: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
    } finally {
      setIsResurrecting(false);
    }
  };

  const handleFetchPartialResults = async () => {
    toast.info("Buscando contatos já coletados...");
    await fetchResults();
  };

  // Poll for status updates
  useEffect(() => {
    if (status !== "RUNNING" && status !== "READY") return;

    const interval = setInterval(() => {
      checkStatus();
    }, 5000);

    // Initial check
    checkStatus();

    return () => clearInterval(interval);
  }, [status, checkStatus]);

  // Timer for elapsed time
  useEffect(() => {
    if (status !== "RUNNING" && status !== "READY") return;

    const timer = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [status]);

  const isRunning = status === "RUNNING" || status === "READY";
  const isSuccess = status === "SUCCEEDED";
  const isFailed = status === "FAILED" || status === "ABORTED";
  const isTimedOut = status === "TIMED-OUT";

  return (
    <Card className="p-6 space-y-4 border-primary/20 bg-gradient-to-br from-background to-muted/30">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isRunning && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
          {isSuccess && <CheckCircle2 className="h-5 w-5 text-green-500" />}
          {isFailed && <XCircle className="h-5 w-5 text-destructive" />}
          {isTimedOut && <AlertTriangle className="h-5 w-5 text-amber-500" />}
          <div>
            <h3 className="font-semibold text-foreground">
              {isRunning && "Buscando contatos..."}
              {isSuccess && "Busca concluída!"}
              {isFailed && "Busca falhou"}
              {isTimedOut && "Busca expirou"}
              {isFetching && "Carregando resultados..."}
            </h3>
            <p className="text-sm text-muted-foreground">
              {isRunning && "Isso pode levar alguns minutos para buscas grandes"}
              {isSuccess && !isFetching && `${outputCount} contatos encontrados`}
              {isFailed && "Tente novamente ou verifique os filtros"}
              {isTimedOut && `${outputCount.toLocaleString()} contatos coletados antes do timeout`}
            </p>
          </div>
        </div>
        {isRunning && (
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancelar
          </Button>
        )}
      </div>

      {isTimedOut && (
        <div className="flex flex-col gap-3 p-4 bg-warning/10 border border-warning/30 rounded-lg">
          <p className="text-sm text-warning-foreground">
            A busca expirou antes de concluir. Você pode retomar de onde parou ou recuperar os contatos já coletados.
          </p>
          <div className="flex gap-2">
            <Button 
              onClick={handleResurrect} 
              disabled={isResurrecting}
              className="gap-2"
            >
              {isResurrecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}
              Retomar Busca (+1h)
            </Button>
            <Button 
              variant="outline" 
              onClick={handleFetchPartialResults}
              disabled={isFetching}
            >
              {isFetching ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Recuperar {outputCount.toLocaleString()} contatos
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Progresso</span>
          <span className="font-medium text-foreground">{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      <div className="flex gap-6 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>Tempo: {formatTime(elapsedTime)}</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Users className="h-4 w-4" />
          <span>Contatos: {outputCount.toLocaleString()} / {fetchCount.toLocaleString()}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        <button
          onClick={() => {
            navigator.clipboard.writeText(runId);
            toast.success("Run ID copiado!");
          }}
          className="flex items-center gap-1 font-mono bg-muted px-2 py-1 rounded hover:bg-muted-foreground/20 transition-colors cursor-pointer"
          title="Clique para copiar Run ID completo"
        >
          <span>Run: {runId.slice(0, 12)}...</span>
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </button>
        <button
          onClick={() => {
            navigator.clipboard.writeText(currentDatasetId);
            toast.success("Dataset ID copiado!");
          }}
          className="flex items-center gap-1 font-mono bg-muted px-2 py-1 rounded hover:bg-muted-foreground/20 transition-colors cursor-pointer"
          title="Clique para copiar Dataset ID completo"
        >
          <span>Dataset: {currentDatasetId.slice(0, 12)}...</span>
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </button>
      </div>
    </Card>
  );
};
