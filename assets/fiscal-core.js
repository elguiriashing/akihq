/* Money previews and fiscal onboarding helpers. PostgreSQL is authoritative. */
(function (root) {
  "use strict";
  const MAX_CENTS = 2000000000n;
  function integer(value, label, max = MAX_CENTS) {
    if (!/^(0|[1-9]\d*)$/.test(String(value))) throw new Error(`${label} must be a non-negative integer.`);
    const n = BigInt(value);
    if (n > max) throw new Error(`${label} exceeds the supported limit.`);
    return n;
  }
  function quantity(value) {
    const match = /^(0|[1-9]\d{0,5})(?:\.(\d{1,4}))?$/.exec(String(value));
    if (!match) throw new Error("Quantity must have at most four decimal places.");
    const n = BigInt(match[1]) * 10000n + BigInt((match[2] || "").padEnd(4, "0"));
    if (n <= 0n) throw new Error("Quantity must be positive.");
    return n;
  }
  const round = (n, d) => (n + d / 2n) / d;
  function calculateLine(input) {
    const price = integer(input.unit_price_cents, "Price");
    const qty = quantity(input.quantity);
    const rate = integer(input.rate_bps, "IVA rate", 2100n);
    if (![0n, 400n, 1000n, 2100n].includes(rate)) throw new Error("Unsupported IVA rate.");
    const discount = integer(input.discount_bps ?? 0, "Discount", 10000n);
    const total = round(qty * price * (10000n - discount), 100000000n);
    if (total > MAX_CENTS) throw new Error("Line total exceeds the supported limit.");
    const base = round(total * 10000n, 10000n + rate);
    return { quantity: String(input.quantity), unit_price_cents: Number(price), rate_bps: Number(rate), discount_bps: Number(discount), base_cents: Number(base), tax_cents: Number(total - base), total_cents: Number(total) };
  }
  function calculate(lines) {
    if (!Array.isArray(lines) || !lines.length || lines.length > 200) throw new Error("Between 1 and 200 lines are required.");
    const calculated = lines.map(calculateLine), grouped = new Map();
    let total = 0;
    for (const line of calculated) {
      const g = grouped.get(line.rate_bps) || { rate_bps: line.rate_bps, base_cents: 0, tax_cents: 0, total_cents: 0 };
      for (const key of ["base_cents", "tax_cents", "total_cents"]) g[key] += line[key];
      grouped.set(line.rate_bps, g); total += line.total_cents;
    }
    if (total > Number(MAX_CENTS)) throw new Error("Document total exceeds the supported limit.");
    return { lines: calculated, tax_summary: [...grouped.values()].sort((a,b) => a.rate_bps-b.rate_bps), total_cents: total, tax_cents: calculated.reduce((s,l) => s+l.tax_cents, 0), taxable_base_cents: calculated.reduce((s,l) => s+l.base_cents, 0) };
  }
  function validSpanishTaxId(value) {
    const id = String(value || "").trim().toUpperCase();
    const letters = "TRWAGMYFPDXBNJZSQVHLCKE";
    if (/^\d{8}[A-Z]$/.test(id)) return letters[Number(id.slice(0,8)) % 23] === id[8];
    if (/^[XYZ]\d{7}[A-Z]$/.test(id)) return letters[Number("XYZ".indexOf(id[0]) + id.slice(1,8)) % 23] === id[8];
    if (!/^[ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J]$/.test(id)) return false;
    let sum = 0;
    for (let i=1;i<=7;i++) { const n = Number(id[i]); sum += i % 2 ? Math.floor(n*2/10)+(n*2)%10 : n; }
    const digit = (10-sum%10)%10, letter = "JABCDEFGHI"[digit];
    if (/[ABEH]/.test(id[0])) return id[8] === String(digit);
    if (/[NPQRSW]/.test(id[0])) return id[8] === letter;
    return id[8] === String(digit) || id[8] === letter;
  }
  function profileIssues(profile = {}) {
    const issues = [];
    for (const key of ["legal_name", "tax_id", "address", "postal_code", "city"]) if (!String(profile[key] || "").trim()) issues.push(`${key} is required`);
    if (profile.tax_id && !validSpanishTaxId(profile.tax_id)) issues.push("Spanish NIF/NIE checksum is invalid or this identifier type needs manual verification");
    if (profile.country !== "ES" || profile.jurisdiction !== "common_territory" || profile.tax_regime !== "general" || profile.currency !== "EUR" || profile.sii) issues.push("This release supports common-territory Spain, general IVA, EUR, and businesses outside SII only");
    if (!/^\d{5}$/.test(String(profile.postal_code || ""))) issues.push("Spanish postal code must contain five digits");
    return issues;
  }
  function readiness(profile, release) {
    const blockers = profileIssues(profile);
    if (!release?.atomic_adapter_ready) blockers.push("Atomic fiscal checkout and submission integration is not installed");
    if (!release || release.status !== "approved" || !release.declaration_url || !release.declaration_sha256 || !release.transport_adapter || !release.validation_evidence_url) blockers.push("Fiscal issuance is disabled until a versioned producer declaration and validated submission integration are available");
    return { ready: blockers.length === 0, blockers };
  }
  // Proportion of an original line, with the final refund receiving all remaining cents.
  function refundAllocation(original, refundedQuantity, refundQuantity) {
    const q = quantity(original.quantity), prior = String(refundedQuantity) === "0" ? 0n : quantity(refundedQuantity), next = quantity(refundQuantity);
    if (prior + next > q) throw new Error("Refund exceeds the original quantity.");
    const originalTotal=integer(original.total_cents,"Original total"), originalBase=integer(original.base_cents,"Original base");
    if (originalBase>originalTotal) throw new Error("Original base exceeds gross total.");
    const grossAt=(n)=>round(originalTotal*n,q);
    const baseAt=(n)=>originalTotal ? round(originalBase*grossAt(n),originalTotal) : 0n;
    const base=Number(baseAt(prior+next)-baseAt(prior)),total=Number(grossAt(prior+next)-grossAt(prior));
    return { base_cents: -base || 0, tax_cents: -(total-base) || 0, total_cents: -total || 0 };
  }
  async function collectLedger(client, { workspace, from, through, maxDocuments = 50000 }) {
    if (!workspace || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(through) || from > through) throw new Error("Workspace and valid ledger dates required.");
    const documents = [], seen = new Set();
    let after = null, asOf = null;
    for (;;) {
      const { data, error } = await client.rpc("crm_fiscal_export_ledger", { p_workspace: workspace, p_from: from, p_through: through, p_as_of: asOf, p_after: after, p_limit: 250 });
      if (error) throw new Error(error.message || "Fiscal ledger export failed.");
      if (!Array.isArray(data?.documents) || !data.as_of || (asOf && asOf !== data.as_of)) throw new Error("Invalid or inconsistent ledger response.");
      asOf = data.as_of;
      for (const doc of data.documents) {
        if (doc.workspace_id !== workspace || !doc.id || seen.has(doc.id) || !Array.isArray(doc.lines)) throw new Error("Invalid workspace or duplicate fiscal record.");
        const sum = doc.lines.reduce((s,l) => ({ base:s.base+Number(l.base_cents), tax:s.tax+Number(l.tax_cents), total:s.total+Number(l.total_cents) }), {base:0,tax:0,total:0});
        if (sum.base !== Number(doc.taxable_base_cents) || sum.tax !== Number(doc.tax_cents) || sum.total !== Number(doc.total_cents)) throw new Error("Fiscal document totals do not reconcile.");
        seen.add(doc.id); documents.push(doc);
        if (documents.length > maxDocuments) throw new Error("Ledger is too large; select a shorter period.");
      }
      if (data.documents.length < 250) break;
      after = data.documents.at(-1).id;
    }
    return { workspace, from, through, as_of: asOf, format: "akihq-issued-ledger-v1", documents };
  }
  function ledgerWorkbook(XLSX, ledger) {
    const workbook = XLSX.utils.book_new();
    const add = (name, rows) => {
      const sheet = XLSX.utils.aoa_to_sheet(rows);
      // Explicit text cells preserve NIF/SKU leading zeroes and formula-looking names.
      rows.forEach((row,r) => row.forEach((value,c) => { if (typeof value === "string") sheet[XLSX.utils.encode_cell({r,c})] = { t:"s", v:value }; }));
      XLSX.utils.book_append_sheet(workbook,sheet,name);
    };
    add("Readme", [["Format",ledger.format],["Workspace",ledger.workspace],["From",ledger.from],["Through",ledger.through],["Captured at",ledger.as_of],["Scope","Issued-document reconciliation ledger; not the official AEAT IVA book, a tax filing or an accountant-software import adapter."],["Historical operational sales","Excluded: they have no verified historical tax snapshot."],["Money","All amounts are integer cents; currency appears on each document."],["Payment/stock","Fiscal documents do not prove payment settlement or returned stock."],["Documents",ledger.documents.length]]);
    const docs = [["ID","Number","Type","Issue date","Operation date","Issuer NIF","Customer NIF","Customer name","Currency","Base cents","IVA cents","Total cents","Corrects ID","Correction reason"]];
    const lines = [["Document ID","Number","Line","SKU","Description","Unit","Quantity","Unit price cents","Discount basis points","IVA basis points","Treatment","Reason","Base cents","IVA cents","Total cents","Original line ID"]];
    const taxes = [["Document ID","Number","IVA basis points","Treatment","Reason","Base cents","IVA cents","Total cents"]];
    for (const d of ledger.documents) {
      docs.push([d.id,d.document_number,d.document_type,d.issue_date,d.operation_date,d.issuer_snapshot?.tax_id || "",d.customer_snapshot?.tax_id || "",d.customer_snapshot?.legal_name || "",d.currency,d.taxable_base_cents,d.tax_cents,d.total_cents,d.correction_of || "",d.correction_reason || ""]);
      for (const l of d.lines) lines.push([d.id,d.document_number,l.line_number,l.sku,l.description,l.unit,String(l.quantity),l.unit_price_cents,l.discount_bps,l.rate_bps,l.treatment,l.reason,l.base_cents,l.tax_cents,l.total_cents,l.original_line_id || ""]);
      for (const t of d.tax_summary) taxes.push([d.id,d.document_number,t.rate_bps,t.treatment,t.reason,t.base_cents,t.tax_cents,t.total_cents]);
    }
    add("Documents",docs); add("Lines",lines); add("Tax breakdown",taxes);
    return workbook;
  }
  const api = { calculateLine, calculate, validSpanishTaxId, profileIssues, readiness, refundAllocation, collectLedger, ledgerWorkbook };
  root.AkiFiscalCore = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window === "undefined" ? globalThis : window);
