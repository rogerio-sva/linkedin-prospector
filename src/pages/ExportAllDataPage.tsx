import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, FileJson, FileSpreadsheet, Loader2, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ALL_TABLES = [
  { key: "contacts", label: "Contatos", large: true },
  { key: "bases", label: "Bases" },
  { key: "contact_tags", label: "Contato-Tags", large: true },
  { key: "tags", label: "Tags" },
  { key: "email_templates", label: "Templates de E-mail" },
  { key: "email_campaigns", label: "Campanhas" },
  { key: "email_sends", label: "Envios de E-mail", large: true },
  { key: "email_validations", label: "Validações de E-mail", large: true },
  { key: "suppressed_emails", label: "E-mails Suprimidos", large: true },
  { key: "contact_activities", label: "Atividades CRM", large: true },
  { key: "crm_stages", label: "Estágios CRM" },
  { key: "team_members", label: "Membros da Equipe" },
  { key: "cleanup_jobs", label: "Jobs de Limpeza" },
  { key: "search_runs", label: "Buscas Realizadas" },
] as const;

type TableKey = (typeof ALL_TABLES)[number]["key"];

async function fetchAllRows(table: string): Promise<any[]> {
  const PAGE_SIZE = 1000;
  let allRows: any[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await (supabase as any)
      .from(table)
      .select("*")
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw new Error(`Erro ao buscar ${table}: ${error.message}`);
    if (!data || data.length === 0) {
      hasMore = false;
    } else {
      allRows = allRows.concat(data);
      from += PAGE_SIZE;
      if (data.length < PAGE_SIZE) hasMore = false;
    }
  }
  return allRows;
}

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob(["\ufeff" + content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function jsonToCsv(rows: any[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const csvRows = rows.map((row) =>
    headers
      .map((h) => {
        const val = row[h];
        const str = val === null || val === undefined ? "" : typeof val === "object" ? JSON.stringify(val) : String(val);
        return `"${str.replace(/"/g, '""')}"`;
      })
      .join(",")
  );
  return [headers.join(","), ...csvRows].join("\n");
}

export default function ExportAllDataPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [loadingTable, setLoadingTable] = useState<string | null>(null);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [doneTables, setDoneTables] = useState<Set<string>>(new Set());

  const exportAllAsJSON = async () => {
    setLoading(true);
    setDoneTables(new Set());
    const allData: Record<string, any[]> = {};
    try {
      for (const table of ALL_TABLES) {
        setProgress((p) => ({ ...p, [table.key]: 0 }));
        const rows = await fetchAllRows(table.key);
        allData[table.key] = rows;
        setProgress((p) => ({ ...p, [table.key]: rows.length }));
        setDoneTables((s) => new Set(s).add(table.key));
      }
      const json = JSON.stringify(allData, null, 2);
      downloadFile(json, `backup_completo_${new Date().toISOString().slice(0, 10)}.json`, "application/json");
      toast({ title: "Exportação completa!", description: `${Object.values(allData).reduce((a, b) => a + b.length, 0)} registros exportados.` });
    } catch (err: any) {
      toast({ title: "Erro na exportação", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const exportTableAsCSV = async (tableKey: string, label: string) => {
    setLoadingTable(tableKey);
    try {
      const rows = await fetchAllRows(tableKey);
      if (rows.length === 0) {
        toast({ title: `${label} vazia`, description: "Nenhum registro encontrado." });
        return;
      }
      const csv = jsonToCsv(rows);
      downloadFile(csv, `${tableKey}_${new Date().toISOString().slice(0, 10)}.csv`, "text/csv;charset=utf-8;");
      toast({ title: `${label} exportada!`, description: `${rows.length} registros.` });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLoadingTable(null);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Exportar Todos os Dados</h1>
        <p className="text-muted-foreground mt-1">
          Baixe um backup completo de todas as tabelas em JSON ou exporte cada tabela individualmente em CSV.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileJson className="h-5 w-5 text-primary" />
            Backup Completo (JSON)
          </CardTitle>
          <CardDescription>
            Exporta todas as 14 tabelas em um único arquivo JSON. Ideal para backup completo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={exportAllAsJSON} disabled={loading} size="lg">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Exportando... ({doneTables.size}/{ALL_TABLES.length} tabelas)
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Baixar Backup Completo
              </>
            )}
          </Button>
          {loading && (
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              {ALL_TABLES.map((t) => (
                <div key={t.key} className="flex items-center gap-2">
                  {doneTables.has(t.key) ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                  )}
                  <span className={doneTables.has(t.key) ? "text-foreground" : "text-muted-foreground"}>
                    {t.label} {progress[t.key] !== undefined ? `(${progress[t.key]})` : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Exportar por Tabela (CSV)
          </CardTitle>
          <CardDescription>
            Baixe cada tabela individualmente em formato CSV.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ALL_TABLES.map((t) => (
              <Button
                key={t.key}
                variant="outline"
                onClick={() => exportTableAsCSV(t.key, t.label)}
                disabled={loadingTable !== null}
                className="justify-start"
              >
                {loadingTable === t.key ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                {t.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
