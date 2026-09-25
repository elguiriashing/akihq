(function (root) {
  "use strict";
  const escape = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const options = (values, selected) => values.map(([value, label]) => `<option value="${escape(value)}"${String(value) === String(selected) ? " selected" : ""}>${escape(label)}</option>`).join("");
  const field = (label, name, value = "", extra = "", type = "text") => `<div class="form-field"><label>${escape(label)}<input name="${escape(name)}" type="${type}" value="${escape(value)}" ${extra}></label></div>`;
  const select = (label, name, values, selected) => `<div class="form-field"><label>${escape(label)}<select name="${escape(name)}">${options(values, selected)}</select></label></div>`;
  const note = (label, name, min = 0) => `<div class="form-field full"><label>${escape(label)}<textarea name="${name}" ${min ? `required minlength="${min}"` : ""} maxlength="4000"></textarea></label></div>`;
  const button = label => `<div class="form-field full"><button type="submit" class="action-btn primary">${escape(label)}</button></div>`;
  const form = (id, body) => `<form id="${id}" data-form="${id}" data-suite-form="${id}" class="form-grid">${body}</form>`;
  const section = (title, copy, body) => `<section class="panel settings-section"><h2>${escape(title)}</h2><p>${escape(copy)}</p>${body}</section>`;
  const details = (title, body) => `<details class="detail-block"><summary>${escape(title)}</summary>${body}</details>`;
  const errorBlock = message => `<p role="status" class="text-warning">${escape(message)}</p>`;
  const dateOnly = value => String(value || "").slice(0, 10);
  let spreadsheetPromise;
  async function spreadsheet() {
    if (root.XLSX) return root.XLSX;
    if (!spreadsheetPromise) spreadsheetPromise = new Promise((resolve, reject) => {
      const script = root.document.createElement("script");
      script.src = "assets/vendor/xlsx-0.20.3.min.js";
      script.onload = () => root.XLSX ? resolve(root.XLSX) : reject(new Error("Spreadsheet library could not be loaded."));
      script.onerror = () => reject(new Error("Spreadsheet library could not be loaded. Choose JSON or try again."));
      root.document.head.appendChild(script);
    }).catch(error => { spreadsheetPromise = null; throw error; });
    return spreadsheetPromise;
  }

  function create(ctx) {
    if (!ctx?.workspace?.id) throw new Error("A workspace is required.");
    const workspaceId = String(ctx.workspace.id);
    let fiscal = null, privacy = null, fiscalError = "", privacyError = "", loaded = false, busy = false, disposed = false;
    const assertActive = () => { if (disposed || String(ctx.workspace.id) !== workspaceId) throw new Error("Workspace changed. Reload this panel before continuing."); };
    async function rpc(name, args = {}) {
      assertActive();
      if (!ctx.client?.rpc) throw new Error("Database connection is unavailable.");
      const response = await ctx.client.rpc(name, { ...args, p_workspace: workspaceId });
      assertActive();
      if (response.error) throw new Error(response.error.message || "This operation could not be completed.");
      return response.data;
    }
    async function request(path, opts) {
      assertActive();
      if (!ctx.request) throw new Error("Privacy service is unavailable.");
      const data = await ctx.request(path, opts);
      assertActive();
      if (data?.ok === false) throw new Error(data.message || "This privacy operation could not be completed.");
      return data;
    }
    async function load() {
      assertActive();
      const results = await Promise.allSettled([rpc("crm_fiscal_overview"), request("/api/privacy/overview")]);
      assertActive();
      if (results[0].status === "fulfilled" && results[0].value?.access?.read) { fiscal = results[0].value; fiscalError = ""; }
      else { fiscal = null; fiscalError = results[0].status === "rejected" ? results[0].reason.message : "Your role does not have fiscal access."; }
      if (results[1].status === "fulfilled") { privacy = results[1].value; privacyError = ""; }
      else { privacy = null; privacyError = results[1].reason.message; }
      loaded = true;
      return { fiscal: !!fiscal, privacy: !!privacy };
    }

    function fiscalPanel() {
      if (!fiscal) return section("Fiscal setup", "Business identity, IVA configuration and protected records.", errorBlock(fiscalError || "Load the controls to check access and configuration."));
      const p = fiscal.profile || {}, manage = fiscal.access?.manage, canExport = fiscal.access?.export;
      const blockers = ["Invoice issuance and AEAT delivery are not ready for use.", "The producer declaration and release validation are outstanding."];
      if (!p.tax_id) blockers.unshift("The business fiscal identity has not been saved.");
      const heading = `<p><span class="status-pill warning">Fiscal issuance unavailable</span></p><ul>${blockers.map(item => `<li>${escape(item)}</li>`).join("")}</ul><p>Saving setup does not activate invoicing. Supported preparation: EUR, Spanish common territory, general IVA and businesses outside SII.</p>`;
      const profile = manage ? details("Business fiscal identity", form("suite-fiscal-profile",
        field("Legal name", "legal_name", p.legal_name, 'required minlength="2" maxlength="120" autocomplete="organization"') +
        field("Spanish NIF / NIE", "tax_id", p.tax_id, 'required minlength="9" maxlength="9"') +
        field("Fiscal address", "address", p.address, 'required minlength="3" maxlength="250" autocomplete="street-address"') +
        field("Postal code", "postal_code", p.postal_code, 'required pattern="[0-9]{5}" maxlength="5" autocomplete="postal-code"') +
        field("City", "city", p.city, 'required minlength="2" maxlength="120" autocomplete="address-level2"') +
        select("Simplified invoice limit (eligibility must be checked)", "simplified_limit_cents", [[40000, "€400 — ordinary limit"], [300000, "€3,000 — eligible activities only"]], p.simplified_limit_cents || 40000) +
        field("Eligible activity and legal basis for €3,000 limit", "eligible_activity", p.eligible_activity, 'maxlength="1000"') +
        `<div class="form-field full"><label><input type="checkbox" name="scope_confirmed" value="yes" required> I have checked this business is in Spanish common territory, general IVA, EUR and outside SII.</label></div>` + button("Save fiscal identity"))) : `<p>Fiscal identity: ${escape(p.legal_name || "Not configured")} · ${escape(p.tax_id || "")}</p>`;
      const items = (ctx.getProducts?.() || ctx.products || []).filter(item => item.inventoryItemId || item.id).map(item => [item.inventoryItemId || item.id, `${item.name || item.sku || item.id}${item.sku ? ` · ${item.sku}` : ""}`]);
      const assignments = fiscal.tax_assignments || [];
      const tax = manage ? details("Product IVA", `<p>Use the applicable product rate, checked with the accountant. Existing issued records keep their original tax. Zero-rated and exempt transactions are not supported by the initial fiscal adapter.</p>` +
        (items.length ? form("suite-fiscal-tax", select("Product", "item_id", items) + select("IVA rate", "rate_bps", [[2100, "21%"], [1000, "10%"], [400, "4%"]], 2100) + button("Save product IVA")) : "<p>Add an inventory product before assigning IVA.</p>") +
        `<p>${escape(assignments.length)} product tax assignments configured.</p>`) : "";
      const today = new Date().toISOString().slice(0, 10);
      const exportForm = canExport ? details("Fiscal ledger export", `<p>Exports all issued fiscal documents, lines and IVA breakdown in the selected period. This is not an official AEAT book or a tax return. Legacy operational sales remain in the separate PoS export.</p>` + form("suite-fiscal-export",
        field("From (inclusive)", "from", `${today.slice(0, 4)}-01-01`, "required", "date") + field("Through (inclusive)", "through", today, "required", "date") + select("File format", "format", [["xlsx", "Excel workbook"], ["json", "JSON data package"]], "xlsx") + button("Download fiscal ledger"))) : "";
      const lock = manage ? details("Close an accounting period", `<p>Blocks fiscal issue/correction dates up to the selected past date. This closure cannot be undone here; reconcile the period with your accountant first.</p>` + form("suite-fiscal-lock",
        field("Lock through", "through", "", "required", "date") + `<div class="form-field full"><label><input type="checkbox" name="confirm_lock" value="yes" required> I have reviewed the records and want to close this period.</label></div>` + button("Lock period"))) : "";
      return section("Fiscal setup and records", "Configure the business and accountant controls.", heading + profile + tax + exportForm + lock);
    }

    function privacyPanel() {
      if (!privacy) return section("Privacy and communication permissions", "Controller details, permission evidence and rights requests.", errorBlock(privacyError || "Load the controls to check access and configuration."));
      const p = privacy.settings || {}, counts = privacy.counts || {}, requests = privacy.requests || [];
      const settings = details("Controller and retention policy", form("suite-privacy-settings",
        field("Controller legal name", "controller_name", p.controller_name, 'required minlength="2" maxlength="300"') +
        field("Controller address", "controller_address", p.controller_address, 'required minlength="5" maxlength="1000"') +
        field("Privacy contact email", "privacy_email", p.privacy_email, 'required maxlength="320"', "email") +
        field("Published HTTPS privacy policy", "policy_url", p.policy_url, 'required maxlength="1000" pattern="https://.*"', "url") +
        field("Support retention review after (days)", "retention_days", p.retention_days || 365, 'required min="30" max="3650" step="1"', "number") +
        `<p class="form-field full">This creates a review threshold, not automatic deletion. Legal holds, fiscal preservation and data in other modules need separate decisions.</p>` + button("Save privacy settings")));
      const consent = details("Record email permission evidence", `<p>Record an actual permission event. A public email address or imported contact does not establish consent. Withdrawal adds suppression; recording a grant does not remove existing suppression.</p>` + form("suite-privacy-consent",
        field("Recipient email", "email", "", 'required maxlength="320"', "email") + select("Event", "status", [["granted", "Consent granted"], ["withdrawn", "Consent withdrawn"]], "granted") +
        field("Source of this event", "source", "", 'required minlength="3" maxlength="1000"') + field("Privacy / consent notice version", "notice_version", "", 'required maxlength="100"') +
        field("Event occurred at (local time)", "occurred_at", "", "required", "datetime-local") + note("Evidence, purpose and how permission was obtained", "evidence", 10) + button("Record permission event")));
      const newRequest = details("Register a rights request", form("suite-privacy-request", field("Requester email", "email", "", "required", "email") +
        select("Request type", "kind", [["access", "Access"], ["erasure", "Erasure"], ["rectification", "Rectification"], ["restriction", "Restriction"], ["objection", "Objection"], ["portability", "Portability"]], "access") +
        field("Received at (device local time; blank means now)", "received_at", "", "", "datetime-local") +
        note("Request details", "note") + button("Register request")));
      const rows = requests.map(item => `<tr><td>${escape(item.email)}</td><td>${escape(item.kind)}</td><td>${escape(item.status)}</td><td>${escape(dateOnly(item.due_at))}${item.extended ? " · extended" : ""}</td><td>${item.verified_at && ["access", "portability"].includes(item.kind) ? `<button type="button" class="action-btn" data-action="suite-privacy-export" data-id="${escape(item.id)}">Export covered records</button>` : "Verify identity before export"}</td></tr>`).join("");
      const requestsTable = `<p>Latest ${escape(requests.length)} requests (up to 200). Complete a request only after the full response and any actions are finished; this tracker does not erase records.</p><div class="table-wrap"><table><thead><tr><th scope="col">Email</th><th scope="col">Type</th><th scope="col">Status</th><th scope="col">Due date</th><th scope="col">Export</th></tr></thead><tbody>${rows || '<tr><td colspan="5">No rights requests recorded.</td></tr>'}</tbody></table></div>`;
      const actionable = requests.filter(item => ["received", "verified"].includes(item.status));
      const actionForm = actionable.length ? details("Update a rights request", form("suite-privacy-action",
        select("Request", "id", actionable.map(item => [item.id, `${item.email} · ${item.kind} · ${item.status}`])) +
        select("Action", "action", [["verify", "Identity verified"], ["extend", "Extend deadline (justified complexity / volume)"], ["complete", "Response and actions completed"], ["reject", "Reject with documented grounds"]], "verify") +
        note("Evidence, decision and notification details", "note", 10) + button("Record request action"))) : "";
      const summary = `<p>${escape(counts.consent_records || 0)} permission records · ${escape(counts.suppressed || 0)} suppressed recipients · ${escape(counts.overdue || 0)} overdue requests.</p><p>Marketing delivery: ${privacy.marketing_configured ? "Gateway configured; each send still requires verified sender and active permission." : "Not activated; sender and delivery safeguards still require configuration."}</p><p>Subject export covers privacy records and support correspondence only. Review CRM, sales, staff records, files, integrations and backups separately before fulfilling a request.</p><p>${escape(privacy.retention_review?.support_tickets || 0)} support records are due for retention review. No automatic deletion is performed.</p>`;
      return section("Privacy and rights requests", "Manage evidence and review obligations for this workspace.", summary + settings + consent + newRequest + requestsTable + actionForm);
    }

    function render() {
      if (disposed) return "";
      return `<div class="suite-controls" data-workspace="${escape(workspaceId)}" aria-busy="${busy}"><p><button type="button" class="action-btn" data-action="suite-refresh"${busy ? " disabled" : ""}>${loaded ? "Refresh controls" : "Load fiscal and privacy controls"}</button></p>${fiscalPanel()}${privacyPanel()}</div>`;
    }
    async function run(operation, success) {
      if (busy) return;
      assertActive(); busy = true;
      try {
        await operation();
        assertActive();
        if (success) ctx.toast?.("Business controls", success, "success");
        await load();
      } catch (error) { if (!disposed) ctx.toast?.("Business controls", error.message || "The operation failed.", "danger"); }
      finally { busy = false; if (!disposed) ctx.refresh?.(); }
    }
    async function exportLedger(from, through, format) {
      if (!from || !through || from > through) throw new Error("Choose a valid inclusive date range.");
      if (!["xlsx", "json"].includes(format)) throw new Error("Choose Excel or JSON.");
      if (!root.AkiFiscalCore?.collectLedger) throw new Error("Fiscal export tools are not available. Reload AkiHQ.");
      const ledger = await root.AkiFiscalCore.collectLedger({ rpc: async (name, args) => ({ data: await rpc(name, args), error: null }) }, { workspace: workspaceId, from, through });
      assertActive();
      if (format === "json") ctx.download(`akihq-fiscal-ledger-${from}-${through}.json`, JSON.stringify({ ...ledger, official_aeat_book: false }, null, 2), "application/json");
      else {
        const XLSX = await spreadsheet(); assertActive();
        const workbook = root.AkiFiscalCore.ledgerWorkbook(XLSX, ledger);
        const bytes = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
        ctx.download(`akihq-fiscal-ledger-${from}-${through}.xlsx`, bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      }
    }
    async function action(target) {
      const element = target?.closest?.("[data-action]") || target;
      const name = element?.dataset?.action;
      if (!name?.startsWith("suite-")) return false;
      if (name === "suite-refresh") await run(async () => {}, "");
      else if (name === "suite-privacy-export") await run(async () => {
        const id = element.dataset.id;
        if (!privacy?.requests?.some(item => item.id === id && item.verified_at && ["access", "portability"].includes(item.kind))) throw new Error("Verify this request before exporting.");
        const data = await request(`/api/privacy/export?id=${encodeURIComponent(id)}`);
        ctx.download(`subject-data-${id}.json`, JSON.stringify(data, null, 2), "application/json");
      }, "Covered subject records exported. Review the coverage list before responding.");
      else return false;
      return true;
    }
    async function submit(target) {
      const name = target?.dataset?.suiteForm || target?.id;
      if (!name?.startsWith("suite-")) return false;
      if (target.checkValidity && !target.checkValidity()) { target.reportValidity?.(); return true; }
      const values = Object.fromEntries(new FormData(target));
      const known = new Set(["suite-fiscal-profile", "suite-fiscal-tax", "suite-fiscal-export", "suite-fiscal-lock", "suite-privacy-settings", "suite-privacy-consent", "suite-privacy-request", "suite-privacy-action"]);
      if (!known.has(name)) return false;
      await run(async () => {
        if (name === "suite-fiscal-profile") {
          if (values.scope_confirmed !== "yes") throw new Error("Confirm the business tax scope.");
          await rpc("crm_fiscal_save_profile", { p_profile: { legal_name: values.legal_name.trim(), tax_id: values.tax_id.trim().toUpperCase(), address: values.address.trim(), postal_code: values.postal_code.trim(), city: values.city.trim(), simplified_limit_cents: Number(values.simplified_limit_cents), eligible_activity: values.eligible_activity.trim(), country: "ES", jurisdiction: "common_territory", currency: "EUR", tax_regime: "general", sii: false } });
        } else if (name === "suite-fiscal-tax") {
          await rpc("crm_fiscal_assign_tax", { p_item: values.item_id, p_rate_bps: Number(values.rate_bps), p_treatment: "taxable", p_reason: "" });
        } else if (name === "suite-fiscal-export") await exportLedger(values.from, values.through, values.format);
        else if (name === "suite-fiscal-lock") {
          if (values.confirm_lock !== "yes") throw new Error("Confirm that this accounting period is ready to close.");
          await rpc("crm_fiscal_lock_period", { p_through: values.through });
        } else if (name === "suite-privacy-settings") {
          await request("/api/privacy/settings", { method: "POST", body: { ...values, retention_days: Number(values.retention_days) } });
        } else if (name === "suite-privacy-consent") {
          const occurredAt = new Date(values.occurred_at);
          if (!Number.isFinite(occurredAt.getTime())) throw new Error("Choose when the permission event occurred.");
          await request("/api/privacy/consent", { method: "POST", body: { ...values, occurred_at: occurredAt.toISOString() } });
        } else if (name === "suite-privacy-request") {
          if (values.received_at) {
            const receivedAt = new Date(values.received_at);
            if (!Number.isFinite(receivedAt.getTime())) throw new Error("Choose when the request was received.");
            values.received_at = receivedAt.toISOString();
          } else delete values.received_at;
          await request("/api/privacy/requests", { method: "POST", body: values });
        }
        else if (name === "suite-privacy-action") await request("/api/privacy/request-action", { method: "POST", body: values });
      }, name === "suite-fiscal-export" ? "Fiscal ledger exported." : "Saved for this workspace.");
      return true;
    }
    return { render, load, action, submit, dispose() { disposed = true; fiscal = null; privacy = null; } };
  }
  root.AkiHQSuiteControls = Object.freeze({ create });
})(globalThis);
