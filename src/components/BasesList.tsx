import { useState } from 'react';
import { Database, Plus, Trash2, Users, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface Base {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  contact_count?: number;
}

interface BasesListProps {
  bases: Base[];
  selectedBaseId: string | null;
  onSelectBase: (base: Base) => void;
  onCreateBase: () => void;
  onDeleteBase: (baseId: string) => void;
}

export function BasesList({
  bases,
  selectedBaseId,
  onSelectBase,
  onCreateBase,
  onDeleteBase,
}: BasesListProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [baseToDelete, setBaseToDelete] = useState<Base | null>(null);

  const handleDeleteClick = (e: React.MouseEvent, base: Base) => {
    e.stopPropagation();
    setBaseToDelete(base);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (baseToDelete) {
      onDeleteBase(baseToDelete.id);
      setBaseToDelete(null);
    }
    setDeleteDialogOpen(false);
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Database className="h-5 w-5" />
            Bases de Contatos
          </CardTitle>
          <Button size="sm" onClick={onCreateBase}>
            <Plus className="h-4 w-4 mr-1" />
            Nova
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[300px]">
          {bases.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              Nenhuma base criada ainda.
              <br />
              Crie uma base para salvar seus contatos.
            </div>
          ) : (
            <div className="space-y-1 p-2">
              {bases.map((base) => (
                <div
                  key={base.id}
                  onClick={() => onSelectBase(base)}
                  className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedBaseId === base.id
                      ? 'bg-primary/10 border border-primary/20'
                      : 'hover:bg-muted/50'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{base.name}</span>
                      <Badge variant="secondary" className="text-xs">
                        <Users className="h-3 w-3 mr-1" />
                        {base.contact_count || 0}
                      </Badge>
                    </div>
                    {base.description && (
                      <p className="text-xs text-muted-foreground truncate mt-1">
                        {base.description}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(base.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                      onClick={(e) => handleDeleteClick(e, base)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Base</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a base "{baseToDelete?.name}"?
              <br />
              Todos os {baseToDelete?.contact_count || 0} contatos serão perdidos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
