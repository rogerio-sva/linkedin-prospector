import { useState, useEffect, useMemo } from "react";
import { CheckCircle, XCircle, AlertTriangle, HelpCircle, Loader2, Shield, Mail, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ValidateEmailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  baseId: string | null;
  baseName: string;
  onValidationComplete?: () => void;
}

interface ValidationSummary {
  total: number;
  validated: number;
  cached: number;
  errors: number;
  deliverable: number;
  undeliverable: number;
  risky: number;
  unknown: number;
}

interface ValidationResult {
  email: string;
  status: string;
  score: number;
  reason: string;
  state: string;
  free: boolean;
  disposable: boolean;
  accept_all: boolean;
  role: boolean;
}

type ValidationStatus = "idle" | "loading" | "validating" | "completed" | "error";

const BATCH_SIZE = 20; // Process 20 emails at a time to avoid Edge Function timeout

export function ValidateEmailsDialog({
  open,
  onOpenChange,
  baseId,
  baseName,
  onValidationComplete,
}: ValidateEmailsDialogProps) {
  const [status, setStatus] = useState<ValidationStatus>("idle");
  const [emails, setEmails] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [summary, setSummary] = useState<ValidationSummary | null>(null);
  const [results, setResults] = useState<ValidationResult[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load emails when dialog opens
  useEffect(() => {
    if (open && baseId) {
      loadEmails();
    } else if (!open) {
      // Reset state when dialog closes
      setStatus("idle");
      setEmails([]);
      setProgress(0);
      setSummary(null);
      setResults([]);
      setErrorMessage(null);
    }
  }, [open, baseId]);

  const loadEmails = async () => {
    if (!baseId) return;

    setStatus("loading");
    try {
      // Fetch all emails from the base
      const { data, error } = await supabase
        .from("contacts")
        .select("email, personal_email")
        .eq("base_id", baseId);

      if (error) throw error;

      // Extract unique emails
      const allEmails = new Set<string>();
      data?.forEach((contact) => {
        if (contact.email) allEmails.add(contact.email.toLowerCase().trim());
        if (contact.personal_email) allEmails.add(contact.personal_email.toLowerCase().trim());
      });

      const emailList = Array.from(allEmails).filter(e => e && e.includes("@"));
      setEmails(emailList);
      setStatus("idle");
    } catch (error: any) {
      console.error("Erro ao carregar emails:", error);
      setErrorMessage(error.message);
      setStatus("error");
    }
  };

  const startValidation = async () => {
    if (emails.length === 0) return;

    setStatus("validating");
    setProgress(0);
    setResults([]);
    setSummary(null);
    setErrorMessage(null);

    const allResults: ValidationResult[] = [];
    const totalBatches = Math.ceil(emails.length / BATCH_SIZE);

    try {
      for (let i = 0; i < emails.length; i += BATCH_SIZE) {
        const batch = emails.slice(i, i + BATCH_SIZE);
        const currentBatch = Math.floor(i / BATCH_SIZE) + 1;

        console.log(`Validando batch ${currentBatch}/${totalBatches} (${batch.length} emails)`);

        const { data, error } = await supabase.functions.invoke("validate-emails", {
          body: { emails: batch, baseId },
        });

        if (error) {
          console.error("Erro na validação:", error);
          throw new Error(error.message);
        }

        if (data?.results) {
          allResults.push(...data.results);
        }

        // Update progress
        const progressPercent = Math.round(((i + batch.length) / emails.length) * 100);
        setProgress(progressPercent);
        setResults([...allResults]);
      }

      // Calculate final summary
      const finalSummary: ValidationSummary = {
        total: emails.length,
        validated: allResults.filter(r => r.status !== "unknown" || r.reason !== "api_error").length,
        cached: 0, // Will be set by the last batch response
        errors: allResults.filter(r => r.reason === "api_error" || r.reason === "validation_error").length,
        deliverable: allResults.filter(r => r.status === "deliverable").length,
        undeliverable: allResults.filter(r => r.status === "undeliverable").length,
        risky: allResults.filter(r => r.status === "risky").length,
        unknown: allResults.filter(r => r.status === "unknown").length,
      };

      setSummary(finalSummary);
      setResults(allResults);
      setStatus("completed");

      toast.success(`Validação concluída! ${finalSummary.deliverable} emails válidos encontrados.`);
      onValidationComplete?.();

    } catch (error: any) {
      console.error("Erro na validação:", error);
      setErrorMessage(error.message);
      setStatus("error");
      toast.error("Erro na validação de emails");
    }
  };

  const statusCounts = useMemo(() => {
    return {
      deliverable: results.filter(r => r.status === "deliverable").length,
      undeliverable: results.filter(r => r.status === "undeliverable").length,
      risky: results.filter(r => r.status === "risky").length,
      unknown: results.filter(r => r.status === "unknown").length,
    };
  }, [results]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "deliverable":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "undeliverable":
        return <XCircle className="h-4 w-4 text-destructive" />;
      case "risky":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <HelpCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "deliverable":
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Válido</Badge>;
      case "undeliverable":
        return <Badge variant="destructive">Inválido</Badge>;
      case "risky":
        return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Arriscado</Badge>;
      default:
        return <Badge variant="secondary">Desconhecido</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Validar Emails - {baseName}
          </DialogTitle>
          <DialogDescription>
            Valide os emails da sua base antes de enviar campanhas para reduzir bounces
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {/* Loading state */}
          {status === "loading" && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Carregando emails...</p>
            </div>
          )}

          {/* Idle state - ready to validate */}
          {status === "idle" && (
            <div className="space-y-6">
              <Card className="p-6 bg-muted/30">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Mail className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{emails.length.toLocaleString("pt-BR")}</p>
                    <p className="text-sm text-muted-foreground">emails para validar</p>
                  </div>
                </div>
              </Card>

              <div className="space-y-2">
                <h4 className="text-sm font-medium">O que será verificado:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Sintaxe do email
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Registros MX do domínio
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Servidor SMTP responde
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Email descartável ou temporário
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Catch-all domains
                  </li>
                </ul>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
                  Cancelar
                </Button>
                <Button onClick={startValidation} className="flex-1" disabled={emails.length === 0}>
                  <Shield className="h-4 w-4 mr-2" />
                  Iniciar Validação
                </Button>
              </div>
            </div>
          )}

          {/* Validating state */}
          {status === "validating" && (
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Validando emails...</span>
                  <span className="font-medium">{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>

              <div className="grid grid-cols-4 gap-3">
                <Card className="p-3 text-center">
                  <CheckCircle className="h-5 w-5 text-green-500 mx-auto mb-1" />
                  <p className="text-lg font-bold">{statusCounts.deliverable}</p>
                  <p className="text-xs text-muted-foreground">Válidos</p>
                </Card>
                <Card className="p-3 text-center">
                  <XCircle className="h-5 w-5 text-destructive mx-auto mb-1" />
                  <p className="text-lg font-bold">{statusCounts.undeliverable}</p>
                  <p className="text-xs text-muted-foreground">Inválidos</p>
                </Card>
                <Card className="p-3 text-center">
                  <AlertTriangle className="h-5 w-5 text-yellow-500 mx-auto mb-1" />
                  <p className="text-lg font-bold">{statusCounts.risky}</p>
                  <p className="text-xs text-muted-foreground">Arriscados</p>
                </Card>
                <Card className="p-3 text-center">
                  <HelpCircle className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
                  <p className="text-lg font-bold">{statusCounts.unknown}</p>
                  <p className="text-xs text-muted-foreground">Desconhecidos</p>
                </Card>
              </div>

              <p className="text-sm text-muted-foreground text-center">
                Processando... Por favor, não feche esta janela.
              </p>
            </div>
          )}

          {/* Completed state */}
          {status === "completed" && summary && (
            <div className="space-y-6">
              <div className="grid grid-cols-4 gap-3">
                <Card className="p-4 text-center bg-green-500/10 border-green-500/20">
                  <CheckCircle className="h-6 w-6 text-green-500 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-green-600">{summary.deliverable}</p>
                  <p className="text-xs text-muted-foreground">Válidos</p>
                </Card>
                <Card className="p-4 text-center bg-destructive/10 border-destructive/20">
                  <XCircle className="h-6 w-6 text-destructive mx-auto mb-2" />
                  <p className="text-2xl font-bold text-destructive">{summary.undeliverable}</p>
                  <p className="text-xs text-muted-foreground">Inválidos</p>
                </Card>
                <Card className="p-4 text-center bg-yellow-500/10 border-yellow-500/20">
                  <AlertTriangle className="h-6 w-6 text-yellow-500 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-yellow-600">{summary.risky}</p>
                  <p className="text-xs text-muted-foreground">Arriscados</p>
                </Card>
                <Card className="p-4 text-center bg-muted">
                  <HelpCircle className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                  <p className="text-2xl font-bold">{summary.unknown}</p>
                  <p className="text-xs text-muted-foreground">Desconhecidos</p>
                </Card>
              </div>

              {/* Results list */}
              {results.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Detalhes ({results.length} emails)</h4>
                  <ScrollArea className="h-[200px] border rounded-lg">
                    <div className="p-2 space-y-1">
                      {results.map((result, i) => (
                        <div key={i} className="flex items-center justify-between py-1.5 px-2 hover:bg-muted/50 rounded text-sm">
                          <div className="flex items-center gap-2 min-w-0">
                            {getStatusIcon(result.status)}
                            <span className="truncate">{result.email}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {result.disposable && (
                              <Badge variant="outline" className="text-xs">Descartável</Badge>
                            )}
                            {result.free && (
                              <Badge variant="outline" className="text-xs">Gratuito</Badge>
                            )}
                            {getStatusBadge(result.status)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => startValidation()} className="flex-1">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Validar Novamente
                </Button>
                <Button onClick={() => onOpenChange(false)} className="flex-1">
                  Fechar
                </Button>
              </div>
            </div>
          )}

          {/* Error state */}
          {status === "error" && (
            <div className="space-y-6">
              <Card className="p-6 bg-destructive/10 border-destructive/20">
                <div className="flex items-center gap-4">
                  <XCircle className="h-8 w-8 text-destructive" />
                  <div>
                    <p className="font-medium text-destructive">Erro na validação</p>
                    <p className="text-sm text-muted-foreground">{errorMessage}</p>
                  </div>
                </div>
              </Card>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
                  Cancelar
                </Button>
                <Button onClick={startValidation} className="flex-1">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Tentar Novamente
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
