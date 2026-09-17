"use strict";
importScripts("./vendor/xlsx-0.20.3.min.js", "./company-import-core.js?v=1");
let bytes, sheetNames = [], cells = [], formulas = [], headers = [], fileHash = "";
const core = self.CompanyImportCore;
self.onmessage = async event => {
  const { id, action, payload = {} } = event.data;
  try {
    let result;
    if (action === "open") {
      bytes = payload.bytes;
      if (!bytes?.byteLength || bytes.byteLength > core.MAX_BYTES) throw new Error("Choose an Excel or CSV file up to 50 MB.");
      sheetNames = XLSX.read(bytes, { type:"array", bookSheets:true }).SheetNames;
      fileHash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), b => b.toString(16).padStart(2,"0")).join("");
      result = { sheets:sheetNames, hash:fileHash };
    } else if (action === "sheet") {
      if (!sheetNames.includes(payload.sheet)) throw new Error("Select a worksheet from this file.");
      const workbook = XLSX.read(bytes, { type:"array", sheets:[payload.sheet], dense:true, sheetRows:core.MAX_ROWS+2, cellFormula:true, cellDates:false });
      const sheet = workbook.Sheets[payload.sheet];
      if (!sheet?.["!ref"]) throw new Error("This worksheet is empty.");
      const range = XLSX.utils.decode_range(sheet["!fullref"] || sheet["!ref"]);
      if (range.e.r > core.MAX_ROWS) throw new Error("This worksheet exceeds 250,000 data rows. Split it into smaller files.");
      if (range.e.c > 127) throw new Error("This worksheet exceeds 128 columns.");
      cells = XLSX.utils.sheet_to_json(sheet, { header:1, defval:"", raw:false, blankrows:true, range:0 });
      headers = cells.shift().map(core.clean);
      formulas = cells.map((_, i) => (sheet["!data"]?.[i+1] || []).flatMap((c,j) => c?.f ? [j] : []));
      if (!cells.length) throw new Error("This worksheet has no data rows.");
      result = { headers, total:cells.length, mapping:core.mapping(headers) };
    } else if (action === "preview") {
      core.validateMapping(payload.mapping, headers.length);
      let invalid = 0; const sample = [];
      for (let i=0; i<cells.length; i++) {
        const parsed = core.row(cells[i], payload.mapping, i+2, formulas[i]);
        if (parsed.error) invalid++;
        if (sample.length < 20) sample.push({ ...parsed.data, displayName:core.clean(cells[i][payload.mapping.name]), error:parsed.error });
      }
      result = { total:cells.length, valid:cells.length-invalid, invalid, sample };
    } else if (action === "batch") {
      core.validateMapping(payload.mapping, headers.length);
      const offset=payload.offset;
      if (!Number.isInteger(offset) || offset<0 || offset>=cells.length) throw new Error("Invalid batch position.");
      result = cells.slice(offset,offset+250).map((c,i) => core.row(c,payload.mapping,offset+i+2,formulas[offset+i]).data);
    } else throw new Error("Unknown parser action.");
    self.postMessage({ id, result });
  } catch (error) { self.postMessage({ id, error:error.message || "Unable to read this spreadsheet." }); }
};
