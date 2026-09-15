/* Tenant-isolated, memory-only customer support. No email bodies in localStorage. */
(() => {
  "use strict";
  window.createSupportDesk = function createSupportDesk(ctx) {
    const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const labels = {
      en: { title: "Customer support", refresh: "Refresh", settings: "Support settings", open: "Open", mine: "Assigned to me", all: "All tickets", new: "New", ai_active: "AI handling", needs_human: "Needs a human", in_progress: "In progress", waiting_customer: "Waiting for customer", resolved: "Resolved", spam: "Spam", search: "Search ticket, customer or subject", empty: "All clear here", emptyHelp: "Incoming support emails will appear here as numbered tickets.", back: "Back to tickets", takeover: "Take over", reply: "Reply to customer", note: "Internal note", send: "Send reply", addNote: "Save note", write: "Write a reply…", internal: "Only your support team can see this note.", save: "Save", unassigned: "Unassigned", assignee: "Assigned to", status: "Status", priority: "Priority", history: "Ticket activity", approved: "Approved answers", question: "Question / when to use", answer: "Exact customer-facing answer", add: "Add answer", remove: "Remove", off: "Off — human only", draft: "Draft — approve before sending", auto: "Automatic — approved answers only", enabled: "Support processing enabled", mode: "AI mode", limit: "AI replies per ticket", daily: "AI requests per day", settingsHelp: "Use only customer-safe answers. The AI cannot access other CRM modules or change customer accounts.", setup: "Mailbox setup required", setupHelp: "An administrator must verify an email address and connect Cloudflare routing to this workspace. No mail has been imported from other inboxes.", noAi: "AI provider not configured", noSending: "Email sending not configured", saved: "Saved", loadError: "Support unavailable", retry: "Try again", newer: "Previous", older: "Next", contact: "Customer ID", message: "Email ID", sent: "Accepted by mail provider", received: "Received", queued: "Queued", sending: "Sending", failed: "Send failed — review required", uncertain: "Delivery unknown — check logs before resending", cancelled: "Cancelled", readOnly: "Read-only support access", draftReady: "AI suggested answer", useDraft: "Use answer", details: "Details", pending: "Mail connection pending verification" },
      es: { title: "Atención al cliente", refresh: "Actualizar", settings: "Ajustes de soporte", open: "Abiertos", mine: "Asignados a mí", all: "Todos", new: "Nuevo", ai_active: "En manos de IA", needs_human: "Necesita una persona", in_progress: "En curso", waiting_customer: "Esperando al cliente", resolved: "Resuelto", spam: "Spam", search: "Buscar ticket, cliente o asunto", empty: "Todo al día", emptyHelp: "Los correos de soporte aparecerán aquí con su número de ticket.", back: "Volver a tickets", takeover: "Encargarme", reply: "Responder al cliente", note: "Nota interna", send: "Enviar respuesta", addNote: "Guardar nota", write: "Escribe una respuesta…", internal: "Solo tu equipo de soporte puede ver esta nota.", save: "Guardar", unassigned: "Sin asignar", assignee: "Asignado a", status: "Estado", priority: "Prioridad", history: "Actividad del ticket", approved: "Respuestas aprobadas", question: "Pregunta / cuándo usar", answer: "Respuesta exacta para el cliente", add: "Añadir respuesta", remove: "Eliminar", off: "Desactivada — solo personas", draft: "Borrador — aprobar antes de enviar", auto: "Automática — solo respuestas aprobadas", enabled: "Procesamiento de soporte activado", mode: "Modo IA", limit: "Respuestas IA por ticket", daily: "Solicitudes IA por día", settingsHelp: "Usa solo respuestas aptas para clientes. La IA no puede acceder a otros módulos ni modificar cuentas.", setup: "Falta conectar el correo", setupHelp: "Un administrador debe verificar una dirección y conectar Cloudflare a este espacio. No se han importado correos de otras bandejas.", noAi: "Proveedor IA sin configurar", noSending: "Envío de correo sin configurar", saved: "Guardado", loadError: "Soporte no disponible", retry: "Reintentar", newer: "Anterior", older: "Siguiente", contact: "ID del cliente", message: "ID del correo", sent: "Aceptado por el proveedor", received: "Recibido", queued: "En cola", sending: "Enviando", failed: "Envío fallido — revisar", uncertain: "Envío sin confirmar — revisar antes de reenviar", cancelled: "Cancelado", readOnly: "Acceso de solo lectura", draftReady: "Respuesta sugerida por IA", useDraft: "Usar respuesta", details: "Detalles", pending: "Conexión pendiente de verificar" },
    };
    const tr = key => labels[ctx.locale() === "es" ? "es" : "en"][key] || key;
    Object.assign(labels.en, { original: "Download original email", attachmentsHelp: "Attachments are included in the original email. Treat files as untrusted.", low: "Low", normal: "Normal", high: "High", urgent: "Urgent" });
    Object.assign(labels.es, { original: "Descargar correo original", attachmentsHelp: "El correo original incluye los adjuntos. Revisa los archivos con precaución.", low: "Baja", normal: "Normal", high: "Alta", urgent: "Urgente" });
    Object.assign(labels.en, { connecting: "Support is being connected", connectingHelp: "Your workspace has access to Customer support. The email connection still needs to be completed before tickets and replies are available.", loading: "Loading support…" });
    Object.assign(labels.es, { connecting: "Estamos conectando el soporte", connectingHelp: "Tu espacio tiene acceso a Atención al cliente. Falta completar la conexión del correo para recibir tickets y responder.", loading: "Cargando soporte…" });
    let workspace = "", generation = 0, overview = null, detail = null, selected = null;
    let gatewayReady = null;
    let loading = false, busy = false, error = "", filter = "open", search = "", page = 0, settingsOpen = false;
    let drafts = new Map(), settingsDraft = null, requestIds = new Map(), refreshAt = 0;
    const ticketName = t => `SUP-${String(t.number).padStart(6, "0")}`;
    const date = value => new Date(value).toLocaleString(ctx.locale() === "es" ? "es-ES" : "en-GB", { dateStyle: "short", timeStyle: "short" });
    function reset() {
      generation++; workspace = ctx.workspace(); overview = null; detail = null; selected = null;
      loading = false; busy = false; error = ""; drafts = new Map(); requestIds = new Map();
      settingsDraft = null; settingsOpen = false; filter = "open"; page = 0; search = ""; refreshAt = 0;
      gatewayReady = null;
    }
    function valid(w, g) { return ctx.allowed() && workspace === w && ctx.workspace() === w && generation === g; }
    function request(path, options = {}) { return ctx.request(path, { ...options, headers: { "x-workspace-id": workspace } }); }
    async function refresh() {
      if (!ctx.allowed()) return reset();
      if (workspace !== ctx.workspace()) reset();
      if (loading || busy) return;
      const w = workspace, g = generation; loading = true; error = "";
      try {
        if (gatewayReady !== true) {
          const health = await request("/api/health");
          if (!valid(w, g)) return;
          gatewayReady = health?.capabilities?.support === 1;
          if (!gatewayReady) { overview = null; detail = null; return; }
        }
        const data = await request(`/api/support/overview?${new URLSearchParams({ filter, search, page })}`);
        if (!valid(w, g)) return;
        overview = data; refreshAt = Date.now();
        if (selected) {
          const next = await request(`/api/support/ticket?id=${encodeURIComponent(selected)}`);
          if (!valid(w, g)) return;
          detail = next;
        }
      } catch (e) { if (valid(w, g)) { error = e.message; overview = null; detail = null; } }
      finally { if (valid(w, g)) { loading = false; refreshAt = Date.now(); ctx.render(); } }
    }
    async function open(id) {
      if (busy || !ctx.allowed()) return;
      const w = workspace, g = ++generation;
      selected = id; detail = null; loading = false; error = ""; ctx.render();
      try { const data = await request(`/api/support/ticket?id=${encodeURIComponent(id)}`); if (valid(w, g)) detail = data; }
      catch (e) { if (valid(w, g)) error = e.message; }
      if (valid(w, g)) ctx.render();
    }
    function draftKey(kind = "reply") { return `${selected}:${kind}`; }
    function button(action, text, icon, primary = false, extra = "") {
      return `<button type="button" class="action-btn ${primary ? "primary" : ""}" data-support-action="${action}" ${busy ? "disabled" : ""} ${extra}>${ctx.icon(icon)} ${esc(text)}</button>`;
    }
    function options(values, current) { return values.map(value => `<option value="${esc(value)}" ${value === current ? "selected" : ""}>${esc(tr(value))}</option>`).join(""); }
    function originalLink(message) {
      return message.original_key ? button("original", tr("original"), "download", false, `data-id="${esc(message.id)}"`) : "";
    }
    async function downloadOriginal(id) {
      const w = workspace, g = generation;
      try {
        const blob = await request(`/api/support/original?id=${encodeURIComponent(id)}`, { responseType: "blob" });
        if (!valid(w, g)) return;
        const url = URL.createObjectURL(blob), link = document.createElement("a");
        link.href = url; link.download = `email-${id}.eml`; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      } catch (e) { if (valid(w, g)) { error = e.message; ctx.render(); } }
    }
    function renderSettings() {
      const s = settingsDraft || overview.settings;
      return `<form data-support-form="settings" class="support-settings panel">
        <div class="panel-header"><div><h2>${esc(tr("settings"))}</h2><p>${esc(tr("settingsHelp"))}</p></div></div>
        ${!overview.ai_configured ? `<p class="support-handover">${esc(tr("noAi"))}</p>` : ""}
        <div class="support-setting-grid"><label class="support-check"><input type="checkbox" name="enabled" ${s.enabled ? "checked" : ""}>${esc(tr("enabled"))}</label>
        <label>${esc(tr("mode"))}<select name="ai_mode">${options(["off", "draft", "auto"], s.ai_mode)}</select></label>
        <label>${esc(tr("limit"))}<input name="max_ai_replies" type="number" min="1" max="3" value="${s.max_ai_replies}"></label>
        <label>${esc(tr("daily"))}<input name="daily_ai_limit" type="number" min="1" max="100" value="${s.daily_ai_limit}"></label></div>
        <div class="support-answers"><h3>${esc(tr("approved"))}</h3>${(s.knowledge || []).map((item, i) => `<fieldset data-support-answer="${i}"><input type="hidden" name="id" value="${esc(item.id)}"><label>${esc(tr("question"))}<input name="question" maxlength="500" minlength="5" required value="${esc(item.question)}"></label><label>${esc(tr("answer"))}<textarea name="answer" rows="3" minlength="5" maxlength="4000" required>${esc(item.answer)}</textarea></label>${button("remove-answer", tr("remove"), "trash", false, `data-index="${i}"`)}</fieldset>`).join("")}</div>
        <footer>${button("add-answer", tr("add"), "plus")}<button class="action-btn primary" ${busy ? "disabled" : ""}>${esc(tr("save"))}</button></footer>
      </form>`;
    }
    function renderThread() {
      if (!detail) return `<div class="support-thread support-empty">${selected ? "…" : esc(tr("emptyHelp"))}</div>`;
      const t = detail.ticket, canWrite = overview?.access?.write;
      const draft = drafts.get(draftKey()) || "";
      return `<section class="support-thread" aria-label="${esc(t.subject)}">
        <header class="support-thread-head">${button("back", tr("back"), "arrowLeft")}<div><span class="support-number">${ticketName(t)}</span><h2>${esc(t.subject)}</h2><p>${esc(detail.contact.name || detail.contact.email)} · ${esc(detail.contact.email)}</p></div>${canWrite ? button("takeover", tr("takeover"), "user") : ""}</header>
        ${t.handover_reason ? `<div class="support-handover">${ctx.icon("warning")}<span>${esc(t.handover_reason)}</span></div>` : ""}
        <div class="support-thread-scroll">
          <details class="support-details"><summary>${esc(tr("details"))} · ${esc(tr(t.status))}</summary>
          <p class="support-id">${esc(tr("contact"))}: ${esc(detail.contact.id)}<br>${esc(detail.mailbox.address)}</p>
          ${canWrite ? `<form data-support-form="update" class="support-ticket-fields"><label>${esc(tr("status"))}<select name="status">${options(["needs_human", "in_progress", "waiting_customer", "resolved", "spam"], t.status)}</select></label><label>${esc(tr("priority"))}<select name="priority">${options(["low", "normal", "high", "urgent"], t.priority)}</select></label><label>${esc(tr("assignee"))}<select name="assigned_to"><option value="">${esc(tr("unassigned"))}</option>${(overview.members || []).map(m => `<option value="${esc(m.id)}" ${m.id === t.assigned_to ? "selected" : ""}>${esc(m.name || m.id)}</option>`).join("")}</select></label><button class="action-btn" ${busy ? "disabled" : ""}>${esc(tr("save"))}</button></form>` : `<p>${esc(tr("readOnly"))}</p>`}
          <details><summary>${esc(tr("history"))}</summary><ol class="support-history">${detail.events.map(e => `<li>${esc(date(e.created_at))} · ${esc(e.kind.replaceAll("_", " "))}</li>`).join("")}</ol></details></details>
          <div class="support-messages">${detail.messages.map(m => `<article class="support-message ${esc(m.direction)}"><header><strong>${m.direction === "inbound" ? esc(detail.contact.name || detail.contact.email) : m.author_kind === "ai" ? "AI" : esc(tr(m.direction === "note" ? "note" : "reply"))}</strong><time>${esc(date(m.created_at))}</time></header><div class="support-message-text">${esc(m.text)}</div>${m.attachments?.length ? `<p class="support-attachments">${ctx.icon("attachment")}${m.attachments.map(a => esc(a.filename)).join(" · ")}<small>${esc(tr("attachmentsHelp"))}</small></p>` : ""}${originalLink(m)}<footer><span class="support-delivery ${esc(m.delivery_status)}">${esc(tr(m.delivery_status))}</span><details><summary>${esc(tr("message"))}</summary><span class="support-id">${esc(m.id)}<br>${esc(m.message_id || "")}</span></details></footer></article>`).join("")}</div>
        </div>
        ${canWrite ? `<div class="support-reply-area">${t.ai_draft ? `<div class="support-draft">${ctx.icon("sparkles")}<span>${esc(tr("draftReady"))}</span>${button("use-draft", tr("useDraft"), "edit")}</div>` : ""}<form data-support-form="reply"><label class="support-composer-label">${esc(tr("reply"))}<textarea name="text" data-support-draft="reply" rows="3" maxlength="20000" required placeholder="${esc(tr("write"))}">${esc(draft)}</textarea></label><div class="support-composer-foot"><small>${esc(detail.mailbox.address)} → ${esc(detail.contact.email)}</small><button class="action-btn primary" ${busy || !overview.sending_configured || !overview.settings.enabled || t.status === "spam" ? "disabled" : ""}>${ctx.icon("send")} ${esc(tr("send"))}</button></div></form><details class="support-note"><summary>${esc(tr("note"))}</summary><form data-support-form="note"><label>${esc(tr("internal"))}<textarea name="text" data-support-draft="note" rows="2" maxlength="20000" required>${esc(drafts.get(draftKey("note")) || "")}</textarea></label><button class="action-btn" ${busy ? "disabled" : ""}>${esc(tr("addNote"))}</button></form></details></div>` : ""}
      </section>`;
    }
    function render() {
      if (!ctx.allowed()) { reset(); return ""; }
      if (workspace !== ctx.workspace()) reset();
      if (!overview && !loading && !error && gatewayReady !== false) queueMicrotask(refresh);
      const counts = overview?.counts || {};
      const tickets = (overview?.tickets || []).slice(0, 30);
      const header = `<div data-support-root class="support-desk">
        <div class="support-toolbar"><div class="support-identity">${ctx.icon("support")}<div><strong>${esc(tr("title"))}</strong><small>${esc(ctx.workspaceName())} · ${esc((overview?.mailboxes || []).filter(m => m.active && m.verified).map(m => m.address).join(", ") || tr("pending"))}</small></div></div><div class="panel-actions">${button("refresh", tr("refresh"), "refresh")}${overview?.access?.manage ? button("settings", tr("settings"), "settings") : ""}</div></div>
        ${error ? `<div class="support-handover" role="alert">${ctx.icon("warning")}<span>${esc(error)}</span>${button("refresh", tr("retry"), "refresh")}</div>` : ""}`;
      if (!overview) return `${header}<div class="support-setup" role="status"><strong>${esc(tr(error ? "loadError" : gatewayReady === false ? "connecting" : "loading"))}</strong>${!error && gatewayReady === false ? `<p>${esc(tr("connectingHelp"))}</p>` : ""}</div></div>`;
      return `${header}
        ${overview && !overview.mailboxes.some(m => m.active && m.verified) ? `<div class="support-setup"><strong>${esc(tr("setup"))}</strong><p>${esc(tr("setupHelp"))}</p></div>` : ""}
        ${overview && !overview.sending_configured ? `<div class="support-handover">${esc(tr("noSending"))}</div>` : ""}
        ${settingsOpen && overview ? renderSettings() : `<div class="support-filters" aria-label="Ticket filters">${["open", "needs_human", "mine", "waiting_customer", "resolved", "all"].map(f => `<button data-support-action="filter" data-filter="${f}" aria-pressed="${filter === f}" class="${filter === f ? "active" : ""}">${esc(tr(f))}${counts[f] ? `<span>${counts[f]}</span>` : ""}</button>`).join("")}</div>
        <div class="support-layout panel ${selected ? "support-selected" : ""}"><aside class="support-list"><form data-support-form="search" class="support-search"><label>${ctx.icon("search")}<input type="search" name="search" maxlength="100" placeholder="${esc(tr("search"))}" aria-label="${esc(tr("search"))}" value="${esc(search)}"></label><button class="mini-btn" aria-label="Search">${ctx.icon("arrowRight")}</button></form>
          <div class="support-ticket-list">${tickets.map(t => `<button type="button" data-support-action="select" data-id="${esc(t.id)}" class="support-ticket ${selected === t.id ? "active" : ""}"><div><span class="support-number">${ticketName(t)}</span><span class="support-status ${esc(t.status)}">${esc(tr(t.status))}</span></div><strong>${esc(t.subject)}</strong><small>${esc(t.requester_name || t.requester_email)}</small><footer><span>${esc(t.priority)}${t.assigned_to === ctx.user() ? " · " + esc(tr("mine")) : ""}</span><time>${esc(date(t.updated_at))}</time></footer></button>`).join("") || `<div class="support-empty">${ctx.icon(loading ? "refresh" : "check")}<strong>${loading ? "…" : esc(tr("empty"))}</strong><p>${esc(tr("emptyHelp"))}</p></div>`}</div>
          <footer class="support-pagination">${button("previous", tr("newer"), "arrowLeft", false, page === 0 ? "disabled" : "")}<span>${page + 1}</span>${button("next", tr("older"), "arrowRight", false, (overview?.tickets.length || 0) <= 30 ? "disabled" : "")}</footer></aside>${renderThread()}</div>`}
      </div>`;
    }
    function captureSettings(form) {
      const values = new FormData(form);
      return { enabled: values.has("enabled"), ai_mode: values.get("ai_mode"), max_ai_replies: Number(values.get("max_ai_replies")), daily_ai_limit: Number(values.get("daily_ai_limit")), knowledge: [...form.querySelectorAll("[data-support-answer]")].map(field => ({ id: field.querySelector('[name="id"]').value, question: field.querySelector('[name="question"]').value, answer: field.querySelector('[name="answer"]').value })) };
    }
    async function act(action) {
      if (!detail || busy) return;
      const w = workspace, g = generation; busy = true; error = ""; ctx.render();
      try {
        const result = await request("/api/support/action", { method: "POST", body: { ticket_id: selected, version: detail.ticket.version, action } });
        if (!valid(w, g)) return;
        detail = result;
        if (action.kind === "reply" || action.kind === "note") { drafts.delete(draftKey(action.kind)); requestIds.delete(draftKey(action.kind)); }
        ctx.toast(tr("saved"));
      } catch (e) { if (valid(w, g)) error = e.message; }
      finally { if (valid(w, g)) { busy = false; ctx.render(); } }
    }
    document.addEventListener("input", event => {
      const input = event.target.closest("[data-support-draft]");
      if (input && ctx.allowed()) { drafts.set(draftKey(input.dataset.supportDraft), input.value); requestIds.delete(draftKey(input.dataset.supportDraft)); }
      const settings = event.target.closest('[data-support-form="settings"]');
      if (settings) settingsDraft = captureSettings(settings);
    });
    document.addEventListener("click", event => {
      const target = event.target.closest("[data-support-action]");
      if (!target || !ctx.allowed() || busy) return;
      const action = target.dataset.supportAction;
      if (action === "select") void open(target.dataset.id);
      if (action === "refresh") { error = ""; void refresh(); }
      if (action === "back") { generation++; loading = false; selected = null; detail = null; ctx.render(); }
      if (action === "filter") { generation++; loading = false; filter = target.dataset.filter; page = 0; selected = null; detail = null; void refresh(); }
      if (action === "previous" || action === "next") { page = Math.max(0, page + (action === "next" ? 1 : -1)); void refresh(); }
      if (action === "settings") { settingsOpen = !settingsOpen; settingsDraft ||= structuredClone(overview.settings); ctx.render(); }
      if (action === "add-answer" && settingsDraft.knowledge.length < 30) { settingsDraft.knowledge.push({ id: "a_" + crypto.randomUUID().slice(0, 8), question: "", answer: "" }); ctx.render(); }
      if (action === "remove-answer") { settingsDraft.knowledge.splice(Number(target.dataset.index), 1); ctx.render(); }
      if (action === "takeover") void act({ kind: "takeover" });
      if (action === "original") void downloadOriginal(target.dataset.id);
      if (action === "use-draft") { drafts.set(draftKey(), detail.ticket.ai_draft); ctx.render(); }
    });
    document.addEventListener("submit", async event => {
      const form = event.target.closest("[data-support-form]");
      if (!form || !ctx.allowed()) return;
      event.preventDefault(); if (busy) return;
      const kind = form.dataset.supportForm, data = new FormData(form);
      if (kind === "search") { search = String(data.get("search") || "").trim(); page = 0; generation++; loading = false; await refresh(); }
      if (kind === "reply" || kind === "note") {
        const key = draftKey(kind); const request_id = requestIds.get(key) || crypto.randomUUID(); requestIds.set(key, request_id);
        await act({ kind, text: String(data.get("text") || ""), request_id });
      }
      if (kind === "update") await act({ kind, status: data.get("status"), priority: data.get("priority"), assigned_to: data.get("assigned_to") || null });
      if (kind === "settings") {
        const w = workspace, g = generation; settingsDraft = captureSettings(form); busy = true; ctx.render();
        try { await request("/api/support/settings", { method: "POST", body: settingsDraft }); if (valid(w, g)) { settingsOpen = false; settingsDraft = null; } }
        catch (e) { if (valid(w, g)) error = e.message; }
        finally { if (valid(w, g)) { busy = false; ctx.render(); if (!error) await refresh(); } }
      }
    });
    function attention() {
      return ctx.allowed() && workspace === ctx.workspace() ? overview?.attention || { count: 0 } : { count: 0 };
    }
    function notifications() {
      const a = attention();
      return a.count ? [{ id: `support:${workspace}:${a.at}`, title: tr("needs_human"), body: `${a.count} · ${tr("title")} · ${ctx.workspaceName()}`, route: "support", icon: "support", at: a.at }] : [];
    }
    setInterval(() => {
      if (!ctx.allowed()) { reset(); return; }
      if (document.hidden || settingsOpen || busy || loading || Date.now() - refreshAt < (ctx.route() === "support" ? 30000 : 60000)) return;
      if (document.activeElement?.matches("input, textarea, select") || [...drafts.values()].some(Boolean)) return;
      void refresh();
    }, 30000);
    return { render, refresh, reset, attention, notifications };
  };
})();
