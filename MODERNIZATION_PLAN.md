# Shopping Cart (Retro) — Plan Modernizacji, Architektury i Autonomicznego Developmentu

Ten dokument stanowi kompletny plan przebudowy repozytorium [`phxphoenix/Shopping_cart`](https://github.com/phxphoenix/Shopping_cart) do nowoczesnej, w pełni przetestowanej aplikacji webowej w stylu **Retro CRT**, wdrażanej produkcyjnie na **GitHub Pages**.

Każdy etap poniżej zawiera **cel**, **zakres prac**, **bramki jakości (Definition of Done)**, **rekomendację modelu i zarządzania kontekstem** oraz **gotowy prompt do autonomicznego wykonania**.

---

## 1. Audyt obecnego repozytorium (stan wyjściowy)

Obecne repozytorium zawiera dwie oddzielne, niespójne aplikacje:
1. **Aplikacja desktopowa (Tkinter)** w katalogu głównym:
   - `main.py` (`ShoppingCartApp`), `cart.py` (`ShoppingCart`), `products.py` (`Product`, `CATALOG`), `payments.py` (`PaymentMethod`, `CreditCardPayment`, `PayPalPayment`, `BitcoinPayment`).
   - Persystencja w pliku `data.json`, motyw retro (`#0b0f0b`, `#0f1a10`, `#21f35a`, `#00ff66`, `Courier New`), eksport historii zamówień do ASCII `.txt`.
2. **Aplikacja webowa (FastAPI + SQLAlchemy + vanilla JS)** w katalogu `web/`:
   - `web/app/main.py`, `web/app/models.py`, `web/app/schemas.py`, `web/app/db.py`, `web/app/templates/index.html`, `web/app/static/app.js`, `web/seed.py`, `web/seed_orders.py`.

### Zidentyfikowane problemy i dług techniczny

| Obszar | Obserwacja z kodu | Wpływ / Ryzyko |
|---|---|---|
| **Hosting na GitHub Pages** | `web/` wymaga backendu Python (FastAPI + SQLAlchemy + SQLite/Neon Postgres). | **Bloker wdrożenia** — GitHub Pages obsługuje wyłącznie statyczne zasoby (HTML/CSS/JS). |
| **Brakujący plik CSS** | `web/app/templates/index.html` linkuje `/static/styles.css`, ale w `web/app/static/` znajduje się wyłącznie `app.js`. | Strona web ładuje się bez stylów (HTTP 404 na `styles.css`). |
| **Bezpieczeństwo płatności** | `PaymentDetails` (`web/app/models.py`, `web/app/schemas.py`) oraz `data.json` (`main.py`) zapisują i zwracają pełny `card_number`, `expiry` oraz **jawny `cvv`**. | Poważna luka bezpieczeństwa (wyciek danych kart płatniczych). |
| **Manipulacja ceną po stronie klienta** | `POST /api/orders` (`web/app/main.py`) oblicza sumy na podstawie `item.price` z payloadu zamiast z katalogu serwerowego. | Możliwość modyfikacji ceny produktu w żądaniu API. |
| **Pominięta walidacja płatności w Web** | `web/app/main.py` nie używa walidatorów z `payments.py` (16 cyfr karty, 3 cyfry CVV, `@`/`.` dla PayPal, prefiks `1`/`3`/`bc1` i długość >= 26 dla BTC). | Można złożyć zamówienie pustymi lub niepoprawnymi danymi płatności. |
| **Duplikacja logiki i rozjazd funkcji** | `CATALOG`, próg darmowej dostawy (`200.00`), koszt dostawy (`15.00`) są powielone w 3 miejscach (`products.py`/`cart.py`, `web/app/main.py`, `web/app/static/app.js`). Web nie ma eksportu `.txt`, usuwania klientów/zamówień ani komunikatu ile brakuje do darmowej dostawy. | Niespójne zachowanie i trudne utrzymanie. |
| **Arytmetyka finansowa na `float`** | Ceny i sumy liczone jako Python `float` i JS `Number`. | Ryzyko błędów zaokrągleń zmiennoprzecinkowych (np. `0.1 + 0.2`). |
| **Integralność relacji i modelu** | `delete_customer` w `web/app/main.py` nie zabezpiecza klientów z przypisanymi zamówieniami; `Product` w `products.py` jest kluczem `dict` bez `__hash__`/`__eq__`; Pydantic używa przestarzałego `class Config`; FastAPI używa przestarzałego `@app.on_event("startup")`. | Błędy runtime i dług technologiczny. |
| **Jakość, testy i higiena repo** | Zero testów (unit/integration/E2E), brak lintera/CI, `.idea/` oraz `__pycache__/*.pyc` są śledzone w Git, a `web/seed.py` zawiera dane wyglądające na prywatne (`email`/imię i nazwisko). | Brak gwarancji poprawności i nieczyste repozytorium. |

---

## 2. Docelowy stack technologiczny i architektura (GitHub Pages + Retro CRT)

Aby aplikacja działała produkcyjnie na **GitHub Pages** (100% static hosting, zero kosztów serwera, szybkie ładowanie, praca offline), rekomendowana jest **całkowita przebudowa warstwy webowej na nowoczesną aplikację Client-First SPA** z zachowaniem (lub archiwizacją w `legacy/`) pierwotnych plików Pythona dla celów referencyjnych.

### Stack technologiczny

- **Frontend / Core:** **React 19 + TypeScript (`strict: true`) + Vite**
  - Konfiguracja `base: '/Shopping_cart/'` pod GitHub Pages (oraz hash/basename routing przyjazny dla GH Pages).
- **Zarządzanie stanem:** **Zustand** (lekkie, modularne story: `cart`, `catalog`, `customers`, `orders`, `ui`)
- **Persystencja danych (Client-First DB):** **IndexedDB** (przez `idb-keyval` lub lekki wrapper) z fallbackiem do `localStorage` oraz warstwą abstrakcji `StorageAdapter`
  - Automatyczny seed przykładowych danych (bez prywatnych danych osobowych!) + przycisk `RESET DEMO DATA`.
  - **Import / Export `data.json`** (pełna kompatybilność wsteczna ze strukturą starej aplikacji desktopowej + walidacja schematu przez Zod).
  - **Eksport historii zamówień do `.txt`** w dokładnie takim samym formacie retro tabeli ASCII jak w `main.py` (`order_history_YYYYMMDD_HHMMSS.txt`).
- **Walidacja i domena:** **Zod** + czysta biblioteka domenowa w TypeScript:
  - Kwoty pieniężne przechowywane i liczone jako **liczby całkowite w groszach (`Cents`)**, formatowane dopiero w warstwie prezentacji (`formatPLN`).
  - Próg darmowej dostawy: `20000` groszy (200,00 zł), koszt dostawy: `1500` groszy (15,00 zł), plus licznik: *„Dodaj za X,XX zł, aby uzyskać darmową dostawę”*.
  - Płatności:
    - **Karta kredytowa:** walidacja algorytmem **Luhna** (16 cyfr), format i ważność `MM/RR` (niewygasła), CVV (3-4 cyfry). **Zasada bezpieczeństwa:** CVV nigdy nie trafia do storage ani historii zamówień, a numer karty jest maskowany do `**** **** **** 1234`.
    - **PayPal:** ścisła walidacja adresu e-mail.
    - **Bitcoin:** walidacja prefiksu (`1`, `3`, `bc1`) i długości/znaków Base58/Bech32 + przelicznik BTC/PLN.
- **Stylizacja i UX (Motyw Retro CRT):** **CSS Modules / Tailwind CSS v4 + Retro Design Tokens**
  - Oryginalna paleta z `main.py`: tło `#0b0f0b`, panele `#0f1a10`, tekst `#21f35a`, akcent `#00ff66`, statusy ostrzegawcze `#ffb000`, błędy `#ff4d4d`.
  - Monospace UI, ostre ramki (`ridge`/ASCII dividers), pasek statusu terminala (`[READY]`), opcjonalny tryb **CRT FX** (subtelne scanlines + poświata fosforu) z przełącznikiem `CRT: ON/OFF` i poszanowaniem `prefers-reduced-motion`.
  - Pełna responsywność (układ wielopanelowy na desktopie, wygodne sekcje/zakładki na mobile) oraz nawigacja klawiaturą + WCAG AA.
- **Testy i jakość kodu:**
  - **Vitest** + **React Testing Library** + `@testing-library/user-event` + `@vitest/coverage-v8`
  - **Playwright** + `@axe-core/playwright` (testy E2E + dostępność na buildzie produkcyjnym `vite preview`)
  - **ESLint + Prettier** (lub **Biome**) + `tsc --noEmit`
- **CI/CD:** **GitHub Actions** (`.github/workflows/ci-deploy.yml`) — automatyczne testy, build i deploy na **GitHub Pages**.

### Docelowa struktura katalogów

```text
Shopping_cart/
├── .github/workflows/ci-deploy.yml
├── AGENTS.md                         # Reguły projektu dla agentów AI
├── MODERNIZATION_PLAN.md             # Ten dokument
├── README.md                         # Zaktualizowana dokumentacja
├── CHANGELOG.md
├── package.json
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts
├── playwright.config.ts
├── legacy/                           # (Opcjonalnie) zarchiwizowana wersja Python Tkinter/FastAPI
├── src/
│   ├── domain/                       # Czysty TS bez zależności od Reacta
│   │   ├── money.ts                  # Grosze (Cents), formatowanie PLN
│   │   ├── catalog.ts                # Domyślny katalog i filtry/wyszukiwanie
│   │   ├── cart.ts                   # Obliczenia koszyka i próg darmowej dostawy
│   │   ├── payment.ts                # Walidacja (Luhn, expiry, CVV, PayPal, BTC) + maskowanie
│   │   ├── exportTxt.ts              # Generator tabeli ASCII .txt
│   │   └── schemas.ts                # Schematy Zod (również import legacy data.json)
│   ├── storage/                      # Warstwa persystencji
│   │   ├── adapter.ts                # Interfejs StorageAdapter
│   │   ├── indexedDbAdapter.ts       # Domyślna implementacja IndexedDB + fallback localStorage
│   │   └── seed.ts                   # Bezpieczne dane demonstracyjne
│   ├── store/                        # Zustand stores
│   │   └── useShopStore.ts
│   ├── components/                   # Komponenty Retro UI (Catalog, Cart, Customers, Checkout, OrderHistory, OrderModal, StatusBar)
│   ├── styles/                       # Tokeny retro, efekty CRT, reset, prefers-reduced-motion
│   └── App.tsx
├── tests/
│   ├── unit/                         # Vitest: domena, walidatory, money, ASCII export
│   ├── integration/                  # Vitest + RTL: store + komponenty UI
│   └── e2e/                          # Playwright: pełne scenariusze użytkownika + a11y
└── public/                           # Ikony, manifest, ewentualnie 404.html dla GH Pages
```

---

## 3. Jak prowadzić development autonomicznie w Antigravity

### Czy potrzebujemy dodatkowych agentów?

**Nie — tworzenie wielu własnych agentów (subagentów) nie jest tu konieczne i wprowadziłoby zbędny narzut.**
Dla projektu tej skali najlepiej sprawdza się **jeden główny agent wykonujący kolejne etapy sekwencyjnie**, wsparty plikami `AGENTS.md` i `MODERNIZATION_PLAN.md` oraz opcjonalnie wbudowanym subagentem **`browser`** (do wizualnego testu UI na żywo w Etapie 5/6).

Jeśli mimo to chcesz mieć „drugą parę oczu” bez ręcznego pilnowania:
- W Etapie 5 lub 6 możesz jednorazowo użyć komendy **`/teamwork`** (swarm) do równoległego pisania testów E2E i weryfikacji UI, albo poprosić głównego agenta o uruchomienie wbudowanego subagenta `browser` / `research` do niezależnego audytu.

### Jak zapewnić pełną autonomię bez ciągłych pytań o zgodę

1. **Konfiguracja uprawnień w Antigravity (Settings → General):**
   - **Permission Preset:** ustaw na `Turbo` (masz to już aktywne — pozwala agentowi wykonywać akcje bez zatrzymywania na każdym kroku).
   - **Tool Permissions / Network Access Rules:** w razie potrzeby dopuść narzędzia terminalowe/plikowe (`npm`, `npx`, `git`, `gh`) oraz dostęp sieciowy dla `npm install` i Playwrighta.
   - **Plan Review Policy:** zmień z `Always Ask` na opcję automatyczną (np. niepytającą o ręczną akceptację każdego dokumentu planu), aby agent nie czekał na kliknięcie „Proceed”.
2. **Plik `AGENTS.md` w katalogu głównym projektu (tworzony w Etapie 0):**
   - Antigravity automatycznie wykrywa `AGENTS.md` w root repozytorium. Zapisz w nim twarde reguły: zakaz kończenia etapu przy czerwonych testach, zakaz zapisywania CVV, wymóg aktualizacji testów i `CHANGELOG.md`.
3. **Użycie komendy `/goal` na początku każdego etapu:**
   - Poprzedzenie promptu etapu komendą `/goal` powoduje, że agent nie zatrzymuje się w pół drogi — sam uruchamia testy, poprawia błędy TypeScript/ESLint/Playwright i raportuje dopiero po przejściu wszystkich bramek jakości.
4. **Strategia kontekstu i czyszczenia (najważniejsza zasada!):**
   - **Między etapami otwieraj NOWĄ konwersację** (zamiast ciągnąć jeden wątek przez 7 etapów). Nowa konwersacja + odwołanie do `@MODERNIZATION_PLAN.md` daje czyste okno kontekstowe, brak „zapominania” reguł z początku czatu i najniższe zużycie tokenów.
   - **Wewnątrz jednego długiego etapu** (np. Etap 4 lub Etap 5), jeśli historia urośnie po serii debugowania, użyj **`/compact`**.

### Dobór modeli dla poszczególnych etapów

| Etap | Charakter pracy | Rekomendowany model | Zarządzanie kontekstem |
|---|---|---|---|
| **Etap 0** (Porządki Git + `AGENTS.md`) | Decyzje dot. repo, konfiguracja reguł | **Flash** lub **Pro (High)** | Nowa konwersacja |
| **Etap 1** (Scaffolding Vite/TS/Testy) | Powtarzalna konfiguracja narzędzi | **Flash** | Nowa konwersacja (lub kontynuacja po Etapie 0) |
| **Etap 2** (Domena, Grosze, Walidatory, Unit Testy) | Krytyczna logika biznesowa i bezpieczeństwo | **Pro (High)** | **Nowa konwersacja** (czysty kontekst!) |
| **Etap 3** (Storage IndexedDB, Zustand, Seed/Migracja) | Architektura stanu i persystencji | **Pro (High)** | Kontynuacja po Etapie 2 lub `/compact` |
| **Etap 4** (Retro CRT UI + Komponenty + A11y) | Rozbudowany frontend i CSS | **Pro (High)** (lub **Flash** przy prostych komponentach) | **Nowa konwersacja** + `/compact` w połowie, jeśli długi |
| **Etap 5** (Testy RTL + Playwright E2E + Axe) | Scenariusze E2E i debugowanie selektorów | **Pro (High)** (do E2E) / **Flash** (do prostych testów RTL) | **Nowa konwersacja** |
| **Etap 6** (GitHub Actions + GitHub Pages Deploy) | CI/CD, ścieżki `base`, weryfikacja live | **Pro (High)** | **Nowa konwersacja** |
| **Etap 7** (Dokumentacja + Końcowy audyt) | Sprawdzenie spójności całego projektu | **Flash** lub **Pro (High)** | Kontynuacja po Etapie 6 lub Nowa konwersacja |

---

## 4. Plan etapowy i gotowe prompty wykonawcze

> **Wskazówka przed startem:** Upewnij się, że pracujesz w katalogu roboczym projektu. Jeśli repozytorium nie jest jeszcze sklonowane w tym folderze, Etap 0 zrobi to automatycznie. Przed wklejeniem promptu możesz dopisać `/goal` na jego początku, aby wymusić pełną pętlę weryfikacji.

---

### Etap 0: Klonowanie / porządki w Git i utworzenie `AGENTS.md`

- **Cel:** Uzyskanie czystego repozytorium Git bez śledzonych plików tymczasowych (`.idea/`, `__pycache__/`), bezpieczna archiwizacja starego kodu Pythona do `legacy/` (lub oznaczenie tagiem `v1-legacy-python`) oraz utworzenie `AGENTS.md`.
- **Model:** Flash lub Pro (High)
- **Kontekst:** Nowa konwersacja
- **Definition of Done:**
  - Repozytorium sklonowane/zsynchronizowane z `https://github.com/phxphoenix/Shopping_cart`.
  - `__pycache__/` i `.idea/` usunięte z indeksu Git (`git rm -r --cached`).
  - Stary kod Pythona przeniesiony do `legacy/` (z zachowaniem historii Git przez `git mv`), a `web/seed.py` zanonimizowany jeśli trafia do archiwum lub oznaczony jako legacy.
  - Utworzony plik `AGENTS.md` z regułami jakości, bezpieczeństwa i testowania.

#### Prompt do skopiowania (Etap 0):
```text
/goal
Przeczytaj @MODERNIZATION_PLAN.md i wykonaj wyłącznie Etap 0.

Zadania:
1. Sprawdź, czy w bieżącym katalogu roboczym jest już sklonowane repozytorium `https://github.com/phxphoenix/Shopping_cart`. Jeśli nie — sklonuj je tutaj (uważając, aby nie nadpisać istniejącego pliku `MODERNIZATION_PLAN.md`, przenieś go tymczasowo i przywróć po klonowaniu jeśli trzeba).
2. Usuń z indeksu Git pliki i katalogi śmieciowe (`.idea/`, `__pycache__/`) oraz zaktualizuj `.gitignore` pod nowoczesny projekt Node/Vite/Playwright/TypeScript (zachowując reguły Pythona dla `legacy/`).
3. Przenieś dotychczasowy kod Pythona (`main.py`, `cart.py`, `products.py`, `payments.py`, `web/`) do katalogu `legacy/` przy użyciu `git mv`, aby zachować historię Git. Usuń lub zanonimizuj prywatne dane kontaktowe z `legacy/web/seed.py`.
4. Utwórz w katalogu głównym plik `AGENTS.md` definiujący reguły projektu dla kolejnych etapów:
   - TypeScript `strict: true`, brak `any` bez uzasadnienia.
   - Zakaz używania typu zmiennoprzecinkowego do obliczeń pieniężnych — wszystkie kwoty w groszach (integer `Cents`).
   - Zakaz zapisywania/logowania/zwracania numerów CVV oraz pełnych numerów kart płatniczych (tylko maska ostatnich 4 cyfr).
   - Motyw graficzny: Retro CRT (`#0b0f0b`, `#0f1a10`, `#21f35a`, `#00ff66`, monospace).
   - Produkcja docelowa: GitHub Pages (`base: '/Shopping_cart/'`).
   - Bramka końcowa każdego etapu: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` muszą przechodzić bez błędów (w późniejszych etapach również E2E).
5. Zweryfikuj `git status` i przedstaw krótkie podsumowanie zmian (nie rób jeszcze pusha, chyba że na lokalnym branchu `modernization/v2` — utwórz taki roboczy branch).
```

---

### Etap 1: Inicjalizacja projektu (Vite + React 19 + TypeScript + Narzędzia jakości)

- **Cel:** Postawienie kompletnego szkieletu aplikacji TypeScript z gotową konfiguracją ESLint, Prettier, Vitest, Playwright oraz obsługą ścieżki bazowej dla GitHub Pages.
- **Model:** Flash
- **Kontekst:** Kontynuacja po Etapie 0 (lub nowa konwersacja)
- **Definition of Done:**
  - `package.json` ze skryptami: `dev`, `build`, `preview`, `lint`, `format:check`, `typecheck`, `test`, `test:coverage`, `test:e2e`.
  - Skonfigurowane `tsconfig.json` (`strict: true`), `vite.config.ts` (`base: '/Shopping_cart/'`), `vitest.config.ts`, `playwright.config.ts`, ESLint + Prettier.
  - Minimalny działający ekran „boot screen” Retro CRT w `src/App.tsx` + `public/404.html` (obsługa GitHub Pages).
  - Przechodzi `npm run lint`, `npm run typecheck`, `npm run test` (1 test smoke), `npm run build`.

#### Prompt do skopiowania (Etap 1):
```text
/goal
Przeczytaj @AGENTS.md oraz @MODERNIZATION_PLAN.md i wykonaj wyłącznie Etap 1.

Zadania:
1. Zainicjalizuj w katalogu głównym projekt Vite + React + TypeScript (React 19, TypeScript z `strict: true`, `noUncheckedIndexedAccess: true`).
2. Zainstaluj i skonfiguruj:
   - `zustand` oraz `zod`
   - `idb-keyval` (do warstwy IndexedDB)
   - Narzędzia dev i testowe: `vitest`, `@vitest/coverage-v8`, `jsdom`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `@playwright/test`, `@axe-core/playwright`, `eslint`, `prettier` (oraz wymagane pluginy TS/React/a11y).
3. Skonfiguruj `vite.config.ts` z `base: '/Shopping_cart/'` (lub dynamicznie z `VITE_BASE_PATH` z domyślnym `/Shopping_cart/` dla produkcji i `/` dla testów lokalnych jeśli wygodniejsze — upewnij się, że `vite preview` działa poprawnie). Dodaj `public/404.html` przyjazny dla GitHub Pages.
4. Skonfiguruj skrypty w `package.json`: `dev`, `build`, `preview`, `lint`, `format:check`, `typecheck`, `test`, `test:coverage`, `test:e2e`.
5. Utwórz minimalny punkt startowy `src/App.tsx` z komunikatem `[BOOTING RETRO SHOPPING CART v2.0...]` oraz jeden test smoke w `tests/unit/smoke.test.ts`.
6. Uruchom kolejno `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` i napraw ewentualne problemy przed zakończeniem.
```

---

### Etap 2: Warstwa domenowa, bezpieczeństwo płatności, eksport `.txt` i testy jednostkowe

- **Cel:** Zbudowanie w 100% czystej, niezależnej od UI warstwy logiki biznesowej w `src/domain/` oraz pełne pokrycie jej testami jednostkowymi.
- **Model:** Pro (High)
- **Kontekst:** **Nowa konwersacja** (świeży kontekst na krytyczną logikę biznesową!)
- **Definition of Done:**
  - `src/domain/money.ts`: operacje w groszach (`Cents`), brak błędów float, formatowanie PLN (`1 234,56 zł` lub spójny format `1234.56 zł`).
  - `src/domain/catalog.ts`: początkowy katalog produktów zgodny z oryginałem + rozszerzalna struktura (ID, SKU, nazwa, kategoria, cena w groszach, opis retro, stan magazynowy/dostępność).
  - `src/domain/cart.ts`: dodawanie, zmiana ilości, usuwanie, czyszczenie, próg darmowej dostawy `20000` groszy, koszt dostawy `1500` groszy, obliczenie kwoty brakującej do darmowej dostawy.
  - `src/domain/payment.ts`: walidacja karty (Luhn + 16 cyfr + niewygasła data `MM/RR` + CVV 3-4 cyfry + **maskowanie i nigdy nieprzechowywanie CVV**), PayPal (email), Bitcoin (`1`/`3`/`bc1`, Base58/Bech32 + kalkulacja kwoty w BTC).
  - `src/domain/exportTxt.ts`: generator tabeli ASCII `.txt` zgodny ze stylem z `legacy/main.py`.
  - `src/domain/schemas.ts`: schematy Zod dla encji oraz parser/importer starego formatu `data.json` (z migracją cen `float` -> grosze oraz z usunięciem ewentualnych jawnych pól `cvv` z historycznych plików `data.json`!).
  - Pokrycie testami jednostkowymi warstwy `src/domain/` >= 95%.

#### Prompt do skopiowania (Etap 2):
```text
/goal
Przeczytaj @AGENTS.md oraz @MODERNIZATION_PLAN.md i wykonaj wyłącznie Etap 2 (warstwa domenowa + testy jednostkowe).

Zadania:
1. Zaimplementuj czystą warstwę domenową w `src/domain/` (bez importów Reacta ani DOM):
   - `money.ts`: typ brandowany/pomocniczy `Cents` (liczby całkowite w groszach), bezpieczne funkcje dodawania, mnożenia (cena * ilość), konwersji z PLN (tylko do importu legacy `data.json` z użyciem `Math.round(pln * 100)`) i formatowania kwot.
   - `catalog.ts`: typy produktów i domyślny katalog (zachowaj wszystkie 5 oryginalnych pozycji: Laptop 3499.99, Sluchawki 199.99, Koszulka 79.99, Plecak 149.99, Ksiazka Python 59.99, oraz opcjonalnie dodaj kilka tematycznych pozycji retro, np. Klawiatura Mechaniczna, Monitor CRT — upewniając się, że klasyczne 5 są łatwo rozpoznawalne).
   - `cart.ts`: czyste funkcje operacji na koszyku (`addItem`, `updateQuantity`, `removeItem`, `clearCart`, `calculateTotals`) z regułami `FREE_DELIVERY_THRESHOLD_CENTS = 20000`, `DELIVERY_COST_CENTS = 1500` oraz polem `amountToFreeDeliveryCents`. Pamiętaj o przypadku pustego koszyka (dostawa 0 przy pustym koszyku lub jawnie obsługiwany stan).
   - `payment.ts`: walidacja metod płatności:
     * Karta kredytowa: 16 cyfr + suma kontrolna Luhna, data ważności `MM/RR` nie starsza niż bieżący miesiąc, CVV 3-4 cyfry. Zwracany obiekt zanonimizowany: `{ method: 'card', maskedCard: '**** **** **** 1234', last4: '1234', expiry: 'MM/RR' }` — NIGDY nie zapisuj ani nie zwracaj CVV ani pełnego numeru karty.
     * PayPal: poprawny e-mail.
     * Bitcoin: poprawny format adresu (`1...`, `3...` Base58 długości 26-35 lub `bc1...` Bech32) + przelicznik BTC z jawną stałą kursu.
   - `exportTxt.ts`: generator raportu historii zamówień w formacie ASCII-table jak w `legacy/main.py` (obsługa pustej listy, wyrównanie kolumn, polskie znaki).
   - `schemas.ts`: schematy Zod do walidacji stanu aplikacji oraz funkcja `parseLegacyOrCurrentBackup(jsonString)` umożliwiająca import zarówno nowego backupu JSON, jak i starego `data.json` z Tkintera (konwersja cen na grosze, sanityzacja i usunięcie jawnych CVV / maskowanie starych numerów kart przy imporcie!).
2. Napisz obszerny zestaw testów jednostkowych w `tests/unit/` (edge case'y dla granicy 199.99 zł vs 200.00 zł, puste ilości, ujemne liczby, błędny Luhn, wygasła karta, błędny portfel BTC, eksport ASCII, import starego `data.json` z jawnym CVV).
3. Uruchom `npm run lint`, `npm run typecheck`, `npm run test:coverage` i `npm run build`. Cel pokrycia `src/domain/`: >= 95%.
```

---

### Etap 3: Warstwa persystencji (IndexedDB), Store (Zustand) i Testy Integracyjne

- **Cel:** Połączenie domeny z trwałą pamięcią przeglądarki (IndexedDB z fallbackiem `localStorage`), zbudowanie Zustand store oraz przetestowanie pełnych przepływów biznesowych bez UI.
- **Model:** Pro (High)
- **Kontekst:** Kontynuacja po Etapie 2 (lub `/compact` jeśli konwersacja stała się bardzo długa)
- **Definition of Done:**
  - `src/storage/` z interfejsem `StorageAdapter` i implementacją opartą o `idb-keyval` (z bezpiecznym fallbackiem do `localStorage` i wersjonowaniem kluczy).
  - `src/storage/seed.ts` z bezpiecznymi danymi demo (np. anonimowi klienci testowi typu `Jan Kowalski`, `Anna Nowak` + 1-2 przykładowe zamówienia) ładowanymi wyłącznie przy pierwszym uruchomieniu (gdy storage pusty) oraz akcją `resetDemoData()`.
  - `src/store/useShopStore.ts` obsługujący: inicjalizację async ze storage, filtrowanie/wyszukiwanie katalogu, operacje koszyka, CRUD klientów (z bezpieczną obsługą usuwania klienta posiadającego zamówienia — np. zachowanie snapshota klienta w zamówieniu!), składanie zamówienia (walidacja płatności + generowanie ID i timestampu ISO + zapis zamówienia + czyszczenie koszyka), usuwanie zamówienia, eksport `.txt`, eksport/import backupu JSON.
  - Testy integracyjne store + storage w `tests/integration/store.test.ts`.

#### Prompt do skopiowania (Etap 3):
```text
/goal
Przeczytaj @AGENTS.md oraz @MODERNIZATION_PLAN.md i wykonaj wyłącznie Etap 3 (warstwa persystencji + Zustand store + testy integracyjne).

Zadania:
1. Zbuduj `src/storage/`:
   - `adapter.ts`: interfejs `StorageAdapter` (`loadState`, `saveState`, `clearState`) z wersjonowanym schematem `PersistedShopState` (`version: 2`, `customers`, `orders`, `cart`, `settings`).
   - `indexedDbAdapter.ts`: implementacja na bazie `idb-keyval` z bezpiecznym fallbackiem na `localStorage` (np. gdy IndexedDB jest niedostępne) oraz walidacją danych przy odczycie przez Zod (`schemas.ts`).
   - `seed.ts`: funkcja tworząca bezpieczne, fikcyjne dane demonstracyjne (bez żadnych prywatnych e-maili z oryginalnego repo) dla pierwszego uruchomienia.
2. Zbuduj `src/store/useShopStore.ts` (Zustand):
   - Ładowanie początkowego stanu ze storage (lub seed, jeśli storage jest pusty) oraz automatyczny zapis zmian.
   - Pełne akcje dla:
     * Katalogu (wyszukiwanie tekstowe, filtrowanie po kategorii, opcjonalnie dodanie własnego produktu).
     * Koszyka (dodaj z ilością, ustaw ilość, +/-, usuń, wyczyść, podgląd sum i brakującej kwoty do darmowej dostawy).
     * Klientów (dodaj z walidacją, wybierz aktywnego klienta, usuń — pamiętaj, że zamówienia przechowują własny snapshot danych klienta, więc usunięcie klienta nie psuje historii zamówień!).
     * Checkoutu i zamówień (walidacja koszyka, wybranego klienta i metody płatności; zapis zamaskowanych danych płatności; czyszczenie koszyka; obsługa statusów i komunikatów błędów w terminalowym `statusMessage`; usuwanie zamówienia).
     * Narzędzi danych: `exportHistoryTxt()`, `exportBackupJson()`, `importBackupJson(rawText)`, `resetDemoData()`.
3. Napisz testy integracyjne `tests/integration/store.test.ts` używając in-memory mocka `StorageAdapter` (testujące pełny cykl: seed -> dodanie klienta -> dodanie produktów -> przejście progu 200 PLN -> odrzucenie złej karty -> poprawne zamówienie -> usunięcie klienta bez psucia zamówienia -> eksport/import JSON -> reset demo).
4. Uruchom `npm run lint`, `npm run typecheck`, `npm run test:coverage`, `npm run build`.
```

---

### Etap 4: Interfejs Retro CRT Design System i Komponenty UI

- **Cel:** Stworzenie dopracowanego, responsywnego i dostępnego interfejsu użytkownika w klimacie terminalowego Retro CRT, zachowującego klimat oryginalnego `main.py`, lecz zaprojektowanego nowocześnie.
- **Model:** Pro (High)
- **Kontekst:** **Nowa konwersacja** (świeży kontekst na warstwę UI i CSS!)
- **Definition of Done:**
  - Spójny system stylów w `src/styles/`: zmienne CSS z paletą `#0b0f0b` (tło), `#0f1a10` (panele), `#21f35a` (tekst), `#00ff66` (akcent), `#ffb000` (amber/warning), `#ff4d4d` (błąd), font monospace, opcjonalne scanlines i glow z przełącznikiem `CRT FX: ON/OFF` oraz `@media (prefers-reduced-motion: reduce)`.
  - Komponenty z czytelnym podziałem odpowiedzialności i atrybutami `aria-*` / semantycznym HTML:
    - `HeaderBar`: tytuł `SHOPPING CART // TERMINAL v2.0`, przełącznik `CRT FX`, przyciski `IMPORT JSON`, `EXPORT JSON`, `RESET DEMO`.
    - `CatalogPanel`: wyszukiwarka, filtry kategorii, lista produktów, szybkie dodawanie ilości i przycisk `DODAJ ->`.
    - `CartPanel`: pozycje koszyka z przyciskami `-`/`+`/usuń/wyczyść, wizualny pasek postępu do darmowej dostawy (200,00 zł), podsumowanie (Suma, Dostawa / `GRATIS`, Do zapłaty).
    - `CustomersPanel`: formularz dodawania klienta (imię i nazwisko + e-mail z walidacją), lista wyboru aktywnego klienta, bezpieczne usuwanie klienta.
    - `CheckoutPanel`: wybór metody (`Karta kredytowa`, `PayPal`, `Bitcoin`), dynamiczne pola z walidacją inline i komunikatami błędów, podgląd przelicznika BTC, przycisk `ZAMÓW I ZAPŁAĆ`.
    - `OrderHistoryPanel` + `OrderDetailsModal`: lista zamówień, podgląd szczegółów (zawsze z zamaskowaną kartą, nigdy CVV!), modal szczegółów (dostępny z klawiatury, `Esc` zamyka, focus management), usuwanie zamówienia, pobieranie pliku `order_history_YYYYMMDD_HHMMSS.txt`.
    - `StatusBar`: terminalowy pasek statusu na dole ekranu (`role="status"` / `aria-live="polite"`).
  - Pełna responsywność (desktop + tablet + mobile) i przechodzący build.

#### Prompt do skopiowania (Etap 4):
```text
/goal
Przeczytaj @AGENTS.md oraz @MODERNIZATION_PLAN.md i wykonaj wyłącznie Etap 4 (Retro CRT UI i komponenty React).

Zadania:
1. Zbuduj system stylów Retro CRT w `src/styles/`:
   - Paleta zgodna z oryginalnym `main.py`: tło `#0b0f0b`, panele `#0f1a10`, tekst `#21f35a`, akcent `#00ff66`, ostrzeżenia `#ffb000`, błędy `#ff4d4d`, typografia monospace.
   - Opcjonalna warstwa CRT (subtelne scanlines `pointer-events: none`, delikatna poświata tekstu/obramowań) kontrolowana przez przełącznik `CRT FX` (zapisywany w ustawieniach) i wyłączana/łagodzona automatycznie przy `prefers-reduced-motion: reduce`.
   - Kontrast i stany `:focus-visible` dobrze widoczne dla nawigacji klawiaturą.
   - Responsywny layout CSS Grid (wielopanelowy terminal na desktopie, czytelny układ na ekranach mobilnych < 768px bez poziomego scrolla).
2. Zbuduj modularne, dostępne komponenty w `src/components/`:
   - `HeaderBar.tsx`: nagłówek terminala, przełącznik `CRT FX`, obsługa importu JSON (`<input type="file" accept=".json">`), eksportu JSON i przycisku resetu danych demo (z potwierdzeniem).
   - `CatalogPanel.tsx`: wyszukiwarka po nazwie, filtry kategorii (`Wszystkie` + kategorie z katalogu), kontrolka ilości, dodawanie produktu do koszyka.
   - `CartPanel.tsx`: lista w koszyku z przyciskami `-`, `+`, `USUŃ`, `WYCZYŚĆ`, wizualny pasek ASCII postępu do darmowej dostawy (próg 200,00 zł) oraz blok podsumowania (`Suma`, `Dostawa` / `GRATIS`, `DO ZAPŁATY`).
   - `CustomersPanel.tsx`: formularz dodania klienta (walidacja pól), lista klientów z wyborem aktywnego klienta (semantyczne przyciski/radio lub aria-selected) oraz usuwanie klienta.
   - `CheckoutPanel.tsx`: wybór metody płatności (`Karta kredytowa`, `PayPal`, `Bitcoin`), dynamiczne formularze z polami kontrolowanymi i czytelną walidacją błędów, podgląd równowartości w BTC dla Bitcoina, realizacja zamówienia przyciskiem `ZAMÓW`.
   - `OrderHistoryPanel.tsx` + `OrderDetailsModal.tsx`: lista zamówień, podgląd szczegółów i okno modalne (otwierane przyciskiem lub dwuklikiem, zamykane przez `Esc` i przycisk zamknięcia), usuwanie zamówienia, pobieranie pliku `.txt` wygenerowanego przez `exportTxt.ts`.
   - `StatusBar.tsx`: dolny terminalowy pasek komunikatów z `aria-live="polite"`.
3. Podłącz całość w `src/App.tsx` (obsługa stanu ładowania inicjalnego ze storage).
4. Uruchom `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` i upewnij się, że nie ma błędów.
```

---

### Etap 5: Obszerny zestaw testów (React Testing Library + Playwright E2E + Axe A11y)

- **Cel:** Pełne pokrycie testami komponentowymi, integracyjnymi UI oraz testami E2E w prawdziwej przeglądarce przeciwko produkcyjnemu buildowi (`vite preview`), włącznie z testem dostępności i responsywności.
- **Model:** Pro (High)
- **Kontekst:** **Nowa konwersacja** (po połowie można użyć `/compact` jeśli testy E2E będą wymagać kilku iteracji debugowania)
- **Definition of Done:**
  - Testy komponentowe w `tests/integration/ui/` (React Testing Library + `userEvent`) pokrywające interakcje w `CatalogPanel`, `CartPanel`, `CustomersPanel`, `CheckoutPanel`, `OrderHistoryPanel`, `OrderDetailsModal`, import/eksport JSON.
  - Testy E2E w `tests/e2e/shop.spec.ts` uruchamiane na `vite preview` sprawdzające:
    1. Ładowanie aplikacji i brak błędów konsoli / błędnych żądań sieciowych (404).
    2. Wyszukiwanie i filtrowanie katalogu, dodawanie i zmianę ilości w koszyku.
    3. Dynamiczną zmianę kosztu dostawy (`15.00` -> `GRATIS` po przekroczeniu `200.00 zł`).
    4. Tworzenie i wybór klienta, usuwanie klienta bez uszkodzenia istniejących zamówień.
    5. Walidację negatywną i pozytywną wszystkich 3 metod płatności (karta z błędnym Luhn/CVV vs poprawna karta i weryfikacja braku CVV w historii!, PayPal, Bitcoin).
    6. Zapis i odczyt zamówienia z IndexedDB po przeładowaniu strony (`page.reload()`).
    7. Otwarcie i zamknięcie (`Esc`) modala szczegółów zamówienia oraz pobranie pliku eksportu `.txt` (sprawdzenie nazwy i zawartości pobranego pliku!).
    8. Eksport i import backupu JSON.
    9. Przełącznik `CRT FX` oraz widok mobilny (np. `390x844` — brak poziomego overflow).
    10. Audyt dostępności `@axe-core/playwright` (zero naruszeń `critical` i `serious`).
  - Wszystkie testy jednostkowe, integracyjne i E2E przechodzą na 100%.

#### Prompt do skopiowania (Etap 5):
```text
/goal
Przeczytaj @AGENTS.md oraz @MODERNIZATION_PLAN.md i wykonaj wyłącznie Etap 5 (rozbudowane testy RTL + Playwright E2E + audyt dostępności axe-core).

Zadania:
1. Napisz testy komponentowe/integracyjne UI w `tests/integration/` przy użyciu Vitest + React Testing Library + `@testing-library/user-event`:
   - Filtrowanie/wyszukiwanie w katalogu i dodawanie produktów do koszyka.
   - Obsługa koszyka (+/-, usuwanie, czyszczenie, pasek darmowej dostawy).
   - Dodawanie i usuwanie klientów oraz walidacja pustych danych.
   - Błędy walidacji formularzy płatności (Karta/Luhn/CVV, PayPal, Bitcoin) i maskowanie numeru karty po zakupie.
   - Import/eksport JSON i generowanie pliku `.txt`.
2. Skonfiguruj `playwright.config.ts` tak, aby przed testami E2E automatycznie uruchamiał `npm run build && npm run preview` (z uwzględnieniem ścieżki bazowej `/Shopping_cart/`).
3. Napisz kompleksowe testy E2E w `tests/e2e/shop.spec.ts` obejmujące wszystkie 10 scenariuszy z Etapu 5 w `MODERNIZATION_PLAN.md`, w tym:
   - Weryfikację pobranego pliku `.txt` (`page.waitForEvent('download')` i odczyt treści).
   - Weryfikację persystencji po `page.reload()`.
   - Test viewportu mobilnego (`390x844`, brak poziomego scrolla).
   - Skan `@axe-core/playwright` (zero błędów critical/serious).
   - Zero błędów w `console.error` i `pageerror`, zero odpowiedzi HTTP >= 400.
4. Jeśli w testach lub A11y wyjdą drobne błędy w kodzie UI, napraw je od razu zgodnie ze standardem z `AGENTS.md`.
5. Uruchom kolejno: `npm run lint`, `npm run typecheck`, `npm run test:coverage` oraz `npm run test:e2e`. Wszystkie muszą przejść na zielono.
```

---

### Etap 6: CI/CD (GitHub Actions) i wdrożenie produkcyjne na GitHub Pages

- **Cel:** Automatyzacja testów i wdrażania na GitHub Pages oraz zweryfikowanie gotowości wdrożenia.
- **Model:** Pro (High)
- **Kontekst:** **Nowa konwersacja**
- **Definition of Done:**
  - Workflow `.github/workflows/ci-deploy.yml`:
    - Na każdy `push` i `pull_request` do `main`/`master`: instalacja zależności, `lint`, `typecheck`, `test:coverage`, instalacja Chromium dla Playwright, `test:e2e`, upload raportów testów w razie błędu, `npm run build`.
    - Job `deploy` (tylko przy `push` na główny branch po przejściu testów): `actions/configure-pages`, `actions/upload-pages-artifact`, `actions/deploy-pages` z odpowiednimi `permissions` (`pages: write`, `id-token: write`).
  - Zweryfikowany lokalny build pod ścieżką `/Shopping_cart/` (wszystkie assety JS/CSS/fonty/ikony ładują się z poprawnym prefixem `/Shopping_cart/`).
  - (Opcjonalnie, jeśli użytkownik ma podłączony remote i zalogowane `gh`): instrukcja lub włączenie GitHub Pages w ustawieniach repozytorium przez `gh api` / UI GitHuba.

#### Prompt do skopiowania (Etap 6):
```text
/goal
Przeczytaj @AGENTS.md oraz @MODERNIZATION_PLAN.md i wykonaj wyłącznie Etap 6 (CI/CD + konfiguracja GitHub Pages).

Zadania:
1. Utwórz workflow `.github/workflows/ci-deploy.yml`:
   - Wyzwalany na `push` (branch `master` i `main`) oraz `pull_request`, a także `workflow_dispatch`.
   - Job `verify`: checkout, setup Node 22 z cache npm, `npm ci`, `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm run test:coverage`, instalacja przeglądarek Playwright (`npx playwright install --with-deps chromium`), `npm run test:e2e`, `npm run build`.
   - Upload artefaktu `dist/` przez `actions/upload-pages-artifact@v3`.
   - Job `deploy` (`needs: verify`, tylko na push do domyślnego brancha `master`/`main`): `actions/deploy-pages@v4` z uprawnieniami `contents: read`, `pages: write`, `id-token: write`.
2. Zweryfikuj dokładnie `vite.config.ts`, `index.html`, `public/404.html` i ścieżki do assetów, aby w produkcji pod `https://phxphoenix.github.io/Shopping_cart/` nie było żadnych 404.
3. Przetestuj lokalnie cały pipeline weryfikacyjny dokładnie tak jak w CI (`npm run lint`, `npm run format:check`, `npm run typecheck`, `npm run test:coverage`, `npm run test:e2e`, `npm run build`).
4. Sprawdź status `gh auth status` (bez zmieniania zdalnych ustawień bez potwierdzenia, chyba że bezpieczne odpytanie konfiguracji repo) i wypisz dokładne kroki lub polecenie `gh` do włączenia `GitHub Pages -> Source: GitHub Actions` w repozytorium, jeśli jeszcze nie jest włączone.
```

---

### Etap 7: Aktualizacja dokumentacji i końcowy audyt

- **Cel:** Kompletna, prawdziwa i nowoczesna dokumentacja projektu odzwierciedlająca nowy stack, architekturę, testy i deploy na GitHub Pages.
- **Model:** Flash lub Pro (High)
- **Kontekst:** Kontynuacja po Etapie 6 lub Nowa konwersacja
- **Definition of Done:**
  - `README.md` zaktualizowany (opis projektu, link demo GitHub Pages, zrzuty/opis motywu retro, architektura, wymagania, uruchamianie lokalne, pełna lista komend testowych, opis importu `data.json` i eksportu `.txt`, wzmianka o `legacy/`).
  - `ARCHITECTURE.md` opisujący model danych w groszach, bezpieczeństwo płatności, warstwę IndexedDB i decyzje architektoniczne.
  - `CHANGELOG.md` dokumentujący przejście z v1 (Python Tkinter/FastAPI) na v2 (React/TS/Vite SPA + GitHub Pages).
  - Końcowy przebieg wszystkich testów i checków po ostatnich zmianach.

#### Prompt do skopiowania (Etap 7):
```text
/goal
Przeczytaj @AGENTS.md oraz @MODERNIZATION_PLAN.md i wykonaj wyłącznie Etap 7 (dokumentacja + końcowy audyt).

Zadania:
1. Zaktualizuj `README.md` (w języku polskim, spójnie z dotychczasowym stylem repozytorium):
   - Opis aplikacji Retro Shopping Cart v2.0 i funkcji (katalog, koszyk z progiem darmowej dostawy 200 PLN, klienci, 3 metody płatności z walidacją i maskowaniem kart, historia zamówień, eksport ASCII `.txt`, import/eksport `data.json`, tryb CRT FX).
   - Link do wersji produkcyjnej na GitHub Pages (`https://phxphoenix.github.io/Shopping_cart/`).
   - Instrukcja uruchomienia lokalnego (`npm ci`, `npm run dev`), builda i testów (`test`, `test:coverage`, `test:e2e`, `lint`, `typecheck`).
   - Informacja o zarchiwizowanym kodzie v1 w katalogu `legacy/`.
2. Utwórz `ARCHITECTURE.md` opisujący:
   - Strukturę folderów (`domain/`, `storage/`, `store/`, `components/`).
   - Model groszy (`Cents`), reguły bezpieczeństwa płatności (brak CVV w pamięci trwałej), persystencję IndexedDB i kompatybilność z `data.json`.
3. Utwórz `CHANGELOG.md` z podsumowaniem zmian między wersją v1.0 a v2.0.
4. Przeprowadź końcowy audyt całego repozytorium: sprawdź czy nie zostały żadne nieużywane pliki, sekrety, logi `console.log` ani błędy, oraz uruchom pełny zestaw checków (`npm run lint`, `npm run format:check`, `npm run typecheck`, `npm run test:coverage`, `npm run test:e2e`, `npm run build`).
```

---

## 5. Szybka checklista przed startem (dla Ciebie)

1. W ustawieniach Antigravity (**Settings → General**) upewnij się, że **Permission Preset** jest ustawione na **`Turbo`**, oraz przestaw **Plan Review Policy** z `Always Ask` na tryb bez ręcznego potwierdzania. W razie potrzeby sprawdź też **Tool Permissions** i **Network Access Rules**.
2. Otwórz **nową konwersację** w tym workspace.
3. Wklej prompt **Etapu 0** i pozwól agentowi pracować do zakończenia.
4. Po każdym większym bloku (szczególnie przed Etapem 2, 4, 5 i 6) otwieraj **nową konwersację** i wklejaj prompt kolejnego etapu — wszystko, czego agent potrzebuje, jest już w `MODERNIZATION_PLAN.md`, `AGENTS.md` i kodzie w repozytorium.

---

## 6. Tryb One-Shot (wszystkie etapy 0–7 ciągiem bez ingerencji użytkownika)

Jeśli chcesz uruchomić cały projekt **jednym promptem** (bez ręcznego przełączania etapów i bez ręcznego uruchamiania testów), zastosuj wzorzec **Orkiestrator + świeże subagenty per etap**:
- Główna rozmowa pełni rolę **Orkiestratora** (pilnuje kolejności etapów, bramek testowych i przekazuje kontrolę).
- Każdy etap wykonuje **świeży subagent** (`invoke_subagent`), dzięki czemu okno kontekstowe się nie zapycha i nie wymaga ręcznego czyszczenia między etapami.
- Wszystkie testy (`lint`, `typecheck`, `Vitest`, `Playwright E2E`, `@axe-core/playwright`, `vite build`) wykonuje i naprawia sam agent.

### Warunki brzegowe przed uruchomieniem One-Shot (jednorazowo przed startem)
1. **Settings → General w Antigravity:**
   - `Permission Preset`: **`Turbo`** (albo zdefiniowane reguły w `Tool Permissions`).
   - `Network Access Rules`: upewnij się, że nie blokuje pobierania paczek (`npm install`, `npx playwright install chromium`).
   - `Plan Review Policy`: przestaw z `Always Ask` na tryb bez ręcznego potwierdzania (żeby agent nie zatrzymywał się po wygenerowaniu planu).
2. **Git / GitHub (opcjonalnie na koniec dla automatycznego deployu):**
   - Jeśli chcesz, aby agent na sam koniec również wypchnął zmiany i skonfigurował GitHub Pages, upewnij się wcześniej w terminalu, że `gh auth status` działa i token ma uprawnienia `repo` oraz `workflow`. Jeśli nie — agent bezpiecznie zatrzyma się na lokalnym commicie/branchu i wypisze gotową komendę `git push`.

### Master Prompt (One-Shot Orchestrator — Etapy 0–7)

```text
/goal
Przeczytaj @MODERNIZATION_PLAN.md i zrealizuj CAŁY projekt (Etapy 0–7) w pełni autonomicznie, ciągiem, bez przerywania na pytania do użytkownika.

Zasady orkiestracji (BARDZO WAŻNE):
1. Pracujesz jako Orkiestrator. Aby zachować czysty kontekst i najwyższą jakość kodu, NIE pisz kodu wszystkich etapów bezpośrednio w tym wątku — dla każdego etapu (od Etapu 0 do Etapu 7 po kolei) wywołaj `invoke_subagent` (typ `self`), przekazując mu dokładną instrukcję danego etapu z `MODERNIZATION_PLAN.md` oraz wymaganie przeczytania `AGENTS.md`.
2. Dobór modelu dla subagentów (`Model` w `invoke_subagent`):
   - Etap 0, Etap 1, Etap 7: `flash`
   - Etap 2, Etap 3, Etap 4, Etap 5, Etap 6: `pro`
3. Egzekwowanie testów i bramek jakości (użytkownik nie uruchamia testów ręcznie!):
   - Każdy subagent przed zakończeniem swojego etapu MUSI uruchomić odpowiednie checki (`npm run lint`, `npm run typecheck`, `npm run test` / `test:coverage`, `npm run test:e2e`, `npm run build`) i naprawić wszelkie błędy aż do pełnego sukcesu.
   - Gdy subagent zakończy etap, zweryfikuj w jego raporcie wyniki komend; jeśli czegoś brakuje lub testy nie przeszły w pełni, wyślij mu `send_message`, aby dokończył i naprawił usterki przed przejściem do kolejnego etapu.
4. Weryfikacja wizualna po Etapie 5/6:
   - Uruchom lokalnie `npm run preview` jako daemon (`IsDaemon: true`), a następnie użyj wbudowanego subagenta `browser`, aby otworzyć aplikację w przeglądarce, sprawdzić motyw Retro CRT, przetestować dodanie produktu do koszyka i zamknąć proces serwera po sprawdzeniu.
5. Bezpieczeństwo Git / GitHub:
   - Pracuj na nowym branchu roboczym (np. `modernization/v2`) z czytelnymi commitami po każdym etapie.
   - NIE wykonuj `git push` ani nie modyfikuj zdalnych ustawień GitHub, jeśli nie masz potwierdzonego działającego `gh auth status` z odpowiednimi uprawnieniami lub jeśli napotkasz błąd autoryzacji — w takim wypadku zakończ wszystkie testy i build lokalnie i podaj użytkownikowi dokładne komendy końcowe do pusha i włączenia GitHub Pages.
6. Na sam koniec przedstaw zwięzłe podsumowanie: listę wykonanych etapów, realne wyniki wszystkich uruchomionych testów i checków oraz ewentualne kroki finalne po stronie GitHuba.
```

