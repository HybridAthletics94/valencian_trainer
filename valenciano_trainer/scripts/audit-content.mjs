import fs from "node:fs";

const manifest = JSON.parse(fs.readFileSync("data/manifest.json", "utf8"));
const files = Array.isArray(manifest.files) ? manifest.files : [];
const rows = [];

for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  rows.push(...parseCsv(text).map((row, index) => ({ ...row, __source: file, __rowNumber: index + 2 })));
}

const byLevel = groupCount(rows, "nivel");
const byType = groupCount(rows, "tipo");
const byLevelType = nestedCount(rows, "nivel", "tipo");
const byLevelTopic = nestedCount(rows, "nivel", "tema");
const lowCoverage = [];
const repeatedPrompts = findRepeatedPrompts(rows);

for (const [level, topics] of Object.entries(byLevelTopic)) {
  for (const [topic, count] of Object.entries(topics)) {
    if (count < 3) lowCoverage.push({ level, topic, count });
  }
}

lowCoverage.sort((a, b) => a.count - b.count || a.level.localeCompare(b.level) || a.topic.localeCompare(b.topic));

const report = [
  "# Auditoría pedagógica del banco",
  "",
  `Generado: ${new Date().toISOString()}`,
  "",
  `Total de actividades: ${rows.length}`,
  "",
  "## Por nivel",
  "",
  table(["Nivel", "Actividades"], Object.entries(byLevel).map(([level, count]) => [level, count])),
  "",
  "## Por tipo",
  "",
  table(["Tipo", "Actividades"], Object.entries(byType).map(([type, count]) => [type, count])),
  "",
  "## Tipos por nivel",
  "",
  table(["Nivel", "Test", "Hueco", "Texto", "Redacción", "Oral"], Object.keys(byLevelType).sort().map(level => [
    level,
    byLevelType[level].test || 0,
    byLevelType[level].hueco || 0,
    byLevelType[level].texto || 0,
    byLevelType[level].redaccio || 0,
    byLevelType[level].oral || 0,
  ])),
  "",
  "## Cobertura baja",
  "",
  lowCoverage.length
    ? table(["Nivel", "Tema", "Actividades"], lowCoverage.map(item => [item.level, item.topic, item.count]))
    : "No hay temas con menos de 3 actividades.",
  "",
  "## Posibles enunciados repetitivos",
  "",
  repeatedPrompts.length
    ? table(["Enunciado normalizado", "Veces"], repeatedPrompts.slice(0, 20).map(item => [item.prompt, item.count]))
    : "No se han detectado repeticiones relevantes.",
  "",
  "## Recomendaciones",
  "",
  "- Mantener cada tema por encima de 3 actividades por nivel.",
  "- Priorizar C2 cuando haya que ampliar el banco.",
  "- Añadir más tareas abiertas solo cuando incluyan criterios claros de autoevaluación.",
  "- Revisar periódicamente los temas con mayor tasa de fallo real en la app.",
  "",
].join("\n");

fs.writeFileSync("CONTENT_AUDIT.md", report);
console.log(report);

function groupCount(inputRows, key) {
  const result = {};
  for (const row of inputRows) {
    const value = clean(row[key]) || "(vacío)";
    result[value] = (result[value] || 0) + 1;
  }
  return sortObject(result);
}

function nestedCount(inputRows, outerKey, innerKey) {
  const result = {};
  for (const row of inputRows) {
    const outer = clean(row[outerKey]) || "(vacío)";
    const inner = clean(row[innerKey]) || "(vacío)";
    if (!result[outer]) result[outer] = {};
    result[outer][inner] = (result[outer][inner] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b)));
}

function findRepeatedPrompts(inputRows) {
  const counts = {};
  for (const row of inputRows) {
    const prompt = normalizePrompt(row.pregunta);
    if (!prompt || prompt.length < 12) continue;
    counts[prompt] = (counts[prompt] || 0) + 1;
  }
  return Object.entries(counts)
    .filter(([, count]) => count >= 8)
    .map(([prompt, count]) => ({ prompt, count }))
    .sort((a, b) => b.count - a.count);
}

function table(headers, bodyRows) {
  const divider = headers.map(() => "---");
  return [headers, divider, ...bodyRows]
    .map(row => `| ${row.map(cell => String(cell).replaceAll("|", "\\|")).join(" | ")} |`)
    .join("\n");
}

function sortObject(obj) {
  return Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b)));
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

function normalizePrompt(value) {
  return clean(value)
    .toLowerCase()
    .replace(/text:.*?quina/s, "text: [...] quina")
    .replace(/\s+/g, " ")
    .trim();
}

function clean(value) {
  return String(value ?? "").trim();
}
