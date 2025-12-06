import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, CheckCircle2, XCircle, Clock, Users } from "lucide-react";
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

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const checkStatus = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke("fetch-dataset", {
        body: { runId, datasetId, checkStatusOnly: true },
      });

      if (error) {
        console.error("Status check error:", error);
        return;
      }

      setStatus(data.status);
      
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
      }
    } catch (err) {
      console.error("Error checking status:", err);
    }
  }, [runId, datasetId, fetchCount]);

  const fetchResults = async () => {
    setIsFetching(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-dataset", {
        body: { runId, datasetId },
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

  return (
    <Card className="p-6 space-y-4 border-primary/20 bg-gradient-to-br from-background to-muted/30">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isRunning && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
          {isSuccess && <CheckCircle2 className="h-5 w-5 text-green-500" />}
          {isFailed && <XCircle className="h-5 w-5 text-destructive" />}
          <div>
            <h3 className="font-semibold text-foreground">
              {isRunning && "Buscando contatos..."}
              {isSuccess && "Busca concluída!"}
              {isFailed && "Busca falhou"}
              {isFetching && "Carregando resultados..."}
            </h3>
            <p className="text-sm text-muted-foreground">
              {isRunning && "Isso pode levar alguns minutos para buscas grandes"}
              {isSuccess && !isFetching && `${outputCount} contatos encontrados`}
              {isFailed && "Tente novamente ou verifique os filtros"}
            </p>
          </div>
        </div>
        {isRunning && (
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancelar
          </Button>
        )}
      </div>

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

      <div className="flex gap-2 text-xs text-muted-foreground">
        <span className="font-mono bg-muted px-2 py-1 rounded">Run: {runId.slice(0, 12)}...</span>
        <span className="font-mono bg-muted px-2 py-1 rounded">Dataset: {datasetId.slice(0, 12)}...</span>
      </div>
    </Card>
  );
};
