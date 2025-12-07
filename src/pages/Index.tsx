import { useState, useMemo } from "react";
import { Linkedin, Settings, RefreshCw, Download, FolderPlus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SearchForm } from "@/components/SearchForm";
import { ContactsTable } from "@/components/ContactsTable";
import { SearchHistory } from "@/components/SearchHistory";
import { ExportMenu } from "@/components/ExportMenu";
import { StatsCards } from "@/components/StatsCards";
import { SearchProgress } from "@/components/SearchProgress";
import { ContactFilters, ContactFiltersState, filterContacts } from "@/components/ContactFilters";
import { BasesList, Base } from "@/components/BasesList";
import { CreateBaseDialog } from "@/components/CreateBaseDialog";
import { AddToBaseDialog } from "@/components/AddToBaseDialog";
import { EmailTemplatesList } from "@/components/EmailTemplatesList";
import { CreateTemplateDialog } from "@/components/CreateTemplateDialog";
import { EditTemplateDialog } from "@/components/EditTemplateDialog";
import { TemplatePreviewDialog } from "@/components/TemplatePreviewDialog";
import { useBases } from "@/hooks/useBases";
import { useEmailTemplates, EmailTemplate } from "@/hooks/useEmailTemplates";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface ActiveSearch {
  runId: string;
  datasetId: string;
  fetchCount: number;
  filters: SearchFilters;
}

const initialContactFilters: ContactFiltersState = {
  search: "",
  jobTitle: "",
  company: "",
  industry: "",
  city: "",
  hasEmail: "",
  hasPhone: "",
};

