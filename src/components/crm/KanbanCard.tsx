import { Mail, Linkedin, Phone, Building2, ExternalLink, Check, User } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CRMContact } from "@/hooks/useCRM";

interface KanbanCardProps {
  contact: CRMContact;
  onOpenDetail: (contact: CRMContact) => void;
  onMarkLinkedIn: (contactId: string) => void;
}

export function KanbanCard({ contact, onOpenDetail, onMarkLinkedIn }: KanbanCardProps) {
  const hasEmail = !!(contact.email || contact.personal_email);
  const hasLinkedIn = !!contact.linkedin_url;
  const linkedInContacted = !!contact.linkedin_contacted_at;
  
  const displayName = contact.full_name || 
    [contact.first_name, contact.last_name].filter(Boolean).join(" ") || 
    "Sem nome";

  return (
    <Card 
      className="cursor-pointer hover:shadow-md transition-shadow border-border/50"
      onClick={() => onOpenDetail(contact)}
    >
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-medium text-sm truncate">{displayName}</p>
            {contact.job_title && (
              <p className="text-xs text-muted-foreground truncate">{contact.job_title}</p>
            )}
          </div>
          {contact.assigned_to && (
            <Tooltip>
              <TooltipTrigger>
                <Badge variant="outline" className="text-xs shrink-0">
                  <User className="h-3 w-3 mr-1" />
                  {contact.assigned_to.split(" ")[0]}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>Atribuído para {contact.assigned_to}</TooltipContent>
            </Tooltip>
          )}
        </div>
        
        {contact.company_name && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Building2 className="h-3 w-3 shrink-0" />
            <span className="truncate">{contact.company_name}</span>
          </div>
        )}
        
        <div className="flex items-center gap-1 flex-wrap">
          {/* Email indicator */}
          <Tooltip>
            <TooltipTrigger>
              <Badge 
                variant={hasEmail ? "default" : "secondary"} 
                className="text-xs px-1.5"
              >
                <Mail className="h-3 w-3" />
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              {hasEmail ? (contact.email || contact.personal_email) : "Sem email"}
            </TooltipContent>
          </Tooltip>
          
          {/* LinkedIn indicator */}
          {hasLinkedIn && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge 
                  variant={linkedInContacted ? "default" : "outline"} 
                  className={`text-xs px-1.5 ${linkedInContacted ? "bg-green-600" : ""}`}
                >
                  <Linkedin className="h-3 w-3" />
                  {linkedInContacted && <Check className="h-2.5 w-2.5 ml-0.5" />}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                {linkedInContacted ? "LinkedIn contatado" : "LinkedIn disponível"}
              </TooltipContent>
            </Tooltip>
          )}
          
          {/* Phone indicator */}
          {(contact.mobile_number || contact.company_phone) && (
            <Tooltip>
              <TooltipTrigger>
                <Badge variant="outline" className="text-xs px-1.5">
                  <Phone className="h-3 w-3" />
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                {contact.mobile_number || contact.company_phone}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        
        {/* Quick actions */}
        <div className="flex items-center gap-1 pt-1">
          {hasLinkedIn && !linkedInContacted && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(contact.linkedin_url!, "_blank");
                  }}
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Abrir
                </Button>
              </TooltipTrigger>
              <TooltipContent>Abrir LinkedIn</TooltipContent>
            </Tooltip>
          )}
          
          {hasLinkedIn && !linkedInContacted && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 px-2 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    onMarkLinkedIn(contact.id);
                  }}
                >
                  <Check className="h-3 w-3 mr-1" />
                  Contatado
                </Button>
              </TooltipTrigger>
              <TooltipContent>Marcar como contatado no LinkedIn</TooltipContent>
            </Tooltip>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
