import test from "node:test";
import assert from "node:assert/strict";
import { aeatAmount, aeatDate, buildQrUrl, hashRegistration, hashCancellation, serializeRegistration, soapEnvelope, VERIFACTU_QR_PRINT } from "./verifactu.js";

const firstHash = "3C464DAF61ACB827C65FDA19F352A4E3BDC2C640E9E9FC4CC058073F38F12F60";
const secondHash = "F7B94CFD8924EDFF273501B01EE5153E4CE8F259766F88CF6ACB8935802A2B97";
const golden = { issuer_nif: "89890001K", document_number: "12345678/G33", issue_date: "01-01-2024", document_type: "F1", tax_amount: "12.35", total_amount: "123.45", previous_hash: "", generated_at: "2024-01-01T19:20:30+01:00" };

export function fixture() {
  return {
    document: {
      issuer_snapshot: { legal_name: "Example & Co", tax_id: "89890001K", country: "ES", jurisdiction: "common_territory" },
      customer_snapshot: { legal_name: "Example Customer", tax_id: "89890001K", country: "ES" },
      document_type: "F1", document_number: "INV/2026-00001", issue_date: "2026-09-23", operation_date: "2026-09-22",
      release_version: "test-1.0", currency: "EUR", taxable_base_cents: 10000, tax_cents: 2100, total_cents: 12100,
      tax_summary: [{ treatment: "taxable", rate_bps: 2100, base_cents: 10000, tax_cents: 2100, total_cents: 12100 }]
    },
    context: {
      previous: null, generated_at: "2026-09-23T12:13:14+02:00", environment: "test", description: "Test goods",
      system: { producer_name: "Test producer", producer_nif: "89890001K", name: "AkiHQ", id: "AH", version: "test-1.0", installation: "test-install-1", verifactu_only: true, multi_taxpayer: true, has_multiple_taxpayers: true }
    }
  };
}

test("AEAT official first-record SHA-256 golden vector", async () => {
  const result = await hashRegistration(golden);
  assert.equal(result.hash, firstHash);
  assert.ok(result.hashInput.includes("&Huella=&FechaHoraHusoGenRegistro="));
});

test("AEAT official subsequent-registration and cancellation golden vectors", async () => {
  const second = { ...golden, document_number: "12345679/G34", previous_hash: firstHash, generated_at: "2024-01-01T19:20:35+01:00" };
  assert.equal((await hashRegistration(second)).hash, secondHash);
  assert.equal((await hashCancellation({ ...second, previous_hash: secondHash, generated_at: "2024-01-01T19:20:40+01:00" })).hash, "177547C0D57AC74748561D054A9CEC14B4C4EA23D1BEFD6F2E69E3A388F90C68");
});

test("hash uses trimmed raw text and rejects an unspecified chain head", async () => {
  assert.equal((await hashRegistration({ ...golden, document_number: " 12345678/G33 " })).hash, firstHash);
  await assert.rejects(hashRegistration({ ...golden, previous_hash: undefined }), /previous_hash/);
  const result = await hashRegistration({ ...golden, document_number: "INV & ONE" });
  assert.match(result.hashInput, /NumSerieFactura=INV & ONE&/);
  assert.doesNotMatch(result.hashInput, /%26|&amp;/);
});

test("QR encodes the series, preserves the fiscal total and separates test/production", () => {
  const testUrl = new URL(buildQrUrl({ ...golden, document_number: "12345678&G33" }, { environment: "test" }));
  assert.equal(testUrl.hostname, "prewww2.aeat.es");
  assert.equal(testUrl.searchParams.get("numserie"), "12345678&G33");
  assert.equal(testUrl.searchParams.size, 4);
  assert.equal(testUrl.searchParams.get("importe"), "123.45");
  assert.ok(testUrl.href.includes("%26"));
  assert.match(buildQrUrl(golden, { environment: "production", mode: "non_verifactu" }), /^https:\/\/www2.agenciatributaria.gob.es\/wlpl\/TIKE-CONT\/ValidarQRNoVerifactu\?/);
  assert.throws(() => buildQrUrl(golden), /environment/);
  assert.throws(() => buildQrUrl({ ...golden, document_number: "Fáctura" }, { environment: "test" }), /ASCII/);
  assert.equal(VERIFACTU_QR_PRINT.errorCorrection, "M");
});

test("dates and cents reject silent rollovers, decimal floats and imprecise amounts", () => {
  assert.equal(aeatDate("2024-02-29"), "29-02-2024");
  assert.throws(() => aeatDate("2026-02-29"), /calendar/);
  assert.throws(() => aeatDate("2026-13-01"), /calendar/);
  assert.equal(aeatAmount(-1), "-0.01");
  assert.equal(aeatAmount("99999999999999"), "999999999999.99");
  assert.throws(() => aeatAmount(12.1), /integer/);
  assert.throws(() => aeatAmount(Number.MAX_SAFE_INTEGER + 1), /integer/);
  assert.throws(() => aeatAmount("100000000000000"), /limits/);
});

