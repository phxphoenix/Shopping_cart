import { useRef, useState, type ChangeEvent } from 'react';
import { useShopStore } from '@/store/useShopStore';
import { downloadTextFile } from '@/utils/download';

export interface HeaderBarProps {
  onOpenLoginModal?: () => void;
}

export function HeaderBar({ onOpenLoginModal }: HeaderBarProps = {}) {
  const {
    settings,
    toggleCrtFx,
    exportBackupJson,
    importBackupJson,
    resetDemoData,
    setStatus,
    isAdminAuthenticated,
    activeView,
    setActiveView,
    logoutAdmin,
  } = useShopStore();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isConfirmingReset, setIsConfirmingReset] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setIsProcessing(true);
    try {
      const text =
        typeof file.text === 'function'
          ? await file.text()
          : await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = () => reject(reader.error);
              reader.readAsText(file);
            });
      const result = await importBackupJson(text);
      if (!result.success) {
        setStatus(`BŁĄD IMPORTU: ${result.message}`, 'error');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setStatus(`BŁĄD ODCZYTU PLIKU: ${message}`, 'error');
    } finally {
      setIsProcessing(false);
      // Reset input value so the same file can be re-selected if needed
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleExportClick = () => {
    try {
      const jsonContent = exportBackupJson();
      const timestamp = new Date()
        .toISOString()
        .slice(0, 19)
        .replace(/[-:]/g, '')
        .replace('T', '_');
      const filename = `shopping_cart_backup_${timestamp}.json`;
      downloadTextFile(filename, jsonContent, 'application/json;charset=utf-8');
      setStatus(`WYEKSPORTOWANO KOPIĘ ZAPASOWĄ: ${filename}`, 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setStatus(`BŁĄD EKSPORTU JSON: ${message}`, 'error');
    }
  };

  const handleResetConfirm = async () => {
    setIsProcessing(true);
    try {
      await resetDemoData();
      setIsConfirmingReset(false);
    } finally {
      setIsProcessing(false);
    }
  };

  const crtFxActive = settings.crtFx;

  return (
    <header className="retro-header" role="banner">
      <div className="retro-header-brand">
        <h1 className="retro-header-title">
          SHOPPING CART // TERMINAL v2.0
          <span className="terminal-cursor" aria-hidden="true" />
        </h1>
      </div>

      <div className="retro-header-actions" role="toolbar" aria-label="Narzędzia systemowe">
        {/* Przełącznik CRT FX */}
        <button
          type="button"
          onClick={toggleCrtFx}
          className={crtFxActive ? 'btn-active' : ''}
          aria-pressed={crtFxActive}
          title="Przełącz efekty kineskopu CRT (scanlines i poświatę)"
        >
          CRT FX: {crtFxActive ? 'ON' : 'OFF'}
        </button>

        {/* Panel Admina / Wylogowanie */}
        {isAdminAuthenticated ? (
          <>
            <button
              type="button"
              onClick={() => setActiveView(activeView === 'admin' ? 'shop' : 'admin')}
              className={activeView === 'admin' ? 'btn-active' : ''}
              title={
                activeView === 'admin'
                  ? 'Powróć do widoku sklepu'
                  : 'Przełącz na panel administratora'
              }
            >
              {activeView === 'admin' ? 'WIDOK: SKLEP' : 'PANEL ADMINA'}
            </button>
            <button
              type="button"
              onClick={() => void logoutAdmin()}
              className="btn-danger"
              title="Wyloguj z sesji administratora"
            >
              WYLOGUJ ADMINA
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onOpenLoginModal}
            title="Otwórz autoryzację administratora"
          >
            PANEL ADMINA
          </button>
        )}

        {/* Import JSON */}
        <label htmlFor="import-json-input" className="sr-only">
          Wybierz plik JSON do importu
        </label>
        <input
          id="import-json-input"
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          onChange={handleFileChange}
          style={{ display: 'none' }}
          tabIndex={-1}
          aria-hidden="true"
        />
        <button
          type="button"
          onClick={handleImportClick}
          disabled={isProcessing}
          title="Zaimportuj bazę z pliku JSON (v2 lub legacy data.json)"
        >
          IMPORT JSON
        </button>

        {/* Eksport JSON */}
        <button
          type="button"
          onClick={handleExportClick}
          disabled={isProcessing}
          title="Pobierz kopię zapasową bazy danych w formacie JSON"
        >
          EXPORT JSON
        </button>

        {/* Reset Demo Data z bezpiecznym potwierdzeniem dwuetapowym */}
        {!isConfirmingReset ? (
          <button
            type="button"
            onClick={() => setIsConfirmingReset(true)}
            disabled={isProcessing}
            className="btn-warning"
            title="Przywróć początkowe dane demonstracyjne"
          >
            RESET DEMO
          </button>
        ) : (
          <div
            style={{ display: 'inline-flex', gap: '0.35rem' }}
            role="group"
            aria-label="Potwierdzenie resetu bazy"
          >
            <button
              type="button"
              onClick={handleResetConfirm}
              disabled={isProcessing}
              className="btn-danger"
            >
              POTWIERDŹ RESET?
            </button>
            <button
              type="button"
              onClick={() => setIsConfirmingReset(false)}
              disabled={isProcessing}
            >
              ANULUJ
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
