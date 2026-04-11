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

## Dane
- `data.json` tworzy się automatycznie przy zapisie klientów/zamówień.
- pliki eksportu historii mają nazwę `order_history_YYYYMMDD_HHMMSS.txt`.
