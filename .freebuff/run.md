# Vyora Retail — Preview Run Doc

Live app in this thread's Preview tab: **http://localhost:3000** (client, pid from `netstat :3000`), backed by **http://localhost:5000** (API).

**E2E status (verified this session):** startup, auth×5, owner dashboard + branch filter, manager branch scoping, cashier POS sale (DB-verified stock/loyalty/movement), offline bill → IndexedDB → auto-sync → idempotent replay, warehouse receive + issue, customer isolation, logout/back/refresh guards (route-guard added in `client/src/main.tsx`), responsive 768px + 390px, 18/18 API acceptance tests. Acceptance suite: `node .freebuff/acceptance-test.mjs`.

Note: the concurrent AI re-seeds the DB periodically — ids shift and sessions drop (401s mid-flow are reseed artifacts, not bugs). Re-login and re-read ids after any reseed.

## Reproduce artifacts

```bash
npm install                          # root: installs server/ + client/ via postinstall
cd server && npx prisma db push --schema ../prisma/schema.prisma
node prisma/seed.js                  # from server/ — demo data
cp .env.example server/.env          # adjust DATABASE_URL password
```

## Run the servers

```powershell
# API (server/):
powershell -NoProfile -Command "(Start-Process -FilePath 'node.exe' -ArgumentList 'src/index.js' -WorkingDirectory 'C:\coding\VYORA\server' -RedirectStandardOutput 'C:\coding\VYORA\.freebuff\api.log' -RedirectStandardError 'C:\coding\VYORA\.freebuff\api.log.err' -WindowStyle Hidden -PassThru).Id"

# Client (client/):
powershell -NoProfile -Command "(Start-Process -FilePath 'node.exe' -ArgumentList 'node_modules\vite\bin\vite.js','--port','3000' -WorkingDirectory 'C:\coding\VYORA\client' -RedirectStandardOutput 'C:\coding\VYORA\.freebuff\vite.log' -RedirectStandardError 'C:\coding\VYORA\.freebuff\vite.log.err' -WindowStyle Hidden -PassThru).Id"
```

Then verify: `curl http://localhost:5000/api/health` → `{"ok":true}` and `curl -o NUL -w "%{http_code}" http://localhost:3000/` → `200`.

Notes:
- `.env` already has `PORT=5000`; if the ambient environment exports `PORT=0`, `server/src/index.js` now guards against it.
- Acceptance suite: `node .freebuff/acceptance-test.mjs` (18 checks).
- Demo logins: see README table (owner/manager/cashier/warehouse/customer @vyora.local).
- A legacy mockup preview server (`.freebuff/preview-server.js`) may still hold port 4173; it is unrelated to the app.
