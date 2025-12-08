import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X } from "lucide-react";
import { LinkedInContact } from "@/types/contact";

interface EditContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: LinkedInContact | null;
  onSave: (contactId: string, updates: ContactUpdates) => Promise<void>;
}

export interface ContactUpdates {
  email?: string | null;
  personal_email?: string | null;
  mobile_number?: string | null;
  company_phone?: string | null;
}

export function EditContactDialog({
  open,
  onOpenChange,
  contact,
  onSave,
}: EditContactDialogProps) {
  const [email, setEmail] = useState("");
  const [personalEmail, setPersonalEmail] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (contact) {
      setEmail(contact.email || "");
      setPersonalEmail(contact.personalEmail || "");
      setMobileNumber(contact.mobileNumber || "");
      setCompanyPhone(contact.companyPhone || "");
    }
  }, [contact]);

  const handleSave = async () => {
    if (!contact?.id) return;

    setIsSaving(true);
    try {
      await onSave(contact.id, {
        email: email || null,
        personal_email: personalEmail || null,
        mobile_number: mobileNumber || null,
        company_phone: companyPhone || null,
      });
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  const clearField = (setter: (value: string) => void) => {
    setter("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Contato</DialogTitle>
        </DialogHeader>

        {contact && (
          <div className="space-y-4 py-4">
            <div className="text-sm text-muted-foreground mb-4">
              <span className="font-medium text-foreground">{contact.fullName}</span>
              {contact.companyName && (
                <span> - {contact.companyName}</span>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Corporativo</Label>
              <div className="flex gap-2">
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@empresa.com"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => clearField(setEmail)}
                  disabled={!email}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="personalEmail">Email Pessoal</Label>
              <div className="flex gap-2">
                <Input
                  id="personalEmail"
                  type="email"
                  value={personalEmail}
                  onChange={(e) => setPersonalEmail(e.target.value)}
                  placeholder="email@pessoal.com"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => clearField(setPersonalEmail)}
                  disabled={!personalEmail}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mobileNumber">Telefone Celular</Label>
              <div className="flex gap-2">
                <Input
                  id="mobileNumber"
                  type="tel"
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value)}
                  placeholder="(11) 99999-9999"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => clearField(setMobileNumber)}
                  disabled={!mobileNumber}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="companyPhone">Telefone Empresa</Label>
              <div className="flex gap-2">
                <Input
                  id="companyPhone"
                  type="tel"
                  value={companyPhone}
                  onChange={(e) => setCompanyPhone(e.target.value)}
                  placeholder="(11) 3333-3333"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => clearField(setCompanyPhone)}
                  disabled={!companyPhone}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
