import { useState } from "react";
import { SearchRun } from "@/hooks/useSearchRuns";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Loader2, 
  Play, 
  Trash2,
  ChevronDown,
  ChevronUp,
  Copy,
  Download
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { LinkedInContact } from "@/types/contact";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface RecentSearchesProps {
  searchRuns: SearchRun[];
  onDeleteRun: (id: string) => void;
  onResumeRun: (run: SearchRun) => void;
  onRecoverData: (contacts: LinkedInContact[]) => void;
}

export const RecentSearches = ({
  searchRuns,
  onDeleteRun,
  onResumeRun,
  onRecoverData,
}: RecentSearchesProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [loadingRunId, setLoadingRunId] = useState<string | null>(null);

  // Filter to show only completed/failed/timed-out runs (not RUNNING)
  const completedRuns = searchRuns.filter(
    (run) => run.status !== "RUNNING" && run.status !== "READY"
  );

  if (completedRuns.length === 0) {
    return null;
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "SUCCEEDED":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "FAILED":
      case "ABORTED":
        return <XCircle className="h-4 w-4 text-destructive" />;
      case "TIMED-OUT":
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      default:
        return <Loader2 className="h-4 w-4 animate-spin" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      SUCCEEDED: "default",
      FAILED: "destructive",
      ABORTED: "destructive",
      "TIMED-OUT": "secondary",
    };
    
    const labels: Record<string, string> = {
      SUCCEEDED: "Concluída",
      FAILED: "Falhou",
      ABORTED: "Cancelada",
      "TIMED-OUT": "Expirou",
    };

    return (
      <Badge variant={variants[status] || "outline"}>
        {labels[status] || status}
      </Badge>
    );
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  const handleRecoverData = async (run: SearchRun) => {
    if (!run.dataset_id) {
      toast.error("Dataset ID não disponível");
      return;
    }

    setLoadingRunId(run.id);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-dataset", {
        body: { datasetId: run.dataset_id, runId: run.run_id },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data.contacts) {
        const fetchedContacts = data.contacts.map((contact: LinkedInContact) => ({
          ...contact,
          createdAt: new Date(contact.createdAt),
        }));
        onRecoverData(fetchedContacts);
        toast.success(`${fetchedContacts.length} contatos recuperados!`);
      }
    } catch (err) {
      console.error("Error recovering data:", err);
      toast.error("Erro ao recuperar dados");
    } finally {
      setLoadingRunId(null);
    }
  };

  const formatFilters = (filters: unknown): string => {
    if (!filters || typeof filters !== 'object') return "Filtros não disponíveis";
    
    const f = filters as Record<string, unknown>;
    const parts: string[] = [];
    
    if (Array.isArray(f.contactJobTitle) && f.contactJobTitle.length) {
      parts.push(f.contactJobTitle.join(", "));
    }
    if (Array.isArray(f.contactLocation) && f.contactLocation.length) {
      parts.push(f.contactLocation.join(", "));
    }
    if (Array.isArray(f.companyIndustry) && f.companyIndustry.length) {
      parts.push(f.companyIndustry.join(", "));
    }
    
    return parts.length > 0 ? parts.join(" | ") : "Busca personalizada";
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="p-4">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Buscas Recentes</span>
              <Badge variant="outline" className="ml-2">
                {completedRuns.length}
              </Badge>
            </div>
            {isOpen ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
        </CollapsibleTrigger>
        
        <CollapsibleContent className="mt-4 space-y-3">
          {completedRuns.map((run) => (
            <div
              key={run.id}
              className="flex flex-col gap-2 p-3 rounded-lg border bg-muted/30"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {getStatusIcon(run.status)}
                  <div>
                    <p className="text-sm font-medium">
                      {formatFilters(run.filters)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(run.created_at), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                      {" • "}
                      {run.output_count.toLocaleString()} contatos
                      {run.fetch_count && ` / ${run.fetch_count.toLocaleString()} solicitados`}
                    </p>
                  </div>
                </div>
                {getStatusBadge(run.status)}
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                <button
                  onClick={() => copyToClipboard(run.run_id, "Run ID")}
                  className="flex items-center gap-1 font-mono bg-muted px-2 py-1 rounded hover:bg-muted-foreground/20 transition-colors"
                >
                  <Copy className="h-3 w-3" />
                  Run: {run.run_id.slice(0, 12)}...
                </button>
                {run.dataset_id && (
                  <button
                    onClick={() => copyToClipboard(run.dataset_id!, "Dataset ID")}
                    className="flex items-center gap-1 font-mono bg-muted px-2 py-1 rounded hover:bg-muted-foreground/20 transition-colors"
                  >
                    <Copy className="h-3 w-3" />
                    Dataset: {run.dataset_id.slice(0, 12)}...
                  </button>
                )}
              </div>

              <div className="flex gap-2 mt-1">
                {run.status === "TIMED-OUT" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onResumeRun(run)}
                    className="gap-1"
                  >
                    <Play className="h-3 w-3" />
                    Retomar
                  </Button>
                )}
                {(run.status === "SUCCEEDED" || run.status === "TIMED-OUT") && run.output_count > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRecoverData(run)}
                    disabled={loadingRunId === run.id}
                    className="gap-1"
                  >
                    {loadingRunId === run.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Download className="h-3 w-3" />
                    )}
                    Recuperar
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onDeleteRun(run.id)}
                  className="gap-1 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                  Remover
                </Button>
              </div>
            </div>
          ))}
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};
