/*
 * VYORA / MartHub — preview-layer flow server (READ-ONLY for project files)
 * ---------------------------------------------------------------------------
 * The 16 Stitch mockups in stitch_marthub_retail_pos_system/screen_* folders
 * (each contains code.html) are static prototypes with dead links: they reference each other via
 * data-path="...", href="#screen-XX-..." and hash anchors, but nothing routes.
 *
 * This server (all code lives in .freebuff/, zero project files touched):
 *   1. Serves a flow-ordered gallery at "/" (01 is the entry point; cashier
 *      chain 04→06→07, owner chain 02→08→09–13, warehouse 04→14, customer
 *      05→15→16).
 *   2. Serves each mockup verbatim except that one <script> is injected before
 *      </body> which:
 *        - wires every data-path / #hash link to its logical screen,
 *        - wires the screen-01 role cards ("Proceed to Owner Login", ...),
 *        - adds a floating flow navigator (Prev / Next / Map / Home).
 */
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 4173;
const ROOT = path.join(__dirname, "..", "stitch_marthub_retail_pos_system");
// Brand logo copied into .freebuff/ (user-provided). Served at /__logo and
// swapped in for the blocked googleusercontent placeholder images.
const LOGO_PATH = path.join(__dirname, "logo.jpg");

// Several mockups ship a malformed inline tailwind.config script (missing
// commas between object entries, e.g. "class"theme: or "#5a4138""on-error").
// A syntax error there kills the whole script, so Tailwind runs with DEFAULT
// colors and every custom token (bg-primary, text-on-surface, ...) is dead.
// Repair = string-aware char walk inserting commas only at value→value
// junctions outside strings, followed by semantic validation (keys clean,
// values uncorrupted). If validation fails, the original is kept.
function fixConfigCommas(code) {
  let out = "";
  let inStr = false;
  let prev = ""; // last meaningful char emitted outside strings
  const isValueEnd = (c) => /[}\]"'\w\d]/.test(c) && !/[:,{[(]/.test(c);
  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    if (inStr) {
      out += ch;
      if (ch === "\\") { out += code[i + 1] || ""; i++; }
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') {
      if (prev && isValueEnd(prev)) out += ",";
      inStr = true;
      out += ch;
      prev = ch;
      continue;
    }
    if (ch === "{" || ch === "[") {
      if (prev && /[}\]"'\w\d]/.test(prev) && prev !== ",") out += ",";
      out += ch;
      prev = ch;
      continue;
    }
    if (/\s/.test(ch)) { out += ch; continue; }
    if (/[\w\d]/.test(ch) && /[}\]"']/.test(prev)) out += ","; // e.g. "class"theme
    out += ch;
    prev = ch;
  }
  return out;
}

