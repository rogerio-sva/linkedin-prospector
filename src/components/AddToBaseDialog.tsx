import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Plus, Database } from 'lucide-react';
import { Base } from './BasesList';

interface AddToBaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bases: Base[];
  contactCount: number;
  onAddToExistingBase: (baseId: string) => Promise<{ added: number; duplicates: number }>;
  onCreateAndAdd: (name: string) => Promise<{ added: number; duplicates: number }>;
}

export function AddToBaseDialog({
  open,
  onOpenChange,
  bases,
  contactCount,
  onAddToExistingBase,
  onCreateAndAdd,
}: AddToBaseDialogProps) {
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [selectedBaseId, setSelectedBaseId] = useState<string>('');
  const [newBaseName, setNewBaseName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [result, setResult] = useState<{ added: number; duplicates: number } | null>(null);

  const handleAdd = async () => {
    setIsAdding(true);
    setResult(null);
    
    try {
      let res: { added: number; duplicates: number };
      
      if (mode === 'new' && newBaseName.trim()) {
        res = await onCreateAndAdd(newBaseName.trim());
      } else if (mode === 'existing' && selectedBaseId) {
        res = await onAddToExistingBase(selectedBaseId);
      } else {
        return;
      }
      
      setResult(res);
      
      // Auto close after success
      setTimeout(() => {
        onOpenChange(false);
        setResult(null);
        setNewBaseName('');
        setSelectedBaseId('');
        setMode('existing');
      }, 2000);
    } finally {
      setIsAdding(false);
    }
  };

  const canAdd = mode === 'new' 
    ? newBaseName.trim().length > 0 
    : selectedBaseId.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar à Base</DialogTitle>
          <DialogDescription>
            Salvar {contactCount} contatos em uma base.
            Contatos duplicados (mesmo e-mail ou LinkedIn) serão ignorados.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="py-8 text-center">
            <div className="text-4xl mb-4">✅</div>
            <p className="text-lg font-medium">
              {result.added} contatos adicionados
            </p>
            {result.duplicates > 0 && (
              <p className="text-muted-foreground">
                {result.duplicates} duplicados ignorados
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="space-y-4 py-4">
              <RadioGroup
                value={mode}
                onValueChange={(v) => setMode(v as 'existing' | 'new')}
                className="space-y-3"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="existing" id="existing" />
                  <Label htmlFor="existing" className="cursor-pointer">
                    Adicionar a base existente
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="new" id="new" />
                  <Label htmlFor="new" className="cursor-pointer">
                    Criar nova base
                  </Label>
                </div>
              </RadioGroup>

              {mode === 'existing' ? (
                bases.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">
                    <Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Nenhuma base criada ainda.</p>
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => setMode('new')}
                    >
                      Criar nova base
                    </Button>
                  </div>
                ) : (
                  <ScrollArea className="h-[200px] border rounded-md">
                    <RadioGroup
                      value={selectedBaseId}
                      onValueChange={setSelectedBaseId}
                      className="p-2 space-y-1"
                    >
                      {bases.map((base) => (
                        <div
                          key={base.id}
                          className={`flex items-center space-x-3 p-3 rounded-lg cursor-pointer transition-colors ${
                            selectedBaseId === base.id
                              ? 'bg-primary/10 border border-primary/20'
                              : 'hover:bg-muted/50'
                          }`}
                          onClick={() => setSelectedBaseId(base.id)}
                        >
                          <RadioGroupItem value={base.id} id={base.id} />
                          <div className="flex-1">
                            <Label htmlFor={base.id} className="cursor-pointer font-medium">
                              {base.name}
                            </Label>
                            <Badge variant="secondary" className="ml-2 text-xs">
                              {base.contact_count || 0} contatos
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </RadioGroup>
                  </ScrollArea>
                )
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="newBaseName">Nome da nova base</Label>
                  <div className="flex gap-2">
                    <Plus className="h-4 w-4 mt-3 text-muted-foreground" />
                    <Input
                      id="newBaseName"
                      placeholder="Ex: Leads Seguro Auto"
                      value={newBaseName}
                      onChange={(e) => setNewBaseName(e.target.value)}
                      autoFocus
                    />
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleAdd} disabled={!canAdd || isAdding}>
                {isAdding ? 'Adicionando...' : `Adicionar ${contactCount} contatos`}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
