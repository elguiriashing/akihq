import assert from "node:assert/strict";
import test from "node:test";
import * as XLSX from "xlsx";
import { parseProspectWorkbook } from "./prospect-import.js";

function workbookBuffer(rows) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "Prospect List");
  return XLSX.write(workbook, { type: "array", bookType: "xlsx" });
}

test("maps the full AkiPasa prospect format and sorts by town and rank", () => {
  const parsed = parseProspectWorkbook(workbookBuffer([
    {
      "Rank in Town": 2,
      "Business Name": "Café Dos",
      Town: "Mijas",
      "Akipasa Category": "Gastronomía",
      Address: "C. de los Caños, 3, 29650 Mijas",
      Phone: "+34 600 111 222",
      "Owner/Manager (if known)": "Ana",
      Email: "ANA@EXAMPLE.COM",
      "Google Rating": "4,7",
      "Review Count": "1.400",
      "Pitch Angle": "Local launch partner",
      "CRM Stage": "New Lead",
      Notes: "Priority"
    },
    {
      "Rank in Town": 1,
      "Business Name": "Café Uno",
      Town: "Mijas",
      Address: "Calle Uno, 1, Mijas"
    }
  ]), "sample.xlsx");

  assert.equal(parsed.totalRows, 2);
  assert.equal(parsed.invalid.length, 0);
  assert.equal(parsed.rows[0].businessName, "Café Uno");
  assert.equal(parsed.rows[1].email, "ana@example.com");
  assert.equal(parsed.rows[1].googleRating, 4.7);
  assert.equal(parsed.rows[1].reviewCount, 1400);
  assert.equal(parsed.rows[1].address, "C. de los Caños, 3, 29650 Mijas");
});

test("accepts the minimal upload format and reports invalid rows", () => {
  const parsed = parseProspectWorkbook(workbookBuffer([
    {
      "Business name": "Los Caños",
      "Town / city": "Mijas",
      Address: "C. de los Caños, 3, 29650 Mijas",
      "Type of business / AkiPasa category": "Bar",
      "Contact details (number / email)": "+34 611 222 333 info@example.com",
      "Website / social link": "https://example.com"
    },
    {
      "Business name": "",
      "Town / city": "Mijas",
      Address: ""
    }
  ]));

  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0].phone, "+34 611 222 333");
  assert.equal(parsed.rows[0].email, "info@example.com");
  assert.equal(parsed.invalid.length, 1);
  assert.deepEqual(parsed.invalid[0].reasons, ["Business name is missing"]);
});
