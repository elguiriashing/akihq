# AkiHQ suite: supported scope, legal obligations and release evidence

**Assessment date: 23 September 2026. Status: engineering implementation in progress; not a declaration that the complete suite is compliant or commercially ready.**

This extends [the PoS/inventory audit](POS-INVENTORY-READINESS.md) to the actual routes in `assets/app-v32.js`, the Cloudflare gateway and the shared database. A safe implementation and a complete operational/legal service are different deliverables. A visible screen, a checklist, an export or a successful unit test is not evidence of an end-to-end regulated workflow. Production deployment, migrations, live tenant acceptance, certificate-based fiscal submission and organisational contracts have not been established by this document.

The initial fiscal adapter is deliberately limited to **EUR, Spanish common-territory ordinary IVA, domestic NIF recipients, full/simplified invoices and corrections by difference**. The first issuance release is gated. This is not support for all Spanish tax territories, all sectors, payroll, public-sector invoicing, general accounting or every special IVA regime. Unsupported transactions need a supported external solution until implemented; do not relabel them as compliant by disabling a warning.

## 1. Complete module matrix

“Required” means a legal obligation where the stated activity and scope apply. “Benchmark” means a useful established-product capability, not a universal statutory requirement. All rows also depend on tenant isolation, access controls, security, accurate product descriptions and the processor/controller arrangements in section 3.

