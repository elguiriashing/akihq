/* Shared, deterministic parsing rules. SheetJS is vendored at a pinned version. */
(function (root) {
  "use strict";
  const MAX_ROWS = 250000;
  const MAX_BYTES = 50 * 1024 * 1024;
  const fields = ["name", "address", "city", "email", "website", "phone", "type", "source", "externalId"];
  const aliases = {
    name: ["name", "business name", "company", "company name", "business"],
    address: ["address", "full address", "street address"],
    city: ["city", "town", "town city", "locality", "municipality"],
    email: ["email", "e mail"], website: ["website", "website social link", "url"],
    phone: ["phone", "telephone", "mobile"], type: ["type", "category", "business type", "akipasa category", "type of business"],
    source: ["source"], externalId: ["id", "external id"]
  };
  const clean = value => String(value ?? "").normalize("NFKC").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  const header = value => clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  function mapping(headers) {
    return Object.fromEntries(fields.map(field => [field, headers.findIndex(h => aliases[field].includes(header(h)))]));
  }
  function validateMapping(map, width) {
    if (!map || fields.some(f => !Number.isInteger(map[f]) || map[f] < -1 || map[f] >= width)) throw new Error("Choose valid field columns.");
    if (map.name < 0 || map.address < 0) throw new Error("Select a business name and street address column.");
    const selected = fields.map(f => map[f]).filter(i => i >= 0);
    if (new Set(selected).size !== selected.length) throw new Error("Each column can be mapped to only one field.");
  }
  function row(cells, map, sourceRow, formulaColumns = []) {
    const data = Object.fromEntries(fields.map(f => [f, map[f] < 0 ? "" : clean(cells[map[f]])]));
    data.sourceRow = sourceRow;
    let error = "";
    if (fields.some(f => map[f] >= 0 && formulaColumns.includes(map[f]))) error = "Formula cells are not imported. Export values and try again.";
    else if (data.name.length < 2 || data.name.length > 180 || data.address.length < 5 || data.address.length > 300) error = "Name must be 2–180 characters and address 5–300 characters.";
    else if (Object.entries({ city:120,email:254,website:2000,phone:80,type:120,source:2000,externalId:200 }).some(([f, max]) => data[f].length > max)) error = "A field exceeds the supported length.";
    else if (/^[=]/.test(data.name) || /^[=]/.test(data.address)) error = "Formula-like business name or address.";
    if (error) { data.importError = error; data.name = ""; }
    return { data, error };
  }
  const api = { MAX_ROWS, MAX_BYTES, fields, clean, mapping, validateMapping, row };
  root.CompanyImportCore = api;
  if (typeof module !== "undefined") module.exports = api;
})(typeof self !== "undefined" ? self : globalThis);
