import { useState } from "react";
import {
  ExternalLink,
  Mail,
  Phone,
  MapPin,
  Building2,
  ChevronDown,
  ChevronUp,
  User,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { LinkedInContact } from "@/types/contact";

interface ContactsTableProps {
  contacts: LinkedInContact[];
  selectedContacts: string[];
  onSelectionChange: (ids: string[]) => void;
}

export const ContactsTable = ({
  contacts,
  selectedContacts,
  onSelectionChange,
}: ContactsTableProps) => {
  const [sortField, setSortField] = useState<keyof LinkedInContact>("fullName");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onSelectionChange(contacts.map((c) => c.id));
    } else {
      onSelectionChange([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      onSelectionChange([...selectedContacts, id]);
    } else {
      onSelectionChange(selectedContacts.filter((cid) => cid !== id));
    }
  };

  const handleSort = (field: keyof LinkedInContact) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const sortedContacts = [...contacts].sort((a, b) => {
    const aValue = a[sortField] || "";
    const bValue = b[sortField] || "";
    const comparison = String(aValue).localeCompare(String(bValue));
    return sortDirection === "asc" ? comparison : -comparison;
  });

  const SortIcon = ({ field }: { field: keyof LinkedInContact }) => {
    if (sortField !== field) return null;
    return sortDirection === "asc" ? (
      <ChevronUp className="h-4 w-4" />
    ) : (
      <ChevronDown className="h-4 w-4" />
    );
  };

  const getConnectionBadgeVariant = (degree?: string) => {
    switch (degree) {
      case "1st":
        return "default";
      case "2nd":
        return "secondary";
      default:
        return "outline";
    }
  };

  if (contacts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <User className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium text-foreground mb-2">
          Nenhum contato encontrado
        </h3>
        <p className="text-muted-foreground max-w-sm">
          Faça uma busca para encontrar contatos do LinkedIn
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="w-12">
              <Checkbox
                checked={
                  selectedContacts.length === contacts.length &&
                  contacts.length > 0
                }
                onCheckedChange={handleSelectAll}
              />
            </TableHead>
            <TableHead
              className="cursor-pointer hover:text-foreground transition-colors"
              onClick={() => handleSort("fullName")}
            >
              <div className="flex items-center gap-1">
                Nome
                <SortIcon field="fullName" />
              </div>
            </TableHead>
            <TableHead
              className="cursor-pointer hover:text-foreground transition-colors"
              onClick={() => handleSort("company")}
            >
              <div className="flex items-center gap-1">
                Empresa
                <SortIcon field="company" />
              </div>
            </TableHead>
            <TableHead
              className="cursor-pointer hover:text-foreground transition-colors"
              onClick={() => handleSort("position")}
            >
              <div className="flex items-center gap-1">
                Cargo
                <SortIcon field="position" />
              </div>
            </TableHead>
            <TableHead
              className="cursor-pointer hover:text-foreground transition-colors"
              onClick={() => handleSort("location")}
            >
              <div className="flex items-center gap-1">
                Localização
                <SortIcon field="location" />
              </div>
            </TableHead>
            <TableHead>Contato</TableHead>
            <TableHead className="w-24">Conexão</TableHead>
            <TableHead className="w-16"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedContacts.map((contact, index) => (
            <TableRow
              key={contact.id}
              className="animate-fade-in"
              style={{ animationDelay: `${index * 30}ms` }}
            >
              <TableCell>
                <Checkbox
                  checked={selectedContacts.includes(contact.id)}
                  onCheckedChange={(checked) =>
                    handleSelectOne(contact.id, checked as boolean)
                  }
                />
              </TableCell>
              <TableCell>
                <div>
                  <p className="font-medium text-foreground">
                    {contact.fullName}
                  </p>
                  <p className="text-sm text-muted-foreground line-clamp-1">
                    {contact.headline}
                  </p>
                </div>
              </TableCell>
              <TableCell>
                {contact.company && (
                  <div className="flex items-center gap-1.5 text-sm">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                    {contact.company}
                  </div>
                )}
              </TableCell>
              <TableCell>
                <span className="text-sm">{contact.position || "-"}</span>
              </TableCell>
              <TableCell>
                {contact.location && (
                  <div className="flex items-center gap-1.5 text-sm">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                    {contact.location}
                  </div>
                )}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  {contact.email && (
                    <a
                      href={`mailto:${contact.email}`}
                      className="text-muted-foreground hover:text-primary transition-colors"
                      title={contact.email}
                    >
                      <Mail className="h-4 w-4" />
                    </a>
                  )}
                  {contact.phone && (
                    <a
                      href={`tel:${contact.phone}`}
                      className="text-muted-foreground hover:text-primary transition-colors"
                      title={contact.phone}
                    >
                      <Phone className="h-4 w-4" />
                    </a>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <Badge variant={getConnectionBadgeVariant(contact.connectionDegree)}>
                  {contact.connectionDegree || "N/A"}
                </Badge>
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon"
                  asChild
                  className="h-8 w-8"
                >
                  <a
                    href={contact.profileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
