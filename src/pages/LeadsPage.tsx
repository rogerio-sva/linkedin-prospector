import { useState, useMemo, useEffect, useCallback } from "react";
import { Download, RefreshCw, FolderPlus, Send, Settings, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SearchForm } from "@/components/SearchForm";
import { ContactsTable } from "@/components/ContactsTable";
import { SearchHistory } from "@/components/SearchHistory";
import { ExportMenu } from "@/components/ExportMenu";
import { StatsCards } from "@/components/StatsCards";
import { SearchProgress } from "@/components/SearchProgress";
import { LegacyContactFilters, ContactFiltersState, filterContacts } from "@/components/ContactFilters";
import { BasesList, Base } from "@/components/BasesList";
import { CreateBaseDialog } from "@/components/CreateBaseDialog";
import { AddToBaseDialog } from "@/components/AddToBaseDialog";
import { SendCampaignDialog } from "@/components/SendCampaignDialog";
import { BulkTagActions } from "@/components/BulkTagActions";
import { TagFilterDropdown } from "@/components/TagFilterDropdown";
import { ManageTagsDialog } from "@/components/ManageTagsDialog";
import { RecentSearches } from "@/components/RecentSearches";
import { useBases } from "@/hooks/useBases";
import { useEmailTemplates } from "@/hooks/useEmailTemplates";
import { useTags } from "@/hooks/useTags";
import { useSearchRuns, SearchRun } from "@/hooks/useSearchRuns";
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
import { ScrollArea } from "@/components/ui/scroll-area";

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
  isBounced: "",
};

