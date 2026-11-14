#!/usr/bin/env node
/**
 * Shopping Cart (Retro CRT v3.0) — Neon Postgres DB Initializer
 *
 * Tworzy tabele: categories, products, customers, orders
 * oraz zasila bazę domyślnymi kategoriami i produktami.
 *
 * Użycie:
 *   npm run db:init
 * lub:
 *   DATABASE_URL="postgresql://..." node scripts/init-neon-db.mjs
 */

import console from 'node:console';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { neon } from '@neondatabase/serverless';

// 1. Ładowanie zmiennych środowiskowych z plików .env / .env.local (jeśli istnieją)
function loadEnvFile(fileName) {
  const envPath = path.resolve(process.cwd(), fileName);
  if (!fs.existsSync(envPath)) return;

  try {
    const raw = fs.readFileSync(envPath, 'utf-8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  } catch (err) {
    console.warn(`[WARN] Nie udało się odczytać ${fileName}:`, err?.message ?? err);
  }
}

loadEnvFile('.env.local');
loadEnvFile('.env');

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

// Dane domyślnych kategorii
const DEFAULT_CATEGORIES = [
  {
    id: 'cat-default',
    name: 'Ogólne',
    slug: 'ogolne',
    description: 'Domyślna kategoria dla produktów nieprzypisanych i migrowanych',
    isDefault: true,
  },
  {
    id: 'cat-elektronika',
    name: 'Elektronika',
    slug: 'elektronika',
    description: 'Sprzęt komputerowy, urządzenia audio i elektronika użytkowa',
    isDefault: false,
  },
  {
    id: 'cat-odziez',
    name: 'Odziez',
    slug: 'odziez',
    description: 'Odzież retro i tekstylia dla programistów',
    isDefault: false,
  },
  {
    id: 'cat-akcesoria',
    name: 'Akcesoria',
    slug: 'akcesoria',
    description: 'Akcesoria biurowe, torby, nośniki danych i peryferia',
    isDefault: false,
  },
  {
    id: 'cat-edukacja',
    name: 'Edukacja',
    slug: 'edukacja',
    description: 'Podręczniki, literatura techniczna i materiały edukacyjne',
    isDefault: false,
  },
  {
    id: 'cat-retro-hardware',
    name: 'Retro Hardware',
    slug: 'retro-hardware',
    description: 'Monitory CRT, klawiatury mechaniczne i zabytkowy sprzęt komputerowy',
    isDefault: false,
  },
];

// Dane domyślnego katalogu produktów (kwoty w groszach!)
const DEFAULT_CATALOG = [
  {
    id: 'prod-laptop',
    sku: 'HW-LAPTOP-01',
    name: 'Laptop',
    priceCents: 349999,
    categoryId: 'cat-elektronika',
    category: 'Elektronika',
    description: 'Wysokowydajny komputer przenośny do programowania i pracy biurowej.',
    inStock: true,
    stockQuantity: 12,
  },
  {
    id: 'prod-sluchawki',
    sku: 'AU-PHONE-02',
    name: 'Słuchawki',
    priceCents: 19999,
    categoryId: 'cat-elektronika',
    category: 'Elektronika',
    description: 'Wygodne słuchawki stereofoniczne z redukcją szumów otoczenia.',
    inStock: true,
    stockQuantity: 25,
  },
  {
    id: 'prod-koszulka',
    sku: 'CL-TSHIRT-03',
    name: 'Koszulka',
    priceCents: 7999,
    categoryId: 'cat-odziez',
    category: 'Odziez',
    description: 'Bawelniana koszulka programisty z motywem terminalowym.',
    inStock: true,
    stockQuantity: 40,
  },
  {
    id: 'prod-plecak',
    sku: 'AC-BACKPACK-04',
    name: 'Plecak',
    priceCents: 14999,
    categoryId: 'cat-akcesoria',
    category: 'Akcesoria',
    description: 'Wodoodporny plecak na laptopa 15.6 cala i akcesoria.',
    inStock: true,
    stockQuantity: 18,
  },
  {
    id: 'prod-ksiazka-python',
    sku: 'BK-PYTHON-05',
    name: 'Książka Python',
    priceCents: 5999,
    categoryId: 'cat-edukacja',
    category: 'Edukacja',
    description:
      'Kompleksowy podręcznik programowania w języku Python od podstaw do zaawansowanych technik.',
    inStock: true,
    stockQuantity: 30,
  },
  {
    id: 'prod-crt-monitor',
    sku: 'RH-CRT17-06',
    name: 'Monitor CRT 17"',
    priceCents: 45000,
    categoryId: 'cat-retro-hardware',
    category: 'Retro Hardware',
    description: 'Klasyczny kineskopowy monitor z zielonym luminoforem P1 i odświeżaniem 85Hz.',
    inStock: true,
    stockQuantity: 4,
  },
  {
    id: 'prod-klawiatura-mech',
    sku: 'RH-KEYB-07',
    name: 'Klawiatura Mechaniczna Clicky',
    priceCents: 29900,
    categoryId: 'cat-retro-hardware',
    category: 'Retro Hardware',
    description:
      'Ciężka klawiatura ze sprężynami buckling spring, inspirowana legendarnym IBM Model M.',
    inStock: true,
    stockQuantity: 8,
  },
  {
    id: 'prod-dyskietki',
    sku: 'AC-FLOPPY-08',
    name: 'Dyskietka 3.5" HD (Paczka 10 szt.)',
    priceCents: 3999,
    categoryId: 'cat-akcesoria',
    category: 'Akcesoria',
    description: 'Pudełko 10 dyskietek magnetycznych 1.44 MB do archiwizacji danych offline.',
    inStock: true,
    stockQuantity: 50,
  },
];

const DEFAULT_CUSTOMERS = [
  { id: 'cust-demo-1', name: 'Jan Kowalski', email: 'jan.kowalski@example.com' },
  { id: 'cust-demo-2', name: 'Anna Nowak', email: 'anna.nowak@example.com' },
];

const DEFAULT_ORDER = {
  id: 'ord-demo-1001',
  timestamp: '2026-11-13T10:30:00.000Z',
  customer: {
    id: 'cust-demo-1',
    name: 'Jan Kowalski',
    email: 'jan.kowalski@example.com',
  },
  items: [
    {
      productId: 'prod-laptop',
      sku: 'HW-LAPTOP-01',
      name: 'Laptop',
      priceCents: 349999,
      quantity: 1,
      lineTotalCents: 349999,
    },
  ],
  subtotalCents: 349999,
  deliveryCents: 0,
  totalCents: 349999,
  paymentMethod: 'card',
  paymentDetails: {
    brand: 'VISA',
    last4: '4242',
  },
};

async function main() {
  console.log('\n============================================================');
  console.log(' [SHOPPING CART RETRO v3.0] Inicjalizacja bazy Neon Postgres');
  console.log('============================================================\n');

  const sql = neon(databaseUrl);

  console.log('-> Tworzenie tabel SQL (categories, products, customers, orders)...');

  await sql`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT,
      description TEXT NOT NULL,
      is_default BOOLEAN NOT NULL DEFAULT FALSE
    );
  `;
  console.log('   [OK] Tabela "categories" gotowa.');

  await sql`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      sku TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      price_cents INTEGER NOT NULL,
      category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      in_stock BOOLEAN NOT NULL DEFAULT TRUE,
      stock_quantity INTEGER NOT NULL DEFAULT 0
    );
  `;
  console.log('   [OK] Tabela "products" gotowa.');

  await sql`
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE
    );
  `;
  console.log('   [OK] Tabela "customers" gotowa.');

  await sql`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      customer_json JSONB NOT NULL,
      items_json JSONB NOT NULL,
      subtotal_cents INTEGER NOT NULL,
      delivery_cents INTEGER NOT NULL,
      total_cents INTEGER NOT NULL,
      payment_method TEXT NOT NULL,
      payment_details_json JSONB NOT NULL
    );
  `;
  console.log('   [OK] Tabela "orders" gotowa.');

  console.log('\n-> Weryfikacja i zasilanie domyślnych kategorii...');
  for (const cat of DEFAULT_CATEGORIES) {
    await sql`
      INSERT INTO categories (id, name, slug, description, is_default)
      VALUES (${cat.id}, ${cat.name}, ${cat.slug}, ${cat.description}, ${cat.isDefault})
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        slug = EXCLUDED.slug,
        description = EXCLUDED.description,
        is_default = EXCLUDED.is_default;
    `;
  }
  console.log(`   [OK] Zaktualizowano ${DEFAULT_CATEGORIES.length} domyślnych kategorii.`);

  console.log('-> Weryfikacja i zasilanie domyślnego katalogu produktów...');
  for (const prod of DEFAULT_CATALOG) {
    await sql`
      INSERT INTO products (id, sku, name, price_cents, category_id, category, description, in_stock, stock_quantity)
      VALUES (${prod.id}, ${prod.sku}, ${prod.name}, ${prod.priceCents}, ${prod.categoryId}, ${prod.category}, ${prod.description}, ${prod.inStock}, ${prod.stockQuantity})
      ON CONFLICT (id) DO UPDATE SET
        sku = EXCLUDED.sku,
        name = EXCLUDED.name,
        price_cents = EXCLUDED.price_cents,
        category_id = EXCLUDED.category_id,
        category = EXCLUDED.category,
        description = EXCLUDED.description,
        in_stock = EXCLUDED.in_stock,
        stock_quantity = EXCLUDED.stock_quantity;
    `;
  }
  console.log(`   [OK] Zaktualizowano ${DEFAULT_CATALOG.length} produktów.`);

  // Opcjonalnie zasil klientów jeśli pusto
  const custRows = await sql`SELECT COUNT(*)::int AS count FROM customers;`;
  if (Number(custRows[0]?.count ?? 0) === 0) {
    console.log('-> Tabela klientów jest pusta — wstawianie klientów demonstracyjnych...');
    for (const cust of DEFAULT_CUSTOMERS) {
      await sql`
        INSERT INTO customers (id, name, email)
        VALUES (${cust.id}, ${cust.name}, ${cust.email})
        ON CONFLICT (id) DO NOTHING;
      `;
    }
    console.log('   [OK] Wstawiono 2 przykładowych klientów.');
  }

  // Opcjonalnie zasil zamówienia jeśli pusto
  const ordRows = await sql`SELECT COUNT(*)::int AS count FROM orders;`;
  if (Number(ordRows[0]?.count ?? 0) === 0) {
    console.log('-> Tabela zamówień jest pusta — wstawianie przykładowego zamówienia demo...');
    await sql`
      INSERT INTO orders (id, timestamp, customer_json, items_json, subtotal_cents, delivery_cents, total_cents, payment_method, payment_details_json)
      VALUES (
        ${DEFAULT_ORDER.id},
        ${DEFAULT_ORDER.timestamp},
        ${JSON.stringify(DEFAULT_ORDER.customer)},
        ${JSON.stringify(DEFAULT_ORDER.items)},
        ${DEFAULT_ORDER.subtotalCents},
        ${DEFAULT_ORDER.deliveryCents},
        ${DEFAULT_ORDER.totalCents},
        ${DEFAULT_ORDER.paymentMethod},
        ${JSON.stringify(DEFAULT_ORDER.paymentDetails)}
      )
      ON CONFLICT (id) DO NOTHING;
    `;
    console.log('   [OK] Wstawiono zamówienie startowe.');
  }

  console.log('\n============================================================');
  console.log(' [SUKCES] Baza danych Neon Postgres została pomyślnie');
  console.log(' zainicjalizowana i jest gotowa do pracy w wersji v3.0!');
  console.log('============================================================\n');
}

main().catch((err) => {
  console.error('\n[BŁĄD KRYTYCZNY] Podczas inicjalizacji bazy wystąpił błąd:');
  console.error(err);
  process.exit(1);
});
