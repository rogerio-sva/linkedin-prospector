import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tag } from "@/hooks/useTags";
import { TagBadge } from "./TagBadge";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
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

interface ManageTagsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tags: Tag[];
  onCreateTag: (name: string, color: string) => Promise<Tag | null>;
  onUpdateTag: (tagId: string, name: string, color: string) => Promise<boolean>;
  onDeleteTag: (tagId: string) => Promise<boolean>;
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

export const ManageTagsDialog = ({
  open,
  onOpenChange,
  tags,
  onCreateTag,
  onUpdateTag,
  onDeleteTag,
}: ManageTagsDialogProps) => {
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(PRESET_COLORS[0]);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [deleteTagId, setDeleteTagId] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!newTagName.trim()) return;
    setIsCreating(true);
    const result = await onCreateTag(newTagName.trim(), newTagColor);
    setIsCreating(false);
    if (result) {
      setNewTagName("");
    }
  };

  const startEdit = (tag: Tag) => {
    setEditingId(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditColor("");
  };

  const saveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    const success = await onUpdateTag(editingId, editName.trim(), editColor);
    if (success) {
      cancelEdit();
    }
  };

  const confirmDelete = async () => {
    if (!deleteTagId) return;
    await onDeleteTag(deleteTagId);
    setDeleteTagId(null);
  };

  const tagToDelete = tags.find((t) => t.id === deleteTagId);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Gerenciar Tags</DialogTitle>
            <DialogDescription>
              Crie, edite ou exclua tags para organizar seus contatos.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Create new tag */}
            <div className="space-y-2 p-3 border rounded-lg">
              <p className="text-sm font-medium">Nova Tag</p>
              <div className="flex gap-2">
                <Input
                  placeholder="Nome da tag"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newTagName.trim()) {
                      handleCreate();
                    }
                  }}
                />
                <Button onClick={handleCreate} disabled={!newTagName.trim() || isCreating}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setNewTagColor(color)}
                    className={cn(
                      "w-6 h-6 rounded-full transition-transform",
                      newTagColor === color && "ring-2 ring-offset-2 ring-primary"
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            {/* Tags list */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Tags Existentes ({tags.length})</p>
              <div className="max-h-[300px] overflow-y-auto space-y-2">
                {tags.map((tag) => (
                  <div
                    key={tag.id}
                    className="flex items-center justify-between p-2 border rounded-lg"
                  >
                    {editingId === tag.id ? (
                      <div className="flex-1 space-y-2">
                        <div className="flex gap-2">
                          <Input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="flex-1 h-8"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveEdit();
                              if (e.key === "Escape") cancelEdit();
                            }}
                          />
                          <Button size="sm" variant="ghost" onClick={saveEdit}>
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={cancelEdit}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="flex gap-1 flex-wrap">
                          {PRESET_COLORS.map((color) => (
                            <button
                              key={color}
                              onClick={() => setEditColor(color)}
                              className={cn(
                                "w-5 h-5 rounded-full transition-transform",
                                editColor === color && "ring-2 ring-offset-2 ring-primary"
                              )}
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                      </div>
                    ) : (
                      <>
                        <TagBadge tag={tag} size="md" />
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => startEdit(tag)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteTagId(tag.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))}

                {tags.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Nenhuma tag criada ainda
                  </p>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTagId} onOpenChange={() => setDeleteTagId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Tag</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a tag "{tagToDelete?.name}"? Ela será
              removida de todos os contatos. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