| Actual tool | Required capability / scope | Competitor / operational benchmark | Release evidence or remaining gap |
|---|---|---|---|
| Dashboard | Tenant-scoped personal/commercial data; truthful period, currency, source and revenue definitions [G1] | Reconciled drill-down, date/timezone filters, fresh-data indicator | Reconcile displayed totals to full-period ledgers; distinguish forecasts, sales, payments and fiscal invoices |
| CRM: companies, leads, contacts, deals; Business CRM | Appropriate lawful basis and notices; source/provenance; rights/opposition; professional-contact processing is not permission to send unsolicited campaigns [G1–G3] | HubSpot stores processing basis and communication subscriptions separately [C1–C2] | Imported contacts begin without marketing permission. Legal-basis records and notices need evidence; complete cross-module rights search still required |
| Inbox, support tickets | Private threads/attachments; sender verification; purpose-based access and retention; AI interaction transparency when applicable [G1, A1] | Assignment, escalation, response history, attachment isolation, human handoff | Test forged identities, attachment access, tenant changes and support-agent escalation; AI notices must cover the actual customer-facing channel |
| Tasks and projects | Minimise worker/client data; authorised access; transparent and proportionate monitoring [G1, G3] | Dependencies, assignees, activity history, permissions, time estimates | Task timers are productivity records, not statutory attendance or payroll |
| Calendar / booking | Minimise invitee data; access-controlled calendar sharing; clear price/cancellation terms if taking consumer bookings [G1, U1] | Conflict detection, timezone/DST handling, cancellations and reminders | Check invite recipients and private notes; booking terms need business-specific review. Calendar events do not establish employment-law compliance |
| PoS | Server-authoritative totals, invoice type eligibility, fiscal identity/tax snapshots, consecutive numbering, protected records, correction workflow, SIF requirements; lawful cash acceptance [F1–F6] | Till reconciliation, partial returns, split tender, hardware/payment integration [C3] | Fiscal core/serializer are foundations. Issuance stays blocked until atomic chain, transmission, record lifecycle, signed producer declaration and release tests exist |
| Sales & Billing | Compliant issue-time invoice content; full/simplified rules; rectification; export/retention; distinct B2B e-invoice requirements when applicable [F1–F5] | Quotes → order → delivery → invoice; payment allocation; Sage/a3 integrations [C4] | Legacy editable records cannot become issued fiscal documents by changing their label. Fiscal invoice output must be tested; structured B2B exchange and payment statuses are separate remaining work |
| Inventory | Reliable evidence for accounting; sector-specific traceability where applicable [I1–I2] | Locations, receiving, transfers, supplier orders, historical costing, stocktakes, lots/expiry, recipes/waste [C5] | Stock ledger and valuation work requires migration and concurrency proof. Food traceability/allergen/recall workflows require explicit scope; a lot-name field alone is insufficient |
| Marketing, Social, SMS, email campaigns | LSSI communication rules; easy revocation/opposition; suppression; lawful channel-specific basis; truthful advertising and rights to media [G1–G3] | Subscription topics, suppression lists, verified senders, audit/delivery/bounce records [C2] | Governed email path checks tenant sender/consent and verified webhooks; sending remains disabled until configured. SMS/social adapters need equivalent controls; global platform credentials must not serve arbitrary tenants |
| Sites & Forms | Operator/legal/privacy information; purpose/notice at collection; unbundled optional marketing; cookie rules; consumer information and accessibility where applicable [G1–G4, U1–U2] | Accessible validated forms, spam protection, versioned notices and consent receipts | Verify public published output, not only the admin editor. Generated legal copy needs actual controller details. Payment/order cancellation and accessibility acceptance are not yet demonstrated |
| Automation | Same permissions and legal rules as the action being automated; no consent, fiscal lock or access-control bypass [G1–G3, F1–F2] | Durable jobs, idempotency, bounded retries, audit, failures and manual intervention | Recheck authorisation and suppression at execution time. A scheduled message must not send after opt-out. Destructive or monetary actions need narrowly scoped authority |
| Team Chat / Telegram | Channel and tenant privacy, worker transparency, appropriate retention and international-transfer assessment [G1, G3] | Workspace/channel roles, moderation, attachments, explicit external forwarding | No indiscriminate forwarding of customer/worker data to Telegram. Review bot scopes, chats, recipients, storage and third-party agreements |
| People | Secure staff administration. If attendance is offered: daily start/end, accessible records and four-year preservation; part-time monthly summaries [H1] | Odoo attendance approvers see their assigned employees; leave approvals [C6] | Current People module is staff administration. Statutory timekeeping, collective-agreement rules, payroll/social-security and leave-law calculations are not implemented or certified by this branch |
| Knowledge / media library | Access permissions, confidentiality, lawful uploads, privacy rights and retention [G1] | Version history, approval, search, ownership, restore and attachment scanning | Test cross-tenant search and file URLs; sanitise rendered content; actual malware scanning and complete file retention/deletion need service evidence |
| Analytics | Lawful, proportionate processing; cookie consent where required; no hidden employee monitoring [G1, G3–G4] | Source attribution, currency/timezone correctness, exports, accountable tracking configuration | Limited audience measurement can qualify for AEPD consent exemption only under all guide conditions. General third-party tracking must not be assumed exempt |
| AI Team / support AI | Classify each intended use; disclose direct AI interaction, support oversight and AI literacy; prohibit disallowed workplace uses [A1–A2] | Human-review workflow, scoped retrieval, traceable output, model/provider governance | Drafting and ticket classification are not automatically high-risk. Hiring/performance/task-allocation profiling needs separate assessment; no unreviewed expansion into those uses |
| Integrations | Tenant-scoped secrets/authorisation, data minimisation, processor/transfer assessment; valid external-action authority [G1] | OAuth scopes, token rotation/revocation, webhooks, per-tenant connections and reconciliation | A “connected” badge must mean a tested connection. Old global integrations cannot safely be reused for customer tenants; require separate tenant credential storage and audit |
| Settings, exports, backups, workspace closure | Data access/rights; protected fiscal retention; restore capability; SaaS portability/exit obligations as applicable [G1, F2, D1] | Full export with attachments/metadata, restore drills, least-privilege accountant access, configurable retention | A browser snapshot is not a complete backup. Need independently restored database/files/config, fiscal chain continuity, export after termination, legal holds and an evidenced deletion process |

## 2. Fiscal implementation contract and evidence

### Implemented serialization, with deliberately bounded scope

