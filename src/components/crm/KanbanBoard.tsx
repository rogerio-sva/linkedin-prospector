import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { KanbanColumn } from "./KanbanColumn";
import { CRMContact, CRMStage } from "@/hooks/useCRM";
import { Skeleton } from "@/components/ui/skeleton";

interface KanbanBoardProps {
  stages: CRMStage[];
  contacts: CRMContact[];
  isLoading: boolean;
  onOpenDetail: (contact: CRMContact) => void;
  onMarkLinkedIn: (contactId: string) => void;
  onMoveContact: (contactId: string, stage: string) => void;
}

export function KanbanBoard({ 
  stages, 
  contacts, 
  isLoading,
  onOpenDetail, 
  onMarkLinkedIn,
  onMoveContact 
}: KanbanBoardProps) {
  if (isLoading) {
    return (
      <div className="flex gap-4 p-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="min-w-[280px]">
            <Skeleton className="h-12 mb-2" />
            <Skeleton className="h-32 mb-2" />
            <Skeleton className="h-32" />
          </div>
        ))}
      </div>
    );
  }

  const getContactsByStage = (stageName: string) => {
    return contacts.filter(c => (c.crm_stage || "Novo Lead") === stageName);
  };

  return (
    <ScrollArea className="w-full whitespace-nowrap">
      <div className="flex gap-4 p-4">
        {stages.map((stage) => (
          <KanbanColumn
            key={stage.id}
            stage={stage}
            contacts={getContactsByStage(stage.name)}
            onOpenDetail={onOpenDetail}
            onMarkLinkedIn={onMarkLinkedIn}
            onDropContact={onMoveContact}
          />
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
