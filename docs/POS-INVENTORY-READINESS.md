# AkiHQ PoS & Inventory: commercial readiness audit

**23 September 2026 · Verdict: NOT ready to offer as a compliant Spanish fiscal billing solution.**

This is an engineering and regulatory gap assessment, not a signed legal opinion or a producer declaration. AkiHQ has operational foundations, but adding an export button cannot supply missing historical tax data or turn editable CRM documents into protected fiscal records.

## What was actually checked

- AkiHQ `main` at `d304c3fb151e49414b8d63381cc7788b0efc11d8`, including the loaded `assets/app-v32.js`, invoice printing, checkout, inventory, exports and service worker.
- Live Supabase metadata: PoS/inventory columns, constraints, RLS policies, grants, triggers and current function bodies. This matters because repository SQL is not a complete representation of the deployed database.
- Relevant AkiPasa repository migrations for the shared database; no changes to that repository.
- Official BOE and AEAT sources, and published Odoo, Holded and Square documentation.
- No live sale, refund, tax submission or mutation of production business data was performed. This is not a completed authenticated user-journey or penetration test. No customer fiscal details were extracted.

## Verified findings

| Priority | Finding | Evidence | Required result |
|---|---|---|---|
| Blocker | PoS has no fiscal invoice model | Live `crm_pos_sales` and `crm_pos_sale_lines` have no issuer/recipient fiscal snapshots, series, fiscal number, tax basis/rate/amount, exemption reason or corrective reference | Dedicated fiscal documents and lines, with immutable issue-time values |
| Blocker | Checkout trusts the submitted total | Live `crm_record_pos_sale` inserts `p_total_cents` without reconciling it to lines | Calculate totals server-side; reject inconsistent requests and enforce price/discount permissions |
| Blocker | Generic invoices remain editable records | `getFormSchema` invoice fields accept manual number, total, tax and status; `renderSales` offers editing; no fiscal issue/lock lifecycle found | Separate editable drafts from issued documents; correct issued documents through linked records |
| Blocker | Invoice print lacks essential fiscal information | `printInvoice` prints workspace name/timezone and customer name/email/city, with one description and generic tax total | Validated invoice identity, addresses, itemisation and tax presentation for each supported document type |
| Blocker | Numbers are generated in the browser | Suggested invoice number uses `1013 + state.invoices.length` | Atomic issuer/series numbering with concurrent-till tests; no reuse after corrections |
| Blocker | No implemented SIF compliance flow found | No matching VERI*FACTU, Facturae or corrective-invoice implementation in the inspected AkiHQ source; no dedicated fiscal tables in metadata checked | Compliant record generation, preservation, reporting capability and versioned declaration |
| Blocker | Historical tax cannot be reconstructed reliably | Sales only preserve quantity and price, not applicable tax treatment | Preserve original records; flag unknown tax; accountant-reviewed migration from actual original documents |
| High | Checkout retry identity is unstable | `completePOSSale` creates a fresh date/random reference on every attempt | Persistent pending-sale identity, request fingerprint, retry/status recovery and database idempotency |
| High | Same-key requests are not compared | RPC returns an existing sale for a matching workspace/provider/reference without verifying payload equality | Identical retry returns the result; changed payload produces a conflict |
| High | Staff attribution can name another active member | RPC accepts `p_employee_profile` and checks membership, not equality to the actor | Derive operator from authenticated actor, or require an explicitly authorised delegation workflow |
| High | No complete correction/refund workflow found | Sale status supports refunded/voided, but no refund RPC found; fiscal correction links absent | Partial/full refunds, money movement and stock disposition, with over-refund and repeat protection |
| High | Inventory has no historical cost layers | `cost_cents` is a mutable current item value; movement rows lack receipt unit cost/valuation layers | Recorded receipt costs, agreed valuation method, cost of goods sold and closing-period valuation |
| High | Warehouse is presentation metadata | Frontend fills `warehouse` from cached product data; live stock is one `on_hand` per workspace/item | Real locations, stock by location and atomic paired transfer records |
| High | Main legacy snapshot read policy needs remediation review | Live snapshot SELECT policy permits `workspace_id = 'ws_akipasa'` for authenticated users, independently of membership in that expression | Prove effective access and migrate legacy reads before tightening policy; do not assume ordinary member access is safe |
| High | Retention and recovery not demonstrated | Workspace foreign keys cascade; no inspected fiscal archive or successful restore evidence | Protected fiscal retention, controlled closure/deletion, tested restore and export after subscription end |
| Operational | Screen collections are incomplete | Frontend loads only 50 sales, 100 movements and 250 tip adjustments | Reports must query their full period independently; display limits must never become export limits |
| Operational | Card button is not terminal settlement | Checkout writes a provider/tender label through the RPC | Honest manual-tender wording or a real payment adapter with settlement/refund reconciliation |
| Operational | Product catalogue changes lose historical descriptions | Sale lines reference item IDs without issue-time SKU/name/unit snapshots | Immutable sale/invoice line descriptions, units, prices and tax treatment |

