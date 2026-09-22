// Creates the vyora_retail database if it does not exist.
// Requires DATABASE_URL (or defaults to local dev connection).
import { Client } from 'pg';

const url = process.env.DATABASE_URL || 'postgresql://postgres:vyora_dev_2024@localhost:5432/postgres';
const dbName = process.env.DB_NAME || 'vyora_retail';

const admin = new Client({ connectionString: url });
await admin.connect();
const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
if (exists.rowCount === 0) {
  await admin.query(`CREATE DATABASE "${dbName}"`);
  console.log(`Database ${dbName} created.`);
} else {
  console.log(`Database ${dbName} already exists.`);
}
await admin.end();
