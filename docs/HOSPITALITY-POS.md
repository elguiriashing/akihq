# Hospitality PoS — implementation and activation, 25 September 2026

This extends the existing compliance candidate. It is **not deployed** and does not make AkiHQ a complete legally compliant fiscal, accounting or payroll product. The fiscal issuance gate remains in place. Apply `20260925131603_hospitality_pos.sql` after the five September 23 compliance migrations, with the matching frontend release. The two September 25 14:03 migrations follow it, adding paired printing and atomic fiscal records. Do not apply these to an unverified production schema.

## Implemented

| Workflow | Behavior |
|---|---|
| Till / restaurant mode | Administrator chooses till-only or restaurant; occupied tables prevent an unsafe switch to till mode. Walk-in orders remain available in either mode. |
| Floor plans | Up to 30 named pages and 300 tables, with editable names/numbers, seating capacity, page, shape and percentage position/size. Circle/oval, rectangle and rounded rectangle. Numeric editing plus pointer/touch dragging and corner resizing. Arrow keys move; Shift increases the step; Alt+arrows resize. Save/discard preserves the original server version and rejects stale layouts. |
| Staff phones | Each staff member signs in with their own account and PoS permission. Orders are held in PostgreSQL and polled every 2.5 seconds while PoS is active. No owner credentials are shared. No offline-order promise or peer-to-peer dependency. |
| Shared orders | Product prices are taken from the server. Quantity, preparation notes, seat, kitchen/bar routing, guest count and order notes can be edited. Changes carry version checks and actor evidence. |
| Moving / splitting | Move the whole order to an empty table, or transfer selected quantities to a new walk-in, empty table or another occupied table. Both versions are checked. Notes and sent preparation quantities travel with the items. A transfer that changes combined cent rounding is rejected; split payment amounts instead. |
| Payments | Partial amounts, equal-share helper, mixed cash/external-card/other methods, external references, cash tender/change, administrator reversal evidence. Final payment records one operational sale and deducts Main stock atomically. This does not charge a card, independently confirm settlement or send a refund. |
| Cash policy | Conservative EUR policy rejects cash on a linked operation totalling €1,000 or more, including orders split between tables. Split/merged orders retain an operation group. Changes that raise an operation with cash history above that threshold fail closed. No tourist exception or foreign-currency conversion is implemented. Operators must not create unrelated orders to fragment a single operation. |
| Preparation | Explicit kitchen/bar revision tickets retain previous and current lines. A revision must be compared; it is not an instruction to cook the entire current order again. Table transfers produce informational relocation tickets; note changes and cancellations are separately identified. |
| Printing | Shared persisted queue, 58/80 mm print layouts, system print dialog and a paired outbound-only Node agent for unattended network ESC/POS or CUPS output. See `tools/print-agent/README.md`. The bar computer uses its installed printer driver; connectivity depends on the hardware/OS. Claim and print-attempt records prevent another device automatically printing the same ticket. Native output is recorded as spooled, never assumed physically printed; the manual dialog path requires physical confirmation. Failed/uncertain jobs require an explicit reasoned COPY. |
| Accountant evidence | Permission-checked JSON package of orders, payment/reversal records, order-to-sale links, events and retained tickets over at most 31 local days. Date boundaries use workspace timezone. Excessive exports fail instead of truncating. Existing PoS and fiscal workbook exports remain separate; this package is not an official tax book. |

## Integrity and recovery

All writes enter one live-access-checked command RPC. A workspace transaction lock protects transfers and occupancy; version checks reject stale devices. Direct API access to the private hospitality tables is revoked and RLS enabled. Commands, events and original ticket contents are immutable. Workspace/account changes dispose the browser controller. Module revocation is checked again on every RPC.

Before transmission, the browser saves the exact command and UUID under its workspace/account key. Web Locks prevent two tabs racing the local recovery record. Unknown outcomes retain that record and block new commands. Retry returns the original result. The alternative recovery action checks the result under the same server lock, or inserts a cancellation tombstone so a delayed request cannot execute later. Previously pending legacy checkouts retain their existing recovery screen before the new interface is shown.

