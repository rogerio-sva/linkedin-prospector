import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { LinkedInContact } from "@/types/contact";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ExternalLink,
  Mail,
  Phone,
  Building2,
  MapPin,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ContactsTableProps {
  contacts: LinkedInContact[];
  selectedContacts: string[];
  onSelectionChange: (ids: string[]) => void;
}

type SortField = keyof LinkedInContact;
type SortDirection = "asc" | "desc";

export const ContactsTable = ({
  contacts,
  selectedContacts,
  onSelectionChange,
}: ContactsTableProps) => {
  const [sortField, setSortField] = useState<SortField>("fullName");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

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
      onSelectionChange(selectedContacts.filter((cId) => cId !== id));
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const sortedContacts = [...contacts].sort((a, b) => {
    const aValue = a[sortField];
    const bValue = b[sortField];

    if (aValue === undefined || aValue === null) return 1;
    if (bValue === undefined || bValue === null) return -1;

    let comparison = 0;
    if (typeof aValue === "string" && typeof bValue === "string") {
      comparison = aValue.localeCompare(bValue);
    } else if (aValue < bValue) {
      comparison = -1;
    } else if (aValue > bValue) {
      comparison = 1;
    }

    return sortDirection === "asc" ? comparison : -comparison;
  });

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-1 h-3 w-3" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="ml-1 h-3 w-3" />
    ) : (
      <ArrowDown className="ml-1 h-3 w-3" />
    );
  };

  const getSeniorityBadgeVariant = (seniority?: string) => {
    if (!seniority) return "outline";
    const level = seniority.toLowerCase();
    if (["founder", "owner", "c-level"].includes(level)) return "default";
    if (["director", "vp", "head"].includes(level)) return "secondary";
    return "outline";
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
    <TooltipProvider>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-12">
                <Checkbox
                  checked={
                    contacts.length > 0 &&
                    selectedContacts.length === contacts.length
                  }
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort("firstName")}
                  className="h-8 p-0 font-medium hover:bg-transparent"
                >
                  Primeiro Nome
                  <SortIcon field="firstName" />
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort("fullName")}
                  className="h-8 p-0 font-medium hover:bg-transparent"
                >
                  Nome Completo
                  <SortIcon field="fullName" />
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort("jobTitle")}
                  className="h-8 p-0 font-medium hover:bg-transparent"
                >
                  Cargo
                  <SortIcon field="jobTitle" />
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort("companyName")}
                  className="h-8 p-0 font-medium hover:bg-transparent"
                >
                  Empresa
                  <SortIcon field="companyName" />
                </Button>
              </TableHead>
              <TableHead>Contato</TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort("industry")}
                  className="h-8 p-0 font-medium hover:bg-transparent"
                >
                  Indústria
                  <SortIcon field="industry" />
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort("country")}
                  className="h-8 p-0 font-medium hover:bg-transparent"
                >
                  Localização
                  <SortIcon field="country" />
                </Button>
              </TableHead>
              <TableHead>Nível</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedContacts.map((contact) => (
              <TableRow
                key={contact.id}
                className={
                  selectedContacts.includes(contact.id) ? "bg-muted/30" : ""
                }
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
                  <span className="text-sm font-medium">{contact.firstName || "-"}</span>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{contact.fullName}</span>
                      {contact.linkedin && (
                        <a
                          href={contact.linkedin}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:text-primary/80"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                    {contact.headline && (
                      <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {contact.headline}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-sm">{contact.jobTitle}</span>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1">
                      <Building2 className="h-3 w-3 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        {contact.companyName || "-"}
                      </span>
                    </div>
                    {contact.companyWebsite && (
                      <a
                        href={contact.companyWebsite}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                      >
                        {contact.companyDomain}
                        <ExternalLink className="h-2 w-2" />
                      </a>
                    )}
                    {contact.companySize && (
                      <span className="text-xs text-muted-foreground">
                        {contact.companySize} funcionários
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    {contact.email && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <a
                            href={`mailto:${contact.email}`}
                            className="flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            <Mail className="h-3 w-3" />
                            <span className="truncate max-w-[120px]">
                              {contact.email}
                            </span>
                          </a>
                        </TooltipTrigger>
                        <TooltipContent>{contact.email}</TooltipContent>
                      </Tooltip>
                    )}
                    {contact.mobileNumber && (
                      <a
                        href={`tel:${contact.mobileNumber}`}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                      >
                        <Phone className="h-3 w-3" />
                        <span className="truncate max-w-[100px]">{contact.mobileNumber}</span>
                      </a>
                    )}
                    {contact.companyPhone && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <a
                            href={`tel:${contact.companyPhone}`}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                          >
                            <Building2 className="h-3 w-3" />
                            <span className="truncate max-w-[100px]">{contact.companyPhone}</span>
                          </a>
                        </TooltipTrigger>
                        <TooltipContent>Telefone da empresa: {contact.companyPhone}</TooltipContent>
                      </Tooltip>
                    )}
                    {!contact.email && !contact.mobileNumber && !contact.companyPhone && (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-sm">{contact.industry || "-"}</span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 text-sm">
                    <MapPin className="h-3 w-3 text-muted-foreground" />
                    {[contact.city, contact.state, contact.country]
                      .filter(Boolean)
                      .join(", ") || "-"}
                  </div>
                </TableCell>
                <TableCell>
                  {contact.seniorityLevel && (
                    <Badge variant={getSeniorityBadgeVariant(contact.seniorityLevel)}>
                      {contact.seniorityLevel}
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </TooltipProvider>
  );
};
