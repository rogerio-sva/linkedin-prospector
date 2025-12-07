import { useState } from "react";
import { Tag } from "@/hooks/useTags";
import { TagBadge } from "./TagBadge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tags, Plus, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface BulkTagActionsProps {
  tags: Tag[];
  selectedContactIds: string[];
  onAddTag: (contactIds: string[], tagId: string) => Promise<number>;
  onRemoveTag: (contactIds: string[], tagId: string) => Promise<number>;
  disabled?: boolean;
}

export const BulkTagActions = ({
  tags,
  selectedContactIds,
  onAddTag,
  onRemoveTag,
  disabled = false,
}: BulkTagActionsProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<"add" | "remove">("add");

  const handleTagAction = async (tagId: string) => {
    const tag = tags.find((t) => t.id === tagId);
    if (!tag) return;

    if (mode === "add") {
      const count = await onAddTag(selectedContactIds, tagId);
      if (count > 0) {
        toast.success(`Tag "${tag.name}" adicionada a ${count} contato(s)`);
      } else {
        toast.info("Todos os contatos já têm essa tag");
      }
    } else {
      const count = await onRemoveTag(selectedContactIds, tagId);
      if (count > 0) {
        toast.success(`Tag "${tag.name}" removida de ${count} contato(s)`);
      } else {
        toast.info("Nenhum contato tinha essa tag");
      }
    }
    setIsOpen(false);
  };

  if (selectedContactIds.length === 0) return null;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          <Tags className="h-4 w-4 mr-2" />
          Tags ({selectedContactIds.length})
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2 bg-popover" align="start">
        <div className="space-y-2">
          {/* Mode toggle */}
          <div className="flex gap-1 p-1 bg-muted rounded-md">
            <button
              onClick={() => setMode("add")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-xs font-medium transition-colors",
                mode === "add"
                  ? "bg-background shadow-sm"
                  : "hover:bg-background/50"
              )}
            >
              <Plus className="h-3 w-3" />
              Adicionar
            </button>
            <button
              onClick={() => setMode("remove")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-xs font-medium transition-colors",
                mode === "remove"
                  ? "bg-background shadow-sm"
                  : "hover:bg-background/50"
              )}
            >
              <Minus className="h-3 w-3" />
              Remover
            </button>
          </div>

          <p className="text-xs text-muted-foreground px-1">
            {mode === "add" ? "Adicionar tag aos" : "Remover tag dos"}{" "}
            {selectedContactIds.length} contato(s) selecionado(s)
          </p>

          {/* Tags list */}
          <div className="max-h-[200px] overflow-y-auto space-y-1">
            {tags.map((tag) => (
              <button
                key={tag.id}
                onClick={() => handleTagAction(tag.id)}
                className="w-full flex items-center px-2 py-1.5 rounded-md text-sm transition-colors hover:bg-muted"
              >
                <TagBadge tag={tag} size="sm" />
              </button>
            ))}

            {tags.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-2">
                Nenhuma tag criada
              </p>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
