# Reguły Projektu dla Agentów AI (AGENTS.md)

Projekt: **Shopping Cart (Retro CRT v3.0)**  
Repozytorium docelowe: `https://github.com/phxphoenix/Shopping_cart`  
Branch roboczy: `feat/admin-catalog-v3`  
Główny plan wykonawczy: [ADMIN_CATALOG_PLAN.md](file:///c:/Users/phxpo/OneDrive/Dokumenty/Dev/Shopping%20cart/ADMIN_CATALOG_PLAN.md) (plan bazowy v2: [MODERNIZATION_PLAN.md](file:///c:/Users/phxpo/OneDrive/Dokumenty/Dev/Shopping%20cart/MODERNIZATION_PLAN.md))

Każdy agent AI pracujący w tym repozytorium **musi bezwzględnie przestrzegać** poniższych twardych reguł inżynieryjnych, standardów bezpieczeństwa i procedur jakości.

---

## 1. Standardy Kodu i TypeScript

- **Ścisły TypeScript:**
  - Wymuszone flagi kompilatora: `"strict": true`, `"noUncheckedIndexedAccess": true`.
  - **Bezwzględny zakaz stosowania typu `any`** bez wyraźnego, udokumentowanego uzasadnienia. Używaj precyzyjnych typów generycznych, unii dyskryminacyjnych lub `unknown` z walidacją typów wąskich (type guards / Zod).
- **Czysta architektura domenowa:**
  - Kod w `src/domain/` musi być w 100% niezależny od Reacta, przeglądarki i operacji DOM (brak importów z `react`, brak odwołań do `window`, `document`, `localStorage`, `indexedDB`).
  - Walidacja danych wejściowych i granic systemu musi opierać się o bibliotekę **Zod**.

---

## 2. Finanse, Arytmetyka i Bezpieczeństwo Płatności

- **Arytmetyka wyłącznie całkowitoliczbowa w groszach (`Cents`):**
  - **Zakaz używania typu zmiennoprzecinkowego (`float` / `number` ułamkowy)** do kalkulacji kwot pieniężnych (cen, rabatów, kosztów dostawy, sum częściowych i całkowitych).
  - Wszystkie kwoty wewnętrznie w domenie, logice i pamięci masowej są reprezentowane jako liczby całkowite w groszach (`integer Cents`, np. `20000` = 200,00 zł, `1500` = 15,00 zł).
  - Konwersja na PLN ze starego formatu `float` (np. import legacy `data.json`) musi odbywać się przez zaokrąglenie `Math.round(pln * 100)`.
  - Formatowanie do formatu walutowego (`formatPLN`) następuje wyłącznie w warstwie prezentacji.
- **Parametry dostawy:**
  - Próg darmowej dostawy: `20000` groszy (200,00 zł).
  - Koszt dostawy poniżej progu: `1500` groszy (15,00 zł).
  - Informowanie użytkownika o kwocie brakującej do darmowej dostawy (`amountToFreeDeliveryCents`).
- **Bezpieczeństwo danych kart płatniczych (PCI-DSS Hygiene):**
  - **Bezwzględny zakaz zapisywania, logowania, eksportowania lub zwracania kodów CVV/CVC oraz pełnych numerów kart płatniczych.**
  - CVV jest weryfikowany wyłącznie w pamięci operacyjnej podczas walidacji formularza, po czym jest natychmiast odrzucany i nigdy nie trafia do modeli `Order`, `IndexedDB`, `localStorage`, `data.json` ani raportów `.txt`.
  - Numer karty po walidacji algorytmem Luhna musi być zanonimizowany do maski: `**** **** **** 1234` (lub `last4`).

---

## 3. Motyw Graficzny Retro CRT i UX

- **Paleta barw:**
  - Główne tło: `#0b0f0b`
  - Panele i kontenery: `#0f1a10`
  - Tekst terminalowy: `#21f35a`
  - Akcenty i aktywne elementy: `#00ff66`
  - Ostrzeżenia i alerty: `#ffb000`
  - Błędy i niepowodzenia: `#ff4d4d`
- **Typografia i stylistyka:**
  - Rodzina czcionek: Monospace (`Courier New`, `Fira Code`, `monospace`).
  - Ostre ramki i separatory inspirowane interfejsem ASCII/terminalowym.
  - Pasek statusu terminala na dole ekranu (`StatusBar`) z komunikatami systemowymi (`role="status"` / `aria-live="polite"`).
- **Efekty CRT FX:**
  - Opcjonalne scanlines i subtelny glow fosforu z możliwością wyłączenia przełącznikiem `CRT FX: ON/OFF` (stan persystowany w ustawieniach).
  - Automatyczne wyłączenie lub złagodzenie animacji/efektów przy `@media (prefers-reduced-motion: reduce)`.
- **Dostępność i responsywność:**
  - Zapewnienie pełnej nawigacji klawiaturą (`Tab`, `Enter`, `Space`, `Esc` do zamykania modali) oraz widocznych stanów `:focus-visible`.
  - Zgodność z WCAG AA (brak błędów krytycznych/poważnych w `@axe-core/playwright`).
  - Responsywny układ: dynamiczny terminal wielopanelowy na desktopie, czytelny układ jednokolumnowy/zakładkowy na mobile (< 768px bez poziomego scrolla).

---

## 4. Środowisko Wdrożeniowe i Hosting (v3.0)

- **Platforma produkcyjna:** Vercel (Hobby) + Neon Serverless Postgres (`@neondatabase/serverless` z leniwą inicjalizacją `getNeonSql()`, bez użycia `Proxy`), plus opcjonalny statyczny preview.
- **Ścieżka bazowa aplikacji:** Domyślnie `'/'` w `vite.config.ts` (`process.env.VITE_BASE_PATH ?? '/'`), z możliwością nadpisania zmienną środowiskową.
- **Architektura danych Dual-Mode:**
  - `NeonShopRepository`: wykorzystywana automatycznie w środowisku z obecną zmienną `DATABASE_URL` (produkcja/preview Vercel oraz `vercel dev`).
  - `InMemoryShopRepository`: wykorzystywana w testach jednostkowych, integracyjnych i środowisku lokalnym bez bazy danych (zapewnia 100% determinizm bez konieczności zewnętrznych usług w CI).
  - Na kliencie: synchronizacja stanu z API serwera (`/api/*`) wraz z lokalną pamięcią `IndexedDB` (`idb-keyval`) jako odpornym cache i fallbackiem offline.
- **Kompatybilność wsteczna:**
  - Obsługa importu i eksportu formatu `data.json` (zgodnego ze starym klientem Tkinter).
  - Eksport historii zamówień do pliku tekstowego ASCII `.txt` (`order_history_YYYYMMDD_HHMMSS.txt`) w formacie tabeli retro.

---

## 5. Bramki Jakości (Definition of Done per Etap)

Przed zakończeniem każdego etapu prac agent **musi** autonomicznie uruchomić i zweryfikować powodzenie następujących komend:
1. `npm run lint` — brak błędów lintera ESLint.
2. `npm run typecheck` — zero błędów kompilacji TypeScript (`tsc --noEmit`).
3. `npm run test` (lub `npm run test:coverage`) — 100% przechodzących testów jednostkowych i integracyjnych (dla warstwy `src/domain/` pokrycie >= 95%).
4. `npm run build` — poprawna kompilacja produkcyjna Vite bez warningów o brakujących assetach.
5. `npm run test:e2e` (od Etapu 5 włącznie) — wszystkie testy Playwright E2E oraz skan `@axe-core/playwright` przechodzą na zielono.

Jeśli którakolwiek z bramek zgłosi błąd, agent jest zobowiązany do natychmiastowej autonomicznej diagnozy i naprawy problemu przed zaraportowaniem ukończenia etapu.

---

## 6. Dyscyplina Git i Zarządzanie Wersjami

- Wszystkie prace rozwojowe v3 są prowadzone na dedykowanym branchu roboczym: `feat/admin-catalog-v3`.
- Po każdym etapie należy utworzyć atomowy, czytelny commit opisujący wprowadzone zmiany wg konwencji Conventional Commits (np. `feat(domain): ...`, `test: ...`, `chore: ...`).
- **Bezwzględny zakaz wykonywania `git push`** do repozytorium zdalnego bez wyraźnego polecenia użytkownika.
- Pierwotny kod Pythona v1 (Tkinter, FastAPI, bazy SQLite) pozostaje zarchiwizowany w katalogu `legacy/` jako punkt odniesienia.

---

## 7. Standardy Bezpieczeństwa, Katalogu i Danych Klientów (v3.0)

- **Bezpieczeństwo i Dostęp Administracyjny:**
  - Weryfikacja hasła odbywa się **wyłącznie na backendzie** (`/api/admin/login`) z wykorzystaniem bezpiecznego porównania stałoczasowego.
  - Sesja administracyjna jest utrzymywana za pomocą podpisanego kryptograficznie ciasteczka `HttpOnly` (`SameSite=Strict; Path=/`, HMAC-SHA256 z kluczem `ADMIN_SESSION_SECRET`, ważność 2h).
  - **Bezwzględny zakaz umieszczania hasła ani sekretu sesji admina w zmiennych klienckich `VITE_*`** lub w jakimkolwiek kodzie przekazywanym do przeglądarki.
- **Zarządzanie Katalogiem i Migracja Produktów:**
  - Struktura kategorii opiera się na dynamicznym modelu `Category` (`id`, `name`, `slug`, `description`, `isDefault`).
  - Gwarancja istnienia **nieusuwalnej kategorii domyślnej** (`cat-default` / `Ogólne`, `isDefault: true`).
  - **Automatyczna migracja produktów:** usunięcie kategorii posiadającej przypisane produkty automatycznie reasygnuje je do kategorii domyślnej (lub wybranej kategorii docelowej).
  - Zapewnienie funkcji **ręcznej i masowej migracji produktów** między kategoriami (`POST /api/categories/migrate`).
- **Ochrona Klientów i Prywatności (PII / Anty-spam):**
  - **Usunięcie akcji destrukcyjnych z widoku publicznego:** w publicznym komponencie `CustomersPanel` nie ma przycisku usuwania klientów. Usuwanie klientów (`DELETE /api/customers/:id`) jest dozwolone wyłącznie w Panelu Admina po poprawnej autoryzacji sesji.
  - **Ochrona PII:** publiczna lista klientów maskuje adresy e-mail (np. `j***i@example.com`).
  - **Unikalność e-maili:** system wymusza unikalność adresu e-mail (case-insensitive) i zwraca kod `409 Conflict` przy próbie ponownej rejestracji.
  - **Zabezpieczenie przed botami i nadużyciami:** formularz rejestracji zawiera niewidoczne pole **honeypot** (np. `companyWebsite`, blokujące rejestrację gdy zostanie wypełnione) oraz mechanizm **rate-limitingu** (np. max 5 rejestracji / 10 minut na IP/sesję z kodem `429 Too Many Requests`).
