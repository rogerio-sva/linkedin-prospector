import { useState } from "react";
import { Mail, Plus, Trash2, Edit, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { EmailTemplate } from "@/hooks/useEmailTemplates";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface EmailTemplatesListProps {
  templates: EmailTemplate[];
  isLoading: boolean;
  onCreateTemplate: () => void;
  onEditTemplate: (template: EmailTemplate) => void;
  onDeleteTemplate: (id: string) => Promise<boolean>;
  onPreviewTemplate: (template: EmailTemplate) => void;
}

export const EmailTemplatesList = ({
  templates,
  isLoading,
  onCreateTemplate,
  onEditTemplate,
  onDeleteTemplate,
  onPreviewTemplate,
}: EmailTemplatesListProps) => {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<string | null>(null);

  const handleDeleteClick = (id: string) => {
    setTemplateToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (templateToDelete) {
      await onDeleteTemplate(templateToDelete);
      setTemplateToDelete(null);
      setDeleteDialogOpen(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="p-4 shadow-card">
        <div className="flex items-center gap-2 mb-4">
          <Mail className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">
            Templates de Email
          </h2>
        </div>
        <div className="text-sm text-muted-foreground text-center py-8">
          Carregando templates...
        </div>
      </Card>
    );
  }

  return (
    <>
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir template?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O template será excluído permanentemente.
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

      <Card className="p-4 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">
              Templates de Email
            </h2>
            <Badge variant="secondary" className="text-xs">
              {templates.length}
            </Badge>
          </div>
          <Button size="sm" variant="outline" onClick={onCreateTemplate}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {templates.length === 0 ? (
          <div className="text-center py-8">
            <Mail className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground mb-3">
              Nenhum template criado
            </p>
            <Button size="sm" onClick={onCreateTemplate}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Template
            </Button>
          </div>
        ) : (
          <ScrollArea className="h-[300px]">
            <div className="space-y-2">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className="group p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-foreground truncate">
                        {template.name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {template.subject}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(template.updatedAt, {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </span>
                        {template.variables.length > 0 && (
                          <Badge variant="outline" className="text-xs">
                            {template.variables.length} variáveis
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => onPreviewTemplate(template)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => onEditTemplate(template)}
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => handleDeleteClick(template.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </Card>
    </>
  );
};
