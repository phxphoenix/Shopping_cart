# Shopping Cart (Retro)

Aplikacja koszyka w stylu retro (Tkinter) z:
- katalogiem produktów
- koszykiem i płatnościami
- bazą `data.json` (klienci + historia zamówień)
- eksportem historii do pliku `.txt`

## Uruchomienie (Python)
1. Zainstaluj zależności (Tkinter jest w standardowej instalacji Pythona na Windows).
2. Uruchom:
   ```powershell
   python main.py
   ```

## Budowa pliku .exe
Wymaga PyInstaller:
```powershell
python -m pip install pyinstaller
pyinstaller --onefile --windowed main.py
```
Po buildzie `.exe` jest w `dist/main.exe`.

## Wersja web (FastAPI + Postgres/Neon)
Backend i prosty frontend znajdują się w `web/`.

### Uruchomienie lokalne
1. Wejdź do `web/`
2. Zainstaluj zależności:
   ```powershell
   pip install -r requirements.txt
   ```
3. (Opcjonalnie) ustaw `DATABASE_URL` na Neon/Postgres.
   - przykład w `web/.env.example`
4. Start:
   ```powershell
   uvicorn app.main:app --reload
   ```
5. Otwórz `http://127.0.0.1:8000`

Jeśli `DATABASE_URL` nie jest ustawione, aplikacja użyje lokalnej bazy `web/local.db` (SQLite).

## Dane
- `data.json` tworzy się automatycznie przy zapisie klientów/zamówień.
- pliki eksportu historii mają nazwę `order_history_YYYYMMDD_HHMMSS.txt`.
