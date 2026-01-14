import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { KanbanCard } from "./KanbanCard";
import { CRMContact, CRMStage } from "@/hooks/useCRM";

interface KanbanColumnProps {
  stage: CRMStage;
  contacts: CRMContact[];
  onOpenDetail: (contact: CRMContact) => void;
  onMarkLinkedIn: (contactId: string) => void;
  onDropContact: (contactId: string, stage: string) => void;
}

export function KanbanColumn({ 
  stage, 
  contacts, 
  onOpenDetail, 
  onMarkLinkedIn,
  onDropContact 
}: KanbanColumnProps) {
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.add("bg-accent/50");
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.currentTarget.classList.remove("bg-accent/50");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.remove("bg-accent/50");
    const contactId = e.dataTransfer.getData("contactId");
    if (contactId) {
      onDropContact(contactId, stage.name);
    }
  };

  const handleDragStart = (e: React.DragEvent, contactId: string) => {
    e.dataTransfer.setData("contactId", contactId);
  };

  return (
    <div 
      className="flex flex-col min-w-[280px] max-w-[280px] bg-muted/30 rounded-lg border border-border/50"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div 
        className="flex items-center justify-between p-3 border-b border-border/50"
        style={{ borderTopColor: stage.color, borderTopWidth: 3 }}
      >
        <div className="flex items-center gap-2">
          <div 
            className="w-3 h-3 rounded-full" 
            style={{ backgroundColor: stage.color }}
          />
          <span className="font-medium text-sm">{stage.name}</span>
        </div>
        <Badge variant="secondary" className="text-xs">
          {contacts.length}
        </Badge>
      </div>
      
      <ScrollArea className="flex-1 p-2" style={{ maxHeight: "calc(100vh - 280px)" }}>
        <div className="space-y-2">
          {contacts.map((contact) => (
            <div
              key={contact.id}
              draggable
              onDragStart={(e) => handleDragStart(e, contact.id)}
              className="cursor-grab active:cursor-grabbing"
            >
              <KanbanCard
                contact={contact}
                onOpenDetail={onOpenDetail}
                onMarkLinkedIn={onMarkLinkedIn}
              />
            </div>
          ))}
          {contacts.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Nenhum contato
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
