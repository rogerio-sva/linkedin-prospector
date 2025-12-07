import { Tag } from "@/hooks/useTags";
import { TagBadge } from "./TagBadge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Filter, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface TagFilterDropdownProps {
  tags: Tag[];
  selectedTagIds: string[];
  onToggleTag: (tagId: string) => void;
  onClearFilters: () => void;
}

export const TagFilterDropdown = ({
  tags,
  selectedTagIds,
  onToggleTag,
  onClearFilters,
}: TagFilterDropdownProps) => {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Filter className="h-4 w-4" />
          Filtrar por Tag
          {selectedTagIds.length > 0 && (
            <Badge variant="secondary" className="h-5 w-5 p-0 flex items-center justify-center text-xs">
              {selectedTagIds.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2 bg-popover" align="start">
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <p className="text-xs font-medium text-muted-foreground">
              Filtrar por Tags
            </p>
            {selectedTagIds.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-1 text-xs"
                onClick={onClearFilters}
              >
                <X className="h-3 w-3 mr-1" />
                Limpar
              </Button>
            )}
          </div>

          <div className="max-h-[250px] overflow-y-auto space-y-1">
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
              <p className="text-xs text-muted-foreground text-center py-4">
                Nenhuma tag criada ainda
              </p>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
