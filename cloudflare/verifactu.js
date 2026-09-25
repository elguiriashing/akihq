/**
 * AEAT VERI*FACTU serialization primitives. These do not transmit, sign, allocate
 * invoice numbers or establish an immutable chain. The fiscal issuing transaction
 * must persist the exact XML/hash inputs together with its locked chain head.
 * Sources: AEAT hash 0.1.2, QR 0.5.0, live SuministroInformacion/LR XSD, 2026-09-23.
 * Supported scope: EUR ordinary common-territory IVA, F1/F2 and difference R1/R5.
 * Exempt/special regimes deliberately fail until their semantic mapping is reviewed.
 */

export const VERIFACTU_NAMESPACES = Object.freeze({
  info: "https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroInformacion.xsd",
  ledger: "https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroLR.xsd",
  soap: "http://schemas.xmlsoap.org/soap/envelope/"
});

export const VERIFACTU_QR_PRINT = Object.freeze({
  minSizeMm: 30, maxSizeMm: 40, errorCorrection: "M", minClearSpaceMm: 2,
  recommendedClearSpaceMm: 6, label: "QR tributario:", verifactuLabel: "VERI*FACTU"
});

function required(value, field, max = 500) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) throw new TypeError(`${field} is required (maximum ${max} characters).`);
  const result = value.trim();
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/u.test(result)) throw new TypeError(`${field} contains invalid XML characters.`);
  return result;
}

function nif(value, field = "NIF") {
  const result = required(value, field, 9);
  if (!/^[A-Z0-9]{9}$/.test(result)) throw new TypeError(`${field} must be a Spanish NIF in canonical uppercase form.`);
  return result; // Tax identity/checksum/census validation belongs to fiscal onboarding.
}

function number(value) {
  const result = required(value, "document_number", 60);
  if (!/^[\x20-\x7e]+$/.test(result)) throw new TypeError("document_number must use printable ASCII for AEAT QR compatibility.");
  return result;
}

