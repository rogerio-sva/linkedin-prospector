import { useState, useMemo } from "react";
import { useBases } from "@/hooks/useBases";
import { useTags } from "@/hooks/useTags";
import { 
  useCRMStages, 
  useCRMContacts, 
  useTeamMembers,
  useUpdateContactStage,
  useMarkLinkedInContacted,
  useAssignContact,
  useAddActivity,
  CRMContact 
} from "@/hooks/useCRM";
import { KanbanBoard } from "@/components/crm/KanbanBoard";
import { ContactDetailDrawer } from "@/components/crm/ContactDetailDrawer";
import { TeamManagement } from "@/components/crm/TeamManagement";
import { UpdateStagesByListDialog } from "@/components/crm/UpdateStagesByListDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Kanban, Users, X, Filter, ListChecks } from "lucide-react";

export default function CRMPage() {
  const [selectedBaseId, setSelectedBaseId] = useState<string>("");
  const [selectedContact, setSelectedContact] = useState<CRMContact | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [filterMember, setFilterMember] = useState<string>("");
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [updateStagesOpen, setUpdateStagesOpen] = useState(false);

  const { bases } = useBases();
  const { tags, contactTags } = useTags();
  const { data: stages = [], isLoading: stagesLoading } = useCRMStages();
  const { data: teamMembers = [] } = useTeamMembers();
  const { data: contacts = [], isLoading: contactsLoading } = useCRMContacts(selectedBaseId || null);

  const updateStage = useUpdateContactStage();
  const markLinkedIn = useMarkLinkedInContacted();
  const assignContact = useAssignContact();
  const addActivity = useAddActivity();

  // Filter contacts by member and tags
  const filteredContacts = useMemo(() => {
    let result = contacts;

    // Filter by assigned member
    if (filterMember) {
      result = result.filter(c => c.assigned_to === filterMember);
    }

    // Filter by tags
    if (filterTags.length > 0) {
      const contactIdsWithTags = new Set(
        contactTags
          .filter(ct => filterTags.includes(ct.tag_id))
          .map(ct => ct.contact_id)
      );
      result = result.filter(c => contactIdsWithTags.has(c.id));
    }

    return result;
  }, [contacts, filterMember, filterTags, contactTags]);

  const hasActiveFilters = filterMember || filterTags.length > 0;

  const clearFilters = () => {
    setFilterMember("");
    setFilterTags([]);
  };

  const toggleTagFilter = (tagId: string) => {
    setFilterTags(prev => 
      prev.includes(tagId) 
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  const handleOpenDetail = (contact: CRMContact) => {
    setSelectedContact(contact);
    setDetailOpen(true);
  };

  const handleMoveContact = (contactId: string, stage: string) => {
    updateStage.mutate({ contactId, stage });
  };

  const handleMarkLinkedIn = (contactId: string) => {
    markLinkedIn.mutate({ contactId });
  };

  const handleAssign = (contactId: string, assignedTo: string) => {
    assignContact.mutate({ contactId, assignedTo });
  };

  const handleAddActivity = (contactId: string, type: string, description: string, performedBy: string) => {
    addActivity.mutate({ contactId, activityType: type, description, performedBy });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">CRM</h1>
          <p className="text-muted-foreground">Gerencie seus leads em estágios de venda</p>
        </div>
        <Button onClick={() => setUpdateStagesOpen(true)} variant="outline" className="gap-2">
          <ListChecks className="h-4 w-4" />
          Atualizar Estágios
        </Button>
      </div>

      <Tabs defaultValue="kanban">
        <TabsList>
          <TabsTrigger value="kanban" className="gap-2">
            <Kanban className="h-4 w-4" /> Kanban
          </TabsTrigger>
          <TabsTrigger value="team" className="gap-2">
            <Users className="h-4 w-4" /> Equipe
          </TabsTrigger>
        </TabsList>

        <TabsContent value="kanban" className="space-y-4">
          {/* Filters Row */}
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label>Selecione uma Base</Label>
              <Select value={selectedBaseId} onValueChange={setSelectedBaseId}>
                <SelectTrigger className="w-[280px]">
                  <SelectValue placeholder="Escolha uma base de contatos" />
                </SelectTrigger>
                <SelectContent>
                  {bases.map((base) => (
                    <SelectItem key={base.id} value={base.id}>
                      {base.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Membro da Equipe</Label>
              <Select 
                value={filterMember || "__all__"} 
                onValueChange={(v) => setFilterMember(v === "__all__" ? "" : v)}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Todos os membros" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos os membros</SelectItem>
                  {teamMembers.map((member) => (
                    <SelectItem key={member.id} value={member.name}>
                      {member.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Filter className="h-3 w-3" /> Tags
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <Badge
                    key={tag.id}
                    variant={filterTags.includes(tag.id) ? "default" : "outline"}
                    className="cursor-pointer transition-colors"
                    style={{
                      backgroundColor: filterTags.includes(tag.id) ? tag.color : "transparent",
                      borderColor: tag.color,
                      color: filterTags.includes(tag.id) ? "white" : tag.color,
                    }}
                    onClick={() => toggleTagFilter(tag.id)}
                  >
                    {tag.name}
                  </Badge>
                ))}
              </div>
            </div>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="gap-1"
              >
                <X className="h-3 w-3" />
                Limpar filtros
              </Button>
            )}
          </div>

          {/* Active filters summary */}
          {hasActiveFilters && selectedBaseId && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Mostrando {filteredContacts.length} de {contacts.length} contatos</span>
              {filterMember && (
                <Badge variant="secondary" className="gap-1">
                  <Users className="h-3 w-3" />
                  {filterMember}
                </Badge>
              )}
              {filterTags.map(tagId => {
                const tag = tags.find(t => t.id === tagId);
                return tag ? (
                  <Badge 
                    key={tagId} 
                    variant="secondary"
                    style={{ backgroundColor: `${tag.color}20`, color: tag.color, borderColor: tag.color }}
                  >
                    {tag.name}
                  </Badge>
                ) : null;
              })}
            </div>
          )}

          {!selectedBaseId ? (
            <div className="text-center py-16 text-muted-foreground">
              Selecione uma base para visualizar o Kanban
            </div>
          ) : (
            <KanbanBoard
              stages={stages}
              contacts={filteredContacts}
              tags={tags}
              contactTags={contactTags}
              isLoading={stagesLoading || contactsLoading}
              onOpenDetail={handleOpenDetail}
              onMarkLinkedIn={handleMarkLinkedIn}
              onMoveContact={handleMoveContact}
            />
          )}
        </TabsContent>

        <TabsContent value="team">
          <div className="max-w-2xl">
            <TeamManagement />
          </div>
        </TabsContent>
      </Tabs>

      <ContactDetailDrawer
        contact={selectedContact}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        stages={stages}
        teamMembers={teamMembers}
        onStageChange={handleMoveContact}
        onAssign={handleAssign}
        onMarkLinkedIn={handleMarkLinkedIn}
        onAddActivity={handleAddActivity}
      />

      <UpdateStagesByListDialog
        open={updateStagesOpen}
        onOpenChange={setUpdateStagesOpen}
      />
    </div>
  );
}
