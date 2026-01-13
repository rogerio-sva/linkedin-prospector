import { useState, useCallback } from "react";
import { Upload, FileSpreadsheet, Loader2, Check, X, ChevronDown } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { parseXLSFile, mapRowToContact, autoDetectMapping, ParsedRow, ContactImportData } from "@/lib/importUtils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ImportXLSDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: (baseId: string, baseName: string) => void;
  existingBases?: { id: string; name: string }[];
}

const IGNORE_VALUE = "__ignore__";

const TARGET_FIELDS = [
  { value: IGNORE_VALUE, label: "-- Ignorar --" },
  { value: "full_name", label: "Nome Completo" },
  { value: "email", label: "Email Corporativo" },
  { value: "personal_email", label: "Email Pessoal" },
  { value: "mobile_number", label: "Celular" },
  { value: "company_phone", label: "Telefone Empresa" },
  { value: "job_title", label: "Cargo" },
  { value: "company_name", label: "Empresa" },
  { value: "linkedin_url", label: "LinkedIn" },
  { value: "city", label: "Cidade" },
  { value: "state", label: "Estado" },
  { value: "country", label: "País" },
  { value: "industry", label: "Setor" },
];

const BATCH_SIZE = 500;

export function ImportXLSDialog({
  open,
  onOpenChange,
  onImportComplete,
  existingBases = [],
}: ImportXLSDialogProps) {
  const [step, setStep] = useState<"upload" | "mapping" | "importing">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [baseName, setBaseName] = useState("");
  const [baseMode, setBaseMode] = useState<"new" | "existing">("new");
  const [selectedBaseId, setSelectedBaseId] = useState<string>("");
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [importProgress, setImportProgress] = useState(0);
  const [importStats, setImportStats] = useState({ imported: 0, duplicates: 0, errors: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const resetState = () => {
    setStep("upload");
    setFile(null);
    setHeaders([]);
    setRows([]);
    setMapping({});
    setBaseName("");
    setBaseMode("new");
    setSelectedBaseId("");
    setSkipDuplicates(true);
    setImportProgress(0);
    setImportStats({ imported: 0, duplicates: 0, errors: 0 });
  };

  const handleClose = () => {
    resetState();
    onOpenChange(false);
  };

  const handleFileSelect = async (selectedFile: File) => {
    try {
      setFile(selectedFile);
      
      // Extract base name from file name
      const nameWithoutExtension = selectedFile.name.replace(/\.(xlsx?|csv)$/i, "");
      setBaseName(nameWithoutExtension);

      // Parse file
      const { headers: parsedHeaders, rows: parsedRows } = await parseXLSFile(selectedFile);
      setHeaders(parsedHeaders);
      setRows(parsedRows);

      // Auto-detect column mapping
      const autoMapping = autoDetectMapping(parsedHeaders);
      setMapping(autoMapping);

      setStep("mapping");
    } catch (error) {
      console.error("Error parsing file:", error);
      toast.error("Erro ao ler arquivo. Verifique se é um arquivo Excel válido.");
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && /\.(xlsx?|csv)$/i.test(droppedFile.name)) {
      handleFileSelect(droppedFile);
    } else {
      toast.error("Por favor, selecione um arquivo Excel (.xls ou .xlsx)");
    }
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleMappingChange = (header: string, targetField: string) => {
    setMapping((prev) => {
      const newMapping = { ...prev };
      if (targetField && targetField !== IGNORE_VALUE) {
        newMapping[header] = targetField;
      } else {
        delete newMapping[header];
      }
      return newMapping;
    });
  };

  const handleImport = async () => {
    setStep("importing");
    setImportProgress(0);
    setImportStats({ imported: 0, duplicates: 0, errors: 0 });

    let targetBaseId: string;
    let targetBaseName: string;

    try {
      // Create or select base
      if (baseMode === "new") {
        const { data: newBase, error: baseError } = await supabase
          .from("bases")
          .insert({ name: baseName.trim() })
          .select()
          .single();

        if (baseError) throw baseError;
        targetBaseId = newBase.id;
        targetBaseName = newBase.name;
      } else {
        targetBaseId = selectedBaseId;
        targetBaseName = existingBases.find((b) => b.id === selectedBaseId)?.name || "";
      }

      // Get existing emails for deduplication if needed
      let existingEmails = new Set<string>();
      if (skipDuplicates) {
        const { data: existingContacts } = await supabase
          .from("contacts")
          .select("email, personal_email")
          .eq("base_id", targetBaseId);

        (existingContacts || []).forEach((c) => {
          if (c.email) existingEmails.add(c.email.toLowerCase());
          if (c.personal_email) existingEmails.add(c.personal_email.toLowerCase());
        });
      }

      // Process rows in batches
      const totalRows = rows.length;
      let imported = 0;
      let duplicates = 0;
      let errors = 0;

      for (let i = 0; i < totalRows; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        const contactsToInsert: any[] = [];

        for (const row of batch) {
          const contact = mapRowToContact(row, mapping);
          
          // Check for duplicates
          const email = contact.email?.toLowerCase() || contact.personal_email?.toLowerCase();
          if (skipDuplicates && email && existingEmails.has(email)) {
            duplicates++;
            continue;
          }

          // Skip if no email at all
          if (!contact.email && !contact.personal_email) {
            // Still import, just no email
          }

          // Add email to set to prevent duplicates within import
          if (email) existingEmails.add(email);

          contactsToInsert.push({
            base_id: targetBaseId,
            full_name: contact.full_name,
            first_name: contact.first_name,
            last_name: contact.last_name,
            email: contact.email,
            personal_email: contact.personal_email,
            mobile_number: contact.mobile_number,
            company_phone: contact.company_phone,
            job_title: contact.job_title,
            company_name: contact.company_name,
            linkedin_url: contact.linkedin_url,
            city: contact.city,
            state: contact.state,
            country: contact.country,
            industry: contact.industry,
            seniority_level: contact.seniority_level,
            company_website: contact.company_website,
            full_data: row,
          });
        }

        if (contactsToInsert.length > 0) {
          const { error: insertError, data: insertedData } = await supabase
            .from("contacts")
            .insert(contactsToInsert)
            .select("id");

          if (insertError) {
            console.error("Batch insert error:", insertError);
            errors += contactsToInsert.length;
          } else {
            imported += insertedData?.length || 0;
          }
        }

        // Update progress
        const progress = Math.min(100, Math.round(((i + batch.length) / totalRows) * 100));
        setImportProgress(progress);
        setImportStats({ imported, duplicates, errors });
      }

      // Final update
      setImportProgress(100);
      setImportStats({ imported, duplicates, errors });

      toast.success(
        `Importação concluída: ${imported.toLocaleString("pt-BR")} contatos importados` +
          (duplicates > 0 ? `, ${duplicates.toLocaleString("pt-BR")} duplicados ignorados` : "") +
          (errors > 0 ? `, ${errors.toLocaleString("pt-BR")} erros` : "")
      );

      // Notify parent
      setTimeout(() => {
        onImportComplete(targetBaseId, targetBaseName);
        handleClose();
      }, 1500);
    } catch (error) {
      console.error("Import error:", error);
      toast.error("Erro ao importar contatos. Tente novamente.");
      setStep("mapping");
    }
  };

  const previewRows = rows.slice(0, 5);
  const mappedFieldsCount = Object.values(mapping).filter(Boolean).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Importar Arquivo Excel
          </DialogTitle>
          <DialogDescription>
            {step === "upload" && "Selecione um arquivo .xls ou .xlsx para importar"}
            {step === "mapping" && `${rows.length.toLocaleString("pt-BR")} linhas encontradas. Configure o mapeamento de colunas.`}
            {step === "importing" && "Importando contatos..."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {step === "upload" && (
            <div
              className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-2">
                Arraste e solte seu arquivo aqui
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                ou clique para selecionar
              </p>
              <Input
                type="file"
                accept=".xls,.xlsx,.csv"
                className="hidden"
                id="file-upload"
                onChange={(e) => {
                  const selectedFile = e.target.files?.[0];
                  if (selectedFile) handleFileSelect(selectedFile);
                }}
              />
              <Button asChild variant="outline">
                <label htmlFor="file-upload" className="cursor-pointer">
                  Selecionar Arquivo
                </label>
              </Button>
            </div>
          )}

          {step === "mapping" && (
            <div className="space-y-4 overflow-hidden flex flex-col h-full">
              {/* Base configuration */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Destino</Label>
                  <Select
                    value={baseMode}
                    onValueChange={(v) => setBaseMode(v as "new" | "existing")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">Criar nova base</SelectItem>
                      {existingBases.length > 0 && (
                        <SelectItem value="existing">Adicionar a base existente</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  {baseMode === "new" ? (
                    <>
                      <Label>Nome da Base</Label>
                      <Input
                        value={baseName}
                        onChange={(e) => setBaseName(e.target.value)}
                        placeholder="Nome da nova base"
                      />
                    </>
                  ) : (
                    <>
                      <Label>Selecionar Base</Label>
                      <Select value={selectedBaseId} onValueChange={setSelectedBaseId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione uma base" />
                        </SelectTrigger>
                        <SelectContent>
                          {existingBases.map((base) => (
                            <SelectItem key={base.id} value={base.id}>
                              {base.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </>
                  )}
                </div>
              </div>

              {/* Deduplication option */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="skip-duplicates"
                  checked={skipDuplicates}
                  onCheckedChange={(checked) => setSkipDuplicates(checked === true)}
                />
                <label
                  htmlFor="skip-duplicates"
                  className="text-sm font-medium leading-none cursor-pointer"
                >
                  Ignorar contatos com email duplicado
                </label>
              </div>

              {/* Column mapping */}
              <div className="space-y-2">
                <Label>Mapeamento de Colunas ({mappedFieldsCount} campos mapeados)</Label>
                <ScrollArea className="h-[200px] border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[200px]">Coluna no Arquivo</TableHead>
                        <TableHead className="w-[200px]">Campo no Sistema</TableHead>
                        <TableHead>Exemplo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {headers.map((header) => (
                        <TableRow key={header}>
                          <TableCell className="font-medium">{header}</TableCell>
                          <TableCell>
                            <Select
                              value={mapping[header] || IGNORE_VALUE}
                              onValueChange={(value) => handleMappingChange(header, value)}
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue placeholder="Ignorar" />
                              </SelectTrigger>
                              <SelectContent>
                                {TARGET_FIELDS.map((field) => (
                                  <SelectItem key={field.value} value={field.value}>
                                    {field.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm truncate max-w-[300px]">
                            {previewRows[0]?.[header] !== undefined
                              ? String(previewRows[0][header])
                              : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>

              {/* Preview */}
              <div className="space-y-2 flex-1 min-h-0">
                <Label>Preview (primeiras 5 linhas)</Label>
                <ScrollArea className="h-[150px] border rounded-lg">
                  <div className="min-w-max">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {headers.map((header) => (
                            <TableHead key={header} className="whitespace-nowrap">
                              {header}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewRows.map((row, idx) => (
                          <TableRow key={idx}>
                            {headers.map((header) => (
                              <TableCell key={header} className="whitespace-nowrap">
                                {row[header] !== undefined ? String(row[header]) : ""}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              </div>
            </div>
          )}

          {step === "importing" && (
            <div className="py-8 space-y-6">
              <div className="text-center">
                <Loader2 className="h-12 w-12 mx-auto text-primary animate-spin mb-4" />
                <p className="text-lg font-medium">
                  Importando {rows.length.toLocaleString("pt-BR")} contatos...
                </p>
                <p className="text-sm text-muted-foreground">
                  Isso pode levar alguns minutos para bases grandes
                </p>
              </div>

              <Progress value={importProgress} className="h-3" />

              <div className="flex justify-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>{importStats.imported.toLocaleString("pt-BR")} importados</span>
                </div>
                <div className="flex items-center gap-2">
                  <X className="h-4 w-4 text-yellow-500" />
                  <span>{importStats.duplicates.toLocaleString("pt-BR")} duplicados</span>
                </div>
                {importStats.errors > 0 && (
                  <div className="flex items-center gap-2">
                    <X className="h-4 w-4 text-destructive" />
                    <span>{importStats.errors.toLocaleString("pt-BR")} erros</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {step === "mapping" && (
          <DialogFooter>
            <Button variant="outline" onClick={() => setStep("upload")}>
              Voltar
            </Button>
            <Button
              onClick={handleImport}
              disabled={
                mappedFieldsCount === 0 ||
                (baseMode === "new" && !baseName.trim()) ||
                (baseMode === "existing" && !selectedBaseId)
              }
            >
              Importar {rows.length.toLocaleString("pt-BR")} Contatos
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
