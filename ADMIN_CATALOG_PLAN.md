# Shopping Cart (Retro CRT v3.0) — Plan Wdrożenia Modułu Administracyjnego, Konfiguracji Katalogu i Backendu (Vercel + Neon Postgres)

Ten dokument stanowi kompletny, wykonalny plan rozbudowy aplikacji **Shopping Cart (Retro CRT)** z wersji statycznej **v2.0** do wersji **v3.0 Full-Stack** działającej na **Vercel (Hobby) + Neon Serverless Postgres**.

Plan zawiera:
1. Architekturę docelową i specyfikację bezpieczeństwa (autoryzacja Admina, ochrona PII klientów, walidacja i rate-limiting).
2. Strategię doboru modeli **Gemini 4 Argon** oraz **Gemini 4 Hydrogen** do poszczególnych zadań.
3. Szczegółowy podział na **Etapy 0–6** wraz z kryteriami **Definition of Done** i gotowymi promptami dla każdego etapu.
4. **Master Prompt (One-Shot Orchestrator)** — pojedynczy prompt dla agenta, który przeprowadzi cały development automatycznie przez wszystkie etapy od początku do końca.

---

## 1. Podsumowanie decyzji projektowych i architektury (v3.0)

### 1.1. Kluczowe założenia biznesowe i techniczne

1. **Hosting i Backend (Wariant C — Vercel Hobby + Neon Serverless Postgres):**
   - Frontend (**React 19 + TypeScript + Vite**) oraz Backend (**Vercel Functions** na domyślnym runtime **Node.js / Fluid Compute** w katalogu `api/`) są wdrażane wspólnie w ramach jednego projektu Vercel.
   - Baza danych **Neon Serverless Postgres** (`@neondatabase/serverless`) przechowuje kategorie, produkty, zarejestrowanych klientów oraz zamówienia.
   - **Architektura Dual-Mode (100% deterministyczne testy i praca lokalna):** Warstwa danych na backendzie korzysta z interfejsu `ShopRepository` z dwiema implementacjami:
     - `NeonShopRepository` — używana automatycznie, gdy skonfigurowana jest zmienna `DATABASE_URL` (produkcja/preview na Vercel oraz `vercel dev`).
     - `InMemoryShopRepository` — używana automatycznie w środowisku testowym (Vitest, Playwright E2E na `vite preview` z pluginem obsługującym `/api/*`) oraz jako fallback deweloperski, gdy `DATABASE_URL` nie jest ustawione. Dzięki temu **te same endpointy `/api/*`, ciasteczka autoryzacyjne, walidatory Zod i limity zapytań** są testowane w 100% automatycznie bez ryzyka awarii CI.

2. **Zarządzanie Kategoriami i Migracja Produktów:**
   - Zastąpienie sztywnego typu `ProductCategory` dynamiczną encją `Category` (`id`, `name`, `slug`, `description`, `isDefault`).
   - Istnienie chronionej kategorii domyślnej (`id: 'cat-default'`, `name: 'Ogólne'`, `isDefault: true`), której nie można usunąć.
   - **Usuwanie kategorii:** Usunięcie kategorii posiadającej przypisane produkty **automatycznie przenosi** te produkty do kategorii domyślnej (`Ogólne`) lub do innej kategorii docelowej wskazanej podczas usuwania.
   - **Dedykowany mechanizm migracji produktów między kategoriami:**
     - Możliwość masowego przeniesienia wszystkich lub wybranych produktów z kategorii źródłowej `A` do kategorii docelowej `B` jednym poleceniem (`POST /api/categories/migrate`).
     - Możliwość zmiany kategorii pojedynczego produktu w formularzu edycji produktu lub bezpośrednio z tabeli produktów w Panelu Admina.

3. **Sekcja Administracyjna z prawdziwym logowaniem serwerowym:**
   - Dostęp do konfiguracji kategorii, konfiguracji produktów, migracji produktów między kategoriami oraz przeglądania pełnej bazy i **usuwania klientów** jest chroniony logowaniem administratora.
   - Weryfikacja hasła odbywa się **wyłącznie po stronie serwera** (`POST /api/admin/login`) przy użyciu bezpiecznego porównania stałoczasowego (`crypto.scryptSync` / `crypto.timingSafeEqual`) względem zmiennych środowiskowych `ADMIN_PASSWORD_HASH` / `ADMIN_PASSWORD`.
   - Po zalogowaniu serwer wystawia podpisane kryptograficznie ciasteczko sesyjne `HttpOnly; SameSite=Strict; Path=/` (HMAC-SHA256 z kluczem `ADMIN_SESSION_SECRET`, ważność 2 godziny).
   - Wszystkie mutujące endpointy administracyjne (`/api/categories/*`, `/api/products/*`, `DELETE /api/customers/:id`, `GET /api/admin/customers`) weryfikują sesję po stronie serwera i zwracają `401 Unauthorized` w przypadku braku uprawnień.

