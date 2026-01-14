import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Mail, 
  Linkedin, 
  Phone, 
  Building2, 
  Globe, 
  MapPin,
  ExternalLink,
  Plus,
  Check,
  User
} from "lucide-react";
import { 
  CRMContact, 
  CRMStage, 
  TeamMember,
  useContactActivities,
  useUpdateContactNotes 
} from "@/hooks/useCRM";
import { ActivityTimeline } from "./ActivityTimeline";
import { AddActivityDialog } from "./AddActivityDialog";

interface ContactDetailDrawerProps {
  contact: CRMContact | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stages: CRMStage[];
  teamMembers: TeamMember[];
  onStageChange: (contactId: string, stage: string) => void;
  onAssign: (contactId: string, assignedTo: string) => void;
  onMarkLinkedIn: (contactId: string) => void;
  onAddActivity: (contactId: string, type: string, description: string, performedBy: string) => void;
}

export function ContactDetailDrawer({
  contact,
  open,
  onOpenChange,
  stages,
  teamMembers,
  onStageChange,
  onAssign,
  onMarkLinkedIn,
  onAddActivity,
}: ContactDetailDrawerProps) {
  const [notes, setNotes] = useState(contact?.notes || "");
  const [showAddActivity, setShowAddActivity] = useState(false);
  
  const { data: activities = [], isLoading: activitiesLoading } = useContactActivities(contact?.id || null);
  const updateNotes = useUpdateContactNotes();
  
  if (!contact) return null;
  
  const displayName = contact.full_name || 
    [contact.first_name, contact.last_name].filter(Boolean).join(" ") || 
    "Sem nome";
  
  const hasEmail = !!(contact.email || contact.personal_email);
  const hasLinkedIn = !!contact.linkedin_url;
  const linkedInContacted = !!contact.linkedin_contacted_at;

  const handleSaveNotes = () => {
    updateNotes.mutate({ contactId: contact.id, notes });
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="text-left">{displayName}</SheetTitle>
          </SheetHeader>
          
          <ScrollArea className="h-[calc(100vh-100px)] pr-4">
            <div className="space-y-6 py-4">
              {/* Contact Info */}
              <div className="space-y-3">
                {contact.job_title && (
                  <p className="text-muted-foreground">{contact.job_title}</p>
                )}
                
                <div className="flex flex-wrap gap-2">
                  {hasEmail && (
                    <Badge variant="default">
                      <Mail className="h-3 w-3 mr-1" />
                      Email
                    </Badge>
                  )}
                  {hasLinkedIn && (
                    <Badge variant={linkedInContacted ? "default" : "outline"} 
                      className={linkedInContacted ? "bg-green-600" : ""}>
                      <Linkedin className="h-3 w-3 mr-1" />
                      {linkedInContacted ? "Contatado" : "LinkedIn"}
                    </Badge>
                  )}
                  {(contact.mobile_number || contact.company_phone) && (
                    <Badge variant="outline">
                      <Phone className="h-3 w-3 mr-1" />
                      Telefone
                    </Badge>
                  )}
                </div>
              </div>
              
              <Separator />
              
              {/* Stage & Assignment */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Estágio</Label>
                  <Select 
                    value={contact.crm_stage || "Novo Lead"} 
                    onValueChange={(v) => onStageChange(contact.id, v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {stages.map((stage) => (
                        <SelectItem key={stage.id} value={stage.name}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-2 h-2 rounded-full" 
                              style={{ backgroundColor: stage.color }}
                            />
                            {stage.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Atribuído para</Label>
                  <Select 
                    value={contact.assigned_to || ""} 
                    onValueChange={(v) => onAssign(contact.id, v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {teamMembers.map((member) => (
                        <SelectItem key={member.id} value={member.name}>
                          <div className="flex items-center gap-2">
                            <User className="h-3 w-3" />
                            {member.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <Separator />
              
              {/* Contact Details */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm">Informações de Contato</h4>
                
                {(contact.email || contact.personal_email) && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{contact.email || contact.personal_email}</span>
                  </div>
                )}
                
                {contact.linkedin_url && (
                  <div className="flex items-center gap-2 text-sm">
                    <Linkedin className="h-4 w-4 text-muted-foreground" />
                    <a 
                      href={contact.linkedin_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline flex items-center gap-1"
                    >
                      Ver perfil <ExternalLink className="h-3 w-3" />
                    </a>
                    {!linkedInContacted && (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="h-6 text-xs ml-auto"
                        onClick={() => onMarkLinkedIn(contact.id)}
                      >
                        <Check className="h-3 w-3 mr-1" />
                        Marcar contatado
                      </Button>
                    )}
                  </div>
                )}
                
                {(contact.mobile_number || contact.company_phone) && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{contact.mobile_number || contact.company_phone}</span>
                  </div>
                )}
                
                {contact.company_name && (
                  <div className="flex items-center gap-2 text-sm">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span>{contact.company_name}</span>
                    {contact.company_website && (
                      <a 
                        href={contact.company_website.startsWith("http") ? contact.company_website : `https://${contact.company_website}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary"
                      >
                        <Globe className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                )}
                
                {(contact.city || contact.state || contact.country) && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{[contact.city, contact.state, contact.country].filter(Boolean).join(", ")}</span>
                  </div>
                )}
              </div>
              
              <Separator />
              
              {/* Notes */}
              <div className="space-y-2">
                <Label>Notas</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Adicione notas sobre este contato..."
                  rows={3}
                />
                {notes !== (contact.notes || "") && (
                  <Button size="sm" onClick={handleSaveNotes} disabled={updateNotes.isPending}>
                    Salvar notas
                  </Button>
                )}
              </div>
              
              <Separator />
              
              {/* Activities */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm">Histórico de Atividades</h4>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => setShowAddActivity(true)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Adicionar
                  </Button>
                </div>
                
                <ActivityTimeline activities={activities} isLoading={activitiesLoading} />
              </div>
              
              {/* Timestamps */}
              <div className="text-xs text-muted-foreground space-y-1">
                <p>Criado em: {format(new Date(contact.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                {contact.last_activity_at && (
                  <p>Última atividade: {format(new Date(contact.last_activity_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                )}
                {contact.linkedin_contacted_at && (
                  <p>LinkedIn contatado: {format(new Date(contact.linkedin_contacted_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                )}
              </div>
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
      
      <AddActivityDialog
        open={showAddActivity}
        onOpenChange={setShowAddActivity}
        onSubmit={(type, desc, by) => onAddActivity(contact.id, type, desc, by)}
        teamMembers={teamMembers}
      />
    </>
  );
}
