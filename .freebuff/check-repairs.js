// Scratch test: apply the preview server's repair passes to every mockup
// and verify every inline script parses. Run: node .freebuff/check-repairs.js
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..", "stitch_marthub_retail_pos_system");

const vm = require("vm");
const src = fs.readFileSync(path.join(__dirname, "preview-server.js"), "utf8");
const start = src.indexOf("function fixConfigCommas");
const end = src.indexOf("function wireScript");
eval(src.slice(start, end));

let anyFail = false;
for (const dir of fs.readdirSync(ROOT).filter((d) => /^screen_/.test(d))) {
  const html = fs.readFileSync(path.join(ROOT, dir, "code.html"), "utf8");
  let out = repairTailwindConfig(html);
  out = repairInlineJs(out);
  const scripts = [...out.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
  scripts.forEach((s, i) => {
    try {
      new vm.Script(s, { filename: dir + "#" + i });
    } catch (e) {
      anyFail = true;
      const tmp = path.join(__dirname, "tmp-fail.js");
      fs.writeFileSync(tmp, s);
      const { execSync } = require("child_process");
      let detail = "";
      try {
        execSync("node --check " + JSON.stringify(tmp), { stdio: "pipe" });
      } catch (e2) {
        detail = (e2.stderr || "").toString();
      }
      // also dump what the repair actually changed
      const orig = html.match(/<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/gi)[i];
      const origCode = orig.replace(/^<script[^>]*>/i, "").replace(/<\/script>$/i, "");
      if (origCode === s) console.log("  (repair made NO changes)");
      console.log("\n" + dir + " script#" + i + " → " + e.message);
      console.log(detail);
    }
  });
}
console.log(anyFail ? "\nSTILL FAILING" : "\nALL 16 SCREENS: every inline script parses");
