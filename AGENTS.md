# Reguły Projektu dla Agentów AI (AGENTS.md)

Projekt: **Shopping Cart (Retro CRT v2.0)**  
Repozytorium docelowe: `https://github.com/phxphoenix/Shopping_cart`  
Branch roboczy: `modernization/v2`  
Główny plan wykonawczy: [MODERNIZATION_PLAN.md](file:///c:/Users/phxpo/OneDrive/Dokumenty/Dev/Shopping%20cart/MODERNIZATION_PLAN.md)

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

## 4. Środowisko Wdrożeniowe i Hosting

- **Platforma produkcyjna:** GitHub Pages (statyczny hosting 100% Client-Side).
- **Ścieżka bazowa aplikacji:** `base: '/Shopping_cart/'` w `vite.config.ts`.
- **Routing:** Hash routing lub obsługa przez `public/404.html` ze skryptem przekierowującym.
- **Trwałość danych:** `IndexedDB` za pośrednictwem biblioteki `idb-keyval` z bezpiecznym fallbackiem do `localStorage` oraz mechanizmem wersjonowania schematu danych.
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

- Wszystkie prace rozwojowe v2 są prowadzone na dedykowanym branchu roboczym: `modernization/v2`.
- Po każdym etapie należy utworzyć atomowy, czytelny commit opisujący wprowadzone zmiany wg konwencji Conventional Commits (np. `feat(domain): ...`, `test: ...`, `chore: ...`).
- **Bezwzględny zakaz wykonywania `git push`** do repozytorium zdalnego bez wyraźnego polecenia użytkownika.
- Pierwotny kod Pythona v1 (Tkinter, FastAPI, bazy SQLite) pozostaje zarchiwizowany w katalogu `legacy/` jako punkt odniesienia.
