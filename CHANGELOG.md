# Dziennik Zmian (Changelog)

Wszystkie istotne zmiany w projekcie **Shopping Cart** są dokumentowane w tym pliku.

Format opiera się na zasadach [Keep a Changelog](https://keepachangelog.com/pl/1.0.0/),
a projekt przestrzega [Semantycznego Wersjonowania (SemVer)](https://semver.org/lang/pl/).

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