`cloudflare/verifactu.js` implements exact integer-cent formatting, AEAT invoice dates, registration/cancellation hashes, QR URLs, and a registration XML/SOAP serializer. It does **not** contact AEAT, sign records, issue an invoice, authorise a business, allocate a fiscal sequence or create a durable chain. `transmitted: false` is returned. A QR URL is not evidence of acceptance and is not a scannable image.

`serializeRegistration(document, context)` accepts immutable fiscal document snapshots. The context must explicitly contain:

- `system`: actual producer legal name/NIF; system name/ID/version; stable installation number; explicit VERI*FACTU-only and multi-taxpayer flags.
- `generated_at`: preserved, server-controlled timestamp with timezone, at record generation.
- `previous`: **explicitly** `null` only for the confirmed first record; otherwise the locked previous issuer/number/date/hash from this issuer and installation, across invoice series.
- `description`, `environment` (`test` or `production`), and the linked original document identity for R1/R5 corrections.

The serializer currently rejects unsupported territory/currency/treatment/recipient configurations, missing fiscal identity, changed release versions, inconsistent tax totals, an omitted chain head and cross-issuer links. It uses F1/F2 and R1/R5 difference corrections only. It is not the full AEAT validation ruleset: tax eligibility, NIF checksum/census status, simplified-invoice eligibility, backdating, special regimes, correction law and all arithmetic must also be enforced by the issuing service. It does not infer exemptions from a text description.

Validation performed on 23 September 2026:

- `node --test cloudflare/verifactu.test.js`: **10 tests passed**, including the three published AEAT SHA-256 golden vectors, separate environments, exact amounts, calendar dates, XML escaping, mixed ordinary IVA, correction links and rejected unsupported configurations.
- Generated F1/F2/R1/R5 payloads validated with `lxml.etree.XMLSchema` against the **unmodified official** `SuministroLR.xsd` and `SuministroInformacion.xsd`, resolving the official W3C XMLDSig schema locally. All four passed. This is structural validation, not AEAT acceptance or complete semantic validation.
- Official files downloaded from the namespace URLs below on the assessment date. SHA-256: `SuministroInformacion.xsd` = `ee4c1655175644de44c4c25055ffeb8e5f4bb4bc3834ce8254d4222ef18c8aa1`; `SuministroLR.xsd` = `cbdac8d427cc5ab5d77ca48974cab0f35d6bb819c4c66db361681e3710aeba36`; `SistemaFacturacion.wsdl` = `05919120708ff7650612fa6683c9336eaf919335d9a4db10e86759190af48602`.

### Required integration before fiscal activation

1. **Atomic issuance:** acquire issuer/installation chain and series locks, snapshot validated document/lines/tax, allocate number, generate record timestamp/hash/XML, persist all with the chain head and durable submission job, then commit as a single protected issuance operation. The current JavaScript serializer is a building block; assembling XML later from a mutable sale or allocating the chain in an asynchronous sender does not satisfy this design. Define rollback/recovery before release.
2. **Actual sender identity:** provision an AEAT-compatible certificate and authorised representation or a contracted fiscal provider. Keep private keys outside browser/snapshots; record certificate expiry and renewal ownership. AkiPasa's platform certificate does not automatically confer permission to submit for every customer.
3. **AEAT transport:** implement SOAP submission with appropriate certificate authentication, current validations, response parsing per record, CSV acknowledgement preservation, accepted/accepted-with-errors/rejected handling, safe retries, incident/backlog handling and reconciliation. A network timeout is an unknown outcome; query/recover before replaying as a new invoice. Respect AEAT's pacing information. Do not equate HTTP 200 with acceptance.
4. **Lifecycle:** implement record annulment separately from a commercial refund/corrective invoice; preserve submitted and resubmission records, rejection/subsanation flags, links and exact canonical payloads. The pure cancellation hash helper does not implement this lifecycle.
5. **Customer output:** printable full/simplified/corrective invoices with issuer and recipient fields required for that type, line details, taxable bases, tax rates/amounts, applicable dates and correction references. Render the fiscal QR at 30–40 mm, level M, required clear area/labels and pre-eminent placement. Do not print the VERI*FACTU legend for a workflow that does not operate as such [F4].
6. **Producer declaration:** real legal entity and responsible signatory issue the version-specific declaration describing the actual system and components. Make it accessible in the product, and preserve versions. AEAT does not supply prior product approval merely because a test passes [F3].
7. **Financial operations and export:** link sale, invoice, payments/refunds and stock without double-counting. Add complete issued/received invoice books and evidence packages, supported tax mappings, period controls and validated accountant imports. Generic operational Excel is not an official IVA-book import or a Modelo 303 filing.
8. **Real acceptance:** concurrent tills, timeout after commit, changed-payload retry, mixed IVA/rounding, partial refund repeated, wrong tenant, rejected submission, certificate expiry, full restore without duplicate fiscal number/hash, customer download, accountant import and physical receipt scan. Record signed-off evidence and tested supported scope before enabling production.

