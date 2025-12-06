import { Users, Search, Mail, Building2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { LinkedInContact, SearchQuery } from "@/types/contact";

interface StatsCardsProps {
  contacts: LinkedInContact[];
  searches: SearchQuery[];
}

export const StatsCards = ({ contacts, searches }: StatsCardsProps) => {
  const totalContacts = contacts.length;
  const totalSearches = searches.length;
  const contactsWithEmail = contacts.filter((c) => c.email).length;
  const uniqueCompanies = new Set(contacts.map((c) => c.company).filter(Boolean))
    .size;

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
      value: totalSearches,
      icon: Search,
      color: "text-accent",
      bgColor: "bg-accent/10",
    },
    {
      label: "Com Email",
      value: contactsWithEmail,
      icon: Mail,
      color: "text-success",
      bgColor: "bg-success/10",
    },
    {
      label: "Empresas",
      value: uniqueCompanies,
      icon: Building2,
      color: "text-warning",
      bgColor: "bg-warning/10",
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
