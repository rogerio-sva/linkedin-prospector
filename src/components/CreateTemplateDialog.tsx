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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AVAILABLE_VARIABLES } from "@/hooks/useEmailTemplates";

interface CreateTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateTemplate: (name: string, subject: string, body: string) => Promise<any>;
}

export const CreateTemplateDialog = ({
  open,
  onOpenChange,
  onCreateTemplate,
}: CreateTemplateDialogProps) => {
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    if (!name.trim() || !subject.trim() || !body.trim()) return;

    setIsCreating(true);
    const result = await onCreateTemplate(name.trim(), subject.trim(), body.trim());
    setIsCreating(false);

    if (result) {
      setName("");
      setSubject("");
      setBody("");
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
          <DialogTitle>Criar Template de Email</DialogTitle>
          <DialogDescription>
            Crie um template reutilizável com variáveis dinâmicas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome do Template</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Primeiro contato"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Assunto</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Ex: Olá {{firstName}}, tenho uma proposta para você"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="body">Corpo do Email</Label>
            <Textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Escreva seu email aqui... Use variáveis como {{firstName}}, {{companyName}}, etc."
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
              onClick={handleCreate}
              disabled={!name.trim() || !subject.trim() || !body.trim() || isCreating}
            >
              {isCreating ? "Criando..." : "Criar Template"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
