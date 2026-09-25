(function (root) {
  "use strict";
  function key(user, workspace) {
    if (!user || !workspace) throw new Error("Sign in and select a workspace.");
    return `akihq:pending-sale:v1:${user}:${workspace}`;
  }
  function read(storage, user, workspace) {
    const value = storage.getItem(key(user, workspace));
    if (!value) return null;
    let request;
    try { request = JSON.parse(value); } catch { throw new Error("The saved pending sale is damaged. Ask an administrator to reconcile it before recording another sale."); }
    try { validate(request, user, workspace); }
    catch { throw new Error("The pending sale cannot be verified. Reconcile it before recording another sale."); }
    return request;
  }
  function stage(storage, user, workspace, request) {
    const previous = read(storage, user, workspace);
    if (previous) return previous;
    validate(request, user, workspace);
    const serialized = JSON.stringify(request);
    storage.setItem(key(user, workspace), serialized);
    const saved = read(storage, user, workspace);
    if (!saved || JSON.stringify(saved) !== serialized) throw new Error("The pending sale could not be saved reliably. Reconcile any pending sale before continuing.");
    return saved;
  }
  function resolve(storage, user, workspace, reference) {
    const pending = read(storage, user, workspace);
    if (pending?.p_external_id !== reference) throw new Error("The pending sale changed. Refresh before continuing.");
    storage.removeItem(key(user, workspace));
  }
  function total(lines) {
    if (!Array.isArray(lines) || lines.length < 1 || lines.length > 500) throw new Error("Provide between 1 and 500 sale lines.");
    const grouped = new Map();
    for (const line of lines) {
      if (!line || typeof line.item_id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(line.item_id)) throw new Error("Each sale line needs a valid inventory item.");
      const quantity = line.quantity, price = line.unit_price_cents;
      if (typeof quantity !== "number" || !Number.isFinite(quantity) || quantity <= 0 || quantity > 999999999.999 || !/^\d+(\.\d{1,3})?$/.test(String(quantity)) || typeof price !== "number" || !Number.isSafeInteger(price) || price < 0 || price > 2147483647) throw new Error("Use positive quantities with up to three decimals and a valid price.");
      // Parsing the JSON number's decimal representation avoids binary-float
      // errors (e.g. 1.001 * 1000) and matches PostgreSQL's decimal quantity.
      const [whole, fraction = ""] = String(quantity).split(".");
      const milli = BigInt(whole) * 1000n + BigInt(fraction.padEnd(3, "0"));
      const itemId = line.item_id.toLowerCase();
      const item = grouped.get(itemId) || { quantity: 0n, price };
      if (item.price !== price) throw new Error("One item has conflicting prices.");
      item.quantity += milli;
      if (item.quantity > 999999999999n) throw new Error("The combined item quantity exceeds the supported amount.");
      grouped.set(itemId, item);
    }
    const amount = [...grouped.values()].reduce((sum, item) => sum + (item.quantity * BigInt(item.price) + 500n) / 1000n, 0n);
    if (amount > 2147483647n) throw new Error("This sale exceeds the supported amount.");
    return Number(amount);
  }
  function validate(request, user, workspace) {
    if (!request || typeof request !== "object" || Array.isArray(request) || request.p_workspace !== workspace || request.p_employee_profile !== user) throw new Error("Invalid pending sale scope.");
    if (typeof request.p_external_id !== "string" || request.p_external_id.trim().length < 1 || request.p_external_id.trim().length > 200 || typeof request.p_provider !== "string" || request.p_provider.trim().length < 1 || request.p_provider.trim().length > 80 || typeof request.p_currency !== "string" || !/^[A-Z]{3}$/.test(request.p_currency) || !Number.isSafeInteger(request.p_total_cents) || request.p_total_cents < 0 || request.p_total_cents !== total(request.p_lines)) throw new Error("Invalid pending sale amount or reference.");
  }
  const api = { read, stage, resolve, total };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.AkiCheckoutSession = api;
})(typeof window !== "undefined" ? window : globalThis);