const LeadsPage = () => {
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

  // Email Templates for campaign
  const { templates } = useEmailTemplates();
  const [sendCampaignDialogOpen, setSendCampaignDialogOpen] = useState(false);

  // Tags state
  const {
    tags,
    getTagsForContact,
    addTagToContact,
    removeTagFromContact,
    addTagToContacts,
    removeTagFromContacts,
    createTag,
    updateTag,
    deleteTag,
    refreshContactTags,
  } = useTags();
  const [manageTagsDialogOpen, setManageTagsDialogOpen] = useState(false);
  const [tagFilterIds, setTagFilterIds] = useState<string[]>([]);

  // Search runs persistence
  const { searchRuns, activeRun, clearActiveRun, deleteRun, refreshRuns } = useSearchRuns();
  const [duplicateSearchDialogOpen, setDuplicateSearchDialogOpen] = useState(false);
  const [pendingFilters, setPendingFilters] = useState<SearchFilters | null>(null);

  // Auto-resume active search on page load
  useEffect(() => {
    if (activeRun && !activeSearch) {
      const filters = activeRun.filters as SearchFilters || {};
      setActiveSearch({
        runId: activeRun.run_id,
        datasetId: activeRun.dataset_id || "",
        fetchCount: activeRun.fetch_count || 1000,
        filters,
      });
      toast.info("Busca em andamento detectada. Retomando progresso...");
    }
  }, [activeRun]);

  // Load contact tags when contacts change
  useEffect(() => {
    if (contacts.length > 0) {
      const contactIds = contacts.map((c) => c.id);
      refreshContactTags(contactIds);
    }
  }, [contacts]);

  // Filtered contacts (by text filters and tags)
  const filteredContacts = useMemo(() => {
    let result = filterContacts(contacts, contactFilters);
    
    // Filter by tags if any selected
    if (tagFilterIds.length > 0) {
      result = result.filter((contact) => {
        const contactTags = getTagsForContact(contact.id);
        return tagFilterIds.some((tagId) => contactTags.some((t) => t.id === tagId));
      });
    }
    
    return result;
  }, [contacts, contactFilters, tagFilterIds, getTagsForContact]);

  const handleToggleContactTag = async (contactId: string, tagId: string) => {
    const contactTags = getTagsForContact(contactId);
    const hasTag = contactTags.some((t) => t.id === tagId);

    if (hasTag) {
      await removeTagFromContact(contactId, tagId);
    } else {
      await addTagToContact(contactId, tagId);
    }
  };

  const handleToggleTagFilter = (tagId: string) => {
    setTagFilterIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const handleSearch = async (filters: SearchFilters, forceNew = false) => {
    // Only block if there's an active search with the SAME filters (prevent duplicate costs)
    // Otherwise, let backend handle reuse logic
    if (!forceNew && activeSearch) {
      // Compare filters - only block if they're the same
      const currentFilters = activeSearch.filters;
      const isSameSearch = 
        JSON.stringify(filters.contactJobTitle || []) === JSON.stringify(currentFilters.contactJobTitle || []) &&
        JSON.stringify(filters.contactLocation || []) === JSON.stringify(currentFilters.contactLocation || []) &&
        JSON.stringify(filters.companyIndustry || []) === JSON.stringify(currentFilters.companyIndustry || []);
      
      if (isSameSearch) {
        toast.info("Essa busca já está em andamento. Aguarde a conclusão.");
        return;
      }
    }

    setIsLoading(true);

    try {
      console.log("Starting search with filters:", filters);

      const { data, error } = await supabase.functions.invoke("search-leads", {
        body: { ...filters, forceNew },
      });

      if (error) {
        console.error("Edge function error:", error);
        throw new Error(error.message || "Erro ao buscar leads");
      }

      if (!data.success) {
        console.error("API error:", data.error);
        throw new Error(data.error);
      }

      // If reused an existing search
      if (data.reused) {
        toast.info(data.message || "Reaproveitando busca existente");
        
        if (data.status === "SUCCEEDED") {
          // Fetch results directly
          const { data: fetchData, error: fetchError } = await supabase.functions.invoke("fetch-dataset", {
            body: { datasetId: data.datasetId, runId: data.runId },
          });

          if (fetchError) throw new Error(fetchError.message);

          if (fetchData.contacts) {
            const fetchedContacts = fetchData.contacts.map((contact: LinkedInContact) => ({
              ...contact,
              createdAt: new Date(contact.createdAt),
            }));
            setContacts(fetchedContacts);
            toast.success(`${fetchedContacts.length} contatos carregados da busca anterior!`);
          }
          setIsLoading(false);
          return;
        }
      }

      setActiveSearch({
        runId: data.runId,
        datasetId: data.datasetId,
        fetchCount: data.fetchCount,
        filters,
      });

      setSelectedBaseId(null);
      refreshRuns();
      toast.success(data.reused ? "Retomando busca existente..." : "Busca iniciada! Acompanhe o progresso abaixo.");
    } catch (error) {
      console.error("Search error:", error);
      toast.error(error instanceof Error ? error.message : "Erro desconhecido");
    } finally {
      setIsLoading(false);
    }
  };

  const handleForceNewSearch = () => {
    setDuplicateSearchDialogOpen(false);
    if (pendingFilters) {
      handleSearch(pendingFilters, true);
      setPendingFilters(null);
    }
  };

  const handleSearchComplete = (fetchedContacts: LinkedInContact[]) => {
    if (!activeSearch) return;

    setContacts(fetchedContacts);
    setSelectedContacts([]);
    setContactFilters(initialContactFilters);
    setTagFilterIds([]);

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
    clearActiveRun();
    refreshRuns();
  };

  const handleSearchCancel = () => {
    setActiveSearch(null);
    clearActiveRun();
    toast.info("Busca cancelada. Os dados ainda podem estar sendo processados no Apify.");
  };

  const handleResumeRun = useCallback(async (run: SearchRun) => {
    try {
      const { data, error } = await supabase.functions.invoke("resurrect-run", {
        body: { runId: run.run_id, timeoutSecs: 3600 },
      });

      if (error) throw new Error(error.message);

      if (data.success) {
        const filters = run.filters as SearchFilters || {};
        setActiveSearch({
          runId: run.run_id,
          datasetId: data.datasetId || run.dataset_id || "",
          fetchCount: run.fetch_count || 1000,
          filters,
        });
        refreshRuns();
        toast.success("Busca retomada! Continuando de onde parou...");
      } else {
        throw new Error(data.error || "Falha ao retomar busca");
      }
    } catch (err) {
      console.error("Error resuming run:", err);
      toast.error(`Erro ao retomar: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
    }
  }, [refreshRuns]);

  const handleRecoverData = useCallback((fetchedContacts: LinkedInContact[]) => {
    setContacts(fetchedContacts);
    setSelectedContacts([]);
    setContactFilters(initialContactFilters);
    setSelectedBaseId(null);
    setTagFilterIds([]);
  }, []);

  const handleSelectRecentRun = (run: SearchRun) => {
    if (run.dataset_id) {
      setDatasetId(run.dataset_id);
      setRunId(run.run_id);
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
      setContactFilters(initialContactFilters);
      setSelectedBaseId(null);
      setTagFilterIds([]);

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
    setTagFilterIds([]);
    toast.success(`Busca "${search.query}" carregada`);
  };

  const handleSelectBase = async (base: Base) => {
    setSelectedBaseId(base.id);
    const baseContacts = await loadBaseContacts(base.id);
    setContacts(baseContacts);
    setSelectedContacts([]);
    setContactFilters(initialContactFilters);
    setTagFilterIds([]);
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
    setTagFilterIds([]);
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
    <div className="p-6">
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

      {/* Send Campaign Dialog */}
      <SendCampaignDialog
        open={sendCampaignDialogOpen}
        onOpenChange={setSendCampaignDialogOpen}
        templates={templates}
        bases={bases}
        contacts={contacts}
        selectedContacts={selectedContacts}
        selectedBaseId={selectedBaseId}
      />

      {/* Manage Tags Dialog */}
      <ManageTagsDialog
        open={manageTagsDialogOpen}
        onOpenChange={setManageTagsDialogOpen}
        tags={tags}
        onCreateTag={createTag}
        onUpdateTag={updateTag}
        onDeleteTag={deleteTag}
      />

      {/* Duplicate Search Warning Dialog */}
      <AlertDialog open={duplicateSearchDialogOpen} onOpenChange={setDuplicateSearchDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Busca já em andamento
            </AlertDialogTitle>
            <AlertDialogDescription>
              {activeSearch 
                ? "Você já tem uma busca em andamento. Iniciar outra busca pode gerar custos duplicados no Apify."
                : activeRun?.status === "TIMED-OUT" 
                  ? "Você tem uma busca expirada. Você pode retomar ela ou recuperar os contatos já coletados."
                  : "Existe uma busca recente. Você pode reutilizar os dados ou iniciar uma nova."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleForceNewSearch}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Iniciar nova mesmo assim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Header Actions */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Buscar Leads</h1>
          <p className="text-sm text-muted-foreground">Encontre contatos B2B qualificados</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setManageTagsDialogOpen(true)}>
            <Settings className="h-4 w-4 mr-2" />
            Tags
          </Button>
          <Dialog open={recoverDialogOpen} onOpenChange={setRecoverDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" title="Recuperar busca">
                <Download className="h-4 w-4 mr-2" />
                Recuperar
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Recuperar Busca</DialogTitle>
                <DialogDescription>
                  Selecione uma busca recente ou informe o Dataset ID manualmente.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {/* Recent runs list */}
                {searchRuns.filter(r => r.dataset_id && (r.status === "SUCCEEDED" || r.status === "TIMED-OUT")).length > 0 && (
                  <div className="space-y-2">
                    <Label>Buscas Recentes</Label>
                    <ScrollArea className="h-[150px] rounded-md border p-2">
                      <div className="space-y-2">
                        {searchRuns
                          .filter(r => r.dataset_id && (r.status === "SUCCEEDED" || r.status === "TIMED-OUT"))
                          .slice(0, 5)
                          .map((run) => (
                            <button
                              key={run.id}
                              onClick={() => handleSelectRecentRun(run)}
                              className={`w-full text-left p-2 rounded-md border transition-colors hover:bg-muted ${
                                datasetId === run.dataset_id ? 'bg-primary/10 border-primary' : ''
                              }`}
                            >
                              <p className="text-sm font-medium truncate">
                                {run.output_count.toLocaleString()} contatos
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                Dataset: {run.dataset_id?.slice(0, 15)}...
                              </p>
                            </button>
                          ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}
                
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
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Limpar
          </Button>
        </div>
      </div>

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
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3 space-y-6">
          {/* Recent Searches from DB */}
          <RecentSearches
            searchRuns={searchRuns}
            onDeleteRun={deleteRun}
            onResumeRun={handleResumeRun}
            onRecoverData={handleRecoverData}
          />

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
                  <>
                    {/* Tag filter */}
                    <TagFilterDropdown
                      tags={tags}
                      selectedTagIds={tagFilterIds}
                      onToggleTag={handleToggleTagFilter}
                      onClearFilters={() => setTagFilterIds([])}
                    />
                    
                    {/* Bulk tag actions */}
                    <BulkTagActions
                      tags={tags}
                      selectedContactIds={selectedContacts}
                      onAddTag={addTagToContacts}
                      onRemoveTag={removeTagFromContacts}
                    />
                    
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
                    {selectedBaseId && templates.length > 0 && (
                      <Button
                        size="sm"
                        onClick={() => setSendCampaignDialogOpen(true)}
                      >
                        <Send className="h-4 w-4 mr-2" />
                        Enviar Emails
                        {selectedContacts.length > 0 && (
                          <Badge variant="secondary" className="ml-2">
                            {selectedContacts.length}
                          </Badge>
                        )}
                      </Button>
                    )}
                  </>
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
                <LegacyContactFilters
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
              tags={tags}
              getTagsForContact={getTagsForContact}
              onToggleContactTag={handleToggleContactTag}
              onCreateTag={createTag}
            />
          </Card>
        </div>
      </div>
    </div>
  );
};

export default LeadsPage;
