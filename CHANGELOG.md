# Dziennik Zmian (Changelog)

Wszystkie istotne zmiany w projekcie **Shopping Cart** są dokumentowane w tym pliku.

Format opiera się na zasadach [Keep a Changelog](https://keepachangelog.com/pl/1.0.0/),
a projekt przestrzega [Semantycznego Wersjonowania (SemVer)](https://semver.org/lang/pl/).

---

## [3.0.0] - 2026-11-14

Wydanie wersji **v3.0.0** wprowadzające pełną architekturę Full-Stack Vercel Functions + Neon Serverless Postgres, bezpieczny Panel Administracyjny Retro CRT chroniony serwerową sesją `HttpOnly`, dynamiczny katalog produktów i kategorii, narzędzie masowej migracji asortymentu oraz zaostrzone standardy ochrony prywatności klientów (maskowanie PII, honeypot, rate-limiting i usunięcie akcji destrukcyjnych z widoku publicznego).

### Dodano
- **Architektura Full-Stack Vercel Functions + Neon Serverless Postgres:**
  - Bezserwerowe funkcje API w katalogu `api/` na silniku Vercel Fluid Compute (`vercel.json`),
  - Repozytorium Dual-Mode (`NeonShopRepository` na produkcji i preview oraz deterministyczne `InMemoryShopRepository` w testach jednostkowych i środowisku bez bazy danych),
  - Moduł `src/server/db.ts` z leniwą inicjalizacją `@neondatabase/serverless` i automatycznym tworzeniem schematu tabel (`ensureSchemaAndSeed`),
  - Skrypty pomocnicze `scripts/init-neon-db.mjs` i `scripts/init-neon-db.ts` oraz polecenie `npm run db:init` do inicjalizacji i seedowania tabel SQL.
- **Panel Administracyjny Retro CRT:**
  - Modal logowania `AdminLoginModal` z obsługą klawiatury (`Esc`, `Enter`), pułapką fokusu i alertami błędów w `role="alert"`,
  - Wielozakładkowy panel `AdminPanel` z sekcjami:
    - `[1] KATEGORIE`: dodawanie, edycja i usuwanie kategorii z automatyczną reasumpcją produktów,
    - `[2] PRODUKTY`: pełny CRUD produktów z formularzem, wyborem kategorii, stanami magazynowymi i walidacją SKU,
    - `[3] MIGRACJA PRODUKTÓW`: masowe przenoszenie wybranych produktów między kategoriami ze zbiorczym zaznaczaniem,
    - `[4] KLIENCI`: podgląd pełnych adresów e-mail, historii zamówień i bezpiecznego usuwania klientów.
  - Przełącznik `PANEL ADMINA` / `WYLOGUJ` w nagłówku `HeaderBar`.
- **Serwerowe Bezpieczeństwo Sesji i Anty-Spam:**
  - Weryfikacja hasła administratora na backendzie za pomocą `crypto.scryptSync` i porównania w czasie stałym `crypto.timingSafeEqual`,
  - Podpisany token HMAC-SHA256 w ciasteczku `HttpOnly; SameSite=Strict; Path=/; Max-Age=7200`,
  - Ochrona przed atakami brute-force na logowanie admina (max 5 prób / 15 min z kodem HTTP 429).
- **Zarządzanie Katalogiem i Integralność Danych:**
  - Model dynamicznych kategorii `Category` z nieusuwalną kategorią domyślną `Ogólne` (`id: 'cat-default'`, `isDefault: true`),
  - Automatyczna reasumpcja produktów do kategorii domyślnej po usunięciu kategorii nadrzędnej,
  - Funkcja masowej migracji produktów między kategoriami (`POST /api/categories/migrate`),
  - Czysty parser cen `parsePlnInputToCents` eliminujący błędy float przy wprowadzaniu cen PLN,
  - Funkcja `syncCartWithCatalog` usuwająca z koszyka produkty usunięte lub niedostępne (`!inStock || stockQuantity <= 0`).
- **Ochrona Prywatności Klientów (PII Hygiene):**
  - Maskowanie adresów e-mail klientów w widoku publicznym (`maskCustomerEmail`: np. `jan.kowalski@example.com` -> `j***i@example.com`),
  - Ukryte pole antyspamowe honeypot (`companyWebsite`) w formularzu rejestracji klienta,
  - Wymuszenie unikalności e-maili klientów (case-insensitive) z kodem `409 Conflict`,
  - Rate-limiter rejestracji nowych klientów (max 5 rejestracji / 10 min -> HTTP 429).
- **Narzędzia Developerskie i Jakościowe:**
  - Middleware `viteApiPlugin` w `src/server/viteApiPlugin.ts` do lokalnego routingu i testowania endpointów `/api/*` z automatycznym wsparciem hasła deweloperskiego w `npm run preview`,
  - Rozbudowany zestaw testów jednostkowych i integracyjnych Vitest dla handlerów serwera, bazy danych i panelu admina,
  - Kompleksowe scenariusze Playwright E2E oraz audyt dostępności `@axe-core/playwright` dla modułu Admina (0 naruszeń critical/serious).

### Zmieniono
- Usunięto destrukcyjny przycisk `USUŃ` z publicznego komponentu `CustomersPanel` — usuwanie klientów jest dozwolone wyłącznie w Panelu Admina po autoryzacji sesji.
- Zaktualizowano `CatalogPanel`, aby dynamicznie pobierał kategorie ze stanu i blokował dodawanie produktów niedostępnych w magazynie (`!inStock || stockQuantity <= 0`).
- Rozszerzono `PersistedShopStateSchema` o wersję v3 z bezstratną migracją formatów v1 (Tkinter) i v2.
- Zaktualizowano wersję projektu w `package.json` do `3.0.0`.

### Bezpieczeństwo
- Całkowity zakaz umieszczania hasła i sekretu sesji w kodzie klienckim (przeglądarkowym).
- Ochrona endpointów mutacyjnych (`POST/PUT/DELETE /api/categories`, `POST/PUT/DELETE /api/products`, `DELETE /api/customers`, `POST /api/categories/migrate`) weryfikująca podpisane ciasteczko `HttpOnly`.

---

## [2.0.0] - 2026-11-13

Kompletne przepisanie i modernizacja architektury aplikacji z desktopowego Pythona Tkinter / backendu FastAPI na statyczną, nowoczesną aplikację przeglądarkową **Client-First Single Page Application (SPA)** zbudowaną w oparciu o React 19, TypeScript oraz Vite, wdrażaną bezpośrednio na **GitHub Pages**.

### Dodano
- **Nowoczesny stos technologiczny SPA:**
  - React 19 z funkcyjnymi komponentami i hookami,
  - TypeScript w trybie ścisłym (`strict: true`, `noUncheckedIndexedAccess: true`),
  - Vite 6 z konfiguracją ścieżki bazowej pod GitHub Pages (`base: '/Shopping_cart/'`),
  - Zustand 5 jako lekki magazyn stanu globalnego z mechanizmem automatycznej persystencji,
  - Zod 3 do walidacji danych wejściowych, granic stanu oraz schematów backupu.
- **Domenowy model finansowy w groszach (`Cents`):**
  - Brandowany typ `Cents` oraz bezpieczne funkcje arytmetyczne (`addCents`, `multiplyCents`, `toCents`),
  - Całkowity zakaz stosowania liczb zmiennoprzecinkowych (`float`) w obliczeniach finansowych,
  - Reguły darmowej dostawy: próg `200,00 zł` (20 000 groszy), koszt standardowy `15,00 zł` (1 500 groszy) oraz kalkulacja brakującej kwoty (`amountToFreeDeliveryCents`).
- **Retro CRT Design System:**
  - Zielony motyw terminala monochromatycznego (`#0b0f0b`, `#0f1a10`, `#21f35a`, `#00ff66`),
  - Warstwa efektów kineskopowych CRT FX (linie scanlines, poświata fosforu, winieta),
  - Przełącznik `[CRT FX: ON/OFF]` z trwałym zapisem preferencji użytkownika,
  - Automatyczne wygaszanie efektów przy preferencji systemowej `@media (prefers-reduced-motion: reduce)`.
- **Panel kasy i 3 metody płatności:**
  - Płatność kartą kredytową z algorytmem Luhna, kontrolą daty ważności `MM/RR` oraz walidacją CVV,
  - Płatność PayPal z walidacją adresu e-mail,
  - Płatność Bitcoin z walidacją formatów adresów portfela Base58 (`1...`, `3...`) oraz Bech32 (`bc1...`) wraz z przelicznikiem kursowym w czasie rzeczywistym.
- **Trwałość danych i adaptery pamięci masowej:**
  - Adapter `IndexedDbStorageAdapter` wykorzystujący bibliotekę `idb-keyval`,
  - Bezpieczny, przezroczysty fallback do `localStorage` w środowiskach bez wsparcia IndexedDB,
  - Schemat persystencji z wersjonowaniem (`version: 2`),
  - Zestaw bezpiecznych, anonimowych danych demonstracyjnych (`seed.ts`) oraz funkcja `resetDemoData()`.
- **Zarządzanie klientami i niezależność zamówień:**
  - Formularz dodawania klientów z walidacją formatu e-mail,
  - Wybór aktywnego klienta do koszyka,
  - Wzorzec snapshotu klienta w zamówieniu pozwalający na bezpieczne usuwanie klienta bez naruszenia historii wcześniejszych transakcji.
- **Narzędzia raportowania i eksportu:**
  - Generator pliku tekstowego tabeli ASCII `order_history_YYYYMMDD_HHMMSS.txt` zachowujący estetykę pierwotnego programu Tkinter,
  - Narzędzie eksportu i importu kopii zapasowej w formacie JSON (`HeaderBar.tsx`),
  - Funkcja migracyjna `parseLegacyOrCurrentBackup` umożliwiająca bezbłędne wczytanie starego pliku `data.json` ze starszych wersji aplikacji.
- **Dostępność (WCAG AA):**
  - Pełna obsługa nawigacji z klawiatury (`Tab`, `Enter`, `Space`, `Esc`),
  - Dostępny modal szczegółów zamówienia `OrderDetailsModal` z pułapką fokusu,
  - Pasek powiadomień terminala `StatusBar` ze wsparciem czytników ekranu (`role="status"`, `aria-live="polite"`).
- **Kompleksowy zestaw testów i jakość kodu:**
  - 203 testy jednostkowe i integracyjne Vitest (pokrycie domeny > 98%, całości > 96%),
  - 10 scenariuszy testowych Playwright End-to-End na buildzie produkcyjnym,
  - Zautomatyzowany audyt dostępności `@axe-core/playwright` (zero naruszeń krytycznych i poważnych),
  - Konfiguracja ESLint, Prettier oraz skryptu weryfikacji typów `tsc --noEmit`.
- **Pipeline CI/CD w GitHub Actions:**
  - Workflow `.github/workflows/ci-deploy.yml` wykonujący pełną weryfikację i automatyczny deploy na GitHub Pages po przejściu wszystkich testów.

### Bezpieczeństwo (PCI-DSS Hygiene)
- **Bezwzględny brak utrwalania kodów CVV:** Kod CVV/CVC weryfikowany jest wyłącznie w pamięci operacyjnej podczas walidacji formularza, po czym jest natychmiast czyszczony — nigdy nie trafia do obiektów `Order`, bazy IndexedDB, `localStorage`, eksportu `data.json` ani raportów `.txt`.
- **Maskowanie numerów kart:** Pełny numer karty po walidacji algorytmem Luhna jest nieodwracalnie maskowany do formatu `**** **** **** 1234`.
- **Sanityzacja danych legacy:** Funkcja importu starego pliku `data.json` automatycznie maskuje historyczne numery kart i trwale usuwa ewentualne pola `cvv`.
- **Brak danych prywatnych:** Wszystkie dane demonstracyjne (`seed.ts`, `seed.py`) zostały zanonimizowane (fikcyjne dane `Jan Kowalski`, domena `example.com`).

### Zmieniono
- Podstawa technologiczna została całkowicie uniezależniona od środowiska wykonawczego Python na maszynie użytkownika.
- Obliczenia kwot zmieniono ze zmiennoprzecinkowych na liczby całkowite w groszach.
- Wygląd aplikacji został przeniesiony z surowych kontrolek Tkintera na responsywny, wielopanelowy interfejs webowy CSS Grid.
- Zastąpiono lokalny plik bazy danych SQLite pamięcią przeglądarkową IndexedDB z opcją tworzenia kopii zapasowych JSON.

### Przeniesiono
- Pierwotny kod Pythona (`main.py`, `cart.py`, `products.py`, `payments.py`, `web/`) został przeniesiony i zabezpieczony w katalogu referencyjnym [`legacy/`](legacy/).

---

## [1.0.0] - Wersja pierwotna (Legacy)

### Dodano
- Aplikacja desktopowa napisana w języku Python z interfejsem graficznym biblioteki Tkinter (`main.py`).
- Podstawowy katalog produktów w pliku `products.py` (Laptop, Słuchawki, Koszulka, Plecak, Książka Python).
- Logika koszyka w pliku `cart.py`.
- Obsługa płatności (karta, PayPal, Bitcoin) w pliku `payments.py`.
- Eksport historii zamówień do pliku tekstowego ASCII `.txt`.
- Persystencja stanu w lokalnym pliku `data.json`.
- Eksperymentalna wersja webowa w katalogu `web/` oparta o framework FastAPI, szablony Jinja2 oraz bazy SQLite / Postgres Neon.
- Generator instalatora wykonywalnego `.exe` przy pomocy PyInstaller.