const Index = () => {
  const [contacts, setContacts] = useState<LinkedInContact[]>([]);
  const [searchHistory, setSearchHistory] = useState<SearchQuery[]>(mockSearchHistory);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoverDialogOpen, setRecoverDialogOpen] = useState(false);
  const [datasetId, setDatasetId] = useState("");
  const [runId, setRunId] = useState("");
  const [activeSearch, setActiveSearch] = useState<ActiveSearch | null>(null);
  const [contactFilters, setContactFilters] = useState<ContactFiltersState>(initialContactFilters);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteType, setDeleteType] = useState<"selected" | "filtered">("selected");
  
  // Bases state
  const { bases, createBase, deleteBase, addContactsToBase, loadBaseContacts } = useBases();
  const [selectedBaseId, setSelectedBaseId] = useState<string | null>(null);
  const [createBaseDialogOpen, setCreateBaseDialogOpen] = useState(false);
  const [addToBaseDialogOpen, setAddToBaseDialogOpen] = useState(false);

  // Email Templates state
  const {
    templates,
    isLoading: isLoadingTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    renderTemplate,
  } = useEmailTemplates();
  const [createTemplateDialogOpen, setCreateTemplateDialogOpen] = useState(false);
  const [editTemplateDialogOpen, setEditTemplateDialogOpen] = useState(false);
  const [previewTemplateDialogOpen, setPreviewTemplateDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);

  const handleEditTemplate = (template: EmailTemplate) => {
    setSelectedTemplate(template);
    setEditTemplateDialogOpen(true);
  };

  const handlePreviewTemplate = (template: EmailTemplate) => {
    setSelectedTemplate(template);
    setPreviewTemplateDialogOpen(true);
  };

  // Filtered contacts
  const filteredContacts = useMemo(
    () => filterContacts(contacts, contactFilters),
    [contacts, contactFilters]
  );

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

      if (!data.success) {
        console.error("API error:", data.error);
        throw new Error(data.error);
      }

      // Search started successfully - show progress component
      setActiveSearch({
        runId: data.runId,
        datasetId: data.datasetId,
        fetchCount: data.fetchCount,
        filters,
      });

      // Clear base selection when doing a new search
      setSelectedBaseId(null);

      toast.success("Busca iniciada! Acompanhe o progresso abaixo.");
    } catch (error) {
      console.error("Search error:", error);
      toast.error(error instanceof Error ? error.message : "Erro desconhecido");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchComplete = (fetchedContacts: LinkedInContact[]) => {
    if (!activeSearch) return;

    setContacts(fetchedContacts);
    setSelectedContacts([]);
    setContactFilters(initialContactFilters);

    // Build query name from filters
    const queryParts: string[] = [];
    if (activeSearch.filters.contactJobTitle?.length) {
      queryParts.push(activeSearch.filters.contactJobTitle.join(", "));
    }
    if (activeSearch.filters.contactLocation?.length) {
      queryParts.push(activeSearch.filters.contactLocation.join(", "));
    }
    if (activeSearch.filters.companyIndustry?.length) {
      queryParts.push(activeSearch.filters.companyIndustry.join(", "));
    }

    const newSearch: SearchQuery = {
      id: `search-${Date.now()}`,
      query: queryParts.length > 0 ? queryParts.join(" | ") : "Busca personalizada",
      filters: activeSearch.filters,
      resultsCount: fetchedContacts.length,
      createdAt: new Date(),
      contacts: fetchedContacts,
    };

    setSearchHistory((prev) => [newSearch, ...prev]);
    setActiveSearch(null);
  };

  const handleSearchCancel = () => {
    setActiveSearch(null);
    toast.info("Busca cancelada. Os dados ainda podem estar sendo processados no Apify.");
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
      setContactFilters(initialContactFilters);
      setSelectedBaseId(null);

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
    setContactFilters(initialContactFilters);
    setSelectedBaseId(null);
    toast.success(`Busca "${search.query}" carregada`);
  };

  const handleSelectBase = async (base: Base) => {
    setSelectedBaseId(base.id);
    const baseContacts = await loadBaseContacts(base.id);
    setContacts(baseContacts);
    setSelectedContacts([]);
    setContactFilters(initialContactFilters);
    toast.success(`Base "${base.name}" carregada com ${baseContacts.length} contatos`);
  };

  const handleCreateBase = async (name: string, description: string) => {
    await createBase(name, description);
  };

  const handleDeleteBase = async (baseId: string) => {
    await deleteBase(baseId);
    if (selectedBaseId === baseId) {
      setSelectedBaseId(null);
      setContacts([]);
    }
  };

  const handleAddToExistingBase = async (baseId: string) => {
    const contactsToAdd = selectedContacts.length > 0
      ? contacts.filter((c) => selectedContacts.includes(c.id))
      : filteredContacts;
    
    return await addContactsToBase(baseId, contactsToAdd);
  };

  const handleCreateAndAdd = async (name: string) => {
    const newBase = await createBase(name, "");
    if (!newBase) {
      return { added: 0, duplicates: 0 };
    }
    
    const contactsToAdd = selectedContacts.length > 0
      ? contacts.filter((c) => selectedContacts.includes(c.id))
      : filteredContacts;
    
    return await addContactsToBase(newBase.id, contactsToAdd);
  };

  const handleRefresh = () => {
    setContacts([]);
    setSelectedContacts([]);
    setActiveSearch(null);
    setContactFilters(initialContactFilters);
    setSelectedBaseId(null);
    toast.success("Dados limpos");
  };

  const handleDeleteSelected = () => {
    setDeleteType("selected");
    setDeleteDialogOpen(true);
  };

  const handleDeleteFiltered = () => {
    setDeleteType("filtered");
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (deleteType === "selected") {
      const remaining = contacts.filter((c) => !selectedContacts.includes(c.id));
      setContacts(remaining);
      toast.success(`${selectedContacts.length} contato(s) excluído(s)`);
      setSelectedContacts([]);
    } else {
      const filteredIds = new Set(filteredContacts.map((c) => c.id));
      const remaining = contacts.filter((c) => !filteredIds.has(c.id));
      setContacts(remaining);
      toast.success(`${filteredContacts.length} contato(s) excluído(s)`);
      setContactFilters(initialContactFilters);
    }
    setDeleteDialogOpen(false);
  };

  const totalEmailsAvailable = contacts.filter((c) => c.email).length;
  const totalPhonesAvailable = contacts.filter((c) => c.mobileNumber).length;

  const contactsToAddCount = selectedContacts.length > 0 
    ? selectedContacts.length 
    : filteredContacts.length;

  return (
    <div className="min-h-screen bg-background">
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteType === "selected"
                ? `Tem certeza que deseja excluir ${selectedContacts.length} contato(s) selecionado(s)?`
                : `Tem certeza que deseja excluir ${filteredContacts.length} contato(s) filtrado(s)?`}
              {" "}Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Base Dialog */}
      <CreateBaseDialog
        open={createBaseDialogOpen}
        onOpenChange={setCreateBaseDialogOpen}
        onCreateBase={handleCreateBase}
      />

      {/* Add to Base Dialog */}
      <AddToBaseDialog
        open={addToBaseDialogOpen}
        onOpenChange={setAddToBaseDialogOpen}
        bases={bases}
        contactCount={contactsToAddCount}
        onAddToExistingBase={handleAddToExistingBase}
        onCreateAndAdd={handleCreateAndAdd}
      />

      {/* Create Template Dialog */}
      <CreateTemplateDialog
        open={createTemplateDialogOpen}
        onOpenChange={setCreateTemplateDialogOpen}
        onCreateTemplate={createTemplate}
      />

      {/* Edit Template Dialog */}
      <EditTemplateDialog
        open={editTemplateDialogOpen}
        onOpenChange={setEditTemplateDialogOpen}
        template={selectedTemplate}
        onUpdateTemplate={updateTemplate}
      />

      {/* Template Preview Dialog */}
      <TemplatePreviewDialog
        open={previewTemplateDialogOpen}
        onOpenChange={setPreviewTemplateDialogOpen}
        template={selectedTemplate}
        contacts={contacts}
        renderTemplate={renderTemplate}
      />

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
          {/* Sidebar - Bases and Search History */}
          <div className="lg:col-span-1 space-y-6">
            {/* Bases List */}
            <BasesList
              bases={bases}
              selectedBaseId={selectedBaseId}
              onSelectBase={handleSelectBase}
              onCreateBase={() => setCreateBaseDialogOpen(true)}
              onDeleteBase={handleDeleteBase}
            />

            {/* Search History */}
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

            {/* Email Templates */}
            <EmailTemplatesList
              templates={templates}
              isLoading={isLoadingTemplates}
              onCreateTemplate={() => setCreateTemplateDialogOpen(true)}
              onEditTemplate={handleEditTemplate}
              onDeleteTemplate={deleteTemplate}
              onPreviewTemplate={handlePreviewTemplate}
            />
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Search Form */}
            <Card className="p-6 shadow-card">
              <SearchForm onSearch={handleSearch} isLoading={isLoading || !!activeSearch} />
            </Card>

            {/* Search Progress */}
            {activeSearch && (
              <SearchProgress
                runId={activeSearch.runId}
                datasetId={activeSearch.datasetId}
                fetchCount={activeSearch.fetchCount}
                onComplete={handleSearchComplete}
                onCancel={handleSearchCancel}
              />
            )}

            {/* Results */}
            <Card className="p-6 shadow-card">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-foreground">
                      Contatos
                    </h2>
                    {selectedBaseId && (
                      <Badge variant="outline" className="text-xs">
                        Base selecionada
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {filteredContacts.length === contacts.length
                      ? `${contacts.length} resultado${contacts.length !== 1 ? "s" : ""}`
                      : `${filteredContacts.length} de ${contacts.length} contatos`}
                    {selectedContacts.length > 0 && (
                      <span className="text-primary">
                        {" "}
                        • {selectedContacts.length} selecionado
                        {selectedContacts.length !== 1 ? "s" : ""}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {contacts.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setAddToBaseDialogOpen(true)}
                    >
                      <FolderPlus className="h-4 w-4 mr-2" />
                      Salvar em Base
                      {selectedContacts.length > 0 && (
                        <Badge variant="secondary" className="ml-2">
                          {selectedContacts.length}
                        </Badge>
                      )}
                    </Button>
                  )}
                  <ExportMenu
                    contacts={filteredContacts}
                    selectedContacts={selectedContacts}
                  />
                </div>
              </div>

              {/* Contact Filters */}
              {contacts.length > 0 && (
                <div className="mb-4">
                  <ContactFilters
                    contacts={contacts}
                    filters={contactFilters}
                    onFiltersChange={setContactFilters}
                    selectedCount={selectedContacts.length}
                    onDeleteSelected={handleDeleteSelected}
                    onDeleteFiltered={handleDeleteFiltered}
                    filteredCount={filteredContacts.length}
                  />
                </div>
              )}

              <ContactsTable
                contacts={filteredContacts}
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
