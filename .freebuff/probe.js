// Dump every script opening tag + test repairInlineJs in isolation.
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..", "stitch_marthub_retail_pos_system");
const html = fs.readFileSync(path.join(ROOT, "screen_02_owner_login_auth_flow", "code.html"), "utf8");

const tags = [...html.matchAll(/<script[^>]*>/gi)].map((m) => m[0]);
tags.forEach((t, i) => console.log(i, JSON.stringify(t)));

// isolate the failing script
const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
console.log("inline-match count:", scripts.length);
scripts.forEach((m, i) => console.log("inline", i, JSON.stringify(m[1].slice(0, 60))));
