import { useState, useEffect, useCallback, useRef } from "react";
import { FolderPlus, Send, Trash2, Users, Settings, Loader2, Shield } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ContactsTable } from "@/components/ContactsTable";
import { ExportMenu } from "@/components/ExportMenu";
import { ContactFilters, ContactFiltersState, FilterOptions, initialContactFilters } from "@/components/ContactFilters";
import { ContactsPagination } from "@/components/ContactsPagination";
import { CreateBaseDialog } from "@/components/CreateBaseDialog";
import { SendCampaignDialog } from "@/components/SendCampaignDialog";
import { ValidateEmailsDialog } from "@/components/ValidateEmailsDialog";
import { BulkTagActions } from "@/components/BulkTagActions";
import { TagFilterDropdown } from "@/components/TagFilterDropdown";
import { ManageTagsDialog } from "@/components/ManageTagsDialog";
import { EditContactDialog, ContactUpdates } from "@/components/EditContactDialog";
import { useBases } from "@/hooks/useBases";
import { useEmailTemplates } from "@/hooks/useEmailTemplates";
import { useTags } from "@/hooks/useTags";
import { LinkedInContact } from "@/types/contact";
import { toast } from "sonner";
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
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const BasesPage = () => {
  const { 
    bases, 
    createBase, 
    deleteBase, 
    loadBaseContactsPage, 
    getFilterOptions,
    deleteContacts, 
    getBouncedContactIds, 
    updateContact, 
    refreshBases 
  } = useBases();
  const { templates } = useEmailTemplates();
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
  
  const [selectedBaseId, setSelectedBaseId] = useState<string | null>(null);
  const [contacts, setContacts] = useState<LinkedInContact[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [contactFilters, setContactFilters] = useState<ContactFiltersState>(initialContactFilters);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({ jobTitles: [], companies: [], industries: [], cities: [] });
  const [tagFilterIds, setTagFilterIds] = useState<string[]>([]);
  const [bouncedContactIds, setBouncedContactIds] = useState<string[]>([]);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  
  // Debounce timer ref
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  
  const [createBaseDialogOpen, setCreateBaseDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [baseToDelete, setBaseToDelete] = useState<string | null>(null);
  const [sendCampaignDialogOpen, setSendCampaignDialogOpen] = useState(false);
  const [manageTagsDialogOpen, setManageTagsDialogOpen] = useState(false);
  const [validateEmailsDialogOpen, setValidateEmailsDialogOpen] = useState(false);
  const [deleteContactsDialogOpen, setDeleteContactsDialogOpen] = useState(false);
  const [contactsToDelete, setContactsToDelete] = useState<string[]>([]);
  const [deleteMode, setDeleteMode] = useState<'selected' | 'filtered'>('selected');
  const [editContactDialogOpen, setEditContactDialogOpen] = useState(false);
  const [contactToEdit, setContactToEdit] = useState<LinkedInContact | null>(null);

  // Load contacts page with filters
  const loadContacts = useCallback(async (
    baseId: string, 
    page: number, 
    size: number, 
    filters: ContactFiltersState,
    bounced: string[]
  ) => {
    setIsLoadingContacts(true);
    try {
      const result = await loadBaseContactsPage(baseId, page, size, filters, bounced);
      setContacts(result.contacts);
      setTotalCount(result.totalCount);
      
      // Refresh contact tags for loaded contacts
      if (result.contacts.length > 0) {
        const contactIds = result.contacts.map((c) => c.id);
        refreshContactTags(contactIds);
      }
    } finally {
      setIsLoadingContacts(false);
    }
  }, [loadBaseContactsPage, refreshContactTags]);

  // Reload contacts when page, pageSize, or filters change
  useEffect(() => {
    if (!selectedBaseId) return;
    
    // Clear any pending debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    // Debounce search input, but not other filter changes
    const hasSearchChanged = contactFilters.search !== '';
    const delay = hasSearchChanged ? 300 : 0;
    
    debounceRef.current = setTimeout(() => {
      loadContacts(selectedBaseId, currentPage, pageSize, contactFilters, bouncedContactIds);
    }, delay);
    
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [selectedBaseId, currentPage, pageSize, contactFilters, bouncedContactIds, loadContacts]);

  const totalPages = Math.ceil(totalCount / pageSize);
  const selectedBase = bases.find(b => b.id === selectedBaseId);

  const handleSelectBase = async (baseId: string) => {
    setSelectedBaseId(baseId);
    setCurrentPage(1);
    setContactFilters(initialContactFilters);
    setTagFilterIds([]);
    setSelectedContacts([]);
    
    // Load filter options and bounced contacts
    const [options, bounced] = await Promise.all([
      getFilterOptions(baseId),
      getBouncedContactIds(baseId)
    ]);
    setFilterOptions(options);
    setBouncedContactIds(bounced);
  };

  const handleFiltersChange = (newFilters: ContactFiltersState) => {
    setContactFilters(newFilters);
    setCurrentPage(1); // Reset to first page when filters change
    setSelectedContacts([]); // Clear selection when filters change
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    setSelectedContacts([]); // Clear selection when page changes
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1); // Reset to first page when page size changes
    setSelectedContacts([]);
  };

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

  const handleCreateBase = async (name: string, description: string) => {
    await createBase(name, description);
  };

  const handleDeleteBase = async () => {
    if (!baseToDelete) return;
    await deleteBase(baseToDelete);
    if (selectedBaseId === baseToDelete) {
      setSelectedBaseId(null);
      setContacts([]);
      setTotalCount(0);
      setBouncedContactIds([]);
    }
    setBaseToDelete(null);
    setDeleteDialogOpen(false);
  };

  const confirmDeleteBase = (baseId: string) => {
    setBaseToDelete(baseId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteSelected = () => {
    if (selectedContacts.length === 0) return;
    setContactsToDelete(selectedContacts);
    setDeleteMode('selected');
    setDeleteContactsDialogOpen(true);
  };

  const handleDeleteFiltered = () => {
    if (totalCount === 0) return;
    // For filtered delete, we'll delete all matching the current filters
    // This shows a warning about deleting filtered count
    setContactsToDelete(contacts.map(c => c.id));
    setDeleteMode('filtered');
    setDeleteContactsDialogOpen(true);
  };

  const confirmDeleteContacts = async () => {
    if (contactsToDelete.length === 0) return;
    
    const deletedCount = await deleteContacts(contactsToDelete);
    
    if (deletedCount > 0) {
      toast.success(`${deletedCount} contato${deletedCount > 1 ? 's' : ''} excluído${deletedCount > 1 ? 's' : ''}`);
      
      // Reload contacts for the current base
      if (selectedBaseId) {
        await loadContacts(selectedBaseId, currentPage, pageSize, contactFilters, bouncedContactIds);
        await refreshBases();
      }
      
      setSelectedContacts([]);
    }
    
    setContactsToDelete([]);
    setDeleteContactsDialogOpen(false);
  };

  const handleEditContact = (contact: LinkedInContact) => {
    setContactToEdit(contact);
    setEditContactDialogOpen(true);
  };

  const handleSaveContact = async (contactId: string, updates: ContactUpdates) => {
    const success = await updateContact(contactId, updates);
    if (success) {
      // Update local contacts state
      setContacts((prev) =>
        prev.map((c) =>
          c.id === contactId
            ? {
                ...c,
                email: updates.email ?? c.email,
                personalEmail: updates.personal_email ?? c.personalEmail,
                mobileNumber: updates.mobile_number ?? c.mobileNumber,
                companyPhone: updates.company_phone ?? c.companyPhone,
              }
            : c
        )
      );
    }
  };

  // Filter contacts by tags client-side (tag filtering is not done server-side)
  const displayedContacts = tagFilterIds.length > 0 
    ? contacts.filter((contact) => {
        const contactTags = getTagsForContact(contact.id);
        return tagFilterIds.some((tagId) => contactTags.some((t) => t.id === tagId));
      })
    : contacts;

  return (
    <div className="p-6">
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Base</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta base? Todos os contatos serão removidos. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteBase} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Contacts Confirmation Dialog */}
      <AlertDialog open={deleteContactsDialogOpen} onOpenChange={setDeleteContactsDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Contatos</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir {contactsToDelete.length} contato{contactsToDelete.length > 1 ? 's' : ''}
              {deleteMode === 'filtered' ? ' filtrado' : ' selecionado'}{contactsToDelete.length > 1 ? 's' : ''}? 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteContacts} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir {contactsToDelete.length} contato{contactsToDelete.length > 1 ? 's' : ''}
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

      {/* Edit Contact Dialog */}
      <EditContactDialog
        open={editContactDialogOpen}
        onOpenChange={setEditContactDialogOpen}
        contact={contactToEdit}
        onSave={handleSaveContact}
      />

      {/* Validate Emails Dialog */}
      <ValidateEmailsDialog
        open={validateEmailsDialogOpen}
        onOpenChange={setValidateEmailsDialogOpen}
        baseId={selectedBaseId}
        baseName={selectedBase?.name || ""}
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Minhas Bases</h1>
          <p className="text-sm text-muted-foreground">Gerencie suas bases de contatos</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setManageTagsDialogOpen(true)}>
            <Settings className="h-4 w-4 mr-2" />
            Tags
          </Button>
          <Button onClick={() => setCreateBaseDialogOpen(true)}>
            <FolderPlus className="h-4 w-4 mr-2" />
            Nova Base
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Bases List */}
        <div className="lg:col-span-1">
          <Card className="p-4 shadow-card">
            <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary"></span>
              Bases ({bases.length})
            </h2>
            <ScrollArea className="h-[calc(100vh-300px)]">
              <div className="space-y-2">
                {bases.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhuma base criada
                  </p>
                ) : (
                  bases.map((base) => (
                    <div
                      key={base.id}
                      className={cn(
                        "p-3 rounded-lg border cursor-pointer transition-colors group",
                        selectedBaseId === base.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50 hover:bg-muted/50"
                      )}
                      onClick={() => handleSelectBase(base.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground truncate">
                            {base.name}
                          </p>
                          {base.description && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {base.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className="text-xs">
                              <Users className="h-3 w-3 mr-1" />
                              {base.contact_count?.toLocaleString('pt-BR') || 0}
                            </Badge>
                            {base.created_at && (
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(base.created_at), "dd/MM/yy", { locale: ptBR })}
                              </span>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            confirmDeleteBase(base.id);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </Card>
        </div>

        {/* Contacts View */}
        <div className="lg:col-span-3">
          <Card className="p-6 shadow-card">
            {!selectedBaseId ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">
                  Selecione uma base
                </h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Escolha uma base na lista ao lado para visualizar e gerenciar seus contatos
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                      {selectedBase?.name}
                      {isLoadingContacts && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {totalCount.toLocaleString('pt-BR')} contato{totalCount !== 1 ? "s" : ""}
                      {selectedContacts.length > 0 && (
                        <span className="text-primary">
                          {" "}• {selectedContacts.length} selecionado{selectedContacts.length !== 1 ? "s" : ""}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {totalCount > 0 && (
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
                      </>
                    )}
                    {totalCount > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setValidateEmailsDialogOpen(true)}
                      >
                        <Shield className="h-4 w-4 mr-2" />
                        Validar Emails
                      </Button>
                    )}
                    {templates.length > 0 && totalCount > 0 && (
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
                    <ExportMenu
                      contacts={displayedContacts}
                      selectedContacts={selectedContacts}
                    />
                  </div>
                </div>

                {selectedBaseId && (
                  <div className="mb-4">
                    <ContactFilters
                      filters={contactFilters}
                      onFiltersChange={handleFiltersChange}
                      filterOptions={filterOptions}
                      selectedCount={selectedContacts.length}
                      onDeleteSelected={handleDeleteSelected}
                      onDeleteFiltered={handleDeleteFiltered}
                      filteredCount={totalCount}
                      totalCount={selectedBase?.contact_count || 0}
                      bouncedCount={bouncedContactIds.length}
                      isLoading={isLoadingContacts}
                    />
                  </div>
                )}

                <ContactsTable
                  contacts={displayedContacts}
                  selectedContacts={selectedContacts}
                  onSelectionChange={setSelectedContacts}
                  tags={tags}
                  getTagsForContact={getTagsForContact}
                  onToggleContactTag={handleToggleContactTag}
                  onCreateTag={createTag}
                  onEditContact={handleEditContact}
                />

                {totalPages > 1 && (
                  <ContactsPagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    pageSize={pageSize}
                    totalCount={totalCount}
                    onPageChange={handlePageChange}
                    onPageSizeChange={handlePageSizeChange}
                    isLoading={isLoadingContacts}
                  />
                )}
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default BasesPage;
