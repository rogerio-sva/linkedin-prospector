import { useState } from "react";
import { Tag } from "@/hooks/useTags";
import { TagBadge } from "./TagBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Plus, Tag as TagIcon, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface TagSelectorProps {
  tags: Tag[];
  selectedTagIds: string[];
  onToggleTag: (tagId: string) => void;
  onCreateTag?: (name: string, color: string) => Promise<Tag | null>;
  disabled?: boolean;
  size?: "sm" | "md";
}

const PRESET_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#6b7280",
];

export const TagSelector = ({
  tags,
  selectedTagIds,
  onToggleTag,
  onCreateTag,
  disabled = false,
  size = "sm",
}: TagSelectorProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(PRESET_COLORS[0]);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const handleCreateTag = async () => {
    if (!newTagName.trim() || !onCreateTag) return;

    setIsCreating(true);
    const newTag = await onCreateTag(newTagName.trim(), newTagColor);
    setIsCreating(false);

    if (newTag) {
      setNewTagName("");
      setShowCreateForm(false);
      onToggleTag(newTag.id);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          className="h-auto p-1"
        >
          <TagIcon className={size === "sm" ? "h-3 w-3" : "h-4 w-4"} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2 bg-popover" align="start">
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground px-1">
            Selecionar Tags
          </p>

          {/* Existing tags */}
          <div className="max-h-[200px] overflow-y-auto space-y-1">
            {tags.map((tag) => {
              const isSelected = selectedTagIds.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  onClick={() => onToggleTag(tag.id)}
                  className={cn(
                    "w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm transition-colors",
                    "hover:bg-muted",
                    isSelected && "bg-muted"
                  )}
                >
                  <TagBadge tag={tag} size="sm" />
                  {isSelected && <Check className="h-4 w-4 text-primary" />}
                </button>
              );
            })}

            {tags.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-2">
                Nenhuma tag criada
              </p>
            )}
          </div>

          {/* Create new tag */}
          {onCreateTag && (
            <div className="border-t pt-2">
              {!showCreateForm ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-xs"
                  onClick={() => setShowCreateForm(true)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Nova Tag
                </Button>
              ) : (
                <div className="space-y-2">
                  <Input
                    placeholder="Nome da tag"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    className="h-8 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newTagName.trim()) {
                        handleCreateTag();
                      }
                    }}
                  />
                  <div className="flex gap-1 flex-wrap">
                    {PRESET_COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => setNewTagColor(color)}
                        className={cn(
                          "w-5 h-5 rounded-full transition-transform",
                          newTagColor === color && "ring-2 ring-offset-2 ring-primary"
                        )}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 h-7 text-xs"
                      onClick={() => {
                        setShowCreateForm(false);
                        setNewTagName("");
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1 h-7 text-xs"
                      onClick={handleCreateTag}
                      disabled={!newTagName.trim() || isCreating}
                    >
                      {isCreating ? "..." : "Criar"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
