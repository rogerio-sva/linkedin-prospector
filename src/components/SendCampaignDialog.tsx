import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, Mail, Send, Users, Loader2, CheckCircle2, XCircle, Pause, Play, ShieldCheck, ShieldAlert } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmailTemplate } from "@/hooks/useEmailTemplates";
import { Base } from "@/components/BasesList";
import { LinkedInContact } from "@/types/contact";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SendCampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: EmailTemplate[];
  bases: Base[];
  contacts: LinkedInContact[];
  selectedContacts: string[];
  selectedBaseId: string | null;
}

interface BatchProgress {
  currentBatch: number;
  totalBatches: number;
  sentEmails: number;
  totalEmails: number;
  failedEmails: number;
  suppressedEmails: number;
  invalidEmails: number;
  status: "idle" | "sending" | "paused" | "completed" | "error";
  currentBatchStatus: string;
  errors: string[];
}

const BATCH_SIZE = 350; // Safe batch size to avoid timeout

export const SendCampaignDialog = ({
  open,
  onOpenChange,
  templates,
  bases,
  contacts: initialContacts,
  selectedContacts: initialSelectedContacts,
  selectedBaseId: initialBaseId,
}: SendCampaignDialogProps) => {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [selectedSendBaseId, setSelectedSendBaseId] = useState<string>(initialBaseId || "");
  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [sendToSelected, setSendToSelected] = useState(initialSelectedContacts.length > 0);
  const [emailType, setEmailType] = useState<"personal" | "corporate" | "both">("personal");
  const [emailFormat, setEmailFormat] = useState<"text" | "html">("text");
  
  // State for loaded contacts when base is selected in dialog
  const [loadedContacts, setLoadedContacts] = useState<LinkedInContact[]>([]);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  
  // Email validation stats
  const [validationStats, setValidationStats] = useState<{
    undeliverable: number;
    risky: number;
    unknown: number;
    deliverable: number;
  }>({ undeliverable: 0, risky: 0, unknown: 0, deliverable: 0 });
  const [alreadySentCount, setAlreadySentCount] = useState(0);

  // Batch sending state
  const [batchProgress, setBatchProgress] = useState<BatchProgress>({
    currentBatch: 0,
    totalBatches: 0,
    sentEmails: 0,
    totalEmails: 0,
    failedEmails: 0,
    suppressedEmails: 0,
    invalidEmails: 0,
    status: "idle",
    currentBatchStatus: "",
    errors: [],
  });
  const [isPaused, setIsPaused] = useState(false);
  const [campaignId, setCampaignId] = useState<string | null>(null);

  // Use initial contacts if provided, otherwise use loaded contacts
  const contacts = initialContacts.length > 0 ? initialContacts : loadedContacts;
  const selectedContacts = initialSelectedContacts;

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);
  const selectedBase = bases.find((b) => b.id === selectedSendBaseId);

  // Load contacts when base is selected and filter out already sent
  useEffect(() => {
    const loadBaseContacts = async () => {
      if (!selectedSendBaseId || initialContacts.length > 0) {
        setLoadedContacts([]);
        setAlreadySentCount(0);
        return;
      }

      setIsLoadingContacts(true);
      try {
        // Get all contacts from base - explicitly set no limit (Supabase defaults to 1000)
        let allContacts: any[] = [];
        let offset = 0;
        const pageSize = 1000;
        
        while (true) {
          const { data: batch, error: contactsError } = await supabase
            .from("contacts")
            .select("*")
            .eq("base_id", selectedSendBaseId)
            .range(offset, offset + pageSize - 1);

          if (contactsError) throw contactsError;
          
          if (!batch || batch.length === 0) break;
          
          allContacts = [...allContacts, ...batch];
          
          if (batch.length < pageSize) break;
          offset += pageSize;
        }


        // Get all contact IDs from this base that have received emails
        // Using a simpler query that doesn't hit the .in() limit
        const contactIds = (allContacts || []).map(c => c.id);
        
        // Query in batches of 100 to avoid Bad Request
        const batchSize = 100;
        const alreadySentIds = new Set<string>();
        
        for (let i = 0; i < contactIds.length; i += batchSize) {
          const batch = contactIds.slice(i, i + batchSize);
          const { data: sentEmails, error: sentError } = await supabase
            .from("email_sends")
            .select("contact_id")
            .in("contact_id", batch);

          if (sentError) {
            console.error("Error fetching sent emails batch:", sentError);
            continue;
          }

          (sentEmails || []).forEach(e => alreadySentIds.add(e.contact_id));
        }
        
        setAlreadySentCount(alreadySentIds.size);

        // Filter out contacts that already received emails
        const unsnetContacts = (allContacts || []).filter(c => !alreadySentIds.has(c.id));

        const mappedContacts: LinkedInContact[] = unsnetContacts.map((contact) => ({
          id: contact.id,
          firstName: contact.first_name || "",
          lastName: contact.last_name || "",
          fullName: contact.full_name || "",
          email: contact.email || undefined,
          personalEmail: contact.personal_email || undefined,
          mobileNumber: contact.mobile_number || undefined,
          companyPhone: contact.company_phone || undefined,
          jobTitle: contact.job_title || undefined,
          companyName: contact.company_name || undefined,
          companyWebsite: contact.company_website || undefined,
          industry: contact.industry || undefined,
          seniorityLevel: contact.seniority_level || undefined,
          city: contact.city || undefined,
          state: contact.state || undefined,
          country: contact.country || undefined,
          linkedin: contact.linkedin_url || undefined,
          createdAt: new Date(contact.created_at),
        }));

        setLoadedContacts(mappedContacts);
      } catch (error) {
        console.error("Error loading base contacts:", error);
        toast.error("Erro ao carregar contatos da base");
      } finally {
        setIsLoadingContacts(false);
      }
    };

    loadBaseContacts();
  }, [selectedSendBaseId, initialContacts.length]);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      setSelectedSendBaseId(initialBaseId || "");
      setSendToSelected(initialSelectedContacts.length > 0);
      if (initialContacts.length === 0) {
        setLoadedContacts([]);
      }
      // Reset batch progress
      setBatchProgress({
        currentBatch: 0,
        totalBatches: 0,
        sentEmails: 0,
        totalEmails: 0,
        failedEmails: 0,
        suppressedEmails: 0,
        invalidEmails: 0,
        status: "idle",
        currentBatchStatus: "",
        errors: [],
      });
      setIsPaused(false);
      setCampaignId(null);
      setValidationStats({ undeliverable: 0, risky: 0, unknown: 0, deliverable: 0 });
    }
  }, [open, initialBaseId, initialSelectedContacts.length, initialContacts.length]);

  const contactsWithEmail = useMemo(() => {
    const baseContacts = sendToSelected
      ? contacts.filter((c) => selectedContacts.includes(c.id))
      : contacts;
    
    return baseContacts.filter((c) => {
      if (emailType === "personal") return c.personalEmail;
      if (emailType === "corporate") return c.email;
      return c.email || c.personalEmail;
    });
  }, [contacts, selectedContacts, sendToSelected, emailType]);

  // Load validation stats when contacts change
  useEffect(() => {
    const loadValidationStats = async () => {
      if (contactsWithEmail.length === 0) {
        setValidationStats({ undeliverable: 0, risky: 0, unknown: 0, deliverable: 0 });
        return;
      }

      const emails = contactsWithEmail.map(c => {
        if (emailType === "personal") return c.personalEmail;
        if (emailType === "corporate") return c.email;
        return c.personalEmail || c.email;
      }).filter(Boolean) as string[];

      // Query in batches to avoid URL length limits
      const batchSize = 100;
      let allValidations: { email: string; status: string }[] = [];

      for (let i = 0; i < emails.length; i += batchSize) {
        const batch = emails.slice(i, i + batchSize);
        const { data, error } = await supabase
          .from("email_validations")
          .select("email, status")
          .in("email", batch);

        if (!error && data) {
          allValidations = [...allValidations, ...data];
        }
      }

      const stats = {
        undeliverable: allValidations.filter(v => v.status === "undeliverable").length,
        risky: allValidations.filter(v => v.status === "risky").length,
        unknown: allValidations.filter(v => v.status === "unknown").length,
        deliverable: allValidations.filter(v => v.status === "deliverable").length,
      };

      setValidationStats(stats);
    };

    loadValidationStats();
  }, [contactsWithEmail, emailType]);

  // Split contacts into batches
  const batches = useMemo(() => {
    const result: LinkedInContact[][] = [];
    for (let i = 0; i < contactsWithEmail.length; i += BATCH_SIZE) {
      result.push(contactsWithEmail.slice(i, i + BATCH_SIZE));
    }
    return result;
  }, [contactsWithEmail]);

  const handleSend = async () => {
    if (!selectedTemplateId || !selectedSendBaseId || !fromEmail.trim() || !fromName.trim()) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    if (contactsWithEmail.length === 0) {
      toast.error("Nenhum contato com email válido para enviar");
      return;
    }

    // Initialize progress
    setBatchProgress({
      currentBatch: 0,
      totalBatches: batches.length,
      sentEmails: 0,
      totalEmails: contactsWithEmail.length,
      failedEmails: 0,
      suppressedEmails: 0,
      invalidEmails: 0,
      status: "sending",
      currentBatchStatus: "Iniciando campanha...",
      errors: [],
    });

    let currentCampaignId = campaignId;

    try {
      // Create campaign first if not exists
      if (!currentCampaignId) {
        const { data: campaign, error: campaignError } = await supabase
          .from("email_campaigns")
          .insert({
            name: `Campanha - ${selectedTemplate?.name} - ${new Date().toLocaleDateString("pt-BR")}`,
            template_id: selectedTemplateId,
            base_id: selectedSendBaseId,
            status: "sending",
            total_recipients: contactsWithEmail.length,
          })
          .select()
          .single();

        if (campaignError) {
          throw new Error("Erro ao criar campanha");
        }
        currentCampaignId = campaign.id;
        setCampaignId(currentCampaignId);
      }

      // Send batches sequentially
      let totalSent = 0;
      let totalFailed = 0;
      let totalSuppressed = 0;
      let totalInvalid = 0;
      const allErrors: string[] = [];

      for (let i = 0; i < batches.length; i++) {
        // Check if paused
        if (isPaused) {
          setBatchProgress(prev => ({
            ...prev,
            status: "paused",
            currentBatchStatus: `Pausado no lote ${i + 1}`,
          }));
          return;
        }

        const batch = batches[i];
        const batchContactIds = batch.map(c => c.id);

        setBatchProgress(prev => ({
          ...prev,
          currentBatch: i + 1,
          currentBatchStatus: `Enviando lote ${i + 1} de ${batches.length} (${batch.length} emails)...`,
        }));

        try {
          const { data, error } = await supabase.functions.invoke("send-campaign-emails", {
            body: {
              templateId: selectedTemplateId,
              baseId: selectedSendBaseId,
              fromEmail: fromEmail.trim(),
              fromName: fromName.trim(),
              replyTo: replyTo.trim() || undefined,
              emailType: emailType,
              emailFormat: emailFormat,
              contactIds: batchContactIds,
              campaignId: currentCampaignId,
              batchMode: true, // Tell the function to process synchronously
            },
          });

          if (error) {
            throw new Error(error.message || "Erro ao enviar lote");
          }

          if (!data.success) {
            throw new Error(data.error || "Erro desconhecido");
          }

          totalSent += data.sent || 0;
          totalFailed += data.failed || 0;
          totalSuppressed += data.suppressed || 0;
          totalInvalid += data.invalidEmails || 0;
          
          if (data.errors && data.errors.length > 0) {
            allErrors.push(...data.errors);
          }

          setBatchProgress(prev => ({
            ...prev,
            sentEmails: totalSent,
            failedEmails: totalFailed,
            suppressedEmails: totalSuppressed,
            invalidEmails: totalInvalid,
            errors: allErrors,
          }));

          // Small delay between batches
          if (i < batches.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (batchError: any) {
          console.error(`Error in batch ${i + 1}:`, batchError);
          allErrors.push(`Lote ${i + 1}: ${batchError.message}`);
          
          setBatchProgress(prev => ({
            ...prev,
            errors: allErrors,
          }));
          
          // Continue to next batch despite error
        }
      }

      // Update campaign status
      await supabase
        .from("email_campaigns")
        .update({ 
          status: totalFailed === contactsWithEmail.length ? "failed" : "completed",
          sent_at: new Date().toISOString() 
        })
        .eq("id", currentCampaignId);

      const suppressedMsg = totalSuppressed > 0 ? `, ${totalSuppressed} suprimidos` : "";
      const invalidMsg = totalInvalid > 0 ? `, ${totalInvalid} inválidos` : "";
      setBatchProgress(prev => ({
        ...prev,
        status: "completed",
        currentBatchStatus: `Concluído! ${totalSent} enviados, ${totalFailed} falhas${suppressedMsg}${invalidMsg}.`,
      }));

      toast.success(`Campanha concluída! ${totalSent} emails enviados.`);

    } catch (error: any) {
      console.error("Send campaign error:", error);
      setBatchProgress(prev => ({
        ...prev,
        status: "error",
        currentBatchStatus: error.message || "Erro ao enviar campanha",
      }));
      toast.error(error.message || "Erro ao enviar campanha");
    }
  };

  const handlePauseResume = () => {
    if (isPaused) {
      setIsPaused(false);
      // Resume sending from current batch
      handleSend();
    } else {
      setIsPaused(true);
    }
  };

  const isSending = batchProgress.status === "sending";
  const isCompleted = batchProgress.status === "completed";
  const progressPercent = batchProgress.totalEmails > 0 
    ? Math.round((batchProgress.sentEmails / batchProgress.totalEmails) * 100) 
    : 0;

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      if (!newOpen && isSending) {
        toast.warning("Campanha em andamento. Pause antes de fechar.");
        return;
      }
      onOpenChange(newOpen);
    }}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Enviar Campanha de Email
          </DialogTitle>
          <DialogDescription>
            Configure e envie emails em massa para os contatos selecionados.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Progress UI when sending */}
          {(isSending || isCompleted || batchProgress.status === "paused" || batchProgress.status === "error") && (
            <Card className="p-4 bg-muted/50">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">
                    {batchProgress.status === "completed" ? (
                      <span className="flex items-center gap-2 text-green-600">
                        <CheckCircle2 className="h-4 w-4" />
                        Campanha Concluída
                      </span>
                    ) : batchProgress.status === "error" ? (
                      <span className="flex items-center gap-2 text-destructive">
                        <XCircle className="h-4 w-4" />
                        Erro na Campanha
                      </span>
                    ) : batchProgress.status === "paused" ? (
                      <span className="flex items-center gap-2 text-amber-600">
                        <Pause className="h-4 w-4" />
                        Campanha Pausada
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Enviando Emails...
                      </span>
                    )}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {batchProgress.sentEmails} / {batchProgress.totalEmails}
                  </span>
                </div>
                
                <Progress value={progressPercent} className="h-2" />
                
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{batchProgress.currentBatchStatus}</span>
                  <span>
                    Lote {batchProgress.currentBatch} de {batchProgress.totalBatches}
                  </span>
                </div>

                {batchProgress.suppressedEmails > 0 && (
                  <p className="text-xs text-amber-600">
                    {batchProgress.suppressedEmails} emails suprimidos (bounces/complaints)
                  </p>
                )}

                {batchProgress.invalidEmails > 0 && (
                  <p className="text-xs text-orange-600">
                    {batchProgress.invalidEmails} emails inválidos bloqueados (validação)
                  </p>
                )}

                {batchProgress.failedEmails > 0 && (
                  <p className="text-xs text-destructive">
                    {batchProgress.failedEmails} emails falharam
                  </p>
                )}

                {isSending && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePauseResume}
                    className="w-full"
                  >
                    <Pause className="h-4 w-4 mr-2" />
                    Pausar Envio
                  </Button>
                )}

                {batchProgress.status === "paused" && (
                  <Button
                    size="sm"
                    onClick={handlePauseResume}
                    className="w-full"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Continuar Envio
                  </Button>
                )}

                {isCompleted && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onOpenChange(false)}
                    className="w-full"
                  >
                    Fechar
                  </Button>
                )}
              </div>
            </Card>
          )}

          {/* Template Selection */}
          <div className="space-y-2">
            <Label>Template de Email *</Label>
            <Select 
              value={selectedTemplateId} 
              onValueChange={setSelectedTemplateId}
              disabled={isSending}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um template" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    <div className="flex items-center gap-2">
                      <Mail className="h-3 w-3" />
                      <span>{template.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {templates.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Crie um template primeiro antes de enviar uma campanha.
              </p>
            )}
          </div>

          {/* Base Selection */}
          <div className="space-y-2">
            <Label>Base de Contatos *</Label>
            <Select 
              value={selectedSendBaseId} 
              onValueChange={setSelectedSendBaseId}
              disabled={isSending}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma base" />
              </SelectTrigger>
              <SelectContent>
                {bases.map((base) => (
                  <SelectItem key={base.id} value={base.id}>
                    <div className="flex items-center gap-2">
                      <Users className="h-3 w-3" />
                      <span>{base.name}</span>
                      <Badge variant="secondary" className="text-xs">
                        {base.contact_count} contatos
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Email Type Selection */}
          <div className="space-y-2">
            <Label>Tipo de Email para Envio *</Label>
            <Select 
              value={emailType} 
              onValueChange={(v: "personal" | "corporate" | "both") => setEmailType(v)}
              disabled={isSending}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="personal">
                  <div className="flex items-center gap-2">
                    <Mail className="h-3 w-3" />
                    <span>Email Pessoal</span>
                  </div>
                </SelectItem>
                <SelectItem value="corporate">
                  <div className="flex items-center gap-2">
                    <Mail className="h-3 w-3" />
                    <span>Email Corporativo</span>
                  </div>
                </SelectItem>
                <SelectItem value="both">
                  <div className="flex items-center gap-2">
                    <Mail className="h-3 w-3" />
                    <span>Ambos (prioridade pessoal)</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {emailType === "both" 
                ? "Envia para email pessoal, ou corporativo se não tiver pessoal."
                : `Envia apenas para contatos com email ${emailType === "personal" ? "pessoal" : "corporativo"}.`}
            </p>
          </div>

          {/* Email Format Selection */}
          <div className="space-y-2">
            <Label>Formato do Email *</Label>
            <Select 
              value={emailFormat} 
              onValueChange={(v: "text" | "html") => setEmailFormat(v)}
              disabled={isSending}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">
                  <div className="flex items-center gap-2">
                    <Mail className="h-3 w-3" />
                    <span>Texto Puro (Recomendado)</span>
                  </div>
                </SelectItem>
                <SelectItem value="html">
                  <div className="flex items-center gap-2">
                    <Mail className="h-3 w-3" />
                    <span>HTML Formatado</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {emailFormat === "text" 
                ? "✓ Texto puro tem maior chance de chegar na caixa de entrada principal."
                : "⚠️ HTML pode ser classificado como promoção pelo Gmail."}
            </p>
          </div>

          {/* Send to selected or all */}
          {selectedContacts.length > 0 && (
            <Card className="p-3 bg-muted/50">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="sendToSelected"
                  checked={sendToSelected}
                  onChange={(e) => setSendToSelected(e.target.checked)}
                  className="rounded"
                  disabled={isSending}
                />
                <Label htmlFor="sendToSelected" className="cursor-pointer text-sm">
                  Enviar apenas para os {selectedContacts.length} contatos selecionados
                </Label>
              </div>
            </Card>
          )}

          {/* From Email */}
          <div className="space-y-2">
            <Label htmlFor="fromEmail">Email Remetente *</Label>
            <Input
              id="fromEmail"
              type="email"
              value={fromEmail}
              onChange={(e) => setFromEmail(e.target.value)}
              placeholder="seu@dominio.com"
              disabled={isSending}
            />
            <p className="text-xs text-muted-foreground">
              Use um email do seu domínio verificado no Resend.
            </p>
          </div>

          {/* From Name */}
          <div className="space-y-2">
            <Label htmlFor="fromName">Nome do Remetente *</Label>
            <Input
              id="fromName"
              value={fromName}
              onChange={(e) => setFromName(e.target.value)}
              placeholder="Ex: João da Empresa XYZ"
              disabled={isSending}
            />
          </div>

          {/* Reply-To Email */}
          <div className="space-y-2">
            <Label htmlFor="replyTo">Email para Respostas (Reply-To)</Label>
            <Input
              id="replyTo"
              type="email"
              value={replyTo}
              onChange={(e) => setReplyTo(e.target.value)}
              placeholder="respostas@dominio.com (opcional)"
              disabled={isSending}
            />
            <p className="text-xs text-muted-foreground">
              Se preenchido, respostas serão enviadas para este email. Se vazio, usa o email remetente.
            </p>
          </div>

          {/* Summary */}
          <Card className="p-4 bg-muted/50">
            <h4 className="font-medium text-sm mb-2">Resumo da Campanha</h4>
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>
                <strong>Template:</strong> {selectedTemplate?.name || "Não selecionado"}
              </p>
              <p>
                <strong>Base:</strong> {selectedBase?.name || "Não selecionada"}
              </p>
              <p>
                <strong>Total na base:</strong>{" "}
                {isLoadingContacts ? (
                  <span className="inline-flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Carregando...
                  </span>
                ) : (
                  <span className="text-foreground font-medium">
                    {contacts.length + alreadySentCount}
                  </span>
                )}
              </p>
              {alreadySentCount > 0 && (
                <p className="text-amber-600 dark:text-amber-400">
                  <strong>Já receberam email:</strong>{" "}
                  <span className="font-medium">{alreadySentCount}</span>
                  <span className="text-xs ml-1">(excluídos automaticamente)</span>
                </p>
              )}
              <p>
                <strong>Pendentes de envio:</strong>{" "}
                {isLoadingContacts ? (
                  <span className="text-muted-foreground">-</span>
                ) : (
                  <span className="text-foreground font-medium">{contacts.length}</span>
                )}
              </p>
              <p>
                <strong>Com email válido:</strong>{" "}
                {isLoadingContacts ? (
                  <span className="text-muted-foreground">-</span>
                ) : (
                  <span className="text-foreground font-medium">
                    {contactsWithEmail.length}
                  </span>
                )}
              </p>
              {batches.length > 1 && (
                <p className="text-blue-600 dark:text-blue-400">
                  <strong>Lotes:</strong>{" "}
                  <span className="font-medium">{batches.length} lotes</span>
                  <span className="text-xs ml-1">({BATCH_SIZE} emails por lote)</span>
                </p>
              )}
            </div>
          </Card>

          {/* Email Validation Status */}
          {(validationStats.undeliverable > 0 || validationStats.risky > 0 || validationStats.deliverable > 0) && (
            <Card className="p-3 border-green-500/50 bg-green-500/10">
              <div className="flex gap-2">
                <ShieldCheck className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <p className="font-medium text-green-700 dark:text-green-400">
                    Status de Validação de Emails
                  </p>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground">
                    {validationStats.deliverable > 0 && (
                      <span className="text-green-600">{validationStats.deliverable} válidos</span>
                    )}
                    {validationStats.undeliverable > 0 && (
                      <span className="text-red-600">{validationStats.undeliverable} inválidos (bloqueados)</span>
                    )}
                    {validationStats.risky > 0 && (
                      <span className="text-amber-600">{validationStats.risky} arriscados</span>
                    )}
                    {validationStats.unknown > 0 && (
                      <span className="text-gray-600">{validationStats.unknown} não verificados</span>
                    )}
                  </div>
                  {validationStats.undeliverable > 0 && (
                    <p className="text-green-700 dark:text-green-400 mt-1">
                      ✓ Emails inválidos serão bloqueados automaticamente
                    </p>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* Warning */}
          <Card className="p-3 border-amber-500/50 bg-amber-500/10">
            <div className="flex gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Certifique-se de que o domínio do email remetente está verificado no Resend.
                Emails enviados de domínios não verificados podem falhar ou ir para spam.
              </p>
            </div>
          </Card>

          <div className="flex justify-end gap-2 pt-2">
            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={isSending}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSend}
              disabled={
                !selectedTemplateId ||
                !selectedSendBaseId ||
                !fromEmail.trim() ||
                !fromName.trim() ||
                contactsWithEmail.length === 0 ||
                isSending ||
                isCompleted
              }
            >
              <Send className="h-4 w-4 mr-2" />
              Enviar {contactsWithEmail.length} Email{contactsWithEmail.length !== 1 ? "s" : ""}
              {batches.length > 1 && ` (${batches.length} lotes)`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