function configSemanticsValid(code) {
  try {
    const cfg = new Function("var tailwind={};" + code + "; return tailwind.config;")();
    if (!cfg || !cfg.theme || !cfg.theme.extend || !cfg.theme.extend.colors) return false;
    const colors = cfg.theme.extend.colors;
    const keys = Object.keys(colors);
    if (!keys.length) return false;
    if (cfg.darkMode !== "class") return false;
    return keys.every((k) => /^[a-z0-9-]+$/i.test(k) && /^#[0-9a-f]{3,8}$/i.test(colors[k]));
  } catch (e) {
    return false;
  }
}

function repairTailwindConfig(html) {
  return html.replace(
    /(<script[^>]*id="tailwind-config"[^>]*>)([\s\S]*?)(<\/script>)/g,
    (m, open, code, close) => {
      if (configSemanticsValid(code)) return m; // already valid (e.g. screens 05/07)
      const fixed = fixConfigCommas(code);
      if (configSemanticsValid(fixed)) return open + fixed + close;
      return m;
    }
  );
}

// The same corruption stripped :, ; and , from some screens' Material Symbols
// font URLs ("Outlined:opszwghtFILLGRAD@20..48100..7000..1-50..200") and the
// viewport meta ("width=device-widthinitial-scale=1.0"), so the icon font
// never loads and icons render as raw ligature text. Restore canonical forms.
function repairFontAndMetaUrls(html) {
  return html
    .replace(
      /family=Material\+Symbols\+Outlined:[^&"'\s]*opszwghtFILLGRAD@[^&"'\s]*/g,
      "family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
    )
    .replace(
      /family=Material\+Symbols\+Outlined:wghtFILL@[^&"'\s]*/g,
      "family=Material+Symbols+Outlined:wght,FILL@100..700,0..1"
    )
    .replace(
      /(<meta[^>]*name="viewport"[^>]*content=")width=device-widthinitial-scale=1\.0("[^>]*>)/g,
      "$1width=device-width, initial-scale=1.0$2"
    );
}

// Other mockup scripts have missing commas ([aBcD] arrays, 'x''y' string
// lists, setTimeout(fn}1000), requestStockItem(itemNameqty)) AND eaten
// newlines after // comments — in a single-line script that turns everything
// after the comment into dead text. Same policy: repair, then only keep the
// fix if the repaired script parses.
function repairInlineJs(html) {
  return html.replace(
    /(<script(?![^>]*\bsrc=)[^>]*>)([\s\S]*?)(<\/script>)/gi,
    (m, open, code, close) => {
      try { new Function(code); return m; } catch (e) { /* fall through */ }
      let fixed = code
        // comment swallowed the rest of the one-line script: restore newline
        .replace(/(\/\/\s*Reset button styles)\s*\[bDefaultbErrorbLoading\]/, "$1\n[bDefault, bError, bLoading]")
        .replace(/(\/\/\s*Loading state demonstration)\s*(submitBtn\.disabled)/, "$1\n$2")
        .replace(/\[bDefaultbErrorbLoading\]/g, "[bDefault, bError, bLoading]")
        .replace(/('opacity-70'\s*)('pointer-events-none')/g, "$1,$2")
        .replace(/\}(\d{3,4})\)/g, "}, $1)")
        .replace(/requestStockItem\(itemNameqty\)/g, "requestStockItem(itemName, qty)");
      // generic: adjacent literals with no separator need a comma
      for (let guard = 0; guard < 20; guard++) {
        const next = fixed
          .replace(/('(?:[^'\\]|\\.)*')\s*('(?:[^'\\]|\\.)*')/g, "$1,$2")
          .replace(/('(?:[^'\\]|\\.)*')\s*(\d{2,})/g, "$1,$2")
          .replace(/(\d{2,})\s*('(?:[^'\\]|\\.)*')/g, "$1,$2");
        if (next === fixed) break;
        fixed = next;
      }
      try { new Function(fixed); return open + fixed + close; }
      catch (e2) { return m; }
    }
  );
}

// Prototype order = the intended user flow.
const ORDER = [
  "screen_01_authentication_entry",
  "screen_02_owner_login_auth_flow",
  "screen_03_manager_login_manager_dashboard",
  "screen_04_employee_login_role_dispatch",
  "screen_05_customer_login_customer_home",
  "screen_06_cashier_pos_billing_terminal",
  "screen_07_cashier_payment_bill_recent_bills_offline_sync",
  "screen_08_owner_dashboard_sales_analytics",
  "screen_09_owner_inventory_product_management",
  "screen_10_stock_operations_inventory_issues",
  "screen_11_owner_promotions_create_edit_offer",
  "screen_12_owner_staff_branch_management",
  "screen_13_owner_reports_system_settings",
  "screen_14_warehouse_staff_inventory_workspace",
  "screen_15_customer_purchases_loyalty_offers",
  "screen_16_customer_profile_notifications_global_ui_component_states",
];

const LABELS = {
  screen_01_authentication_entry: "Role Selection (Entry)",
  screen_02_owner_login_auth_flow: "Owner Login",
  screen_03_manager_login_manager_dashboard: "Manager Login & Dashboard",
  screen_04_employee_login_role_dispatch: "Staff Login & Role Dispatch",
  screen_05_customer_login_customer_home: "Customer Home",
  screen_06_cashier_pos_billing_terminal: "Cashier POS Billing",
  screen_07_cashier_payment_bill_recent_bills_offline_sync: "Payment, Bills & Sync",
  screen_08_owner_dashboard_sales_analytics: "Owner Dashboard",
  screen_09_owner_inventory_product_management: "Owner Inventory",
  screen_10_stock_operations_inventory_issues: "Stock Operations",
  screen_11_owner_promotions_create_edit_offer: "Promotions",
  screen_12_owner_staff_branch_management: "Staff & Branches",
  screen_13_owner_reports_system_settings: "Reports & Settings",
  screen_14_warehouse_staff_inventory_workspace: "Warehouse Workspace",
  screen_15_customer_purchases_loyalty_offers: "Customer Purchases",
  screen_16_customer_profile_notifications_global_ui_component_states: "Customer Profile & States",
};

// data-path values found inside the mockups → 1-based screen index.
const ROUTES = {
  "role-selection": 1,
  "screen-01-role-selection": 1,
  "terminal-selection": 1,
  "screen-06-pos-billing": 6,
  "screen-14-warehouse-workspace": 14,
  "terminal-auth": 4,
  "workstation-dispatch": 4,
  "shift-handover": 4,
  "home": 5,
  "my-bills": 15,
  "billing-terminal": 6,
  "held-orders": 6,
  "manager-override": 6,
  "shift-dispatch": 4,
  "pos-billing-terminal": 6,
  "cashier-payment-settlement": 7,
  "e-bill-preview": 7,
  "recent-invoices": 7,
  "offline-edge-sync-manager": 7,
  "dashboard-and-analytics": 14,
  "inbound-receiving-and-grn": 14,
  "putaway-and-bin-locations": 14,
  "stock-counting-and-audit": 14,
  "dispatches-and-intra-branch-ibt": 14,
  "damaged-and-quarantine": 14,
};

// Keyword fallback for fuzzy anchors like "#screen-08-owner-dashboard".
const KEYWORD_ROUTES = [
  [/role.?select/i, 1],
  [/owner.?login/i, 2],
  [/manager.?login|manager.?dashboard/i, 3],
  [/staff.?login|employee.?login|role.?dispatch|terminal.?select/i, 4],
  [/customer.?home|customer.?login/i, 5],
  [/pos.?billing|billing.?terminal|cashier.?billing|screen-06/i, 6],
  [/cashier.?payment|screen-07|payment|e-?bill|invoice/i, 7],
  [/owner.?dashboard|sales.?analytics|screen-08/i, 8],
  [/inventory|product.?manage/i, 9],
  [/stock.?op|inventory.?issue|screen-10/i, 10],
  [/promo|offer/i, 11],
  [/staff.?manage|branch.?manage/i, 12],
  [/report|settings/i, 13],
  [/warehouse|screen-14/i, 14],
  [/purchase|loyalty/i, 15],
  [/profile|notification/i, 16],
];

// Source for the resolver function injected into each page.
const RESOLVER_SRC =
  "(function (raw) {" +
  "  var v = (raw || '').toLowerCase().replace(/^#/, '');" +
  "  if (!v) return null;" +
  "  var m = v.match(/screen[-_]?0?(\\d+)/);" +
  "  if (m) { var i = parseInt(m[1], 10); if (i >= 1 && i <= 16) return i; }" +
  "  var ROUTES = " + JSON.stringify(ROUTES) + ";" +
  "  if (ROUTES[v] !== undefined) return ROUTES[v];" +
  "  var KW = " + JSON.stringify(KEYWORD_ROUTES.map(function (r) { return [r[0].source, r[1]]; })) + ";" +
  "  for (var k = 0; k < KW.length; k++) { if (new RegExp(KW[k][0]).test(v)) return KW[k][1]; }" +
  "  return null;" +
  "})";

function wireScript(name) {
  return `
(function () {
  var resolve = ${RESOLVER_SRC};
  var ORDER = ${JSON.stringify(ORDER)};
  var me = ${JSON.stringify(name)};
  var idx = ORDER.indexOf(me);
  function go(n) { if (n >= 1 && n <= ORDER.length) location.href = "/" + ORDER[n - 1]; }
  window.__vyoraGo = go;
  document.querySelectorAll("a[data-path], a[href^='#']").forEach(function (el) {
    var raw = el.getAttribute("data-path") || el.getAttribute("href");
    var t = resolve(raw);
    if (!t) return;
    el.addEventListener("click", function (ev) { ev.preventDefault(); go(t); });
    el.style.cursor = "pointer";
  });
  if (idx === 0) {
    var roleMap = [
      ["Proceed to Owner Login", 2],
      ["Proceed to Manager Login", 3],
      ["Proceed to Staff Login", 4],
      ["Customer Portal Access", 5]
    ];
    document.querySelectorAll("button").forEach(function (b) {
      var txt = (b.innerText || "").trim();
      roleMap.forEach(function (pair) {
        if (txt.indexOf(pair[0]) !== -1) {
          b.addEventListener("click", function () { go(pair[1]); });
          b.style.cursor = "pointer";
        }
      });
    });
  }
})();
`;
}

function navbarScript(name) {
  return `
(function () {
  var ORDER = ${JSON.stringify(ORDER)};
  var LABELS = ${JSON.stringify(LABELS)};
  var me = ${JSON.stringify(name)};
  var idx = ORDER.indexOf(me);
  if (idx < 0) return;
  var css = document.createElement("style");
  css.textContent = [
    ".vyora-flow{position:fixed;left:50%;transform:translateX(-50%);bottom:14px;z-index:2147483000;display:flex;align-items:center;gap:8px;background:#0f172a;color:#fff;padding:8px 12px;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.35);font-family:Inter,system-ui,sans-serif}",
    ".vyora-flow button{all:unset;cursor:pointer;color:#cbd5e1;font:600 12px Inter,system-ui,sans-serif;padding:6px 10px;border-radius:8px;display:inline-flex;align-items:center;gap:6px}",
    ".vyora-flow button:hover{background:#334155;color:#fff}",
    ".vyora-flow .vf-pos{font:700 12px Inter,system-ui,sans-serif;color:#f97316;min-width:44px;text-align:center}",
    ".vyora-flow .vf-label{font:600 12px Inter,system-ui,sans-serif;color:#e2e8f0;max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
    ".vyora-map{position:fixed;left:50%;transform:translateX(-50%);bottom:64px;z-index:2147483000;background:#0f172a;color:#e2e8f0;border:1px solid #334155;border-radius:12px;padding:10px;display:none;grid-template-columns:1fr 1fr;gap:4px;max-height:70vh;overflow:auto;width:min(560px,92vw);font-family:Inter,system-ui,sans-serif;box-shadow:0 12px 32px rgba(0,0,0,.4)}",
    ".vyora-map.open{display:grid}",
    ".vyora-map a{color:#cbd5e1;text-decoration:none;font:500 12px Inter,system-ui,sans-serif;padding:6px 8px;border-radius:8px}",
    ".vyora-map a:hover{background:#1e293b;color:#fff}",
    ".vyora-map a.cur{background:#7c2d12;color:#ffedd5}",
    ".vyora-map .vh{grid-column:1/-1;font:700 11px Inter,sans-serif;color:#94a3b8;letter-spacing:.06em;text-transform:uppercase;padding:4px 8px 2px}"
  ].join("");
  document.head.appendChild(css);
  var bar = document.createElement("div");
  bar.className = "vyora-flow";
  bar.innerHTML =
    '<button data-act="home" title="Gallery index">\\u2302</button>' +
    '<button data-act="prev" title="Previous screen">\\u2039 Prev</button>' +
    '<span class="vf-pos">' + (idx + 1) + ' / ' + ORDER.length + '</span>' +
    '<span class="vf-label">' + LABELS[me] + '</span>' +
    '<button data-act="next" title="Next screen">Next \\u203a</button>' +
    '<button data-act="map" title="Jump to any screen">\\u2630 Map</button>';
  document.body.appendChild(bar);
  var map = document.createElement("div");
  map.className = "vyora-map";
  map.innerHTML =
    '<div class="vh">VYORA prototype flow map \\u2014 jump to any screen</div>' +
    ORDER.map(function (d, i) {
      return '<a href="/' + d + '" class="' + (i === idx ? "cur" : "") + '">' +
        String(i + 1).padStart(2, "0") + " \\u00b7 " + LABELS[d] + '</a>';
    }).join("");
  document.body.appendChild(map);
  bar.addEventListener("click", function (ev) {
    var b = ev.target && ev.target.closest ? ev.target.closest("button") : null;
    if (!b) return;
    var act = b.getAttribute("data-act");
    if (act === "home") location.href = "/";
    else if (act === "prev" && idx > 0) location.href = "/" + ORDER[idx - 1];
    else if (act === "next" && idx < ORDER.length - 1) location.href = "/" + ORDER[idx + 1];
    else if (act === "map") map.classList.toggle("open");
  });
})();
`;
}

function galleryHtml() {
  const cards = ORDER.map((d, i) => {
    return (
      '<a class="card" href="/' + d + '">' +
      '<span class="num">' + String(i + 1).padStart(2, "0") + '</span>' +
      '<span>' + LABELS[d] + '</span></a>'
    );
  }).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>VYORA Retail OS — Flow Preview</title><style>
    body{font-family:Inter,system-ui,sans-serif;background:#f8fafc;color:#0f172a;margin:0;padding:32px}
    h1{font-size:22px;margin:0 0 4px}
    .sub{color:#64748b;font-size:13px;margin:0 0 8px;max-width:860px}
    .chain{display:inline-block;background:#ffedd5;color:#c2410c;border-radius:999px;padding:2px 10px;font-size:11px;font-weight:700;margin:6px 6px 0 0}
    .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:10px;margin-top:16px}
    .card{display:flex;gap:10px;align-items:center;background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:13px 15px;color:#0f172a;text-decoration:none;font-size:13.5px;font-weight:600}
    .card:hover{border-color:#f97316;box-shadow:0 2px 10px rgba(249,115,22,.15)}
    .num{color:#ea580c;font-weight:800;font-size:12px}
    .note{margin-top:22px;font-size:12px;color:#94a3b8;max-width:860px}
  </style></head><body>
  <h1>VYORA Retail OS — Flow Preview</h1>
  <p class="sub">All 16 mockups in prototype order, wired together at serve time — zero project files modified.
  Click any card, then use the floating flow bar on every screen. In-screen buttons like "Proceed to Owner Login",
  "Launch Owner Dashboard (Screen 08)", sidebar links and tabs are wired too.</p>
  <div>
    <span class="chain">01 → 02 / 03 / 04</span>
    <span class="chain">04 → 06 → 07</span>
    <span class="chain">02 → 08 → 09–13</span>
    <span class="chain">04 → 14</span>
    <span class="chain">05 → 15 → 16</span>
  </div>
  <div class="grid">${cards}</div>
  <p class="note">Served in-memory from stitch_marthub_retail_pos_system/ · server code: .freebuff/preview-server.js</p>
  </body></html>`;
}

function serveScreen(name, res) {
  const file = path.join(ROOT, name, "code.html");
  let html = fs.readFileSync(file, "utf8");
  // The mockups reference placeholder images on googleusercontent.com which the
  // preview browser blocks (ORB). Point them all at the local brand logo.
  html = html.replace(/https:\/\/lh3\.googleusercontent\.com\/[^"'\s)]+/g, "/__logo");
  html = repairTailwindConfig(html);
  html = repairInlineJs(html);
  html = repairFontAndMetaUrls(html);
  const inject =
    "<script>/* vyora preview flow injection */" +
    wireScript(name) +
    navbarScript(name) +
    "</script>";
  html = html.replace("</body>", () => inject + "</body>");
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
}

const server = http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  const p = decodeURIComponent(u.pathname);
  if (p === "/" || p === "/index.html") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(galleryHtml());
    return;
  }
  if (p === "/__logo" || p === "/favicon.ico") {
    try {
      const img = fs.readFileSync(LOGO_PATH);
      res.writeHead(200, { "Content-Type": "image/jpeg", "Cache-Control": "no-cache" });
      res.end(img);
    } catch (e) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("logo not found");
    }
    return;
  }
  const name = p.slice(1);
  if (ORDER.includes(name) && fs.existsSync(path.join(ROOT, name, "code.html"))) {
    serveScreen(name, res);
    return;
  }
  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not found: " + p);
});

server.listen(PORT, () => {
  console.log("VYORA flow preview on http://localhost:" + PORT);
});
