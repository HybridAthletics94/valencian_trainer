import fs from "node:fs";

const checks = [];

checkFile("index.html");
checkFile("styles.css");
checkFile("app.js");
checkFile("service-worker.js");
checkFile("manifest.webmanifest");
checkFile("app-icon.svg");
checkFile(".nojekyll");
checkFile("LICENSE");
checkFile("DEPLOY.md");

const indexHtml = readText("index.html");
const appJs = readText("app.js");
const serviceWorker = readText("service-worker.js");
const manifest = readJson("manifest.webmanifest");
const dataManifest = readJson("data/manifest.json");

check("index enlaza el manifest", indexHtml.includes('rel="manifest" href="manifest.webmanifest"'));
check("index enlaza el icono", indexHtml.includes("app-icon.svg"));
check("app registra service worker", appJs.includes('serviceWorker.register("service-worker.js")'));
check("service worker cachea el manifest del banco", serviceWorker.includes("./data/manifest.json"));
check("service worker cachea CSVs desde manifest", serviceWorker.includes("manifest.files"));
check("service worker soporta actualizar versión", serviceWorker.includes("SKIP_WAITING"));

for (const field of ["name", "short_name", "start_url", "scope", "display", "icons"]) {
  check(`manifest contiene ${field}`, Object.hasOwn(manifest, field));
}

const iconFiles = Array.isArray(manifest.icons) ? manifest.icons.map(icon => icon.src) : [];
for (const icon of iconFiles) checkFile(icon);

const csvFiles = Array.isArray(dataManifest.files) ? dataManifest.files : [];
check("data/manifest.json contiene CSVs", csvFiles.length > 0);
for (const file of csvFiles) checkFile(file);

const simulacroFiles = [
  "simulacros/simulacro_b2.csv",
  "simulacros/simulacro_c1.csv",
  "simulacros/simulacro_c2.csv",
];
for (const file of simulacroFiles) {
  checkFile(file);
  check(`service worker cachea ${file}`, serviceWorker.includes(`./${file}`));
}

const failed = checks.filter(item => !item.ok);
for (const item of checks) console.log(`${item.ok ? "OK" : "FAIL"} ${item.label}`);

if (failed.length) {
  console.error(`\n${failed.length} comprobación(es) fallaron.`);
  process.exit(1);
}

console.log("\nListo para publicar como app estática.");

function checkFile(path) {
  check(`${path} existe`, fs.existsSync(path));
}

function check(label, ok) {
  checks.push({ label, ok: Boolean(ok) });
}

function readText(path) {
  try {
    return fs.readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

function readJson(path) {
  try {
    return JSON.parse(readText(path));
  } catch {
    check(`${path} es JSON válido`, false);
    return {};
  }
}
