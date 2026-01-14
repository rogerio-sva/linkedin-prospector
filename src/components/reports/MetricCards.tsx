import { Card, CardContent } from "@/components/ui/card";
import { Users, Mail, Linkedin, Send, Activity, CheckCircle } from "lucide-react";

interface MetricCardsProps {
  totalContacts: number;
  withEmail: number;
  withLinkedIn: number;
  linkedInContacted: number;
  emailsSent: number;
  totalActivities: number;
}

export function MetricCards({
  totalContacts,
  withEmail,
  withLinkedIn,
  linkedInContacted,
  emailsSent,
  totalActivities,
}: MetricCardsProps) {
  const metrics = [
    {
      title: "Total de Contatos",
      value: totalContacts,
      icon: Users,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      title: "Com Email",
      value: withEmail,
      subtitle: `${totalContacts > 0 ? ((withEmail / totalContacts) * 100).toFixed(1) : 0}%`,
      icon: Mail,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
    {
      title: "Com LinkedIn",
      value: withLinkedIn,
      subtitle: `${totalContacts > 0 ? ((withLinkedIn / totalContacts) * 100).toFixed(1) : 0}%`,
      icon: Linkedin,
      color: "text-sky-500",
      bgColor: "bg-sky-500/10",
    },
    {
      title: "LinkedIn Contatado",
      value: linkedInContacted,
      subtitle: `${withLinkedIn > 0 ? ((linkedInContacted / withLinkedIn) * 100).toFixed(1) : 0}% do total`,
      icon: CheckCircle,
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
    },
    {
      title: "Emails Enviados",
      value: emailsSent,
      icon: Send,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
    {
      title: "Total de Atividades",
      value: totalActivities,
      icon: Activity,
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {metrics.map((metric) => (
        <Card key={metric.title}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${metric.bgColor}`}>
                <metric.icon className={`h-5 w-5 ${metric.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{metric.value.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{metric.title}</p>
                {metric.subtitle && (
                  <p className="text-xs text-muted-foreground">{metric.subtitle}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
