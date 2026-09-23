import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const api = require('./assets/commerce-export.js');
const XLSX = require('./assets/vendor/xlsx-0.20.3.min.js');

function client(tables, cap = 2, failAt = Infinity) {
  let calls = 0;
  return { from(table) {
    let filters = [], size = 500;
    const query = {
      select() { return this; }, order() { return this; },
      limit(n) { size = Math.min(n, cap); return this; },
      eq(k, v) { filters.push(r => r[k] === v); return this; },
      gt(k, v) { filters.push(r => r[k] > v); return this; },
      gte(k, v) { filters.push(r => r[k] >= v); return this; },
      lt(k, v) { filters.push(r => r[k] < v); return this; },
      lte(k, v) { filters.push(r => r[k] <= v); return this; },
      in(k, v) { filters.push(r => v.includes(r[k])); return this; },
      then(resolve, reject) {
        const result = ++calls === failAt ? { error: { message: 'permission denied' } } : { data: (tables[table] || []).filter(r => filters.every(f => f(r))).sort((a, b) => a.id.localeCompare(b.id)).slice(0, size) };
        return Promise.resolve(result).then(resolve, reject);
      }
    }; return query;
  }};
}
const options = { workspace: 'ours', mode: 'pos', from: '2026-09-01', through: '2026-09-22', timezone: 'Europe/Madrid' };
const sample = () => ({ ...options, bounds: api.period(options.from, options.through, options.timezone), cutoff: '2026-09-22T23:00:00Z', items: [], movements: [],
  sales: [{ id: 's1', external_id: '=HYPERLINK("bad")', status: 'completed', currency: 'EUR', provider: 'cash', total_cents: 101, tip_cents: 9 }],
  lines: [{ id: 'l1', sale_id: 's1', item_id: 'i1', quantity: 0.5, unit_price_cents: 201 }]
});
test('Madrid inclusive dates use 23 and 25 hour DST days', () => {
  for (const [date, hours] of [['2026-03-29', 23], ['2026-10-25', 25]]) {
    const p = api.period(date, date, 'Europe/Madrid');
    assert.equal((Date.parse(p.until) - Date.parse(p.from)) / 3600000, hours);
  }
  assert.equal(api.period('2026-09-01', '2026-09-01', 'Europe/Madrid').from, '2026-08-31T22:00:00.000Z');
  assert.equal(api.period('2026-09-01', '2026-09-01', 'Atlantic/Canary').from, '2026-08-31T23:00:00.000Z');
});
test('invalid dates, reversed dates and invalid zones fail', () => {
  assert.throws(() => api.period('2026-02-30', '2026-03-01', 'UTC'));
  assert.throws(() => api.period('2026-03-02', '2026-03-01', 'UTC'));
  assert.throws(() => api.period('2026-03-01', '2026-03-01', 'Mars'));
});
test('all rows exported despite server caps, restricted to workspace', async () => {
  const rows = Array.from({ length: 1051 }, (_, i) => ({ id: String(i).padStart(5, '0'), workspace_id: 'ours' }));
  rows.push({ id: '99999', workspace_id: 'other' });
  assert.equal((await api.allRows(client({ t: rows }, 100), 't', '*', 'ours')).length, 1051);
});
test('pagination errors and explicit row cap fail rather than return partial data', async () => {
  const rows = [1,2,3].map(i => ({ id: String(i), workspace_id: 'ours' }));
  await assert.rejects(api.allRows(client({ t: rows }, 2, 2), 't', '*', 'ours'), /permission denied/);
  await assert.rejects(api.allRows(client({ t: rows }), 't', '*', 'ours', [], 2), /exceeds/);
});
test('collect includes parent sale lines but excludes other tenants and periods', async () => {
  const sale = { ...sample().sales[0], workspace_id: 'ours', sold_at: '2026-09-01T10:00:00Z', created_at: '2026-09-01T10:00:00Z' };
  const line = { ...sample().lines[0], workspace_id: 'ours', created_at: sale.created_at };
  const data = await api.collect(client({ crm_pos_sales: [sale, { ...sale, id: 'old', sold_at: '2026-08-01T00:00:00Z' }, { ...sale, id: 'other', workspace_id: 'other' }], crm_pos_sale_lines: [line, { ...line, id: 'oldline', sale_id: 'old' }] }), options);
  assert.deepEqual(data.sales.map(s => s.id), ['s1']); assert.deepEqual(data.lines.map(s => s.id), ['l1']);
});
test('fractional cents round precisely, invalid precision fails', () => {
  assert.equal(api.roundedLine({ quantity: 0.5, unit_price_cents: 201 }), 101);
  assert.equal(api.roundedLine({ quantity: 1.005, unit_price_cents: 100 }), 101);
  for (const quantity of [NaN, Infinity, 0, -1, 0.0001]) assert.throws(() => api.roundedLine({ quantity, unit_price_cents: 100 }));
});
test('reconciliation detects mismatches and missing lines, never invents IVA', () => {
  const data = sample();
  assert.equal(api.sheets(data).Reconciliation[1][4], 'MATCH — TAX UNVERIFIED');
  data.sales[0].total_cents = 100;
  assert.equal(api.sheets(data).Reconciliation[1][4], 'REVIEW MISMATCH');
  data.lines = [];
  assert.equal(api.sheets(data).Reconciliation[1][4], 'MISSING LINES');
  assert.equal(api.sheets(data).Sales[1].at(-1), 'NOT RECORDED');
});
test('totals separate status, currency, tender and tips', () => {
  const data = sample();
  data.sales.push({ ...data.sales[0], id: 's2', status: 'refunded' }, { ...data.sales[0], id: 's3', currency: 'USD' });
  assert.equal(api.sheets(data)['Tender totals'].length, 4);
  assert.deepEqual(api.sheets(data)['Tender totals'][1], ['EUR', 'cash', 'completed', 1, 101, 9]);
});
test('Excel roundtrip preserves text and numbers without formula execution', () => {
  const bytes = XLSX.write(api.workbook(XLSX, sample()), { bookType: 'xlsx', type: 'buffer' });
  const book = XLSX.read(bytes, { type: 'buffer' });
  assert.equal(book.Sheets.Sales.B2.t, 's');
  assert.equal(book.Sheets.Sales.B2.f, undefined);
  assert.equal(book.Sheets.Sales.B2.v, '=HYPERLINK("bad")');
  assert.equal(book.Sheets.Sales.F2.v, 101);
  assert.equal(book.Sheets['Sale lines'].D2.v, 0.5);
});
test('inventory workbook clearly separates current valuation from period movements', () => {
  const data = { ...sample(), mode: 'inventory', sales: [], lines: [], items: [{ id: 'i', sku: '00123', name: '+formula', on_hand: 1.5, cost_cents: 200, sale_price_cents: 250 }] };
  const book = api.workbook(XLSX, data);
  assert.equal(book.Sheets['Current inventory'].G2.v, 300);
  assert.equal(book.Sheets['Current inventory'].B2.v, '00123');
  assert.equal(book.Sheets['Current inventory'].C2.t, 's');
  assert.ok(!book.Sheets.Sales);
});
test('legacy CSV export neutralises spreadsheet formulas and keeps numeric negatives', () => {
  const source = readFileSync(new URL('./assets/app-v32.js', import.meta.url), 'utf8');
  const fn = source.slice(source.indexOf('  function csvCell('), source.indexOf('  function exportEntityCsv('));
  const csvCell = vm.runInNewContext(fn + '; csvCell');
  assert.equal(csvCell(' =1+1'), '"\' =1+1"');
  assert.equal(csvCell(-42), '"-42"');
  assert.equal(csvCell('Málaga, "España"'), '"Málaga, ""España"""');
});
