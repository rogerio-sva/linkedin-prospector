import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ALL_TABLES = [
  "contacts", "bases", "contact_tags", "tags", "email_templates",
  "email_campaigns", "email_sends", "email_validations",
  "suppressed_emails", "contact_activities", "crm_stages",
  "team_members", "cleanup_jobs", "search_runs",
] as const;

async function fetchAllRows(table: string): Promise<any[]> {
  const PAGE_SIZE = 1000;
  let allRows: any[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await (supabase as any)
      .from(table)
      .select("*")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`Erro em ${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    allRows = allRows.concat(data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
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
    headers.map((h) => {
      const val = row[h];
      const str = val === null || val === undefined ? "" : typeof val === "object" ? JSON.stringify(val) : String(val);
      return `"${str.replace(/"/g, '""')}"`;
    }).join(",")
  );
  return [headers.join(","), ...csvRows].join("\n");
}

export default function ExportAllDataPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  const exportAllAsCSV = async () => {
    setLoading(true);
    let totalRows = 0;
    const sections: string[] = [];

    try {
      for (const table of ALL_TABLES) {
        setStatus(`Buscando ${table}...`);
        const rows = await fetchAllRows(table);
        totalRows += rows.length;
        if (rows.length > 0) {
          const csv = jsonToCsv(rows);
          sections.push(`### ${table.toUpperCase()} (${rows.length} registros) ###\n${csv}`);
        } else {
          sections.push(`### ${table.toUpperCase()} (0 registros) ###`);
        }
      }

      const fullCsv = sections.join("\n\n");
      downloadFile(fullCsv, `backup_completo_${new Date().toISOString().slice(0, 10)}.csv`, "text/csv;charset=utf-8;");
      toast({ title: "Exportação completa!", description: `${totalRows} registros exportados de ${ALL_TABLES.length} tabelas.` });
    } catch (err: any) {
      toast({ title: "Erro na exportação", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
      setStatus("");
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Exportar Todos os Dados</h1>
        <p className="text-muted-foreground mt-1">
          Baixe um backup completo de todas as {ALL_TABLES.length} tabelas em um único arquivo CSV.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            Backup Completo (CSV)
          </CardTitle>
          <CardDescription>
            Todas as tabelas separadas por cabeçalho no mesmo arquivo. Paginação automática para tabelas grandes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={exportAllAsCSV} disabled={loading} size="lg">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {status || "Exportando..."}
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Baixar Backup Completo
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
