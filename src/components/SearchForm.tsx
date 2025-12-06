import { useState } from "react";
import { Search, Filter, Loader2, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import {
  SearchFilters,
  SENIORITY_LEVELS,
  FUNCTIONAL_LEVELS,
  COMPANY_SIZES,
  REVENUE_OPTIONS,
  FUNDING_OPTIONS,
  EMAIL_STATUS_OPTIONS,
} from "@/types/contact";

interface SearchFormProps {
  onSearch: (filters: SearchFilters) => void;
  isLoading: boolean;
}

export const SearchForm = ({ onSearch, isLoading }: SearchFormProps) => {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({
    contactJobTitle: [],
    contactNotJobTitle: [],
    seniorityLevel: [],
    functionalLevel: [],
    contactLocation: [],
    contactCity: [],
    contactNotLocation: [],
    contactNotCity: [],
    emailStatus: ["validated"],
    companyDomain: [],
    size: [],
    companyIndustry: [],
    companyNotIndustry: [],
    companyKeywords: [],
    companyNotKeywords: [],
    minRevenue: "",
    maxRevenue: "",
    funding: [],
    fetchCount: 50,
    fileName: "",
  });

  const [inputValues, setInputValues] = useState({
    jobTitle: "",
    notJobTitle: "",
    location: "",
    city: "",
    notLocation: "",
    notCity: "",
    companyDomain: "",
    industry: "",
    notIndustry: "",
    keywords: "",
    notKeywords: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(filters);
  };

  const addToArrayFilter = (key: keyof SearchFilters, inputKey: keyof typeof inputValues) => {
    const value = inputValues[inputKey].trim();
    if (value && Array.isArray(filters[key])) {
      const currentArray = filters[key] as string[];
      if (!currentArray.includes(value)) {
        setFilters((prev) => ({
          ...prev,
          [key]: [...currentArray, value],
        }));
      }
      setInputValues((prev) => ({ ...prev, [inputKey]: "" }));
    }
  };

  const removeFromArrayFilter = (key: keyof SearchFilters, value: string) => {
    if (Array.isArray(filters[key])) {
      setFilters((prev) => ({
        ...prev,
        [key]: (prev[key] as string[]).filter((item) => item !== value),
      }));
    }
  };

  const toggleArrayFilter = (key: keyof SearchFilters, value: string) => {
    if (Array.isArray(filters[key])) {
      const currentArray = filters[key] as string[];
      if (currentArray.includes(value)) {
        removeFromArrayFilter(key, value);
      } else {
        setFilters((prev) => ({
          ...prev,
          [key]: [...currentArray, value],
        }));
      }
    }
  };

  const TagInput = ({
    label,
    placeholder,
    filterKey,
    inputKey,
  }: {
    label: string;
    placeholder: string;
    filterKey: keyof SearchFilters;
    inputKey: keyof typeof inputValues;
  }) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input
          placeholder={placeholder}
          value={inputValues[inputKey]}
          onChange={(e) =>
            setInputValues((prev) => ({ ...prev, [inputKey]: e.target.value }))
          }
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addToArrayFilter(filterKey, inputKey);
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => addToArrayFilter(filterKey, inputKey)}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {Array.isArray(filters[filterKey]) && (filters[filterKey] as string[]).length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {(filters[filterKey] as string[]).map((item) => (
            <Badge key={item} variant="secondary" className="gap-1">
              {item}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => removeFromArrayFilter(filterKey, item)}
              />
            </Badge>
          ))}
        </div>
      )}
    </div>
  );

  const MultiSelectChips = ({
    label,
    options,
    filterKey,
  }: {
    label: string;
    options: readonly string[];
    filterKey: keyof SearchFilters;
  }) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-1">
        {options.map((option) => {
          const isSelected =
            Array.isArray(filters[filterKey]) &&
            (filters[filterKey] as string[]).includes(option);
          return (
            <Badge
              key={option}
              variant={isSelected ? "default" : "outline"}
              className="cursor-pointer transition-colors"
              onClick={() => toggleArrayFilter(filterKey, option)}
            >
              {option}
            </Badge>
          );
        })}
      </div>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Adicionar cargo (ex: Software Engineer, Marketing Manager)"
            value={inputValues.jobTitle}
            onChange={(e) =>
              setInputValues((prev) => ({ ...prev, jobTitle: e.target.value }))
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addToArrayFilter("contactJobTitle", "jobTitle");
              }
            }}
            className="pl-10 h-11"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => addToArrayFilter("contactJobTitle", "jobTitle")}
          className="h-11"
        >
          <Plus className="h-4 w-4" />
        </Button>
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

      {filters.contactJobTitle && filters.contactJobTitle.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {filters.contactJobTitle.map((title) => (
            <Badge key={title} variant="secondary" className="gap-1">
              {title}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => removeFromArrayFilter("contactJobTitle", title)}
              />
            </Badge>
          ))}
        </div>
      )}

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
        <CollapsibleContent className="mt-4 animate-fade-in space-y-6">
          {/* People Targeting */}
          <div className="p-4 rounded-lg bg-muted/50 border border-border space-y-4">
            <h3 className="font-semibold text-sm text-foreground">Pessoas</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <MultiSelectChips
                label="Nível de Senioridade"
                options={SENIORITY_LEVELS}
                filterKey="seniorityLevel"
              />
              <MultiSelectChips
                label="Área Funcional"
                options={FUNCTIONAL_LEVELS}
                filterKey="functionalLevel"
              />
            </div>
            <TagInput
              label="Excluir Cargos"
              placeholder="Ex: Intern, Assistant"
              filterKey="contactNotJobTitle"
              inputKey="notJobTitle"
            />
          </div>

          {/* Location */}
          <div className="p-4 rounded-lg bg-muted/50 border border-border space-y-4">
            <h3 className="font-semibold text-sm text-foreground">Localização</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TagInput
                label="Região/País/Estado"
                placeholder="Ex: United States, Brazil, EMEA"
                filterKey="contactLocation"
                inputKey="location"
              />
              <TagInput
                label="Cidade"
                placeholder="Ex: São Paulo, New York"
                filterKey="contactCity"
                inputKey="city"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TagInput
                label="Excluir Região/País/Estado"
                placeholder="Ex: China, Russia"
                filterKey="contactNotLocation"
                inputKey="notLocation"
              />
              <TagInput
                label="Excluir Cidade"
                placeholder="Ex: Remote cities"
                filterKey="contactNotCity"
                inputKey="notCity"
              />
            </div>
          </div>

          {/* Email Quality */}
          <div className="p-4 rounded-lg bg-muted/50 border border-border space-y-4">
            <h3 className="font-semibold text-sm text-foreground">Qualidade do Email</h3>
            <div className="flex flex-wrap gap-2">
              {EMAIL_STATUS_OPTIONS.map((option) => {
                const isSelected = filters.emailStatus?.includes(option.value);
                return (
                  <Badge
                    key={option.value}
                    variant={isSelected ? "default" : "outline"}
                    className="cursor-pointer transition-colors"
                    onClick={() => toggleArrayFilter("emailStatus", option.value)}
                  >
                    {option.label}
                  </Badge>
                );
              })}
            </div>
          </div>

          {/* Company Targeting */}
          <div className="p-4 rounded-lg bg-muted/50 border border-border space-y-4">
            <h3 className="font-semibold text-sm text-foreground">Empresa</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TagInput
                label="Domínio da Empresa"
                placeholder="Ex: google.com, microsoft.com"
                filterKey="companyDomain"
                inputKey="companyDomain"
              />
              <TagInput
                label="Indústria"
                placeholder="Ex: Technology, SaaS"
                filterKey="companyIndustry"
                inputKey="industry"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TagInput
                label="Palavras-chave"
                placeholder="Ex: AI, Machine Learning"
                filterKey="companyKeywords"
                inputKey="keywords"
              />
              <TagInput
                label="Excluir Indústrias"
                placeholder="Ex: Government, Non-profit"
                filterKey="companyNotIndustry"
                inputKey="notIndustry"
              />
            </div>
            <MultiSelectChips
              label="Tamanho da Empresa"
              options={COMPANY_SIZES}
              filterKey="size"
            />
          </div>

          {/* Revenue & Funding */}
          <div className="p-4 rounded-lg bg-muted/50 border border-border space-y-4">
            <h3 className="font-semibold text-sm text-foreground">Receita & Investimento</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Receita Mínima</Label>
                <Select
                  value={filters.minRevenue || "none"}
                  onValueChange={(value) =>
                    setFilters((prev) => ({ ...prev, minRevenue: value === "none" ? "" : value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sem mínimo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem mínimo</SelectItem>
                    {REVENUE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Receita Máxima</Label>
                <Select
                  value={filters.maxRevenue || "none"}
                  onValueChange={(value) =>
                    setFilters((prev) => ({ ...prev, maxRevenue: value === "none" ? "" : value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sem máximo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem máximo</SelectItem>
                    {REVENUE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <MultiSelectChips
              label="Estágio de Investimento"
              options={FUNDING_OPTIONS}
              filterKey="funding"
            />
          </div>

          {/* General Settings */}
          <div className="p-4 rounded-lg bg-muted/50 border border-border space-y-4">
            <h3 className="font-semibold text-sm text-foreground">Configurações Gerais</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fetchCount">Limite de Resultados</Label>
                <Select
                  value={String(filters.fetchCount)}
                  onValueChange={(value) =>
                    setFilters((prev) => ({ ...prev, fetchCount: parseInt(value) }))
                  }
                >
                  <SelectTrigger id="fetchCount">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="25">25 contatos</SelectItem>
                    <SelectItem value="50">50 contatos</SelectItem>
                    <SelectItem value="100">100 contatos</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Plano gratuito: máximo 100 leads por execução
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="fileName">Nome da Busca (opcional)</Label>
                <Input
                  id="fileName"
                  placeholder="Ex: Marketing Leads Q1 2024"
                  value={filters.fileName}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, fileName: e.target.value }))
                  }
                />
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </form>
  );
};