export function aeatDate(value) {
  const text = required(value, "date", 10);
  let year, month, day;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) [year, month, day] = text.split("-").map(Number);
  else if (/^\d{2}-\d{2}-\d{4}$/.test(text)) [day, month, year] = text.split("-").map(Number);
  else throw new TypeError("date must be YYYY-MM-DD or DD-MM-YYYY.");
  const date = new Date(`${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) throw new TypeError("Invalid calendar date.");
  return `${String(day).padStart(2, "0")}-${String(month).padStart(2, "0")}-${String(year).padStart(4, "0")}`;
}

function timestamp(value) {
  const result = required(value, "generated_at", 32);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/.test(result) || !Number.isFinite(Date.parse(result))) throw new TypeError("generated_at must be an ISO timestamp with seconds and an explicit timezone.");
  aeatDate(result.slice(0, 10));
  if (+result.slice(11, 13) > 23 || +result.slice(14, 16) > 59 || +result.slice(17, 19) > 59 || /[+-]14:(?!00)/.test(result)) throw new TypeError("Invalid generation timestamp.");
  return result;
}

function cents(value, field = "amount") {
  if ((typeof value === "number" && !Number.isSafeInteger(value)) || !["number", "bigint", "string"].includes(typeof value) || !/^-?\d+$/.test(String(value))) throw new TypeError(`${field} must be exact integer cents.`);
  const result = BigInt(value);
  if (result < -99999999999999n || result > 99999999999999n) throw new TypeError(`${field} exceeds AEAT amount limits.`);
  return result;
}

export function aeatAmount(value) {
  const amount = cents(value);
  const absolute = amount < 0n ? -amount : amount;
  return `${amount < 0n ? "-" : ""}${absolute / 100n}.${String(absolute % 100n).padStart(2, "0")}`;
}

function decimal(value, field) {
  const result = required(value, field, 16);
  if (!/^-?\d{1,12}(?:\.\d{1,2})?$/.test(result)) throw new TypeError(`${field} must be an exact decimal string with up to two places.`);
  return result;
}

function priorHash(value) {
  if (value === "") return "";
  const result = required(value, "previous_hash", 64);
  if (!/^[A-F0-9]{64}$/.test(result)) throw new TypeError("previous_hash must be 64 uppercase hexadecimal characters.");
  return result;
}

/** Hashes AEAT's prescribed text, not JSON, XML, or a URL-encoded string. */
export async function hashRegistration(record) {
  const fields = [
    ["IDEmisorFactura", nif(record.issuer_nif)],
    ["NumSerieFactura", number(record.document_number)],
    ["FechaExpedicionFactura", aeatDate(record.issue_date)],
    ["TipoFactura", required(record.document_type, "document_type", 2)],
    ["CuotaTotal", decimal(record.tax_amount, "tax_amount")],
    ["ImporteTotal", decimal(record.total_amount, "total_amount")],
    ["Huella", priorHash(record.previous_hash)],
    ["FechaHoraHusoGenRegistro", timestamp(record.generated_at)]
  ];
  if (!["F1", "F2", "F3", "R1", "R2", "R3", "R4", "R5"].includes(record.document_type)) throw new TypeError("Unsupported AEAT invoice type.");
  return hashFields(fields);
}

export async function hashCancellation(record) {
  return hashFields([
    ["IDEmisorFacturaAnulada", nif(record.issuer_nif)],
    ["NumSerieFacturaAnulada", number(record.document_number)],
    ["FechaExpedicionFacturaAnulada", aeatDate(record.issue_date)],
    ["Huella", priorHash(record.previous_hash)],
    ["FechaHoraHusoGenRegistro", timestamp(record.generated_at)]
  ]);
}

async function hashFields(fields) {
  const hashInput = fields.map(([key, value]) => `${key}=${value}`).join("&");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(hashInput));
  return { hashInput, hash: [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, "0")).join("").toUpperCase() };
}

/** Builds a URL, not a scannable QR image and not evidence AEAT accepted a record. */
export function buildQrUrl(record, { environment, mode = "verifactu" } = {}) {
  if (!["test", "production"].includes(environment)) throw new TypeError("Explicit test or production environment required.");
  if (!["verifactu", "non_verifactu"].includes(mode)) throw new TypeError("Explicit valid SIF mode required.");
  const host = environment === "production" ? "https://www2.agenciatributaria.gob.es" : "https://prewww2.aeat.es";
  const endpoint = mode === "verifactu" ? "ValidarQR" : "ValidarQRNoVerifactu";
  const values = { nif: nif(record.issuer_nif), numserie: number(record.document_number), fecha: aeatDate(record.issue_date), importe: decimal(record.total_amount, "total_amount") };
  return `${host}/wlpl/TIKE-CONT/${endpoint}?${new URLSearchParams(values)}`;
}

function xml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
const el = (tag, value) => `<sf:${tag}>${xml(value)}</sf:${tag}>`;
const block = (tag, children) => `<sf:${tag}>${children}</sf:${tag}>`;

function identity(record) {
  return el("IDEmisorFactura", nif(record.issuer_nif)) + el("NumSerieFactura", number(record.document_number)) + el("FechaExpedicionFactura", aeatDate(record.issue_date));
}

function chain(context, issuerNif) {
  if (!Object.hasOwn(context, "previous")) throw new TypeError("previous must explicitly be null for a confirmed first record, or the locked chain head.");
  if (context.previous === null) return { xml: block("Encadenamiento", el("PrimerRegistro", "S")), hash: "" };
  if (nif(context.previous?.issuer_nif) !== issuerNif) throw new TypeError("Previous chain record belongs to a different issuer.");
  const hash = priorHash(context.previous.hash);
  if (!hash) throw new TypeError("Existing chain head cannot have an empty hash.");
  return { xml: block("Encadenamiento", block("RegistroAnterior", identity(context.previous) + el("Huella", hash))), hash };
}

function systemXml(system) {
  if (!system || system.verifactu_only !== true) throw new TypeError("This serializer only supports a VERI*FACTU-only installation.");
  for (const field of ["multi_taxpayer", "has_multiple_taxpayers"]) if (typeof system[field] !== "boolean") throw new TypeError(`${field} must be explicitly configured.`);
  if (system.has_multiple_taxpayers && !system.multi_taxpayer) throw new TypeError("Multiple issuers require a multi-taxpayer system.");
  return block("SistemaInformatico",
    el("NombreRazon", required(system.producer_name, "producer_name", 120)) + el("NIF", nif(system.producer_nif, "producer_nif")) +
    el("NombreSistemaInformatico", required(system.name, "system.name", 30)) + el("IdSistemaInformatico", required(system.id, "system.id", 2)) +
    el("Version", required(system.version, "system.version", 50)) + el("NumeroInstalacion", required(system.installation, "system.installation", 100)) +
    el("TipoUsoPosibleSoloVerifactu", "S") + el("TipoUsoPosibleMultiOT", system.multi_taxpayer ? "S" : "N") + el("IndicadorMultiplesOT", system.has_multiple_taxpayers ? "S" : "N"));
}

/** Pure initial-registration serializer. Corrections by difference only. */
export async function serializeRegistration(document, context) {
  if (document.currency !== "EUR") throw new TypeError("Only EUR fiscal documents are supported.");
  if (document.issuer_snapshot?.country !== "ES" || document.issuer_snapshot?.jurisdiction !== "common_territory") throw new TypeError("Only explicitly configured Spanish common-territory issuers are supported.");
  if (!["F1", "F2", "R1", "R5"].includes(document.document_type)) throw new TypeError("Unsupported document type in this fiscal release.");
  if (document.release_version !== context.system?.version) throw new TypeError("Document release and fiscal system version do not match.");
  const issuerNif = nif(document.issuer_snapshot.tax_id);
  const issuerName = required(document.issuer_snapshot.legal_name, "issuer legal_name", 120);
  const previous = chain(context, issuerNif);
  const generatedAt = timestamp(context.generated_at);
  const generatedIdentity = { issuer_nif: issuerNif, document_number: document.document_number, issue_date: document.issue_date };
  const correction = document.document_type.startsWith("R");
  if (correction && (!context.correction || !document.correction_of || context.correction.id !== document.correction_of)) throw new TypeError("A correction requires its linked original fiscal document.");
  if (!correction && (context.correction || document.correction_of)) throw new TypeError("Original invoices cannot carry correction links.");
  if (correction && nif(context.correction.issuer_nif) !== issuerNif) throw new TypeError("A correction must have the same issuer as its original.");
  const rows = document.tax_summary;
  if (!Array.isArray(rows) || !rows.length || rows.length > 12) throw new TypeError("AEAT requires 1–12 tax breakdown rows.");
  let base = 0n, tax = 0n, total = 0n;
  const taxXml = rows.map(row => {
    if (row.treatment !== "taxable" || ![0, 400, 1000, 2100].includes(row.rate_bps)) throw new TypeError("Unsupported tax treatment/rate: this adapter currently supports ordinary IVA only.");
    const rowBase = cents(row.base_cents), rowTax = cents(row.tax_cents), rowTotal = cents(row.total_cents);
    if (rowBase + rowTax !== rowTotal || (row.rate_bps === 0 && rowTax !== 0n)) throw new TypeError("Tax breakdown does not reconcile.");
    if (!correction && (rowBase < 0n || rowTax < 0n || rowTotal < 0n)) throw new TypeError("Negative original invoice amounts are not supported.");
    base += rowBase; tax += rowTax; total += rowTotal;
    return block("DetalleDesglose", el("Impuesto", "01") + el("ClaveRegimen", "01") + el("CalificacionOperacion", "S1") +
      el("TipoImpositivo", aeatAmount(row.rate_bps)) + el("BaseImponibleOimporteNoSujeto", aeatAmount(rowBase)) + el("CuotaRepercutida", aeatAmount(rowTax)));
  }).join("");
  if (base !== cents(document.taxable_base_cents) || tax !== cents(document.tax_cents) || total !== cents(document.total_cents)) throw new TypeError("Fiscal totals do not match the tax breakdown.");
  let recipientXml = "";
  if (["F1", "R1"].includes(document.document_type)) {
    const customer = document.customer_snapshot;
    if (customer?.country !== "ES") throw new TypeError("This adapter currently supports domestic NIF recipients only.");
    recipientXml = block("Destinatarios", block("IDDestinatario", el("NombreRazon", required(customer.legal_name, "customer legal_name", 120)) + el("NIF", nif(customer.tax_id, "customer NIF"))));
  } else if (document.customer_snapshot?.tax_id || document.customer_snapshot?.legal_name) {
    throw new TypeError("Identified simplified invoices require reviewed F1/R1 mapping; do not silently discard the recipient.");
  }
  const hashRecord = { ...generatedIdentity, document_type: document.document_type, tax_amount: aeatAmount(tax), total_amount: aeatAmount(total), previous_hash: previous.hash, generated_at: generatedAt };
  const hashResult = await hashRegistration(hashRecord);
  const correctionXml = correction ? el("TipoRectificativa", "I") + block("FacturasRectificadas", block("IDFacturaRectificada", identity(context.correction))) : "";
  const operationXml = document.operation_date && document.operation_date !== document.issue_date ? el("FechaOperacion", aeatDate(document.operation_date)) : "";
  const registration = block("RegistroAlta", el("IDVersion", "1.0") + block("IDFactura", identity(generatedIdentity)) +
    el("NombreRazonEmisor", issuerName) + el("TipoFactura", document.document_type) + correctionXml + operationXml +
    el("DescripcionOperacion", required(context.description, "description", 500)) + recipientXml + block("Desglose", taxXml) +
    el("CuotaTotal", hashRecord.tax_amount) + el("ImporteTotal", hashRecord.total_amount) + previous.xml + systemXml(context.system) +
    el("FechaHoraHusoGenRegistro", generatedAt) + el("TipoHuella", "01") + el("Huella", hashResult.hash));
  const payload = `<sfLR:RegFactuSistemaFacturacion xmlns:sfLR="${VERIFACTU_NAMESPACES.ledger}" xmlns:sf="${VERIFACTU_NAMESPACES.info}">` +
    `<sfLR:Cabecera>${block("ObligadoEmision", el("NombreRazon", issuerName) + el("NIF", issuerNif))}</sfLR:Cabecera>` +
    `<sfLR:RegistroFactura>${registration}</sfLR:RegistroFactura></sfLR:RegFactuSistemaFacturacion>`;
  return { xml: payload, ...hashResult, qrUrl: buildQrUrl(hashRecord, { environment: context.environment }), environment: context.environment, transmitted: false };
}

export function soapEnvelope(registration) {
  if (!registration?.xml?.startsWith("<sfLR:RegFactuSistemaFacturacion ")) throw new TypeError("Expected a serialized registration.");
  return `<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="${VERIFACTU_NAMESPACES.soap}"><soapenv:Header/><soapenv:Body>${registration.xml}</soapenv:Body></soapenv:Envelope>`;
}
