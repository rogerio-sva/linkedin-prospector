import { useState, useMemo } from "react";
import { FolderPlus, Send, Trash2, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ContactsTable } from "@/components/ContactsTable";
import { ExportMenu } from "@/components/ExportMenu";
import { ContactFilters, ContactFiltersState, filterContacts } from "@/components/ContactFilters";
import { CreateBaseDialog } from "@/components/CreateBaseDialog";
import { SendCampaignDialog } from "@/components/SendCampaignDialog";
import { useBases } from "@/hooks/useBases";
import { useEmailTemplates } from "@/hooks/useEmailTemplates";
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

const initialContactFilters: ContactFiltersState = {
  search: "",
  jobTitle: "",
  company: "",
  industry: "",
  city: "",
  hasEmail: "",
  hasPhone: "",
};

const BasesPage = () => {
  const { bases, createBase, deleteBase, loadBaseContacts } = useBases();
  const { templates } = useEmailTemplates();
  
  const [selectedBaseId, setSelectedBaseId] = useState<string | null>(null);
  const [contacts, setContacts] = useState<LinkedInContact[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [contactFilters, setContactFilters] = useState<ContactFiltersState>(initialContactFilters);
  
  const [createBaseDialogOpen, setCreateBaseDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [baseToDelete, setBaseToDelete] = useState<string | null>(null);
  const [sendCampaignDialogOpen, setSendCampaignDialogOpen] = useState(false);

  const filteredContacts = useMemo(
    () => filterContacts(contacts, contactFilters),
    [contacts, contactFilters]
  );

  const selectedBase = bases.find(b => b.id === selectedBaseId);

  const handleSelectBase = async (baseId: string) => {
    setSelectedBaseId(baseId);
    const baseContacts = await loadBaseContacts(baseId);
    setContacts(baseContacts);
    setSelectedContacts([]);
    setContactFilters(initialContactFilters);
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
    }
    setBaseToDelete(null);
    setDeleteDialogOpen(false);
  };

  const confirmDeleteBase = (baseId: string) => {
    setBaseToDelete(baseId);
    setDeleteDialogOpen(true);
  };

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

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Minhas Bases</h1>
          <p className="text-sm text-muted-foreground">Gerencie suas bases de contatos</p>
        </div>
        <Button onClick={() => setCreateBaseDialogOpen(true)}>
          <FolderPlus className="h-4 w-4 mr-2" />
          Nova Base
        </Button>
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
                              {base.contact_count || 0}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(base.created_at), "dd/MM/yy", { locale: ptBR })}
                            </span>
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
                    <h2 className="text-lg font-semibold text-foreground">
                      {selectedBase?.name}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {filteredContacts.length === contacts.length
                        ? `${contacts.length} contato${contacts.length !== 1 ? "s" : ""}`
                        : `${filteredContacts.length} de ${contacts.length} contatos`}
                      {selectedContacts.length > 0 && (
                        <span className="text-primary">
                          {" "}• {selectedContacts.length} selecionado{selectedContacts.length !== 1 ? "s" : ""}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {templates.length > 0 && contacts.length > 0 && (
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
                      contacts={filteredContacts}
                      selectedContacts={selectedContacts}
                    />
                  </div>
                </div>

                {contacts.length > 0 && (
                  <div className="mb-4">
                    <ContactFilters
                      contacts={contacts}
                      filters={contactFilters}
                      onFiltersChange={setContactFilters}
                      selectedCount={selectedContacts.length}
                      onDeleteSelected={() => {}}
                      onDeleteFiltered={() => {}}
                      filteredCount={filteredContacts.length}
                    />
                  </div>
                )}

                <ContactsTable
                  contacts={filteredContacts}
                  selectedContacts={selectedContacts}
                  onSelectionChange={setSelectedContacts}
                />
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default BasesPage;