Orders with recorded payments cannot change items or transfer until payment records have been reversed by an administrator. Reversal is evidence of an external action, not a refund processor. Catalogue changes require explicit administrator repricing before taking a payment. Stock is **not reserved** while orders are open; insufficient Main stock rejects final posting without partially writing a sale or payment. If money has already been collected externally, staff must reconcile that real collection before retrying or refunding—this release does not automate that exception.

The manual print flow is queued → claimed → attempted/uncertain → manually confirmed; the native agent records spooled after transport acceptance. The attempt is committed before invoking the browser print dialog. Closing/cancelling a dialog does not imply successful printing. There is no timeout that automatically reprints food tickets. If a device disappears after claiming, another operator must inspect the printer and request a marked copy. The queue displays the oldest unresolved jobs ahead of confirmed history, at most 100 at a time; retained evidence is not limited to those 100.

## Legal and competitor basis

- [Odoo 19 restaurant features](https://www.odoo.com/documentation/19.0/applications/sales/point_of_sale/restaurant.html): floor/table management, orders, kitchen/bar preparation, bill printing/splitting. These establish functional comparison points, not a legal certification.
- [Odoo preparation display](https://www.odoo.com/documentation/19.0/applications/sales/point_of_sale/extra/preparation.html): named preparation stations and routing. This implementation currently provides two destinations, not configurable arbitrary stations or a full production KDS.
- [AEAT general SIF questions](https://sede.agenciatributaria.gob.es/Sede/iva/sistemas-informaticos-facturacion-verifactu/preguntas-frecuentes/cuestiones-generales-conceptos-definiciones.html): preparatory documents must remain associated with subsequent invoicing and retained as applicable. Drafts do not carry fiscal QR codes. Merely adding “NO ES FACTURA” does not satisfy a business's obligation to issue an invoice.
- [AEAT cash limits](https://sede.agenciatributaria.gob.es/Sede/colaborar-agencia-tributaria/denuncias/denuncia-pagos-efectivo.html): ordinary €1,000 operation threshold and limited €10,000 exception. The implementation uses the conservative ordinary threshold only.
- The unattended implementation uses a narrowly scoped paired device and outbound-only Node agent; it does not depend on QZ Tray or a local browser signing service.

See `SUITE-COMPLIANCE.md` for the wider Odoo/Holded/Square comparison and unresolved legal requirements. The hospitality flow retains operational evidence and links a completed order to its operational sale. It does **not yet** issue the mandatory final fiscal invoice or provide a complete automatic preliminary-to-fiscal-document lifecycle.

## Activation and remaining acceptance

1. Run the complete test gate. Apply all eight compliance/hospitality/printer/fiscal migrations together to a representative **staging** copy; verify schema compatibility, live memberships and RLS. Drain old clients for the coordinated release.
2. Test with two independently authenticated phones and a bar computer: simultaneous line edits, table occupancy, transfers into occupied tables, changed destination versions, network loss after commit, permission revocation, logout and multiple tabs.
3. Test the actual receipt printer/OS/driver with 58/80 mm rolls, long notes, accented Spanish text, multi-page tickets, paper-out, disconnect and an interrupted claim/print/acknowledgement. Confirm every failed case needs operator review before a copy.
4. Reconcile payment exports, cash change, reversals, sale and inventory records with an accountant. Verify money collected outside the application is handled correctly when stock or posting fails.
5. Complete the separate fiscal integration and producer requirements before claiming this is a full legal business suite.

Still required for the broader requested hospitality product: authenticated deployment and physical device acceptance; finished fiscal invoice/IVA/payment integration; terminal capture/refund reconciliation; cash shifts/drawer reconciliation; discounts, tips and service charge policy; modifiers/course firing and richer configurable preparation stations; accessible/mobile visual acceptance; full offline recovery if offered. These are not silently represented as implemented by the available screens.
