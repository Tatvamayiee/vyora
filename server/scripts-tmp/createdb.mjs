import { Client } from 'pg';
const url = 'postgresql://postgres:vyora_dev_2024@localhost:5432/postgres';
const admin = new Client({ connectionString: url });
await admin.connect();
const r = await admin.query("SELECT 1 FROM pg_database WHERE datname='vyora_retail'");
if (!r.rowCount) { await admin.query('CREATE DATABASE vyora_retail'); console.log('DB created'); }
else console.log('DB exists');
await admin.end();
