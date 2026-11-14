# Shopping Cart (Retro CRT v3.0)

[![CI/CD Pipeline](https://github.com/phxphoenix/Shopping_cart/actions/workflows/ci-deploy.yml/badge.svg)](https://github.com/phxphoenix/Shopping_cart/actions/workflows/ci-deploy.yml)
[![Wersja produkcyjna](https://img.shields.io/badge/demo-GitHub%20Pages-00ff66?style=flat&logo=github)](https://phxphoenix.github.io/Shopping_cart/)
[![Vercel](https://img.shields.io/badge/Vercel-Fluid%20Compute-black?style=flat&logo=vercel)](https://vercel.com/)
[![Neon Postgres](https://img.shields.io/badge/Neon-Serverless%20Postgres-00e599?style=flat&logo=postgresql)](https://neon.tech/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7%20Strict-blue?logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.0-61dafb?logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6.1-646cff?logo=vite)](https://vitejs.dev/)

Nowoczesna aplikacja e-commerce full-stack utrzymana w surowym klimacie **monochromatycznego zielonego terminala kineskopowego (Retro CRT)**. Aplikacja łączy klimat komputerów mainframe i cyberdecków z lat 80. z architekturą klasy korporacyjnej: bezserwerowym backendem **Vercel Functions** na silniku **Fluid Compute**, chmurową relacyjną bazą danych **Neon Serverless Postgres**, serwerową autoryzacją kryptograficzną (`HttpOnly` cookie + HMAC-SHA256), zaostrzonymi standardami ochrony prywatności klientów (PII/Honeypot/Rate-Limiting) oraz rygorystycznymi standardami PCI-DSS.

Projekt stanowi ewolucję pierwotnego prototypu Tkinter/FastAPI (v1.0) oraz statycznego SPA (v2.0) w pełnoprawną platformę e-commerce (v3.0) z dedykowanym **Panelem Administracyjnym** do zarządzania katalogiem produktów, kategoriami, migracjami asortymentu oraz bazą klientów.

---

## 🌐 Wersja demonstracyjna (Produkcja)

- Podgląd statyczny: **[https://phxphoenix.github.io/Shopping_cart/](https://phxphoenix.github.io/Shopping_cart/)**
- Platforma docelowa: **Vercel (Hobby) + Neon Serverless Postgres**

---

## 🕹️ Główne funkcjonalności (Wersja v3.0)

```text
+------------------------------------------------------------------------------------------------+
|  SHOPPING CART // TERMINAL v3.0       [PANEL ADMINA] [CRT FX: ON] [IMPORT] [EXPORT] [DEMO]    |
+------------------------------------------------------------------------------------------------+
| // KATALOG PRODUKTÓW        | // KOSZYK (PRÓG 200 ZŁ)     | // KASA & PŁATNOŚĆ (PCI-DSS)       |
| - Dynamiczne kategorie      | - Regulacja ilości (+/-)    | - Karta (Luhn + brak zapisu CVV!)  |
| - Szukaj po nazwie i SKU    | - Pasek darmowej dostawy    | - PayPal (walidacja e-mail)        |
| - Stany magazynowe / InStock| - Suma + Dostawa / GRATIS   | - Bitcoin (Base58 / Bech32)        |
+-----------------------------+-----------------------------+------------------------------------+
| // BAZA KLIENTÓW (PUBLICZNA)| // HISTORIA ZAMÓWIEŃ                                             |
| - Maskowanie PII: j***i@... | - Tabela zamówień, modal szczegółów, usuwanie                      |
| - Anty-bot Honeypot + Limity| - Eksport raportu ASCII: order_history_YYYYMMDD_HHMMSS.txt       |
+------------------------------------------------------------------------------------------------+
| // SEKCJA ADMINISTRACYJNA (PO ZALOGOWANIU HASŁEM)                                              |
| [1] KATEGORIE: Dodawanie, edycja, usuwanie (z reasumpcją produktów do kat. domyślnej "Ogólne")|
| [2] PRODUKTY: Pełny CRUD produktów, stany magazynowe, walidacja SKU i cen groszowych          |
| [3] MIGRACJA: Masowe przenoszenie wybranych produktów między kategoriami                      |
| [4] KLIENCI: Pełne adresy e-mail, historia i jedyne uprawnione miejsce usuwania klientów      |
+------------------------------------------------------------------------------------------------+
| SYSTEM READY > Wszystkie moduły v3.0 załadowane.                                              |
+------------------------------------------------------------------------------------------------+
```

### 1. Panel Administracyjny z autoryzacją serwerową
- **Dostęp chroniony hasłem:** Weryfikacja hasła odbywa się **wyłącznie na backendzie** (`POST /api/admin/login`) za pomocą bezpiecznego algorytmu `crypto.scryptSync` oraz porównania w czasie stałym `crypto.timingSafeEqual` (ochrona przed atakami typu timing attack).
- **Bezpieczna sesja `HttpOnly`:** Podpisany kryptograficznie token HMAC-SHA256 (`SameSite=Strict; Path=/; HttpOnly; Max-Age=7200`) zapobiega kradzieży sesji przez ataki XSS. Hasło ani klucz sesji nigdy nie trafiają do kodu przeglądarki.
- **Ochrona przed brute-force:** Ograniczenie do maksymalnie 5 prób logowania na 15 minut (kod HTTP 429).
- **Zarządzanie sesją:** Automatyczna detekcja aktywnej sesji (`GET /api/admin/session`) oraz bezpieczne wylogowanie z czyszczeniem ciasteczka (`DELETE /api/admin/session`).

### 2. Zarządzanie kategoriami i gwarancja integralności katalogu
- **Dynamiczne kategorie:** Dodawanie nowych kategorii z opisami oraz edycja istniejących.
- **Nieusuwalna kategoria domyślna:** System wymusza obecność kategorii `Ogólne` (`id: 'cat-default'`, `isDefault: true`), której nie można usunąć ani zduplikować.
- **Automatyczna reasumpcja produktów:** Usunięcie kategorii posiadającej przypisane produkty automatycznie reasumpuje te produkty do kategorii domyślnej `Ogólne` (lub wybranej kategorii docelowej), gwarantując brak "osieroconych" produktów.

### 3. Masowa migracja produktów między kategoriami
- Dedykowana zakładka `[3] MIGRACJA PRODUKTÓW` w Panelu Admina.
- Wybór kategorii źródłowej i docelowej z możliwością wybiórczego zaznaczenia produktów do migracji lub wykonania operacji zbiorczej (`Zaznacz wszystkie` / `Odznacz wszystkie`).
- Atomowe wykonanie operacji na serwerze (`POST /api/categories/migrate`).

### 4. Ochrona danych klientów (PII Hygiene) i anty-spam
- **Maskowanie adresów e-mail:** W widoku publicznym adresy klientów są zanonimizowane (np. `jan.kowalski@example.com` -> `j***i@example.com`). Pełne dane są widoczne wyłącznie dla zalogowanego administratora.
- **Przeniesienie akcji destrukcyjnych:** Usunięto przycisk `USUŃ` z publicznego panelu klientów. Usuwanie klientów (`DELETE /api/customers`) jest dozwolone wyłącznie w Panelu Admina po poprawnej autoryzacji sesji.
- **Unikalność e-maili:** Rejestracja wymusza unikalność adresu e-mail (case-insensitive) i zwraca kod `409 Conflict` przy próbie ponownego zapisu.
- **Ochrona przed botami (Honeypot):** Niewidoczne dla użytkownika pole `companyWebsite` blokuje automatyczne boty spamujące formularz.
- **Rate-limiting rejestracji:** Maksymalnie 5 rejestracji w oknie 10 minut na IP/sesję (HTTP 429).

### 5. Finanse, Koszyk i Płatności (PCI-DSS Hygiene)
- **Arytmetyka całkowitoliczbowa w groszach (`Cents`):** Eliminacja błędów float IEEE 754. Wszystkie kalkulacje (ceny, dostawa, sumy częściowe) operują na liczbach całkowitych.
- **Próg darmowej dostawy:** 200,00 zł (20 000 groszy). Koszt standardowy: 15,00 zł (1 500 groszy).
- **Bezpieczeństwo kart kredytowych:** Kod CVV weryfikowany jest wyłącznie w ulotnej pamięci formularza i **nigdy** nie jest zapisywany w bazie danych ani eksportowany. Numer karty po weryfikacji algorytmem Luhna jest maskowany do `**** **** **** 1234`.
- **Alternatywne metody płatności:** PayPal (walidacja e-mail) oraz Bitcoin (portfele Base58 i Bech32 SegWit z przelicznikiem w czasie rzeczywistym).

### 6. Architektura danych Dual-Mode
- **`NeonShopRepository`:** Pełna obsługa relacyjnej bazy Neon Serverless Postgres (`@neondatabase/serverless`) przy skonfigurowanej zmiennej `DATABASE_URL`.
- **`InMemoryShopRepository`:** W pełni deterministyczny fallback pamięciowy wykorzystywany automatycznie w testach jednostkowych/integracyjnych i środowiskach lokalnych bez konieczności uruchamiania zewnętrznych usług.
- **Klient SPA:** Lokalne cache'owanie w `IndexedDB` (`idb-keyval`) z przezroczystym fallbackiem offline i kompatybilnością wsteczną z plikami `data.json`.

---

## 🚀 Wdrożenie na Vercel (Hobby) + Neon Postgres (Krok po kroku)

Darmowy plan Vercel Hobby w połączeniu z darmową bazą Neon Serverless Postgres pozwala wdrożyć pełny sklep produkcyjny w kilka minut bez ponoszenia żadnych kosztów.

### Krok 1: Klonowanie repozytorium
```bash
git clone https://github.com/phxphoenix/Shopping_cart.git
cd Shopping_cart
npm ci
```

### Krok 2: Połączenie projektu z platformą Vercel
Upewnij się, że posiadasz zainstalowane Vercel CLI (`npm i -g vercel`) i zaloguj się:
```bash
vercel login
vercel link
```

### Krok 3: Podpięcie darmowej bazy Neon Postgres
Możesz podpiąć bazę jednym poleceniem z poziomu Vercel Marketplace:
```bash
vercel integration add neon
```
*Alternatywnie:* Utwórz bezpłatny projekt bezpośrednio na [neon.tech](https://neon.tech) i skopiuj parametr połączenia `DATABASE_URL`.

### Krok 4: Konfiguracja zmiennych środowiskowych na Vercel
Dodaj kluczowe parametry bezpieczeństwa do środowiska produkcyjnego i preview:
```bash
# 1. Hasło administratora (wybierz własne silne hasło):
vercel env add ADMIN_PASSWORD production
vercel env add ADMIN_PASSWORD preview

# 2. Sekret podpisywania sesji HMAC (losowy ciąg min. 32 znaków):
vercel env add ADMIN_SESSION_SECRET production
vercel env add ADMIN_SESSION_SECRET preview

# 3. Jeśli tworzyłeś bazę ręcznie na neon.tech, dodaj DATABASE_URL:
# vercel env add DATABASE_URL production
# vercel env add DATABASE_URL preview
```

### Krok 5: Pobranie zmiennych do środowiska lokalnego i inicjalizacja bazy
Pobierz zmienne do lokalnego pliku `.env.local`:
```bash
vercel env pull .env.local
```

Uruchom skrypt inicjalizujący schemat tabel SQL oraz dane startowe katalogu:
```bash
npm run db:init
```
Skrypt połączy się z bazą Neon, utworzy tabele (`categories`, `products`, `customers`, `orders`) i zasili je domyślnym asortymentem retro CRT.

### Krok 6: Wdrożenie produkcyjne na Vercel
```bash
vercel --prod
```
Twoja aplikacja jest dostępna globalnie z routingiem bezserwerowym Vercel Functions na Fluid Compute!

---

## 💻 Uruchomienie lokalne (Development)

1. **Uruchomienie serwera deweloperskiego:**
   ```bash
   npm run dev
   ```
   Aplikacja uruchomi się pod adresem: `http://localhost:3000/` (lub zintegrowanym portem Vite).
   Wbudowany middleware `viteApiPlugin` obsługuje żądania `/api/*` bezpośrednio w Node.js bez potrzeby osobnego procesu backendowego!

2. **Domyślne poświadczenia administratora w trybie deweloperskim:**
   - Hasło: `admin123` (lub `admin-retro-2026`)

3. **Budowanie wersji produkcyjnej:**
   ```bash
   npm run build
   ```

4. **Podgląd wersji produkcyjnej lokalnie:**
   ```bash
   npm run preview
   ```

---

## 🧪 Bramki Jakości i Testy

Projekt posiada 100% zautomatyzowane bramki jakości:

```bash
# 1. Linter kodu ESLint
npm run lint

# 2. Weryfikacja formatowania Prettier
npm run format:check

# 3. Weryfikacja typów TypeScript (strict)
npm run typecheck

# 4. Testy jednostkowe, serwerowe i integracyjne z pokryciem (Vitest)
npm run test:coverage

# 5. Budowanie produkcyjne
npm run build

# 6. Testy End-to-End oraz audyt dostępności WCAG AA (Playwright + Axe)
npm run test:e2e
```

---

## 🏛️ Struktura Projektu v3.0

Szczegółowy opis architektury znajduje się w pliku [ARCHITECTURE.md](ARCHITECTURE.md).

```text
Shopping_cart/
├── .github/
│   └── workflows/
│       └── ci-deploy.yml          # Pipeline CI/CD GitHub Actions (verify + deploy)
├── api/                           # Vercel Functions (Node.js runtime na Fluid Compute)
│   ├── admin/
│   │   ├── login.ts               # Autoryzacja hasłem (scryptSync + timingSafeEqual)
│   │   └── session.ts             # Stan sesji (HttpOnly cookie HMAC-SHA256)
│   ├── categories/
│   │   └── migrate.ts             # Masowa migracja produktów między kategoriami
│   ├── categories.ts              # CRUD kategorii z automatyczną reasumpcją produktów
│   ├── customers.ts               # Klienci: publiczne maskowanie PII, honeypot, usuwanie admina
│   ├── orders.ts                  # Składanie zamówień z serwerową walidacją cen i katalogu
│   ├── products.ts                # CRUD produktów, walidacja SKU i stanów magazynowych
│   └── state.ts                   # Agregacja stanu startowego sklepu
├── legacy/                        # Zarchiwizowany kod pierwotnej wersji v1 (Python)
├── public/                        # Statyczne zasoby publiczne
├── scripts/
│   ├── init-neon-db.mjs           # Skrypt CLI inicjalizacji i seedowania bazy Neon Postgres
│   └── init-neon-db.ts            # Skrypt TypeScript do inicjalizacji schematu DB
├── src/
│   ├── components/                # Komponenty UI Retro CRT (React 19)
│   │   ├── AdminLoginModal.tsx    # Modal logowania administratora
│   │   ├── AdminPanel.tsx         # Panel administracyjny (Kategorie, Produkty, Migracja, Klienci)
│   │   ├── CatalogPanel.tsx       # Dynamiczny katalog z filtrami i stanami magazynowymi
│   │   ├── CartPanel.tsx          # Koszyk groszowy z paskiem darmowej dostawy
│   │   ├── CustomersPanel.tsx     # Baza klientów z maskowaniem e-maili i polem honeypot
│   │   ├── CheckoutPanel.tsx      # Formularz kasy i 3 metody płatności (PCI-DSS)
│   │   ├── OrderHistoryPanel.tsx  # Tabela historii zamówień i eksport .txt
│   │   ├── OrderDetailsModal.tsx  # Modal szczegółów zamówienia
│   │   ├── HeaderBar.tsx          # Pasek systemowy z dostępem do panelu admina
│   │   └── StatusBar.tsx          # Terminalowy pasek stanu (aria-live="polite")
│   ├── domain/                    # Czysta domena biznesowa (0 zależności DOM/React)
│   │   ├── catalog.ts             # Dynamiczne kategorie, produkty i operacje migracji
│   │   ├── customer.ts            # Schematy rejestracji, honeypot i maskowanie e-maili
│   │   ├── money.ts               # Brandowany typ Cents, parsePlnInputToCents, formatPLN
│   │   ├── cart.ts                # Reguły koszyka, progi dostawy i synchronizacja
│   │   ├── payment.ts             # Algorytm Luhna, maskowanie kart i walidacje
│   │   ├── exportTxt.ts           # Generator raportu tabelarycznego ASCII .txt
│   │   └── schemas.ts             # Schematy Zod i migracja v1/v2/v3
│   ├── server/                    # Logika serwerowa współdzielona z api/
│   │   ├── auth.ts                # Bezpieczna autoryzacja, podpisywanie tokenów, rate-limiting
│   │   ├── db.ts                  # Leniwa inicjalizacja getNeonSql() i schemat tabel
│   │   ├── repository.ts          # Interfejs repozytorium: NeonShopRepository + InMemoryShopRepository
│   │   └── viteApiPlugin.ts       # Middleware Vite do lokalnego testowania endpointów api/
│   ├── storage/                   # Warstwa persystencji klienta (IndexedDB + fallback)
│   ├── store/                     # Globalny stan aplikacji (Zustand + synchronizacja API)
│   ├── styles/                    # System stylów i zmiennych CSS Retro CRT
│   ├── App.tsx                    # Główny kontener aplikacji i widok Admina
│   └── main.tsx                   # Punkt wejścia React DOM
├── tests/
│   ├── e2e/                       # Testy Playwright E2E + Axe A11y (w tym panel admina i a11y)
│   ├── integration/               # Testy integracyjne store, UI RTL i panelu admina
│   └── unit/                      # Testy jednostkowe domeny, serwera, auth i komponentów
├── AGENTS.md                      # Twarde reguły inżynieryjne dla agentów AI
├── ARCHITECTURE.md                # Szczegółowa specyfikacja architektury full-stack v3.0
├── CHANGELOG.md                   # Historia zmian w standardzie Keep a Changelog
├── package.json                   # Konfiguracja projektu i skrypty npm (w tym db:init)
├── playwright.config.ts           # Konfiguracja Playwright ze startem serwera podglądu
├── vercel.json                    # Konfiguracja Vercel: Fluid Compute + rewrites SPA
└── vite.config.ts                 # Konfiguracja Vite z middleware viteApiPlugin
```

---

## 📜 Zarchiwizowany kod v1 (Python)

Pierwotny kod v1 (desktop Tkinter, backend FastAPI, baza SQLite) znajduje się w celach referencyjnych w katalogu [`legacy/`](legacy/).

---

## 📄 Licencja

Projekt udostępniany na warunkach licencji open-source (MIT).
