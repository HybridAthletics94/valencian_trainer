import fs from "node:fs";

const MANIFEST_PATH = "data/manifest.json";
const REQUIRED_FIELDS = ["id", "nivel", "tema", "tipo", "pregunta", "respuesta"];
const VALID_TYPES = ["test", "texto", "hueco", "redaccio", "redacción", "oral", "obert", "abierto", "expressio", "expresion"];

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
const files = Array.isArray(manifest.files) ? manifest.files : [];
const rows = [];
const fileErrors = [];

for (const file of files) {
  try {
    const text = fs.readFileSync(file, "utf8");
    rows.push(...parseCsv(text).map((row, index) => ({ ...row, __source: file, __rowNumber: index + 2 })));
  } catch (err) {
    fileErrors.push(`${file}: ${err.message}`);
  }
}

const diagnostics = validateRows(rows, fileErrors);
const levelText = formatCounts(diagnostics.byLevel);
const typeText = formatCounts(diagnostics.byType);

console.log(`Banco validado: ${diagnostics.validRows.length}/${rows.length} preguntas válidas en ${files.length - fileErrors.length}/${files.length} archivos.`);
console.log(`Niveles: ${levelText}`);
console.log(`Tipos: ${typeText}`);

if (diagnostics.issues.length) {
  console.log("\nAvisos:");
  for (const issue of diagnostics.issues) console.log(`- ${issue}`);
  process.exitCode = 1;
} else {
  console.log("Sin errores de formato detectados.");
}

function validateRows(inputRows, errors) {
  const issues = [];
  const validRows = [];
  const seenIds = new Map();
  const byLevel = {};
  const byType = {};

  for (const row of inputRows) {
    const source = row.__source || "CSV";
    const rowNumber = row.__rowNumber || "?";
    const location = `${source}, fila ${rowNumber}`;
    const id = clean(row.id);
    const tipo = (clean(row.tipo) || "test").toLowerCase();
    const missing = REQUIRED_FIELDS.filter(field => !clean(row[field]));

    if (missing.length) {
      issues.push(`${location}: faltan campos obligatorios (${missing.join(", ")}).`);
      continue;
    }

    if (seenIds.has(id)) {
      issues.push(`${location}: ID duplicado "${id}" (ya aparece en ${seenIds.get(id)}).`);
      continue;
    }

    seenIds.set(id, location);

    if (!VALID_TYPES.includes(tipo)) {
      issues.push(`${location}: tipo poco común "${tipo}".`);
    }

    if (tipo === "test") {
      const answer = normalizeAnswer(row.respuesta);
      const optionKey = `opcion_${answer.toLowerCase()}`;
      if (!["A", "B", "C", "D"].includes(answer)) {
        issues.push(`${location}: la respuesta de una pregunta test debe ser A, B, C o D.`);
        continue;
      }
      if (!clean(row[optionKey])) {
        issues.push(`${location}: la respuesta correcta es ${answer}, pero esa opción está vacía.`);
        continue;
      }
    }

    countBy(byLevel, clean(row.nivel));
    countBy(byType, tipo);
    validRows.push(row);
  }

  for (const error of errors) issues.push(`Archivo no cargado: ${error}.`);

  return { validRows, issues, byLevel, byType };
}

function parseCsv(text) {
  const csvRows = [];
  let row = [];
  let value = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      value += '"';
      i++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(value);
      value = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i++;
      row.push(value);
      if (row.some(cell => cell.trim() !== "")) csvRows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }

  row.push(value);
  if (row.some(cell => cell.trim() !== "")) csvRows.push(row);
  if (!csvRows.length) return [];

  const headers = csvRows.shift().map(header => clean(header).toLowerCase());
  return csvRows.map(cells => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""])));
}

function countBy(target, key) {
  target[key] = (target[key] || 0) + 1;
}

function formatCounts(counts) {
  return Object.entries(counts)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, value]) => `${key}: ${value}`)
    .join(" · ");
}

function clean(value) {
  return String(value ?? "").trim();
}

function normalizeAnswer(value) {
  return clean(value).toUpperCase().slice(0, 1);
}
