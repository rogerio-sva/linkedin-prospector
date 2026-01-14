import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Upload, CheckCircle2, AlertCircle, ListChecks } from "lucide-react";
import { useCRMStages } from "@/hooks/useCRM";
import { useQueryClient } from "@tanstack/react-query";

interface UpdateStagesByListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ProcessResult {
  found: number;
  notFound: string[];
  updated: number;
}

export const UpdateStagesByListDialog = ({
  open,
  onOpenChange,
}: UpdateStagesByListDialogProps) => {
  const [emailList, setEmailList] = useState("");
  const [selectedStage, setSelectedStage] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<ProcessResult | null>(null);

  const { data: stages = [] } = useCRMStages();
  const queryClient = useQueryClient();

  // Parse emails from the pasted text
  const parseEmails = (text: string): string[] => {
    // Split by newlines, commas, semicolons, or spaces
    const parts = text.split(/[\n,;\s]+/);
    
    // Filter valid emails and normalize
    return parts
      .map(e => e.trim().toLowerCase())
      .filter(e => e.includes("@") && e.includes("."));
  };

  const emailCount = parseEmails(emailList).length;

  const handleProcess = async () => {
    if (!selectedStage || emailCount === 0) {
      toast.error("Selecione um estágio e cole a lista de emails");
      return;
    }

    setIsProcessing(true);
    setResult(null);

    try {
      const emails = parseEmails(emailList);
      
      // Search for contacts by email (both personal and corporate)
      // Query in batches to avoid limits
      const batchSize = 100;
      let allContacts: { id: string; email: string | null; personal_email: string | null }[] = [];
      
      for (let i = 0; i < emails.length; i += batchSize) {
        const batch = emails.slice(i, i + batchSize);
        const emailFilter = batch.map(e => `email.ilike.${e},personal_email.ilike.${e}`).join(",");
        
        const { data, error } = await supabase
          .from("contacts")
          .select("id, email, personal_email")
          .or(emailFilter);

        if (error) {
          console.error("Error fetching contacts batch:", error);
          continue;
        }

        if (data) {
          allContacts = [...allContacts, ...data];
        }
      }

      // Create a map of found emails
      const foundEmailsMap = new Map<string, string>(); // email -> contact_id
      allContacts.forEach(c => {
        if (c.email) foundEmailsMap.set(c.email.toLowerCase(), c.id);
        if (c.personal_email) foundEmailsMap.set(c.personal_email.toLowerCase(), c.id);
      });

      // Find which emails were found and which weren't
      const foundContactIds = new Set<string>();
      const notFoundEmails: string[] = [];

      emails.forEach(email => {
        const contactId = foundEmailsMap.get(email);
        if (contactId) {
          foundContactIds.add(contactId);
        } else {
          notFoundEmails.push(email);
        }
      });

      const contactIds = Array.from(foundContactIds);

      if (contactIds.length === 0) {
        setResult({
          found: 0,
          notFound: notFoundEmails,
          updated: 0,
        });
        toast.warning("Nenhum contato encontrado com os emails informados");
        setIsProcessing(false);
        return;
      }

      // Update contacts in batches
      const now = new Date().toISOString();
      const stageName = stages.find(s => s.id === selectedStage)?.name || selectedStage;
      
      // Update crm_stage for all found contacts
      for (let i = 0; i < contactIds.length; i += batchSize) {
        const batch = contactIds.slice(i, i + batchSize);
        
        const { error: updateError } = await supabase
          .from("contacts")
          .update({
            crm_stage: stageName,
            last_activity_at: now,
          })
          .in("id", batch);

        if (updateError) {
          console.error("Error updating contacts batch:", updateError);
        }
      }

      // Create activity logs for all updated contacts
      const activities = contactIds.map(id => ({
        contact_id: id,
        activity_type: "stage_changed",
        description: `Estágio alterado para: ${stageName}`,
        performed_by: "Importação manual",
        metadata: { source: "bulk_import" },
      }));

      // Insert activities in batches
      for (let i = 0; i < activities.length; i += batchSize) {
        const batch = activities.slice(i, i + batchSize);
        
        const { error: activityError } = await supabase
          .from("contact_activities")
          .insert(batch);

        if (activityError) {
          console.error("Error creating activities batch:", activityError);
        }
      }

      setResult({
        found: contactIds.length,
        notFound: notFoundEmails,
        updated: contactIds.length,
      });

      // Invalidate queries to refresh the Kanban
      queryClient.invalidateQueries({ queryKey: ["crm-contacts"] });

      toast.success(`${contactIds.length} contatos atualizados para "${stageName}"`);

    } catch (error) {
      console.error("Error processing list:", error);
      toast.error("Erro ao processar a lista");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setEmailList("");
    setSelectedStage("");
    setResult(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListChecks className="h-5 w-5" />
            Atualizar Estágios por Lista
          </DialogTitle>
          <DialogDescription>
            Cole uma lista de emails para mover contatos para um estágio específico do CRM.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Stage selector */}
          <div className="space-y-2">
            <Label>Estágio de Destino</Label>
            <Select value={selectedStage} onValueChange={setSelectedStage}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o estágio" />
              </SelectTrigger>
              <SelectContent>
                {stages.map((stage) => (
                  <SelectItem key={stage.id} value={stage.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: stage.color }}
                      />
                      {stage.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Email list textarea */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Lista de Emails</Label>
              {emailCount > 0 && (
                <Badge variant="secondary">{emailCount} emails detectados</Badge>
              )}
            </div>
            <Textarea
              value={emailList}
              onChange={(e) => setEmailList(e.target.value)}
              placeholder="Cole aqui a lista de emails (um por linha, separados por vírgula ou ponto-e-vírgula)..."
              rows={10}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Aceita formatos: um email por linha, separados por vírgula, ponto-e-vírgula ou espaço.
            </p>
          </div>

          {/* Results */}
          {result && (
            <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <span className="font-medium">Processamento Concluído</span>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Encontrados:</span>
                  <span className="ml-2 font-medium">{result.found}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Atualizados:</span>
                  <span className="ml-2 font-medium text-green-600">{result.updated}</span>
                </div>
              </div>

              {result.notFound.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-amber-600">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      {result.notFound.length} emails não encontrados:
                    </span>
                  </div>
                  <div className="max-h-32 overflow-y-auto bg-background p-2 rounded text-xs font-mono">
                    {result.notFound.slice(0, 20).map((email, i) => (
                      <div key={i} className="text-muted-foreground">{email}</div>
                    ))}
                    {result.notFound.length > 20 && (
                      <div className="text-muted-foreground mt-1">
                        ... e mais {result.notFound.length - 20} emails
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {result ? "Fechar" : "Cancelar"}
          </Button>
          {!result && (
            <Button
              onClick={handleProcess}
              disabled={isProcessing || !selectedStage || emailCount === 0}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Processar {emailCount} Emails
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
