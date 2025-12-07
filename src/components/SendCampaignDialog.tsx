import { useState } from "react";
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
import { AlertTriangle, Mail, Send, Users } from "lucide-react";
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

export const SendCampaignDialog = ({
  open,
  onOpenChange,
  templates,
  bases,
  contacts,
  selectedContacts,
  selectedBaseId,
}: SendCampaignDialogProps) => {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [selectedSendBaseId, setSelectedSendBaseId] = useState<string>(selectedBaseId || "");
  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendToSelected, setSendToSelected] = useState(selectedContacts.length > 0);
  const [emailType, setEmailType] = useState<"personal" | "corporate" | "both">("personal");

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);
  const selectedBase = bases.find((b) => b.id === selectedSendBaseId);

  const getContactsWithEmail = () => {
    const baseContacts = sendToSelected
      ? contacts.filter((c) => selectedContacts.includes(c.id))
      : contacts;
    
    return baseContacts.filter((c) => {
      if (emailType === "personal") return c.personalEmail;
      if (emailType === "corporate") return c.email;
      return c.email || c.personalEmail;
    });
  };

  const contactsWithEmail = getContactsWithEmail();

  const handleSend = async () => {
    if (!selectedTemplateId || !selectedSendBaseId || !fromEmail.trim() || !fromName.trim()) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    if (contactsWithEmail.length === 0) {
      toast.error("Nenhum contato com email válido para enviar");
      return;
    }

    setIsSending(true);

    try {
      const payload: any = {
        templateId: selectedTemplateId,
        baseId: selectedSendBaseId,
        fromEmail: fromEmail.trim(),
        fromName: fromName.trim(),
        emailType: emailType,
      };

      if (sendToSelected && selectedContacts.length > 0) {
        payload.contactIds = selectedContacts;
      }

      const { data, error } = await supabase.functions.invoke("send-campaign-emails", {
        body: payload,
      });

      if (error) {
        throw new Error(error.message || "Erro ao enviar campanha");
      }

      if (!data.success) {
        throw new Error(data.error || "Erro desconhecido");
      }

      toast.success(
        `Campanha enviada! ${data.results.sent} emails enviados, ${data.results.failed} falharam.`
      );
      onOpenChange(false);
    } catch (error: any) {
      console.error("Send campaign error:", error);
      toast.error(error.message || "Erro ao enviar campanha");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
          {/* Template Selection */}
          <div className="space-y-2">
            <Label>Template de Email *</Label>
            <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
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
            <Select value={selectedSendBaseId} onValueChange={setSelectedSendBaseId}>
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
            <Select value={emailType} onValueChange={(v: "personal" | "corporate" | "both") => setEmailType(v)}>
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
            />
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
                <strong>Contatos com email:</strong>{" "}
                <span className="text-foreground font-medium">
                  {contactsWithEmail.length}
                </span>
              </p>
            </div>
          </Card>

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

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
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
                isSending
              }
            >
              {isSending ? (
                "Enviando..."
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Enviar {contactsWithEmail.length} Email{contactsWithEmail.length !== 1 ? "s" : ""}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
