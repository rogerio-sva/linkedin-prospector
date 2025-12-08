import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, X, Filter, Trash2 } from "lucide-react";
import { LinkedInContact } from "@/types/contact";

export interface ContactFiltersState {
  search: string;
  jobTitle: string;
  company: string;
  industry: string;
  city: string;
  hasEmail: string;
  hasPhone: string;
  isBounced: string;
}

interface ContactFiltersProps {
  contacts: LinkedInContact[];
  filters: ContactFiltersState;
  onFiltersChange: (filters: ContactFiltersState) => void;
  selectedCount: number;
  onDeleteSelected: () => void;
  onDeleteFiltered: () => void;
  filteredCount: number;
  bouncedContactIds?: string[];
}

const initialFilters: ContactFiltersState = {
  search: "",
  jobTitle: "",
  company: "",
  industry: "",
  city: "",
  hasEmail: "",
  hasPhone: "",
  isBounced: "",
};

export const ContactFilters = ({
  contacts,
  filters,
  onFiltersChange,
  selectedCount,
  onDeleteSelected,
  onDeleteFiltered,
  filteredCount,
  bouncedContactIds = [],
}: ContactFiltersProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Extract unique values for dropdowns
  const uniqueValues = useMemo(() => {
    const jobTitles = new Set<string>();
    const companies = new Set<string>();
    const industries = new Set<string>();
    const cities = new Set<string>();

    contacts.forEach((c) => {
      if (c.jobTitle) jobTitles.add(c.jobTitle);
      if (c.companyName) companies.add(c.companyName);
      if (c.industry) industries.add(c.industry);
      if (c.city) cities.add(c.city);
    });

    return {
      jobTitles: Array.from(jobTitles).sort(),
      companies: Array.from(companies).sort(),
      industries: Array.from(industries).sort(),
      cities: Array.from(cities).sort(),
    };
  }, [contacts]);

  const activeFiltersCount = Object.values(filters).filter((v) => v !== "").length;

  const clearFilters = () => {
    onFiltersChange(initialFilters);
  };

  const updateFilter = (key: keyof ContactFiltersState, value: string) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  return (
    <div className="space-y-3">
      {/* Search and toggle */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, email, empresa..."
            value={filters.search}
            onChange={(e) => updateFilter("search", e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          variant={isExpanded ? "default" : "outline"}
          size="icon"
          onClick={() => setIsExpanded(!isExpanded)}
          className="relative"
        >
          <Filter className="h-4 w-4" />
          {activeFiltersCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs"
            >
              {activeFiltersCount}
            </Badge>
          )}
        </Button>
      </div>

      {/* Expanded filters */}
      {isExpanded && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 p-3 bg-muted/30 rounded-lg border border-border">
          <Select value={filters.jobTitle || "all"} onValueChange={(v) => updateFilter("jobTitle", v === "all" ? "" : v)}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Cargo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os cargos</SelectItem>
              {uniqueValues.jobTitles.slice(0, 50).map((job) => (
                <SelectItem key={job} value={job} className="text-xs">
                  {job}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.company || "all"} onValueChange={(v) => updateFilter("company", v === "all" ? "" : v)}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Empresa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as empresas</SelectItem>
              {uniqueValues.companies.slice(0, 50).map((company) => (
                <SelectItem key={company} value={company} className="text-xs">
                  {company}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.industry || "all"} onValueChange={(v) => updateFilter("industry", v === "all" ? "" : v)}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Indústria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as indústrias</SelectItem>
              {uniqueValues.industries.slice(0, 50).map((industry) => (
                <SelectItem key={industry} value={industry} className="text-xs">
                  {industry}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.city || "all"} onValueChange={(v) => updateFilter("city", v === "all" ? "" : v)}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Cidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as cidades</SelectItem>
              {uniqueValues.cities.slice(0, 50).map((city) => (
                <SelectItem key={city} value={city} className="text-xs">
                  {city}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.hasEmail || "all"} onValueChange={(v) => updateFilter("hasEmail", v === "all" ? "" : v)}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Email" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="yes">Com email</SelectItem>
              <SelectItem value="no">Sem email</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filters.hasPhone || "all"} onValueChange={(v) => updateFilter("hasPhone", v === "all" ? "" : v)}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Telefone" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="yes">Com telefone</SelectItem>
              <SelectItem value="no">Sem telefone</SelectItem>
            </SelectContent>
          </Select>

          {bouncedContactIds.length > 0 && (
            <Select value={filters.isBounced || "all"} onValueChange={(v) => updateFilter("isBounced", v === "all" ? "" : v)}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Bounced" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="yes">Bounced ({bouncedContactIds.length})</SelectItem>
                <SelectItem value="no">Não bounced</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      {/* Active filters badges and actions */}
      {(activeFiltersCount > 0 || selectedCount > 0) && (
        <div className="flex flex-wrap items-center gap-2">
          {activeFiltersCount > 0 && (
            <>
              <span className="text-xs text-muted-foreground">Filtros ativos:</span>
              {filters.jobTitle && (
                <Badge variant="secondary" className="text-xs">
                  Cargo: {filters.jobTitle}
                  <X
                    className="h-3 w-3 ml-1 cursor-pointer"
                    onClick={() => updateFilter("jobTitle", "")}
                  />
                </Badge>
              )}
              {filters.company && (
                <Badge variant="secondary" className="text-xs">
                  Empresa: {filters.company}
                  <X
                    className="h-3 w-3 ml-1 cursor-pointer"
                    onClick={() => updateFilter("company", "")}
                  />
                </Badge>
              )}
              {filters.industry && (
                <Badge variant="secondary" className="text-xs">
                  Indústria: {filters.industry}
                  <X
                    className="h-3 w-3 ml-1 cursor-pointer"
                    onClick={() => updateFilter("industry", "")}
                  />
                </Badge>
              )}
              {filters.city && (
                <Badge variant="secondary" className="text-xs">
                  Cidade: {filters.city}
                  <X
                    className="h-3 w-3 ml-1 cursor-pointer"
                    onClick={() => updateFilter("city", "")}
                  />
                </Badge>
              )}
              {filters.hasEmail && (
                <Badge variant="secondary" className="text-xs">
                  {filters.hasEmail === "yes" ? "Com email" : "Sem email"}
                  <X
                    className="h-3 w-3 ml-1 cursor-pointer"
                    onClick={() => updateFilter("hasEmail", "")}
                  />
                </Badge>
              )}
              {filters.hasPhone && (
                <Badge variant="secondary" className="text-xs">
                  {filters.hasPhone === "yes" ? "Com telefone" : "Sem telefone"}
                  <X
                    className="h-3 w-3 ml-1 cursor-pointer"
                    onClick={() => updateFilter("hasPhone", "")}
                  />
                </Badge>
              )}
              {filters.isBounced && (
                <Badge variant="destructive" className="text-xs">
                  {filters.isBounced === "yes" ? "Bounced" : "Não bounced"}
                  <X
                    className="h-3 w-3 ml-1 cursor-pointer"
                    onClick={() => updateFilter("isBounced", "")}
                  />
                </Badge>
              )}
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-6 text-xs">
                Limpar filtros
              </Button>
            </>
          )}

          <div className="flex-1" />

          {/* Delete actions */}
          {selectedCount > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={onDeleteSelected}
              className="h-7 text-xs gap-1"
            >
              <Trash2 className="h-3 w-3" />
              Excluir {selectedCount} selecionado{selectedCount > 1 ? "s" : ""}
            </Button>
          )}

          {activeFiltersCount > 0 && filteredCount > 0 && filteredCount < contacts.length && (
            <Button
              variant="outline"
              size="sm"
              onClick={onDeleteFiltered}
              className="h-7 text-xs gap-1 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
            >
              <Trash2 className="h-3 w-3" />
              Excluir {filteredCount} filtrado{filteredCount > 1 ? "s" : ""}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export const filterContacts = (
  contacts: LinkedInContact[],
  filters: ContactFiltersState,
  bouncedContactIds: string[] = []
): LinkedInContact[] => {
  return contacts.filter((contact) => {
    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const matchesSearch =
        contact.fullName?.toLowerCase().includes(searchLower) ||
        contact.firstName?.toLowerCase().includes(searchLower) ||
        contact.lastName?.toLowerCase().includes(searchLower) ||
        contact.email?.toLowerCase().includes(searchLower) ||
        contact.personalEmail?.toLowerCase().includes(searchLower) ||
        contact.companyName?.toLowerCase().includes(searchLower) ||
        contact.jobTitle?.toLowerCase().includes(searchLower);
      if (!matchesSearch) return false;
    }

    // Job title filter
    if (filters.jobTitle && contact.jobTitle !== filters.jobTitle) {
      return false;
    }

    // Company filter
    if (filters.company && contact.companyName !== filters.company) {
      return false;
    }

    // Industry filter
    if (filters.industry && contact.industry !== filters.industry) {
      return false;
    }

    // City filter
    if (filters.city && contact.city !== filters.city) {
      return false;
    }

    // Has email filter
    if (filters.hasEmail === "yes" && !contact.email) {
      return false;
    }
    if (filters.hasEmail === "no" && contact.email) {
      return false;
    }

    // Has phone filter
    if (filters.hasPhone === "yes" && !contact.mobileNumber && !contact.companyPhone) {
      return false;
    }
    if (filters.hasPhone === "no" && (contact.mobileNumber || contact.companyPhone)) {
      return false;
    }

    // Bounced filter
    if (filters.isBounced === "yes" && !bouncedContactIds.includes(contact.id)) {
      return false;
    }
    if (filters.isBounced === "no" && bouncedContactIds.includes(contact.id)) {
      return false;
    }

    return true;
  });
};
