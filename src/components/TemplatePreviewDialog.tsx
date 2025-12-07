import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmailTemplate, AVAILABLE_VARIABLES } from "@/hooks/useEmailTemplates";
import { LinkedInContact } from "@/types/contact";
import { User, Mail, Building2 } from "lucide-react";

interface TemplatePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: EmailTemplate | null;
  contacts: LinkedInContact[];
  renderTemplate: (
    template: EmailTemplate,
    contact: LinkedInContact
  ) => { subject: string; body: string };
}

export const TemplatePreviewDialog = ({
  open,
  onOpenChange,
  template,
  contacts,
  renderTemplate,
}: TemplatePreviewDialogProps) => {
  const [selectedContactId, setSelectedContactId] = useState<string>("");

  const selectedContact = useMemo(
    () => contacts.find((c) => c.id === selectedContactId),
    [contacts, selectedContactId]
  );

  const preview = useMemo(() => {
    if (!template) return null;

    if (selectedContact) {
      return renderTemplate(template, selectedContact);
    }

    // Create example preview with placeholder data
    const exampleContact: LinkedInContact = {
      id: "example",
      firstName: "João",
      lastName: "Silva",
      fullName: "João Silva",
      companyName: "Empresa XYZ",
      jobTitle: "Diretor de Marketing",
      email: "joao@empresa.com",
      city: "São Paulo",
      industry: "Tecnologia",
      linkedin: "https://linkedin.com/in/joao-silva",
      createdAt: new Date(),
    };

    return renderTemplate(template, exampleContact);
  }, [template, selectedContact, renderTemplate]);

  if (!template) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>Preview: {template.name}</DialogTitle>
          <DialogDescription>
            Visualize como o email ficará com os dados de um contato.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Contact Selector */}
          <div className="space-y-2">
            <Label>Selecionar Contato para Preview</Label>
            {contacts.length > 0 ? (
              <Select value={selectedContactId} onValueChange={setSelectedContactId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um contato ou veja com dados de exemplo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="example">
                    <span className="text-muted-foreground">
                      Usar dados de exemplo
                    </span>
                  </SelectItem>
                  {contacts.slice(0, 50).map((contact) => (
                    <SelectItem key={contact.id} value={contact.id}>
                      <div className="flex items-center gap-2">
                        <User className="h-3 w-3" />
                        <span>{contact.fullName || contact.firstName}</span>
                        {contact.companyName && (
                          <>
                            <span className="text-muted-foreground">-</span>
                            <span className="text-muted-foreground text-sm">
                              {contact.companyName}
                            </span>
                          </>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhum contato disponível. Visualizando com dados de exemplo.
              </p>
            )}
          </div>

          {/* Selected Contact Info */}
          {selectedContact && (
            <Card className="p-3 bg-muted/50">
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{selectedContact.fullName || selectedContact.firstName}</span>
                </div>
                {selectedContact.companyName && (
                  <div className="flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{selectedContact.companyName}</span>
                  </div>
                )}
                {selectedContact.email && (
                  <div className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{selectedContact.email}</span>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Variables Used */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              Variáveis usadas neste template
            </Label>
            <div className="flex flex-wrap gap-1">
              {template.variables.length > 0 ? (
                template.variables.map((variable) => {
                  const varInfo = AVAILABLE_VARIABLES.find((v) => v.key === variable);
                  return (
                    <Badge key={variable} variant="secondary" className="text-xs">
                      {`{{${variable}}}`}
                      {varInfo && (
                        <span className="ml-1 text-muted-foreground">
                          ({varInfo.label})
                        </span>
                      )}
                    </Badge>
                  );
                })
              ) : (
                <span className="text-xs text-muted-foreground">
                  Nenhuma variável utilizada
                </span>
              )}
            </div>
          </div>

          {/* Email Preview */}
          {preview && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Assunto</Label>
                <Card className="p-3 bg-background">
                  <p className="font-medium">{preview.subject}</p>
                </Card>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Corpo do Email</Label>
                <Card className="p-4 bg-background">
                  <ScrollArea className="h-[200px]">
                    <div className="whitespace-pre-wrap text-sm">
                      {preview.body}
                    </div>
                  </ScrollArea>
                </Card>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