Positive findings: inspected PoS/inventory tables have RLS enabled. `crm_has_tool` checks workspace access and active entitlement. Ordinary authenticated users have SELECT-only access to sale headers/lines and SELECT/INSERT access to stock movements. Sales and stock changes occur in one database transaction. A database non-negative stock constraint prevents overselling from committing. These are useful foundations, but do not establish fiscal compliance. No direct authenticated update to `on_hand` was established; item metadata permissions must not be mistaken for balance-editing permission.

## Spanish legal requirements that affect the product

**Invoices:** RD 1619/2012 governs full and simplified documents, consecutive numbering, mandatory identity/tax information and corrective invoices. Simplified invoices are generally permitted up to €400 including IVA, with up to €3,000 for specifically listed operations such as relevant retail and hospitality; this is not a universal limit. Customer invoice requests and applicable exceptions must be handled. [1]

**Billing software:** SIF requirements and VERI*FACTU transmission are related but not identical. The current user adaptation deadlines are before **1 January 2027** for corporate-tax taxpayers in scope and **1 July 2027** for the remaining in-scope taxpayers. The producer/commercialiser adaptation deadline is separate: AEAT identifies **29 July 2025**. AkiPasa must not treat customer extensions as permission to market unadapted billing software. [2–4]

**Declaration:** The producer supplies a declaration of responsibility for each software version, accessible in the product. AEAT does not require an external product certification or prior product registration. Do not advertise “AEAT approved” merely because a test request succeeds or a QR appears. The declaration must describe the actual compliant system and component responsibilities. [5]

**IVA:** Current general/reduced rates are 21%, 10% and 4%, with 0% for certain operations. Product/service treatment must be configured and effective-dated; a venue-wide percentage is insufficient. Exempt, zero-rated, outside-scope and reverse-charge cases need distinct treatment, plus special regimes where supported. [6]

**Accountant exports:** IVA books remain a separate obligation from SIF reporting. AEAT publishes normalised electronic book formats; an arbitrary CSV, PDF or generic Excel workbook is not automatically an AEAT import file. [7–8]

**Electronic B2B invoicing:** RD 238/2026 is a separate workstream involving structured invoices and their exchange/statuses. Its effective schedule is linked to the implementing ministerial order; this audit did not verify a final published order starting that clock. Do not promise a fixed start date from a draft. PDF-only output is not that structured B2B capability. [9]

**Territorial scope:** Onboarding must distinguish tax jurisdictions and SII status. Foral obligations need separate assessment; Navarra must not simply be labelled “TicketBAI.” IGIC/IPSI support must be explicitly scoped before claiming Spain-wide tax coverage. AEAT describes SII exclusions and foral scope. [10]

## Benchmark against established software

These are documented capabilities, not independent certifications of the vendors or claims that every feature is legally mandatory.

