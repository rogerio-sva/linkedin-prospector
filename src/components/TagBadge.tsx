import { Tag } from "@/hooks/useTags";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface TagBadgeProps {
  tag: Tag;
  onRemove?: () => void;
  size?: "sm" | "md";
  className?: string;
}

export const TagBadge = ({ tag, onRemove, size = "sm", className }: TagBadgeProps) => {
  const sizeClasses = size === "sm" 
    ? "text-xs px-1.5 py-0.5 gap-1" 
    : "text-sm px-2 py-1 gap-1.5";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium",
        sizeClasses,
        className
      )}
      style={{
        backgroundColor: `${tag.color}20`,
        color: tag.color,
        border: `1px solid ${tag.color}40`,
      }}
    >
      <span
        className={cn("rounded-full", size === "sm" ? "w-1.5 h-1.5" : "w-2 h-2")}
        style={{ backgroundColor: tag.color }}
      />
      {tag.name}
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="hover:opacity-70 transition-opacity"
        >
          <X className={size === "sm" ? "h-3 w-3" : "h-4 w-4"} />
        </button>
      )}
    </span>
  );
};
