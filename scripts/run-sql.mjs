/**
 * Executa arquivos .sql contra o DATABASE_URL do .env, cada arquivo dentro de
 * uma transação — se qualquer statement falhar, aquele arquivo é revertido
 * inteiro e os seguintes não rodam.
 *
 *   node scripts/run-sql.mjs prisma/sql/01_v1_schema.sql prisma/sql/02_v1_seed_rbac.sql
 */
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { Client } from 'pg';

const files = process.argv.slice(2);

if (!files.length) {
  console.error('Uso: node scripts/run-sql.mjs <arquivo.sql> [...]');
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL não definida (.env).');
  process.exit(1);
}

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

try {
  for (const file of files) {
    const sql = await readFile(file, 'utf8');
    process.stdout.write(`→ ${file} ... `);

    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('COMMIT');
      console.log('ok');
    } catch (error) {
      await client.query('ROLLBACK');
      console.log('FALHOU (revertido)');
      console.error(`\n${error.message}\n`);
      process.exitCode = 1;
      break;
    }
  }
} finally {
  await client.end();
}