| Benchmark | Published capability | AkiHQ target |
|---|---|---|
| Odoo Spain localisation | VERI*FACTU module and invoice QR, including PoS workflow | A tested fiscal lifecycle connected to checkout [11] |
| Odoo inventory valuation | Structured accounting valuation methods and stock accounting | Receipt costs and reproducible historical valuation [12] |
| Holded → Sage Despacho Connected | Compatible income/expense exports with date range and account-digit configuration | Versioned accountant-specific adapters, proven by actual import [13] |
| Holded inventory | Products, purchasing/sales orders and stock exports | Procurement/receiving/stock workflows with exportable links [14] |
| Square reports | Exportable reports and tender/sales analysis | Complete period reporting and till reconciliation [15] |
| Square inventory counts | Count and variance reports, including responsibility/review metadata | Controlled stocktakes, approval, reason codes and variance history [16] |

Beyond the fiscal blockers, the full suite needs purchase orders, supplier invoices and returns, barcode/variant support, unit conversion, stocktakes, reorder purchasing, multi-location stock, and appropriate lot/expiry/traceability support for target sectors. Hospitality adds recipes/ingredient consumption, waste, tables, split bills and kitchen workflows. These are sector/product requirements, not a claim that each is required by tax law for every venue.

## Concrete export change in this branch

PoS and Inventory gain **Export records** with inclusive business-date ranges converted to UTC using the workspace timezone. The Excel workbook queries the database with workspace filters and keyset pagination instead of exporting the truncated screen arrays. Errors prevent partial downloads; oversized exports stop explicitly.

- PoS: recorded sales, sale lines, tender totals grouped separately by currency/status, and recorded-versus-calculated total checks. Tips remain separate. Missing tax is labelled **NOT RECORDED**, never zero.
- Inventory: current quantities/current costs and the period movement ledger with references and actors. No false historical or accounting valuation claim.
- Readme: scope, date boundaries, collection time, limitations and counts. Reads are live, not a frozen transaction snapshot.
- Excel text cells remain text, including formula-looking strings and leading-zero SKUs. The existing CSV helper also neutralises formula-looking text.

This is an **operational reconciliation aid** for an accountant. It does not implement legal IVA books, invoice compliance, journal entries, payment settlement or fiscal submission. Neither historical sales nor existing invoice numbers are rewritten.

Validation: 20 tests passed across the new export suite and existing multi-tenant suite, including Excel write/read roundtrip, 1,051-row pagination, tenancy filters, DST, fractional-cent rounding, reconciliation failures, error handling and spreadsheet safety. JavaScript syntax checks passed. A local browser-layout check was attempted but could not run because the Chromium executable is not installed; authenticated UI acceptance is still required. Production data and database schema remain unchanged.

## Implementation order and acceptance gates

1. **Contain current risk.** Clearly identify existing outputs as operational/unverified; audit the main legacy snapshot access policy. Agree a supported first release: common-territory, EUR businesses under explicitly supported tax regimes. Existing customers need a documented compliant billing path during migration.
2. **Build the server fiscal core.** Fiscal profile per issuer, validated customer snapshots, tax definitions with effective dates, immutable document/line tables, consecutive series, an issuance transaction, request fingerprints and append-only corrections. Link each operational sale to its fiscal document; never count both as separate revenue. Store integer money and decimal quantities with explicit rounding rules. Existing client-supplied totals must not be trusted.
3. **Implement the chosen SIF mode.** A VERI*FACTU-first design is a reasonable engineering choice, subject to supported scope. Implement official record schemas, prescribed hash construction/chaining, QR, identity/version fields, certificate/representation setup, submission queue, acknowledgements, rejection resolution and outage recovery. A generic blockchain/hash column is not a substitute. Validate against current AEAT technical specifications before coding this layer. If using another provider, document responsibility for the complete system.
4. **Complete financial operations.** Partial/full returns, corrective documents, return-to-stock versus waste, discounts, mixed IVA, cash/card/split tender, tips, cash opening/closing, counted-versus-expected cash, payout/fee reconciliation and manager-controlled overrides. Add payments as a separate ledger, not mutable labels on invoices.
5. **Produce accountant-grade output.** Issued/received invoice books with fiscal identifiers, dates, type/series/number, customer/supplier NIF, tax bases/rates/amounts, regimes and correction links. Include purchase evidence and deductible-tax decisions. Add period locks, reconciliation totals, invoice PDF/XML package, journal export only where journals really exist, and a3/Sage/Holded adapters only after confirmed target-format import tests. Modelo 303 summaries are not tax filings.
6. **Complete inventory accounting.** Locations and transfers, receipts with costs, suppliers/purchase orders, approved stock counts, chosen FIFO/weighted-average policy, COGS, period-end valuation and sector traceability. Keep current-price stock estimates distinct from accounting value.
7. **Release with evidence.** Test two tills racing for the last item/next invoice number; timeout-after-commit retries; mismatched retries; unauthorised tenant access; mixed rates and discount allocation; price changes after sale; rounding; partial returns twice; Madrid/Canary boundaries; AEAT rejection/outage recovery; real accountant import; backup restore without duplicated invoice numbers; retention and tenant closure. Obtain Spanish fiscal review of scope and examples, and have the responsible producer issue the version-specific declaration. Neither this audit nor a green unit-test run supplies that declaration.

