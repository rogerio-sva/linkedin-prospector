import { useCallback, useMemo, useState } from "react";
import { FileSpreadsheet, Loader2, Upload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { parseXLSFile, cleanEmail, ParsedRow } from "@/lib/importUtils";
import { supabase } from "@/integrations/supabase/client";

type Step = "upload" | "review" | "running";

type PreviewResult = {
  emailsReceived: number;
  validEmails: number;
  uniqueEmails: number;
  matchedContacts: number;
  notFoundEmails: number;
  sampleNotFoundEmails: string[];
};

interface RemoveContactsByCSVDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetBaseId: string | null;
  targetBaseName?: string;
  onCompleted?: () => void;
}

const detectEmailHeader = (headers: string[]): string | null => {
  const candidates = headers.filter((h) => /e.?mail/i.test(h));
  return candidates[0] ?? null;
};

export function RemoveContactsByCSVDialog({
  open,
  onOpenChange,
  targetBaseId,
  targetBaseName,
  onCompleted,
}: RemoveContactsByCSVDialogProps) {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [emailHeader, setEmailHeader] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<PreviewResult | null>(null);

  const reset = () => {
    setStep("upload");
    setFile(null);
    setHeaders([]);
    setRows([]);
    setEmailHeader("");
    setIsDragging(false);
    setPreview(null);
  };

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) reset();
    onOpenChange(nextOpen);
  };

  const computedEmails = useMemo(() => {
    if (!emailHeader) return [] as string[];
    const emails = rows
      .map((r) => cleanEmail(r[emailHeader] !== undefined ? String(r[emailHeader]) : null))
      .filter((e): e is string => Boolean(e));
    return [...new Set(emails)];
  }, [rows, emailHeader]);

  const parseFile = async (selectedFile: File) => {
    try {
      const parsed = await parseXLSFile(selectedFile);
      setHeaders(parsed.headers);
      setRows(parsed.rows);
      const detected = detectEmailHeader(parsed.headers);
      setEmailHeader(detected ?? "");
      setStep("review");
    } catch (e) {
      console.error(e);
      toast.error("Erro ao ler arquivo. Verifique se é um CSV/XLSX válido.");
    }
  };

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile);
    await parseFile(selectedFile);
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const droppedFile = e.dataTransfer.files?.[0];
      if (!droppedFile) return;
      if (!/\.(xlsx?|csv)$/i.test(droppedFile.name)) {
        toast.error("Envie um arquivo .csv, .xls ou .xlsx");
        return;
      }
      void handleFileSelect(droppedFile);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const runPreview = async () => {
    if (!targetBaseId) {
      toast.error("Selecione uma base para limpar.");
      return;
    }
    if (!emailHeader) {
      toast.error("Selecione a coluna de e-mail.");
      return;
    }
    if (computedEmails.length === 0) {
      toast.error("Não encontrei nenhum e-mail válido no arquivo.");
      return;
    }

    setStep("running");
    try {
      const { data, error } = await supabase.functions.invoke("remove-contacts-by-email", {
        body: {
          targetBaseId,
          emails: computedEmails,
          dryRun: true,
          alsoMatchPersonalEmail: true,
        },
      });
      if (error) throw error;

      setPreview({
        emailsReceived: data?.emailsReceived ?? computedEmails.length,
        validEmails: data?.validEmails ?? computedEmails.length,
        uniqueEmails: data?.uniqueEmails ?? computedEmails.length,
        matchedContacts: data?.matchedContacts ?? 0,
        notFoundEmails: data?.notFoundEmails ?? 0,
        sampleNotFoundEmails: data?.sampleNotFoundEmails ?? [],
      });

      setStep("review");
    } catch (e) {
      console.error(e);
      toast.error("Falha ao gerar preview. Tente novamente.");
      setStep("review");
    }
  };

  const executeDelete = async () => {
    if (!targetBaseId) return;
    if (computedEmails.length === 0) return;

    setStep("running");
    try {
      const { data, error } = await supabase.functions.invoke("remove-contacts-by-email", {
        body: {
          targetBaseId,
          emails: computedEmails,
          dryRun: false,
          alsoMatchPersonalEmail: true,
        },
      });
      if (error) throw error;

      const deleted = data?.deletedContacts ?? 0;
      toast.success(
        `${deleted.toLocaleString("pt-BR")} contato${deleted !== 1 ? "s" : ""} removido${deleted !== 1 ? "s" : ""} da base.`
      );

      onCompleted?.();
      handleClose(false);
    } catch (e) {
      console.error(e);
      toast.error("Falha ao remover contatos. Tente novamente.");
      setStep("review");
    }
  };

  const isBusy = step === "running";
  const previewRows = useMemo(() => rows.slice(0, 5), [rows]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Limpar base por CSV (inscritos)
          </DialogTitle>
          <DialogDescription>
            {targetBaseName ? `Remove contatos da base “${targetBaseName}” comparando por e-mail.` : "Remove contatos de uma base comparando por e-mail."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {step === "upload" && (
            <div
              className={`border-2 border-dashed rounded-lg p-10 text-center transition-colors ${
                isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
              }`}
              onDrop={handleDrop}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setIsDragging(false);
              }}
            >
              <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
              <p className="text-base font-medium mb-1">Arraste e solte o CSV aqui</p>
              <p className="text-sm text-muted-foreground mb-4">ou clique para selecionar</p>

              <Input
                type="file"
                accept=".csv,.xls,.xlsx"
                className="hidden"
                id="remove-csv-upload"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleFileSelect(f);
                }}
              />
              <Button asChild variant="outline">
                <label htmlFor="remove-csv-upload" className="cursor-pointer">
                  Selecionar arquivo
                </label>
              </Button>

              {file && <p className="text-xs text-muted-foreground mt-3">Arquivo: {file.name}</p>}
            </div>
          )}

          {step !== "upload" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Coluna de e-mail no arquivo</Label>
                  <Select value={emailHeader} onValueChange={setEmailHeader}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a coluna" />
                    </SelectTrigger>
                    <SelectContent>
                      {headers.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h || "(vazio)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Vamos comparar com <span className="font-medium">email</span> e <span className="font-medium">email pessoal</span> dos contatos.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Resumo</Label>
                  <div className="rounded-lg border p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Linhas no arquivo</span>
                      <span className="font-medium">{rows.length.toLocaleString("pt-BR")}</span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-muted-foreground">E-mails únicos (válidos)</span>
                      <span className="font-medium">{computedEmails.length.toLocaleString("pt-BR")}</span>
                    </div>
                    {preview && (
                      <>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-muted-foreground">Contatos que serão removidos</span>
                          <span className="font-medium">{preview.matchedContacts.toLocaleString("pt-BR")}</span>
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-muted-foreground">E-mails não encontrados</span>
                          <span className="font-medium">{preview.notFoundEmails.toLocaleString("pt-BR")}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {preview?.sampleNotFoundEmails?.length ? (
                <div className="space-y-2">
                  <Label>Amostra de e-mails não encontrados</Label>
                  <ScrollArea className="h-[110px] border rounded-lg">
                    <div className="p-3 text-xs text-muted-foreground space-y-1">
                      {preview.sampleNotFoundEmails.map((e) => (
                        <div key={e}>{e}</div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              ) : null}

              <div className="space-y-2">
                <Label>Preview (primeiras 5 linhas)</Label>
                <ScrollArea className="h-[160px] border rounded-lg">
                  <div className="p-3 text-xs text-muted-foreground">
                    {previewRows.length === 0 ? (
                      <div>Nenhuma linha para mostrar.</div>
                    ) : (
                      <pre className="whitespace-pre-wrap">{JSON.stringify(previewRows, null, 2)}</pre>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => handleClose(false)} disabled={isBusy}>
            Cancelar
          </Button>

          {step === "review" && (
            <>
              <Button variant="outline" onClick={runPreview} disabled={isBusy || !targetBaseId}>
                Gerar preview
              </Button>
              <Button
                onClick={executeDelete}
                disabled={isBusy || !targetBaseId || computedEmails.length === 0 || (preview ? preview.matchedContacts === 0 : false)}
              >
                Remover da base
              </Button>
            </>
          )}

          {step === "running" && (
            <Button disabled>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processando...
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
