/**
 * Shopping Cart (Retro CRT v3.0) — TypeScript Neon Postgres DB Initializer
 *
 * Utilizes ensureSchemaAndSeed from src/server/db to verify and bootstrap
 * the remote Neon database tables and default catalog items.
 */

import { getNeonSql, ensureSchemaAndSeed } from '../src/server/db';

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    console.error('\n' + '='.repeat(70));
    console.error(' [BŁĄD] Brak zmiennej środowiskowej DATABASE_URL!');
    console.error('='.repeat(70));
    console.error('\nNie wykryto adresu połączenia z bazą Neon Serverless Postgres.');
    console.error('\nAby zainicjalizować bazę danych:');
    console.error('  1. Skonfiguruj bazę Neon (np. na https://neon.tech lub w Vercel CLI):');
    console.error('       vercel integration add neon');
    console.error('  2. Ustaw zmienną środowiskową DATABASE_URL, np.:');
    console.error(
      '       export DATABASE_URL="postgresql://user:pass@ep-xyz.region.aws.neon.tech/neondb?sslmode=require"'
    );
    console.error('     LUB dodaj ją do lokalnego pliku .env.local:');
    console.error(
      '       DATABASE_URL=postgresql://user:pass@ep-xyz.region.aws.neon.tech/neondb?sslmode=require'
    );
    console.error('  3. Uruchom ponownie komendę:');
    console.error('       npm run db:init\n');
    console.error('='.repeat(70) + '\n');
    process.exit(1);
  }

  console.log('\n[SHOPPING CART RETRO v3.0] Inicjalizacja bazy Neon Postgres...');
  const sql = getNeonSql();
  await ensureSchemaAndSeed(sql, true);
  console.log('[SUKCES] Baza danych Neon Postgres została pomyślnie zainicjalizowana!');
}

main().catch((err: unknown) => {
  console.error('\n[BŁĄD] Inicjalizacja bazy nie powiodła się:', err);
  process.exit(1);
});
