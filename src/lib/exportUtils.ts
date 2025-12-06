import * as XLSX from "xlsx";
import { LinkedInContact } from "@/types/contact";

export const exportToCSV = (contacts: LinkedInContact[], filename: string) => {
  const headers = [
    "First Name",
    "Last Name",
    "Full Name",
    "Job Title",
    "Headline",
    "Seniority Level",
    "Functional Level",
    "Email",
    "Personal Email",
    "Mobile Number",
    "LinkedIn",
    "City",
    "State",
    "Country",
    "Company Name",
    "Company Domain",
    "Company Website",
    "Company LinkedIn",
    "Company Size",
    "Industry",
    "Company Description",
    "Company Annual Revenue",
    "Company Total Funding",
    "Company Founded Year",
    "Company Phone",
    "Company Street Address",
    "Company City",
    "Company State",
    "Company Country",
    "Company Postal Code",
    "Company Full Address",
    "Keywords",
    "Company Technologies",
  ];

  const rows = contacts.map((contact) => [
    contact.firstName,
    contact.lastName,
    contact.fullName,
    contact.jobTitle,
    contact.headline || "",
    contact.seniorityLevel || "",
    contact.functionalLevel || "",
    contact.email || "",
    contact.personalEmail || "",
    contact.mobileNumber || "",
    contact.linkedin,
    contact.city || "",
    contact.state || "",
    contact.country || "",
    contact.companyName || "",
    contact.companyDomain || "",
    contact.companyWebsite || "",
    contact.companyLinkedIn || "",
    contact.companySize || "",
    contact.industry || "",
    contact.companyDescription || "",
    contact.companyAnnualRevenue || "",
    contact.companyTotalFunding || "",
    contact.companyFoundedYear?.toString() || "",
    contact.companyPhone || "",
    contact.companyStreetAddress || "",
    contact.companyCity || "",
    contact.companyState || "",
    contact.companyCountry || "",
    contact.companyPostalCode || "",
    contact.companyFullAddress || "",
    contact.keywords?.join("; ") || "",
    contact.companyTechnologies?.join("; ") || "",
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
    "First Name": contact.firstName,
    "Last Name": contact.lastName,
    "Full Name": contact.fullName,
    "Job Title": contact.jobTitle,
    Headline: contact.headline || "",
    "Seniority Level": contact.seniorityLevel || "",
    "Functional Level": contact.functionalLevel || "",
    Email: contact.email || "",
    "Personal Email": contact.personalEmail || "",
    "Mobile Number": contact.mobileNumber || "",
    LinkedIn: contact.linkedin,
    City: contact.city || "",
    State: contact.state || "",
    Country: contact.country || "",
    "Company Name": contact.companyName || "",
    "Company Domain": contact.companyDomain || "",
    "Company Website": contact.companyWebsite || "",
    "Company LinkedIn": contact.companyLinkedIn || "",
    "Company Size": contact.companySize || "",
    Industry: contact.industry || "",
    "Company Description": contact.companyDescription || "",
    "Company Annual Revenue": contact.companyAnnualRevenue || "",
    "Company Total Funding": contact.companyTotalFunding || "",
    "Company Founded Year": contact.companyFoundedYear || "",
    "Company Phone": contact.companyPhone || "",
    "Company Street Address": contact.companyStreetAddress || "",
    "Company City": contact.companyCity || "",
    "Company State": contact.companyState || "",
    "Company Country": contact.companyCountry || "",
    "Company Postal Code": contact.companyPostalCode || "",
    "Company Full Address": contact.companyFullAddress || "",
    Keywords: contact.keywords?.join("; ") || "",
    "Company Technologies": contact.companyTechnologies?.join("; ") || "",
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Contatos");

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
