// AkiHQ public configuration — Supabase anon key is safe to commit (public by design, protected by RLS).
window.AKIHQ_CONFIG = Object.assign({
  SITE_URL:          "https://akipasa.com",
  CRM_URL:           "https://crm.akipasa.com",
  SOCIAL_GATEWAY_URL:"https://akihq-integration-gateway.alexashing1.workers.dev",
  SUPABASE_URL:      "https://vhpbvcfkcteswlsdjrfl.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_Mm4CJvGyIaLOWbU3g1sxIQ_Wv2jrKt1"
}, window.AKIHQ_CONFIG || {});
