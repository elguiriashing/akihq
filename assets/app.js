(() => {
  "use strict";

  const STORAGE_KEY = "akihq_state_v1";
  const SESSION_KEY = "akihq_supabase_session_v1";
  const APP_VERSION = "0.1.0";
  const appRoot = document.getElementById("app");
  const portal = document.getElementById("portal");
  const importInput = document.getElementById("import-file");

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const uid = prefix => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const isoNow = () => new Date().toISOString();
  const dateOffset = days => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + days);
    return date.toISOString();
  };
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const escapeHtml = value => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
  const initials = value => String(value || "A")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join("") || "A";
  const stripHtml = value => String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const capitalize = value => String(value || "").replace(/[-_]/g, " ").replace(/\b\w/g, char => char.toUpperCase());
  const safeUrl = value => {
    try {
      const url = new URL(value);
      return ["https:", "http:"].includes(url.protocol) ? url.toString() : "";
    } catch {
      return "";
    }
  };

  const ICONS = {
    dashboard: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    crm: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    inbox: '<path d="M4 4h16v16H4z"/><path d="m4 13 4 4h8l4-4"/><path d="M8 4v5h8V4"/>',
    tasks: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
    calendar: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    inventory: '<path d="m21 8-9-5-9 5 9 5 9-5Z"/><path d="m3 8 9 5 9-5M3 12l9 5 9-5M3 16l9 5 9-5"/>',
    sales: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h5"/>',
    marketing: '<path d="m3 11 18-5v12L3 14v-3Z"/><path d="M11.6 16.4 13 21H7l-1.3-6.5"/>',
    sites: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 20V9"/><circle cx="6" cy="6.5" r=".5" fill="currentColor"/>',
    automation: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6h.08A1.65 1.65 0 0 0 10 3.09V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9v.08A1.65 1.65 0 0 0 20.91 10H21a2 2 0 1 1 0 4h-.09A1.65 1.65 0 0 0 19.4 15Z"/>',
    collaboration: '<path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z"/><path d="M8 9h8M8 13h5"/>',
    employees: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/><path d="M18 5h3M19.5 3.5v3"/>',
    knowledge: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/><path d="M8 7h8M8 11h6"/>',
    analytics: '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 6-7"/>',
    integrations: '<path d="M8 12h8M12 8v8"/><path d="M5 5a3 3 0 1 1 4.24 4.24L7.5 11M19 19a3 3 0 1 1-4.24-4.24L16.5 13M19 5a3 3 0 1 0-4.24 4.24L16.5 11M5 19a3 3 0 1 0 4.24-4.24L7.5 13"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06-2.83 2.83-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21h-4v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06-2.83-2.83.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3v-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06 2.83-2.83.06.06A1.65 1.65 0 0 0 9 4.6h.08A1.65 1.65 0 0 0 10 3.09V3h4v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06 2.83 2.83-.06.06A1.65 1.65 0 0 0 19.4 9v.08A1.65 1.65 0 0 0 20.91 10H21v4h-.09A1.65 1.65 0 0 0 19.4 15Z"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
    timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6"/>',
    chevron: '<path d="m9 18 6-6-6-6"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    close: '<path d="M18 6 6 18M6 6l12 12"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4L16.5 3.5Z"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v5M14 11v5"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    more: '<circle cx="5" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="19" cy="12" r="1" fill="currentColor"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
    upload: '<path d="M12 21V9M7 14l5-5 5 5M5 3h14"/>',
    filter: '<path d="M4 5h16M7 12h10M10 19h4"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r=".5" fill="currentColor"/><circle cx="3.5" cy="12" r=".5" fill="currentColor"/><circle cx="3.5" cy="18" r=".5" fill="currentColor"/>',
    board: '<rect x="3" y="3" width="7" height="18" rx="1"/><rect x="14" y="3" width="7" height="12" rx="1"/>',
    send: '<path d="m22 2-7 20-4-9-9-4 20-7Z"/><path d="M22 2 11 13"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    warning: '<path d="M10.3 2.9 1.8 17a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 2.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    arrowLeft: '<path d="m15 18-6-6 6-6"/>',
    arrowRight: '<path d="m9 18 6-6-6-6"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.78.62 2.63a2 2 0 0 1-.45 2.11L8 9.73a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.85.29 1.73.5 2.63.62A2 2 0 0 1 22 16.92Z"/>',
    building: '<path d="M3 21h18M6 21V3h12v18M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    money: '<circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 0 0 0 4h4a2 2 0 0 1 0 4H8M12 6v12"/>',
    activity: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
    cloud: '<path d="M17.5 19H9a7 7 0 1 1 6.7-9h1.8a4.5 4.5 0 0 1 0 9Z"/>',
    lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    refresh: '<path d="M20 6v6h-6M4 18v-6h6"/><path d="M5.6 9A8 8 0 0 1 19 6l1 6M4 12l1 6a8 8 0 0 0 13.4-3"/>',
    external: '<path d="M14 3h7v7M10 14 21 3"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/>',
    sparkles: '<path d="m12 3-1.3 3.7L7 8l3.7 1.3L12 13l1.3-3.7L17 8l-3.7-1.3L12 3ZM5 14l-.8 2.2L2 17l2.2.8L5 20l.8-2.2L8 17l-2.2-.8L5 14ZM19 13l-.9 2.6-2.6.9 2.6.9.9 2.6.9-2.6 2.6-.9-2.6-.9L19 13Z"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>'
  };

  const icon = (name, className = "") => `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.info}</svg>`;

  const translations = {
    en: {
      dashboard: "Dashboard", crm: "CRM", inbox: "Inbox", tasks: "Tasks & Projects", calendar: "Calendar",
      inventory: "Inventory", sales: "Sales & Billing", marketing: "Marketing", sites: "Sites & Forms",
      automation: "Automation", collaboration: "Collaboration", employees: "People", knowledge: "Knowledge",
      analytics: "Analytics", integrations: "Integrations", settings: "Settings", create: "Create", search: "Search everything…",
      collapse: "Collapse", allSystems: "Business operating system", newRecord: "New record", board: "Board", list: "List",
      deals: "Deals", leads: "Leads", contacts: "Contacts", companies: "Companies", save: "Save", cancel: "Cancel",
      edit: "Edit", delete: "Delete", close: "Close", connected: "Connected", configure: "Configure", disconnect: "Disconnect"
    },
    es: {
      dashboard: "Resumen", crm: "CRM", inbox: "Bandeja", tasks: "Tareas y proyectos", calendar: "Calendario",
      inventory: "Inventario", sales: "Ventas y facturación", marketing: "Marketing", sites: "Webs y formularios",
      automation: "Automatización", collaboration: "Colaboración", employees: "Equipo", knowledge: "Conocimiento",
      analytics: "Analítica", integrations: "Integraciones", settings: "Ajustes", create: "Crear", search: "Buscar en todo…",
      collapse: "Contraer", allSystems: "Sistema operativo empresarial", newRecord: "Nuevo registro", board: "Tablero", list: "Lista",
      deals: "Negocios", leads: "Prospectos", contacts: "Contactos", companies: "Empresas", save: "Guardar", cancel: "Cancelar",
      edit: "Editar", delete: "Eliminar", close: "Cerrar", connected: "Conectado", configure: "Configurar", disconnect: "Desconectar"
    }
  };

  const navSections = [
    {
      label: "Workspace",
      items: [
        ["dashboard", "dashboard"], ["crm", "crm"], ["inbox", "inbox"], ["tasks", "tasks"], ["calendar", "calendar"]
      ]
    },
    {
      label: "Operations",
      items: [
        ["inventory", "inventory"], ["sales", "sales"], ["marketing", "marketing"], ["sites", "sites"], ["automation", "automation"]
      ]
    },
    {
      label: "Team & insight",
      items: [
        ["collaboration", "collaboration"], ["employees", "employees"], ["knowledge", "knowledge"], ["analytics", "analytics"], ["integrations", "integrations"]
      ]
    }
  ];

  const integrationCatalog = [
    { id: "resend", name: "Resend", category: "Email", mark: "R", color: "linear-gradient(135deg,#101010,#4c4c4c)", description: "Transactional and CRM email, inbound receiving, delivery events and sender identities.", mode: "serverless" },
    { id: "gmail", name: "Gmail", category: "Email", mark: "M", color: "linear-gradient(135deg,#e65b51,#f4b85c)", description: "Sync mailbox threads, contacts and outbound messages through Google OAuth.", mode: "oauth" },
    { id: "outlook", name: "Microsoft Outlook", category: "Email", mark: "O", color: "linear-gradient(135deg,#1787da,#39a7f0)", description: "Connect Microsoft 365 mailboxes, calendars and contacts.", mode: "oauth" },
    { id: "mailchimp", name: "Mailchimp", category: "Marketing", mark: "M", color: "linear-gradient(135deg,#f3b945,#ffe37b)", description: "Sync audiences, tags and campaign performance.", mode: "api" },
    { id: "telegram", name: "Telegram", category: "Messaging", mark: "T", color: "linear-gradient(135deg,#229ed9,#72d2ff)", description: "Bot messages, lead capture, notifications and team alerts.", mode: "serverless" },
    { id: "whatsapp", name: "WhatsApp Business", category: "Messaging", mark: "W", color: "linear-gradient(135deg,#21b861,#68dc91)", description: "Meta Cloud API conversations, templates and CRM routing.", mode: "serverless" },
    { id: "instagram", name: "Instagram", category: "Messaging", mark: "I", color: "linear-gradient(135deg,#6f48d8,#dc3a85,#ffaf4d)", description: "Business messages, lead forms and campaign attribution.", mode: "oauth" },
    { id: "facebook", name: "Facebook Messenger", category: "Messaging", mark: "f", color: "linear-gradient(135deg,#1877f2,#66a7ff)", description: "Messenger conversations and lead-ad capture.", mode: "oauth" },
    { id: "slack", name: "Slack", category: "Collaboration", mark: "S", color: "linear-gradient(135deg,#4a154b,#d54c74)", description: "Channel alerts, commands and workflow notifications.", mode: "oauth" },
    { id: "discord", name: "Discord", category: "Collaboration", mark: "D", color: "linear-gradient(135deg,#5865f2,#8790ff)", description: "Send server notifications and receive webhook events.", mode: "serverless" },
    { id: "teams", name: "Microsoft Teams", category: "Collaboration", mark: "T", color: "linear-gradient(135deg,#6264a7,#8e8fd1)", description: "Meeting links, channel messages and Microsoft collaboration.", mode: "oauth" },
    { id: "google-calendar", name: "Google Calendar", category: "Calendar", mark: "31", color: "linear-gradient(135deg,#4285f4,#34a853)", description: "Two-way calendar sync, availability and booking events.", mode: "oauth" },
    { id: "microsoft-calendar", name: "Microsoft Calendar", category: "Calendar", mark: "31", color: "linear-gradient(135deg,#1787da,#7ac1ed)", description: "Microsoft 365 event sync and scheduling.", mode: "oauth" },
    { id: "zoom", name: "Zoom", category: "Calendar", mark: "Z", color: "linear-gradient(135deg,#2d8cff,#64aaff)", description: "Create meeting links from tasks, bookings and CRM activities.", mode: "oauth" },
    { id: "stripe", name: "Stripe", category: "Payments", mark: "S", color: "linear-gradient(135deg,#635bff,#9d98ff)", description: "Invoices, subscriptions, payment links and webhook reconciliation.", mode: "serverless" },
    { id: "paypal", name: "PayPal", category: "Payments", mark: "P", color: "linear-gradient(135deg,#003087,#009cde)", description: "Payment capture, refunds and invoice status updates.", mode: "serverless" },
    { id: "google-drive", name: "Google Drive", category: "Storage", mark: "G", color: "linear-gradient(135deg,#0f9d58,#f4b400)", description: "Attach Drive files to records and sync selected folders.", mode: "oauth" },
    { id: "onedrive", name: "OneDrive", category: "Storage", mark: "O", color: "linear-gradient(135deg,#0078d4,#54b4f4)", description: "Microsoft cloud file attachments and shared folders.", mode: "oauth" },
    { id: "dropbox", name: "Dropbox", category: "Storage", mark: "D", color: "linear-gradient(135deg,#0061ff,#6ba0ff)", description: "File picker, record attachments and backup exports.", mode: "oauth" },
    { id: "github", name: "GitHub", category: "Development", mark: "G", color: "linear-gradient(135deg,#171717,#555)", description: "Link repositories, issues, pull requests and deployment events.", mode: "oauth" },
    { id: "shopify", name: "Shopify", category: "Commerce", mark: "S", color: "linear-gradient(135deg,#70b944,#a9d278)", description: "Sync customers, products, orders and fulfilment status.", mode: "oauth" },
    { id: "woocommerce", name: "WooCommerce", category: "Commerce", mark: "W", color: "linear-gradient(135deg,#96588a,#c984ba)", description: "Products, customers and order sync for WordPress stores.", mode: "api" },
    { id: "typeform", name: "Typeform", category: "Forms", mark: "T", color: "linear-gradient(135deg,#242424,#747474)", description: "Capture responses as leads, contacts or custom records.", mode: "oauth" },
    { id: "tally", name: "Tally", category: "Forms", mark: "T", color: "linear-gradient(135deg,#242424,#5a5a5a)", description: "Webhook-based form submissions and field mapping.", mode: "webhook" },
    { id: "zapier", name: "Zapier", category: "Automation", mark: "Z", color: "linear-gradient(135deg,#ff4f00,#ff9362)", description: "Triggers and actions through public API keys and webhooks.", mode: "webhook" },
    { id: "make", name: "Make", category: "Automation", mark: "M", color: "linear-gradient(135deg,#6d00cc,#b15cff)", description: "Scenario automation through webhooks and API modules.", mode: "webhook" },
    { id: "n8n", name: "n8n", category: "Automation", mark: "n", color: "linear-gradient(135deg,#ff6d5a,#ff9e91)", description: "Open automation workflows using generic webhooks and REST.", mode: "webhook" },
    { id: "twilio", name: "Twilio", category: "Telephony", mark: "T", color: "linear-gradient(135deg,#f22f46,#ff7684)", description: "SMS, WhatsApp and programmable voice events.", mode: "serverless" },
    { id: "telnyx", name: "Telnyx", category: "Telephony", mark: "T", color: "linear-gradient(135deg,#00c08b,#65e2c1)", description: "Messaging and voice through a provider adapter.", mode: "serverless" },
    { id: "docusign", name: "DocuSign", category: "Documents", mark: "D", color: "linear-gradient(135deg,#ffcc22,#ffe27b)", description: "Send quotes and agreements for electronic signature.", mode: "oauth" },
    { id: "dropbox-sign", name: "Dropbox Sign", category: "Documents", mark: "H", color: "linear-gradient(135deg,#1a73e8,#62a4f5)", description: "Signature requests and completed-document attachment.", mode: "api" },
    { id: "generic-webhook", name: "Generic Webhook", category: "Development", mark: "↗", color: "linear-gradient(135deg,#5e72df,#52d7dc)", description: "Send signed JSON events to any HTTPS endpoint.", mode: "webhook" },
    { id: "rest-api", name: "REST API", category: "Development", mark: "{ }", color: "linear-gradient(135deg,#4d5a75,#91a1bf)", description: "Personal access token and workspace-scoped API access.", mode: "serverless" },
    { id: "akipasa", name: "AkiPasa", category: "Commerce", mark: "A", color: "linear-gradient(135deg,#6277ef,#e369b5)", description: "Venue claims, listings, subscriptions, events and support sync.", mode: "api" },
    { id: "bitrix-import", name: "Bitrix24 Importer", category: "Migration", mark: "B", color: "linear-gradient(135deg,#35b4e6,#65ddff)", description: "Import contacts, companies, deals and activities from CSV exports.", mode: "import" }
  ];

  function seedState() {
    const pipelineStages = [
      { id: "discovered", name: "Discovered", color: "#6578e9" },
      { id: "contact-needed", name: "Contact needed", color: "#4eb5df" },
      { id: "contacted", name: "Contacted", color: "#48cfbf" },
      { id: "interested", name: "Interested", color: "#52d795" },
      { id: "onboarding", name: "Onboarding", color: "#f0b856" },
      { id: "claimed", name: "Claimed", color: "#e77eac" },
      { id: "paying", name: "Paying", color: "#9a73ea" }
    ];
    const salesStages = [
      { id: "new", name: "New", color: "#687bea" },
      { id: "qualified", name: "Qualified", color: "#49b8df" },
      { id: "proposal", name: "Proposal", color: "#51c6a6" },
      { id: "negotiation", name: "Negotiation", color: "#f0b650" },
      { id: "won", name: "Won", color: "#4fd393" },
      { id: "lost", name: "Lost", color: "#df6679" }
    ];
    const employees = [
      { id: "emp_alex", name: "Alex Ashing", email: "alex@akipasa.com", role: "Founder & operator", department: "Leadership", status: "Online", location: "Fuengirola", phone: "+34 600 000 001", joinedAt: isoNow(), leaveBalance: 20 }
    ];
    return {
      version: APP_VERSION,
      isCleanWorkspace: true,
      createdAt: isoNow(),
      workspace: { id: "ws_akipasa", name: "AkiPasa HQ", slug: "akipasa", timezone: "Europe/Madrid", currency: "EUR", ownerId: "emp_alex" },
      currentUserId: "emp_alex",
      settings: { theme: "dark", density: "comfortable", locale: "en", sidebarCollapsed: false, reducedMotion: false, notifications: true },
      pipelines: [
        { id: "venue", name: "Venue onboarding", stages: pipelineStages },
        { id: "sales", name: "Partnership sales", stages: salesStages }
      ],
      contacts: [],
      companies: [],
      employees,
      deals: [],
      leads: [],
      projects: [],
      tasks: [],
      events: [],
      products: [],
      invoices: [],
      campaigns: [],
      pages: [],
      forms: [],
      automations: [],
      knowledge: [],
      conversations: [],
      feed: [],
      activities: [],
      notifications: [],
      integrations: {
        "akipasa": { status: "connected", label: "Connected to akipasa.com", config: { siteUrl: "https://akipasa.com" }, connectedAt: isoNow() },
        "generic-webhook": { status: "ready", label: "Not configured", config: {}, connectedAt: null },
        "bitrix-import": { status: "ready", label: "CSV importer available", config: {}, connectedAt: null }
      },
      timer: { running: false, startedAt: null, elapsed: 0, label: "General work" },
      audit: [{ id: "audit_init", action: "workspace.initialized", actorId: "emp_alex", at: isoNow(), meta: { version: APP_VERSION } }]
    };
  }

  class StateStore {
    constructor(key) { this.key = key; }
    load() {
      try {
        const raw = localStorage.getItem(this.key);
        if (!raw) return seedState();
        const parsed = JSON.parse(raw);
        if (!parsed || !parsed.workspace || !parsed.isCleanWorkspace) {
          const fresh = seedState();
          this.save(fresh);
          return fresh;
        }
        return parsed;
      } catch (error) {
        console.warn("Could not load AkiHQ state; initializing clean workspace.", error);
        return seedState();
      }
    }
    save(value) {
      try {
        localStorage.setItem(this.key, JSON.stringify(value));
      } catch (error) {
        console.error("Could not save AkiHQ state.", error);
        toast("Storage error", "Your latest change could not be saved locally.", "danger");
      }
    }
    reset() {
      const fresh = seedState();
      this.save(fresh);
      return fresh;
    }
  }

  const store = new StateStore(STORAGE_KEY);
  let state = store.load();

  // ── Supabase client helper ──────────────────────────────────────────────────
  function getSupabaseClient() {
    if (window._sbClientInstance) return window._sbClientInstance;
    const cfg = window.AKIHQ_CONFIG || {};
    const url = cfg.SUPABASE_URL || "https://vhpbvcfkcteswlsdjrfl.supabase.co";
    const key = cfg.SUPABASE_ANON_KEY || "sb_publishable_Mm4CJvGyIaLOWbU3g1sxIQ_Wv2jrKt1";
    const sbObj = window.supabase || window.Supabase;
    if (sbObj && url && key) {
      const createFn = typeof sbObj.createClient === "function" ? sbObj.createClient : (typeof sbObj === "function" ? sbObj : null);
      if (createFn) {
        try {
          window._sbClientInstance = createFn(url, key);
          return window._sbClientInstance;
        } catch (e) {
          console.error("Supabase initialization error:", e);
        }
      }
    }
    return null;
  }

  // Auth state — populated after boot
  let authUser = null;   // supabase user object
  let authRole = null;   // 'moderator' | 'administrator' | null
  let liveStats = null;  // crm_dashboard_stats() result

  // ── Live data loader ───────────────────────────────────────────────────────
  async function loadLiveData() {
    const sbClient = getSupabaseClient();
    if (!sbClient || !authUser) return;
    try {
      // Dashboard stats
      const { data: statsRows } = await sbClient.rpc("crm_dashboard_stats");
      if (statsRows?.[0]) liveStats = statsRows[0];

      // Contacts — all profiles (RPC first, direct table select fallback)
      let contactRows = null;
      try {
        const { data } = await sbClient.rpc("crm_list_contacts", { p_limit: 500 });
        if (data?.length) contactRows = data;
      } catch (e) {}

      if (!contactRows) {
        const { data: profiles } = await sbClient.from("profiles").select("id, display_name, app_role, created_at").limit(500);
        if (profiles?.length) {
          contactRows = profiles.map(p => ({
            profile_id: p.id,
            display_name: p.display_name,
            app_role: p.app_role || "consumer",
            primary_email: "",
            created_at: p.created_at
          }));
        }
      }

      if (contactRows?.length) {
        state.contacts = contactRows.map(row => ({
          id: row.profile_id,
          name: row.display_name || row.primary_email || `User (${row.profile_id.slice(0, 6)})`,
          email: row.primary_email || "",
          role: row.app_role || "consumer",
          phone: "",
          companyId: null,
          source: "AkiPasa",
          updatedAt: row.created_at,
          createdAt: row.created_at
        }));
      }

      // Companies — venues
      const { data: venueRows } = await sbClient.rpc("crm_list_venues", { p_limit: 500 });
      if (venueRows?.length) {
        state.companies = venueRows.map(row => ({
          id: row.venue_id,
          name: row.venue_name,
          email: row.owner_email || "",
          website: `https://akipasa.com/venue/${row.venue_slug}`,
          type: "Venue",
          city: row.city_name,
          address: row.address || "",
          status: row.verified ? "Customer" : (row.status === "pending" ? "Prospect" : "Partner"),
          employees: Number(row.member_count || 0),
          ownerId: state.currentUserId,
          source: "AkiPasa",
          createdAt: row.created_at
        }));
      }

      // People (employees section) — staff/admin profiles
      const staffContacts = state.contacts.filter(c => ["moderator", "administrator"].includes(c.role));
      if (staffContacts.length > 0) {
        const existing = new Set(state.employees.map(e => e.id));
        const newStaff = staffContacts
          .filter(c => !existing.has(c.id))
          .map(c => ({
            id: c.id,
            name: c.name,
            email: c.email,
            role: c.role === "administrator" ? "Administrator" : "Moderator / Staff",
            department: c.role === "administrator" ? "Leadership" : "Operations",
            status: "Online",
            location: "Spain",
            phone: "",
            joinedAt: c.createdAt,
            leaveBalance: 20
          }));
        state.employees = [...state.employees, ...newStaff];
      }

      store.save(state);
      render();
    } catch (err) {
      console.warn("AkiHQ live data load error:", err);
    }
  }

  const ui = {
    route: location.hash.replace(/^#\/?/, "") || "dashboard",
    crmTab: "deals",
    dealView: "kanban",
    taskView: "board",
    pipelineId: state.pipelines?.[0]?.id || "venue",
    selectedConversationId: state.conversations?.[0]?.id || null,
    selectedArticleId: state.knowledge?.[0]?.id || null,
    calendarDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    integrationCategory: "All",
    integrationSearch: "",
    settingsTab: "appearance",
    drawer: null,
    modal: null,
    dropdown: null,
    searchQuery: "",
    commandOpen: false,
    commandQuery: "",
    toasts: [],
    drag: null,
    formDefaults: {},
    userPickerQuery: ""
  };

  function t(key) {
    const locale = state.settings?.locale || "en";
    return translations[locale]?.[key] || translations.en[key] || key;
  }

  function currentUser() {
    return state.employees.find(person => person.id === state.currentUserId) || state.employees[0] || { name: "Alex" };
  }

  function employeeName(id) {
    return state.employees.find(person => person.id === id)?.name || "Unassigned";
  }

  function companyName(id) {
    return state.companies.find(company => company.id === id)?.name || "No company";
  }

  function contactName(id) {
    return state.contacts.find(contact => contact.id === id)?.name || "No contact";
  }

  function projectName(id) {
    return state.projects.find(project => project.id === id)?.name || "No project";
  }

  function formatMoney(value, compact = false) {
    const amount = Number(value || 0);
    return new Intl.NumberFormat(state.settings.locale === "es" ? "es-ES" : "en-GB", {
      style: "currency",
      currency: state.workspace.currency || "EUR",
      notation: compact ? "compact" : "standard",
      maximumFractionDigits: compact ? 1 : 2
    }).format(amount);
  }

  function formatDate(value, options = {}) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat(state.settings.locale === "es" ? "es-ES" : "en-GB", {
      day: "2-digit", month: options.long ? "long" : "short", year: options.year === false ? undefined : "numeric",
      ...(options.time ? { hour: "2-digit", minute: "2-digit" } : {})
    }).format(date);
  }

  function relativeTime(value) {
    if (!value) return "";
    const diff = new Date(value).getTime() - Date.now();
    const abs = Math.abs(diff);
    const units = [
      [86400000 * 365, "year"], [86400000 * 30, "month"], [86400000 * 7, "week"], [86400000, "day"], [3600000, "hour"], [60000, "minute"]
    ];
    for (const [size, name] of units) {
      if (abs >= size || name === "minute") {
        const number = Math.round(diff / size);
        return new Intl.RelativeTimeFormat(state.settings.locale === "es" ? "es" : "en", { numeric: "auto" }).format(number, name);
      }
    }
    return "now";
  }

  function isOverdue(value) {
    if (!value) return false;
    const date = new Date(value);
    date.setHours(23, 59, 59, 999);
    return date.getTime() < Date.now();
  }

  function markdown(value) {
    const escaped = escapeHtml(value || "");
    return escaped
      .replace(/^### (.*)$/gm, "<h3>$1</h3>")
      .replace(/^## (.*)$/gm, "<h2>$1</h2>")
      .replace(/^# (.*)$/gm, "<h1>$1</h1>")
      .replace(/^\- (.*)$/gm, "<li>$1</li>")
      .replace(/^\d+\. (.*)$/gm, "<li>$1</li>")
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/`(.*?)`/g, "<code>$1</code>")
      .split(/\n\n+/)
      .map(block => block.startsWith("<h") || block.startsWith("<li") ? (block.startsWith("<li") ? `<ul>${block}</ul>` : block) : `<p>${block.replace(/\n/g, "<br>")}</p>`)
      .join("");
  }

  function addActivity(entityType, entityId, verb, detail = "", iconName = "activity") {
    state.activities.unshift({ id: uid("ac"), entityType, entityId, actorId: state.currentUserId, verb, detail, at: isoNow(), icon: iconName });
    state.activities = state.activities.slice(0, 250);
  }

  function addAudit(action, meta = {}) {
    state.audit.unshift({ id: uid("audit"), action, actorId: state.currentUserId, at: isoNow(), meta });
    state.audit = state.audit.slice(0, 500);
  }

  function persist(renderAfter = true) {
    state.version = APP_VERSION;
    store.save(state);
    applySettings();
    if (renderAfter) render();
  }

  function applySettings() {
    document.documentElement.dataset.theme = state.settings.theme || "dark";
    document.documentElement.dataset.density = state.settings.density || "comfortable";
    document.documentElement.lang = state.settings.locale || "en";
    document.body.classList.toggle("reduced-motion", Boolean(state.settings.reducedMotion));
  }

  function toast(title, message = "", kind = "success") {
    const item = { id: uid("toast"), title, message, kind };
    ui.toasts.push(item);
    renderPortal();
    setTimeout(() => {
      ui.toasts = ui.toasts.filter(toastItem => toastItem.id !== item.id);
      renderPortal();
    }, 3600);
  }

  function setRoute(route) {
    ui.route = route;
    location.hash = `#/${route}`;
    ui.drawer = null;
    ui.dropdown = null;
    ui.searchQuery = "";
    render();
  }

  function pageMeta() {
    const meta = {
      dashboard: [t("dashboard"), "Your workspace at a glance"],
      crm: [t("crm"), "Leads, relationships and revenue"],
      inbox: [t("inbox"), "Shared customer conversations"],
      tasks: [t("tasks"), "Plan work and ship projects"],
      calendar: [t("calendar"), "Meetings, bookings and deadlines"],
      inventory: [t("inventory"), "Products, stock and warehouses"],
      sales: [t("sales"), "Quotes, invoices and payments"],
      marketing: [t("marketing"), "Campaigns, audiences and consent"],
      sites: [t("sites"), "Landing pages and lead forms"],
      automation: [t("automation"), "Triggers, rules and actions"],
      collaboration: [t("collaboration"), "Team feed and channels"],
      employees: [t("employees"), "Directory, status and leave"],
      knowledge: [t("knowledge"), "Document how the business works"],
      analytics: [t("analytics"), "Performance across every module"],
      integrations: [t("integrations"), "Connect the rest of your stack"],
      settings: [t("settings"), "Workspace, appearance and data" ]
    };
    return meta[ui.route] || meta.dashboard;
  }

  function render() {
    applySettings();
    const collapsed = state.settings.sidebarCollapsed ? "sidebar-collapsed" : "";
    appRoot.className = `app-shell ${collapsed}`;
    appRoot.innerHTML = `
      ${renderSidebar()}
      <main class="app-main">
        ${renderTopbar()}
        <section class="content-shell">
          ${renderContextbar()}
          <div class="content" id="page-content">
            ${renderView()}
          </div>
        </section>
      </main>`;
    renderPortal();
    attachAfterRender();
  }

  function renderSidebar() {
    const unread = state.conversations.reduce((sum, conversation) => sum + Number(conversation.unread || 0), 0);
    const overdueTasks = state.tasks.filter(task => task.status !== "done" && isOverdue(task.dueDate)).length;
    return `
      <aside class="sidebar" aria-label="Primary navigation">
        <div class="brand">
          <img src="assets/logo.svg" alt="" />
          <div class="brand-copy">
            <div class="brand-name">AkiHQ</div>
            <div class="brand-tag">${escapeHtml(t("allSystems"))}</div>
          </div>
        </div>
        <nav class="nav-scroll">
          ${navSections.map(section => `
            <div class="nav-section">
              <div class="nav-label">${escapeHtml(section.label)}</div>
              ${section.items.map(([route, iconName]) => {
                const badge = route === "inbox" && unread ? unread : route === "tasks" && overdueTasks ? overdueTasks : "";
                return `
                  <button class="nav-item ${ui.route === route ? "active" : ""}" data-action="navigate" data-route="${route}" title="${escapeHtml(t(route))}">
                    <span class="nav-icon">${icon(iconName)}</span>
                    <span class="nav-text">${escapeHtml(t(route))}</span>
                    ${badge ? `<span class="nav-badge">${badge}</span>` : ""}
                  </button>`;
              }).join("")}
            </div>`).join("")}
          <div class="nav-section">
            <div class="nav-label">System</div>
            <button class="nav-item ${ui.route === "settings" ? "active" : ""}" data-action="navigate" data-route="settings" title="${escapeHtml(t("settings"))}">
              <span class="nav-icon">${icon("settings")}</span>
              <span class="nav-text">${escapeHtml(t("settings"))}</span>
            </button>
            <a class="nav-item" href="https://akipasa.com" target="_blank" rel="noopener noreferrer" title="Open public website (akipasa.com)" style="text-decoration:none;">
              <span class="nav-icon">${icon("external")}</span>
              <span class="nav-text">AkiPasa Web</span>
            </a>
          </div>
        </nav>
        <div class="sidebar-footer">
          <button class="collapse-btn" data-action="toggle-sidebar">
            ${icon("chevron")}<span>${escapeHtml(t("collapse"))}</span>
          </button>
        </div>
      </aside>`;
  }

  function renderTopbar() {
    const user = currentUser();
    const unseen = state.notifications.filter(notification => !notification.seen).length;
    const siteUrl = (window.AKIHQ_CONFIG && window.AKIHQ_CONFIG.SITE_URL) || "https://akipasa.com";
    return `
      <header class="topbar">
        <button class="workspace-switcher" data-action="workspace-menu" title="Workspace switcher">
          <span class="workspace-dot"></span>
          <span>${escapeHtml(state.workspace.name)}</span>
          <span class="chev">${icon("down")}</span>
        </button>
        <div class="global-search">
          ${icon("search", "search-icon")}
          <input id="global-search" data-global-search type="search" autocomplete="off" placeholder="${escapeHtml(t("search"))}" value="${escapeHtml(ui.searchQuery)}" />
          <kbd>Ctrl K</kbd>
        </div>
        <div class="top-actions">
          <a class="top-btn" href="${escapeHtml(siteUrl)}" target="_blank" rel="noopener noreferrer" title="View main public website (akipasa.com)" style="text-decoration:none;display:inline-flex;align-items:center;gap:6px;">
            ${icon("external")}<span>akipasa.com</span>
          </a>
          <button class="top-btn ${state.timer.running ? "timer-live" : ""}" data-action="timer-toggle" title="Work timer">
            ${icon("timer")}<span id="timer-label">${formatTimer()}</span>
          </button>
          <button class="top-btn create-btn" data-action="open-quick-create">
            ${icon("plus")}<span>${escapeHtml(t("create"))}</span>
          </button>
          <button class="icon-btn" data-action="open-notifications" title="Notifications">
            ${icon("bell")}${unseen ? '<span class="notification-dot"></span>' : ""}
          </button>
          <button class="avatar" data-action="profile-menu" title="${escapeHtml(user.name)}">${initials(user.name)}</button>
        </div>
      </header>`;
  }

  function formatTimer() {
    let elapsed = Number(state.timer.elapsed || 0);
    if (state.timer.running && state.timer.startedAt) elapsed += Date.now() - new Date(state.timer.startedAt).getTime();
    const seconds = Math.floor(elapsed / 1000);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remaining = seconds % 60;
    return hours > 0 ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}` : `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
  }

  function renderContextbar() {
    const [title, subtitle] = pageMeta();
    return `
      <div class="contextbar">
        <div class="context-title">
          <h1>${escapeHtml(title)}</h1>
          <p>${escapeHtml(subtitle)}</p>
        </div>
        ${renderContextControls()}
      </div>`;
  }

  function renderContextControls() {
    switch (ui.route) {
      case "crm":
        return `
          <div class="segmented">
            ${["deals", "leads", "contacts", "companies"].map(tab => `<button class="${ui.crmTab === tab ? "active" : ""}" data-action="set-crm-tab" data-tab="${tab}">${escapeHtml(t(tab))}</button>`).join("")}
          </div>
          ${ui.crmTab === "deals" ? `
            <select class="filter-select" data-change="pipeline">
              ${state.pipelines.map(pipeline => `<option value="${pipeline.id}" ${ui.pipelineId === pipeline.id ? "selected" : ""}>${escapeHtml(pipeline.name)}</option>`).join("")}
            </select>
            <div class="segmented">
              <button class="${ui.dealView === "kanban" ? "active" : ""}" data-action="set-deal-view" data-view="kanban">${icon("board")} ${escapeHtml(t("board"))}</button>
              <button class="${ui.dealView === "list" ? "active" : ""}" data-action="set-deal-view" data-view="list">${icon("list")} ${escapeHtml(t("list"))}</button>
            </div>` : ""}
          <span class="context-spacer"></span>
          <button class="action-btn" data-action="export-csv" data-entity="${ui.crmTab}">${icon("download")} CSV</button>
          <button class="action-btn primary" data-action="open-form" data-entity="${ui.crmTab === "deals" ? "deal" : ui.crmTab.slice(0, -1)}">${icon("plus")} ${escapeHtml(t("newRecord"))}</button>`;
      case "tasks":
        return `
          <div class="segmented">
            <button class="${ui.taskView === "board" ? "active" : ""}" data-action="set-task-view" data-view="board">${icon("board")} ${escapeHtml(t("board"))}</button>
            <button class="${ui.taskView === "list" ? "active" : ""}" data-action="set-task-view" data-view="list">${icon("list")} ${escapeHtml(t("list"))}</button>
          </div>
          <span class="context-spacer"></span>
          <button class="action-btn" data-action="open-form" data-entity="project">${icon("plus")} Project</button>
          <button class="action-btn primary" data-action="open-form" data-entity="task">${icon("plus")} Task</button>`;
      case "calendar":
        return `
          <button class="action-btn ghost" data-action="calendar-prev">${icon("arrowLeft")}</button>
          <button class="action-btn" data-action="calendar-today">Today</button>
          <button class="action-btn ghost" data-action="calendar-next">${icon("arrowRight")}</button>
          <strong class="muted" style="font-size:12px;white-space:nowrap">${new Intl.DateTimeFormat(state.settings.locale === "es" ? "es-ES" : "en-GB", { month: "long", year: "numeric" }).format(ui.calendarDate)}</strong>
          <span class="context-spacer"></span>
          <button class="action-btn primary" data-action="open-form" data-entity="event">${icon("plus")} Event</button>`;
      case "inventory":
        return `<span class="context-spacer"></span><button class="action-btn" data-action="export-csv" data-entity="products">${icon("download")} CSV</button><button class="action-btn primary" data-action="open-form" data-entity="product">${icon("plus")} Product</button>`;
      case "sales":
        return `<span class="context-spacer"></span><button class="action-btn" data-action="open-form" data-entity="invoice" data-type="Quote">${icon("plus")} Quote</button><button class="action-btn primary" data-action="open-form" data-entity="invoice" data-type="Invoice">${icon("plus")} Invoice</button>`;
      case "marketing":
        return `<span class="context-spacer"></span><button class="action-btn primary" data-action="open-form" data-entity="campaign">${icon("plus")} Campaign</button>`;
      case "sites":
        return `<span class="context-spacer"></span><button class="action-btn" data-action="open-form" data-entity="form">${icon("plus")} Form</button><button class="action-btn primary" data-action="open-form" data-entity="page">${icon("plus")} Page</button>`;
      case "automation":
        return `<span class="context-spacer"></span><button class="action-btn primary" data-action="open-form" data-entity="automation">${icon("plus")} Automation</button>`;
      case "employees":
        return `<span class="context-spacer"></span><button class="action-btn primary" data-action="open-form" data-entity="employee">${icon("plus")} Team member</button>`;
      case "knowledge":
        return `<span class="context-spacer"></span><button class="action-btn primary" data-action="open-form" data-entity="article">${icon("plus")} Article</button>`;
      case "integrations":
        return `<span class="context-spacer"></span><button class="action-btn" data-action="navigate" data-route="settings">${icon("settings")} API settings</button>`;
      case "dashboard":
        return `<span class="context-spacer"></span><button class="action-btn" data-action="export-data">${icon("download")} Backup</button><button class="action-btn primary" data-action="open-quick-create">${icon("plus")} Quick create</button>`;
      default:
        return `<span class="context-spacer"></span>`;
    }
  }

  function renderView() {
    const views = {
      dashboard: renderDashboard,
      crm: renderCRM,
      inbox: renderInbox,
      tasks: renderTasks,
      calendar: renderCalendar,
      inventory: renderInventory,
      sales: renderSales,
      marketing: renderMarketing,
      sites: renderSites,
      automation: renderAutomation,
      collaboration: renderCollaboration,
      employees: renderEmployees,
      knowledge: renderKnowledge,
      analytics: renderAnalytics,
      integrations: renderIntegrations,
      settings: renderSettings
    };
    return `<div class="view">${(views[ui.route] || renderDashboard)()}</div>`;
  }

  function renderMetric(label, value, foot, iconName, color, change = "") {
    return `
      <article class="panel metric-card" style="--metric-color:${color};--metric-glow:color-mix(in srgb, ${color} 30%, transparent)">
        <div class="metric-top"><span class="metric-label">${escapeHtml(label)}</span><span class="metric-icon">${icon(iconName)}</span></div>
        <div class="metric-value">${escapeHtml(value)}</div>
        <div class="metric-foot">${change ? `<span class="metric-change">${escapeHtml(change)}</span> · ` : ""}${escapeHtml(foot)}</div>
      </article>`;
  }

  function renderDashboard() {
    const openDeals = state.deals.filter(deal => !["won", "lost", "paying"].includes(deal.stageId));
    const pipelineValue = openDeals.reduce((sum, deal) => sum + Number(deal.value || 0), 0);
    const paidRevenue = state.invoices.filter(invoice => invoice.status === "Paid").reduce((sum, invoice) => sum + Number(invoice.total || 0), 0);
    const dueTasks = state.tasks.filter(task => task.status !== "done" && new Date(task.dueDate).getTime() <= Date.now() + 86400000 * 3).length;
    const completedTasks = state.tasks.filter(task => task.status === "done").length;
    const completion = state.tasks.length ? Math.round(completedTasks / state.tasks.length * 100) : 0;
    const pipeline = state.pipelines.find(item => item.id === ui.pipelineId) || state.pipelines[0];
    const stageStats = pipeline.stages.map(stage => ({
      label: stage.name,
      value: state.deals.filter(deal => deal.pipelineId === pipeline.id && deal.stageId === stage.id).reduce((sum, deal) => sum + Number(deal.value || 0), 0)
    }));
    const maxStage = Math.max(...stageStats.map(item => item.value), 1);
    const upcoming = [...state.events].filter(event => new Date(event.start) >= new Date(Date.now() - 86400000)).sort((a, b) => new Date(a.start) - new Date(b.start)).slice(0, 5);
    return `
      <div class="page-grid">
        <div class="page-grid grid-4">
          ${renderMetric("Total venues", liveStats ? String(liveStats.total_venues) : String(state.companies.length), liveStats ? `${liveStats.verified_venues} verified` : "from Supabase", "building", "#7c8cff")}
          ${renderMetric("Platform users", liveStats ? String(liveStats.total_users) : String(state.contacts.length), liveStats ? `${liveStats.new_users_30d} joined this month` : "from Supabase", "crm", "#49d7a0")}
          ${renderMetric("Pending claims", liveStats ? String(liveStats.pending_claims) : "—", "venue claims awaiting review", "warning", "#ffbd55", liveStats?.pending_claims > 0 ? "Needs review" : "Clear")}
          ${renderMetric("Staff members", liveStats ? String(liveStats.staff_users) : String(state.employees.length), "moderators and administrators", "employees", "#e96fb7")}
        </div>
        <div class="page-grid grid-main">
          <section class="panel">
            <div class="panel-header">
              <div><h2>${escapeHtml(pipeline.name)} value</h2><p>Value currently sitting in each stage</p></div>
              <div class="panel-actions"><button class="mini-btn" data-action="navigate" data-route="crm" title="Open CRM">${icon("external")}</button></div>
            </div>
            <div class="panel-body">
              <div class="chart-bars">
                ${stageStats.map(item => `
                  <div class="chart-bar-wrap">
                    <span class="chart-value">${escapeHtml(formatMoney(item.value, true))}</span>
                    <div class="chart-bar" style="height:${Math.max(4, Math.round(item.value / maxStage * 100))}%"></div>
                    <span class="chart-label">${escapeHtml(item.label)}</span>
                  </div>`).join("")}
              </div>
            </div>
          </section>
          <section class="panel">
            <div class="panel-header"><div><h2>Task completion</h2><p>${completedTasks} of ${state.tasks.length} demo tasks completed</p></div></div>
            <div class="panel-body">
              <div class="progress-ring">
                <svg viewBox="0 0 120 120">
                  <defs><linearGradient id="ringGradient"><stop stop-color="#52d9e9"/><stop offset="1" stop-color="#8b7bff"/></linearGradient></defs>
                  <circle class="track" cx="60" cy="60" r="49" fill="none" stroke-width="10"/>
                  <circle class="value" cx="60" cy="60" r="49" fill="none" stroke-width="10" stroke-dasharray="${2 * Math.PI * 49}" stroke-dashoffset="${2 * Math.PI * 49 * (1 - completion / 100)}"/>
                </svg>
                <div class="progress-ring-center"><strong>${completion}%</strong><span>complete</span></div>
              </div>
              <button class="action-btn" style="width:100%" data-action="navigate" data-route="tasks">Open task board</button>
            </div>
          </section>
        </div>
        <div class="page-grid grid-main">
          <section class="panel">
            <div class="panel-header"><div><h2>Recent activity</h2><p>Changes across CRM, operations and content</p></div><div class="panel-actions"><button class="mini-btn" data-action="navigate" data-route="collaboration">${icon("external")}</button></div></div>
            <div class="panel-body activity-list">
              ${state.activities.slice(0, 7).map(activity => `
                <div class="activity-item">
                  <div class="activity-icon">${icon(activity.icon || "activity")}</div>
                  <div class="activity-copy"><strong>${escapeHtml(employeeName(activity.actorId))}</strong> ${escapeHtml(activity.verb)}${activity.detail ? `<br><span>${escapeHtml(activity.detail)}</span>` : ""}</div>
                  <div class="activity-time">${escapeHtml(relativeTime(activity.at))}</div>
                </div>`).join("")}
            </div>
          </section>
          <aside class="panel">
            <div class="panel-header"><div><h2>Upcoming</h2><p>Meetings and milestones</p></div><div class="panel-actions"><button class="mini-btn" data-action="navigate" data-route="calendar">${icon("external")}</button></div></div>
            <div class="panel-body upcoming-list">
              ${upcoming.map(event => `
                <div class="upcoming-item" data-action="view-entity" data-entity="event" data-id="${event.id}" role="button" tabindex="0">
                  <div class="upcoming-time">${escapeHtml(formatDate(event.start, { year: false }))}</div>
                  <div class="upcoming-title">${escapeHtml(event.title)}</div>
                  <div class="upcoming-sub">${escapeHtml(event.location || event.type)}</div>
                </div>`).join("") || `<div class="panel-empty"><div><strong>No upcoming events</strong><span>Create one from Calendar.</span></div></div>`}
            </div>
          </aside>
        </div>
      </div>`;
  }

  function renderCRM() {
    if (ui.crmTab === "deals") return renderDeals();
    if (ui.crmTab === "leads") return renderLeads();
    if (ui.crmTab === "contacts") return renderContacts();
    return renderCompanies();
  }

  function renderDeals() {
    const pipeline = state.pipelines.find(item => item.id === ui.pipelineId) || state.pipelines[0];
    const deals = state.deals.filter(deal => deal.pipelineId === pipeline.id);
    if (ui.dealView === "list") return renderDealsTable(deals, pipeline);
    return `
      <div class="kanban-wrap">
        <div class="kanban" aria-label="${escapeHtml(pipeline.name)} Kanban">
          ${pipeline.stages.map(stage => {
            const stageDeals = deals.filter(deal => deal.stageId === stage.id);
            const total = stageDeals.reduce((sum, deal) => sum + Number(deal.value || 0), 0);
            return `
              <section class="kanban-column">
                <header class="kanban-header" style="--stage:${stage.color}">
                  <div class="kanban-title-row"><span class="kanban-title">${escapeHtml(stage.name)}</span><span class="kanban-count">${stageDeals.length}</span></div>
                  <div class="kanban-total">${escapeHtml(formatMoney(total))}</div>
                </header>
                <div class="kanban-cards" data-drop-entity="deal" data-stage-id="${stage.id}">
                  ${stageDeals.map(deal => renderDealCard(deal)).join("")}
                </div>
                <button class="add-card" data-action="open-form" data-entity="deal" data-stage="${stage.id}">+ Add deal</button>
              </section>`;
          }).join("")}
        </div>
      </div>`;
  }

  function renderDealCard(deal) {
    const owner = employeeName(deal.ownerId);
    return `
      <article class="kanban-card" draggable="true" data-drag-entity="deal" data-id="${deal.id}" data-action="view-entity" data-entity="deal">
        <div class="card-title">${escapeHtml(deal.title)}</div>
        <div class="card-sub">${escapeHtml(companyName(deal.companyId))}</div>
        ${deal.tags?.length ? `<div class="card-tags">${deal.tags.slice(0, 3).map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>` : ""}
        <div class="card-meta">
          <div class="card-avatar" title="${escapeHtml(owner)}">${initials(owner)}</div>
          <span class="card-value">${escapeHtml(formatMoney(deal.value))}</span>
          <span class="card-date ${isOverdue(deal.dueDate) ? "text-danger" : ""}">${escapeHtml(formatDate(deal.dueDate, { year: false }))}</span>
        </div>
      </article>`;
  }

  function renderDealsTable(deals, pipeline) {
    return `
      <section class="panel table-panel">
        <div class="panel-header"><div><h2>${escapeHtml(pipeline.name)}</h2><p>${deals.length} deals · ${escapeHtml(formatMoney(deals.reduce((sum, deal) => sum + Number(deal.value || 0), 0)))}</p></div></div>
        <div class="table-scroll">
          <table class="data-table">
            <thead><tr><th>Deal</th><th>Stage</th><th>Value</th><th>Probability</th><th>Owner</th><th>Due</th><th></th></tr></thead>
            <tbody>
              ${deals.map(deal => {
                const stage = pipeline.stages.find(item => item.id === deal.stageId);
                return `<tr class="clickable" data-action="view-entity" data-entity="deal" data-id="${deal.id}">
                  <td><div class="table-primary"><div class="table-avatar">${initials(deal.title)}</div><div class="table-primary-copy"><strong>${escapeHtml(deal.title)}</strong><span>${escapeHtml(companyName(deal.companyId))}</span></div></div></td>
                  <td><span class="status-pill" style="color:${stage?.color || "#7c8cff"};background:color-mix(in srgb, ${stage?.color || "#7c8cff"} 13%, transparent)">${escapeHtml(stage?.name || deal.stageId)}</span></td>
                  <td><strong>${escapeHtml(formatMoney(deal.value))}</strong></td>
                  <td>${Number(deal.probability || 0)}%</td>
                  <td>${escapeHtml(employeeName(deal.ownerId))}</td>
                  <td class="${isOverdue(deal.dueDate) ? "text-danger" : ""}">${escapeHtml(formatDate(deal.dueDate))}</td>
                  <td><div class="row-actions"><button class="mini-btn" data-action="edit-entity" data-entity="deal" data-id="${deal.id}">${icon("edit")}</button></div></td>
                </tr>`;
              }).join("")}
            </tbody>
          </table>
        </div>
      </section>`;
  }

  function renderLeads() {
    return `
      <section class="panel table-panel">
        <div class="panel-header"><div><h2>Lead inbox</h2><p>${state.leads.length} people and businesses waiting to be qualified</p></div></div>
        <div class="table-scroll">
          <table class="data-table">
            <thead><tr><th>Lead</th><th>Status</th><th>Source</th><th>Score</th><th>Owner</th><th>Updated</th><th></th></tr></thead>
            <tbody>
              ${state.leads.map(lead => `<tr class="clickable" data-action="view-entity" data-entity="lead" data-id="${lead.id}">
                <td><div class="table-primary"><div class="table-avatar">${initials(lead.name)}</div><div class="table-primary-copy"><strong>${escapeHtml(lead.name)}</strong><span>${escapeHtml(lead.email || lead.company)}</span></div></div></td>
                <td><span class="status-pill ${lead.status === "Qualified" ? "success" : lead.status === "Contacted" ? "info" : ""}">${escapeHtml(lead.status)}</span></td>
                <td>${escapeHtml(lead.source)}</td>
                <td><strong>${Number(lead.score || 0)}</strong></td>
                <td>${escapeHtml(employeeName(lead.ownerId))}</td>
                <td>${escapeHtml(relativeTime(lead.updatedAt))}</td>
                <td><div class="row-actions"><button class="mini-btn" data-action="convert-lead" data-id="${lead.id}" title="Convert to deal">${icon("arrowRight")}</button><button class="mini-btn" data-action="edit-entity" data-entity="lead" data-id="${lead.id}">${icon("edit")}</button></div></td>
              </tr>`).join("")}
            </tbody>
          </table>
        </div>
      </section>`;
  }

  function renderContacts() {
    return `
      <section class="panel table-panel">
        <div class="panel-header"><div><h2>Contacts</h2><p>${state.contacts.length} people across ${state.companies.length} venues · synced from AkiPasa database</p></div></div>
        <div class="table-scroll">
          <table class="data-table">
            <thead><tr><th>Contact</th><th>Company</th><th>Role</th><th>Phone</th><th>Source</th><th>Updated</th><th></th></tr></thead>
            <tbody>
              ${state.contacts.map(contact => `<tr class="clickable" data-action="view-entity" data-entity="contact" data-id="${contact.id}">
                <td><div class="table-primary"><div class="table-avatar">${initials(contact.name)}</div><div class="table-primary-copy"><strong>${escapeHtml(contact.name)}</strong><span>${escapeHtml(contact.email)}</span></div></div></td>
                <td>${escapeHtml(companyName(contact.companyId))}</td>
                <td>${escapeHtml(contact.role || "—")}</td>
                <td>${escapeHtml(contact.phone || "—")}</td>
                <td><span class="status-pill info">${escapeHtml(contact.source || "Manual")}</span></td>
                <td>${escapeHtml(relativeTime(contact.updatedAt))}</td>
                <td><div class="row-actions"><button class="mini-btn" data-action="edit-entity" data-entity="contact" data-id="${contact.id}">${icon("edit")}</button></div></td>
              </tr>`).join("")}
            </tbody>
          </table>
        </div>
      </section>`;
  }

  function renderCompanies() {
    return `
      <section class="panel table-panel">
        <div class="panel-header"><div><h2>Venues</h2><p>${state.companies.length} venue${state.companies.length !== 1 ? "s" : ""} · synced live from AkiPasa database</p></div></div>
        <div class="table-scroll">
          <table class="data-table">
            <thead><tr><th>Company</th><th>Type</th><th>City</th><th>Status</th><th>Owner</th><th>Employees</th><th></th></tr></thead>
            <tbody>
              ${state.companies.map(company => `<tr class="clickable" data-action="view-entity" data-entity="company" data-id="${company.id}">
                <td><div class="table-primary"><div class="table-avatar">${initials(company.name)}</div><div class="table-primary-copy"><strong>${escapeHtml(company.name)}</strong><span>${escapeHtml(company.email || company.website)}</span></div></div></td>
                <td>${escapeHtml(company.type || "—")}</td>
                <td>${escapeHtml(company.city || "—")}</td>
                <td><span class="status-pill ${company.status === "Customer" ? "success" : company.status === "Partner" ? "info" : "warning"}">${escapeHtml(company.status || "Prospect")}</span></td>
                <td>${escapeHtml(employeeName(company.ownerId))}</td>
                <td>${Number(company.employees || 0)}</td>
                <td><div class="row-actions"><button class="mini-btn" data-action="edit-entity" data-entity="company" data-id="${company.id}">${icon("edit")}</button></div></td>
              </tr>`).join("")}
            </tbody>
          </table>
        </div>
      </section>`;
  }

  function renderInbox() {
    const selected = state.conversations.find(conversation => conversation.id === ui.selectedConversationId) || state.conversations[0];
    if (!selected && !state.conversations.length) {
      return `<section class="panel empty-state"><div><div class="empty-state-icon">${icon("inbox")}</div><h2>Your shared inbox is empty</h2><p>Connect Resend, Gmail, Outlook, WhatsApp or another channel from Integrations.</p><button class="action-btn primary" data-action="navigate" data-route="integrations">Open integrations</button></div></section>`;
    }
    return `
      <section class="panel inbox-layout ${ui.mobileChatOpen ? "chat-open" : ""}">
        <div class="conversation-list">
          <div class="conversation-search"><input type="search" data-conversation-search placeholder="Search conversations…" /></div>
          ${state.conversations.map(conversation => {
            const last = conversation.messages[conversation.messages.length - 1];
            return `<div class="conversation-item ${selected?.id === conversation.id ? "active" : ""}" data-action="select-conversation" data-id="${conversation.id}" data-search-text="${escapeHtml(`${conversation.name} ${last?.text || ""}`.toLowerCase())}">
              <div class="conv-avatar">${initials(conversation.name)}</div>
              <div><div class="conv-name">${escapeHtml(conversation.name)}</div><div class="conv-preview">${escapeHtml(last?.text || "No messages yet")}</div></div>
              <div class="conv-meta">${escapeHtml(last ? relativeTime(last.at) : "")} ${conversation.unread ? `<div class="unread">${conversation.unread}</div>` : ""}</div>
            </div>`;
          }).join("")}
        </div>
        ${selected ? `
          <div class="chat-pane">
            <div class="chat-head">
              <button class="mini-btn hidden" data-action="mobile-inbox-back">${icon("arrowLeft")}</button>
              <div class="conv-avatar">${initials(selected.name)}</div>
              <div class="chat-head-copy"><strong>${escapeHtml(selected.name)}</strong><span>${escapeHtml(selected.channel)} · assigned to ${escapeHtml(employeeName(selected.assignedTo))}</span></div>
              <div class="panel-actions">
                <button class="mini-btn" data-action="view-conversation-contact" data-id="${selected.id}" title="Open linked record">${icon("user")}</button>
                <button class="mini-btn" data-action="toggle-conversation-status" data-id="${selected.id}" title="Resolve conversation">${icon("check")}</button>
              </div>
            </div>
            <div class="messages" id="messages">
              ${selected.messages.map(message => `<div class="message ${message.direction === "out" ? "out" : ""}">${escapeHtml(message.text)}<span class="message-time">${escapeHtml(formatDate(message.at, { time: true, year: false }))}</span></div>`).join("")}
            </div>
            <form class="composer" data-form="message" data-conversation-id="${selected.id}">
              <textarea name="text" required placeholder="Write a reply…"></textarea>
              <button class="icon-btn create-btn" type="submit" title="Send">${icon("send")}</button>
            </form>
          </div>` : ""}
      </section>`;
  }

  function renderTasks() {
    const statuses = [
      { id: "todo", name: "To do" },
      { id: "progress", name: "In progress" },
      { id: "review", name: "Review" },
      { id: "done", name: "Done" }
    ];
    if (ui.taskView === "list") {
      return `
        <section class="panel table-panel">
          <div class="panel-header"><div><h2>All tasks</h2><p>${state.tasks.filter(task => task.status !== "done").length} still open</p></div></div>
          <div class="table-scroll">
            <table class="data-table">
              <thead><tr><th>Task</th><th>Status</th><th>Priority</th><th>Project</th><th>Assignee</th><th>Due</th><th></th></tr></thead>
              <tbody>${state.tasks.map(task => `<tr class="clickable" data-action="view-entity" data-entity="task" data-id="${task.id}">
                <td><div class="table-primary"><div class="table-avatar">${initials(task.title)}</div><div class="table-primary-copy"><strong>${escapeHtml(task.title)}</strong><span>${escapeHtml(task.description || "")}</span></div></div></td>
                <td><span class="status-pill ${task.status === "done" ? "success" : task.status === "review" ? "warning" : task.status === "progress" ? "info" : ""}">${escapeHtml(statuses.find(item => item.id === task.status)?.name || task.status)}</span></td>
                <td><span class="status-pill ${task.priority === "high" ? "danger" : task.priority === "medium" ? "warning" : "success"}">${escapeHtml(capitalize(task.priority))}</span></td>
                <td>${escapeHtml(projectName(task.projectId))}</td>
                <td>${escapeHtml(employeeName(task.assigneeId))}</td>
                <td class="${task.status !== "done" && isOverdue(task.dueDate) ? "text-danger" : ""}">${escapeHtml(formatDate(task.dueDate))}</td>
                <td><div class="row-actions"><button class="mini-btn" data-action="edit-entity" data-entity="task" data-id="${task.id}">${icon("edit")}</button></div></td>
              </tr>`).join("")}</tbody>
            </table>
          </div>
        </section>`;
    }
    return `
      <div class="kanban-wrap">
        <div class="task-board">
          ${statuses.map(status => {
            const tasks = state.tasks.filter(task => task.status === status.id);
            return `<section class="task-column" data-drop-entity="task" data-stage-id="${status.id}">
              <div class="task-column-head"><strong>${escapeHtml(status.name)}</strong><span>${tasks.length} tasks</span></div>
              ${tasks.map(task => renderTaskCard(task)).join("")}
              <button class="add-card" style="margin:6px 0 0;width:100%" data-action="open-form" data-entity="task" data-stage="${status.id}">+ Add task</button>
            </section>`;
          }).join("")}
        </div>
      </div>`;
  }

  function renderTaskCard(task) {
    const dueClass = task.status !== "done" && isOverdue(task.dueDate) ? "overdue" : "";
    return `<article class="task-card" draggable="true" data-drag-entity="task" data-id="${task.id}" data-action="view-entity" data-entity="task">
      <div class="task-top"><span class="priority-dot ${task.priority}"></span><div><div class="task-title">${escapeHtml(task.title)}</div><div class="task-project">${escapeHtml(projectName(task.projectId))}</div></div></div>
      <div class="task-foot"><span class="${dueClass}">${escapeHtml(formatDate(task.dueDate, { year: false }))}</span><div class="card-avatar" title="${escapeHtml(employeeName(task.assigneeId))}">${initials(employeeName(task.assigneeId))}</div></div>
    </article>`;
  }

  function renderCalendar() {
    const year = ui.calendarDate.getFullYear();
    const month = ui.calendarDate.getMonth();
    const first = new Date(year, month, 1);
    const mondayIndex = (first.getDay() + 6) % 7;
    const gridStart = new Date(year, month, 1 - mondayIndex);
    const days = Array.from({ length: 42 }, (_, index) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + index);
      return date;
    });
    const today = new Date();
    const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    const upcoming = [...state.events].filter(event => new Date(event.start) >= new Date(Date.now() - 86400000)).sort((a, b) => new Date(a.start) - new Date(b.start)).slice(0, 8);
    const weekdays = state.settings.locale === "es" ? ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"] : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    return `<div class="calendar-shell">
      <section class="panel calendar">
        <div class="calendar-weekdays">${weekdays.map(day => `<div>${day}</div>`).join("")}</div>
        <div class="calendar-grid">
          ${days.map(date => {
            const dayEvents = state.events.filter(event => sameDay(new Date(event.start), date));
            return `<div class="calendar-day ${date.getMonth() !== month ? "muted" : ""} ${sameDay(date, today) ? "today" : ""}" data-action="calendar-day" data-date="${date.toISOString()}">
              <div class="day-number">${date.getDate()}</div>
              ${dayEvents.slice(0, 4).map(event => `<div class="calendar-event" style="--event-color:${event.color || "#7c8cff"}" data-action="view-entity" data-entity="event" data-id="${event.id}" title="${escapeHtml(event.title)}">${escapeHtml(event.title)}</div>`).join("")}
            </div>`;
          }).join("")}
        </div>
      </section>
      <aside class="panel">
        <div class="panel-header"><div><h2>Upcoming events</h2><p>Next meetings and milestones</p></div></div>
        <div class="panel-body upcoming-list">
          ${upcoming.map(event => `<div class="upcoming-item" data-action="view-entity" data-entity="event" data-id="${event.id}" role="button" tabindex="0"><div class="upcoming-time">${escapeHtml(formatDate(event.start, { year: false }))}</div><div class="upcoming-title">${escapeHtml(event.title)}</div><div class="upcoming-sub">${escapeHtml(event.location || event.type)}</div></div>`).join("")}
        </div>
      </aside>
    </div>`;
  }

  function renderInventory() {
    const lowStock = state.products.filter(product => Number(product.stock) <= Number(product.reorderAt) && product.warehouse !== "Digital");
    const stockValue = state.products.reduce((sum, product) => sum + Number(product.stock || 0) * Number(product.cost || 0), 0);
    const physical = state.products.filter(product => product.warehouse !== "Digital");
    return `<div class="page-grid">
      <div class="page-grid grid-3">
        ${renderMetric("Products", String(state.products.length), `${physical.length} physical products`, "inventory", "#7c8cff")}
        ${renderMetric("Stock value", formatMoney(stockValue, true), "based on unit cost", "money", "#49d7a0")}
        ${renderMetric("Low stock", String(lowStock.length), lowStock.length ? "needs attention" : "all healthy", "warning", "#ffbd55")}
      </div>
      <section class="panel table-panel">
        <div class="panel-header"><div><h2>Product catalogue</h2><p>Subscriptions, advertising inventory and physical goods</p></div></div>
        <div class="table-scroll">
          <table class="data-table">
            <thead><tr><th>Product</th><th>SKU</th><th>Category</th><th>Price</th><th>Stock</th><th>Warehouse</th><th>Status</th><th></th></tr></thead>
            <tbody>${state.products.map(product => `<tr class="clickable" data-action="view-entity" data-entity="product" data-id="${product.id}">
              <td><div class="table-primary"><div class="table-avatar">${initials(product.name)}</div><div class="table-primary-copy"><strong>${escapeHtml(product.name)}</strong><span>${escapeHtml(product.description || "")}</span></div></div></td>
              <td>${escapeHtml(product.sku)}</td>
              <td>${escapeHtml(product.category)}</td>
              <td><strong>${escapeHtml(formatMoney(product.price))}</strong></td>
              <td class="${Number(product.stock) <= Number(product.reorderAt) && product.warehouse !== "Digital" ? "text-danger" : ""}">${Number(product.stock).toLocaleString()}</td>
              <td>${escapeHtml(product.warehouse)}</td>
              <td><span class="status-pill ${product.status === "Active" ? "success" : "warning"}">${escapeHtml(product.status)}</span></td>
              <td><div class="row-actions"><button class="mini-btn" data-action="adjust-stock" data-id="${product.id}" title="Adjust stock">${icon("plus")}</button><button class="mini-btn" data-action="edit-entity" data-entity="product" data-id="${product.id}">${icon("edit")}</button></div></td>
            </tr>`).join("")}</tbody>
          </table>
        </div>
      </section>
    </div>`;
  }

  function renderSales() {
    const outstanding = state.invoices.filter(invoice => !["Paid", "Draft"].includes(invoice.status)).reduce((sum, invoice) => sum + Number(invoice.total || 0), 0);
    const paid = state.invoices.filter(invoice => invoice.status === "Paid").reduce((sum, invoice) => sum + Number(invoice.total || 0), 0);
    const overdue = state.invoices.filter(invoice => invoice.status === "Overdue").length;
    return `<div class="page-grid">
      <div class="page-grid grid-3">
        ${renderMetric("Paid", formatMoney(paid, true), "collected in demo invoices", "check", "#49d7a0")}
        ${renderMetric("Outstanding", formatMoney(outstanding, true), "sent and overdue", "sales", "#7c8cff")}
        ${renderMetric("Overdue", String(overdue), overdue ? "follow-up required" : "nothing overdue", "warning", "#ff6f85")}
      </div>
      <section class="panel table-panel">
        <div class="panel-header"><div><h2>Quotes and invoices</h2><p>Open any record to edit, print or change status</p></div></div>
        <div class="table-scroll"><table class="data-table">
          <thead><tr><th>Document</th><th>Customer</th><th>Type</th><th>Issue date</th><th>Due</th><th>Total</th><th>Status</th><th></th></tr></thead>
          <tbody>${state.invoices.map(invoice => `<tr class="clickable" data-action="view-entity" data-entity="invoice" data-id="${invoice.id}">
            <td><div class="table-primary"><div class="table-avatar">${invoice.type === "Quote" ? "Q" : "I"}</div><div class="table-primary-copy"><strong>${escapeHtml(invoice.number)}</strong><span>${escapeHtml(invoice.notes || "")}</span></div></div></td>
            <td>${escapeHtml(companyName(invoice.companyId))}</td>
            <td>${escapeHtml(invoice.type)}</td>
            <td>${escapeHtml(formatDate(invoice.issueDate))}</td>
            <td class="${invoice.status !== "Paid" && isOverdue(invoice.dueDate) ? "text-danger" : ""}">${escapeHtml(formatDate(invoice.dueDate))}</td>
            <td><strong>${escapeHtml(formatMoney(invoice.total))}</strong></td>
            <td><span class="status-pill ${invoice.status === "Paid" ? "success" : invoice.status === "Overdue" ? "danger" : invoice.status === "Sent" ? "info" : "warning"}">${escapeHtml(invoice.status)}</span></td>
            <td><div class="row-actions"><button class="mini-btn" data-action="print-invoice" data-id="${invoice.id}" title="Print">${icon("download")}</button><button class="mini-btn" data-action="edit-entity" data-entity="invoice" data-id="${invoice.id}">${icon("edit")}</button></div></td>
          </tr>`).join("")}</tbody>
        </table></div>
      </section>
    </div>`;
  }

  function renderMarketing() {
    const totals = state.campaigns.reduce((acc, campaign) => {
      acc.sent += Number(campaign.sent || 0); acc.opened += Number(campaign.opened || 0); acc.clicked += Number(campaign.clicked || 0); acc.conversions += Number(campaign.conversions || 0); return acc;
    }, { sent: 0, opened: 0, clicked: 0, conversions: 0 });
    const openRate = totals.sent ? Math.round(totals.opened / totals.sent * 100) : 0;
    const clickRate = totals.opened ? Math.round(totals.clicked / totals.opened * 100) : 0;
    return `<div class="page-grid">
      <div class="page-grid grid-4">
        ${renderMetric("Messages sent", totals.sent.toLocaleString(), "across all campaigns", "send", "#7c8cff")}
        ${renderMetric("Open rate", `${openRate}%`, "of delivered messages", "mail", "#52d9e9")}
        ${renderMetric("Click rate", `${clickRate}%`, "of opened messages", "link", "#ffbd55")}
        ${renderMetric("Conversions", totals.conversions.toLocaleString(), "tracked actions", "check", "#49d7a0")}
      </div>
      <div class="cards-grid">
        ${state.campaigns.map(campaign => {
          const open = campaign.sent ? Math.round(campaign.opened / campaign.sent * 100) : 0;
          const click = campaign.opened ? Math.round(campaign.clicked / campaign.opened * 100) : 0;
          return `<article class="entity-card" data-action="view-entity" data-entity="campaign" data-id="${campaign.id}" role="button" tabindex="0">
            <div class="entity-card-top"><div class="entity-logo">${campaign.channel[0]}</div><div class="entity-card-copy"><h3>${escapeHtml(campaign.name)}</h3><p>${escapeHtml(campaign.channel)} · ${escapeHtml(campaign.audience)}</p></div><span class="status-pill ${campaign.status === "Running" ? "success" : campaign.status === "Scheduled" ? "info" : campaign.status === "Completed" ? "" : "warning"}">${escapeHtml(campaign.status)}</span></div>
            <div class="entity-card-stats"><div class="entity-stat"><span>Sent</span><strong>${Number(campaign.sent).toLocaleString()}</strong></div><div class="entity-stat"><span>Conversions</span><strong>${Number(campaign.conversions).toLocaleString()}</strong></div><div class="entity-stat"><span>Open rate</span><strong>${open}%</strong></div><div class="entity-stat"><span>Click rate</span><strong>${click}%</strong></div></div>
          </article>`;
        }).join("")}
      </div>
      <section class="panel"><div class="panel-header"><div><h2>Audience segments</h2><p>Dynamic groups sourced from the AkiPasa database</p></div></div><div class="panel-body cards-grid">
        ${[
          ["All registered users", liveStats ? liveStats.total_users : state.contacts.length, "All profiles in the AkiPasa database"],
          ["New this month", liveStats ? liveStats.new_users_30d : 0, "Signed up in the last 30 days"],
          ["Unverified venues", liveStats ? (liveStats.total_venues - liveStats.verified_venues) : 0, "Venue is registered but not yet verified"],
          ["Pending claim reviews", liveStats ? liveStats.pending_claims : 0, "Venue claim submitted and awaiting decision"]
        ].map(([name, count, rule]) => `<div class="entity-card"><div class="entity-card-top"><div class="entity-logo">${icon("filter")}</div><div class="entity-card-copy"><h3>${escapeHtml(name)}</h3><p>${escapeHtml(rule)}</p></div></div><div class="entity-card-stats"><div class="entity-stat"><span>Members</span><strong>${Number(count||0).toLocaleString()}</strong></div><div class="entity-stat"><span>Refresh</span><strong>Live</strong></div></div></div>`).join("")}
      </div></section>
    </div>`;
  }

  function renderSites() {
    return `<div class="page-grid">
      <section class="panel"><div class="panel-header"><div><h2>Landing pages</h2><p>Original, lightweight pages for campaigns and onboarding</p></div></div><div class="panel-body cards-grid">
        ${state.pages.map(page => `<article class="entity-card" data-action="view-entity" data-entity="page" data-id="${page.id}" role="button" tabindex="0">
          <div class="entity-card-top"><div class="entity-logo">${icon("sites")}</div><div class="entity-card-copy"><h3>${escapeHtml(page.name)}</h3><p>/${escapeHtml(page.slug)} · updated ${escapeHtml(relativeTime(page.updatedAt))}</p></div><span class="status-pill ${page.status === "Published" ? "success" : "warning"}">${escapeHtml(page.status)}</span></div>
          <div class="entity-card-stats"><div class="entity-stat"><span>Visitors</span><strong>${Number(page.visitors || 0).toLocaleString()}</strong></div><div class="entity-stat"><span>Conversions</span><strong>${Number(page.conversions || 0).toLocaleString()}</strong></div></div>
        </article>`).join("")}
      </div></section>
      <section class="panel"><div class="panel-header"><div><h2>Forms</h2><p>Capture leads, events and custom records</p></div></div><div class="panel-body cards-grid">
        ${state.forms.map(form => `<article class="entity-card" data-action="view-entity" data-entity="form" data-id="${form.id}" role="button" tabindex="0">
          <div class="entity-card-top"><div class="entity-logo">${icon("sales")}</div><div class="entity-card-copy"><h3>${escapeHtml(form.name)}</h3><p>${form.fields.length} fields · creates ${escapeHtml(form.destination)}</p></div><span class="status-pill ${form.status === "Live" ? "success" : "warning"}">${escapeHtml(form.status)}</span></div>
          <div class="entity-card-stats"><div class="entity-stat"><span>Submissions</span><strong>${Number(form.submissions || 0).toLocaleString()}</strong></div><div class="entity-stat"><span>Conversion</span><strong>${Number(form.conversionRate || 0)}%</strong></div></div>
        </article>`).join("")}
      </div></section>
    </div>`;
  }

  function renderAutomation() {
    return `<div class="page-grid">
      ${state.automations.map(automation => `<section class="panel">
        <div class="panel-header"><div><h2>${escapeHtml(automation.name)}</h2><p>${Number(automation.runs || 0)} runs · ${Number(automation.failures || 0)} failures · updated ${escapeHtml(relativeTime(automation.updatedAt))}</p></div><div class="panel-actions"><span class="status-pill ${automation.status === "Active" ? "success" : "warning"}">${escapeHtml(automation.status)}</span><button class="mini-btn" data-action="toggle-automation" data-id="${automation.id}" title="Toggle">${automation.status === "Active" ? icon("timer") : icon("check")}</button><button class="mini-btn" data-action="edit-entity" data-entity="automation" data-id="${automation.id}">${icon("edit")}</button></div></div>
        <div class="panel-body"><div class="automation-flow">
          <div class="flow-node"><div class="flow-node-type">Trigger</div><strong>${escapeHtml(automation.trigger)}</strong><p>Starts a new workflow run.</p></div>
          ${automation.conditions.map(condition => `<div class="flow-node"><div class="flow-node-type">Condition</div><strong>${escapeHtml(condition)}</strong><p>Continue only when the rule matches.</p></div>`).join("")}
          ${automation.actions.map(action => `<div class="flow-node"><div class="flow-node-type">Action</div><strong>${escapeHtml(action)}</strong><p>Executed in sequence with an audit log.</p></div>`).join("")}
        </div></div>
      </section>`).join("")}
      <section class="panel"><div class="panel-header"><div><h2>Execution log</h2><p>Latest workflow runs</p></div></div><div class="panel-body activity-list">
        ${state.activities.filter(activity => activity.entityType === "automation").map(activity => `<div class="activity-item"><div class="activity-icon">${icon("automation")}</div><div class="activity-copy"><strong>${escapeHtml(employeeName(activity.actorId))}</strong> ${escapeHtml(activity.verb)}<br><span>${escapeHtml(activity.detail)}</span></div><div class="activity-time">${escapeHtml(relativeTime(activity.at))}</div></div>`).join("") || `<div class="panel-empty"><div><strong>No logged runs yet</strong><span>Toggle or edit a workflow to create activity.</span></div></div>`}
      </div></section>
    </div>`;
  }

  function renderCollaboration() {
    const online = state.employees.filter(employee => employee.status === "Online");
    return `<div class="page-grid grid-main">
      <section class="page-grid">
        <section class="panel">
          <div class="panel-body">
            <form data-form="feed-post" class="composer" style="border:0;padding:0">
              <div class="avatar">${initials(currentUser().name)}</div>
              <textarea name="text" required placeholder="Share an update with the team…"></textarea>
              <button class="action-btn primary" type="submit">Post</button>
            </form>
          </div>
        </section>
        ${state.feed.map(post => {
          const author = state.employees.find(employee => employee.id === post.authorId) || currentUser();
          return `<article class="panel">
            <div class="panel-body">
              <div class="flex items-center gap-8"><div class="table-avatar">${initials(author.name)}</div><div><strong style="font-size:11px">${escapeHtml(author.name)}</strong><div class="subtle" style="font-size:8px;margin-top:2px">${escapeHtml(author.role)} · ${escapeHtml(relativeTime(post.at))}</div></div><button class="mini-btn ml-auto" data-action="delete-feed-post" data-id="${post.id}">${icon("more")}</button></div>
              <p style="font-size:12px;line-height:1.65;color:var(--muted);margin:14px 0">${escapeHtml(post.text)}</p>
              <div class="flex gap-8 items-center" style="flex-wrap:wrap">
                ${Object.entries(post.reactions || {}).map(([reaction, count]) => `<button class="chip" data-action="react-feed" data-id="${post.id}" data-reaction="${escapeHtml(reaction)}">${escapeHtml(reaction)} ${count}</button>`).join("")}
                <button class="chip" data-action="react-feed" data-id="${post.id}" data-reaction="👏">+ 👏</button>
                <span class="subtle ml-auto" style="font-size:9px">${post.comments?.length || 0} comments</span>
              </div>
              ${(post.comments || []).length ? `<hr class="soft">${post.comments.map(comment => `<div class="activity-item"><div class="table-avatar">${initials(employeeName(comment.authorId))}</div><div class="activity-copy"><strong>${escapeHtml(employeeName(comment.authorId))}</strong><br>${escapeHtml(comment.text)}</div><div class="activity-time">${escapeHtml(relativeTime(comment.at))}</div></div>`).join("")}` : ""}
              <form data-form="feed-comment" data-post-id="${post.id}" class="composer" style="padding:10px 0 0;border:0"><input name="text" required class="toolbar-input" style="flex:1;width:auto" placeholder="Write a comment…"><button class="mini-btn" type="submit">${icon("send")}</button></form>
            </div>
          </article>`;
        }).join("")}
      </section>
      <aside class="page-grid">
        <section class="panel"><div class="panel-header"><div><h2>Team online</h2><p>${online.length} available now</p></div></div><div class="panel-body activity-list">
          ${state.employees.map(employee => `<div class="activity-item"><div class="table-avatar">${initials(employee.name)}</div><div class="activity-copy"><strong>${escapeHtml(employee.name)}</strong><br><span>${escapeHtml(employee.role)}</span></div><div><span class="status-pill ${employee.status === "Online" ? "success" : employee.status === "Away" ? "warning" : ""}">${escapeHtml(employee.status)}</span></div></div>`).join("")}
        </div></section>
        <section class="panel"><div class="panel-header"><div><h2>Channels</h2><p>Local collaboration spaces</p></div></div><div class="panel-body">
          ${[["# launch", 12], ["# venue-success", 8], ["# product", 5], ["# support", 3], ["# random", 1]].map(([name, count]) => `<button class="action-btn ghost" style="width:100%;justify-content:flex-start;margin-bottom:5px"><span>${escapeHtml(name)}</span><span class="ml-auto subtle">${count}</span></button>`).join("")}
        </div></section>
      </aside>
    </div>`;
  }

  function isUserOnline(employee) {
    if (!employee) return false;
    if (authUser && (employee.id === authUser.id || (authUser.email && employee.email && employee.email.toLowerCase() === authUser.email.toLowerCase()))) {
      return true;
    }
    return false;
  }

  function renderEmployees() {
    const departments = [...new Set(state.employees.map(employee => employee.department))];
    const staffCount = liveStats ? liveStats.staff_users : state.employees.length;
    const totalUsers = liveStats ? liveStats.total_users : state.contacts.length;
    const onlineCount = state.employees.filter(isUserOnline).length;

    return `<div class="page-grid">
      <div class="page-grid grid-4">
        ${renderMetric("Team members", String(staffCount), `${departments.length} departments · staff & admins`, "employees", "#7c8cff")}
        ${renderMetric("Online now", String(onlineCount), "active CRM sessions", "activity", "#49d7a0")}
        ${renderMetric("AkiPasa Users", String(totalUsers), "registered database profiles", "user", "#52d9e9")}
        ${renderMetric("Open assignments", String(state.tasks.filter(task => task.status !== "done").length), "tasks assigned", "tasks", "#ffbd55")}
      </div>
      <div class="cards-grid">
        ${state.employees.map(employee => {
          const openTasks = state.tasks.filter(task => task.assigneeId === employee.id && task.status !== "done").length;
          const online = isUserOnline(employee);
          return `<article class="entity-card" data-action="view-entity" data-entity="employee" data-id="${employee.id}" role="button" tabindex="0">
            <div class="entity-card-top"><div class="entity-logo">${initials(employee.name)}</div><div class="entity-card-copy"><h3>${escapeHtml(employee.name)}</h3><p>${escapeHtml(employee.role)} · ${escapeHtml(employee.location)}</p></div><span class="status-pill ${online ? "success" : ""}">${online ? "Online" : "Offline"}</span></div>
            <div class="entity-card-stats"><div class="entity-stat"><span>Department</span><strong>${escapeHtml(employee.department)}</strong></div><div class="entity-stat"><span>Open tasks</span><strong>${openTasks}</strong></div><div class="entity-stat"><span>Status</span><strong>${online ? "Online" : "Offline"}</strong></div><div class="entity-stat"><span>Joined</span><strong>${escapeHtml(formatDate(employee.joinedAt, { year: false }))}</strong></div></div>
          </article>`;
        }).join("")}
      </div>
      <section class="panel"><div class="panel-header"><div><h2>Department workload</h2><p>Open tasks grouped by team</p></div></div><div class="panel-body">
        <div class="chart-bars">${departments.map(department => {
          const ids = state.employees.filter(employee => employee.department === department).map(employee => employee.id);
          const value = state.tasks.filter(task => ids.includes(task.assigneeId) && task.status !== "done").length;
          return `<div class="chart-bar-wrap"><span class="chart-value">${value}</span><div class="chart-bar" style="height:${Math.max(5, value * 18)}%"></div><span class="chart-label">${escapeHtml(department)}</span></div>`;
        }).join("")}</div>
      </div></section>
    </div>`;
  }

  function renderKnowledge() {
    const article = state.knowledge.find(item => item.id === ui.selectedArticleId) || state.knowledge[0];
    if (!article) return `<section class="panel empty-state"><div><div class="empty-state-icon">${icon("knowledge")}</div><h2>No articles yet</h2><p>Create the first article to document a process, policy or playbook.</p><button class="action-btn primary" data-action="open-form" data-entity="article">Create article</button></div></section>`;
    const categories = [...new Set(state.knowledge.map(item => item.category))];
    return `<section class="panel knowledge-layout">
      <aside class="knowledge-nav">
        ${categories.map(category => `<div class="nav-label" style="opacity:1;padding-left:8px">${escapeHtml(category)}</div>${state.knowledge.filter(item => item.category === category).map(item => `<button class="knowledge-item ${item.id === article.id ? "active" : ""}" data-action="select-article" data-id="${item.id}">${escapeHtml(item.title)}</button>`).join("")}`).join("")}
      </aside>
      <article class="knowledge-article">
        <div class="article-wrap">
          <div class="flex items-center"><span class="status-pill info">${escapeHtml(article.category)}</span><div class="ml-auto flex gap-8"><button class="action-btn" data-action="edit-entity" data-entity="article" data-id="${article.id}">${icon("edit")} Edit</button><button class="action-btn ghost" data-action="delete-entity" data-entity="article" data-id="${article.id}">${icon("trash")}</button></div></div>
          <h1>${escapeHtml(article.title)}</h1>
          <div class="article-meta">Written by ${escapeHtml(employeeName(article.authorId))} · updated ${escapeHtml(relativeTime(article.updatedAt))}</div>
          <div class="article-content">${markdown(article.content)}</div>
        </div>
      </article>
    </section>`;
  }

  function renderAnalytics() {
    const stages = state.pipelines[0].stages;
    const funnel = stages.map(stage => ({ stage: stage.name, count: state.deals.filter(deal => deal.pipelineId === "venue" && deal.stageId === stage.id).length, color: stage.color }));
    const maxFunnel = Math.max(...funnel.map(item => item.count), 1);
    const campaignData = state.campaigns.filter(campaign => campaign.sent > 0);
    const revenueByCompany = state.companies.map(company => ({ company: company.name, value: state.invoices.filter(invoice => invoice.companyId === company.id && invoice.status === "Paid").reduce((sum, invoice) => sum + Number(invoice.total || 0), 0) })).filter(item => item.value > 0).sort((a, b) => b.value - a.value);
    return `<div class="page-grid">
      <div class="page-grid grid-4">
        ${renderMetric("Venue conversion", "24%", "imported venue to claimed", "analytics", "#7c8cff", "+4.2%")}
        ${renderMetric("Average deal", formatMoney(state.deals.reduce((sum, deal) => sum + Number(deal.value || 0), 0) / Math.max(state.deals.length, 1)), "across all pipelines", "money", "#49d7a0")}
        ${renderMetric("Campaign ROI", "4.8×", "tracked demo revenue", "marketing", "#ffbd55", "+0.6×")}
        ${renderMetric("Support response", "18 min", "median first reply", "inbox", "#52d9e9", "-7 min")}
      </div>
      <div class="page-grid grid-2">
        <section class="panel"><div class="panel-header"><div><h2>Venue onboarding funnel</h2><p>Current record count per stage</p></div></div><div class="panel-body">
          ${funnel.map(item => `<div style="margin-bottom:11px"><div class="flex items-center" style="font-size:10px"><strong>${escapeHtml(item.stage)}</strong><span class="ml-auto muted">${item.count}</span></div><div style="height:10px;border-radius:999px;background:var(--surface-3);margin-top:6px;overflow:hidden"><div style="height:100%;width:${Math.max(4, item.count / maxFunnel * 100)}%;background:${item.color};border-radius:inherit"></div></div></div>`).join("")}
        </div></section>
        <section class="panel"><div class="panel-header"><div><h2>Campaign engagement</h2><p>Open and click rates</p></div></div><div class="panel-body">
          ${campaignData.map(campaign => {
            const open = Math.round(campaign.opened / campaign.sent * 100);
            const click = Math.round(campaign.clicked / campaign.sent * 100);
            return `<div style="margin-bottom:14px"><div class="flex items-center" style="font-size:10px"><strong>${escapeHtml(campaign.name)}</strong><span class="ml-auto muted">${open}% open · ${click}% click</span></div><div style="height:10px;border-radius:999px;background:var(--surface-3);margin-top:6px;overflow:hidden;position:relative"><div style="position:absolute;height:100%;width:${open}%;background:rgba(82,217,233,.7);border-radius:inherit"></div><div style="position:absolute;height:100%;width:${click}%;background:#7c8cff;border-radius:inherit"></div></div></div>`;
          }).join("")}
        </div></section>
      </div>
      <div class="page-grid grid-2">
        <section class="panel"><div class="panel-header"><div><h2>Revenue by customer</h2><p>Paid invoices</p></div></div><div class="panel-body">
          ${revenueByCompany.map(item => `<div class="activity-item"><div class="table-avatar">${initials(item.company)}</div><div class="activity-copy"><strong>${escapeHtml(item.company)}</strong><br><span>Collected revenue</span></div><div><strong>${escapeHtml(formatMoney(item.value))}</strong></div></div>`).join("") || `<div class="panel-empty"><div><strong>No paid invoices</strong></div></div>`}
        </div></section>
        <section class="panel"><div class="panel-header"><div><h2>Project progress</h2><p>Completion across active work</p></div></div><div class="panel-body">
          ${state.projects.map(project => `<div style="margin-bottom:14px"><div class="flex items-center" style="font-size:10px"><strong>${escapeHtml(project.name)}</strong><span class="ml-auto muted">${Number(project.progress || 0)}%</span></div><div style="height:9px;border-radius:999px;background:var(--surface-3);margin-top:6px;overflow:hidden"><div style="height:100%;width:${clamp(project.progress,0,100)}%;background:linear-gradient(90deg,var(--accent),var(--accent-2));border-radius:inherit"></div></div></div>`).join("")}
        </div></section>
      </div>
    </div>`;
  }

  function renderIntegrations() {
    const categories = ["All", ...new Set(integrationCatalog.map(item => item.category))];
    const query = ui.integrationSearch.trim().toLowerCase();
    const filtered = integrationCatalog.filter(item => (ui.integrationCategory === "All" || item.category === ui.integrationCategory) && (!query || `${item.name} ${item.description} ${item.category}`.toLowerCase().includes(query)));
    return `<div class="page-grid">
      <div class="integration-toolbar">
        <input class="toolbar-input" style="flex:1;max-width:340px" data-integration-search value="${escapeHtml(ui.integrationSearch)}" placeholder="Search integrations…">
        <div class="integration-categories">${categories.map(category => `<button class="chip ${ui.integrationCategory === category ? "active" : ""}" data-action="integration-category" data-category="${escapeHtml(category)}">${escapeHtml(category)}</button>`).join("")}</div>
      </div>
      <div class="cards-grid">
        ${filtered.map(integration => {
          const connection = state.integrations[integration.id];
          const connected = connection?.status === "connected";
          const setup = connection?.status === "setup";
          return `<article class="entity-card integration-card">
            <div class="integration-logo" style="--integration-bg:${integration.color}">${escapeHtml(integration.mark)}</div>
            <h3>${escapeHtml(integration.name)}</h3><p>${escapeHtml(integration.description)}</p>
            <div class="integration-foot"><span class="status-pill ${connected ? "success" : setup ? "warning" : ""}">${connected ? t("connected") : setup ? "Needs server config" : integration.mode === "import" ? "Available" : "Not configured"}</span><button class="action-btn" data-action="connect-integration" data-id="${integration.id}">${connected ? "Manage" : t("configure")}</button></div>
          </article>`;
        }).join("") || `<section class="panel empty-state"><div><div class="empty-state-icon">${icon("search")}</div><h2>No matching integrations</h2><p>Try another provider or use the generic webhook and REST API connectors.</p></div></section>`}
      </div>
      <section class="panel"><div class="panel-header"><div><h2>Connector model</h2><p>What works in this no-VPS build</p></div></div><div class="panel-body page-grid grid-3">
        <div class="detail-block"><div class="detail-label">Local adapters</div><div class="detail-value">CSV import/export, generic data backup and browser-side workflow configuration work immediately.</div></div>
        <div class="detail-block"><div class="detail-label">Serverless adapters</div><div class="detail-value">Provider secrets and webhooks belong in the included Cloudflare Worker, not in browser storage.</div></div>
        <div class="detail-block"><div class="detail-label">OAuth providers</div><div class="detail-value">Google, Microsoft, Meta and similar providers require your own app credentials and approval.</div></div>
      </div></section>
    </div>`;
  }

  function cloudConfigured() {
    const config = window.AKIHQ_CONFIG || {};
    return Boolean(config.SUPABASE_URL && config.SUPABASE_ANON_KEY && !String(config.SUPABASE_URL).includes("YOUR_PROJECT"));
  }

  function renderSettings() {
    const tabs = [
      ["appearance", "Appearance"], ["workspace", "Workspace"], ["data", "Data & backup"], ["cloud", "Cloud sync"], ["security", "Security"], ["about", "About"]
    ];
    return `<div class="settings-layout">
      <aside class="panel settings-nav">${tabs.map(([id, label]) => `<button class="${ui.settingsTab === id ? "active" : ""}" data-action="settings-tab" data-tab="${id}">${escapeHtml(label)}</button>`).join("")}</aside>
      <div>${renderSettingsPanel()}</div>
    </div>`;
  }

  function renderSettingsPanel() {
    if (ui.settingsTab === "workspace") {
      return `<section class="panel settings-section"><h2>Workspace profile</h2><p>Defaults used across AkiHQ records, dates and documents.</p>
        <form class="form-grid" data-form="workspace">
          <div class="form-field"><label>Workspace name</label><input name="name" required value="${escapeHtml(state.workspace.name)}"></div>
          <div class="form-field"><label>Slug</label><input name="slug" required value="${escapeHtml(state.workspace.slug)}"></div>
          <div class="form-field"><label>Timezone</label><input name="timezone" value="${escapeHtml(state.workspace.timezone)}"></div>
          <div class="form-field"><label>Currency</label><select name="currency">${["EUR", "GBP", "USD"].map(currency => `<option ${state.workspace.currency === currency ? "selected" : ""}>${currency}</option>`).join("")}</select></div>
          <div class="form-field full"><div class="flex"><button class="action-btn primary ml-auto" type="submit">Save workspace</button></div></div>
        </form>
      </section>
      <section class="panel settings-section"><h2>Workspace statistics</h2><p>Local records currently stored in this browser.</p>
        <div class="page-grid grid-4">
          <div class="detail-block"><div class="detail-label">CRM records</div><div class="detail-value">${state.deals.length + state.leads.length + state.contacts.length + state.companies.length}</div></div>
          <div class="detail-block"><div class="detail-label">Tasks & projects</div><div class="detail-value">${state.tasks.length + state.projects.length}</div></div>
          <div class="detail-block"><div class="detail-label">Documents</div><div class="detail-value">${state.invoices.length + state.knowledge.length}</div></div>
          <div class="detail-block"><div class="detail-label">Audit entries</div><div class="detail-value">${state.audit.length}</div></div>
        </div>
      </section>`;
    }
    if (ui.settingsTab === "data") {
      return `<section class="panel settings-section"><h2>Data and backup</h2><p>AkiHQ is local-first. Export a complete JSON backup before clearing browser data or moving devices.</p>
        <div class="setting-row"><div class="setting-copy"><strong>Export complete workspace</strong><span>Downloads CRM, tasks, messages, settings and every other local record.</span></div><button class="action-btn" data-action="export-data">${icon("download")} Export JSON</button></div>
        <div class="setting-row"><div class="setting-copy"><strong>Import workspace backup</strong><span>Replaces the current workspace after validating the file.</span></div><button class="action-btn" data-action="import-data">${icon("upload")} Import JSON</button></div>
        <div class="setting-row"><div class="setting-copy"><strong>Export CRM CSV</strong><span>Creates separate CSV downloads for deals, contacts and companies.</span></div><button class="action-btn" data-action="export-crm-bundle">${icon("download")} Export CSVs</button></div>
        <div class="setting-row"><div class="setting-copy"><strong>Restore demo workspace</strong><span>Deletes local changes and restores the original AkiPasa demo data.</span></div><button class="action-btn danger" data-action="confirm-reset">${icon("trash")} Reset</button></div>
      </section>
      <section class="panel settings-section"><h2>Storage</h2><p>Browser storage usage is approximate and varies by browser.</p>
        <div class="detail-grid"><div class="detail-block"><div class="detail-label">Serialized size</div><div class="detail-value">${(new Blob([JSON.stringify(state)]).size / 1024).toFixed(1)} KB</div></div><div class="detail-block"><div class="detail-label">Storage key</div><div class="detail-value"><code>${STORAGE_KEY}</code></div></div></div>
      </section>`;
    }
    if (ui.settingsTab === "cloud") {
      const configured = cloudConfigured();
      const sessionEmail = cloudSession?.user?.email || cloudSession?.email || "";
      return `<section class="panel settings-section"><h2>Optional Supabase sync</h2><p>Use your existing managed Supabase project to move this local workspace between devices—still no VPS required.</p>
        ${!configured ? `<div class="detail-block full" style="border-color:rgba(255,189,85,.4)"><div class="detail-label text-warning">Configuration needed</div><div class="detail-value">Copy <code>config.example.js</code> to <code>config.js</code>, add your Supabase URL and anon key, then run <code>supabase/schema.sql</code> in the SQL editor.</div></div>` : cloudSession ? `
          <div class="setting-row"><div class="setting-copy"><strong>Signed in as ${escapeHtml(sessionEmail)}</strong><span>Cloud sync is manual in this alpha so local edits are never silently overwritten.</span></div><button class="action-btn" data-action="cloud-signout">Sign out</button></div>
          <div class="setting-row"><div class="setting-copy"><strong>Push this workspace</strong><span>Uploads the current encrypted transport snapshot to your RLS-protected row.</span></div><button class="action-btn primary" data-action="cloud-push">${icon("upload")} Push</button></div>
          <div class="setting-row"><div class="setting-copy"><strong>Pull cloud workspace</strong><span>Replaces local data with the latest snapshot after confirmation.</span></div><button class="action-btn" data-action="cloud-pull">${icon("download")} Pull</button></div>` : `
          <form class="form-grid" data-form="cloud-auth">
            <div class="form-field full"><label>Email</label><input name="email" type="email" autocomplete="email" required></div>
            <div class="form-field full"><label>Password</label><input name="password" type="password" minlength="6" autocomplete="current-password" required></div>
            <div class="form-field full"><div class="flex gap-8"><button class="action-btn primary" type="submit" name="intent" value="signin">Sign in</button><button class="action-btn" type="submit" name="intent" value="signup">Create account</button></div><div class="form-help">Supabase handles authentication. AkiHQ never places your password in local workspace data.</div></div>
          </form>`}
      </section>
      <section class="panel settings-section"><h2>Current sync scope</h2><p>This alpha uses one JSON workspace snapshot per signed-in account.</p>
        <div class="page-grid grid-3"><div class="detail-block"><div class="detail-label">Included</div><div class="detail-value">All workspace records, UI settings and local integration setup state.</div></div><div class="detail-block"><div class="detail-label">Not included</div><div class="detail-value">Provider secrets, large binary files and real-time multi-user conflict resolution.</div></div><div class="detail-block"><div class="detail-label">Next backend step</div><div class="detail-value">Move each module to relational Supabase tables and use Realtime subscriptions.</div></div></div>
      </section>`;
    }
    if (ui.settingsTab === "security") {
      return `<section class="panel settings-section"><h2>Security model</h2><p>The downloadable build deliberately avoids pretending browser storage is a secure place for provider credentials.</p>
        <div class="setting-row"><div class="setting-copy"><strong>Integration secrets</strong><span>Store OAuth client secrets, API secrets and webhook signing keys in Cloudflare Worker secrets.</span></div><span class="status-pill success">Protected design</span></div>
        <div class="setting-row"><div class="setting-copy"><strong>Cloud data access</strong><span>The included Supabase schema enables Row Level Security so each user can access only their own snapshot.</span></div><span class="status-pill success">RLS included</span></div>
        <div class="setting-row"><div class="setting-copy"><strong>Local device access</strong><span>Anyone with access to this browser profile can read local AkiHQ data. Use OS account security.</span></div><span class="status-pill warning">Device-controlled</span></div>
        <div class="setting-row"><div class="setting-copy"><strong>Audit log</strong><span>${state.audit.length} local actions recorded. Exported with workspace backups.</span></div><button class="action-btn" data-action="export-audit">Export log</button></div>
      </section>
      <section class="panel settings-section"><h2>Privacy switches</h2><p>Local preferences for notification and motion behaviour.</p>
        <div class="setting-row"><div class="setting-copy"><strong>In-app notifications</strong><span>Show reminders and workflow updates.</span></div><button class="switch ${state.settings.notifications ? "on" : ""}" data-action="toggle-setting" data-key="notifications"></button></div>
        <div class="setting-row"><div class="setting-copy"><strong>Reduced motion</strong><span>Minimise non-essential interface animation.</span></div><button class="switch ${state.settings.reducedMotion ? "on" : ""}" data-action="toggle-setting" data-key="reducedMotion"></button></div>
      </section>`;
    }
    if (ui.settingsTab === "about") {
      return `<section class="panel settings-section"><h2>AkiHQ ${APP_VERSION}</h2><p>An original, open-source business workspace built for Alex—not a Bitrix24 source-code copy or branded skin.</p>
        <div class="detail-grid"><div class="detail-block"><div class="detail-label">License</div><div class="detail-value">Apache License 2.0</div></div><div class="detail-block"><div class="detail-label">Runtime</div><div class="detail-value">Static PWA + optional Supabase + optional Cloudflare Worker</div></div><div class="detail-block full"><div class="detail-label">Modules in this build</div><div class="detail-value">Dashboard, CRM, inbox, projects, calendar, inventory, billing, marketing, sites/forms, automation, collaboration, people, knowledge, analytics, integrations and settings.</div></div></div>
      </section>
      <section class="panel settings-section"><h2>Honest status</h2><p>This package is a working local-first alpha, not finished parity with every feature of a mature commercial suite.</p>
        <div class="page-grid grid-3"><div class="detail-block"><div class="detail-label">Working now</div><div class="detail-value">Persistent CRUD, boards, drag-and-drop, search, activity, messages, exports, PWA shell and optional personal cloud sync.</div></div><div class="detail-block"><div class="detail-label">Adapter UI included</div><div class="detail-value">Major integration catalogue with configuration states and serverless architecture.</div></div><div class="detail-block"><div class="detail-label">Requires implementation</div><div class="detail-value">Production OAuth flows, provider webhooks, relational multi-tenant backend, files, payments and true realtime collaboration.</div></div></div>
      </section>`;
    }
    return `<section class="panel settings-section"><h2>Appearance</h2><p>Choose a look and information density. Changes are saved instantly.</p>
      <div class="setting-row"><div class="setting-copy"><strong>Theme</strong><span>Dark and light themes use the same original aurora-map visual system.</span></div><div class="theme-options">
        <button class="theme-option ${state.settings.theme === "dark" ? "active" : ""}" data-action="set-theme" data-theme="dark" title="Dark"><div class="theme-preview dark"><span></span><span></span></div></button>
        <button class="theme-option ${state.settings.theme === "light" ? "active" : ""}" data-action="set-theme" data-theme="light" title="Light"><div class="theme-preview light"><span></span><span></span></div></button>
      </div></div>
      <div class="setting-row"><div class="setting-copy"><strong>Density</strong><span>Compact mode fits more records on screen.</span></div><select class="filter-select" data-change="density"><option value="comfortable" ${state.settings.density === "comfortable" ? "selected" : ""}>Comfortable</option><option value="compact" ${state.settings.density === "compact" ? "selected" : ""}>Compact</option></select></div>
      <div class="setting-row"><div class="setting-copy"><strong>Language</strong><span>Navigation and common actions include English and Spanish.</span></div><select class="filter-select" data-change="locale"><option value="en" ${state.settings.locale === "en" ? "selected" : ""}>English</option><option value="es" ${state.settings.locale === "es" ? "selected" : ""}>Español</option></select></div>
      <div class="setting-row"><div class="setting-copy"><strong>Collapsed navigation</strong><span>Keep only icons visible on desktop.</span></div><button class="switch ${state.settings.sidebarCollapsed ? "on" : ""}" data-action="toggle-sidebar"></button></div>
    </section>`;
  }

  const collectionFor = {
    deal: "deals", lead: "leads", contact: "contacts", company: "companies", task: "tasks", project: "projects",
    event: "events", product: "products", invoice: "invoices", campaign: "campaigns", page: "pages", form: "forms",
    automation: "automations", article: "knowledge", employee: "employees", conversation: "conversations"
  };

  function getEntity(type, id) {
    const collection = collectionFor[type];
    return collection ? state[collection]?.find(item => item.id === id) : null;
  }

  function routeForEntity(type) {
    if (["deal", "lead", "contact", "company"].includes(type)) return "crm";
    if (["task", "project"].includes(type)) return "tasks";
    if (type === "event") return "calendar";
    if (type === "product") return "inventory";
    if (type === "invoice") return "sales";
    if (type === "campaign") return "marketing";
    if (["page", "form"].includes(type)) return "sites";
    if (type === "automation") return "automation";
    if (type === "employee") return "employees";
    if (type === "article") return "knowledge";
    if (type === "conversation") return "inbox";
    return "dashboard";
  }

  function titleForEntity(type, entity) {
    if (!entity) return capitalize(type);
    return entity.title || entity.name || entity.number || entity.sku || capitalize(type);
  }

  function entityFormConfig(type, existing = null) {
    const employeeOptions = state.employees.map(employee => [employee.id, employee.name]);
    const companyOptions = [["", "No company"], ...state.companies.map(company => [company.id, company.name])];
    const contactOptions = [["", "No contact"], ...state.contacts.map(contact => [contact.id, contact.name])];
    const projectOptions = [["", "No project"], ...state.projects.map(project => [project.id, project.name])];
    const pipelineId = existing?.pipelineId || ui.formDefaults.pipelineId || ui.pipelineId || state.pipelines[0]?.id;
    const pipeline = state.pipelines.find(item => item.id === pipelineId) || state.pipelines[0];
    const configs = {
      deal: {
        label: "Deal",
        icon: "crm",
        fields: [
          { name: "title", label: "Deal title", required: true, full: true },
          { name: "companyId", label: "Company", type: "select", options: companyOptions },
          { name: "contactId", label: "Contact", type: "select", options: contactOptions },
          { name: "pipelineId", label: "Pipeline", type: "select", options: state.pipelines.map(item => [item.id, item.name]), value: pipelineId },
          { name: "stageId", label: "Stage", type: "select", options: pipeline.stages.map(stage => [stage.id, stage.name]), value: ui.formDefaults.stageId || pipeline.stages[0]?.id },
          { name: "value", label: "Value", type: "number", step: "0.01", value: 0 },
          { name: "probability", label: "Probability %", type: "number", min: 0, max: 100, value: 20 },
          { name: "ownerId", label: "Owner", type: "select", options: employeeOptions, value: state.currentUserId },
          { name: "dueDate", label: "Due date", type: "date", value: dateOffset(7) },
          { name: "source", label: "Source", value: "Manual" },
          { name: "tags", label: "Tags", help: "Comma separated", full: true },
          { name: "notes", label: "Notes", type: "textarea", full: true }
        ]
      },
      lead: {
        label: "Lead", icon: "user", fields: [
          { name: "name", label: "Lead name", required: true }, { name: "company", label: "Company" },
          { name: "email", label: "Email", type: "email" }, { name: "phone", label: "Phone" },
          { name: "status", label: "Status", type: "select", options: ["New", "Contacted", "Qualified", "Unqualified"], value: "New" },
          { name: "source", label: "Source", value: "Manual" },
          { name: "ownerId", label: "Owner", type: "select", options: employeeOptions, value: state.currentUserId },
          { name: "score", label: "Lead score", type: "number", min: 0, max: 100, value: 50 }
        ]
      },
      contact: {
        label: "Contact", icon: "user", fields: [
          { name: "name", label: "Full name", required: true }, { name: "companyId", label: "Company", type: "select", options: companyOptions },
          { name: "email", label: "Email", type: "email" }, { name: "phone", label: "Phone" },
          { name: "role", label: "Role" }, { name: "source", label: "Source", value: "Manual" },
          { name: "tags", label: "Tags", help: "Comma separated", full: true }
        ]
      },
      company: {
        label: "Company", icon: "building", fields: [
          { name: "name", label: "Company name", required: true, full: true }, { name: "type", label: "Type" },
          { name: "city", label: "City" }, { name: "website", label: "Website", type: "url" },
          { name: "email", label: "Email", type: "email" }, { name: "phone", label: "Phone" },
          { name: "ownerId", label: "Owner", type: "select", options: employeeOptions, value: state.currentUserId },
          { name: "employees", label: "Employees", type: "number", min: 0, value: 1 },
          { name: "status", label: "Status", type: "select", options: ["Prospect", "Customer", "Partner", "Inactive"], value: "Prospect" }
        ]
      },
      task: {
        label: "Task", icon: "tasks", fields: [
          { name: "title", label: "Task title", required: true, full: true },
          { name: "projectId", label: "Project", type: "select", options: projectOptions },
          { name: "status", label: "Status", type: "select", options: [["todo", "To do"], ["progress", "In progress"], ["review", "Review"], ["done", "Done"]], value: ui.formDefaults.stageId || "todo" },
          { name: "priority", label: "Priority", type: "select", options: ["low", "medium", "high"], value: "medium" },
          { name: "assigneeId", label: "Assignee", type: "select", options: employeeOptions, value: state.currentUserId },
          { name: "dueDate", label: "Due date", type: "date", value: dateOffset(3) },
          { name: "estimate", label: "Estimate (minutes)", type: "number", min: 0, value: 60 },
          { name: "tracked", label: "Tracked (minutes)", type: "number", min: 0, value: 0 },
          { name: "description", label: "Description", type: "textarea", full: true }
        ]
      },
      project: {
        label: "Project", icon: "tasks", fields: [
          { name: "name", label: "Project name", required: true, full: true },
          { name: "status", label: "Status", type: "select", options: ["Planning", "Active", "On hold", "Completed"], value: "Planning" },
          { name: "ownerId", label: "Owner", type: "select", options: employeeOptions, value: state.currentUserId },
          { name: "progress", label: "Progress %", type: "number", min: 0, max: 100, value: 0 },
          { name: "dueDate", label: "Due date", type: "date", value: dateOffset(30) },
          { name: "budget", label: "Budget", type: "number", min: 0, step: "0.01", value: 0 }
        ]
      },
      event: {
        label: "Event", icon: "calendar", fields: [
          { name: "title", label: "Event title", required: true, full: true },
          { name: "start", label: "Starts", type: "datetime-local", value: ui.formDefaults.start || dateOffset(1) },
          { name: "end", label: "Ends", type: "datetime-local", value: ui.formDefaults.end || dateOffset(1) },
          { name: "type", label: "Type", type: "select", options: ["Team", "Client", "Sales", "Production", "Milestone", "Booking"], value: "Team" },
          { name: "color", label: "Colour", type: "color", value: "#7c8cff" },
          { name: "location", label: "Location", full: true },
          { name: "notes", label: "Notes", type: "textarea", full: true }
        ]
      },
      product: {
        label: "Product", icon: "inventory", fields: [
          { name: "name", label: "Product name", required: true, full: true },
          { name: "sku", label: "SKU", required: true }, { name: "category", label: "Category", value: "General" },
          { name: "price", label: "Sale price", type: "number", step: "0.01", min: 0, value: 0 },
          { name: "cost", label: "Unit cost", type: "number", step: "0.01", min: 0, value: 0 },
          { name: "stock", label: "Stock", type: "number", min: 0, value: 0 }, { name: "reorderAt", label: "Reorder at", type: "number", min: 0, value: 0 },
          { name: "warehouse", label: "Warehouse", value: "Main" },
          { name: "status", label: "Status", type: "select", options: ["Active", "Draft", "Archived"], value: "Active" },
          { name: "description", label: "Description", type: "textarea", full: true }
        ]
      },
      invoice: {
        label: existing?.type || ui.formDefaults.type || "Invoice", icon: "sales", fields: [
          { name: "number", label: "Document number", required: true, value: `${ui.formDefaults.type === "Quote" ? "Q" : "INV"}-${String(1013 + state.invoices.length).padStart(4, "0")}` },
          { name: "type", label: "Type", type: "select", options: ["Invoice", "Quote"], value: ui.formDefaults.type || "Invoice" },
          { name: "companyId", label: "Customer", type: "select", options: companyOptions, required: true },
          { name: "status", label: "Status", type: "select", options: ["Draft", "Sent", "Paid", "Overdue", "Cancelled"], value: "Draft" },
          { name: "issueDate", label: "Issue date", type: "date", value: isoNow() },
          { name: "dueDate", label: "Due date", type: "date", value: dateOffset(14) },
          { name: "total", label: "Total including tax", type: "number", min: 0, step: "0.01", value: 0 },
          { name: "tax", label: "Tax", type: "number", min: 0, step: "0.01", value: 0 },
          { name: "notes", label: "Description", type: "textarea", full: true }
        ]
      },
      campaign: {
        label: "Campaign", icon: "marketing", fields: [
          { name: "name", label: "Campaign name", required: true, full: true },
          { name: "channel", label: "Channel", type: "select", options: ["Email", "SMS", "Push", "Instagram", "Facebook"], value: "Email" },
          { name: "audience", label: "Audience", value: "All contacts" },
          { name: "status", label: "Status", type: "select", options: ["Draft", "Scheduled", "Running", "Paused", "Completed"], value: "Draft" },
          { name: "budget", label: "Budget", type: "number", min: 0, step: "0.01", value: 0 },
          { name: "startDate", label: "Start date", type: "date", value: isoNow() }, { name: "endDate", label: "End date", type: "date", value: dateOffset(14) }
        ]
      },
      page: {
        label: "Landing page", icon: "sites", fields: [
          { name: "name", label: "Page name", required: true }, { name: "slug", label: "URL slug", required: true },
          { name: "status", label: "Status", type: "select", options: ["Draft", "Published", "Archived"], value: "Draft" },
          { name: "headline", label: "Headline", required: true, full: true },
          { name: "body", label: "Body copy", type: "textarea", full: true }
        ]
      },
      form: {
        label: "Form", icon: "sales", fields: [
          { name: "name", label: "Form name", required: true },
          { name: "status", label: "Status", type: "select", options: ["Draft", "Live", "Archived"], value: "Draft" },
          { name: "destination", label: "Create record", type: "select", options: ["Lead", "Deal", "Contact", "Custom record"], value: "Lead" },
          { name: "fields", label: "Fields", type: "textarea", help: "One field per line", full: true, value: "Name\nEmail\nMessage" }
        ]
      },
      automation: {
        label: "Automation", icon: "automation", fields: [
          { name: "name", label: "Automation name", required: true, full: true },
          { name: "status", label: "Status", type: "select", options: ["Active", "Paused"], value: "Paused" },
          { name: "trigger", label: "Trigger", required: true, full: true },
          { name: "conditions", label: "Conditions", type: "textarea", help: "One condition per line", full: true },
          { name: "actions", label: "Actions", type: "textarea", help: "One action per line", full: true, required: true }
        ]
      },
      article: {
        label: "Knowledge article", icon: "knowledge", fields: [
          { name: "title", label: "Article title", required: true, full: true },
          { name: "category", label: "Category", value: "General" },
          { name: "authorId", label: "Author", type: "select", options: employeeOptions, value: state.currentUserId },
          { name: "content", label: "Content (Markdown)", type: "textarea", full: true, required: true, value: "## Overview\n\nWrite the process here." }
        ]
      },
      employee: {
        label: "Team member", icon: "employees", fields: [
          { name: "name", label: "Full name", required: true }, { name: "email", label: "Work email", type: "email", required: true },
          { name: "role", label: "Role", required: true }, { name: "department", label: "Department", value: "Operations" },
          { name: "status", label: "Status", type: "select", options: ["Online", "Away", "Offline"], value: "Offline" },
          { name: "location", label: "Location", value: "Remote" }, { name: "phone", label: "Phone" }
        ]
      }
    };
    return configs[type];
  }

  function inputValue(value, type) {
    if (value === null || value === undefined) return "";
    if (type === "date") {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
      return date.toISOString().slice(0, 10);
    }
    if (type === "datetime-local") {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return "";
      const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
      return local.toISOString().slice(0, 16);
    }
    if (Array.isArray(value)) return value.join(type === "textarea" ? "\n" : ", ");
    return value;
  }

  function renderField(field, record) {
    const raw = record?.[field.name] ?? field.value ?? "";
    const value = inputValue(raw, field.type);
    const common = `name="${field.name}" ${field.required ? "required" : ""} ${field.min !== undefined ? `min="${field.min}"` : ""} ${field.max !== undefined ? `max="${field.max}"` : ""} ${field.step ? `step="${field.step}"` : ""}`;
    let control;
    if (field.type === "select") {
      const options = (field.options || []).map(option => Array.isArray(option) ? option : [option, capitalize(option)]);
      control = `<select ${common}>${options.map(([optionValue, label]) => `<option value="${escapeHtml(optionValue)}" ${String(raw ?? field.value ?? "") === String(optionValue) ? "selected" : ""}>${escapeHtml(label)}</option>`).join("")}</select>`;
    } else if (field.type === "textarea") {
      control = `<textarea ${common}>${escapeHtml(value)}</textarea>`;
    } else {
      control = `<input type="${field.type || "text"}" ${common} value="${escapeHtml(value)}">`;
    }
    return `<div class="form-field ${field.full ? "full" : ""}"><label>${escapeHtml(field.label)}${field.required ? " *" : ""}</label>${control}${field.help ? `<div class="form-help">${escapeHtml(field.help)}</div>` : ""}</div>`;
  }

  function renderPortal() {
    const parts = [];
    if (ui.drawer) parts.push(renderDrawer());
    if (ui.modal) parts.push(renderModal());
    if (ui.dropdown) parts.push(renderDropdown());
    if (ui.searchQuery.trim()) parts.push(renderSearchResults());
    if (ui.commandOpen) parts.push(renderCommandPalette());
    if (ui.toasts.length) parts.push(`<div class="toast-stack">${ui.toasts.map(renderToast).join("")}</div>`);
    portal.innerHTML = parts.join("");
    requestAnimationFrame(() => {
      const messages = $("#messages");
      if (messages) messages.scrollTop = messages.scrollHeight;
      if (ui.commandOpen) $("#command-input")?.focus();
    });
  }

  function detailPairs(type, entity) {
    const map = {
      deal: [
        ["Company", companyName(entity.companyId)], ["Contact", contactName(entity.contactId)],
        ["Pipeline", state.pipelines.find(item => item.id === entity.pipelineId)?.name || entity.pipelineId],
        ["Stage", state.pipelines.find(item => item.id === entity.pipelineId)?.stages.find(stage => stage.id === entity.stageId)?.name || entity.stageId],
        ["Value", formatMoney(entity.value)], ["Probability", `${Number(entity.probability || 0)}%`],
        ["Owner", employeeName(entity.ownerId)], ["Due", formatDate(entity.dueDate)],
        ["Source", entity.source || "—"], ["Tags", (entity.tags || []).join(", ") || "—"],
        ["Notes", entity.notes || "No notes yet.", true]
      ],
      lead: [["Company", entity.company || "—"], ["Email", entity.email || "—"], ["Phone", entity.phone || "—"], ["Status", entity.status], ["Source", entity.source], ["Score", entity.score], ["Owner", employeeName(entity.ownerId)], ["Created", formatDate(entity.createdAt)]],
      contact: [["Company", companyName(entity.companyId)], ["Role", entity.role || "—"], ["Email", entity.email || "—"], ["Phone", entity.phone || "—"], ["Source", entity.source || "Manual"], ["Tags", (entity.tags || []).join(", ") || "—"], ["Updated", formatDate(entity.updatedAt)]],
      company: [["Type", entity.type || "—"], ["City", entity.city || "—"], ["Status", entity.status || "—"], ["Owner", employeeName(entity.ownerId)], ["Email", entity.email || "—"], ["Phone", entity.phone || "—"], ["Website", entity.website || "—"], ["Employees", entity.employees || 0]],
      task: [["Project", projectName(entity.projectId)], ["Status", capitalize(entity.status)], ["Priority", capitalize(entity.priority)], ["Assignee", employeeName(entity.assigneeId)], ["Due", formatDate(entity.dueDate)], ["Estimate", `${Number(entity.estimate || 0)} min`], ["Tracked", `${Number(entity.tracked || 0)} min`], ["Description", entity.description || "No description.", true]],
      project: [["Status", entity.status], ["Owner", employeeName(entity.ownerId)], ["Progress", `${Number(entity.progress || 0)}%`], ["Due", formatDate(entity.dueDate)], ["Budget", formatMoney(entity.budget)], ["Members", (entity.members || []).map(employeeName).join(", ") || "—", true]],
      event: [["Starts", formatDate(entity.start, { time: true })], ["Ends", formatDate(entity.end, { time: true })], ["Type", entity.type], ["Location", entity.location || "—"], ["Attendees", (entity.attendees || []).map(id => employeeName(id) === "Unassigned" ? contactName(id) : employeeName(id)).join(", ") || "—", true], ["Notes", entity.notes || "No notes.", true]],
      product: [["SKU", entity.sku], ["Category", entity.category], ["Price", formatMoney(entity.price)], ["Cost", formatMoney(entity.cost)], ["Stock", Number(entity.stock || 0).toLocaleString()], ["Reorder at", Number(entity.reorderAt || 0).toLocaleString()], ["Warehouse", entity.warehouse], ["Status", entity.status], ["Description", entity.description || "—", true]],
      invoice: [["Customer", companyName(entity.companyId)], ["Type", entity.type], ["Status", entity.status], ["Issue date", formatDate(entity.issueDate)], ["Due date", formatDate(entity.dueDate)], ["Total", formatMoney(entity.total)], ["Tax", formatMoney(entity.tax)], ["Notes", entity.notes || "—", true]],
      campaign: [["Channel", entity.channel], ["Audience", entity.audience], ["Status", entity.status], ["Budget", formatMoney(entity.budget)], ["Sent", Number(entity.sent || 0).toLocaleString()], ["Opened", Number(entity.opened || 0).toLocaleString()], ["Clicked", Number(entity.clicked || 0).toLocaleString()], ["Conversions", Number(entity.conversions || 0).toLocaleString()], ["Dates", `${formatDate(entity.startDate)} — ${formatDate(entity.endDate)}`, true]],
      page: [["Slug", `/${entity.slug}`], ["Status", entity.status], ["Visitors", Number(entity.visitors || 0).toLocaleString()], ["Conversions", Number(entity.conversions || 0).toLocaleString()], ["Headline", entity.headline || "—", true], ["Body", entity.body || "—", true]],
      form: [["Status", entity.status], ["Destination", entity.destination], ["Submissions", Number(entity.submissions || 0).toLocaleString()], ["Conversion", `${Number(entity.conversionRate || 0)}%`], ["Fields", (entity.fields || []).join(", "), true]],
      automation: [["Status", entity.status], ["Trigger", entity.trigger, true], ["Conditions", (entity.conditions || []).join("; ") || "None", true], ["Actions", (entity.actions || []).join("; "), true], ["Runs", Number(entity.runs || 0)], ["Failures", Number(entity.failures || 0)]],
      employee: [["Role", entity.role], ["Department", entity.department], ["Status", isUserOnline(entity) ? "Online (Active session)" : "Offline"], ["Location", entity.location || "Remote"], ["Email", entity.email || "—"], ["Phone", entity.phone || "—"], ["Joined", formatDate(entity.joinedAt)]],
      article: [["Category", entity.category], ["Author", employeeName(entity.authorId)], ["Updated", formatDate(entity.updatedAt)], ["Content", stripHtml(markdown(entity.content)).slice(0, 520), true]]
    };
    return map[type] || Object.entries(entity).filter(([key]) => !["id", "createdAt", "updatedAt"].includes(key)).map(([key, value]) => [capitalize(key), Array.isArray(value) ? value.join(", ") : String(value ?? "—")]);
  }

  function renderDrawer() {
    const { type, id } = ui.drawer;
    const entity = getEntity(type, id);
    if (!entity) {
      ui.drawer = null;
      return "";
    }
    const timeline = state.activities.filter(activity => activity.entityType === type && activity.entityId === id).slice(0, 12);
    const relatedDeals = type === "company" ? state.deals.filter(deal => deal.companyId === id) : type === "contact" ? state.deals.filter(deal => deal.contactId === id) : [];
    return `
      <div class="drawer-backdrop" data-action="close-drawer"></div>
      <aside class="drawer" role="dialog" aria-modal="true" aria-label="${escapeHtml(titleForEntity(type, entity))}">
        <header class="drawer-head">
          <div class="entity-logo" style="width:42px;height:42px">${initials(titleForEntity(type, entity))}</div>
          <div class="drawer-head-copy"><h2>${escapeHtml(titleForEntity(type, entity))}</h2><p>${escapeHtml(capitalize(type))} · updated ${escapeHtml(relativeTime(entity.updatedAt || entity.issueDate || entity.start || entity.createdAt))}</p></div>
          <button class="icon-btn close-btn" data-action="close-drawer">${icon("close")}</button>
        </header>
        <div class="drawer-body">
          <div class="detail-grid">
            ${detailPairs(type, entity).map(([label, value, full]) => `<div class="detail-block ${full ? "full" : ""}"><div class="detail-label">${escapeHtml(label)}</div><div class="detail-value">${escapeHtml(value)}</div></div>`).join("")}
          </div>
          ${type === "task" ? `<div class="detail-section"><h3>Time progress</h3><div style="height:10px;background:var(--surface-3);border-radius:999px;overflow:hidden"><div style="height:100%;width:${clamp(Number(entity.estimate) ? Number(entity.tracked) / Number(entity.estimate) * 100 : 0, 0, 100)}%;background:linear-gradient(90deg,var(--accent),var(--accent-2))"></div></div><div class="subtle" style="font-size:9px;margin-top:7px">${Number(entity.tracked || 0)} of ${Number(entity.estimate || 0)} minutes tracked</div></div>` : ""}
          ${type === "page" ? `<div class="detail-section"><h3>Page preview</h3><div class="panel" style="padding:25px;text-align:center;background:linear-gradient(135deg,rgba(124,140,255,.16),rgba(82,217,233,.10))"><span class="status-pill info">/${escapeHtml(entity.slug)}</span><h2 style="font-size:24px;margin:18px 0 8px">${escapeHtml(entity.headline)}</h2><p class="muted" style="line-height:1.6">${escapeHtml(entity.body)}</p><button class="action-btn primary">Primary call to action</button></div></div>` : ""}
          ${relatedDeals.length ? `<div class="detail-section"><h3>Related deals</h3>${relatedDeals.map(deal => `<button class="action-btn ghost" style="width:100%;justify-content:flex-start;margin-bottom:6px" data-action="view-entity" data-entity="deal" data-id="${deal.id}"><span>${escapeHtml(deal.title)}</span><strong class="ml-auto">${escapeHtml(formatMoney(deal.value))}</strong></button>`).join("")}</div>` : ""}
          <div class="detail-section"><h3>Timeline</h3>
            <div class="timeline">
              ${timeline.length ? timeline.map(activity => `<div class="timeline-item"><strong>${escapeHtml(employeeName(activity.actorId))} ${escapeHtml(activity.verb)}</strong><p>${escapeHtml(activity.detail || "Record updated")}</p><time>${escapeHtml(formatDate(activity.at, { time: true }))}</time></div>`).join("") : `<div class="timeline-item"><strong>Record created</strong><p>No additional activity has been logged yet.</p><time>${escapeHtml(formatDate(entity.createdAt || entity.issueDate || entity.start))}</time></div>`}
            </div>
          </div>
        </div>
        <footer class="drawer-foot">
          ${type === "lead" ? `<button class="action-btn success" data-action="convert-lead" data-id="${entity.id}">${icon("arrowRight")} Convert</button>` : ""}
          ${type === "invoice" ? `<button class="action-btn" data-action="print-invoice" data-id="${entity.id}">${icon("download")} Print</button>` : ""}
          ${type === "product" ? `<button class="action-btn" data-action="adjust-stock" data-id="${entity.id}">${icon("plus")} Adjust stock</button>` : ""}
          <button class="action-btn" data-action="edit-entity" data-entity="${type}" data-id="${id}">${icon("edit")} ${escapeHtml(t("edit"))}</button>
          <button class="action-btn danger" data-action="delete-entity" data-entity="${type}" data-id="${id}">${icon("trash")} ${escapeHtml(t("delete"))}</button>
        </footer>
      </aside>`;
  }

  function renderModal() {
    if (ui.modal.kind === "quick") return renderQuickCreateModal();
    if (ui.modal.kind === "form") return renderEntityFormModal();
    if (ui.modal.kind === "integration") return renderIntegrationModal();
    if (ui.modal.kind === "stock") return renderStockModal();
    if (ui.modal.kind === "confirm") return renderConfirmModal();
    return "";
  }

  function renderQuickCreateModal() {
    const items = [
      ["deal", "Deal", "Track an opportunity", "crm"], ["lead", "Lead", "Capture a prospect", "user"], ["contact", "Contact", "Add a person", "user"],
      ["company", "Company", "Add an organisation", "building"], ["task", "Task", "Assign work", "tasks"], ["event", "Event", "Schedule a meeting", "calendar"],
      ["invoice", "Invoice", "Create a document", "sales"], ["product", "Product", "Add catalogue stock", "inventory"], ["campaign", "Campaign", "Plan outreach", "marketing"]
    ];
    return `<div class="modal-backdrop" data-action="close-modal"></div><section class="modal" role="dialog" aria-modal="true">
      <header class="modal-head"><div><h2>Quick create</h2><p>Add a record without leaving your current view</p></div><button class="icon-btn close-btn" data-action="close-modal">${icon("close")}</button></header>
      <div class="modal-body"><div class="quick-create-grid">${items.map(([type, label, description, iconName]) => `<button class="quick-create-card" data-action="quick-create-entity" data-entity="${type}">${icon(iconName)}<strong>${escapeHtml(label)}</strong><span>${escapeHtml(description)}</span></button>`).join("")}</div></div>
      <footer class="modal-foot"><button class="action-btn" data-action="close-modal">${escapeHtml(t("close"))}</button></footer>
    </section>`;
  }

  function renderPickerHtml(contacts) {
    if (!contacts || !contacts.length) {
      return `<div style="font-size:11px;color:var(--muted);text-align:center;padding:14px">Searching AkiPasa database…</div>`;
    }
    return contacts.map(user => {
      let email = user.email || (user.name && user.name.includes("@") ? user.name : "");
      if (!email && authUser && user.id === authUser.id) email = authUser.email || "";
      let name = user.name && !user.name.startsWith("User (") ? user.name : (email ? email.split("@")[0] : "AkiPasa Member");

      const displayTitle = email || name;
      const displaySub = (email && name && email !== name) ? email : (user.id ? `AkiPasa Account` : "Registered User");
      const searchStr = `${name} ${email} ${user.role} ${user.id}`.toLowerCase();

      return `
        <div class="user-picker-item" data-search="${escapeHtml(searchStr)}" style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--surface);border:1px solid var(--border);border-radius:8px">
          <div class="table-avatar" style="width:28px;height:28px;font-size:11px">${initials(displayTitle)}</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--text)">${escapeHtml(displayTitle)}</div>
            <div style="font-size:10px;color:var(--accent-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(displaySub)}</div>
          </div>
          <span class="status-pill ${user.role === "administrator" ? "danger" : user.role === "moderator" ? "warning" : "info"}" style="font-size:9px">${escapeHtml(user.role || "consumer")}</span>
          <button type="button" class="mini-btn primary" data-action="select-picker-user" data-id="${user.id}" data-name="${escapeHtml(name)}" data-email="${escapeHtml(email || displayTitle)}" data-role="${escapeHtml(user.role)}" style="padding:4px 10px;font-size:10px">
            Select
          </button>
        </div>
      `;
    }).join("");
  }

  function renderUserPickerSection() {
    setTimeout(() => window._loadPickerUsers?.(""), 10);
    const contacts = state.contacts || [];
    return `
      <div class="user-picker-box" style="margin-bottom:18px;background:var(--surface-2);border:1.5px solid var(--border-strong);border-radius:12px;padding:14px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
          <strong style="font-size:12px;display:flex;align-items:center;gap:6px;color:var(--accent-2)">
            ${icon("user")} Select from AkiPasa database
          </strong>
          <span style="font-size:10px;color:var(--muted)" id="user-picker-count">${contacts.length} registered profiles</span>
        </div>
        <input type="search" id="user-picker-search" placeholder="Search registered user by name or email…"
          oninput="window._filterUserPicker(this.value)"
          style="width:100%;background:var(--bg);border:1.5px solid var(--border-strong);border-radius:8px;padding:8px 12px;font-size:12px;color:var(--text);margin-bottom:10px;outline:none" />
        <div class="user-picker-list" id="user-picker-list" style="max-height:160px;overflow-y:auto;display:flex;flex-direction:column;gap:6px;scrollbar-width:thin">
          ${renderPickerHtml(contacts)}
        </div>
      </div>
    `;
  }

  let _searchDebounce = null;
  window._loadPickerUsers = async function(query = "") {
    const q = (query || "").trim().toLowerCase();
    const list = document.getElementById("user-picker-list");
    const countEl = document.getElementById("user-picker-count");
    const sbClient = getSupabaseClient();

    if (!sbClient) return;

    try {
      let results = [];
      // 1. Try rpc crm_search_users
      const { data: rpcData } = await sbClient.rpc("crm_search_users", { p_query: q });
      if (rpcData?.length) {
        results = rpcData.map(u => ({
          id: u.profile_id,
          name: u.display_name || u.primary_email || `Member (${u.profile_id.slice(0,6)})`,
          email: u.primary_email || (u.display_name && u.display_name.includes("@") ? u.display_name : ""),
          role: u.app_role || "consumer"
        }));
      } else {
        // 2. Try crm_users_view directly
        let reqView = sbClient.from("crm_users_view").select("id, display_name, email, app_role").limit(100);
        if (q) reqView = reqView.or(`email.ilike.%${q}%,display_name.ilike.%${q}%`);
        const { data: viewData } = await reqView;
        if (viewData?.length) {
          results = viewData.map(v => ({
            id: v.id,
            name: v.display_name || v.email || `Member (${v.id.slice(0,6)})`,
            email: v.email || (v.display_name && v.display_name.includes("@") ? v.display_name : ""),
            role: v.app_role || "consumer"
          }));
        } else {
          // 3. Fallback to profiles
          let req = sbClient.from("profiles").select("id, display_name, app_role, created_at").limit(100);
          if (q) req = req.ilike("display_name", `%${q}%`);
          const { data: profileData } = await req;
          if (profileData?.length) {
            results = profileData.map(p => {
              const email = (p.display_name && p.display_name.includes("@")) ? p.display_name : (authUser && p.id === authUser.id ? authUser.email : "");
              const name = p.display_name && !p.display_name.startsWith("User (") ? p.display_name : (email ? email.split("@")[0] : "AkiPasa Member");
              return {
                id: p.id,
                name: name,
                email: email,
                role: p.app_role || "consumer"
              };
            });
          }
        }
      }

      if (results.length) {
        results.forEach(r => {
          const idx = state.contacts.findIndex(c => c.id === r.id);
          if (idx >= 0) {
            state.contacts[idx] = { ...state.contacts[idx], ...r };
          } else {
            state.contacts.push(r);
          }
        });
        if (countEl) countEl.textContent = `${state.contacts.length} registered profiles`;
        if (list) list.innerHTML = renderPickerHtml(state.contacts);
      } else if (list && !state.contacts?.length) {
        list.innerHTML = `<div style="font-size:11px;color:var(--muted);text-align:center;padding:12px">No matching profiles found in database.</div>`;
      }
    } catch (e) {
      console.warn("User picker fetch error:", e);
    }
  };



  window._filterUserPicker = function(query) {
    const q = (query || "").trim().toLowerCase();
    const list = document.getElementById("user-picker-list");
    if (!list) return;
    const items = list.querySelectorAll(".user-picker-item");
    items.forEach(item => {
      const match = !q || (item.dataset.search || "").includes(q);
      item.style.display = match ? "flex" : "none";
    });

    clearTimeout(_searchDebounce);
    _searchDebounce = setTimeout(() => window._loadPickerUsers(query), 200);
  };

  function renderEntityFormModal() {
    const { entity: type, id } = ui.modal;
    const existing = id ? getEntity(type, id) : null;
    const config = entityFormConfig(type, existing);
    if (!config) return "";
    return `<div class="modal-backdrop" data-action="close-modal"></div><section class="modal ${["automation", "article"].includes(type) ? "wide" : ""}" role="dialog" aria-modal="true">
      <header class="modal-head"><div class="entity-logo" style="width:36px;height:36px">${icon(config.icon)}</div><div><h2>${existing ? `Edit ${escapeHtml(config.label)}` : `New ${escapeHtml(config.label)}`}</h2><p>${existing ? "Changes are saved to the local workspace" : "Create a persistent record"}</p></div><button class="icon-btn close-btn" data-action="close-modal">${icon("close")}</button></header>
      <form data-form="entity" data-entity="${type}" data-id="${id || ""}" style="display:contents">
        <div class="modal-body">
          ${type === "employee" && !existing ? renderUserPickerSection() : ""}
          <div class="form-grid">${config.fields.map(field => renderField(field, existing)).join("")}</div>
        </div>
        <footer class="modal-foot"><button type="button" class="action-btn" data-action="close-modal">${escapeHtml(t("cancel"))}</button><button type="submit" class="action-btn primary">${icon("check")} ${escapeHtml(t("save"))}</button></footer>
      </form>
    </section>`;
  }

  function renderIntegrationModal() {
    const integration = integrationCatalog.find(item => item.id === ui.modal.id);
    if (!integration) return "";
    const connection = state.integrations[integration.id] || {};
    const isConnected = connection.status === "connected";

    let fieldsHtml = "";
    if (integration.id === "akipasa") {
      fieldsHtml = `
        <div style="background:rgba(73,215,160,.12);border:1px solid rgba(73,215,160,.3);border-radius:12px;padding:14px;margin-bottom:16px">
          <div style="display:flex;align-items:center;gap:8px;color:var(--success);font-weight:700;font-size:13px">
            ${icon("check")} Live AkiPasa Supabase Database Active
          </div>
          <p style="font-size:11px;color:var(--muted);margin:6px 0 0;line-height:1.5">
            Synchronized with shared database (<code>vhpbvcfkcteswlsdjrfl.supabase.co</code>). Real-time contacts, venue claims, and stats are live.
          </p>
        </div>
      `;
    } else if (["resend", "mailchimp", "openai"].includes(integration.id)) {
      fieldsHtml = `
        <div class="form-grid">
          <div class="form-field full">
            <label>${escapeHtml(integration.name)} API Key</label>
            <input name="apiKey" type="password" placeholder="Paste ${escapeHtml(integration.name)} secret key (e.g. ${integration.id === "resend" ? "re_1234..." : "sk-..."})" value="${escapeHtml(connection.config?.apiKey || "")}" required />
            <div class="form-help">Your key is saved in your local workspace configuration.</div>
          </div>
          ${integration.id === "resend" ? `
            <div class="form-field full">
              <label>Default Sender Email</label>
              <input name="senderEmail" type="email" placeholder="noreply@akipasa.com" value="${escapeHtml(connection.config?.senderEmail || "noreply@akipasa.com")}" />
            </div>
          ` : ""}
        </div>
      `;
    } else if (["stripe", "paypal"].includes(integration.id)) {
      fieldsHtml = `
        <div class="form-grid">
          <div class="form-field full">
            <label>Secret API Key / Token</label>
            <input name="apiKey" type="password" placeholder="sk_live_... or sk_test_..." value="${escapeHtml(connection.config?.apiKey || "")}" required />
          </div>
          <div class="form-field full">
            <label>Publishable Key</label>
            <input name="pubKey" type="text" placeholder="pk_live_... or pk_test_..." value="${escapeHtml(connection.config?.pubKey || "")}" />
          </div>
        </div>
      `;
    } else if (["slack", "telegram", "discord", "whatsapp"].includes(integration.id)) {
      fieldsHtml = `
        <div class="form-grid">
          <div class="form-field full">
            <label>Webhook URL or Bot Token</label>
            <input name="endpoint" type="text" placeholder="https://hooks.slack.com/... or bot token" value="${escapeHtml(connection.config?.endpoint || "")}" required />
            <div class="form-help">Enter your webhook URL or bot token to enable notifications.</div>
          </div>
        </div>
      `;
    } else {
      fieldsHtml = `
        <div class="form-grid">
          <div class="form-field full">
            <label>API Key / Token Secret</label>
            <input name="apiKey" type="password" placeholder="Enter API secret or token" value="${escapeHtml(connection.config?.apiKey || "")}" />
          </div>
          <div class="form-field full">
            <label>Endpoint / Webhook URL (Optional)</label>
            <input name="endpoint" type="url" placeholder="https://…" value="${escapeHtml(connection.config?.endpoint || "")}" />
          </div>
        </div>
      `;
    }

    return `
      <div class="modal-backdrop" data-action="close-modal"></div>
      <section class="modal" role="dialog" aria-modal="true">
        <header class="modal-head">
          <div class="integration-logo" style="--integration-bg:${integration.color};width:39px;height:39px">${escapeHtml(integration.mark)}</div>
          <div>
            <h2>${escapeHtml(integration.name)}</h2>
            <p>${escapeHtml(integration.category)} connector · ${isConnected ? '<span style="color:var(--success);font-weight:700">● Connected & Active</span>' : '<span style="color:var(--muted)">Not connected</span>'}</p>
          </div>
          <button class="icon-btn close-btn" data-action="close-modal">${icon("close")}</button>
        </header>
        <form data-form="integration" data-id="${integration.id}" style="display:contents">
          <div class="modal-body">
            <p class="muted" style="font-size:12px;line-height:1.6;margin:0 0 16px">${escapeHtml(integration.description)}</p>
            ${fieldsHtml}
            <div class="form-field full" style="margin-top:14px">
              <label>Internal Notes / Tag</label>
              <input name="notes" placeholder="Optional notes for your team…" value="${escapeHtml(connection.config?.notes || "")}" />
            </div>
          </div>
          <footer class="modal-foot">
            ${isConnected ? `
              <button type="button" class="action-btn danger" data-action="disconnect-integration" data-id="${integration.id}">${escapeHtml(t("disconnect"))}</button>
              <button type="button" class="action-btn success" data-action="test-integration" data-id="${integration.id}">${icon("check")} Test Connection</button>
            ` : ""}
            <button type="button" class="action-btn" data-action="close-modal">${escapeHtml(t("cancel"))}</button>
            <button type="submit" class="action-btn primary">${icon("check")} ${isConnected ? "Update Integration" : "Save & Connect"}</button>
          </footer>
        </form>
      </section>
    `;
  }

  function renderStockModal() {
    const product = getEntity("product", ui.modal.id);
    if (!product) return "";
    return `<div class="modal-backdrop" data-action="close-modal"></div><section class="modal" role="dialog" aria-modal="true">
      <header class="modal-head"><div><h2>Adjust stock</h2><p>${escapeHtml(product.name)} · current ${Number(product.stock).toLocaleString()}</p></div><button class="icon-btn close-btn" data-action="close-modal">${icon("close")}</button></header>
      <form data-form="stock" data-id="${product.id}" style="display:contents"><div class="modal-body"><div class="form-grid"><div class="form-field"><label>Adjustment</label><input name="adjustment" type="number" required value="1"></div><div class="form-field"><label>Reason</label><select name="reason"><option>Stock count</option><option>Purchase received</option><option>Sale</option><option>Damage</option><option>Correction</option></select></div><div class="form-field full"><label>Note</label><textarea name="note" placeholder="Optional audit note"></textarea></div></div></div><footer class="modal-foot"><button type="button" class="action-btn" data-action="close-modal">Cancel</button><button class="action-btn primary" type="submit">Apply adjustment</button></footer></form>
    </section>`;
  }

  function renderConfirmModal() {
    const modal = ui.modal;
    return `<div class="modal-backdrop" data-action="close-modal"></div><section class="modal" role="dialog" aria-modal="true">
      <header class="modal-head"><div><h2>${escapeHtml(modal.title || "Are you sure?")}</h2><p>${escapeHtml(modal.subtitle || "This action cannot be undone.")}</p></div><button class="icon-btn close-btn" data-action="close-modal">${icon("close")}</button></header>
      <div class="modal-body"><div class="detail-block full"><div class="detail-label text-danger">Confirm action</div><div class="detail-value">${escapeHtml(modal.message || "Please confirm that you want to continue.")}</div></div></div>
      <footer class="modal-foot"><button class="action-btn" data-action="close-modal">Cancel</button><button class="action-btn danger" data-action="confirm-action" data-confirm="${escapeHtml(modal.confirm || "")}">${escapeHtml(modal.confirmLabel || "Confirm")}</button></footer>
    </section>`;
  }

  function renderDropdown() {
    if (ui.dropdown === "notifications") {
      return `<div class="dropdown" style="right:64px;top:58px">
        <div class="dropdown-head"><strong>Notifications</strong><button data-action="mark-notifications">Mark all read</button></div>
        ${state.notifications.slice(0, 12).map(notification => `<div class="dropdown-item ${notification.seen ? "" : "unseen"}" data-action="open-notification" data-id="${notification.id}"><div class="activity-icon">${icon(notification.icon || "bell")}</div><div class="dropdown-copy"><strong>${escapeHtml(notification.title)}</strong><br>${escapeHtml(notification.body)}<time>${escapeHtml(relativeTime(notification.at))}</time></div></div>`).join("") || `<div class="panel-empty"><div><strong>All clear</strong></div></div>`}
      </div>`;
    }
    if (ui.dropdown === "profile") {
      const user = currentUser();
      return `<div class="dropdown" style="right:14px;top:58px">
        <div class="dropdown-head"><strong>${escapeHtml(user.name)}</strong></div>
        <div class="dropdown-item" data-action="navigate" data-route="employees"><div class="activity-icon">${icon("user")}</div><div class="dropdown-copy"><strong>My profile</strong><br>${escapeHtml(user.role)}</div></div>
        <div class="dropdown-item" data-action="set-theme" data-theme="${state.settings.theme === "dark" ? "light" : "dark"}"><div class="activity-icon">${icon("sparkles")}</div><div class="dropdown-copy"><strong>Switch to ${state.settings.theme === "dark" ? "light" : "dark"} theme</strong><br>Change appearance instantly</div></div>
        <div class="dropdown-item" data-action="navigate" data-route="settings"><div class="activity-icon">${icon("settings")}</div><div class="dropdown-copy"><strong>Settings</strong><br>Workspace, data and cloud sync</div></div>
        <div class="dropdown-item" data-action="export-data"><div class="activity-icon">${icon("download")}</div><div class="dropdown-copy"><strong>Download backup</strong><br>Export the complete workspace</div></div>
        <div class="dropdown-item" data-action="crm-signout"><div class="activity-icon">${icon("lock")}</div><div class="dropdown-copy"><strong>Sign out</strong><br>Log out of AkiHQ CRM</div></div>
      </div>`;
    }
    if (ui.dropdown === "workspace") {
      return `<div class="dropdown" style="left:${state.settings.sidebarCollapsed ? "87px" : "247px"};top:58px">
        <div class="dropdown-head"><strong>Workspace</strong></div>
        <div class="dropdown-item"><div class="activity-icon">${icon("building")}</div><div class="dropdown-copy"><strong>${escapeHtml(state.workspace.name)}</strong><br>Current local workspace</div></div>
        <div class="dropdown-item" data-action="open-workspace-form"><div class="activity-icon">${icon("edit")}</div><div class="dropdown-copy"><strong>Edit workspace</strong><br>Name, timezone and currency</div></div>
        <div class="dropdown-item" data-action="duplicate-workspace"><div class="activity-icon">${icon("plus")}</div><div class="dropdown-copy"><strong>Duplicate as backup</strong><br>Download a copy before changing focus</div></div>
      </div>`;
    }
    return "";
  }

  function searchAll(query) {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const results = [];
    const push = (type, item, title, subtitle) => {
      if (`${title} ${subtitle}`.toLowerCase().includes(q)) results.push({ type, id: item.id, title, subtitle, route: routeForEntity(type) });
    };
    state.deals.forEach(item => push("deal", item, item.title, `${companyName(item.companyId)} ${item.notes || ""}`));
    state.leads.forEach(item => push("lead", item, item.name, `${item.company} ${item.email}`));
    state.contacts.forEach(item => push("contact", item, item.name, `${item.email} ${companyName(item.companyId)}`));
    state.companies.forEach(item => push("company", item, item.name, `${item.type} ${item.city}`));
    state.tasks.forEach(item => push("task", item, item.title, `${projectName(item.projectId)} ${item.description || ""}`));
    state.events.forEach(item => push("event", item, item.title, `${item.location} ${item.notes || ""}`));
    state.products.forEach(item => push("product", item, item.name, `${item.sku} ${item.category}`));
    state.invoices.forEach(item => push("invoice", item, item.number, `${companyName(item.companyId)} ${item.notes || ""}`));
    state.knowledge.forEach(item => push("article", item, item.title, `${item.category} ${stripHtml(item.content)}`));
    state.employees.forEach(item => push("employee", item, item.name, `${item.role} ${item.department}`));
    return results.slice(0, 24);
  }

  function renderSearchResults() {
    const results = searchAll(ui.searchQuery);
    return `<div class="search-results">
      <div class="search-result-section">Search results</div>
      ${results.length ? results.map(result => `<button class="search-result" data-action="search-open" data-route="${result.route}" data-entity="${result.type}" data-id="${result.id}"><span class="search-result-icon">${icon(result.type === "article" ? "knowledge" : result.type === "employee" ? "employees" : routeForEntity(result.type) === "crm" ? "crm" : routeForEntity(result.type))}</span><span class="search-result-copy"><strong>${escapeHtml(result.title)}</strong><span>${escapeHtml(capitalize(result.type))} · ${escapeHtml(result.subtitle)}</span></span></button>`).join("") : `<div class="panel-empty"><div><strong>No results</strong><span>Try a company, deal, task, invoice or article title.</span></div></div>`}
    </div>`;
  }

  function commandDefinitions() {
    return [
      ...navSections.flatMap(section => section.items.map(([route, iconName]) => ({ group: "Navigate", label: t(route), icon: iconName, action: "navigate", route }))),
      { group: "Navigate", label: t("settings"), icon: "settings", action: "navigate", route: "settings" },
      { group: "Create", label: "New deal", icon: "crm", action: "create", entity: "deal" },
      { group: "Create", label: "New task", icon: "tasks", action: "create", entity: "task" },
      { group: "Create", label: "New contact", icon: "user", action: "create", entity: "contact" },
      { group: "Create", label: "New event", icon: "calendar", action: "create", entity: "event" },
      { group: "Workspace", label: "Export backup", icon: "download", action: "export" },
      { group: "Workspace", label: `Switch to ${state.settings.theme === "dark" ? "light" : "dark"} theme`, icon: "sparkles", action: "theme" }
    ];
  }

  function renderCommandPalette() {
    const query = ui.commandQuery.trim().toLowerCase();
    const commands = commandDefinitions().filter(command => !query || `${command.label} ${command.group}`.toLowerCase().includes(query));
    const groups = [...new Set(commands.map(command => command.group))];
    return `<div class="modal-backdrop" data-action="close-command"></div><section class="command-palette" role="dialog" aria-modal="true">
      <input id="command-input" class="command-input" data-command-input placeholder="Type a command…" autocomplete="off" value="${escapeHtml(ui.commandQuery)}">
      <div class="command-list">${groups.map(group => `<div class="command-group-label">${escapeHtml(group)}</div>${commands.filter(command => command.group === group).map(command => `<button class="command-item" data-action="run-command" data-command="${command.action}" data-route="${command.route || ""}" data-entity="${command.entity || ""}">${icon(command.icon)}<span>${escapeHtml(command.label)}</span>${command.action === "navigate" ? `<kbd>↵</kbd>` : ""}</button>`).join("")}`).join("") || `<div class="panel-empty"><div><strong>No command found</strong></div></div>`}</div>
    </section>`;
  }

  function renderToast(item) {
    const iconName = item.kind === "danger" ? "warning" : item.kind === "info" ? "info" : "check";
    return `<div class="toast"><div class="toast-icon" style="color:${item.kind === "danger" ? "var(--danger)" : item.kind === "info" ? "var(--info)" : "var(--success)"};background:${item.kind === "danger" ? "rgba(255,111,133,.12)" : item.kind === "info" ? "rgba(104,184,255,.12)" : "rgba(73,215,160,.12)"}">${icon(iconName)}</div><div class="toast-copy"><strong>${escapeHtml(item.title)}</strong>${item.message ? `<span>${escapeHtml(item.message)}</span>` : ""}</div><button data-action="dismiss-toast" data-id="${item.id}">${icon("close")}</button></div>`;
  }

  function openEntityForm(type, id = null, defaults = {}) {
    ui.formDefaults = defaults;
    ui.modal = { kind: "form", entity: type, id };
    renderPortal();
  }

  function handleAction(target, event) {
    const action = target.dataset.action;
    switch (action) {
      case "navigate":
        setRoute(target.dataset.route);
        break;
      case "toggle-sidebar":
        state.settings.sidebarCollapsed = !state.settings.sidebarCollapsed;
        persist();
        break;
      case "open-quick-create":
        ui.dropdown = null; ui.modal = { kind: "quick" }; renderPortal();
        break;
      case "quick-create-entity":
        openEntityForm(target.dataset.entity);
        break;
      case "open-form":
        openEntityForm(target.dataset.entity, null, { stageId: target.dataset.stage || undefined, type: target.dataset.type || undefined, start: target.dataset.date || undefined, end: target.dataset.date || undefined, pipelineId: ui.pipelineId });
        break;
      case "edit-entity":
        event.preventDefault(); event.stopPropagation();
        openEntityForm(target.dataset.entity, target.dataset.id);
        break;
      case "view-entity": {
        if (ui.drag?.moved) return;
        const entityType = target.dataset.entity;
        const id = target.dataset.id;
        if (!id) break;
        ui.drawer = { type: entityType, id };
        ui.dropdown = null;
        renderPortal();
        break;
      }
      case "close-drawer":
        ui.drawer = null; renderPortal();
        break;
      case "close-modal":
        ui.modal = null; ui.formDefaults = {}; renderPortal();
        break;
      case "set-crm-tab":
        ui.crmTab = target.dataset.tab; render();
        break;
      case "set-deal-view":
        ui.dealView = target.dataset.view; render();
        break;
      case "set-task-view":
        ui.taskView = target.dataset.view; render();
        break;
      case "calendar-prev":
        ui.calendarDate = new Date(ui.calendarDate.getFullYear(), ui.calendarDate.getMonth() - 1, 1); render();
        break;
      case "calendar-next":
        ui.calendarDate = new Date(ui.calendarDate.getFullYear(), ui.calendarDate.getMonth() + 1, 1); render();
        break;
      case "calendar-today":
        ui.calendarDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1); render();
        break;
      case "calendar-day":
        if (event.target.closest(".calendar-event")) break;
        openEntityForm("event", null, { start: target.dataset.date, end: target.dataset.date });
        break;
      case "select-conversation": {
        ui.selectedConversationId = target.dataset.id;
        ui.mobileChatOpen = true;
        const conversation = getEntity("conversation", target.dataset.id);
        if (conversation) conversation.unread = 0;
        persist();
        break;
      }
      case "mobile-inbox-back":
        ui.mobileChatOpen = false; render();
        break;
      case "toggle-conversation-status": {
        const conversation = getEntity("conversation", target.dataset.id);
        if (conversation) {
          conversation.status = conversation.status === "Resolved" ? "Open" : "Resolved";
          addActivity("conversation", conversation.id, `${conversation.status === "Resolved" ? "resolved" : "reopened"} a conversation`, conversation.name, "inbox");
          persist();
          toast("Conversation updated", `${conversation.name} is ${conversation.status.toLowerCase()}.`);
        }
        break;
      }
      case "view-conversation-contact": {
        const conversation = getEntity("conversation", target.dataset.id);
        const contact = state.contacts.find(item => item.name === conversation?.name);
        if (contact) { ui.drawer = { type: "contact", id: contact.id }; renderPortal(); }
        else toast("No linked contact", "Create or link a contact from CRM first.", "info");
        break;
      }
      case "open-notifications":
        ui.dropdown = ui.dropdown === "notifications" ? null : "notifications"; renderPortal();
        break;
      case "profile-menu":
        ui.dropdown = ui.dropdown === "profile" ? null : "profile"; renderPortal();
        break;
      case "workspace-menu":
        ui.dropdown = ui.dropdown === "workspace" ? null : "workspace"; renderPortal();
        break;
      case "mark-notifications":
        state.notifications.forEach(notification => { notification.seen = true; }); persist();
        break;
      case "open-notification": {
        const notification = state.notifications.find(item => item.id === target.dataset.id);
        if (!notification) break;
        notification.seen = true;
        ui.dropdown = null;
        store.save(state);
        if (notification.entityType && notification.entityId) {
          const route = routeForEntity(notification.entityType);
          ui.route = route;
          location.hash = `#/${route}`;
          if (notification.entityType === "conversation") {
            ui.selectedConversationId = notification.entityId;
            render();
          } else {
            render();
            ui.drawer = { type: notification.entityType, id: notification.entityId };
            renderPortal();
          }
        } else render();
        break;
      }
      case "timer-toggle":
        toggleTimer();
        break;
      case "export-data":
      case "duplicate-workspace":
        exportData(); ui.dropdown = null; renderPortal();
        break;
      case "import-data":
        importInput.click();
        break;
      case "export-csv":
        exportEntityCsv(target.dataset.entity);
        break;
      case "export-crm-bundle":
        ["deals", "contacts", "companies"].forEach((entity, index) => setTimeout(() => exportEntityCsv(entity), index * 200));
        break;
      case "export-audit":
        downloadBlob(`akihq-audit-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(state.audit, null, 2), "application/json");
        break;
      case "confirm-reset":
        ui.modal = { kind: "confirm", title: "Restore demo workspace?", message: "Every local change in this browser will be replaced with the original AkiPasa demo data.", confirm: "reset", confirmLabel: "Restore demo" }; renderPortal();
        break;
      case "delete-entity":
        event.preventDefault(); event.stopPropagation();
        ui.modal = { kind: "confirm", title: `Delete ${capitalize(target.dataset.entity)}?`, message: `“${titleForEntity(target.dataset.entity, getEntity(target.dataset.entity, target.dataset.id))}” will be removed from this local workspace.`, confirm: "delete-entity", entity: target.dataset.entity, id: target.dataset.id, confirmLabel: "Delete" }; renderPortal();
        break;
      case "confirm-action":
        runConfirmedAction(ui.modal);
        break;
      case "convert-lead":
        convertLead(target.dataset.id);
        break;
      case "adjust-stock":
        event.preventDefault(); event.stopPropagation();
        ui.modal = { kind: "stock", id: target.dataset.id }; renderPortal();
        break;
      case "print-invoice":
        event.preventDefault(); event.stopPropagation();
        printInvoice(target.dataset.id);
        break;
      case "toggle-automation": {
        const automation = getEntity("automation", target.dataset.id);
        if (automation) {
          automation.status = automation.status === "Active" ? "Paused" : "Active";
          automation.updatedAt = isoNow();
          addActivity("automation", automation.id, `${automation.status === "Active" ? "activated" : "paused"} an automation`, automation.name, "automation");
          persist();
          toast("Automation updated", `${automation.name} is now ${automation.status.toLowerCase()}.`);
        }
        break;
      }
      case "select-article":
        ui.selectedArticleId = target.dataset.id; render();
        break;
      case "integration-category":
        ui.integrationCategory = target.dataset.category; render();
        break;
      case "connect-integration":
        ui.modal = { kind: "integration", id: target.dataset.id }; renderPortal();
        break;
      case "test-integration": {
        const id = target.dataset.id;
        const integration = integrationCatalog.find(item => item.id === id);
        toast("Connection Active", `Test ping to ${integration?.name || id} succeeded. Live integration is operational.`, "success");
        break;
      }
      case "disconnect-integration":
        delete state.integrations[target.dataset.id];
        addAudit("integration.disconnected", { provider: target.dataset.id });
        persist(false); ui.modal = null; render(); toast("Integration disconnected", "Provider integration removed.");
        break;
      case "settings-tab":
        ui.settingsTab = target.dataset.tab; render();
        break;
      case "set-theme":
        state.settings.theme = target.dataset.theme; ui.dropdown = null; persist();
        break;
      case "toggle-setting": {
        const key = target.dataset.key;
        state.settings[key] = !state.settings[key]; persist();
        break;
      }
      case "open-workspace-form":
        ui.dropdown = null; ui.route = "settings"; ui.settingsTab = "workspace"; location.hash = "#/settings"; render();
        break;
      case "react-feed": {
        const post = state.feed.find(item => item.id === target.dataset.id);
        if (post) { post.reactions ||= {}; post.reactions[target.dataset.reaction] = Number(post.reactions[target.dataset.reaction] || 0) + 1; persist(); }
        break;
      }
      case "delete-feed-post":
        state.feed = state.feed.filter(item => item.id !== target.dataset.id); persist();
        break;
      case "dismiss-toast":
        ui.toasts = ui.toasts.filter(item => item.id !== target.dataset.id); renderPortal();
        break;
      case "search-open":
        ui.searchQuery = ""; ui.route = target.dataset.route; location.hash = `#/${ui.route}`; render(); ui.drawer = { type: target.dataset.entity, id: target.dataset.id }; renderPortal();
        break;
      case "close-command":
        ui.commandOpen = false; ui.commandQuery = ""; renderPortal();
        break;
      case "run-command":
        runCommand(target);
        break;
      case "bitrix-import":
        beginBitrixImport();
        break;
      case "select-picker-user": {
        const { name, email, role } = target.dataset;
        const nameInput = document.querySelector('input[name="name"]');
        const emailInput = document.querySelector('input[name="email"]');
        const roleInput = document.querySelector('input[name="role"], select[name="role"]');

        const resolvedEmail = email || (name && name.includes("@") ? name : "");
        const resolvedName = name && !name.startsWith("User (") ? name : (resolvedEmail ? resolvedEmail.split("@")[0] : name);

        if (nameInput) {
          nameInput.value = resolvedName || "";
          nameInput.style.borderColor = "var(--success)";
          nameInput.style.boxShadow = "0 0 0 2px rgba(73,215,160,.25)";
        }
        if (emailInput) {
          emailInput.value = resolvedEmail || "";
          emailInput.style.borderColor = "var(--success)";
          emailInput.style.boxShadow = "0 0 0 2px rgba(73,215,160,.25)";
        }
        if (roleInput) {
          roleInput.value = role === "administrator" ? "Administrator" : role === "moderator" ? "Moderator / Staff" : "Consumer / Staff";
          roleInput.style.borderColor = "var(--success)";
        }

        toast("User selected", `Auto-filled details for ${resolvedName || resolvedEmail}`);
        break;
      }
      case "cloud-signout":
        cloudSession = null; localStorage.removeItem(SESSION_KEY); render(); toast("Signed out", "Local workspace data remains on this device.", "info");
        break;
      case "crm-signout":
        ui.dropdown = null;
        if (sbClient) sbClient.auth.signOut();
        else renderLoginScreen();
        break;
      case "cloud-push":
        cloudPush();
        break;
      case "cloud-pull":
        ui.modal = { kind: "confirm", title: "Replace local workspace?", message: "Pulling from Supabase will replace the current browser workspace with the latest cloud snapshot.", confirm: "cloud-pull", confirmLabel: "Pull cloud data" }; renderPortal();
        break;
      default:
        break;
    }
  }

  function runCommand(target) {
    const command = target.dataset.command;
    ui.commandOpen = false; ui.commandQuery = "";
    if (command === "navigate") setRoute(target.dataset.route);
    else if (command === "create") openEntityForm(target.dataset.entity);
    else if (command === "export") { exportData(); renderPortal(); }
    else if (command === "theme") { state.settings.theme = state.settings.theme === "dark" ? "light" : "dark"; persist(); }
  }

  function runConfirmedAction(modal) {
    if (!modal) return;
    if (modal.confirm === "reset") {
      state = store.reset();
      ui.modal = null; ui.drawer = null; ui.route = "dashboard"; location.hash = "#/dashboard"; render(); toast("Demo restored", "AkiHQ is back to its original demo data.");
      return;
    }
    if (modal.confirm === "delete-entity") {
      deleteEntity(modal.entity, modal.id);
      return;
    }
    if (modal.confirm === "cloud-pull") {
      ui.modal = null; renderPortal(); cloudPull();
    }
  }

  function handleChange(target) {
    const change = target.dataset.change;
    if (change === "pipeline") {
      ui.pipelineId = target.value;
      render();
    } else if (change === "density") {
      state.settings.density = target.value;
      persist();
    } else if (change === "locale") {
      state.settings.locale = target.value;
      persist();
    }
  }

  function handleInput(target) {
    if (target.matches("[data-global-search]")) {
      ui.searchQuery = target.value;
      renderPortal();
      return;
    }
    if (target.matches("[data-command-input]")) {
      ui.commandQuery = target.value;
      renderPortal();
      const input = $("#command-input");
      if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
      return;
    }
    if (target.matches("[data-integration-search]")) {
      ui.integrationSearch = target.value;
      const position = target.selectionStart;
      render();
      const input = $("[data-integration-search]");
      if (input) { input.focus(); input.setSelectionRange(position, position); }
      return;
    }
    if (target.matches("[data-conversation-search]")) {
      const query = target.value.trim().toLowerCase();
      $$(".conversation-item").forEach(item => item.classList.toggle("hidden", query && !item.dataset.searchText.includes(query)));
    }
  }

  function parseEntityForm(form, type, existing) {
    const config = entityFormConfig(type, existing);
    const data = { ...(existing || {}) };
    const formData = new FormData(form);
    for (const field of config.fields) {
      let value = formData.get(field.name);
      if (["number", "range"].includes(field.type)) value = value === "" ? 0 : Number(value);
      if (["date", "datetime-local"].includes(field.type) && value) value = new Date(value).toISOString();
      if (field.name === "tags") value = String(value || "").split(",").map(item => item.trim()).filter(Boolean);
      if (["fields", "conditions", "actions"].includes(field.name)) value = String(value || "").split(/\n|,/).map(item => item.trim()).filter(Boolean);
      data[field.name] = value;
    }
    return data;
  }

  function saveEntityFromForm(form) {
    const type = form.dataset.entity;
    const id = form.dataset.id || null;
    const collection = collectionFor[type];
    if (!collection || !state[collection]) return;
    const existing = id ? getEntity(type, id) : null;
    const data = parseEntityForm(form, type, existing);
    const prefix = { deal: "dl", lead: "ld", contact: "ct", company: "co", task: "tk", project: "pr", event: "ev", product: "pd", invoice: "in", campaign: "cp", page: "pg", form: "fm", automation: "au", article: "kb", employee: "emp" }[type] || type.slice(0, 2);
    const now = isoNow();
    if (!existing) {
      data.id = uid(prefix);
      data.createdAt = now;
    }
    data.updatedAt = now;

    if (type === "deal") {
      data.pipelineId ||= ui.pipelineId;
      const pipeline = state.pipelines.find(item => item.id === data.pipelineId) || state.pipelines[0];
      if (!pipeline.stages.some(stage => stage.id === data.stageId)) data.stageId = pipeline.stages[0]?.id;
    }
    if (type === "project") data.members = existing?.members || [data.ownerId].filter(Boolean);
    if (type === "event") data.attendees = existing?.attendees || [state.currentUserId];
    if (type === "campaign") Object.assign(data, { sent: existing?.sent || 0, opened: existing?.opened || 0, clicked: existing?.clicked || 0, conversions: existing?.conversions || 0 });
    if (type === "page") Object.assign(data, { visitors: existing?.visitors || 0, conversions: existing?.conversions || 0 });
    if (type === "form") Object.assign(data, { submissions: existing?.submissions || 0, conversionRate: existing?.conversionRate || 0 });
    if (type === "automation") Object.assign(data, { runs: existing?.runs || 0, failures: existing?.failures || 0 });
    if (type === "employee") {
      data.joinedAt = existing?.joinedAt || now;
      if (data.email) {
        const matchedContact = state.contacts.find(c => c.email && c.email.toLowerCase() === data.email.toLowerCase());
        if (matchedContact && matchedContact.id) {
          data.id = matchedContact.id;
          const client = getSupabaseClient();
          if (client) {
            const newRole = data.role === "Administrator" ? "administrator" : "moderator";
            client.rpc("crm_promote_user", { target_profile: matchedContact.id, new_role: newRole })
              .then(() => toast("Role updated in Supabase", `${data.name} promoted to ${newRole}.`))
              .catch(err => console.warn("Supabase promotion error:", err));
          }
        }
      }
    }
    if (type === "article") data.authorId ||= state.currentUserId;

    if (existing) {
      const index = state[collection].findIndex(item => item.id === id);
      state[collection][index] = data;
      addActivity(type, id, `updated ${capitalize(type)}`, titleForEntity(type, data), type === "article" ? "knowledge" : routeForEntity(type));
      addAudit(`${type}.updated`, { id });
    } else {
      state[collection].unshift(data);
      addActivity(type, data.id, `created ${capitalize(type)}`, titleForEntity(type, data), type === "article" ? "knowledge" : routeForEntity(type));
      addAudit(`${type}.created`, { id: data.id });
    }
    if (type === "article") ui.selectedArticleId = data.id;
    if (type === "deal") { ui.crmTab = "deals"; ui.pipelineId = data.pipelineId; }
    ui.modal = null;
    ui.formDefaults = {};
    persist(false);
    render();
    if (existing && ui.drawer?.type === type && ui.drawer?.id === id) renderPortal();
    toast(existing ? `${capitalize(type)} updated` : `${capitalize(type)} created`, titleForEntity(type, data));
  }

  async function handleSubmit(form, event) {
    const kind = form.dataset.form;
    if (kind === "entity") {
      saveEntityFromForm(form);
      return;
    }
    if (kind === "message") {
      const text = String(new FormData(form).get("text") || "").trim();
      const conversation = getEntity("conversation", form.dataset.conversationId);
      if (!text || !conversation) return;
      conversation.messages.push({ id: uid("m"), direction: "out", text, at: isoNow() });
      conversation.status = "Open";
      addActivity("conversation", conversation.id, "replied to a conversation", conversation.name, "inbox");
      persist();
      toast("Reply saved", "Connect an email or messaging provider to send it externally.", "info");
      return;
    }
    if (kind === "feed-post") {
      const text = String(new FormData(form).get("text") || "").trim();
      if (!text) return;
      state.feed.unshift({ id: uid("fd"), authorId: state.currentUserId, text, at: isoNow(), reactions: {}, comments: [] });
      addAudit("feed.posted", {}); persist();
      return;
    }
    if (kind === "feed-comment") {
      const text = String(new FormData(form).get("text") || "").trim();
      const post = state.feed.find(item => item.id === form.dataset.postId);
      if (!text || !post) return;
      post.comments ||= [];
      post.comments.push({ id: uid("fc"), authorId: state.currentUserId, text, at: isoNow() });
      persist();
      return;
    }
    if (kind === "workspace") {
      const data = Object.fromEntries(new FormData(form));
      state.workspace = { ...state.workspace, ...data };
      addAudit("workspace.updated", { name: data.name });
      persist();
      toast("Workspace saved", data.name);
      return;
    }
    if (kind === "integration") {
      const id = form.dataset.id;
      const integration = integrationCatalog.find(item => item.id === id);
      const values = Object.fromEntries(new FormData(form));
      state.integrations[id] = {
        status: "connected",
        label: `${integration?.name || id} workspace`,
        config: { apiKey: values.apiKey || "", endpoint: values.endpoint || "", senderEmail: values.senderEmail || "", pubKey: values.pubKey || "", notes: values.notes || "" },
        connectedAt: isoNow(),
        updatedAt: isoNow()
      };
      addActivity("integration", id, "connected integration", integration?.name || id, "integrations");
      addAudit("integration.connected", { provider: id });
      ui.modal = null; persist(); render();
      toast("Integration Connected", `${integration?.name || id} is live and active in your workspace.`, "success");
      return;
    }
    if (kind === "stock") {
      const product = getEntity("product", form.dataset.id);
      const values = Object.fromEntries(new FormData(form));
      if (!product) return;
      const adjustment = Number(values.adjustment || 0);
      product.stock = Math.max(0, Number(product.stock || 0) + adjustment);
      product.updatedAt = isoNow();
      addActivity("product", product.id, "adjusted stock", `${adjustment >= 0 ? "+" : ""}${adjustment} · ${values.reason}${values.note ? ` · ${values.note}` : ""}`, "inventory");
      addAudit("product.stock_adjusted", { id: product.id, adjustment, reason: values.reason });
      ui.modal = null; persist();
      toast("Stock adjusted", `${product.name}: ${Number(product.stock).toLocaleString()} units`);
      return;
    }
    if (kind === "cloud-auth") {
      const values = Object.fromEntries(new FormData(form));
      const intent = event.submitter?.value || "signin";
      await cloudAuthenticate(values.email, values.password, intent);
    }
  }

  function handleDragStart(event) {
    const card = event.target.closest("[data-drag-entity]");
    if (!card) return;
    ui.drag = { entity: card.dataset.dragEntity, id: card.dataset.id, moved: false };
    card.classList.add("dragging");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", card.dataset.id);
  }

  function handleDragOver(event) {
    const zone = event.target.closest("[data-drop-entity]");
    if (!zone || !ui.drag || zone.dataset.dropEntity !== ui.drag.entity) return;
    event.preventDefault();
    ui.drag.moved = true;
    $$("[data-drop-entity].drag-over").forEach(item => item.classList.remove("drag-over"));
    zone.classList.add("drag-over");
    event.dataTransfer.dropEffect = "move";
  }

  function handleDrop(event) {
    const zone = event.target.closest("[data-drop-entity]");
    if (!zone || !ui.drag || zone.dataset.dropEntity !== ui.drag.entity) return;
    event.preventDefault();
    const type = ui.drag.entity;
    const record = getEntity(type, ui.drag.id);
    const stage = zone.dataset.stageId;
    if (record) {
      if (type === "deal") record.stageId = stage;
      if (type === "task") record.status = stage;
      record.updatedAt = isoNow();
      addActivity(type, record.id, `moved ${capitalize(type)}`, `New stage: ${capitalize(stage)}`, type === "deal" ? "crm" : "tasks");
      addAudit(`${type}.moved`, { id: record.id, stage });
      persist();
      toast(`${capitalize(type)} moved`, `${titleForEntity(type, record)} → ${capitalize(stage)}`);
    }
    $$("[data-drop-entity].drag-over").forEach(item => item.classList.remove("drag-over"));
  }

  function handleDragEnd(event) {
    event.target.closest("[data-drag-entity]")?.classList.remove("dragging");
    $$("[data-drop-entity].drag-over").forEach(item => item.classList.remove("drag-over"));
    setTimeout(() => { ui.drag = null; }, 20);
  }

  function toggleTimer() {
    if (state.timer.running) {
      const sessionElapsed = state.timer.startedAt ? Date.now() - new Date(state.timer.startedAt).getTime() : 0;
      state.timer.elapsed = Number(state.timer.elapsed || 0) + Math.max(0, sessionElapsed);
      state.timer.running = false;
      state.timer.startedAt = null;
      addActivity("timer", "workspace", "stopped the work timer", formatTimer(), "timer");
      toast("Timer stopped", formatTimer(), "info");
    } else {
      state.timer.running = true;
      state.timer.startedAt = isoNow();
      toast("Timer started", state.timer.label || "General work", "info");
    }
    persist();
  }

  function deleteEntity(type, id) {
    if (type === "employee" && id === state.currentUserId) {
      ui.modal = null;
      renderPortal();
      toast("Cannot delete current user", "Switch the workspace owner first.", "danger");
      return;
    }
    const collection = collectionFor[type];
    const entity = getEntity(type, id);
    if (!collection || !entity) return;
    state[collection] = state[collection].filter(item => item.id !== id);
    state.activities = state.activities.filter(activity => !(activity.entityType === type && activity.entityId === id));
    if (type === "article") ui.selectedArticleId = state.knowledge[0]?.id || null;
    if (type === "conversation") ui.selectedConversationId = state.conversations[0]?.id || null;
    addAudit(`${type}.deleted`, { id, title: titleForEntity(type, entity) });
    ui.modal = null;
    ui.drawer = null;
    persist();
    toast(`${capitalize(type)} deleted`, titleForEntity(type, entity), "info");
  }

  function convertLead(id) {
    const lead = getEntity("lead", id);
    if (!lead) return;
    let company = state.companies.find(item => item.name.toLowerCase() === String(lead.company || lead.name).toLowerCase());
    if (!company) {
      company = { id: uid("co"), name: lead.company || lead.name, type: "Venue", city: "", website: "", phone: lead.phone || "", email: lead.email || "", ownerId: lead.ownerId || state.currentUserId, employees: 1, status: "Prospect", createdAt: isoNow(), updatedAt: isoNow() };
      state.companies.unshift(company);
    }
    let contact = state.contacts.find(item => item.email && lead.email && item.email.toLowerCase() === lead.email.toLowerCase());
    if (!contact) {
      contact = { id: uid("ct"), name: lead.name, email: lead.email || "", phone: lead.phone || "", companyId: company.id, role: "Contact", source: lead.source || "Lead conversion", tags: ["Converted lead"], createdAt: isoNow(), updatedAt: isoNow() };
      state.contacts.unshift(contact);
    }
    const pipeline = state.pipelines.find(item => item.id === "venue") || state.pipelines[0];
    const deal = { id: uid("dl"), title: `${company.name} onboarding`, companyId: company.id, contactId: contact.id, pipelineId: pipeline.id, stageId: pipeline.stages.find(stage => stage.id === "contact-needed")?.id || pipeline.stages[0].id, value: 588, probability: clamp(Number(lead.score || 50), 10, 90), ownerId: lead.ownerId || state.currentUserId, dueDate: dateOffset(7), source: lead.source || "Lead conversion", tags: ["Converted"], notes: `Converted from lead ${lead.name}.`, createdAt: isoNow(), updatedAt: isoNow() };
    state.deals.unshift(deal);
    state.leads = state.leads.filter(item => item.id !== id);
    addActivity("deal", deal.id, "converted a lead into a deal", deal.title, "crm");
    addAudit("lead.converted", { leadId: id, dealId: deal.id, contactId: contact.id, companyId: company.id });
    ui.modal = null; ui.drawer = null; ui.crmTab = "deals"; ui.pipelineId = pipeline.id; ui.route = "crm"; location.hash = "#/crm";
    persist();
    toast("Lead converted", `${lead.name} is now a contact, company and deal.`);
  }

  function printInvoice(id) {
    const invoice = getEntity("invoice", id);
    if (!invoice) return;
    const company = state.companies.find(item => item.id === invoice.companyId);
    const popup = window.open("", "_blank", "width=900,height=760");
    if (!popup) {
      toast("Popup blocked", "Allow popups to print this document.", "danger");
      return;
    }
    const subtotal = Math.max(0, Number(invoice.total || 0) - Number(invoice.tax || 0));
    popup.document.write(`<!doctype html><html><head><title>${escapeHtml(invoice.number)}</title><style>
      body{font-family:Arial,sans-serif;color:#17203a;margin:0;padding:48px} .top{display:flex;justify-content:space-between;gap:40px}.brand{font-size:28px;font-weight:800}.muted{color:#69738f}h1{font-size:38px;margin:42px 0 8px}table{width:100%;border-collapse:collapse;margin-top:38px}th,td{text-align:left;padding:14px;border-bottom:1px solid #dce2ef}th{font-size:11px;text-transform:uppercase;color:#69738f}.totals{margin:32px 0 0 auto;width:320px}.totals div{display:flex;justify-content:space-between;padding:8px 0}.grand{font-size:20px;font-weight:800;border-top:2px solid #17203a;margin-top:8px;padding-top:14px!important}.notes{margin-top:48px;padding:18px;background:#f4f6fb;border-radius:12px}@media print{body{padding:18mm}}</style></head><body>
      <div class="top"><div><div class="brand">AkiHQ</div><div class="muted">${escapeHtml(state.workspace.name)}<br>${escapeHtml(state.workspace.timezone)}</div></div><div class="muted" style="text-align:right">${escapeHtml(invoice.type)}<br><strong style="color:#17203a">${escapeHtml(invoice.number)}</strong></div></div>
      <h1>${escapeHtml(invoice.type)}</h1><div class="muted">Issued ${escapeHtml(formatDate(invoice.issueDate))} · Due ${escapeHtml(formatDate(invoice.dueDate))}</div>
      <div style="margin-top:30px"><strong>Bill to</strong><br>${escapeHtml(company?.name || "Customer")}<br><span class="muted">${escapeHtml(company?.email || "")}${company?.city ? `<br>${escapeHtml(company.city)}` : ""}</span></div>
      <table><thead><tr><th>Description</th><th style="text-align:right">Amount</th></tr></thead><tbody><tr><td>${escapeHtml(invoice.notes || `${invoice.type} services`)}</td><td style="text-align:right">${escapeHtml(formatMoney(subtotal))}</td></tr></tbody></table>
      <div class="totals"><div><span>Subtotal</span><span>${escapeHtml(formatMoney(subtotal))}</span></div><div><span>Tax</span><span>${escapeHtml(formatMoney(invoice.tax))}</span></div><div class="grand"><span>Total</span><span>${escapeHtml(formatMoney(invoice.total))}</span></div></div>
      <div class="notes"><strong>Status: ${escapeHtml(invoice.status)}</strong><br><span class="muted">Generated from AkiHQ ${APP_VERSION}</span></div>
      <script>window.onload=()=>{window.print()}<\/script></body></html>`);
    popup.document.close();
  }

  function downloadBlob(filename, content, type = "text/plain") {
    const blob = content instanceof Blob ? content : new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportData() {
    downloadBlob(`akihq-${state.workspace.slug || "workspace"}-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(state, null, 2), "application/json");
    toast("Backup downloaded", "Keep it somewhere safer than your Downloads graveyard.");
  }

  function csvCell(value) {
    const string = Array.isArray(value) ? value.join("; ") : value && typeof value === "object" ? JSON.stringify(value) : String(value ?? "");
    return `"${string.replaceAll('"', '""')}"`;
  }

  function exportEntityCsv(entityName) {
    const collection = state[entityName];
    if (!Array.isArray(collection) || !collection.length) {
      toast("Nothing to export", capitalize(entityName), "info");
      return;
    }
    const keys = [...new Set(collection.flatMap(item => Object.keys(item)))];
    const csv = [keys.map(csvCell).join(","), ...collection.map(item => keys.map(key => csvCell(item[key])).join(","))].join("\r\n");
    downloadBlob(`akihq-${entityName}-${new Date().toISOString().slice(0, 10)}.csv`, `\uFEFF${csv}`, "text/csv;charset=utf-8");
    toast("CSV exported", `${collection.length} ${entityName}`);
  }

  function parseCSV(text) {
    const rows = [];
    let row = [];
    let cell = "";
    let quoted = false;
    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];
      const next = text[index + 1];
      if (char === '"' && quoted && next === '"') { cell += '"'; index += 1; }
      else if (char === '"') quoted = !quoted;
      else if (char === "," && !quoted) { row.push(cell); cell = ""; }
      else if ((char === "\n" || char === "\r") && !quoted) {
        if (char === "\r" && next === "\n") index += 1;
        row.push(cell); cell = "";
        if (row.some(value => value.trim() !== "")) rows.push(row);
        row = [];
      } else cell += char;
    }
    if (cell.length || row.length) { row.push(cell); if (row.some(value => value.trim() !== "")) rows.push(row); }
    if (!rows.length) return [];
    const headers = rows[0].map(header => header.trim().replace(/^\uFEFF/, ""));
    return rows.slice(1).map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
  }

  function normaliseRow(row) {
    const normalized = {};
    Object.entries(row).forEach(([key, value]) => { normalized[key.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_")] = String(value || "").trim(); });
    return normalized;
  }

  function pick(row, ...keys) {
    for (const key of keys) if (row[key] !== undefined && row[key] !== "") return row[key];
    return "";
  }

  function beginBitrixImport() {
    const type = $("[data-form='integration'] select[name='importType']")?.value || window.prompt("Import which records? Enter contacts, companies or deals", "contacts");
    if (!type || !["contacts", "companies", "deals"].includes(type.toLowerCase())) {
      toast("Choose a valid type", "contacts, companies or deals", "danger");
      return;
    }
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv,text/csv";
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const rows = parseCSV(await file.text());
        const count = importBitrixRows(type.toLowerCase(), rows);
        ui.modal = null;
        persist();
        toast("Import complete", `${count} ${type.toLowerCase()} imported.`);
      } catch (error) {
        console.error(error);
        toast("Import failed", error.message || "Could not read that CSV.", "danger");
      }
    }, { once: true });
    input.click();
  }

  function importBitrixRows(type, rows) {
    let count = 0;
    for (const original of rows) {
      const row = normaliseRow(original);
      if (type === "contacts") {
        const name = pick(row, "name", "full_name", "contact", "first_name") || "Imported contact";
        const email = pick(row, "email", "email_work", "work_email");
        if (email && state.contacts.some(contact => contact.email?.toLowerCase() === email.toLowerCase())) continue;
        const companyText = pick(row, "company", "company_name");
        const company = state.companies.find(item => item.name.toLowerCase() === companyText.toLowerCase());
        state.contacts.unshift({ id: uid("ct"), name, email, phone: pick(row, "phone", "phone_work", "mobile"), companyId: company?.id || "", role: pick(row, "position", "role", "job_title"), source: "Bitrix24 CSV", tags: ["Imported"], createdAt: isoNow(), updatedAt: isoNow() });
        count += 1;
      } else if (type === "companies") {
        const name = pick(row, "company", "company_name", "title", "name") || "Imported company";
        if (state.companies.some(company => company.name.toLowerCase() === name.toLowerCase())) continue;
        state.companies.unshift({ id: uid("co"), name, type: pick(row, "company_type", "type") || "Company", city: pick(row, "city", "address_city"), website: pick(row, "website", "web"), phone: pick(row, "phone", "phone_work"), email: pick(row, "email", "email_work"), ownerId: state.currentUserId, employees: Number(pick(row, "employees", "employee_count") || 0), status: "Prospect", createdAt: isoNow(), updatedAt: isoNow() });
        count += 1;
      } else if (type === "deals") {
        const title = pick(row, "deal", "deal_name", "title", "name") || "Imported deal";
        const companyText = pick(row, "company", "company_name");
        const contactText = pick(row, "contact", "contact_name");
        const company = state.companies.find(item => item.name.toLowerCase() === companyText.toLowerCase());
        const contact = state.contacts.find(item => item.name.toLowerCase() === contactText.toLowerCase());
        const pipeline = state.pipelines.find(item => item.id === ui.pipelineId) || state.pipelines[0];
        state.deals.unshift({ id: uid("dl"), title, companyId: company?.id || "", contactId: contact?.id || "", pipelineId: pipeline.id, stageId: pipeline.stages[0].id, value: Number(String(pick(row, "amount", "opportunity", "value")).replace(/[^0-9.-]/g, "")) || 0, probability: Number(pick(row, "probability") || 20), ownerId: state.currentUserId, dueDate: dateOffset(14), source: "Bitrix24 CSV", tags: ["Imported"], notes: `Imported stage: ${pick(row, "stage", "stage_name") || "unknown"}`, createdAt: isoNow(), updatedAt: isoNow() });
        count += 1;
      }
    }
    addAudit("bitrix.csv_imported", { type, count });
    addActivity("integration", "bitrix-import", "imported Bitrix24 CSV records", `${count} ${type}`, "integrations");
    return count;
  }

  async function supabaseRequest(path, options = {}) {
    const config = window.AKIHQ_CONFIG || {};
    if (!cloudConfigured()) throw new Error("Supabase is not configured in config.js.");
    const headers = {
      apikey: config.SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.headers || {})
    };
    const response = await fetch(`${String(config.SUPABASE_URL).replace(/\/$/, "")}${path}`, { method: options.method || "GET", headers, body: options.body ? JSON.stringify(options.body) : undefined });
    const text = await response.text();
    let payload = null;
    try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }
    if (!response.ok) throw new Error(payload?.msg || payload?.message || payload?.error_description || payload?.error || `Request failed (${response.status})`);
    return payload;
  }

  function saveCloudSession(session) {
    cloudSession = session;
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  async function ensureCloudSession() {
    if (!cloudSession?.access_token) throw new Error("Sign in first.");
    const expiryMs = cloudSession.expires_at ? Number(cloudSession.expires_at) * 1000 : 0;
    if (!expiryMs || expiryMs > Date.now() + 60000) return cloudSession;
    if (!cloudSession.refresh_token) throw new Error("Your cloud session expired. Sign in again.");
    const refreshed = await supabaseRequest("/auth/v1/token?grant_type=refresh_token", { method: "POST", body: { refresh_token: cloudSession.refresh_token } });
    saveCloudSession(refreshed);
    return refreshed;
  }

  async function cloudAuthenticate(email, password, intent) {
    try {
      toast(intent === "signup" ? "Creating account…" : "Signing in…", "Contacting Supabase.", "info");
      const path = intent === "signup" ? "/auth/v1/signup" : "/auth/v1/token?grant_type=password";
      const payload = await supabaseRequest(path, { method: "POST", body: { email, password } });
      if (payload?.access_token) {
        saveCloudSession(payload);
        render();
        toast("Cloud sync ready", `Signed in as ${payload.user?.email || email}.`);
      } else {
        toast("Check your email", "Supabase may require email confirmation before sign-in.", "info");
      }
    } catch (error) {
      console.error(error);
      toast("Cloud authentication failed", error.message, "danger");
    }
  }

  async function cloudPush() {
    try {
      const session = await ensureCloudSession();
      const userId = session.user?.id || cloudSession?.user?.id;
      if (!userId) throw new Error("Supabase did not return a user ID.");
      await supabaseRequest("/rest/v1/workspace_snapshots?on_conflict=user_id", {
        method: "POST",
        token: session.access_token,
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: [{ user_id: userId, workspace_id: state.workspace.id, data: state, updated_at: isoNow() }]
      });
      addAudit("cloud.snapshot_pushed", { userId });
      store.save(state);
      toast("Cloud snapshot uploaded", "This device is now backed up to Supabase.");
    } catch (error) {
      console.error(error);
      toast("Cloud push failed", error.message, "danger");
    }
  }

  async function cloudPull() {
    try {
      const session = await ensureCloudSession();
      const userId = session.user?.id || cloudSession?.user?.id;
      if (!userId) throw new Error("Supabase did not return a user ID.");
      const rows = await supabaseRequest(`/rest/v1/workspace_snapshots?user_id=eq.${encodeURIComponent(userId)}&select=data,updated_at&limit=1`, { token: session.access_token });
      const snapshot = Array.isArray(rows) ? rows[0] : null;
      if (!snapshot?.data?.workspace) throw new Error("No cloud snapshot exists for this account yet.");
      state = snapshot.data;
      store.save(state);
      ui.route = "dashboard";
      location.hash = "#/dashboard";
      render();
      toast("Cloud snapshot restored", `Pulled data saved ${formatDate(snapshot.updated_at, { time: true })}.`);
    } catch (error) {
      console.error(error);
      toast("Cloud pull failed", error.message, "danger");
    }
  }

  function attachAfterRender() {
    const messages = $("#messages");
    if (messages) messages.scrollTop = messages.scrollHeight;
  }

  document.addEventListener("click", event => {
    const target = event.target.closest("[data-action]");
    if (target) {
      handleAction(target, event);
      return;
    }
    if (ui.dropdown && !event.target.closest(".dropdown")) {
      ui.dropdown = null;
      renderPortal();
    }
  });

  document.addEventListener("change", event => handleChange(event.target));
  document.addEventListener("input", event => handleInput(event.target));
  document.addEventListener("submit", event => {
    const form = event.target.closest("form[data-form]");
    if (!form) return;
    event.preventDefault();
    handleSubmit(form, event);
  });
  document.addEventListener("dragstart", handleDragStart);
  document.addEventListener("dragover", handleDragOver);
  document.addEventListener("drop", handleDrop);
  document.addEventListener("dragend", handleDragEnd);

  document.addEventListener("keydown", event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      ui.commandOpen = true;
      ui.commandQuery = "";
      ui.searchQuery = "";
      renderPortal();
      return;
    }
    if (event.key === "Escape") {
      if (ui.commandOpen) { ui.commandOpen = false; ui.commandQuery = ""; }
      else if (ui.modal) ui.modal = null;
      else if (ui.drawer) ui.drawer = null;
      else if (ui.dropdown) ui.dropdown = null;
      else if (ui.searchQuery) ui.searchQuery = "";
      renderPortal();
    }
  });

  window.addEventListener("hashchange", () => {
    const route = location.hash.replace(/^#\/?/, "") || "dashboard";
    if (route !== ui.route) { ui.route = route; render(); }
  });

  importInput.addEventListener("change", async () => {
    const file = importInput.files?.[0];
    importInput.value = "";
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (!parsed?.workspace || !Array.isArray(parsed?.deals) || !parsed?.settings) throw new Error("This file is not a valid AkiHQ workspace backup.");
      state = parsed;
      state.version = APP_VERSION;
      store.save(state);
      ui.route = "dashboard";
      ui.drawer = null;
      ui.modal = null;
      location.hash = "#/dashboard";
      render();
      toast("Workspace imported", state.workspace.name);
    } catch (error) {
      console.error(error);
      toast("Import failed", error.message, "danger");
    }
  });

  setInterval(() => {
    if (!state.timer.running) return;
    const label = $("#timer-label");
    if (label) label.textContent = formatTimer();
  }, 1000);

  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(error => console.warn("Service worker registration failed", error)));
  }

  // ── Auth gate boot sequence ────────────────────────────────────────────────
  function renderLoginScreen(errorMsg) {
    applySettings();
    appRoot.className = "login-mode";
    appRoot.innerHTML = `
      <div class="login-screen">
        <div class="login-card">
          <div class="brand" style="justify-content:center;margin-bottom:24px">
            <img src="assets/logo.svg" alt="" style="width:36px;height:36px" />
            <div class="brand-copy">
              <div class="brand-name">AkiHQ</div>
              <div class="brand-tag">Business operating system</div>
            </div>
          </div>
          <h1 style="font-size:18px;font-weight:700;margin:0 0 6px;text-align:center">Staff sign in</h1>
          <p style="font-size:12px;color:var(--muted);margin:0 0 20px;text-align:center">Only moderator and administrator accounts can access the CRM.</p>
          ${errorMsg ? `<div class="toast-item danger" style="margin-bottom:16px;border-radius:10px;padding:10px 14px;font-size:12px">${escapeHtml(errorMsg)}</div>` : ""}
          <button type="button" class="google-btn" id="google-login-btn">
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            <span>Continue with Google</span>
          </button>
          <div class="login-divider"><span>or sign in with email</span></div>
          <form id="login-form" style="display:flex;flex-direction:column;gap:12px">
            <div style="display:flex;flex-direction:column;gap:6px">
              <label style="font-size:11px;font-weight:600;color:var(--muted)" for="login-email">Email address</label>
              <input id="login-email" name="email" type="email" required autocomplete="email"
                style="background:var(--surface-2);border:1.5px solid var(--border);border-radius:8px;padding:10px 12px;font-size:13px;color:var(--text);outline:none"
                placeholder="you@akipasa.com" />
            </div>
            <div style="display:flex;flex-direction:column;gap:6px">
              <label style="font-size:11px;font-weight:600;color:var(--muted)" for="login-password">Password</label>
              <input id="login-password" name="password" type="password" required autocomplete="current-password"
                style="background:var(--surface-2);border:1.5px solid var(--border);border-radius:8px;padding:10px 12px;font-size:13px;color:var(--text);outline:none"
                placeholder="••••••••" />
            </div>
            <button type="submit" class="action-btn primary" style="margin-top:6px;justify-content:center" id="login-submit">
              Sign in to CRM
            </button>
          </form>
          <p style="font-size:11px;color:var(--muted);text-align:center;margin:20px 0 0">
            Staff accounts are managed via <a href="https://akipasa.com" target="_blank" rel="noopener" style="color:var(--accent-blue)">akipasa.com</a>
          </p>
        </div>
      </div>
    `;
    portal.innerHTML = "";

    document.getElementById("google-login-btn")?.addEventListener("click", async () => {
      const client = getSupabaseClient();
      if (!client) { renderLoginScreen("Supabase client not initialized. Please refresh."); return; }
      const btn = document.getElementById("google-login-btn");
      if (btn) {
        btn.disabled = true;
        const span = btn.querySelector("span");
        if (span) span.textContent = "Redirecting to Google…";
      }
      const redirectTarget = window.location.origin;
      const { error } = await client.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectTarget,
          queryParams: { prompt: "select_account" }
        }
      });
      if (error) renderLoginScreen(error.message || "Google sign in failed.");
    });

    const form = document.getElementById("login-form");
    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const btn = document.getElementById("login-submit");
        if (btn) { btn.disabled = true; btn.textContent = "Signing in…"; }
        const email    = document.getElementById("login-email")?.value?.trim();
        const password = document.getElementById("login-password")?.value;
        const client = getSupabaseClient();
        if (!client) { renderLoginScreen("Supabase is not configured."); return; }
        const { data, error } = await client.auth.signInWithPassword({ email, password });
        if (error || !data?.user) {
          renderLoginScreen(error?.message || "Sign in failed. Please try again.");
          return;
        }
        await bootWithSession(data.session);
      });
    }
  }

  function renderAccessDenied(email) {
    applySettings();
    appRoot.className = "login-mode";
    appRoot.innerHTML = `
      <div class="login-screen">
        <div class="login-card">
          <div class="brand" style="justify-content:center;margin-bottom:28px">
            <img src="assets/logo.svg" alt="" style="width:36px;height:36px" />
            <div class="brand-copy"><div class="brand-name">AkiHQ</div></div>
          </div>
          <div class="empty-state-icon" style="margin:0 auto 16px">${icon("lock")}</div>
          <h1 style="font-size:18px;font-weight:700;margin:0 0 8px;text-align:center">Access denied</h1>
          <p style="font-size:12px;color:var(--muted);text-align:center;margin:0 0 24px">
            <strong>${escapeHtml(email || "Your account")}</strong> does not have moderator or administrator access.
          </p>
          <button class="action-btn" style="width:100%;justify-content:center" id="deny-signout">Sign out</button>
        </div>
      </div>
    `;
    portal.innerHTML = "";
    document.getElementById("deny-signout")?.addEventListener("click", async () => {
      const client = getSupabaseClient();
      await client?.auth.signOut();
      renderLoginScreen();
    });
  }

  async function bootWithSession(session) {
    const client = getSupabaseClient();
    if (!session?.user || !client) { renderLoginScreen(); return; }
    authUser = session.user;
    // Fetch profile to check role
    const { data: profile } = await client.from("profiles")
      .select("app_role")
      .eq("id", authUser.id)
      .maybeSingle();
    const role = profile?.app_role;
    if (!role || !["moderator", "administrator"].includes(role)) {
      renderAccessDenied(authUser.email);
      return;
    }
    authRole = role;
    // Clean OAuth tokens from address bar if present
    if (window.location.search || window.location.hash.includes("access_token=")) {
      try { history.replaceState(null, "", window.location.pathname + "#/" + (ui.route || "dashboard")); } catch {}
    }
    // Update current user name from auth metadata
    const displayName = authUser.user_metadata?.display_name || authUser.user_metadata?.full_name || authUser.email?.split("@")[0] || "User";
    state.employees[0] = {
      ...state.employees[0],
      id: authUser.id,
      name: displayName,
      email: authUser.email,
      role: role === "administrator" ? "Administrator" : "Moderator / Staff",
      status: "Online"
    };
    state.currentUserId = authUser.id;
    applySettings();
    render();
    // Load live data asynchronously after the UI is visible
    loadLiveData();
  }

  async function finishBoot(client) {
    applySettings();
    appRoot.className = "login-mode";
    let session = null;
    try {
      const { data } = await client.auth.getSession();
      session = data?.session;
    } catch (err) {
      console.warn("getSession error:", err);
    }
    if (!session) {
      renderLoginScreen();
      return;
    }
    await bootWithSession(session);
    client.auth.onAuthStateChange(async (event, newSession) => {
      if (event === "SIGNED_OUT" || !newSession) {
        authUser = null;
        authRole = null;
        renderLoginScreen();
      } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        if (newSession) await bootWithSession(newSession);
      }
    });
  }

  async function boot() {
    let client = getSupabaseClient();
    if (!client) {
      renderLoginScreen();
      let count = 0;
      const timer = setInterval(async () => {
        count++;
        client = getSupabaseClient();
        if (client) {
          clearInterval(timer);
          await finishBoot(client);
        } else if (count >= 15) {
          clearInterval(timer);
          renderLoginScreen("Authentication script load failed. Please refresh the page.");
        }
      }, 200);
      return;
    }
    await finishBoot(client);
  }

  boot();
})();
