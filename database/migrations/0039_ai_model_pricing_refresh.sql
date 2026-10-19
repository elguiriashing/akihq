begin;

update ai_model_pricing
set
  input_cost_per_million_eur = 0.20,
  output_cost_per_million_eur = 1.20,
  source_note = 'OpenAI GPT-5.6 Luna list price checked 2026-08-11; conservative USD-to-EUR estimate of 1:1',
  updated_at = now()
where provider = 'openai'
  and model = 'gpt-5.6-luna';

commit;
