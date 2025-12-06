import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LinkedInContact } from "@/types/contact";
import { exportToCSV, exportToXLSX } from "@/lib/exportUtils";
import { toast } from "sonner";

interface ExportMenuProps {
  contacts: LinkedInContact[];
  selectedContacts: string[];
  filename?: string;
}

export const ExportMenu = ({
  contacts,
  selectedContacts = [],
  filename = "linkedin-contacts",
}: ExportMenuProps) => {
  const getExportContacts = () => {
    if (selectedContacts.length > 0) {
      return contacts.filter((c) => selectedContacts.includes(c.id));
    }
    return contacts;
  };

  const handleExportCSV = () => {
    const exportContacts = getExportContacts();
    if (exportContacts.length === 0) {
      toast.error("Nenhum contato para exportar");
      return;
    }
    exportToCSV(exportContacts, filename);
    toast.success(`${exportContacts.length} contatos exportados para CSV`);
  };

  const handleExportXLSX = () => {
    const exportContacts = getExportContacts();
    if (exportContacts.length === 0) {
      toast.error("Nenhum contato para exportar");
      return;
    }
    exportToXLSX(exportContacts, filename);
    toast.success(`${exportContacts.length} contatos exportados para Excel`);
  };

  const exportCount =
    selectedContacts.length > 0 ? selectedContacts.length : contacts.length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="gap-2"
          disabled={contacts.length === 0}
        >
          <Download className="h-4 w-4" />
          Exportar
          {exportCount > 0 && (
            <span className="ml-1 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
              {exportCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={handleExportCSV}>
          <FileText className="h-4 w-4 mr-2" />
          Exportar como CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportXLSX}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Exportar como Excel
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
