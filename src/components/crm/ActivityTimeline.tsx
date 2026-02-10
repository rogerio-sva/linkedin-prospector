import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Mail, 
  Linkedin, 
  Phone, 
  MessageSquare, 
  Calendar, 
  FileText, 
  ArrowRight,
  User
} from "lucide-react";
import { ContactActivity } from "@/hooks/useCRM";

interface ActivityTimelineProps {
  activities: ContactActivity[];
  isLoading: boolean;
}

const activityIcons: Record<string, React.ElementType> = {
  email_sent: Mail,
  email_suppressed: Mail,
  linkedin_contacted: Linkedin,
  phone_call: Phone,
  note: MessageSquare,
  meeting: Calendar,
  proposal: FileText,
  stage_change: ArrowRight,
  assigned: User,
};

const activityLabels: Record<string, string> = {
  email_sent: "Email enviado",
  email_suppressed: "Email suprimido",
  linkedin_contacted: "LinkedIn contatado",
  phone_call: "Ligação",
  note: "Nota",
  meeting: "Reunião",
  proposal: "Proposta",
  stage_change: "Mudança de estágio",
  assigned: "Atribuição",
};

export function ActivityTimeline({ activities, isLoading }: ActivityTimelineProps) {
  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-muted rounded w-1/3" />
              <div className="h-3 bg-muted rounded w-2/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Nenhuma atividade registrada
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {activities.map((activity, index) => {
        const Icon = activityIcons[activity.activity_type] || MessageSquare;
        const label = activityLabels[activity.activity_type] || activity.activity_type;
        
        return (
          <div key={activity.id} className="flex gap-3">
            <div className="relative">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              {index < activities.length - 1 && (
                <div className="absolute top-8 left-1/2 -translate-x-1/2 w-0.5 h-full bg-border" />
              )}
            </div>
            <div className="flex-1 pb-4">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{label}</span>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(activity.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </span>
              </div>
              {activity.description && (
                <p className="text-sm text-muted-foreground mt-1">
                  {activity.description}
                </p>
              )}
              {activity.performed_by && (
                <p className="text-xs text-muted-foreground mt-1">
                  Por: {activity.performed_by}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
