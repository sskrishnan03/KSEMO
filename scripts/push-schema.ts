import 'dotenv/config';
import { migrate } from 'drizzle-kit/postgres-js';
import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is required');
}

const sql = postgres(connectionString, { max: 1 });

async function main() {
  console.log('Pushing schema to database...');
  await migrate(sql, { migrationsFolder: './drizzle' });
  console.log('Schema pushed successfully!');
  await sql.end();
}

main().catch(console.error);
