// A small, dependency-free CSV parser — Milestone 7 Part B's remittance
// upload only needs to handle a courier's export (plain text, comma or
// tab separated, RFC4180-style quoting), not a general-purpose format
// library. Handles quoted fields (commas/newlines inside quotes,
// doubled "" as an escaped quote) and both \n and \r\n line endings.
// Returns an array of rows, each row an array of string cells — the
// caller (services/remittance.js) maps the header row to column names
// via the saved CourierColumnMapping.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const n = text.length;

  const pushField = () => { row.push(field); field = ''; };
  const pushRow = () => { pushField(); rows.push(row); row = []; };

  while (i < n) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i += 1; continue;
      }
      field += ch; i += 1; continue;
    }
    if (ch === '"') { inQuotes = true; i += 1; continue; }
    if (ch === ',') { pushField(); i += 1; continue; }
    if (ch === '\r') { i += 1; continue; } // swallow, \n (or EOF) ends the row
    if (ch === '\n') { pushRow(); i += 1; continue; }
    field += ch; i += 1;
  }
  // Last row, if the file doesn't end with a newline.
  if (field.length > 0 || row.length > 0) pushRow();

  // Drop wholly-empty trailing rows (a trailing blank line in the file).
  return rows.filter((r) => !(r.length === 1 && r[0] === ''));
}

module.exports = { parseCsv };
