import { useState } from "react";
import { useBases } from "@/hooks/useBases";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Kanban, Users } from "lucide-react";

export default function CRMPage() {
  const [selectedBaseId, setSelectedBaseId] = useState<string>("");
  const [selectedContact, setSelectedContact] = useState<CRMContact | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const { bases } = useBases();
  const { data: stages = [], isLoading: stagesLoading } = useCRMStages();
  const { data: teamMembers = [] } = useTeamMembers();
  const { data: contacts = [], isLoading: contactsLoading } = useCRMContacts(selectedBaseId || null);

  const updateStage = useUpdateContactStage();
  const markLinkedIn = useMarkLinkedInContacted();
  const assignContact = useAssignContact();
  const addActivity = useAddActivity();

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
          <div className="flex items-end gap-4">
            <div className="space-y-2">
              <Label>Selecione uma Base</Label>
              <Select value={selectedBaseId} onValueChange={setSelectedBaseId}>
                <SelectTrigger className="w-[300px]">
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
          </div>

          {!selectedBaseId ? (
            <div className="text-center py-16 text-muted-foreground">
              Selecione uma base para visualizar o Kanban
            </div>
          ) : (
            <KanbanBoard
              stages={stages}
              contacts={contacts}
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
    </div>
  );
}
