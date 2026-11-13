# Shopping Cart (Retro CRT v2.0)

[![CI/CD Pipeline](https://github.com/phxphoenix/Shopping_cart/actions/workflows/ci-deploy.yml/badge.svg)](https://github.com/phxphoenix/Shopping_cart/actions/workflows/ci-deploy.yml)
[![Wersja produkcyjna](https://img.shields.io/badge/demo-GitHub%20Pages-00ff66?style=flat&logo=github)](https://phxphoenix.github.io/Shopping_cart/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7%20Strict-blue?logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.0-61dafb?logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6.1-646cff?logo=vite)](https://vitejs.dev/)
[![Testy](https://img.shields.io/badge/vitest%20%7C%20playwright-203%20unit%20%2B%2010%20e2e-brightgreen)](https://vitest.dev/)

Nowoczesna, w pełni statyczna aplikacja e-commerce typu **Client-First SPA** utrzymana w surowym klimacie **zielonego terminala kineskopowego (Retro CRT)**. Aplikacja stanowi kompletną modernizację (v2.0) pierwotnego projektu desktopowego Tkinter / webowego FastAPI z języka Python, przeniesioną w całości do architektury przeglądarkowej w oparciu o React 19, TypeScript oraz Vite, serwowaną bezpośrednio z GitHub Pages bez konieczności utrzymywania zewnętrznego serwera backendowego.

Aplikacja łączy klimat komputerów mainframe i cyberdecków lat 80. z rygorystycznymi standardami nowoczesnej inżynierii oprogramowania: ściśle typowaną domeną na liczbach całkowitych w groszach, higieną bezpieczeństwa płatności PCI-DSS, odporną persystencją w IndexedDB oraz pełną dostępnością WCAG AA.

---

## 🌐 Wersja demonstracyjna (Produkcja)

Aplikacja jest automatycznie budowana i wdrażana na platformę GitHub Pages:

👉 **[https://phxphoenix.github.io/Shopping_cart/](https://phxphoenix.github.io/Shopping_cart/)**

---

## 🕹️ Główne funkcjonalności

```text
+---------------------------------------------------------------------------------------+
|  SHOPPING CART // TERMINAL v2.0                  [CRT FX: ON] [IMPORT] [EXPORT] [DEMO]|
+---------------------------------------------------------------------------------------+
| // KATALOG PRODUKTÓW      | // KOSZYK (PRÓG 200 ZŁ)   | // KASA & PŁATNOŚĆ            |
| - Szukaj po nazwie i SKU  | - Regulacja ilości (+/-)  | - Karta (Luhn + maskowanie)   |
| - Filtry kategorii        | - Pasek darmowej dostawy  | - PayPal (walidacja e-mail)   |
| - Dodawanie do koszyka    | - Suma + Dostawa / GRATIS | - Bitcoin (Base58/Bech32)     |
+---------------------------+---------------------------+-------------------------------+
| // BAZA KLIENTÓW          | // HISTORIA ZAMÓWIEŃ                                      |
| - Dodawanie i wybór       | - Lista zamówień, podgląd modala, usuwanie pozycji        |
| - Bezpieczne usuwanie     | - Eksport raportu ASCII: order_history_YYYYMMDD_HHMMSS.txt|
+---------------------------------------------------------------------------------------+
| SYSTEM READY > Wszystkie moduły załadowane.                                           |
+---------------------------------------------------------------------------------------+
```

### 1. Katalog produktów z wyszukiwarką i filtrami
- Zachowanie oryginalnych 5 produktów z wersji v1 (Laptop 3499,99 zł, Słuchawki 199,99 zł, Koszulka 79,99 zł, Plecak 149,99 zł, Książka Python 59,99 zł) oraz rozszerzenie o retro hardware (Monitor CRT 17", Klawiatura Mechaniczna Clicky).
- Błyskawiczne wyszukiwanie pełnotekstowe po nazwie oraz kodzie SKU.
- Filtrowanie po kategoriach (`Wszystkie`, `Elektronika`, `Odzież`, `Akcesoria`, `Edukacja`, `Retro Hardware`).
- Wybór ilości przed dodaniem oraz walidacja stanów magazynowych.

### 2. Koszyk oparty o całkowitoliczbowy model groszy (`Cents`)
- Wszystkie obliczenia finansowe (ceny, sumy częściowe, koszty dostawy, rabaty) wykonywane są wyłącznie na liczbach całkowitych w groszach (`integer Cents`), co całkowicie eliminuje błędy zmiennoprzecinkowe IEEE 754 znane z JavaScript (`0.1 + 0.2 !== 0.3`).
- **Próg darmowej dostawy:** `200,00 zł` (20 000 groszy).
- **Koszt dostawy poniżej progu:** `15,00 zł` (1 500 groszy).
- Dynamiczny terminalowy pasek postępu informujący użytkownika o dokładnej kwocie brakującej do darmowej wysyłki.
- Pełna kontrola zawartości: zmiana ilości (`+` / `-`), usuwanie pozycji oraz czyszczenie koszyka.

### 3. Bezpieczne zarządzanie bazą klientów
- Dodawanie klientów z walidacją imienia i nazwiska oraz formatu adresu e-mail przez schematy Zod.
- Szybki wybór aktywnego klienta do bieżącego zamówienia.
- **Bezpieczne usuwanie klienta:** usunięcie klienta z listy nie niszczy historii zamówień — każde zrealizowane zamówienie przechowuje niezależny snapshot danych klienta z momentu zakupu.

### 4. Kasa i 3 metody płatności (PCI-DSS Hygiene)
- **Karta kredytowa:**
  - Walidacja 16-cyfrowego numeru karty algorytmem Luhna.
  - Sprawdzenie terminu ważności (`MM/RR` nie starsza niż bieżący miesiąc).
  - Weryfikacja formatu 3-4 cyfrowego kodu CVV/CVC.
  - **PCI-DSS Hygiene:** kod CVV weryfikowany jest **wyłącznie w ulotnej pamięci podręcznej formularza**. Kod CVV **nigdy** nie jest zapisywany w `Order`, IndexedDB, `localStorage`, kopiach `data.json` ani raportach `.txt`. Pełny numer karty jest natychmiast maskowany do postaci `**** **** **** 1234`.
- **PayPal:**
  - Walidacja formatu adresu e-mail konta PayPal.
- **Bitcoin:**
  - Walidacja adresów portfela Bitcoin w formatach Base58 (rozpoczynających się od `1` lub `3`) oraz natywnych Bech32 SegWit (`bc1...`).
  - Podgląd dynamicznego przelicznika PLN na BTC w czasie rzeczywistym.

### 5. Historia zamówień i raporty ASCII `.txt`
- Przegląd wszystkich złożonych zamówień w terminalowej tabeli.
- Dedykowany modal szczegółów zamówienia z pełną dostępnością (otwierany z klawiatury, zamykany klawiszem `Esc` lub przyciskiem).
- Możliwość usuwania pojedynczych zamówień.
- **Eksport raportu do pliku ASCII `.txt`:** generowanie pliku o nazwie `order_history_YYYYMMDD_HHMMSS.txt` w klasycznym formacie tabeli retro terminala (dokładnie tak jak w pierwotnej wersji `main.py`).

### 6. Trwałość danych (IndexedDB) oraz kompatybilność z legacy v1
- Podstawowa persystencja w przeglądarce za pośrednictwem biblioteki `idb-keyval` (IndexedDB).
- Automatyczny, bezpieczny fallback do `localStorage` w środowiskach bez wsparcia IndexedDB (np. tryb incognito w starszych przeglądarkach, sandboxy).
- Wersjonowanie schematu danych (`version: 2`) z pełną walidacją Zod przy każdym odczycie.
- **Pełna kompatybilność wsteczna z `data.json`:**
  - Import i eksport kopii zapasowej w formacie JSON z poziomu nagłówka aplikacji.
  - Funkcja migracyjna `parseLegacyOrCurrentBackup` pozwala zaimportować historyczny plik `data.json` ze starego klienta Tkinter v1. Ceny w formacie `float` są automatycznie konwertowane na grosze, numery kart są maskowane, a ewentualne historyczne pola CVV są bezpowrotnie usuwane.
- Przycisk szybkiego resetu bazy do bezpiecznych danych demonstracyjnych (`RESET DEMO`).

### 7. Motyw Retro CRT i dostępność WCAG AA
- Zielona paleta luminoforu (`#21f35a`, `#00ff66`) na głębokim tle terminalowym (`#0b0f0b`, `#0f1a10`).
- Efekty scanlines, poświaty tekstu i winiety kineskopowej z możliwością natychmiastowego wyłączenia przełącznikiem `[CRT FX: ON/OFF]` (stan persystowany w ustawieniach).
- Automatyczne wygaszanie/łagodzenie animacji i efektów przy włączonej w systemie opcji `@media (prefers-reduced-motion: reduce)`.
- W pełni dostępny pasek stanu `StatusBar` na dole ekranu (`role="status"`, `aria-live="polite"`).
- Zero naruszeń critical i serious w audycie dostępności `@axe-core/playwright`.
- W pełni responsywny layout CSS Grid/Flexbox przystosowany do ekranów desktopowych, tabletów oraz smartfonów (`< 768px`) bez poziomego przewijania.

---

## 🛠️ Wymagania systemowe

- **Node.js:** wersja 20.x lub 22.x LTS (zalecana 22.x)
- **Menedżer pakietów:** npm 10.x lub nowszy
- **Wspierane przeglądarki:** Chrome/Chromium, Firefox, Safari, Edge (z obsługą ES Modules i IndexedDB)

---

## 🚀 Uruchomienie lokalne

1. **Sklonuj repozytorium i przejdź do katalogu projektu:**
   ```bash
   git clone https://github.com/phxphoenix/Shopping_cart.git
   cd Shopping_cart
   ```

2. **Zainstaluj zależności projektu:**
   ```bash
   npm ci
   ```

3. **Uruchom lokalny serwer deweloperski Vite:**
   ```bash
   npm run dev
   ```
   Aplikacja otworzy się pod adresem: `http://localhost:5173/Shopping_cart/`

4. **Budowanie wersji produkcyjnej:**
   ```bash
   npm run build
   ```
   Zbudowane statyczne assety trafią do katalogu `dist/` ze skonfigurowaną ścieżką bazową `/Shopping_cart/`.

5. **Podgląd wersji produkcyjnej lokalnie:**
   ```bash
   npm run preview
   ```
   Serwer podglądu uruchomi się domyślnie pod adresem: `http://localhost:4173/Shopping_cart/`

---

## 🧪 Zestaw testów i kontrola jakości

Wszystkie skrypty jakości są zintegrowane w pipeline CI/CD GitHub Actions:

```bash
# 1. Statyczna analiza kodu ESLint
npm run lint

# 2. Weryfikacja formatowania Prettier
npm run format:check

# 3. Weryfikacja typów TypeScript (zero błędów kompilatora)
npm run typecheck

# 4. Uruchomienie testów jednostkowych i integracyjnych Vitest
npm test

# 5. Uruchomienie testów z generowaniem raportu pokrycia kodu (v8)
npm run test:coverage

# 6. Uruchomienie kompleksowych testów End-to-End Playwright (wraz ze skanem axe-core)
npm run test:e2e
```

### Wyniki pokrycia i testów:
- **Testy jednostkowe i integracyjne (Vitest):** 203 testy w 25 plikach testowych (100% zaliczonych).
- **Pokrycie warstwy domenowej (`src/domain/`):** > 98% linii kodu.
- **Pokrycie całego projektu:** > 96% linii kodu.
- **Testy E2E (Playwright + Axe A11y):** 10 scenariuszy kompleksowych testujących m.in. zakupy, persystencję, obsługę modala, pobieranie plików `.txt`, import/eksport JSON, widok mobilny oraz zgodność z WCAG AA.

---

## 🏛️ Struktura projektu

Szczegółowy opis architektury systemu znajduje się w pliku [ARCHITECTURE.md](ARCHITECTURE.md).

```text
Shopping_cart/
├── .github/
│   └── workflows/
│       └── ci-deploy.yml          # Pipeline CI/CD GitHub Actions (verify + deploy)
├── legacy/                        # Zarchiwizowany kod pierwotnej wersji v1 (Python)
│   ├── main.py                    # Aplikacja desktopowa Tkinter v1
│   ├── cart.py, products.py       # Oryginalna logika koszyka i produktów
│   ├── payments.py                # Oryginalne metody płatności v1
│   └── web/                       # Aplikacja FastAPI + SQLite/Neon v1
├── public/
│   ├── 404.html                   # Skrypt przekierowujący SPA dla GitHub Pages
│   └── favicon.svg                # Wektorowa retro ikona terminala
├── src/
│   ├── components/                # Dostępne komponenty UI (React 19)
│   │   ├── CatalogPanel.tsx       # Panel katalogu z wyszukiwaniem i filtrami
│   │   ├── CartPanel.tsx          # Panel koszyka z paskiem darmowej dostawy
│   │   ├── CustomersPanel.tsx     # Panel klientów i bezpiecznego usuwania
│   │   ├── CheckoutPanel.tsx      # Formularz kasy i 3 metody płatności
│   │   ├── OrderHistoryPanel.tsx  # Tabela historii zamówień i eksport .txt
│   │   ├── OrderDetailsModal.tsx  # Modal szczegółów z obsługą klawiatury
│   │   ├── HeaderBar.tsx          # Nagłówek systemowy z przełącznikiem CRT FX
│   │   └── StatusBar.tsx          # Terminalowy pasek statusu (aria-live)
│   ├── domain/                    # Czysta domena biznesowa (0 zależności DOM/React)
│   │   ├── money.ts               # Typ Cents i arytmetyka w groszach
│   │   ├── catalog.ts             # Katalog produktów i wyszukiwanie
│   │   ├── cart.ts                # Obliczenia koszyka i progi dostawy
│   │   ├── payment.ts             # Luhn, walidacja i maskowanie kart (PCI-DSS)
│   │   ├── exportTxt.ts           # Generator raportu tabelarycznego ASCII .txt
│   │   └── schemas.ts             # Schematy Zod i migracja legacy data.json
│   ├── storage/                   # Warstwa persystencji (IndexedDB + fallback)
│   │   ├── adapter.ts             # Interfejs StorageAdapter
│   │   ├── indexedDbAdapter.ts    # Implementacja idb-keyval + localStorage
│   │   └── seed.ts                # Sanityzowane dane demonstracyjne
│   ├── store/                     # Globalny stan aplikacji (Zustand)
│   │   └── useShopStore.ts        # Reaktywny store z auto-persystencją
│   ├── styles/                    # System stylów Retro CRT
│   │   ├── tokens.css             # Zmienne kolorów, typografii i poświaty
│   │   ├── crt.css                # Scanlines, winieta i prefers-reduced-motion
│   │   └── layout.css             # Responsywny CSS Grid i panele terminala
│   ├── utils/                     # Pomocnicze funkcje (pobieranie plików)
│   ├── App.tsx                    # Główny kontener aplikacji i boot screen
│   └── main.tsx                   # Punkt wejścia React DOM
├── tests/
│   ├── e2e/                       # Testy Playwright E2E + Axe A11y
│   ├── integration/               # Testy integracyjne Store i UI RTL
│   └── unit/                      # Testy jednostkowe domeny, komponentów i storage
├── AGENTS.md                      # Twarde reguły inżynieryjne dla agentów AI
├── ARCHITECTURE.md                # Kompletny opis architektury v2.0
├── CHANGELOG.md                   # Historia zmian w standardzie Keep a Changelog
└── vite.config.ts                 # Konfiguracja Vite ze ścieżką /Shopping_cart/
```

---

## 📜 Zarchiwizowany kod v1 (Python)

Kod pierwotnej wersji aplikacji został zachowany w celach referencyjnych w katalogu [`legacy/`](legacy/):
- `legacy/main.py` – aplikacja desktopowa Tkinter z motywem retro,
- `legacy/cart.py`, `legacy/products.py`, `legacy/payments.py` – moduły pomocnicze,
- `legacy/web/` – eksperymentalny backend FastAPI z bazą SQLite / Postgres Neon.

---

## 📄 Licencja

Projekt udostępniany na warunkach licencji open-source (MIT). Szczegóły w plikach źródłowych.