Operational readiness also requires processor agreements/privacy access controls, restricted accountant roles, monitoring, supported hardware/payment integrations and a support/incident process. Their complete review is outside the PoS/inventory metadata inspection performed here.

## Sources

Checked 22–23 September 2026. Recheck official publications at implementation and release.

1. [BOE: RD 1619/2012, especially articles 4, 6, 7 and 15](https://www.boe.es/buscar/act.php?id=BOE-A-2012-14696)
2. [BOE: RD 1007/2023, consolidated, including final provision four](https://www.boe.es/buscar/act.php?id=BOE-A-2023-24840)
3. [AEAT: SIF deadline extension](https://sede.agenciatributaria.gob.es/Sede/iva/sistemas-informaticos-facturacion-verifactu/nota-informativa-ampliacion-plazo-adaptacion-facturacion.html)
4. [AEAT: RD 254/2025 and producer deadline](https://sede.agenciatributaria.gob.es/Sede/iva/novedades-iva/novedades-normativa-2025/real-decreto-254-2025-1-abril.html)
5. [AEAT: producer declaration FAQ](https://sede.agenciatributaria.gob.es/Sede/iva/sistemas-informaticos-facturacion-verifactu/preguntas-frecuentes/certificacion-sistemas-informaticos-declaracion-responsable.html)
6. [AEAT: current IVA rates](https://sede.agenciatributaria.gob.es/Sede/iva/calculo-iva-repercutido-clientes/tipos-impositivos-iva.html)
7. [AEAT: IVA books](https://sede.agenciatributaria.gob.es/Sede/iva/libros-registro.html)
8. [AEAT: common electronic IVA/IRPF book format](https://sede.agenciatributaria.gob.es/static_files/Sede/Tema/IVA/Fact_registro/Libros_registro/Formato_Electronico_Comun_Libros_Registro_IVA_IRPF.pdf)
9. [BOE: RD 238/2026](https://www.boe.es/boe/dias/2026/03/31/pdfs/BOE-A-2026-7295.pdf)
10. [AEAT: scope, SII and foral FAQ](https://sede.agenciatributaria.gob.es/Sede/iva/sistemas-informaticos-facturacion-verifactu/preguntas-frecuentes/cuestiones-generales-ambitos-aplicacion.html)
11. [Odoo 19: Spain localisation](https://www.odoo.com/documentation/19.0/applications/finance/fiscal_localizations/spain.html)
12. [Odoo 19: inventory valuation](https://www.odoo.com/documentation/19.0/applications/inventory_and_mrp/inventory/inventory_valuation/cheat_sheet.html)
13. [Holded: Sage integration/export](https://help.holded.com/es/articles/7052929-integrar-holded-con-sage)
14. [Holded: inventory workflows](https://help.holded.com/es/collections/2479911-inventario)
15. [Square Spain: reporting exports](https://squareup.com/help/es/es/article/8362-print-export-or-email-your-reports)
16. [Square Spain: inventory variance reports](https://squareup.com/help/es/es/article/8251-view-and-export-inventory-variance-report-with-square-for-retail)
