import * as XLSX from "xlsx";

const MAX_ROWS = 5000;
const MAX_CELL_LENGTH = 4000;

const HEADER_ALIASES = new Map([
  ["rank in town", "rank"],
  ["rank", "rank"],
  ["business name", "businessName"],
  ["business", "businessName"],
  ["company", "businessName"],
  ["company name", "businessName"],
  ["name", "businessName"],
  ["town", "town"],
  ["city", "town"],
  ["town city", "town"],
  ["locality", "town"],
  ["distance from fuengirola mi", "distance"],
  ["distance from fuengirola m", "distance"],
  ["distance", "distance"],
  ["akipasa category", "category"],
  ["type of business akipasa category", "category"],
  ["type of business", "category"],
  ["business type", "category"],
  ["category", "category"],
  ["address", "address"],
  ["full address", "address"],
  ["street address", "address"],
  ["phone", "phone"],
  ["telephone", "phone"],
  ["mobile", "phone"],
  ["owner manager if known", "ownerManager"],
  ["owner manager", "ownerManager"],
  ["contact name", "ownerManager"],
  ["owner", "ownerManager"],
  ["manager", "ownerManager"],
  ["email", "email"],
  ["e mail", "email"],
  ["contact details number email", "contactDetails"],
  ["contact details", "contactDetails"],
  ["contact", "contactDetails"],
  ["best contact method", "bestContactMethod"],
  ["preferred contact method", "bestContactMethod"],
  ["google rating", "googleRating"],
  ["rating", "googleRating"],
  ["review count", "reviewCount"],
  ["reviews", "reviewCount"],
  ["popularity score", "popularityScore"],
  ["popularity", "popularityScore"],
  ["pitch angle", "pitchAngle"],
  ["pitch", "pitchAngle"],
  ["crm stage", "crmStage"],
  ["stage", "crmStage"],
  ["notes", "notes"],
  ["note", "notes"],
  ["website social link", "website"],
  ["website social", "website"],
  ["website", "website"],
  ["social link", "website"],
  ["social", "website"],
  ["url", "website"]
]);

function plain(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_CELL_LENGTH);
}

function normalizedHeader(value) {
  return plain(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function canonicalHeader(value) {
  return HEADER_ALIASES.get(normalizedHeader(value)) || null;
}

function numeric(value) {
  const text = plain(value).replace(/\s/g, "").replace(",", ".");
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function countNumeric(value) {
  const text = plain(value).replace(/\s/g, "");
  if (/^\d{1,3}(?:[.,]\d{3})+$/.test(text)) return Number(text.replace(/[.,]/g, ""));
  const parsed = Number(text.replace(",", "."));
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

function emailFrom(value) {
  const match = plain(value).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0].toLowerCase() : "";
}

function phoneFrom(value) {
  const match = plain(value).match(/(?:\+|00)?\d[\d\s().-]{6,}\d/);
  return match ? match[0].replace(/\s+/g, " ").trim() : "";
}

function rowToProspect(row, headers, rowNumber) {
  const values = {};
  for (const [canonical, source] of Object.entries(headers)) {
    values[canonical] = plain(row[source]);
  }
  const contactDetails = values.contactDetails || "";
  const email = emailFrom(values.email) || emailFrom(contactDetails);
  const phone = phoneFrom(values.phone) || phoneFrom(contactDetails);
  return {
    sourceRow: rowNumber,
    rank: numeric(values.rank),
    businessName: values.businessName || "",
    town: values.town || "",
    distance: numeric(values.distance),
    category: values.category || "",
    address: values.address || "",
    phone,
    ownerManager: values.ownerManager || "",
    email,
    website: values.website || "",
    bestContactMethod: values.bestContactMethod || "",
    googleRating: numeric(values.googleRating),
    reviewCount: countNumeric(values.reviewCount),
    popularityScore: numeric(values.popularityScore),
    pitchAngle: values.pitchAngle || "",
    crmStage: values.crmStage || "",
    notes: values.notes || ""
  };
}

function sortProspects(left, right) {
  return left.town.localeCompare(right.town, "es", { sensitivity: "base" }) ||
    (left.rank ?? Number.MAX_SAFE_INTEGER) - (right.rank ?? Number.MAX_SAFE_INTEGER) ||
    left.businessName.localeCompare(right.businessName, "es", { sensitivity: "base" });
}

export function parseProspectWorkbook(input, fileName = "prospects.xlsx") {
  const workbook = XLSX.read(input, { type: "array", cellDates: true, sheetRows: MAX_ROWS + 2 });
  let selected = null;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
    const sourceHeaders = rows.length ? Object.keys(rows[0]) : [];
    const headers = {};
    for (const source of sourceHeaders) {
      const canonical = canonicalHeader(source);
      if (canonical && !headers[canonical]) headers[canonical] = source;
    }
    if (headers.businessName && (headers.address || headers.town)) {
      selected = { sheetName, rows, headers, sourceHeaders };
      break;
    }
  }

  if (!selected) {
    throw new Error("No sheet contains the required Business Name and Address or Town columns.");
  }
  if (selected.rows.length > MAX_ROWS) {
    throw new Error(`The workbook contains more than ${MAX_ROWS.toLocaleString()} prospect rows.`);
  }

  const valid = [];
  const invalid = [];
  selected.rows.forEach((row, index) => {
    const prospect = rowToProspect(row, selected.headers, index + 2);
    const reasons = [];
    if (!prospect.businessName) reasons.push("Business name is missing");
    if (!prospect.address && !prospect.town) reasons.push("Address and town are missing");
    if (reasons.length) invalid.push({ ...prospect, reasons });
    else valid.push(prospect);
  });

  valid.sort(sortProspects);
  invalid.sort((left, right) => left.sourceRow - right.sourceRow);
  return {
    fileName: plain(fileName).slice(0, 240),
    sheetName: selected.sheetName,
    headers: selected.sourceHeaders,
    mappedFields: Object.keys(selected.headers),
    rows: valid,
    invalid,
    totalRows: selected.rows.length
  };
}
