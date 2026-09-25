/* Operational exports only. No historical VAT or fiscal identities are inferred. */
(function (root) {
  "use strict";
  function day(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Choose valid dates.");
    const date = new Date(value + "T00:00:00Z");
    if (!Number.isFinite(+date) || date.toISOString().slice(0, 10) !== value) throw new Error("Choose valid dates.");
    return date;
  }
  function midnight(value, timezone) {
    const target = +day(value);
    const formatter = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
    let instant = target;
    for (let i = 0; i < 4; i++) {
      const parts = Object.fromEntries(formatter.formatToParts(instant).map(p => [p.type, p.value]));
      const represented = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
      const correction = target - represented;
      if (!correction) return new Date(instant).toISOString();
      instant += correction;
    }
    throw new Error("This timezone has an unsupported midnight transition.");
  }
  function period(from, through, timezone) {
    const start = day(from), end = day(through);
    if (start > end) throw new Error("The end date must be on or after the start date.");
    end.setUTCDate(end.getUTCDate() + 1);
    return { from: midnight(from, timezone), until: midnight(end.toISOString().slice(0, 10), timezone) };
  }
  async function allRows(client, table, columns, workspace, filters = [], maxRows = 100000) {
    const rows = [];
    let cursor = null;
    while (true) {
      let query = client.from(table).select(columns).eq("workspace_id", workspace).order("id").limit(500);
      for (const [operator, column, value] of filters) query = query[operator](column, value);
      if (cursor) query = query.gt("id", cursor);
      const { data, error } = await query;
      if (error) throw new Error(`${table}: ${error.message || "Export query failed"}`);
      if (!Array.isArray(data)) throw new Error(`${table}: Invalid export response`);
      if (!data.length) return rows;
      if (data.some(row => !row.id || (cursor && row.id <= cursor))) throw new Error("Export pagination did not advance.");
      rows.push(...data);
      if (rows.length > maxRows) throw new Error("Export exceeds 100,000 rows per table. Choose a shorter period or request a server export.");
      cursor = data[data.length - 1].id;
      // Do not stop on a short page: the server may impose a smaller row cap.
    }
  }
  async function collect(client, options) {
    const { workspace, from, through, timezone, mode } = options;
    if (!workspace || !["pos", "inventory"].includes(mode)) throw new Error("Invalid export scope.");
    const bounds = period(from, through, timezone);
    const cutoff = new Date().toISOString();
    const dateFilters = column => [["gte", column, bounds.from], ["lt", column, bounds.until], ["lte", "created_at", cutoff]];
    const data = { ...options, cutoff, bounds, sales: [], lines: [], items: [], movements: [], locations: [], operations: [], valueEvents: [], valuation: [] };
    if (mode === "pos") {
      data.sales = await allRows(client, "crm_pos_sales", "id,workspace_id,provider,external_id,status,total_cents,currency,sold_at,created_at,created_by,employee_profile_id,tip_cents,tipped_profile_id", workspace, dateFilters("sold_at"));
      // Fetch lines by parent IDs so old transactions do not bloat a short export.
      for (let i = 0; i < data.sales.length; i += 100) {
        data.lines.push(...await allRows(client, "crm_pos_sale_lines", "id,sale_id,workspace_id,item_id,quantity,unit_price_cents,created_at", workspace, [["in", "sale_id", data.sales.slice(i, i + 100).map(s => s.id)], ["lte", "created_at", cutoff]]));
        if (data.lines.length > 100000) throw new Error("Too many sale lines. Choose a shorter period.");
      }
    } else {
      data.items = await allRows(client, "crm_inventory_items", "id,workspace_id,sku,name,unit,on_hand,category,cost_cents,sale_price_cents,active,reorder_point,updated_at", workspace);
      data.movements = await allRows(client, "crm_inventory_movements", "id,workspace_id,item_id,quantity_delta,movement_type,source_type,source_id,notes,occurred_at,created_at,created_by,employee_profile_id,location_id,operation_id,receipt_unit_cost_cents,movement_value_cents", workspace, dateFilters("occurred_at"));
      data.locations = await allRows(client, "crm_inventory_locations", "id,workspace_id,code,name,is_default,active", workspace);
      const recordedFilters = [["gte", "recorded_at", bounds.from], ["lt", "recorded_at", bounds.until], ["lte", "recorded_at", cutoff]];
      data.operations = await allRows(client, "crm_inventory_operations", "id,workspace_id,request_key,operation_type,request,reason,supplier_name,reference,currency,actor_id,approved_by,recorded_at", workspace, recordedFilters);
      data.valueEvents = await allRows(client, "crm_inventory_value_events", "id,workspace_id,item_id,location_id,movement_id,operation_id,event_type,quantity_delta,quantity_after,unit_cost_cents,value_delta_cents,carrying_value_cents,currency,sku,item_name,unit,actor_id,recorded_at", workspace, recordedFilters);
      // End-of-period is exclusive, to PostgreSQL's microsecond precision.
      data.valuationAt = bounds.until <= cutoff ? new Date(Date.parse(bounds.until) - 1).toISOString().replace(/(\.\d{3})Z$/, "$1999Z") : cutoff;
      data.valuation = await valuationRows(client, workspace, data.valuationAt);
    }
    return data;
  }
  async function valuationRows(client, workspace, at) {
    if (!client?.rpc) throw new Error("Historical valuation requires the inventory operations database migration.");
    const rows = [];
    while (true) {
      const { data, error } = await client.rpc("crm_inventory_valuation", { p_workspace: workspace, p_at: at })
        .order("item_id").order("location_id", { nullsFirst: true }).range(rows.length, rows.length + 499);
      if (error) throw new Error(`Historical valuation: ${error.message || "query failed"}`);
      if (!Array.isArray(data)) throw new Error("Historical valuation returned invalid data.");
      if (!data.length) return rows;
      rows.push(...data);
      if (rows.length > 100000) throw new Error("Historical valuation exceeds 100,000 rows. Request a server export.");
    }
  }
  function sheets(data) {
    const output = {};
    output.Readme = [
      ["Field", "Value"], ["Export", "AkiHQ operational data — NOT a fiscal invoice, IVA book or tax return"],
      ["Workspace", data.workspace], ["Mode", data.mode], ["From (inclusive)", data.from], ["Through (inclusive)", data.through],
      ["Business timezone", data.timezone], ["UTC start", data.bounds.from], ["UTC end (exclusive)", data.bounds.until], ["Collection started UTC", data.cutoff],
      ["Consistency", "Live paginated reads, not a transactionally frozen accounting snapshot. Reconcile before use."],
      ["Tax", "Historical taxable base, IVA rate and IVA amount were not recorded. Missing tax is UNKNOWN, not zero."],
      ["Currency", "Sales and inventory value events retain recorded currency. Never add different currencies together."],
      ["Payments", "Tender records do not prove payment settlement. Tips are separate from the stored sale total."],
      ["Inventory", data.mode === "inventory" ? "Recorded stock valuation uses perpetual weighted average by item/location from adoption onward. UNKNOWN means evidence is missing; current catalogue cost never fills it. This is an operational subledger, not general-ledger postings or an audited accounting valuation." : "Inventory quantities are separate operational records."],
      ["Stock valuation cutoff", data.valuationAt || "Not included"],
      ["Receiving costs", "Recorded unit costs exclude recoverable IVA. Supplier names/references are receiving evidence, not a received-invoice IVA book or proof of tax deductibility."],
      ["Stock approvals", "Counts and waste require a manager; the approving manager may be the recording actor. No separate two-person approval is claimed."],
      ["Precision", "Money columns use cents. Quantities can have three decimal places. Reconciliation rounds each line to whole cents."],
      ["Identifiers", "UUIDs and external references are not legally sequenced invoice numbers."],
      ["Row counts", `Sales ${data.sales.length}; lines ${data.lines.length}; items ${data.items.length}; movements ${data.movements.length}; operations ${(data.operations || []).length}; value events ${(data.valueEvents || []).length}; valuation rows ${(data.valuation || []).length}`]
    ];
    const table = (name, headers, rows) => { output[name] = [headers, ...rows]; };
    if (data.mode === "pos") {
      table("Sales", ["Sale ID", "External reference", "Status", "Sold at UTC", "Currency", "Recorded total cents", "Tip cents (separate)", "Tender", "Operator profile ID", "Created by", "Tax data"], data.sales.map(s => [s.id, s.external_id, s.status, s.sold_at, s.currency, s.total_cents, s.tip_cents, s.provider, s.employee_profile_id, s.created_by, "NOT RECORDED"]));
      table("Sale lines", ["Line ID", "Sale ID", "Item ID", "Quantity", "Unit price cents", "Rounded line cents"], data.lines.map(l => [l.id, l.sale_id, l.item_id, Number(l.quantity), l.unit_price_cents, roundedLine(l)]));
      const lines = new Map();
      for (const l of data.lines) { const list = lines.get(l.sale_id) || []; list.push(l); lines.set(l.sale_id, list); }
      table("Reconciliation", ["Sale ID", "Recorded cents", "Calculated line cents", "Difference cents", "Result"], data.sales.map(s => {
        const items = lines.get(s.id) || [];
        const sum = items.reduce((n, l) => n + roundedLine(l), 0);
        const difference = Number(s.total_cents) - sum;
        return [s.id, s.total_cents, sum, difference, !items.length ? "MISSING LINES" : difference ? "REVIEW MISMATCH" : "MATCH — TAX UNVERIFIED"];
      }));
      const grouped = new Map();
      for (const s of data.sales) {
        const key = JSON.stringify([s.currency, s.provider, s.status]);
        const row = grouped.get(key) || [s.currency, s.provider, s.status, 0, 0, 0];
        row[3]++; row[4] += Number(s.total_cents); row[5] += Number(s.tip_cents || 0); grouped.set(key, row);
      }
      table("Tender totals", ["Currency", "Tender", "Status", "Sale count", "Recorded total cents", "Tip cents (separate)"], [...grouped.values()]);
    } else {
      const exact = value => value === null || value === undefined ? "UNKNOWN" : String(value);
      table("Current inventory", ["Item ID", "SKU (current)", "Name (current)", "Unit", "Quantity now", "Catalogue unit cost cents (unverified)", "Current sale price cents", "Active", "Category", "Updated UTC"], data.items.map(i => [i.id, i.sku, i.name, i.unit, Number(i.on_hand), i.cost_cents, i.sale_price_cents, i.active, i.category, i.updated_at]));
      table("Stock movements", ["Movement ID", "Item ID", "Occurred UTC", "Recorded UTC", "Quantity delta", "Type", "Source type", "Source ID", "Operator", "Created by", "Notes", "Location ID", "Operation ID", "Receipt unit cost cents (exact)", "Stock value delta cents (exact)"], data.movements.map(m => [m.id, m.item_id, m.occurred_at, m.created_at, Number(m.quantity_delta), m.movement_type, m.source_type, m.source_id, m.employee_profile_id, m.created_by, m.notes, m.location_id, m.operation_id, exact(m.receipt_unit_cost_cents), exact(m.movement_value_cents)]));
      table("Locations", ["Location ID", "Code", "Name", "Default PoS location", "Active"], (data.locations || []).map(l => [l.id,l.code,l.name,l.is_default,l.active]));
      table("Stock operations", ["Operation ID", "Type", "Recorded UTC", "Supplier", "Delivery or invoice reference", "Currency", "Reason", "Actor", "Approver", "Request key"], (data.operations || []).map(o => [o.id,o.operation_type,o.recorded_at,o.supplier_name,o.reference,o.currency,o.reason,o.actor_id,o.approved_by,o.request_key]));
      table("Operation lines", ["Operation ID", "Item ID", "Quantity (count = absolute)", "Expected quantity before count", "Receipt unit cost cents (exact)", "Location ID", "From location ID", "To location ID"], (data.operations || []).flatMap(o => (o.request?.lines || []).map(l => [o.id,l.item_id,Number(l.quantity),l.expected_quantity == null ? "" : Number(l.expected_quantity),o.operation_type === "receive" ? exact(l.unit_cost_cents) : "",o.request.location_id,o.request.from_location_id,o.request.to_location_id])));
      table("Stock value ledger", ["Event ID", "Recorded UTC", "Item ID", "SKU at event", "Name at event", "Unit at event", "Location ID", "Movement ID", "Operation ID", "Type", "Quantity delta", "Quantity after", "Receipt unit cost cents (exact)", "Value delta cents (exact)", "Carrying value cents (exact)", "Currency", "Actor"], (data.valueEvents || []).map(e => [String(e.id),e.recorded_at,e.item_id,e.sku,e.item_name,e.unit,e.location_id,e.movement_id,e.operation_id,e.event_type,Number(e.quantity_delta),Number(e.quantity_after),exact(e.unit_cost_cents),exact(e.value_delta_cents),exact(e.carrying_value_cents),e.currency,e.actor_id]));
      table("Recorded stock valuation", ["Item ID", "SKU at latest event", "Name at latest event", "Unit at latest event", "Location ID", "Quantity at cutoff", "Carrying value cents (exact)", "Currency", "Evidence status", "Latest event UTC", "Valuation cutoff UTC"], (data.valuation || []).map(v => [v.item_id,v.sku,v.item_name,v.unit,v.location_id,v.quantity == null ? "UNKNOWN" : Number(v.quantity),exact(v.carrying_value_cents),v.currency,v.cost_status,v.recorded_at,data.valuationAt]));
    }
    return output;
  }
  function roundedLine(line) {
    const quantity = Number(line.quantity), cents = Number(line.unit_price_cents);
    const milli = Math.round(quantity * 1000);
    if (!Number.isFinite(quantity) || quantity <= 0 || Math.abs(quantity * 1000 - milli) > 0.00001 || !Number.isSafeInteger(milli) || !Number.isSafeInteger(cents) || cents < 0) throw new Error("Invalid sale line precision in source data.");
    const amount = (BigInt(milli) * BigInt(cents) + 500n) / 1000n;
    if (amount > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Sale line exceeds safe export precision.");
    return Number(amount);
  }
  function workbook(XLSX, data) {
    const book = XLSX.utils.book_new();
    for (const [name, rows] of Object.entries(sheets(data))) {
      // aoa_to_sheet preserves user strings as strings, never executable formulas.
      const sheet = XLSX.utils.aoa_to_sheet(rows);
      sheet["!cols"] = rows[0].map(() => ({ wch: 24 }));
      if (name !== "Readme") sheet["!autofilter"] = { ref: sheet["!ref"] };
      XLSX.utils.book_append_sheet(book, sheet, name);
    }
    return book;
  }
  const api = { period, allRows, collect, sheets, workbook, roundedLine, valuationRows };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.AkiCommerceExport = api;
})(typeof window !== "undefined" ? window : globalThis);
