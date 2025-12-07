import { useState, useEffect } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { EmailTemplate, AVAILABLE_VARIABLES } from "@/hooks/useEmailTemplates";

interface EditTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: EmailTemplate | null;
  onUpdateTemplate: (
    id: string,
    name: string,
    subject: string,
    body: string
  ) => Promise<boolean>;
}

export const EditTemplateDialog = ({
  open,
  onOpenChange,
  template,
  onUpdateTemplate,
}: EditTemplateDialogProps) => {
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (template) {
      setName(template.name);
      setSubject(template.subject);
      setBody(template.body);
    }
  }, [template]);

  const handleUpdate = async () => {
    if (!template || !name.trim() || !subject.trim() || !body.trim()) return;

    setIsUpdating(true);
    const success = await onUpdateTemplate(
      template.id,
      name.trim(),
      subject.trim(),
      body.trim()
    );
    setIsUpdating(false);

    if (success) {
      onOpenChange(false);
    }
  };

  const insertVariable = (variable: string, field: "subject" | "body") => {
    const varText = `{{${variable}}}`;
    if (field === "subject") {
      setSubject((prev) => prev + varText);
    } else {
      setBody((prev) => prev + varText);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Editar Template</DialogTitle>
          <DialogDescription>
            Atualize o template de email.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Nome do Template</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Primeiro contato"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-subject">Assunto</Label>
            <Input
              id="edit-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Ex: Olá {{firstName}}, tenho uma proposta para você"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-body">Corpo do Email</Label>
            <Textarea
              id="edit-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Escreva seu email aqui..."
              rows={8}
              className="resize-none"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              Variáveis disponíveis (clique para inserir no corpo)
            </Label>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_VARIABLES.map((variable) => (
                <Badge
                  key={variable.key}
                  variant="outline"
                  className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                  onClick={() => insertVariable(variable.key, "body")}
                >
                  {`{{${variable.key}}}`}
                  <span className="ml-1 text-muted-foreground text-xs">
                    ({variable.label})
                  </span>
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={!name.trim() || !subject.trim() || !body.trim() || isUpdating}
            >
              {isUpdating ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