The WSDL specifies normal certificate endpoints `https://prewww1.aeat.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP` (external tests) and `https://www1.agenciatributaria.gob.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP` (production), plus distinct alternative certificate endpoints. Select the appropriate endpoint for the credential type from the current WSDL; never use the QR verification endpoint to submit records.

### Fiscal scope decisions that must remain explicit

- SIF and VERI*FACTU are not synonyms: non-VERI*FACTU has additional preservation/signature/event requirements and is not implemented here. Customer adaptation dates (currently 1 January / 1 July 2027 by taxpayer class) do not replace the separate producer obligations; see the earlier audit's official references.
- SII, Basque foral rules, Navarra, IGIC and IPSI require their own analysis/adapters. Do not call all foral territories “TicketBAI” or assume all are covered by AEAT IVA reporting.
- Simplified invoices have legal eligibility and thresholds; €3,000 is not a universal limit. Customer identification/deduction requests can change the required output/type.
- Zero-rated, exempt, reverse charge, recargo de equivalencia, cash accounting, margin/travel schemes and non-domestic transactions require explicit semantic codes and reviewed rules. A stored tax rate or editable reason alone does not implement them.
- The ordinary €1,000 cash prohibition is assessed at **operation** level, including fragmented payments, not just the individual cash line. The documented nonresident private-person exception is not a generic tourist toggle; collect only proportionate evidence and use a reviewed policy [F6].
- B2B electronic invoicing under RD 238/2026 is separate from VERI*FACTU. Structured exchange, interoperability and invoice/payment statuses are required in scope; effective timing is linked to the implementing order. This research did not verify a final order starting the clock; do not publish a guessed start date. PDF or VERI*FACTU XML alone is not the complete B2B service [F5].

## 3. Privacy, communications, workers and AI

### Product controls versus organisational duties

The branch adds or prepares tenant controls, privacy-controller configuration, database-backed append-only communication-consent evidence/suppression, a manual rights-request tracker and scoped export. These improve compliance; they do not constitute a complete GDPR programme or prove that the underlying permission was validly obtained. A request tracker does not fulfil a request until all relevant modules, files, providers and backups have been considered.

Before serving external businesses, establish actual controller/processor roles, Art. 28 processing terms, subprocessor authorisation/list, transfer safeguards where needed, documented purposes/lawful bases/notices, retention schedules, incident ownership and rights handling. AkiPasa may be processor for tenant CRM data while acting as controller for its own billing/security; document the real facts rather than use a blanket role. A DPO or DPIA is required only where the applicable criteria are met, not automatically for every small business [G1].

Rights workflow must verify identity proportionately, track the one-calendar-month response limit, record any permitted extension and communicate it in time, protect other people's data, and distinguish access from portability. Erasure is not unconditional destruction: preserve required fiscal records under restricted access with a reason; remove unnecessary copies and keep auditable outcomes. Test a cross-module request before claiming full coverage.

