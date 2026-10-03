// يفحص ملفات العرض المنقولة من المنصة القديمة (التي تحمل @ts-nocheck) بحثًا عن أسماء غير معرّفة فقط،
// حتى لا يظهر ReferenceError وقت التشغيل. (بقية أخطاء الأنواع تُهمل عمدًا لتلك الملفات.)
import ts from "typescript";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MARK = "// @ts-nocheck";
const NAME_CODES = new Set([2304, 2552, 2663, 2662, 2693, 2749, 2686]);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cfg = ts.readConfigFile(path.join(root, "tsconfig.json"), ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(cfg.config, ts.sys, root);
const host = ts.createCompilerHost(parsed.options);
const orig = host.getSourceFile.bind(host);
const legacy = new Set();
host.getSourceFile = (file, lang, onErr, shouldCreate) => {
  const sf = orig(file, lang, onErr, shouldCreate);
  if (sf && file.includes("/src/") && sf.text.includes(MARK)) {
    legacy.add(file);
    return ts.createSourceFile(file, sf.text.replace(MARK, "//"), lang, true);
  }
  return sf;
};
const prog = ts.createProgram(parsed.fileNames, parsed.options, host);
const bad = [];
for (const sf of prog.getSourceFiles()) {
  if (!legacy.has(sf.fileName)) continue;
  for (const d of [...prog.getSyntacticDiagnostics(sf), ...prog.getSemanticDiagnostics(sf)]) {
    if (!NAME_CODES.has(d.code) && d.code !== 2307) continue;   // 2307 = وحدة مفقودة
    const { line } = sf.getLineAndCharacterOfPosition(d.start ?? 0);
    bad.push(`${path.relative(root, sf.fileName)}:${line + 1}  TS${d.code} ${ts.flattenDiagnosticMessageText(d.messageText, " ")}`);
  }
}
console.log(`checked ${legacy.size} ported legacy files`);
if (bad.length) { console.error(bad.join("\n")); console.error(`\n${bad.length} unresolved names/modules in ported legacy views`); process.exit(1); }
console.log("legacy views: all names resolve");
