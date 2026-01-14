import { useState } from "react";
import {
  Dialog,
  DialogContent,
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
import { Input } from "@/components/ui/input";

interface AddActivityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (activityType: string, description: string, performedBy: string) => void;
  teamMembers: { id: string; name: string }[];
}

const activityTypes = [
  { value: "phone_call", label: "Ligação" },
  { value: "meeting", label: "Reunião" },
  { value: "proposal", label: "Proposta Enviada" },
  { value: "note", label: "Nota / Observação" },
  { value: "linkedin_contacted", label: "Contato LinkedIn" },
  { value: "email_sent", label: "Email Enviado" },
];

export function AddActivityDialog({ 
  open, 
  onOpenChange, 
  onSubmit,
  teamMembers 
}: AddActivityDialogProps) {
  const [activityType, setActivityType] = useState("");
  const [description, setDescription] = useState("");
  const [performedBy, setPerformedBy] = useState("");

  const handleSubmit = () => {
    if (activityType && description) {
      onSubmit(activityType, description, performedBy);
      setActivityType("");
      setDescription("");
      setPerformedBy("");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar Atividade</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Tipo de Atividade</Label>
            <Select value={activityType} onValueChange={setActivityType}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                {activityTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva a atividade..."
              rows={3}
            />
          </div>
          
          <div className="space-y-2">
            <Label>Realizado por</Label>
            {teamMembers.length > 0 ? (
              <Select value={performedBy} onValueChange={setPerformedBy}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o membro" />
                </SelectTrigger>
                <SelectContent>
                  {teamMembers.map((member) => (
                    <SelectItem key={member.id} value={member.name}>
                      {member.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={performedBy}
                onChange={(e) => setPerformedBy(e.target.value)}
                placeholder="Nome do responsável"
              />
            )}
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!activityType || !description}>
            Adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