Security needs risk-appropriate measures and a demonstrated restore, not merely a backup subscription. A processor must notify the controller without undue delay; controller supervisory notification is normally within 72 hours of awareness unless the legal low-risk exception applies. Maintain assessment/notification evidence [G1].

### Messaging and forms

LSSI consent/request or the narrow existing-customer exception governs promotional email/equivalent messages. Generic GDPR legitimate interest, public business listings, purchased databases or a phone number in CRM do not override it. The exception concerns lawfully obtained contact data and the sender's similar products/services, with an easy opt-out. The conservative implemented campaign path requires recorded consent; this intentionally does not automate every legal exception [G2–G3].

Keep channel/purpose/controller identity and the notice version alongside evidence. Check suppression both at enqueue and dispatch; withdrawal must cancel pending messages. Bounce/complaint events must be authenticated and idempotent. Transactional messages should remain restricted to their actual service purpose. Unknown imported consent is unknown, not “yes”.

Required public privacy information is not optional even where no consent checkbox is needed for contract fulfilment. Optional marketing consent must be separate from submitting a support request or ordering. Block non-exempt tracking before consent; provide accessible refusal and withdrawal. AEPD allows a narrow audience-measurement exemption subject to its complete conditions; do not label an analytics vendor exempt just because it is configured server-side [G4].

### Staff tools and AI

The People module currently supports administration, not payroll or statutory recording of working time. An attendance product needs daily entry/exit records, reliable correction history, four-year availability and appropriate worker/representative/inspection access. Part-time workers have additional monthly-summary requirements. Apply relevant agreements and worker-information/consultation requirements; project effort timers and leave calendars do not substitute for these [H1].

AI use must be mapped by purpose, affected person and actual action. Direct support chatbot users need appropriate disclosure under Article 50; staff need suitable AI literacy and human escalation. Preserve source provenance and provider governance for generated content. Prohibited workplace emotion recognition must not be added as an ordinary analytics feature. Plain drafting/ticket triage is not automatically high-risk. Recruitment, performance decisions and worker allocation/profiling can enter the high-risk regime and require separate assessment [A1–A2].

The Commission's current official timeline reflects the AI Omnibus entering force 27 July 2026: Article 50 transparency requirements apply from 2 August 2026, while Annex III high-risk requirements apply from 2 December 2027 and regulated-product high-risk requirements from 2 August 2028. Existing GDPR, employment and prohibited-practice rules still apply. Do not use superseded dates or infer that delayed high-risk obligations allow otherwise unlawful processing [A1–A2].

## 4. Sector and commercial boundaries

Hospitality/food businesses need accessible allergen information, supplier/product traceability and a usable withdrawal/recall process in the applicable scope; generic stock counts are insufficient. Recipe changes must update allergen evidence rather than rely on AI guesses. Lot/expiry features are useful implementation choices; the law does not prescribe a particular commercial inventory module [I1–I2].

Public consumer sites/booking/checkouts need applicable precontract information, final prices, cancellation/refund rights and complaint routes. Exceptions for particular dated leisure services must not be applied to every product. Accessibility legislation has service-specific scope and a microenterprise service exemption; it is not a blanket “every internal B2B screen requires CE certification” rule. Build accessible interfaces regardless, and obtain scope-specific evidence before making compliance claims [U1–U2].

For the hosted suite, assess Data Act switching obligations, make exportable data/metadata and interfaces usable, and include an actual exit process in contracts. It applies to qualifying SaaS, not only connected-device manufacturers. The Commission identifies the end of switching/egress charges on 12 January 2027. A truncated UI CSV is not a complete customer exit package [D1].

Hardware/card acquiring, regulated scales, payroll submissions, public-sector Facturae/FACe, regulated financial services and sector-specific licences are outside the implemented scope. Do not store raw card data or promise bank settlement based on a manual tender label. If any is offered, add its integration, contractual and test evidence first.

## 5. Release register: concrete outstanding inputs and evidence

