import { Users, Search, Mail, Phone } from "lucide-react";
import { Card } from "@/components/ui/card";

interface StatsCardsProps {
  totalContacts: number;
  emailsAvailable: number;
  phonesAvailable: number;
  searchesCount: number;
}

export const StatsCards = ({
  totalContacts,
  emailsAvailable,
  phonesAvailable,
  searchesCount,
}: StatsCardsProps) => {
  const stats = [
    {
      label: "Total de Contatos",
      value: totalContacts,
      icon: Users,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      label: "Buscas Realizadas",
      value: searchesCount,
      icon: Search,
      color: "text-accent",
      bgColor: "bg-accent/10",
    },
    {
      label: "Com Email",
      value: emailsAvailable,
      icon: Mail,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
    {
      label: "Com Telefone",
      value: phonesAvailable,
      icon: Phone,
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, index) => (
        <Card
          key={stat.label}
          className="p-4 animate-fade-in shadow-card hover:shadow-lg transition-shadow"
          style={{ animationDelay: `${index * 100}ms` }}
        >
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-lg ${stat.bgColor}`}>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </div>
            <div>
              <p className="text-2xl font-semibold text-foreground">
                {stat.value}
              </p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};
