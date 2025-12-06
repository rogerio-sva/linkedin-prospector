import * as XLSX from "xlsx";
import { LinkedInContact } from "@/types/contact";

export const exportToCSV = (contacts: LinkedInContact[], filename: string) => {
  const headers = [
    "Nome Completo",
    "Primeiro Nome",
    "Sobrenome",
    "Headline",
    "URL do Perfil",
    "Email",
    "Telefone",
    "Empresa",
    "Cargo",
    "Localização",
    "Grau de Conexão",
  ];

  const rows = contacts.map((contact) => [
    contact.fullName,
    contact.firstName,
    contact.lastName,
    contact.headline,
    contact.profileUrl,
    contact.email || "",
    contact.phone || "",
    contact.company || "",
    contact.position || "",
    contact.location || "",
    contact.connectionDegree || "",
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    ),
  ].join("\n");

  const blob = new Blob(["\ufeff" + csvContent], {
    type: "text/csv;charset=utf-8;",
  });
  downloadBlob(blob, `${filename}.csv`);
};

export const exportToXLSX = (contacts: LinkedInContact[], filename: string) => {
  const data = contacts.map((contact) => ({
    "Nome Completo": contact.fullName,
    "Primeiro Nome": contact.firstName,
    Sobrenome: contact.lastName,
    Headline: contact.headline,
    "URL do Perfil": contact.profileUrl,
    Email: contact.email || "",
    Telefone: contact.phone || "",
    Empresa: contact.company || "",
    Cargo: contact.position || "",
    Localização: contact.location || "",
    "Grau de Conexão": contact.connectionDegree || "",
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Contatos");

  // Auto-size columns
  const colWidths = Object.keys(data[0] || {}).map((key) => ({
    wch: Math.max(key.length, 20),
  }));
  worksheet["!cols"] = colWidths;

  XLSX.writeFile(workbook, `${filename}.xlsx`);
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