| Owner | Required input or work | Acceptance evidence |
|---|---|---|
| AkiPasa company / responsible producer | Legal name, NIF, registered contact/address, software/installation identity, responsible signatory | Version-specific accurate signed SIF declaration exposed in product |
| Each business / authorised representative | Fiscal identity, regime/territory, SII status, tax treatment, invoice series, external-filing authorisation | Reviewed onboarding and representative/certificate linkage, not guessed defaults |
| Fiscal engineering + authorised provider | Atomic fiscal chain, durable actual record lifecycle, certificate service, sender, acknowledgement/rejection/recovery | Complete test-environment records and failure/recovery results, then controlled production acceptance |
| Accounting reviewer + engineering | Correct issue/return examples, purchase ledger, historical valuation, target bookkeeping formats | Successful real imports into the named accountant software, balanced totals, documented assumptions |
| Security / operations | Deployed schema/RLS checks, tenant isolation, secret custody, monitored backups and restores | Negative access tests against deployed roles; independent restore including fiscal-chain continuity |
| Privacy/controller owners | Actual processing terms, subprocessors/transfers, retention and rights/incident responsibilities | Executed agreements and exercised rights/incident processes; no invented signatures |
| Marketing operations | Verified tenant sending domain/mailbox; provider/webhook secrets; channel/notice scope | SPF/DKIM/DMARC and delivery checks, unsubscribe before queued dispatch, signed bounce/complaint tests |
| HR product owner | Decide whether to offer only staff admin or develop actual attendance/payroll | Explicit accurate scope; if expanded, legal-rule mapping and worker/inspection acceptance |
| Site/business owner | Legal/public consumer information, cookies/tracking inventory, accessibility/sector requirements | Published-site testing including keyboard/mobile/screen-reader forms and actual purchase/cancellation flow |
| Commercial / legal owner | Supported sectors/territories/features and exit terms | Marketing and contracts match implemented tested capabilities; no “all businesses fully compliant” claim |

No production-data rewrite, tax filing, customer communication, company signature or claim of government approval was performed as part of the pure serializer validation. Technical work can be developed independently of missing company details; those details and genuine external acceptance cannot be fabricated to clear the release gate.

## Sources checked on 23 September 2026

### Law and official guidance

