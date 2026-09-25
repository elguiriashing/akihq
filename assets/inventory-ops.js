/* Operational stock control. Cost is never inferred from a current catalogue price. */
(function (root) {
  "use strict";
  const types = ["receive", "transfer", "count", "waste"];
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  function decimal(value, places, label, max = 1000000000) {
    if (value === null || value === undefined || typeof value === "boolean" || String(value).trim() === "") throw new Error(`${label} is required.`);
    const text = String(value).trim();
    if (!new RegExp(`^\\d+(?:\\.\\d{1,${places}})?$`).test(text)) throw new Error(`${label} must use no more than ${places} decimal places.`);
    const number = Number(text);
    if (!Number.isFinite(number) || number < 0 || number > max) throw new Error(`${label} is out of range.`);
    return number;
  }
  function identity(value, label, optional = false) {
    if (optional && (value === null || value === undefined || value === "")) return null;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value))) throw new Error(`${label} is invalid.`);
    return String(value).toLowerCase();
  }
  function requiredText(value, label, min, max) {
    const result = String(value ?? "").trim();
    if (result.length < min || result.length > max) throw new Error(`${label} must contain ${min}–${max} characters.`);
    return result;
  }
  function exactCost(value) {
    decimal(value, 6, "Receipt unit cost in cents", 1000000000000);
    return String(value).trim().replace(/^0+(?=\d)/, "").replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
  }
  function validateOperation(input) {
    if (!input || !types.includes(input.type)) throw new Error("Choose a supported stock operation.");
    const result = { type: input.type, reason: requiredText(input.reason, "Reason", 3, 1000) };
    if (input.type === "transfer") {
      result.from_location_id = identity(input.from_location_id, "Source location", true);
      result.to_location_id = identity(input.to_location_id, "Destination location");
      if (result.from_location_id === result.to_location_id) throw new Error("Choose different source and destination locations.");
    } else result.location_id = identity(input.location_id, "Location", true);
    if (input.type === "receive") {
      result.supplier_name = requiredText(input.supplier_name, "Supplier", 1, 200);
      result.reference = requiredText(input.reference, "Delivery or invoice reference", 1, 160);
    }
    if (!Array.isArray(input.lines) || input.lines.length < 1 || input.lines.length > 100) throw new Error("Include 1–100 stock lines.");
    const ids = new Set();
    result.lines = input.lines.map(line => {
      const item_id = identity(line?.item_id, "Inventory item");
      if (ids.has(item_id)) throw new Error("Combine duplicate item lines.");
      ids.add(item_id);
      const quantity = decimal(line.quantity, 3, input.type === "count" ? "Counted quantity" : "Quantity");
      if (input.type !== "count" && quantity <= 0) throw new Error("Quantity must be greater than zero.");
      const resultLine = { item_id, quantity };
      if (input.type === "count") resultLine.expected_quantity = decimal(line.expected_quantity, 3, "Previously observed balance");
      if (input.type === "receive") resultLine.unit_cost_cents = exactCost(line.unit_cost_cents);
      return resultLine;
    }).sort((left, right) => left.item_id.localeCompare(right.item_id));
    return result;
  }
  async function rpc(client, name, args) {
    if (!client?.rpc) throw new Error("Connect to your workspace to record stock operations.");
    const { data, error } = await client.rpc(name, args);
    if (error) throw new Error(error.message || "Stock operation failed.");
    if (data === null || data === undefined) throw new Error("The server did not confirm this stock operation. Retry with the same request key.");
    return data;
  }
  async function submitOperation(client, workspace, key, input) {
    if (!workspace) throw new Error("Workspace required.");
    if (typeof key !== "string" || key.length < 8 || key.length > 160) throw new Error("A stable request key is required. Keep it when retrying.");
    return rpc(client, "crm_inventory_operation", { p_workspace: workspace, p_key: key, p_operation: validateOperation(input) });
  }
  async function reconcileOperation(client, workspace, key, input) {
    if (!workspace || typeof key !== "string" || key.length < 8 || key.length > 160) throw new Error("Original workspace and request key required.");
    const result = await rpc(client, "crm_inventory_reconcile_operation", { p_workspace: workspace, p_key: key, p_operation: validateOperation(input) });
    if (!result || result.request_key !== key || !["committed", "cancelled"].includes(result.status) || (result.status === "committed" && !result.operation_id)) throw new Error("Server reconciliation was not confirmed; keep the pending operation.");
    return result;
  }
  function pendingStorageKey(user, workspace) {
    if (!user || !workspace) throw new Error("User and workspace are required for stock recovery.");
    return `akihq.inventory.pending.v1:${encodeURIComponent(user)}:${encodeURIComponent(workspace)}`;
  }
  function readPending(storage, user, workspace) {
    const key = pendingStorageKey(user, workspace);
    let raw;
    try { raw = storage.getItem(key); } catch (_) { throw new Error("Stock recovery storage is unavailable. Do not submit a new operation until it works."); }
    if (raw === null || raw === undefined) return null;
    let saved;
    try {
      saved = JSON.parse(raw);
      if (saved.version !== 1 || saved.user !== user || saved.workspace !== workspace || typeof saved.key !== "string" || saved.key.length < 8 || saved.key.length > 160 || !Number.isFinite(Date.parse(saved.createdAt))) throw new Error("Invalid pending stock record");
      saved.operation = validateOperation(saved.operation);
    } catch (_) { throw new Error("Saved stock recovery record is damaged. Reconcile its request with an administrator before recording another operation."); }
    return saved;
  }
  function stagePending(storage, user, workspace, key, operation) {
    const clean = validateOperation(operation);
    if (typeof key !== "string" || key.length < 8 || key.length > 160) throw new Error("A stable stock request key is required.");
    const existing = readPending(storage, user, workspace);
    if (existing) {
      if (existing.key !== key || JSON.stringify(existing.operation) !== JSON.stringify(clean)) throw new Error("Recover the pending stock operation before recording a different one.");
      return existing;
    }
    const saved = { version: 1, user, workspace, key, operation: clean, createdAt: new Date().toISOString() };
    try {
      storage.setItem(pendingStorageKey(user, workspace), JSON.stringify(saved));
      if (storage.getItem(pendingStorageKey(user, workspace)) !== JSON.stringify(saved)) throw new Error("Storage did not confirm write");
    } catch (_) { throw new Error("Could not save stock recovery state. The operation has not been submitted."); }
    return saved;
  }
  function resolvePending(storage, user, workspace, key) {
    const existing = readPending(storage, user, workspace);
    if (!existing) return;
    if (existing.key !== key) throw new Error("The server result does not match the pending stock operation.");
    try { storage.removeItem(pendingStorageKey(user, workspace)); } catch (_) { throw new Error("Stock was confirmed but recovery state could not be cleared. Retry the same operation to reconcile it."); }
  }
  async function createLocation(client, workspace, name, code) {
    const cleanCode = String(code ?? "").trim().toUpperCase();
    if (!/^[A-Z0-9_-]{1,32}$/.test(cleanCode) || cleanCode === "MAIN") throw new Error("Choose a unique location code; MAIN is reserved.");
    return rpc(client, "crm_inventory_location_create", { p_workspace: workspace, p_name: requiredText(name, "Location name", 1, 120), p_code: cleanCode });
  }
  async function rows(client, table, workspace, select, order, filters = [], limit = 50000) {
    if (!workspace || !client?.from) throw new Error("Connected workspace required.");
    const result = [];
    let cursor = null;
    // The server may cap results below the requested page size. Continue until empty.
    while (true) {
      let query = client.from(table).select(select).eq("workspace_id", workspace).order(order).limit(500);
      for (const [column, value] of filters) query = query.eq(column, value);
      if (cursor !== null) query = query.gt(order, cursor);
      const { data, error } = await query;
      if (error) throw new Error(error.message || "Stock records could not be loaded.");
      if (!Array.isArray(data)) throw new Error("Invalid stock records response.");
      if (!data.length) return result;
      if (data.some(row => row[order] === null || row[order] === undefined) || (cursor !== null && data[data.length - 1][order] <= cursor)) throw new Error("Stock pagination did not advance.");
      result.push(...data);
      if (result.length > limit) throw new Error("Too many stock records; narrow the export instead of downloading an incomplete result.");
      cursor = data[data.length - 1][order];
    }
  }
  function loadLocations(client, workspace) {
    return rows(client, "crm_inventory_locations", workspace, "id,workspace_id,code,name,is_default,active", "id");
  }
  async function loadBalances(client, workspace) {
    const result = [];
    const locations = await loadLocations(client, workspace);
    for (const location of locations) {
      result.push(...await rows(client, "crm_inventory_location_balances", workspace,
        "workspace_id,item_id,location_id,quantity,carrying_value_cents,updated_at", "item_id", [["location_id", location.id]]));
    }
    return result;
  }
  async function loadValuation(client, workspace, at = new Date().toISOString()) {
    const instant = new Date(at);
    if (!Number.isFinite(+instant) || instant > new Date()) throw new Error("Choose a valid historical valuation date.");
    if (!workspace || !client?.rpc) throw new Error("Connected workspace required.");
    const result = [];
    while (true) {
      const { data, error } = await client.rpc("crm_inventory_valuation", { p_workspace: workspace, p_at: instant.toISOString() })
        .order("item_id").order("location_id", { nullsFirst: true }).range(result.length, result.length + 499);
      if (error) throw new Error(error.message || "Stock valuation could not be loaded.");
      if (!Array.isArray(data)) throw new Error("Invalid stock valuation response.");
      if (!data.length) return result;
      result.push(...data);
      if (result.length > 50000) throw new Error("Stock valuation exceeds 50,000 rows; request a narrower server export.");
    }
  }
  function summarizeValuation(records) {
    const currencies = new Map();
    let unknown = 0;
    for (const record of records) {
      if (record.carrying_value_cents === null || record.carrying_value_cents === undefined || record.cost_status !== "recorded_weighted_average") { unknown++; continue; }
      const value = Number(record.carrying_value_cents);
      if (!Number.isFinite(value)) throw new Error("Invalid recorded stock value.");
      const currency = record.currency;
      currencies.set(currency, (currencies.get(currency) || 0) + value);
    }
    return { complete: unknown === 0, unknownRows: unknown, knownValueCentsByCurrency: Object.fromEntries(currencies) };
  }
  function locationOptions(locations, selected, includeDefault = true) {
    return `${includeDefault ? '<option value="">Main stock / PoS</option>' : '<option value="">Choose location</option>'}${locations.filter(location => location.active && (!includeDefault || !location.is_default)).map(location => `<option value="${escapeHtml(location.id)}" ${location.id === selected ? "selected" : ""}>${escapeHtml(location.name)} (${escapeHtml(location.code)})</option>`).join("")}`;
  }
  function renderPanel({ locations = [], summary = null } = {}) {
    return `<section class="panel"><div class="panel-header"><div><h2>Stock operations</h2><p>Receive with supplier evidence, transfer between locations, and record approved counts or waste.</p></div></div><div style="padding:16px;display:flex;gap:8px;flex-wrap:wrap"><button class="action-btn primary" data-action="inventory-operation" data-type="receive">Receive stock</button><button class="action-btn" data-action="inventory-operation" data-type="transfer">Transfer</button><button class="action-btn" data-action="inventory-operation" data-type="count">Count stock</button><button class="action-btn" data-action="inventory-operation" data-type="waste">Record waste</button><button class="action-btn" data-action="inventory-location">Add location</button><button class="action-btn" data-action="inventory-valuation">Stock valuation</button></div><p style="padding:0 16px 16px">${locations.length ? `${locations.length} recorded location${locations.length === 1 ? "" : "s"}. ` : "Stock starts in Main stock / PoS. "}PoS deducts from Main stock / PoS. ${summary && !summary.complete ? `${summary.unknownRows} stock value entries have unknown historical costs. ` : ""}Receiving costs exclude recoverable IVA. Counts and waste need a manager.</p></section>`;
  }
  function renderForm({ type = "receive", products = [], locations = [], balances = [], itemId = "", expectedQuantity = "", key = "" } = {}) {
    if (!types.includes(type)) throw new Error("Unsupported stock form.");
    const title = { receive: "Receive stock", transfer: "Transfer stock", count: "Count stock", waste: "Record waste" }[type];
    const items = products.filter(product => product.inventoryItemId || product.item_id || product.id).map(product => {
      const id = product.inventoryItemId || product.item_id || product.id;
      return `<option value="${escapeHtml(id)}" ${id === itemId ? "selected" : ""}>${escapeHtml(product.name || product.item_name)} · ${escapeHtml(product.unit || "unit")}</option>`;
    }).join("");
    const defaultId = locations.find(location => location.is_default)?.id;
    const knownProducts = new Map(products.map(product => [product.inventoryItemId || product.item_id || product.id, product]));
    const knownLocations = new Map(locations.map(location => [location.id, location]));
    const balanceRows = balances.filter(balance => !itemId || balance.item_id === itemId);
    if (type === "count" && expectedQuantity === "" && itemId) {
      const existing = balances.find(balance => balance.item_id === itemId && balance.location_id === defaultId);
      // Only wholly untracked legacy stock is entirely assigned to Main stock.
      expectedQuantity = existing?.quantity ?? (balances.some(balance => balance.item_id === itemId) ? 0 : (knownProducts.get(itemId)?.stock ?? ""));
    }
    const balanceTable = balanceRows.length ? `<details><summary>Recorded stock by location (${balanceRows.length})</summary><div class="table-scroll"><table class="data-table"><thead><tr><th>Item</th><th>Location</th><th>Quantity</th></tr></thead><tbody>${balanceRows.slice(0, 100).map(balance => `<tr><td>${escapeHtml(knownProducts.get(balance.item_id)?.name || balance.item_id)}</td><td>${escapeHtml(knownLocations.get(balance.location_id)?.name || balance.location_id)}</td><td>${escapeHtml(balance.quantity)}</td></tr>`).join("")}</tbody></table></div>${balanceRows.length > 100 ? '<p>Showing 100 rows. Export stock records for the complete list.</p>' : ""}</details>` : '<p>No location ledger yet. Existing stock is assigned to Main stock / PoS when the first operation is recorded.</p>';
    return `<form data-form="inventory-operation" data-type="${type}" data-request-key="${escapeHtml(key)}"><div class="modal-body"><h2>${title}</h2>${balanceTable}<div class="form-grid"><label>Item<select name="item_id" required><option value="">Choose item</option>${items}</select></label><label>${type === "transfer" ? "From location" : "Location"}<select name="${type === "transfer" ? "from_location_id" : "location_id"}">${locationOptions(locations, null)}</select></label>${type === "transfer" ? `<label>To location<select name="to_location_id" required>${locationOptions(locations, null, false)}</select></label>` : ""}<label>${type === "count" ? "Actual counted quantity" : "Quantity"}<input name="quantity" type="number" min="${type === "count" ? "0" : "0.001"}" max="1000000000" step="0.001" required></label>${type === "count" ? `<label>Expected balance before count<input name="expected_quantity" type="number" min="0" step="0.001" value="${escapeHtml(expectedQuantity)}" required readonly><small>Captured for the selected location. A changed balance blocks this count; refresh and recount.</small></label>` : ""}${type === "receive" ? '<label>Supplier<input name="supplier_name" maxlength="200" required></label><label>Delivery / invoice reference<input name="reference" maxlength="160" required></label><label>Unit cost (currency units, excluding recoverable IVA)<input name="unit_cost" type="number" min="0" step="0.00000001" required></label>' : ""}<label>Reason<textarea name="reason" minlength="3" maxlength="1000" required></textarea></label></div><p>${type === "count" || type === "waste" ? "A manager posts and approves this permanent record. " : ""}Recorded stock evidence cannot be edited or deleted; corrections require a new operation.</p></div><footer class="modal-foot"><button type="button" class="action-btn" data-action="close-modal">Cancel</button><button type="submit" class="action-btn primary">Record operation</button></footer></form>`;
  }
  function fromForm(values, type) {
    const get = name => typeof values.get === "function" ? values.get(name) : values[name];
    const line = { item_id: get("item_id"), quantity: get("quantity") };
    if (type === "count") line.expected_quantity = get("expected_quantity");
    if (type === "receive") {
      const cost = String(get("unit_cost") ?? "").trim();
      decimal(cost, 8, "Unit cost", 10000000000);
      // 8 decimals in currency units == 6 decimals in cents. Never pass the
      // conversion through binary floating point, including high unit costs.
      const [whole, fraction = ""] = cost.split(".");
      const scaled = BigInt(whole) * 100000000n + BigInt(fraction.padEnd(8, "0"));
      line.unit_cost_cents = `${scaled / 1000000n}.${String(scaled % 1000000n).padStart(6, "0")}`;
    }
    return validateOperation({ type, reason: get("reason"), supplier_name: get("supplier_name"), reference: get("reference"), location_id: get("location_id"), from_location_id: get("from_location_id"), to_location_id: get("to_location_id"), lines: [line] });
  }
  const api = { validateOperation, submitOperation, reconcileOperation, stagePending, readPending, resolvePending, createLocation, loadLocations, loadBalances, loadValuation, summarizeValuation, renderPanel, renderForm, fromForm, decimal };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.AkiHQInventoryOps = api;
})(typeof window !== "undefined" ? window : globalThis);
