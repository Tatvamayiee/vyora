import { Client } from 'pg';
const urls = [
  ['LOCAL', 'postgresql://postgres:vyora_dev_2024@localhost:5432/vyora_retail'],
  ['REMOTE', 'postgres://bbc3f0f31451f94eef8e9142086ddbd506ca7fcba82315c5410653f5bfeb6d73:sk_U_P_vgSYYlfQoaWOtaEdP@pooled.db.prisma.io:5432/postgres?sslmode=require'],
];
for (const [label, url] of urls) {
  try {
    const c = new Client({ connectionString: url, ssl: url.includes('pooled') ? { rejectUnauthorized: true } : undefined, connectionTimeoutMillis: 8000 });
    await c.connect();
    const db = await c.query('SELECT current_database() as db, NOW() as now');
    let counts = '';
    try {
      const r = await c.query("SELECT (SELECT count(*) FROM information_schema.tables WHERE table_schema='public') as tables, (SELECT count(*) FROM products) as products, (SELECT count(*) FROM sales) as sales");
      counts = `tables=${r.rows[0].tables} products=${r.rows[0].products} sales=${r.rows[0].sales}`;
    } catch (e) { counts = 'tables err: ' + e.message.split('\n')[0]; }
    console.log(`${label}: db=${db.rows[0].db} now=${db.rows[0].now.toISOString()} ${counts}`);
    await c.end();
  } catch (e) { console.log(`${label}: CONNECT FAIL — ${e.message.split('\n')[0]}`); }
}
