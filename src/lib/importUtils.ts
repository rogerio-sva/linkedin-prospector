import * as XLSX from 'xlsx';

export interface ParsedRow {
  [key: string]: string | number | undefined;
}

export interface ColumnMapping {
  sourceColumn: string;
  targetField: string;
}

export const parseXLSFile = async (file: File): Promise<{ headers: string[]; rows: ParsedRow[] }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Get headers from first row using raw option
        const rawData = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1 });
        const headers = rawData.length > 0 ? (rawData[0] as string[]).map(h => String(h || '')) : [];
        
        // Get data rows
        const rows = XLSX.utils.sheet_to_json<ParsedRow>(worksheet);
        
        resolve({ headers, rows });
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
    reader.readAsBinaryString(file);
  });
};

export const cleanEmail = (email: string | undefined | null): string | null => {
  if (!email) return null;
  
  // Convert to string and trim
  let cleaned = String(email).trim().toLowerCase();
  
  // Remove escape characters and quotes
  cleaned = cleaned.replace(/\\"/g, '').replace(/"/g, '').replace(/'/g, '');
  
  // Remove leading/trailing special chars
  cleaned = cleaned.replace(/^[=+\-@]+/, '');
  
  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleaned)) {
    return null;
  }
  
  return cleaned;
};

export const cleanPhone = (phone: string | undefined | null): string | null => {
  if (!phone) return null;
  
  // Convert to string and extract only digits
  const cleaned = String(phone).replace(/\D/g, '');
  
  // Return null if too short
  if (cleaned.length < 8) return null;
  
  return cleaned;
};

export const extractFirstName = (fullName: string | undefined | null): string | null => {
  if (!fullName) return null;
  
  const name = String(fullName).trim();
  const parts = name.split(/\s+/);
  
  if (parts.length === 0) return null;
  
  // Capitalize first letter
  const firstName = parts[0];
  return firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
};

export const extractLastName = (fullName: string | undefined | null): string | null => {
  if (!fullName) return null;
  
  const name = String(fullName).trim();
  const parts = name.split(/\s+/);
  
  if (parts.length < 2) return null;
  
  // Get last part
  const lastName = parts[parts.length - 1];
  return lastName.charAt(0).toUpperCase() + lastName.slice(1).toLowerCase();
};

export interface ContactImportData {
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  personal_email: string | null;
  mobile_number: string | null;
  company_phone: string | null;
  job_title: string | null;
  company_name: string | null;
  linkedin_url: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  industry: string | null;
  seniority_level: string | null;
  company_website: string | null;
}

export const mapRowToContact = (
  row: ParsedRow,
  mapping: Record<string, string>
): ContactImportData => {
  const getValue = (targetField: string): string | null => {
    const sourceColumn = Object.entries(mapping).find(([_, target]) => target === targetField)?.[0];
    if (!sourceColumn) return null;
    const value = row[sourceColumn];
    return value !== undefined && value !== null ? String(value).trim() : null;
  };

  const fullName = getValue('full_name');
  const email = cleanEmail(getValue('email'));
  const personalEmail = cleanEmail(getValue('personal_email'));
  const phone = cleanPhone(getValue('mobile_number'));

  return {
    full_name: fullName,
    first_name: extractFirstName(fullName),
    last_name: extractLastName(fullName),
    email: email,
    personal_email: personalEmail,
    mobile_number: phone,
    company_phone: cleanPhone(getValue('company_phone')),
    job_title: getValue('job_title'),
    company_name: getValue('company_name'),
    linkedin_url: getValue('linkedin_url'),
    city: getValue('city'),
    state: getValue('state'),
    country: getValue('country'),
    industry: getValue('industry'),
    seniority_level: getValue('seniority_level'),
    company_website: getValue('company_website'),
  };
};

// Auto-detect column mapping based on common column names
export const autoDetectMapping = (headers: string[]): Record<string, string> => {
  const mapping: Record<string, string> = {};
  
  const patterns: { pattern: RegExp; target: string }[] = [
    { pattern: /nome|name|full.?name/i, target: 'full_name' },
    { pattern: /e.?mail|email/i, target: 'personal_email' },
    { pattern: /telefone|phone|celular|mobile|whatsapp/i, target: 'mobile_number' },
    { pattern: /cargo|job.?title|position|função/i, target: 'job_title' },
    { pattern: /empresa|company|organiza/i, target: 'company_name' },
    { pattern: /linkedin/i, target: 'linkedin_url' },
    { pattern: /cidade|city/i, target: 'city' },
    { pattern: /estado|state|uf/i, target: 'state' },
    { pattern: /país|country|pais/i, target: 'country' },
    { pattern: /setor|industry|indústria/i, target: 'industry' },
  ];
  
  for (const header of headers) {
    for (const { pattern, target } of patterns) {
      if (pattern.test(header) && !Object.values(mapping).includes(target)) {
        mapping[header] = target;
        break;
      }
    }
  }
  
  return mapping;
};
