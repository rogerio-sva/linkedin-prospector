import { useState } from "react";
import { Linkedin, Settings, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SearchForm } from "@/components/SearchForm";
import { ContactsTable } from "@/components/ContactsTable";
import { SearchHistory } from "@/components/SearchHistory";
import { ExportMenu } from "@/components/ExportMenu";
import { StatsCards } from "@/components/StatsCards";
import { LinkedInContact, SearchQuery, SearchFilters } from "@/types/contact";
import { mockContacts, mockSearchHistory } from "@/lib/mockData";
import { toast } from "sonner";

const Index = () => {
  const [contacts, setContacts] = useState<LinkedInContact[]>(mockContacts);
  const [searchHistory, setSearchHistory] =
    useState<SearchQuery[]>(mockSearchHistory);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [selectedSearchId, setSelectedSearchId] = useState<string>();
  const [isLoading, setIsLoading] = useState(false);

  const handleSearch = async (filters: SearchFilters) => {
    setIsLoading(true);
    
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500));
    
    const queryString = [
      filters.keywords,
      filters.title,
      filters.location,
      filters.company,
    ]
      .filter(Boolean)
      .join(" ");

    const newSearch: SearchQuery = {
      id: `search-${Date.now()}`,
      query: queryString || "Nova busca",
      filters,
      resultsCount: mockContacts.length,
      createdAt: new Date(),
      contacts: mockContacts,
    };

    setSearchHistory((prev) => [newSearch, ...prev]);
    setContacts(mockContacts);
    setSelectedSearchId(newSearch.id);
    setSelectedContacts([]);
    setIsLoading(false);
    
    toast.success(`${mockContacts.length} contatos encontrados`);
  };

  const handleSelectSearch = (search: SearchQuery) => {
    setSelectedSearchId(search.id);
    setContacts(search.contacts);
    setSelectedContacts([]);
  };

  const handleDeleteSearch = (id: string) => {
    setSearchHistory((prev) => prev.filter((s) => s.id !== id));
    if (selectedSearchId === id) {
      setSelectedSearchId(undefined);
      setContacts([]);
    }
    toast.success("Busca removida do histórico");
  };

  const handleRefresh = () => {
    setContacts(mockContacts);
    setSearchHistory(mockSearchHistory);
    setSelectedContacts([]);
    setSelectedSearchId(undefined);
    toast.success("Dados atualizados");
  };

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
                  LinkedIn Contact Finder
                </h1>
                <p className="text-sm text-muted-foreground">
                  Powered by Apify
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
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
          <StatsCards contacts={contacts} searches={searchHistory} />
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
                onSelectSearch={handleSelectSearch}
                onDeleteSearch={handleDeleteSearch}
                selectedSearchId={selectedSearchId}
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
          <p>LinkedIn Contact Finder • Dados fictícios para demonstração</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
