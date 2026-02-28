import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import * as XLSX from "xlsx";

export const ExportSuppressedEmails = () => {
  const [isExporting, setIsExporting] = useState(false);

  const fetchAllSuppressed = async () => {
    const pageSize = 1000;
    let allRows: any[] = [];
    let from = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from("suppressed_emails")
        .select("email, reason, bounce_type, original_error, created_at")
        .order("created_at", { ascending: false })
        .range(from, from + pageSize - 1);

      if (error) throw error;
      if (data && data.length > 0) {
        allRows = [...allRows, ...data];
        from += pageSize;
        hasMore = data.length === pageSize;
      } else {
        hasMore = false;
      }
    }

    return allRows;
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const rows = await fetchAllSuppressed();

      if (rows.length === 0) {
        toast.info("Nenhum e-mail suprimido encontrado.");
        return;
      }

      const data = rows.map((row) => ({
        "Email": row.email,
        "Motivo": row.reason,
        "Tipo de Bounce": row.bounce_type || "",
        "Erro Original": row.original_error || "",
        "Data": row.created_at ? new Date(row.created_at).toLocaleString("pt-BR") : "",
      }));

      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Suprimidos");

      const colWidths = Object.keys(data[0]).map((key) => ({
        wch: Math.max(key.length, 25),
      }));
      worksheet["!cols"] = colWidths;

      XLSX.writeFile(workbook, `emails-suprimidos-${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success(`${rows.length} e-mails exportados com sucesso!`);
    } catch (error) {
      console.error("Erro ao exportar:", error);
      toast.error("Erro ao exportar e-mails suprimidos.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={handleExport} disabled={isExporting}>
      <Download className="h-4 w-4 mr-2" />
      {isExporting ? "Exportando..." : "Exportar Suprimidos"}
    </Button>
  );
};