4. **Bezpieczeństwo rejestracji klientów i ochrona prywatności (Best Practices):**
   - **Przeniesienie usuwania klientów do Admina:** Przycisk `USUŃ` znika całkowicie z publicznego komponentu [`CustomersPanel.tsx`](file:///c:/Users/phxpo/OneDrive/Dokumenty/Dev/Shopping%20cart/src/components/CustomersPanel.tsx) i trafia wyłącznie do zakładki `[3] KLIENCI` w Panelu Administracyjnym.
   - **Ochrona danych osobowych (PII / RODO) w widoku publicznym:**
     - Publiczny `CustomersPanel` nie wyświetla już pełnych adresów e-mail wszystkich klientów z bazy.
     - Na liście publicznej adresy e-mail są zamaskowane (np. `j***i@example.com`), a istniejącego klienta można odblokować/wybrać w sesji poprzez szybkie potwierdzenie jego adresu e-mail (lub utworzenie nowego konta w bieżącej sesji).
   - **Zaostrzona walidacja i ochrona anty-spamowa przy rejestracji (`POST /api/customers`):**
     - **Unikalność e-maila (case-insensitive):** Próba rejestracji istniejącego adresu e-mail zwraca kod `409 Conflict` z czytelną informacją w UI.
     - **Walidacja danych (Zod):** Imię i nazwisko od 3 do 80 znaków (wyłącznie litery, polskie znaki diakrytyczne, spacje, myślniki i apostrofy — blokada tagów HTML/XSS oraz ciągów cyfr/znaków specjalnych); e-mail znormalizowany (`trim().toLowerCase()`), max 120 znaków, poprawna domena TLD.
     - **Honeypot anty-botowy:** Ukryte pole formularza (`companyWebsite`, `tabIndex={-1}`, `aria-hidden="true"`, ukryte w CSS) — jeśli zostanie wypełnione przez bota, serwer odrzuca rejestrację (w 100% zgodne z WCAG AA i bez stosowania CAPTCHA).
     - **Rate Limiting:** Maksymalnie 5 rejestracji z jednego adresu IP / sesji w ciągu 10 minut (`429 Too Many Requests`).

---

### 1.2. Diagram architektury docelowej (v3.0)

```mermaid
flowchart TD
    subgraph Client ["Frontend SPA (React 19 + TypeScript + Retro CRT)"]
        Header["HeaderBar (Przełącznik SKLEP / ADMIN, CRT FX, Backup)"]
        ShopUI["Widok Sklepu: CatalogPanel, CartPanel, CustomersPanel (bez USUŃ, maskowane PII), CheckoutPanel, OrderHistoryPanel"]
        AdminGate["AdminLoginModal (Logowanie Hasłem + Blokada Brute-Force)"]
        AdminUI["AdminPanel: [1] Kategorie, [2] Produkty, [3] Migracja, [4] Klienci (Pełne PII + USUŃ)"]
        Store["useShopStore (Zustand: Synchronizacja z API + Lokalny Cache IndexedDB)"]
    end

    subgraph PureDomain ["Czysta Domena (src/domain/ — współdzielona między Frontem i API)"]
        Money["money.ts (Cents, parsePlnInputToCents, formatPLN)"]
        CatalogDom["catalog.ts (Category, Product, migracja kategorii, walidacja SKU)"]
        CustomerDom["customer.ts (Walidacja rejestracji, maskowanie email PII, honeypot)"]
        Schemas["schemas.ts (Zod v3 + migracja v1/v2 -> v3)"]
    end

    subgraph Backend ["Vercel Functions (Node.js Fluid Compute — api/)"]
        AuthAPI["/api/admin/login | logout | session (HttpOnly HMAC Cookie + Rate Limit)"]
        CatAPI["/api/categories & /api/categories/migrate (GET public, POST/PUT/DELETE admin)"]
        ProdAPI["/api/products (GET public, POST/PUT/DELETE admin)"]
        CustAPI["/api/customers (GET masked public / full admin, POST rate-limited, DELETE admin)"]
        OrdAPI["/api/orders (GET, POST z weryfikacją cen z katalogu serwerowego!, DELETE admin)"]
    end

    subgraph DataLayer ["Warstwa Danych (ShopRepository)"]
        NeonDB[("Neon Serverless Postgres (@neondatabase/serverless)")]
        MemDB[("InMemoryShopRepository (Testy / Local Dev Fallback)")]
    end

    Header --> ShopUI
    Header --> AdminGate
    AdminGate -->|Sesja OK| AdminUI
    ShopUI --> Store
    AdminUI --> Store
    Store -->|Fetch / Mutacje HTTP| Backend
    Client --> PureDomain
    Backend --> PureDomain
    Backend --> DataLayer
    DataLayer -->|DATABASE_URL obecny| NeonDB
    DataLayer -.->|Brak DATABASE_URL / Testy| MemDB
```

---

## 2. Dobór modeli (Gemini 4 Argon & Gemini 4 Hydrogen)

Zgodnie z wytycznymi projektowymi, prace zostały podzielone pomiędzy modele **Gemini 4 Argon** (najwyższa głębokość rozumowania architektonicznego, bezpieczeństwo, skomplikowane testy E2E) oraz **Gemini 4 Hydrogen** (wysoka szybkość i precyzja w zadaniach konfiguracyjnych, UI wg gotowej specyfikacji oraz dokumentacji).

| Etap | Zakres prac | Rekomendowany model w UI | Parametr `Model` w `invoke_subagent` (dla Master Promptu) | Uzasadnienie doboru |
|---|---|---|---|---|
| **Etap 0** | Przygotowanie pod Vercel + Neon, konfiguracja `vite.config.ts` / `vercel.json`, aktualizacja `AGENTS.md` | **Gemini 4 Hydrogen (Medium / High)** | `flash` | Zadanie konfiguracyjne i porządkowe o niskim ryzyku logicznym. |
| **Etap 1** | Czysta domena v3: `Category`, `Product`, migracja kategorii, parser cen `PLN -> Cents`, walidacja i maskowanie PII klientów, migracja schematu `v2 -> v3`, testy unit (`>= 95%`) | **Gemini 4 Argon (High)** | `pro` | Krytyczna logika biznesowa, finansowa i bezpieczeństwa danych; wymaga najwyższej precyzji typów TypeScript i testów brzegowych. |
| **Etap 2** | Backend Vercel Functions (`api/`), repozytorium Neon Postgres + fallback in-memory, autoryzacja Admina (`HttpOnly` HMAC cookie), rate-limiting, weryfikacja cen po stronie serwera, testy API | **Gemini 4 Argon (High)** | `pro` | Architektura bezpieczeństwa serwerowego, kryptografia sesji, zapytania SQL w Neon i obsługa middleware. |
| **Etap 3** | Rozbudowa `useShopStore` (Zustand) i warstwy `storage/`: synchronizacja z API `/api/*`, obsługa sesji Admina, synchronizacja koszyka przy edycji/usunięciu produktu, testy integracyjne store | **Gemini 4 Argon (Medium / High)** | `pro` | Złożona synchronizacja stanu asynchronicznego (API + lokalny cache + reaktywność koszyka). |
| **Etap 4** | Komponenty UI Retro CRT: `AdminLoginModal`, `AdminPanel` (Kategorie, Produkty, Migracja, Klienci), przebudowa `CustomersPanel` (brak `USUŃ`, maskowane PII, honeypot) i `CatalogPanel` | **Gemini 4 Hydrogen (High)** *(lub Argon Medium)* | `flash` *(lub `pro`)* | Dobrze zdefiniowana praca front-endowa w istniejącym systemie stylów Retro CRT i tokenów CSS. |
| **Etap 5** | Aktualizacja i rozbudowa testów komponentowych RTL, pełna suita Playwright E2E (logowanie, CRUD kategorii/produktów, migracja, ochrona 401/403, rejestracja klientów) + skan `@axe-core/playwright` | **Gemini 4 Argon (High)** | `pro` | Debugowanie asynchronicznych scenariuszy E2E w przeglądarce, ciasteczek sesyjnych i rygorystycznych reguł dostępności WCAG AA. |
| **Etap 6** | Skrypt inicjalizacji/migracji bazy Neon (`db:push` / `db:seed`), aktualizacja CI/CD, dokumentacja (`README.md`, `ARCHITECTURE.md`, `CHANGELOG.md`) i końcowy audyt jakości | **Gemini 4 Hydrogen (High)** | `flash` | Zadanie domykające, dokumentacyjne i weryfikujące spójność repozytorium. |

---

## 3. Plan etapowy i gotowe prompty wykonawcze (Etapy 0–6)

---

### Etap 0: Przygotowanie projektu pod Vercel + Neon Postgres i aktualizacja `AGENTS.md`

- **Cel:** Dostosowanie konfiguracji projektu do hostingu full-stack na Vercel (Hobby) z bazą Neon Postgres, instalacja lekkiego sterownika `@neondatabase/serverless`, przygotowanie pliku `.env.example` oraz aktualizacja reguł w `AGENTS.md`.
- **Model:** **Gemini 4 Hydrogen (Medium / High)** (subagent: `flash`)
- **Definition of Done:**
  - Utworzony branch roboczy `feat/admin-catalog-v3` (jeśli jeszcze nie istnieje).
  - Zainstalowany pakiet `@neondatabase/serverless`.
  - Zaktualizowany `vite.config.ts`: domyślny `base` ustawiony na `'/'` dla Vercel (z zachowaniem obsługi `process.env.VITE_BASE_PATH` dla ewentualnego statycznego preview).
  - Utworzony plik `.env.example` dokumentujący wymagane zmienne środowiskowe (`DATABASE_URL`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`).
  - Zaktualizowany `AGENTS.md` o reguły architektury v3.0 (autoryzacja serwerowa Admina, zakaz ekspozycji sekretów w `VITE_*`, ochrona PII klientów, kategoria domyślna i migracja produktów).
  - Wszystkie dotychczasowe bramki (`npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`) przechodzą na zielono.

#### Prompt do skopiowania (Etap 0):
```text
/goal
Przeczytaj @AGENTS.md oraz @ADMIN_CATALOG_PLAN.md i wykonaj wyłącznie Etap 0 (przygotowanie konfiguracji pod Vercel + Neon Postgres oraz aktualizacja AGENTS.md).

Zadania:
1. Upewnij się, że pracujesz na branchu roboczym `feat/admin-catalog-v3` (utwórz go i przełącz się na niego z aktualnego brancha, jeśli jeszcze nie istnieje).
2. Zainstaluj zależność produkcyjną `@neondatabase/serverless` (`npm install @neondatabase/serverless`).
3. Zaktualizuj `vite.config.ts`:
   - Zmień `base` na `process.env.VITE_BASE_PATH ?? '/'`, aby aplikacja działała natywnie w katalogu głównym domeny na Vercel (zachowując możliwość nadpisania przez `VITE_BASE_PATH`).
4. Utwórz w katalogu głównym plik `.env.example` opisujący zmienne środowiskowe dla Vercel + Neon:
   - `DATABASE_URL=postgresql://user:password@ep-example.eu-central-1.aws.neon.tech/neondb?sslmode=require`
   - `ADMIN_PASSWORD=zmien-mnie-na-silne-haslo`
   - `ADMIN_SESSION_SECRET=losowy-sekret-minimum-32-znaki-do-podpisywania-sesji`
   - Upewnij się w `.gitignore`, że `.env`, `.env.local`, `.env.*.local` oraz `.vercel` są ignorowane.
5. Zaktualizuj `AGENTS.md`, dodając sekcję dotyczącą wersji v3.0:
   - Hosting docelowy: Vercel (Hobby) + Neon Serverless Postgres (`@neondatabase/serverless` z leniwą inicjalizacją `getDb()`, bez użycia `Proxy`).
   - Bezpieczeństwo Admina: weryfikacja hasła wyłącznie na backendzie (`/api/admin/*`), sesja w ciasteczku `HttpOnly`, zakaz umieszczania hasła/sekretu admina w zmiennych klienckich `VITE_*`.
   - Zarządzanie katalogiem: istnienie nieusuwalnej kategorii domyślnej (`cat-default` / `Ogólne`), automatyczna migracja produktów przy usunięciu kategorii oraz możliwość ręcznej migracji produktów między kategoriami.
   - Ochrona klientów: brak przycisku usuwania klientów w widoku publicznym (dostępny tylko w Panelu Admina), maskowanie adresów e-mail w widoku publicznym, unikalność e-maili, pole honeypot i rate-limiting rejestracji.
6. Uruchom `npm run lint`, `npm run typecheck`, `npm run test` oraz `npm run build`. Po potwierdzeniu braku błędów utwórz atomowy commit: `chore(config): prepare Vercel + Neon configuration and update AGENTS.md for v3`.
```

---

### Etap 1: Warstwa domenowa v3 (`src/domain/`) — Kategorie, Produkty, Migracje, Walidacja Klientów i Schematy

- **Cel:** Rozbudowa czystej warstwy domenowej w `src/domain/` (100% bez zależności od Reacta, DOM ani Node/bazy) o obsługę dynamicznych kategorii, migracji produktów między kategoriami, parsera cen PLN->Cents, zaostrzonej walidacji i maskowania PII klientów oraz migracji schematu stanu `v2 -> v3`.
- **Model:** **Gemini 4 Argon (High)** (subagent: `pro`)
- **Definition of Done:**
  - `src/domain/money.ts`: funkcja `parsePlnInputToCents(input: string): Cents` parsująca tekstowe kwoty PLN (np. `"149.99"`, `"149,99"`, `"200"`) bez użycia arytmetyki zmiennoprzecinkowej (przez rozbicie regexem na złote i grosze) i rzucająca czytelny błąd dla niepoprawnych/ujemnych wartości.
  - `src/domain/catalog.ts`:
    - Interfejs `Category` (`id`, `name`, `description`, `isDefault?: boolean`) oraz `DEFAULT_CATEGORIES` (zawierające `cat-default` = `'Ogólne'` z `isDefault: true` oraz 5 dotychczasowych kategorii: `'Elektronika'`, `'Odziez'`, `'Akcesoria'`, `'Edukacja'`, `'Retro Hardware'`).
    - Rozszerzenie `Product` o `categoryId: string` (z zachowaniem pola `category: string` jako nazwy kategorii dla pełnej kompatybilności wstecznej komponentów i zamówień!).
    - Czyste funkcje domenowe operacji na katalogu:
      * `createCategory`, `updateCategory` (aktualizuje też `category` w przypisanych produktach!), `deleteCategoryWithFallback` (blokuje usunięcie kategorii `isDefault: true`, a dla pozostałych automatycznie przenosi przypisane produkty do kategorii domyślnej `cat-default` lub wskazanej `targetCategoryId`).
      * `migrateProductsBetweenCategories(products, categories, sourceCategoryId, targetCategoryId, productIds?)` — przenosi wszystkie lub wybrane produkty między kategoriami.
      * `createProduct`, `updateProduct`, `deleteProduct` (z walidacją unikalności `sku` case-insensitive, istnienia kategorii, `priceCents >= 0`, `stockQuantity >= 0`).
  - `src/domain/customer.ts` (nowy moduł lub rozszerzenie `schemas.ts`):
    - Ścisła walidacja rejestracji klienta (`RegisterCustomerInputSchema`): `name` (3–80 znaków, regex akceptujący polskie i łacińskie litery, spacje, myślniki i apostrofy; odrzuca cyfry, nawiasy kątowe `< >` i skrypty), `email` (poprawny e-mail, normalizowany `trim().toLowerCase()`, max 120 znaków), `honeypot` (opcjonalny string, który musi być pusty — jeśli niepusty, zwraca błąd anty-spamowy).
    - Funkcja `validateUniqueCustomerEmail(customers, email, excludeId?)`.
    - Funkcja `maskCustomerEmail(email: string): string` (np. `jan.kowalski@example.com` -> `j***i@example.com`) do bezpiecznej prezentacji na liście publicznej bez wycieku PII.
  - `src/domain/schemas.ts`:
    - Zaktualizowane schematy Zod obsługujące dowolną nazwę kategorii (`z.string().min(1)`) oraz `CategorySchema`.
    - `PersistedShopStateSchema` zaktualizowany do obsługi wersji `v3` (lub kompatybilnego `v2`/`v3` zawierającego `categories` i `catalog`), przy czym `parseLegacyOrCurrentBackup` bezstratnie migruje pliki `v1` (legacy Tkinter `data.json`), `v2` (uzupełniając brakujące `categories` i `catalog` wartościami domyślnymi) oraz `v3`.
  - Pokrycie testami jednostkowymi w `src/domain/` **>= 95%**.

#### Prompt do skopiowania (Etap 1):
```text
/goal
Przeczytaj @AGENTS.md oraz @ADMIN_CATALOG_PLAN.md i wykonaj wyłącznie Etap 1 (rozbudowa czystej warstwy domenowej `src/domain/` do v3 oraz testy jednostkowe).

Zadania:
1. W `src/domain/money.ts` dodaj czystą funkcję `parsePlnInputToCents(rawInput: string): Cents`:
   - Akceptuje formaty typu `"199.99"`, `"199,99"`, `"199.9"`, `"199"`, z opcjonalnymi białymi znakami na brzegach.
   - Konwertuje na grosze wyłącznie za pomocą operacji na liczbach całkowitych (rozbicie części całkowitej i ułamkowej po walidacji regexem `^\d+(?:[.,]\d{1,2})?$`), bez mnożenia floatów.
   - Rzuca `RangeError` / `Error` z czytelnym komunikatem po polsku dla pustych ciągów, wartości ujemnych, więcej niż 2 miejsc po przecinku lub znaków nieliczbowych.
2. W `src/domain/catalog.ts` zaprojektuj dynamiczny model kategorii i produktów:
   - Zdefiniuj `Category` (`readonly id: string; readonly name: string; readonly description: string; readonly isDefault?: boolean`).
   - Zdefiniuj `DEFAULT_CATEGORY_ID = 'cat-default'` oraz tablicę `DEFAULT_CATEGORIES` zawierającą kategorię domyślną `{ id: 'cat-default', name: 'Ogólne', description: 'Domyślna kategoria dla produktów nieprzypisanych i migrowanych', isDefault: true }` oraz 5 dotychczasowych kategorii (`cat-elektronika` -> `'Elektronika'`, `cat-odziez` -> `'Odziez'`, `cat-akcesoria` -> `'Akcesoria'`, `cat-edukacja` -> `'Edukacja'`, `cat-retro-hardware` -> `'Retro Hardware'`).
   - Zmień `ProductCategory` na `string` (aby dopuścić dynamiczne kategorie tworzone przez admina) i dodaj do interfejsu `Product` pole `readonly categoryId: string` (zachowując `readonly category: string` z nazwą kategorii dla pełnej kompatybilności z istniejącym kodem!). Zaktualizuj `DEFAULT_CATALOG`, przypisując odpowiednie `categoryId`.
   - Dodaj czyste funkcje domenowe dla kategorii i produktów:
     * `addCategoryToList(categories, input: { name: string; description?: string; id?: string })`: waliduje niepustą nazwę (2–50 znaków) i brak duplikatu nazwy (case-insensitive).
     * `updateCategoryInList(categories, products, categoryId, patch: { name: string; description?: string })`: aktualizuje kategorię (z walidacją duplikatów) i synchronizuje pole `product.category` we wszystkich produktach o danym `categoryId`.
     * `deleteCategoryFromList(categories, products, categoryId, targetCategoryId = DEFAULT_CATEGORY_ID)`: zabrania usunięcia kategorii z `isDefault: true`; dla usuwanej kategorii automatycznie przenosi wszystkie przypisane produkty do `targetCategoryId` (domyślnie `cat-default` / `'Ogólne'`), aktualizując w nich zarówno `categoryId`, jak i `category`.
     * `migrateProductsBetweenCategories(products, categories, params: { sourceCategoryId: string; targetCategoryId: string; productIds?: readonly string[] })`: przenosi wszystkie produkty z `sourceCategoryId` (lub tylko te o wskazanych `productIds`) do `targetCategoryId`.
     * `addProductToList(products, categories, input)` / `updateProductInList(products, categories, productId, patch)` / `deleteProductFromList(products, productId)`: walidują unikalność `sku` (case-insensitive), istnienie `categoryId` w `categories`, nieujemną cenę w groszach i `stockQuantity >= 0` (automatycznie ustawiając `inStock: false` jeśli `stockQuantity === 0`, chyba że jawnie wyłączono dostępność).
   - W `addItem` / `updateQuantity` w `src/domain/cart.ts` dodaj walidację dostępności produktu (`if (!product.inStock || product.stockQuantity <= 0) throw new Error(...)`), oraz funkcję `syncCartWithCatalog(cart: readonly CartItem[], catalog: readonly Product[]): CartItem[]`, która po edycji/usunięciu produktu w katalogu usuwa z koszyka produkty usunięte lub niedostępne (`!inStock || stockQuantity <= 0`), a dla pozostałych aktualizuje dane produktu i przelicza `lineTotalCents`.
3. Utwórz `src/domain/customer.ts` (i wyeksportuj w `src/domain/index.ts`):
   - `RegisterCustomerInputSchema` (Zod): walidacja `name` (3–80 znaków, po `trim()`, regex `/^[\p{L}\s'-]+$/u`, brak podwójnych spacji), `email` (`trim().toLowerCase()`, poprawny email, max 120 znaków), `honeypot` (opcjonalne pole anty-botowe: jeśli `honeypot && honeypot.trim().length > 0`, walidacja kończy się błędem).
   - `validateNewCustomerRegistration(customers, rawInput)`: sprawdza schemat Zod, pole honeypot oraz unikalność adresu e-mail (case-insensitive) wśród istniejących klientów.
   - `maskCustomerEmail(email: string): string`: maskuje nazwę użytkownika w adresie e-mail (np. `jan.kowalski@example.com` -> `j***i@example.com`, a dla krótkich np. `ab@example.com` -> `a***@example.com`).
4. Zaktualizuj `src/domain/schemas.ts`:
   - Dodaj `CategorySchema`.
   - W `ProductSchema` dopuść dynamiczną kategorię (`category: z.string().min(1)`) oraz `categoryId: z.string().min(1).optional()` (automatycznie rozwiązując `categoryId` na podstawie nazwy kategorii lub `DEFAULT_CATEGORY_ID`, jeśli brakuje go w starszych plikach `v2`).
   - Rozszerz `PersistedShopStateSchema` i `ParsedBackupState` o opcjonalne/domyślne pola `categories` (domyślnie `DEFAULT_CATEGORIES`) oraz `catalog` (domyślnie `DEFAULT_CATALOG`), zachowując pełną kompatybilność wsteczną przy odczycie backupów `v2` oraz legacy `data.json` z Tkintera.
5. Rozbuduj testy jednostkowe w `tests/unit/domain/` (nowe testy dla `parsePlnInputToCents`, CRUD kategorii, automatycznego przenoszenia produktów przy usunięciu kategorii, `migrateProductsBetweenCategories`, CRUD produktów, `syncCartWithCatalog`, `validateNewCustomerRegistration`, honeypota, duplikatów email oraz `maskCustomerEmail`).
6. Uruchom `npm run lint`, `npm run typecheck`, `npm run test:coverage` i `npm run build`. Upewnij się, że pokrycie `src/domain/` wynosi >= 95%, i utwórz commit: `feat(domain): add dynamic categories, product migration, strict customer validation and v3 schemas`.
```

---

### Etap 2: Warstwa Backendowa Vercel Functions (`api/`), Repozytorium Neon Postgres i Autoryzacja Admina

- **Cel:** Zbudowanie pełnego backendu HTTP w katalogu `api/` zgodnego z **Vercel Functions (Node.js runtime na Fluid Compute)**, warstwy repozytorium **Neon Serverless Postgres** (`@neondatabase/serverless`) z automatycznym fallbackiem `InMemoryShopRepository` dla testów/dev, oraz serwerowego systemu logowania Admina (`HttpOnly` HMAC cookie + rate-limiting).
- **Model:** **Gemini 4 Argon (High)** (subagent: `pro`)
- **Definition of Done:**
  - Warstwa bazy danych i repozytorium w `src/server/` (lub `api/_lib/`):
    - `db.ts`: leniwa inicjalizacja połączenia `getSql()` z `@neondatabase/serverless` (bez użycia `Proxy`, bezpieczna podczas `npm run build` gdy brak `DATABASE_URL`) + funkcja `ensureSchemaAndSeed()` tworząca tabele SQL (`categories`, `products`, `customers`, `orders`) przy pierwszym użyciu i zasilająca je danymi startowymi jeśli baza jest pusta.
    - `repository.ts`: interfejs `ShopRepository` oraz dwie implementacje: `NeonShopRepository` (prawdziwe zapytania SQL w Neon Postgres, wszystkie kwoty jako `INTEGER` w groszach!) oraz `InMemoryShopRepository` (identyczne zachowanie w pamięci dla testów i środowiska bez `DATABASE_URL`).
    - `auth.ts`: serwerowa weryfikacja hasła admina (`crypto.scryptSync` / `crypto.timingSafeEqual` względem `process.env.ADMIN_PASSWORD` z bezpiecznym domyślnym hasłem deweloperskim `'admin-retro-2026'` wyłącznie gdy `process.env.NODE_ENV !== 'production'` lub `process.env.ALLOW_DEFAULT_ADMIN_PASSWORD === 'true'`), generowanie i weryfikacja tokenu sesji HMAC-SHA256 w ciasteczku `HttpOnly; SameSite=Strict; Path=/` (`retro_admin_session`), oraz limiter prób logowania i rejestracji klientów (in-memory / DB rate limiter).
  - Endpointy Vercel Functions (używające standardowego Web API `Request` / `Response` i nazwanych eksportów `GET`, `POST`, `PUT`, `DELETE`):
    - `api/state.ts` (`GET` — pobiera publiczny stan startowy: kategorie, katalog produktów, zamaskowanych lub pełnych klientów w zależności od sesji admina, zamówienia i status sesji `isAdmin`; `POST` — akcje importu backupu / resetu demo — chronione sesją admina!).
    - `api/admin/session.ts` (`GET` — status sesji, `POST` — logowanie hasłem + ustawienie ciasteczka `HttpOnly`, `DELETE` — wylogowanie i wyczyszczenie ciasteczka).
    - `api/categories.ts` (`GET`, `POST`, `PUT`, `DELETE` — mutacje wymagają sesji admina; `DELETE` automatycznie przenosi produkty do kategorii domyślnej lub wskazanej `targetCategoryId`).
    - `api/categories/migrate.ts` (`POST` — masowa migracja produktów z `sourceCategoryId` do `targetCategoryId`, wymaga sesji admina).
    - `api/products.ts` (`GET`, `POST`, `PUT`, `DELETE` — mutacje wymagają sesji admina).
    - `api/customers.ts` (`GET` — zwraca listę klientów: dla admina pełne e-maile, dla niezalogowanego klienta zamaskowane e-maile; `POST` — rejestracja nowego klienta z walidacją unikalności, honeypota i rate-limitingiem; `DELETE` — usunięcie klienta **wyłącznie dla zalogowanego admina**, w przeciwnym razie `401 Unauthorized`!).
    - `api/orders.ts` (`GET`, `POST` — składanie zamówienia z **serwerową weryfikacją cen produktów z aktualnego katalogu** oraz walidacją płatności bez zapisywania CVV!, `DELETE` — usuwanie zamówienia).
  - Integracja z lokalnym serwerem Vite (`vite.config.ts`): lekki plugin middleware Vite przekierowujący żądania `/api/*` podczas `vite dev` oraz `vite preview` bezpośrednio do tych samych handlerów Web API `Request`/`Response`. Dzięki temu lokalny development i testy Playwright E2E działają identycznie jak na Vercel!
  - Komplet testów jednostkowych/integracyjnych dla handlerów API, autoryzacji, rate-limitingu i repozytorium w `tests/unit/server/`.

#### Prompt do skopiowania (Etap 2):
```text
/goal
Przeczytaj @AGENTS.md oraz @ADMIN_CATALOG_PLAN.md i wykonaj wyłącznie Etap 2 (Backend Vercel Functions w `api/`, repozytorium Neon Postgres + InMemory fallback, autoryzacja Admina i testy API).

Zadania:
1. Utwórz moduły serwerowe w `src/server/` (współdzielone przez pliki w `api/`):
   - `src/server/db.ts`: leniwa funkcja `getNeonSql()` używająca `neon(process.env.DATABASE_URL!)` z `@neondatabase/serverless` (NIGDY nie wywołuj `neon()` na najwyższym poziomie modułu podczas importu i nie używaj `Proxy`).
   - `src/server/repository.ts`: zdefiniuj interfejs `ShopRepository` obsługujący pełny stan sklepu (kategorie, produkty, klienci, zamówienia, migracje kategorii, reset demo, import stanu) oraz dwie implementacje:
     * `NeonShopRepository`: tworzy tabele (`categories`, `products`, `customers`, `orders`) przy pierwszym wywołaniu (`CREATE TABLE IF NOT EXISTS ...`), zasila danymi z `createSeedState()` jeśli puste, i wykonuje operacje SQL w Neon Postgres (kwoty w groszach jako `INTEGER`).
     * `InMemoryShopRepository`: szybka implementacja w pamięci operacyjnej o identycznym kontrakcie, używana gdy brak `DATABASE_URL` lub gdy `process.env.USE_IN_MEMORY_DB === 'true'`.
   - `src/server/auth.ts`:
     * Weryfikacja hasła admina przy użyciu `node:crypto` (`scryptSync` + `timingSafeEqual`). Hasło pobierane z `process.env.ADMIN_PASSWORD` (z bezpiecznym fallbackiem `'admin123'` w środowiskach testowych/dev, o ile `process.env.NODE_ENV !== 'production'` lub nie wymuszono inaczej).
     * Generowanie i weryfikacja podpisanego tokenu sesyjnego HMAC-SHA256 (`ADMIN_SESSION_SECRET`) przesyłanego w ciasteczku `HttpOnly; SameSite=Strict; Path=/` (oraz akceptowanego opcjonalnie w nagłówku `Authorization: Bearer <token>` jako pomocniczy mechanizm).
     * Rate-limiter w pamięci (`checkRateLimit(key, limit, windowMs)`) dla logowania admina (max 5 nieudanych prób / 15 min -> HTTP 429) oraz rejestracji klientów (max 5 rejestracji / 10 min -> HTTP 429).
2. Utwórz handlery Vercel Functions w katalogu `api/` używające nazwanych eksportów `GET`, `POST`, `PUT`, `DELETE` i standardowych obiektów Web API `Request` / `Response` (każdy handler ma również logowanie błędów `console.error` w blokach `catch`):
   - `api/state.ts`: `GET` (zwraca `{ categories, catalog, customers, orders, isAdmin }`, gdzie `customers` ma zamaskowane e-maile jeśli `!isAdmin`, chyba że klient został utworzony w bieżącej sesji) oraz `POST` (operacje `resetDemo` lub `importBackup` — wymagające sesji admina lub specjalnej flagi w trybie demo).
   - `api/admin/session.ts`: `GET` (sprawdza sesję), `POST` (logowanie hasłem + `Set-Cookie`), `DELETE` (wylogowanie + wyczyszczenie `Set-Cookie`).
   - `api/categories.ts` oraz `api/categories/migrate.ts`: `GET` publiczny; `POST`, `PUT`, `DELETE` oraz migracja `POST /api/categories/migrate` chronione sesją admina (`401 Unauthorized` bez ważnej sesji).
   - `api/products.ts`: `GET` publiczny; `POST`, `PUT`, `DELETE` chronione sesją admina (`401 Unauthorized` bez ważnej sesji).
   - `api/customers.ts`: `GET` (zamaskowane e-maile publicznie, pełne dla admina), `POST` (rejestracja klienta: walidacja `RegisterCustomerInputSchema`, honeypot, unikalność e-maila -> `409 Conflict`, rate-limit -> `429`), `DELETE` (usunięcie klienta po `?id=...` lub body — **wymaga sesji admina**, zwraca `401` dla niezalogowanych!).
   - `api/orders.ts`: `GET` (lista zamówień), `POST` (składanie zamówienia — serwer pobiera aktualne ceny produktów z katalogu w repozytorium, przelicza grosze i próg dostawy 20 000 groszy, waliduje płatność i odrzuca CVV!), `DELETE` (usuwanie zamówienia).
3. Dodaj w `src/server/viteApiPlugin.ts` i podłącz w `vite.config.ts` lekki plugin Vite (`configureServer` oraz `configurePreviewServer`), który obsługuje ścieżki `/api/*` podczas `vite dev` i `vite preview`, konwertując `IncomingMessage` na Web `Request` i odsyłając `Response` (wraz z nagłówkiem `Set-Cookie`).
4. Napisz testy w `tests/unit/server/` weryfikujące:
   - Logowanie admina (poprawne hasło, błędne hasło -> 401, blokada rate-limit po 5 próbach -> 429, wylogowanie).
   - Ochronę endpointów `/api/categories`, `/api/products`, `/api/categories/migrate` oraz `DELETE /api/customers` przed niezalogowanym dostępem (401).
   - Pełny cykl CRUD kategorii, automatyczny fallback produktów do kategorii domyślnej przy usunięciu kategorii, migrację produktów między kategoriami.
   - Rejestrację klienta (poprawna, odrzucenie duplikatu email -> 409, odrzucenie wypełnionego pola honeypot -> 400, maskowanie emaili dla niezalogowanych vs pełne emaile dla admina).
   - Serwerową weryfikację cen przy składaniu zamówienia (`POST /api/orders`).
5. Uruchom `npm run lint`, `npm run typecheck`, `npm run test:coverage` i `npm run build`. Napraw wszelkie błędy i utwórz commit: `feat(api): implement Vercel Functions backend, Neon/InMemory repository and server admin auth`.
```

---

### Etap 3: Rozbudowa Zustand Store (`useShopStore`) i synchronizacja z Backend API + Lokalnym Storage

- **Cel:** Rozszerzenie centralnego store'a [`src/store/useShopStore.ts`](file:///c:/Users/phxpo/OneDrive/Dokumenty/Dev/Shopping%20cart/src/store/useShopStore.ts) o obsługę kategorii, pełnego CRUD katalogu, migracji produktów między kategoriami, sesji administratora (`isAdminAuthenticated`, `activeView: 'shop' | 'admin'`) oraz synchronizacji z backendem `/api/*` przy zachowaniu kompatybilności z `StorageAdapter`.
- **Model:** **Gemini 4 Argon (Medium / High)** (subagent: `pro`)
- **Definition of Done:**
  - `ShopState` w `useShopStore.ts` rozszerzony o:
    - `categories: readonly Category[]`
    - `selectedCategory: string` (`'ALL'` lub ID/nazwa kategorii)
    - `isAdminAuthenticated: boolean`
    - `activeView: 'shop' | 'admin'`
    - `unlockedCustomerEmails: Record<string, string>` (aby klient, który właśnie zarejestrował konto w bieżącej sesji, widział swój własny adres e-mail bez maski)
    - Akcje autoryzacji i nawigacji: `loginAdmin(password: string)`, `logoutAdmin()`, `setActiveView(view: 'shop' | 'admin')`.
    - Akcje kategorii: `addCategory`, `updateCategory`, `removeCategory(categoryId, targetCategoryId?)`, `migrateCategoryProducts(sourceCategoryId, targetCategoryId, productIds?)`.
    - Akcje produktów: `addProductToCatalog`, `updateProductInCatalog`, `removeProductFromCatalog` (automatycznie wywołujące `syncCartWithCatalog` oraz persystencję!).
    - Zaktualizowana akcja `addCustomer(input: { name: string; email: string; honeypot?: string })`: waliduje dane przez `validateNewCustomerRegistration` (unikalność e-maila, honeypot, format) i komunikuje się z backendem / adapterem.
    - Zaktualizowana akcja `removeCustomer(customerId: string)`: sprawdza uprawnienia admina (w trybie API wymaga sesji admina) i usuwa klienta.
  - Automatyczna synchronizacja z `/api/*` (gdy `fetch` do `/api/*` jest dostępny) z płynnym fallbackiem do wstrzykniętego `StorageAdapter` (dzięki czemu istniejące testy jednostkowe komponentów używające `createShopStore(new InMemoryStorageAdapter())` nadal działają błyskawicznie i deterministycznie!).
  - Zaktualizowane i rozszerzone testy integracyjne w `tests/integration/store.test.ts`.

#### Prompt do skopiowania (Etap 3):
```text
/goal
Przeczytaj @AGENTS.md oraz @ADMIN_CATALOG_PLAN.md i wykonaj wyłącznie Etap 3 (rozbudowa Zustand store `useShopStore.ts`, integracja z API / StorageAdapter i testy integracyjne store).

Zadania:
1. Zaktualizuj `src/storage/seed.ts` oraz `src/storage/indexedDbAdapter.ts`:
   - `createSeedState()` zwraca teraz również `categories: [...DEFAULT_CATEGORIES]` oraz `catalog: [...DEFAULT_CATALOG]`.
2. Rozbuduj `src/store/useShopStore.ts`:
   - Dodaj do stanu `categories: readonly Category[]` (domyślnie `DEFAULT_CATEGORIES`), `isAdminAuthenticated: boolean` (domyślnie `false`), `activeView: 'shop' | 'admin'` (domyślnie `'shop'`).
   - W `persist()`, `initialize()`, `exportBackupJson()`, `importBackupJson()` oraz `resetDemoData()` uwzględnij zapis i odczyt `categories` oraz `catalog`.
   - Dodaj obsługę komunikacji z `/api/*` (lub wstrzykiwanym klientem API / `StorageAdapter`), tak aby:
     * W przeglądarce (`vite dev` / `vite preview` / produkcja Vercel) operacje logowania admina (`/api/admin/session`), mutacji kategorii/produktów/klientów oraz zamówień synchronizowały się z backendem `/api/*` oraz lokalnym `StorageAdapter`.
     * W testach jednostkowych/integracyjnych wywołujących `createShopStore(inMemoryAdapter)` store działał w 100% deterministycznie (weryfikując hasło admina i reguły domenowe z `src/domain/`).
   - Zaimplementuj akcje Admina i Katalogu:
     * `loginAdmin(password: string): Promise<{ success: boolean; error?: string }>` — weryfikuje hasło (przez `/api/admin/session` lub walidator lokalny w trybie in-memory), ustawia `isAdminAuthenticated: true`, `activeView: 'admin'` i komunikat w `StatusBar`.
     * `logoutAdmin(): Promise<void>` — kończy sesję, ustawia `isAdminAuthenticated: false`, `activeView: 'shop'`.
     * `setActiveView(view: 'shop' | 'admin')` — przełącza widok (przejście na `'admin'` wymaga `isAdminAuthenticated === true`).
     * `addCategory({ name, description })`, `updateCategory(id, { name, description })`, `removeCategory(id, targetCategoryId?)`, `migrateCategoryProducts({ sourceCategoryId, targetCategoryId, productIds? })`. Pamiętaj: jeśli usunięta kategoria była aktualnie wybranym filtrem `selectedCategory`, przestaw `selectedCategory` na `'ALL'`.
     * `addProductToCatalog(input)`, `updateProductInCatalog(productId, patch)`, `removeProductFromCatalog(productId)` — po każdej edycji lub usunięciu produktu wywołaj `syncCartWithCatalog(state.cart, updatedCatalog)` i zapisz stan (`persist()`).
   - Zaktualizuj `addCustomer(input: { name: string; email: string; honeypot?: string })`:
     * Użyj `validateNewCustomerRegistration` z `src/domain/customer.ts` (walidacja formatu imienia, e-maila, honeypota i duplikatu e-maila).
   - Zaktualizuj `removeCustomer(customerId: string)`:
     * Wymagaj `isAdminAuthenticated === true` (jeśli niezalogowany użytkownik spróbuje wywołać `removeCustomer`, zablokuj akcję i ustaw komunikat błędu `BRAK UPRAWNIEŃ ADMINISTRATORA` w `StatusBar`!).
3. Zaktualizuj i rozbuduj `tests/integration/store.test.ts`:
   - W istniejących testach, które testują `removeCustomer`, najpierw zaloguj admina (`await store.getState().loginAdmin(...)`).
   - Dodaj testy sprawdzające: blokadę `removeCustomer` bez logowania admina, pełny CRUD kategorii, automatyczną migrację produktów do kategorii domyślnej po usunięciu kategorii, `migrateCategoryProducts`, edycję ceny produktu i automatyczne przeliczenie koszyka, usunięcie produktu będącego w koszyku, blokadę duplikatu e-maila i pola honeypot przy rejestracji klienta.
4. Uruchom `npm run lint`, `npm run typecheck`, `npm run test:coverage` i `npm run build`. Po pełnym sukcesie utwórz commit: `feat(store): add admin session, category/product CRUD, category migration and cart sync`.
```

---

### Etap 4: Interfejs Retro CRT — Sekcja Administracyjna, Konfigurator Katalogu i Przebudowa Panelu Klientów

- **Cel:** Zbudowanie dostępnych (WCAG AA), responsywnych komponentów interfejsu użytkownika w stylistyce Retro CRT dla logowania i Panelu Administracyjnego (`Kategorie`, `Produkty`, `Migracja produktów`, `Klienci`) oraz aktualizacja `HeaderBar`, `CatalogPanel` i `CustomersPanel`.
- **Model:** **Gemini 4 Hydrogen (High)** (subagent: `flash` lub `pro`)
- **Definition of Done:**
  - `src/components/HeaderBar.tsx`:
    - Przycisk `[PANEL ADMINA]` (gdy niezalogowany — otwiera modal logowania `AdminLoginModal`) lub przełącznik widoku `[WIDOK: SKLEP]` / `[WIDOK: ADMIN]` oraz przycisk `[WYLOGUJ ADMINA]` (gdy zalogowany jako Admin).
    - Przycisk `RESET DEMO` oraz `IMPORT JSON` dostępne w pełnym trybie lub zabezpieczone potwierdzeniem.
  - `src/components/AdminLoginModal.tsx`:
    - Dostępny modal (`role="dialog"`, `aria-modal="true"`, obsługa klawisza `Esc`, focus na polu hasła po otwarciu) z polem hasła (`type="password"`), komunikatem błędu (`role="alert"`) oraz informacją pomocniczą dla trybu demonstracyjnego (wskazówka o domyślnym haśle demo w środowisku nierprodukcyjnym lub konfiguracji `ADMIN_PASSWORD`).
  - `src/components/AdminPanel.tsx`:
    - Panel główny sekcji administracyjnej z nawigacją zakładkową (`role="tablist"`):
      1. **`[1] KATEGORIE`**:
         - Lista wszystkich kategorii z liczbą przypisanych produktów oraz oznaczeniem `[DOMYŚLNA]` przy kategorii `Ogólne` (`isDefault: true`).
         - Formularz dodawania nowej kategorii (nazwa + opis) i edycji istniejącej kategorii inline.
         - Usuwanie kategorii (zablokowane dla kategorii domyślnej; dla pozostałych wyświetla informację, że przypisane produkty zostaną automatycznie przeniesione do kategorii domyślnej `Ogólne`, lub pozwala wybrać inną kategorię docelową przed usunięciem).
      2. **`[2] PRODUKTY`**:
         - Formularz dodawania / edycji produktu: `SKU`, `Nazwa`, `Kategoria` (`<select>` z listą kategorii), `Cena (PLN)` (walidowana przez `parsePlnInputToCents`), `Stan magazynowy (szt.)`, checkbox `Dostępny w sprzedaży (inStock)` oraz `Opis`.
         - Tabela / lista produktów w katalogu z filtrem po kategorii, szybkim selektorem zmiany kategorii produktu, przyciskami `EDYTUJ` oraz `USUŃ`.
      3. **`[3] MIGRACJA PRODUKTÓW`**:
         - Dedykowane narzędzie migracji produktów między kategoriami: wybór `Kategoria źródłowa` -> wybór `Kategoria docelowa`, lista produktów w kategorii źródłowej z możliwością zaznaczenia wszystkich lub wybranych produktów (checkboxy) oraz przycisk `PRZENIEŚ PRODUKTY`.
      4. **`[4] KLIENCI (ZARZĄDZANIE)`**:
         - Pełna lista zarejestrowanych klientów z pełnymi adresami e-mail, wyszukiwarką, informacją o liczbie złożonych zamówień każdego klienta oraz przyciskiem `USUŃ` (z bezpiecznym potwierdzeniem usunięcia).
  - `src/components/CustomersPanel.tsx`:
    - **Całkowite usunięcie przycisku `USUŃ`** z widoku publicznego (zamiast niego subtelna adnotacja, że usuwanie kont jest dostępne wyłącznie w Panelu Administracyjnym).
    - **Ochrona PII:** Adresy e-mail na liście wyboru klienta są wyświetlane w formie zamaskowanej (`maskCustomerEmail(customer.email)`), z wyjątkiem aktualnie zarejestrowanego w tej sesji klienta lub zalogowanego Admina.
    - **Formularz rejestracji:** Dodane ukryte pole anty-botowe `honeypot` (`aria-hidden="true"`, `tabIndex={-1}`, ukryte poza ekranem) oraz czytelna obsługa błędów duplikatu e-maila i nowej walidacji imienia/nazwiska.
  - `src/components/CatalogPanel.tsx`:
    - Filtry kategorii generowane dynamicznie z `categories` w store (`WSZYSTKIE` + wszystkie kategorie z `useShopStore`).
    - Obsługa stanu magazynowego i dostępności: wyświetlenie liczby sztuk w magazynie (`Stan: X szt.` lub `[NIEDOSTĘPNY]`) oraz zablokowanie przycisku `DODAJ ->` gdy `!product.inStock || product.stockQuantity <= 0`.
  - `src/App.tsx`:
    - Przełączanie pomiędzy widokiem sklepu (`activeView === 'shop'`) a widokiem `AdminPanel` (`activeView === 'admin' && isAdminAuthenticated`), wraz z renderowaniem `AdminLoginModal`.

#### Prompt do skopiowania (Etap 4):
```text
/goal
Przeczytaj @AGENTS.md oraz @ADMIN_CATALOG_PLAN.md i wykonaj wyłącznie Etap 4 (komponenty UI Retro CRT dla Sekcji Administracyjnej oraz przebudowa `CatalogPanel`, `CustomersPanel`, `HeaderBar` i `App.tsx`).

Zadania:
1. Utwórz `src/components/AdminLoginModal.tsx`:
   - Dostępny modal (`role="dialog"`, `aria-modal="true"`, `aria-labelledby`), zamykany klawiszem `Esc` lub przyciskiem `[ANULUJ]`.
   - Pole hasła (`id="admin-password-input"`, `type="password"`), przycisk `AUTORYZUJ DOSTĘP`, wyświetlanie błędów logowania w `role="alert"` (`#ff4d4d`).
2. Utwórz `src/components/AdminPanel.tsx` w stylistyce terminala Retro CRT:
   - Nagłówek `// SEKCJA ADMINISTRACYJNA // TRYB UPRAWNIONY` z przyciskiem `[<- POWRÓT DO SKLEPU]` oraz `[WYLOGUJ ADMINA]`.
   - Zakładki nawigacyjne (`[1] KATEGORIE`, `[2] PRODUKTY`, `[3] MIGRACJA PRODUKTÓW`, `[4] KLIENCI`):
     * Zakładka `KATEGORIE`: formularz dodawania nowej kategorii (nazwa, opis), edycja istniejącej kategorii (zmiana nazwy i opisu), usuwanie kategorii (zablokowane dla kategorii `isDefault`; dla innych wyświetla informację o automatycznym przeniesieniu produktów do kategorii domyślnej `Ogólne`).
     * Zakładka `PRODUKTY`: formularz dodawania i edycji produktu (`SKU`, `Nazwa`, `<select>` kategorii, `Cena PLN` konwertowana przez `parsePlnInputToCents`, `Ilość w magazynie`, checkbox `W sprzedaży`, `Opis`), lista produktów z przyciskami `EDYTUJ` i `USUŃ`.
     * Zakładka `MIGRACJA PRODUKTÓW`: formularz wyboru kategorii źródłowej i docelowej, lista produktów z kategorii źródłowej z checkboxami (domyślnie zaznaczone wszystkie + przyciski `Zaznacz wszystkie` / `Odznacz wszystkie`) i przycisk `MIGRUJ WYBRANE PRODUKTY`.
     * Zakładka `KLIENCI`: lista wszystkich zarejestrowanych klientów z pełnymi adresami e-mail, licznikiem zamówień klienta oraz przyciskiem `USUŃ` (`aria-label="Usuń klienta ${customer.name}"`) wywołującym `removeCustomer(customer.id)`.
3. Zaktualizuj `src/components/HeaderBar.tsx`:
   - Dodaj przycisk `PANEL ADMINA` (otwierający modal logowania lub przełączający na widok Admina, gdy sesja jest już aktywna) oraz przycisk `WYLOGUJ` (gdy `isAdminAuthenticated === true`).
4. Zaktualizuj `src/components/CustomersPanel.tsx`:
   - Usuń przycisk `USUŃ` przy klientach w widoku publicznym.
   - Zastosuj `maskCustomerEmail(customer.email)` przy wyświetlaniu e-maili klientów w widoku publicznym (gdy `!isAdminAuthenticated`).
   - Dodaj w formularzu rejestracji klienta ukryte pole honeypot (`name="companyWebsite"`, `tabIndex={-1}`, `aria-hidden="true"`, ukryte przez CSS) przekazywane do `addCustomer({ name, email, honeypot })`.
5. Zaktualizuj `src/components/CatalogPanel.tsx`:
   - Zastąp zahardkodowaną tablicę `CATEGORIES` dynamiczną listą kategorii z `useShopStore().categories`.
   - Wyświetlaj informację o dostępności/stanie magazynowym produktu i zablokuj przycisk `DODAJ ->` gdy `!product.inStock || product.stockQuantity <= 0`.
6. Zaktualizuj `src/App.tsx` oraz `src/components/index.ts`, podłączając `AdminLoginModal` i `AdminPanel`.
7. Zaktualizuj istniejące testy jednostkowe komponentów w `tests/unit/components/` (szczególnie `CustomersPanel.test.tsx`), aby odzwierciedlały przeniesienie przycisku `USUŃ` do `AdminPanel` oraz maskowanie e-maili, i dodaj testy jednostkowe dla `AdminPanel`.
8. Uruchom `npm run lint`, `npm run typecheck`, `npm run test` i `npm run build`. Napraw ewentualne błędy i utwórz commit: `feat(ui): add Retro CRT AdminPanel, login modal, category migration UI and secure CustomersPanel`.
```

---

### Etap 5: Kompleksowe testy Integracyjne RTL, Playwright E2E oraz Audyt Dostępności (`@axe-core/playwright`)

- **Cel:** Pełne przetestowanie nowych przepływów administracyjnych, bezpieczeństwa API, konfiguracji kategorii i produktów, migracji produktów między kategoriami, obostrzeń rejestracji klientów oraz dostępności WCAG AA.
- **Model:** **Gemini 4 Argon (High)** (subagent: `pro`)
- **Definition of Done:**
  - Zaktualizowane testy integracyjne w `tests/integration/ui/` (w tym `customersPanel.integration.test.tsx`) oraz nowy plik `tests/integration/ui/adminPanel.integration.test.tsx` testujący:
    - Logowanie admina (błędne hasło vs poprawne hasło).
    - Dodawanie, edycję i usuwanie kategorii (z automatycznym przeniesieniem produktów do kategorii `Ogólne`).
    - Masową migrację produktów między kategoriami w zakładce `MIGRACJA PRODUKTÓW`.
    - Dodawanie, edycję (zmiana ceny i dostępności) oraz usuwanie produktu i ich natychmiastowy wpływ na `CatalogPanel` i `CartPanel`.
    - Usuwanie klientów z zakładki `KLIENCI` w `AdminPanel` bez naruszenia historii zamówień.
    - Blokadę duplikatu e-maila i honeypota w `CustomersPanel`.
  - Rozbudowane testy E2E w `tests/e2e/shop.spec.ts` (uruchamiane przez Playwright na `vite preview`):
    - Weryfikacja, że w publicznym `CustomersPanel` nie ma przycisków `USUŃ`, a adresy e-mail są zamaskowane.
    - Weryfikacja, że niezalogowane żądanie `DELETE /api/customers` lub `POST /api/products` zwraca `401 Unauthorized`.
    - Scenariusz E2E Admina: otwarcie `PANEL ADMINA` -> logowanie -> utworzenie nowej kategorii (np. `Cyberdecki`) -> dodanie nowego produktu przypisanego do tej kategorii -> migracja produktów między kategoriami -> usunięcie klienta `Anna Nowak` w zakładce `KLIENCI` -> powrót do sklepu -> filtrowanie po nowej kategorii `Cyberdecki`, dodanie nowego produktu do koszyka i złożenie zamówienia.
    - Audyt `@axe-core/playwright` uruchomiony zarówno na widoku sklepu, na otwartym modalu logowania Admina, jak i wewnątrz `AdminPanel` (zero naruszeń `critical` i `serious`).
  - Wszystkie bramki (`npm run lint`, `npm run typecheck`, `npm run test:coverage`, `npm run test:e2e`, `npm run build`) przechodzą w 100% na zielono.

#### Prompt do skopiowania (Etap 5):
```text
/goal
Przeczytaj @AGENTS.md oraz @ADMIN_CATALOG_PLAN.md i wykonaj wyłącznie Etap 5 (testy integracyjne RTL, testy Playwright E2E dla modułu Admina/API oraz audyt dostępności `@axe-core/playwright`).

Zadania:
1. Zaktualizuj `tests/integration/ui/customersPanel.integration.test.tsx`:
   - Zweryfikuj brak przycisku `USUŃ` w publicznym panelu klientów, maskowanie adresów e-mail, blokadę rejestracji duplikatu adresu e-mail oraz walidację formatu imienia i nazwiska.
2. Utwórz `tests/integration/ui/adminPanel.integration.test.tsx`:
   - Przetestuj logowanie do Panelu Admina (błędne hasło -> alert błędu, poprawne hasło -> otwarcie `AdminPanel`).
   - Przetestuj dodanie nowej kategorii, edycję nazwy kategorii i usunięcie kategorii z automatycznym przeniesieniem jej produktów do kategorii domyślnej `Ogólne`.
   - Przetestuj zakładkę `MIGRACJA PRODUKTÓW` (przeniesienie produktów między dwiema kategoriami).
   - Przetestuj dodanie nowego produktu, edycję ceny produktu oraz usunięcie produktu.
   - Przetestuj usunięcie klienta w zakładce `KLIENCI` w `AdminPanel` i upewnij się, że historia zamówień tego klienta pozostaje nienaruszona.
3. Zaktualizuj i rozbuduj `tests/e2e/shop.spec.ts`:
   - Zaktualizuj scenariusz usuwania klienta tak, aby przechodził przez logowanie do `PANEL ADMINA` -> zakładka `KLIENCI`.
   - Dodaj scenariusz E2E testujący pełny przepływ konfiguracji katalogu: logowanie Admina -> utworzenie nowej kategorii -> utworzenie nowego produktu w tej kategorii -> migrację produktów -> wylogowanie -> zakup nowego produktu w sklepie.
   - Dodaj test E2E sprawdzający bezpieczeństwo API (`page.request.delete('/Shopping_cart/api/customers?id=cust-demo-1')` lub `/api/customers` bez sesji zwraca status `401`).
   - Rozszerz test dostępności `@axe-core/playwright`, aby skanował również widok `AdminPanel` (zero błędów `critical` i `serious`).
4. Uruchom kolejno: `npm run lint`, `npm run typecheck`, `npm run test:coverage`, `npm run build` oraz `npm run test:e2e`. Jeśli którykolwiek test lub reguła dostępności zgłosi błąd, zdiagnozuj go i napraw przed zakończeniem etapu.
5. Utwórz commit: `test(e2e): add comprehensive RTL, Playwright E2E and Axe a11y tests for Admin and Catalog module`.
```

---

### Etap 6: Konfiguracja wdrożeniowa Vercel + Neon, Skrypty DB i Aktualizacja Dokumentacji

- **Cel:** Finalne przygotowanie projektu do wdrożenia na Vercel (Hobby) z bazą Neon Postgres, dodanie skryptu CLI do inicjalizacji/seedowania bazy Neon, aktualizacja workflow CI oraz pełna aktualizacja dokumentacji (`README.md`, `ARCHITECTURE.md`, `CHANGELOG.md`).
- **Model:** **Gemini 4 Hydrogen (High)** (subagent: `flash`)
- **Definition of Done:**
  - Utworzony plik konfiguracyjny `vercel.json` zapewniający poprawne routowanie SPA i funkcji `/api/*` na Fluid Compute.
  - Dodany skrypt `scripts/init-neon-db.ts` (oraz komenda `npm run db:init` w `package.json`), który przy podanym `DATABASE_URL` tworzy schemat tabel w Neon Postgres i zasila go bezpiecznymi danymi początkowymi.
  - Zaktualizowany `.github/workflows/ci-deploy.yml`, aby CI weryfikowało pełny zestaw testów jednostkowych, serwerowych, integracyjnych i E2E (wraz z obsługą zmiennej `VITE_BASE_PATH` jeśli wdrażany jest też podgląd statyczny).
  - Zaktualizowana dokumentacja w języku polskim:
    - `README.md`: opis wersji v3.0, sekcji Administracyjnej, zarządzania kategoriami/produktami, migracji produktów, ochrony klientów oraz instrukcja podłączenia **Neon Postgres + Vercel (Hobby)** krok po kroku (`vercel link`, `vercel integration add neon`, `vercel env add ADMIN_PASSWORD`, `vercel env add ADMIN_SESSION_SECRET`).
    - `ARCHITECTURE.md`: opis architektury full-stack v3.0, modelu kategorii i migracji, bezpieczeństwa sesji `HttpOnly` i ochrony PII.
    - `CHANGELOG.md`: wpis dla wersji `v3.0.0`.
  - Wszystkie 5 bramek jakości z `AGENTS.md` przechodzi w 100% na zielono.

#### Prompt do skopiowania (Etap 6):
```text
/goal
Przeczytaj @AGENTS.md oraz @ADMIN_CATALOG_PLAN.md i wykonaj wyłącznie Etap 6 (konfiguracja Vercel + skrypt inicjalizacji Neon DB + aktualizacja dokumentacji i końcowy audyt).

Zadania:
1. Utwórz `vercel.json` w katalogu głównym projektu, konfigurujący:
   - `"fluid": true`
   - Poprawne rewrites dla SPA (przekierowujące ścieżki niebędące `/api/*` ani statycznymi assetami do `/index.html`).
2. Utwórz skrypt pomocniczy `scripts/init-neon-db.ts` (lub `.mjs`) oraz skrypt `"db:init"` w `package.json`, który po skonfigurowaniu `DATABASE_URL` inicjalizuje tabele w bazie Neon Postgres i ładuje domyślne kategorie oraz produkty.
3. Sprawdź i zaktualizuj `.github/workflows/ci-deploy.yml`, aby wszystkie nowe testy przechodziły czysto w pipeline CI.
4. Zaktualizuj dokumentację:
   - `README.md`: opis nowych funkcji v3.0 (Panel Administracyjny z logowaniem, konfiguracja kategorii, produktów, migracja produktów między kategoriami, ochrona danych klientów i przeniesienie usuwania klientów do Admina) oraz szczegółowa instrukcja darmowego wdrożenia na **Vercel (Hobby) + Neon Postgres**.
   - `ARCHITECTURE.md`: zaktualizowany diagram i opis warstwy `/api/*`, repozytorium Dual-Mode (`NeonShopRepository` + `InMemoryShopRepository`), autoryzacji HMAC `HttpOnly` oraz ochrony PII / anty-spamu.
   - `CHANGELOG.md`: dodaj sekcję `[3.0.0] - 2026-11-14` dokumentującą wszystkie zmiany.
5. Wykonaj pełny audyt końcowy i uruchom wszystkie bramki jakości:
   - `npm run lint`
   - `npm run format:check` (w razie potrzeby uruchom `npm run format`)
   - `npm run typecheck`
   - `npm run test:coverage`
   - `npm run build`
   - `npm run test:e2e`
6. Utwórz commit: `docs(v3): add Vercel + Neon deployment config, DB init script and update documentation`.
```

---

## 4. Master Prompt (One-Shot Autonomous Orchestrator — Etapy 0–6)

Poniższy **Master Prompt** pozwala uruchomić **cały proces wdrożenia (Etapy 0–6) automatycznie jednym poleceniem**.  
Główny agent działa w nim jako **Orkiestrator** (najlepiej uruchomiony na modelu **Gemini 4 Argon (High)**), delegując poszczególne etapy do świeżych subagentów z odpowiednio dobranym modelem (`pro` = Argon / `flash` = Hydrogen), weryfikując wyniki testów po każdym etapie oraz sprawdzając działający interfejs w przeglądarce za pomocą subagenta `browser`.

### Gotowy Master Prompt do skopiowania:

```text
/goal
Przeczytaj @AGENTS.md oraz @ADMIN_CATALOG_PLAN.md i zrealizuj CAŁY plan wdrożenia wersji v3.0 (Etapy 0–6) w pełni autonomicznie, od początku do końca, bez zatrzymywania się na pytania do użytkownika.

Zasady orkiestracji i doboru modeli (BARDZO WAŻNE):
1. Działasz jako główny Orkiestrator. Aby utrzymać czyste okno kontekstowe i najwyższą jakość inżynieryjną, realizuj kolejne etapy sekwencyjnie (Etap 0 -> Etap 1 -> Etap 2 -> Etap 3 -> Etap 4 -> Etap 5 -> Etap 6) wywołując dla każdego etapu osobnego subagenta przez `invoke_subagent` (`TypeName: "self"`, `Workspace: "inherit"`).
2. Dobieraj model subagenta (`Model` w `invoke_subagent`) odpowiednio do złożoności etapu zgodnie z tabelą w @ADMIN_CATALOG_PLAN.md:
   - Etap 0 (Konfiguracja Vercel + Neon i AGENTS.md): `Model: "flash"` (Hydrogen)
   - Etap 1 (Domena v3: Kategorie, Produkty, Migracja, Walidacja Klientów, Schematy + Unit Testy >= 95%): `Model: "pro"` (Argon)
   - Etap 2 (Backend Vercel Functions `/api/*`, Neon/InMemory Repository, Auth HttpOnly Cookie, Rate Limiting + Testy API): `Model: "pro"` (Argon)
   - Etap 3 (Zustand Store v3, Synchronizacja API/Storage, Koszyk + Testy Integracyjne): `Model: "pro"` (Argon)
   - Etap 4 (UI Retro CRT: AdminLoginModal, AdminPanel [Kategorie, Produkty, Migracja, Klienci], przebudowa CustomersPanel i CatalogPanel): `Model: "pro"` (lub `"flash"`)
   - Etap 5 (Testy komponentowe RTL, Playwright E2E dla Admina i API oraz audyt dostępności `@axe-core/playwright`): `Model: "pro"` (Argon)
   - Etap 6 (Konfiguracja `vercel.json`, skrypt `db:init` dla Neon, dokumentacja `README.md`, `ARCHITECTURE.md`, `CHANGELOG.md` i końcowy audyt): `Model: "flash"` (Hydrogen)
3. Rygorystyczne egzekwowanie bramek jakości po każdym etapie:
   - Każdy subagent przed zakończeniem swojego etapu MUSI uruchomić wymagane komendy weryfikacyjne (`npm run lint`, `npm run typecheck`, `npm run test` / `npm run test:coverage`, `npm run build`, a od Etapu 5 również `npm run test:e2e`), naprawić wszelkie błędy i utworzyć atomowy commit na branchu `feat/admin-catalog-v3`.
   - Po zakończeniu pracy każdego subagenta zweryfikuj jego raport oraz `git status` / `git log -n 1`. Jeśli jakikolwiek test lub check nie przeszedł, wyślij do tego subagenta `send_message` z poleceniem naprawy przed uruchomieniem kolejnego etapu.
4. Weryfikacja wizualna w przeglądarce (po Etapie 5):
   - Uruchom lokalny serwer podglądu (`npm run preview`) jako proces w tle (`IsDaemon: true`), a następnie wywołaj subagenta `browser` (`Model: "flash"`), aby otworzył aplikację, zalogował się do Panelu Admina, sprawdził zakładki `KATEGORIE`, `PRODUKTY`, `MIGRACJA PRODUKTÓW` oraz `KLIENCI`, zweryfikował brak przycisku `USUŃ` w publicznym panelu klientów i potwierdził spójność motywu Retro CRT. Po teście zamknij proces serwera (`manage_task` -> `kill`).
5. Dyscyplina Git:
   - Wszystkie commity twórz na branchu `feat/admin-catalog-v3`.
   - NIE wykonuj `git push` do zdalnego repozytorium bez wyraźnego polecenia użytkownika.
6. Na zakończenie (po Etapie 6) przedstaw kompletny raport końcowy: wykaz utworzonych commitów, wyniki wszystkich bramek testowych (`lint`, `typecheck`, `test:coverage`, `test:e2e`, `build`) oraz krótką ściągawkę komend CLI (`vercel link`, `vercel integration add neon`) do podpięcia produkcyjnej bazy Neon na koncie Vercel użytkownika.
```
