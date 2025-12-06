import { useState } from "react";
import { Linkedin, Settings, RefreshCw, Download } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SearchForm } from "@/components/SearchForm";
import { ContactsTable } from "@/components/ContactsTable";
import { SearchHistory } from "@/components/SearchHistory";
import { ExportMenu } from "@/components/ExportMenu";
import { StatsCards } from "@/components/StatsCards";
import { LinkedInContact, SearchQuery, SearchFilters } from "@/types/contact";
import { mockSearchHistory } from "@/lib/mockData";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const Index = () => {
  const [contacts, setContacts] = useState<LinkedInContact[]>([]);
  const [searchHistory, setSearchHistory] = useState<SearchQuery[]>(mockSearchHistory);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoverDialogOpen, setRecoverDialogOpen] = useState(false);
  const [datasetId, setDatasetId] = useState("");
  const [runId, setRunId] = useState("");

  const handleSearch = async (filters: SearchFilters) => {
    setIsLoading(true);

    try {
      console.log("Starting search with filters:", filters);

      const { data, error } = await supabase.functions.invoke("search-leads", {
        body: filters,
      });

      if (error) {
        console.error("Edge function error:", error);
        throw new Error(error.message || "Erro ao buscar leads");
      }

      if (data.error) {
        console.error("API error:", data.error);
        throw new Error(data.error);
      }

      const fetchedContacts = data.contacts.map((contact: LinkedInContact) => ({
        ...contact,
        createdAt: new Date(contact.createdAt),
      }));

      setContacts(fetchedContacts);
      setSelectedContacts([]);

      // Build query name from filters
      const queryParts: string[] = [];
      if (filters.contactJobTitle?.length) {
        queryParts.push(filters.contactJobTitle.join(", "));
      }
      if (filters.contactLocation?.length) {
        queryParts.push(filters.contactLocation.join(", "));
      }
      if (filters.companyIndustry?.length) {
        queryParts.push(filters.companyIndustry.join(", "));
      }

      const newSearch: SearchQuery = {
        id: `search-${Date.now()}`,
        query: queryParts.length > 0 ? queryParts.join(" | ") : "Busca personalizada",
        filters,
        resultsCount: fetchedContacts.length,
        createdAt: new Date(),
        contacts: fetchedContacts,
      };

      setSearchHistory((prev) => [newSearch, ...prev]);

      toast.success(`${fetchedContacts.length} contatos encontrados`);
    } catch (error) {
      console.error("Search error:", error);
      toast.error(error instanceof Error ? error.message : "Erro desconhecido");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecoverDataset = async () => {
    if (!datasetId.trim()) {
      toast.error("Informe o Dataset ID");
      return;
    }

    setIsRecovering(true);

    try {
      const { data, error } = await supabase.functions.invoke("fetch-dataset", {
        body: { datasetId: datasetId.trim(), runId: runId.trim() || undefined },
      });

      if (error) {
        throw new Error(error.message || "Erro ao recuperar dataset");
      }

      if (data.status === "RUNNING") {
        toast.info(data.message);
        return;
      }

      if (data.error) {
        throw new Error(data.error);
      }

      const fetchedContacts = data.contacts.map((contact: LinkedInContact) => ({
        ...contact,
        createdAt: new Date(contact.createdAt),
      }));

      setContacts(fetchedContacts);
      setSelectedContacts([]);

      const newSearch: SearchQuery = {
        id: `search-${Date.now()}`,
        query: `Recuperado: ${datasetId.slice(0, 8)}...`,
        filters: {},
        resultsCount: fetchedContacts.length,
        createdAt: new Date(),
        contacts: fetchedContacts,
      };

      setSearchHistory((prev) => [newSearch, ...prev]);
      setRecoverDialogOpen(false);
      setDatasetId("");
      setRunId("");

      toast.success(`${fetchedContacts.length} contatos recuperados!`);
    } catch (error) {
      console.error("Recovery error:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao recuperar");
    } finally {
      setIsRecovering(false);
    }
  };

  const handleLoadSearch = (search: SearchQuery) => {
    setContacts(search.contacts);
    setSelectedContacts([]);
    toast.success(`Busca "${search.query}" carregada`);
  };

  const handleRefresh = () => {
    setContacts([]);
    setSelectedContacts([]);
    toast.success("Dados limpos");
  };

  const totalEmailsAvailable = contacts.filter((c) => c.email).length;
  const totalPhonesAvailable = contacts.filter((c) => c.mobileNumber).length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg gradient-primary">
                <Linkedin className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-foreground">
                  Leads Finder
                </h1>
                <p className="text-sm text-muted-foreground">
                  Powered by Apify
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Dialog open={recoverDialogOpen} onOpenChange={setRecoverDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" title="Recuperar busca">
                    <Download className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Recuperar Busca</DialogTitle>
                    <DialogDescription>
                      Informe o Dataset ID para recuperar os resultados de uma busca anterior.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="datasetId">Dataset ID *</Label>
                      <Input
                        id="datasetId"
                        value={datasetId}
                        onChange={(e) => setDatasetId(e.target.value)}
                        placeholder="Ex: PfH2NdRh3Rwc1WXYh"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="runId">Run ID (opcional)</Label>
                      <Input
                        id="runId"
                        value={runId}
                        onChange={(e) => setRunId(e.target.value)}
                        placeholder="Ex: Pt8bUAgELo75dnLI4"
                      />
                      <p className="text-xs text-muted-foreground">
                        Informe o Run ID para verificar se a busca já terminou
                      </p>
                    </div>
                    <Button 
                      onClick={handleRecoverDataset} 
                      disabled={isRecovering || !datasetId.trim()}
                      className="w-full"
                    >
                      {isRecovering ? "Recuperando..." : "Recuperar Dados"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
              <Button variant="ghost" size="icon" onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon">
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {/* Stats */}
        <div className="mb-6">
          <StatsCards
            totalContacts={contacts.length}
            emailsAvailable={totalEmailsAvailable}
            phonesAvailable={totalPhonesAvailable}
            searchesCount={searchHistory.length}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar - Search History */}
          <div className="lg:col-span-1">
            <Card className="p-4 shadow-card">
              <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary"></span>
                Histórico de Buscas
              </h2>
              <SearchHistory
                searches={searchHistory}
                onLoadSearch={handleLoadSearch}
              />
            </Card>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Search Form */}
            <Card className="p-6 shadow-card">
              <SearchForm onSearch={handleSearch} isLoading={isLoading} />
            </Card>

            {/* Results */}
            <Card className="p-6 shadow-card">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    Contatos
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {contacts.length} resultado{contacts.length !== 1 ? "s" : ""}
                    {selectedContacts.length > 0 && (
                      <span className="text-primary">
                        {" "}
                        • {selectedContacts.length} selecionado
                        {selectedContacts.length !== 1 ? "s" : ""}
                      </span>
                    )}
                  </p>
                </div>
                <ExportMenu
                  contacts={contacts}
                  selectedContacts={selectedContacts}
                />
              </div>
              <ContactsTable
                contacts={contacts}
                selectedContacts={selectedContacts}
                onSelectionChange={setSelectedContacts}
              />
            </Card>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-8 py-6">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>Leads Finder • Integrado com Apify</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