- **F1** [BOE RD 1619/2012: invoice obligations](https://www.boe.es/buscar/act.php?id=BOE-A-2012-14696).
- **F2** [BOE RD 1007/2023: SIF regulation](https://www.boe.es/buscar/act.php?id=BOE-A-2023-24840); [AEAT technical portal](https://sede.agenciatributaria.gob.es/Sede/iva/sistemas-informaticos-facturacion-verifactu/informacion-tecnica.html).
- **F3** [AEAT producer-declaration FAQ](https://sede.agenciatributaria.gob.es/Sede/iva/sistemas-informaticos-facturacion-verifactu/preguntas-frecuentes/certificacion-sistemas-informaticos-declaracion-responsable.html).
- **F4** [AEAT hash specification v0.1.2, 27 August 2024](https://www.agenciatributaria.es/static_files/AEAT_Desarrolladores/EEDD/IVA/VERI-FACTU/Veri-Factu_especificaciones_huella_hash_registros.pdf); [QR specification v0.5.0, 10 December 2025](https://www.agenciatributaria.es/static_files/AEAT_Desarrolladores/EEDD/IVA/VERI-FACTU/DetalleEspecificacTecnCodigoQRfactura.pdf); [SuministroInformacion.xsd](https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroInformacion.xsd); [SuministroLR.xsd](https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroLR.xsd); [SistemaFacturacion.wsdl](https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SistemaFacturacion.wsdl); [web-service description](https://sede.agenciatributaria.gob.es/static_files/AEAT_Desarrolladores/EEDD/IVA/VERI-FACTU/Veri-Factu_Descripcion_SWeb.pdf).
- **F5** [BOE RD 238/2026: B2B e-invoicing](https://www.boe.es/diario_boe/txt.php?id=BOE-A-2026-7295), especially arts. 3–12 and final provision 4; [AEAT explanation](https://sede.agenciatributaria.gob.es/Sede/todas-noticias/2026/marzo/31/facturacion-electronica-obligatoria.html).
- **F6** [AEAT cash-payment limits](https://sede.agenciatributaria.gob.es/Sede/colaborar-agencia-tributaria/denuncias/denuncia-pagos-efectivo.html); [AEAT interpretation](https://sede.agenciatributaria.gob.es/Sede/normativa-criterios-interpretativos/analisis/Pagos_en_efectivo.html).
- **G1** [GDPR](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng), notably arts. 5–6, 12–22, 25, 28, 30, 32–35 and chapter V.
- **G2** [BOE LSSI Ley 34/2002](https://www.boe.es/buscar/act.php?id=BOE-A-2002-13758), arts. 10, 20–22 and 27–28.
- **G3** [BOE LOPDGDD Ley Orgánica 3/2018](https://www.boe.es/buscar/act.php?id=BOE-A-2018-16673), especially arts. 19 and 87–90.
- **G4** [AEPD cookie guide](https://www.aepd.es/guias/guia-cookies.pdf); [AEPD audience-measurement guide](https://www.aepd.es/guias/guia-cookies-analiticas-externas.pdf).
- **H1** [BOE Estatuto de los Trabajadores](https://www.boe.es/buscar/act.php?id=BOE-A-2015-11430), arts. 12.4(c) and 34.9.
- **A1** [European Commission: AI transparency guidelines, updated 6 August 2026](https://digital-strategy.ec.europa.eu/en/policies/guidelines-ai-transparency-obligations).
- **A2** [European Commission: AI Act and current implementation timeline, updated 3 August 2026](https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai).
- **I1** [AESAN: traceability and food-safety framework](https://aesan.gob.es/seguridad-alimentaria); [Regulation 178/2002, arts. 18–19](https://eur-lex.europa.eu/legal-content/es/ALL/?uri=celex%3A32002R0178).
- **I2** [AESAN: allergen information](https://aesan.gob.es/seguridad-alimentaria/informacion-alimentaria/etiquetado-sustancias); [BOE RD 126/2015](https://www.boe.es/buscar/act.php?id=BOE-A-2015-2293).
- **U1** [BOE consumer law RDL 1/2007](https://www.boe.es/buscar/act.php?id=BOE-A-2007-20555).
- **U2** [BOE Ley 11/2023: accessibility](https://www.boe.es/buscar/act.php?id=BOE-A-2023-11022), title I, including scope and art. 3.3 service microenterprise exemption.
- **D1** [European Commission: Data Act explained, chapter VI](https://digital-strategy.ec.europa.eu/en/factpages/data-act-explained).

### Primary competitor documentation (capabilities, not legal certification)

- **C1** [HubSpot: legal basis of processing](https://knowledge.hubspot.com/contacts/how-can-i-track-lawful-basis-of-processing-in-hubspot).
- **C2** [HubSpot: email subscription types, updated 11 September 2026](https://knowledge.hubspot.com/marketing-email/set-up-email-subscription-types).
- **C3** [Square Spain: export reports](https://squareup.com/help/es/es/article/8362-print-export-or-email-your-reports).
- **C4** [Holded: Sage-compatible export](https://help.holded.com/es/articles/7052929-integrar-holded-con-sage).
- **C5** [Odoo 19: valuation](https://www.odoo.com/documentation/19.0/applications/inventory_and_mrp/inventory/inventory_valuation/cheat_sheet.html); [lots and expiration](https://www.odoo.com/documentation/19.0/applications/inventory_and_mrp/inventory/product_management/product_tracking/expiration_dates.html).
- **C6** [Odoo 19: attendance roles](https://www.odoo.com/documentation/19.0/applications/hr/attendances.html); [time-off management](https://www.odoo.com/documentation/19.0/applications/hr/time_off/management.html); [multi-company access](https://www.odoo.com/documentation/19.0/applications/general/companies/multi_company.html).
