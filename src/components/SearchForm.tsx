import { useState } from "react";
import { Search, Filter, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { SearchFilters } from "@/types/contact";

interface SearchFormProps {
  onSearch: (filters: SearchFilters) => void;
  isLoading: boolean;
}

export const SearchForm = ({ onSearch, isLoading }: SearchFormProps) => {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({
    keywords: "",
    location: "",
    company: "",
    title: "",
    industry: "",
    connectionDegree: "",
    limit: 50,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(filters);
  };

  const updateFilter = (key: keyof SearchFilters, value: string | number) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por palavras-chave, cargo, habilidades..."
            value={filters.keywords}
            onChange={(e) => updateFilter("keywords", e.target.value)}
            className="pl-10 h-11"
          />
        </div>
        <Button type="submit" disabled={isLoading} className="h-11 px-6">
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Buscando...
            </>
          ) : (
            <>
              <Search className="mr-2 h-4 w-4" />
              Buscar
            </>
          )}
        </Button>
      </div>

      <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
        <CollapsibleTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
          >
            <Filter className="mr-2 h-4 w-4" />
            {showAdvanced ? "Ocultar filtros avançados" : "Filtros avançados"}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-4 animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 rounded-lg bg-muted/50 border border-border">
            <div className="space-y-2">
              <Label htmlFor="location">Localização</Label>
              <Input
                id="location"
                placeholder="Ex: São Paulo, Brasil"
                value={filters.location}
                onChange={(e) => updateFilter("location", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="company">Empresa</Label>
              <Input
                id="company"
                placeholder="Ex: Google, Microsoft"
                value={filters.company}
                onChange={(e) => updateFilter("company", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Cargo</Label>
              <Input
                id="title"
                placeholder="Ex: Software Engineer"
                value={filters.title}
                onChange={(e) => updateFilter("title", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="industry">Indústria</Label>
              <Input
                id="industry"
                placeholder="Ex: Technology"
                value={filters.industry}
                onChange={(e) => updateFilter("industry", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="connectionDegree">Grau de conexão</Label>
              <Select
                value={filters.connectionDegree}
                onValueChange={(value) => updateFilter("connectionDegree", value)}
              >
                <SelectTrigger id="connectionDegree">
                  <SelectValue placeholder="Qualquer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Qualquer</SelectItem>
                  <SelectItem value="1st">1º grau</SelectItem>
                  <SelectItem value="2nd">2º grau</SelectItem>
                  <SelectItem value="3rd">3º grau</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="limit">Limite de resultados</Label>
              <Select
                value={String(filters.limit)}
                onValueChange={(value) => updateFilter("limit", parseInt(value))}
              >
                <SelectTrigger id="limit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25 contatos</SelectItem>
                  <SelectItem value="50">50 contatos</SelectItem>
                  <SelectItem value="100">100 contatos</SelectItem>
                  <SelectItem value="250">250 contatos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </form>
  );
};