test("registration produces escaped XML and matching unescaped hash/QR input", async () => {
  const { document, context } = fixture();
  document.document_number = 'INV&"<1>';
  const result = await serializeRegistration(document, context);
  assert.match(result.xml, /<sf:NombreRazonEmisor>Example &amp; Co<\/sf:NombreRazonEmisor>/);
  assert.match(result.xml, /<sf:NumSerieFactura>INV&amp;&quot;&lt;1&gt;<\/sf:NumSerieFactura>/);
  assert.match(result.xml, /<sf:PrimerRegistro>S<\/sf:PrimerRegistro>/);
  assert.match(result.xml, /<sf:FechaOperacion>22-09-2026<\/sf:FechaOperacion>/);
  assert.match(result.xml, /<sf:CuotaTotal>21.00<\/sf:CuotaTotal>/);
  assert.match(result.xml, /<sf:TipoImpositivo>21.00<\/sf:TipoImpositivo>/);
  assert.match(result.hashInput, /NumSerieFactura=INV&"<1>&/);
  assert.equal(new URL(result.qrUrl).searchParams.get("numserie"), document.document_number);
  assert.equal(result.transmitted, false);
  assert.match(soapEnvelope(result), /<soapenv:Body><sfLR:RegFactuSistemaFacturacion/);
});

test("serializer supports a mixed ordinary-IVA breakdown without altering amounts", async () => {
  const { document, context } = fixture();
  document.tax_summary.push({ treatment: "taxable", rate_bps: 1000, base_cents: 1001, tax_cents: 100, total_cents: 1101 });
  document.taxable_base_cents += 1001; document.tax_cents += 100; document.total_cents += 1101;
  const result = await serializeRegistration(document, context);
  assert.equal((result.xml.match(/<sf:DetalleDesglose>/g) || []).length, 2);
  assert.match(result.hashInput, /CuotaTotal=22.00&ImporteTotal=132.01&/);
});

test("difference correction links its original and hashes negative fiscal totals", async () => {
  const { document, context } = fixture();
  document.document_type = "R1"; document.correction_of = "original-id";
  for (const key of ["taxable_base_cents", "tax_cents", "total_cents"]) document[key] *= -1;
  for (const key of ["base_cents", "tax_cents", "total_cents"]) document.tax_summary[0][key] *= -1;
  context.correction = { id: "original-id", issuer_nif: "89890001K", document_number: "ORIGINAL/001", issue_date: "2026-09-22" };
  context.previous = { issuer_nif: "89890001K", document_number: "OTHER-SERIES/021", issue_date: "2026-09-23", hash: firstHash };
  const result = await serializeRegistration(document, context);
  assert.match(result.xml, /<sf:TipoRectificativa>I<\/sf:TipoRectificativa>/);
  assert.match(result.xml, /<sf:FacturasRectificadas>/);
  assert.match(result.hashInput, /CuotaTotal=-21.00&ImporteTotal=-121.00/);
  assert.match(result.xml, /<sf:RegistroAnterior>/);
  assert.doesNotMatch(result.xml, /<sf:PrimerRegistro>/);
});

test("simplified receipts require anonymous F2 mapping and cannot silently discard recipient", async () => {
  const { document, context } = fixture();
  document.document_type = "F2";
  await assert.rejects(serializeRegistration(document, context), /Identified simplified/);
  document.customer_snapshot = {};
  const result = await serializeRegistration(document, context);
  assert.doesNotMatch(result.xml, /<sf:Destinatarios>/);
});

test("unknown or unsupported fiscal configurations fail closed", async () => {
  const mutations = [
    ({ context }) => { delete context.previous; },
    ({ context }) => { context.previous = { issuer_nif: "12345678Z", document_number: "1", issue_date: "2026-09-22", hash: firstHash }; },
    ({ context }) => { context.generated_at = "2026-09-23T12:00:00"; },
    ({ context }) => { context.generated_at = "2026-09-23T24:00:00+02:00"; },
    ({ context }) => { context.system.producer_name = ""; },
    ({ context }) => { context.system.multi_taxpayer = false; },
    ({ context }) => { context.system.version = "other"; },
    ({ document }) => { document.currency = "GBP"; },
    ({ document }) => { document.issuer_snapshot.jurisdiction = "canary_islands"; },
    ({ document }) => { document.tax_summary[0].treatment = "exempt"; },
    ({ document }) => { document.tax_summary[0].rate_bps = 500; },
    ({ document }) => { document.total_cents++; },
    ({ document }) => { document.tax_summary[0].total_cents++; },
    ({ document }) => { document.customer_snapshot.country = "GB"; },
    ({ document }) => { document.document_type = "R1"; },
    ({ document }) => { document.correction_of = "unexpected"; },
    ({ context }) => { context.description = "Bad\u0000text"; }
  ];
  for (const mutate of mutations) {
    const data = fixture(); mutate(data);
    await assert.rejects(serializeRegistration(data.document, data.context), TypeError);
  }
});
