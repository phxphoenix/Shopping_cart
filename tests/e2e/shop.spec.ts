import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Retro Shopping Cart v3.0 - E2E Suite', () => {
  test.beforeEach(async ({ page }) => {
    page.on('pageerror', (err) => {
      console.error(`[PAGE_ERROR] ${err.message}\n${err.stack}`);
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error' || msg.type() === 'warning') {
        console.log(`[CONSOLE_${msg.type().toUpperCase()}] ${msg.text()}`);
      }
    });
  });

  test('Scenario 1: Application loads under base path with 0 console errors, 0 page errors, and 0 HTTP >= 400 responses', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const failedResponses: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    page.on('response', (resp) => {
      if (resp.status() >= 400) {
        failedResponses.push(`${resp.status()} ${resp.url()}`);
      }
    });

    await page.goto('./');

    // Terminal brand header visible
    await expect(
      page.getByRole('heading', { name: /SHOPPING CART \/\/ TERMINAL v2\.0/i })
    ).toBeVisible();

    // All 5 terminal panels visible
    await expect(page.getByRole('heading', { name: /\/\/ KATALOG PRODUKTÓW/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /\/\/ KOSZYK/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /\/\/ BAZA KLIENTÓW/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /\/\/ KASA & PŁATNOŚĆ/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /\/\/ HISTORIA ZAMÓWIEŃ/i })).toBeVisible();
    await expect(page.getByRole('status')).toBeVisible();

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
    expect(failedResponses).toEqual([]);
  });

  test('Scenario 2: Catalog search and filtering, adding product, and changing quantity in cart', async ({
    page,
  }) => {
    await page.goto('./');
    await expect(
      page.getByRole('heading', { name: /SHOPPING CART \/\/ TERMINAL v2\.0/i })
    ).toBeVisible();

    const searchInput = page.getByRole('searchbox', { name: /Wyszukiwarka produktów/i });

    // Search by name: "Słuchawki"
    await searchInput.fill('Słuchawki');
    await expect(
      page.getByRole('heading', { name: /\/\/ KATALOG PRODUKTÓW \(1\)/i })
    ).toBeVisible();
    await expect(page.getByText('Słuchawki', { exact: true })).toBeVisible();
    await expect(page.getByText('Laptop', { exact: true })).not.toBeVisible();

    // Clear search via [X]
    await page.getByRole('button', { name: /Wyczyść pole wyszukiwania/i }).click();
    await expect(
      page.getByRole('heading', { name: /\/\/ KATALOG PRODUKTÓW \(8\)/i })
    ).toBeVisible();

    // Filter by category: "Retro Hardware"
    await page.getByRole('button', { name: /Retro Hardware/i }).click();
    await expect(
      page.getByRole('heading', { name: /\/\/ KATALOG PRODUKTÓW \(2\)/i })
    ).toBeVisible();
    await expect(page.getByText('Monitor CRT 17"', { exact: true })).toBeVisible();
    await expect(page.getByText('Klawiatura Mechaniczna Clicky', { exact: true })).toBeVisible();

    // Reset to "WSZYSTKIE"
    await page.getByRole('button', { name: /WSZYSTKIE/i }).click();
    await expect(
      page.getByRole('heading', { name: /\/\/ KATALOG PRODUKTÓW \(8\)/i })
    ).toBeVisible();

    // Add Laptop with quantity 2
    const laptopArticle = page.locator('article', { hasText: 'HW-LAPTOP-01' });
    await laptopArticle.getByRole('button', { name: /Zwiększ ilość dla Laptop/i }).click();
    await laptopArticle.getByRole('button', { name: /DODAJ ->/i }).click();

    // Verify in cart
    const cartPanel = page.locator('section', { hasText: '// KOSZYK' });
    await expect(cartPanel.getByText('Laptop', { exact: true })).toBeVisible();
    await expect(cartPanel.getByText('2', { exact: true })).toBeVisible();

    // Increment in cart
    await cartPanel.getByRole('button', { name: /Zwiększ ilość dla Laptop/i }).click();
    await expect(cartPanel.getByText('3', { exact: true })).toBeVisible();

    // Decrement in cart
    await cartPanel.getByRole('button', { name: /Zmniejsz ilość dla Laptop/i }).click();
    await expect(cartPanel.getByText('2', { exact: true })).toBeVisible();
  });

  test('Scenario 3: Dynamic delivery fee adjustment (15.00 PLN -> GRATIS above 200.00 PLN)', async ({
    page,
  }) => {
    await page.goto('./');
    await expect(
      page.getByRole('heading', { name: /SHOPPING CART \/\/ TERMINAL v2\.0/i })
    ).toBeVisible();

    // Clear cart if any pre-existing items
    const clearBtn = page.getByRole('button', { name: /WYCZYŚĆ/i });
    if (await clearBtn.isVisible()) {
      await clearBtn.click();
    }

    // Add 1x Koszulka (79.99 PLN < 200.00 PLN)
    const tshirtArticle = page.locator('article', { hasText: 'CL-TSHIRT-03' });
    await tshirtArticle.getByRole('button', { name: /DODAJ ->/i }).click();

    const cartPanel = page.locator('section', { hasText: '// KOSZYK' });

    // Subtotal < 200: delivery = 15.00 zł, total = 94.99 zł, missing = 120.01 zł
    await expect(cartPanel.getByText('15,00 zł')).toBeVisible();
    await expect(cartPanel.getByText('94,99 zł')).toBeVisible();
    await expect(cartPanel.getByText(/Brakuje: 120,01 zł/i)).toBeVisible();

    // Increment to 2x Koszulka (159.98 PLN < 200.00 PLN)
    await cartPanel.getByRole('button', { name: /Zwiększ ilość dla Koszulka/i }).click();
    await expect(cartPanel.getByText('15,00 zł')).toBeVisible();
    await expect(cartPanel.getByText(/Brakuje: 40,02 zł/i)).toBeVisible();

    // Increment to 3x Koszulka (239.97 PLN >= 200.00 PLN -> GRATIS!)
    await cartPanel.getByRole('button', { name: /Zwiększ ilość dla Koszulka/i }).click();
    await expect(cartPanel.getByText('0,00 zł (GRATIS)')).toBeVisible();
    await expect(cartPanel.getByText(/DARMOWA DOSTAWA AKTYWNA/i)).toBeVisible();
    await expect(cartPanel.getByText('239,97 zł').last()).toBeVisible();
  });

  test('Scenario 4: Customer registration, selection, and safe removal without corrupting orders (v3)', async ({
    page,
  }) => {
    await page.goto('./');
    await expect(
      page.getByRole('heading', { name: /SHOPPING CART \/\/ TERMINAL v2\.0/i })
    ).toBeVisible();

    const customersPanel = page.locator('section', { hasText: '// BAZA KLIENTÓW' });

    // Verify public panel: no delete button, masked emails, system info note
    await expect(
      customersPanel.getByText(
        /Usuwanie kont klientów jest dostępne wyłącznie dla uprawnionych sesji w Panelu Administracyjnym/i
      )
    ).toBeVisible();
    await expect(customersPanel.getByRole('button', { name: /^USUŃ$/i })).toHaveCount(0);
    await expect(customersPanel.getByRole('button', { name: /Usuń klienta/i })).toHaveCount(0);

    // Register new customer
    await page.getByLabel(/Imię i nazwisko:/i).fill('Piotr Zieliński');
    await page.getByLabel(/Adres e-mail:/i).fill('piotr.zielinski@kadra.pl');
    await page.getByRole('button', { name: /\+ DODAJ KLIENTA/i }).click();

    // Verify newly registered customer is active and visible
    await expect(
      customersPanel.locator('strong', { hasText: 'Piotr Zieliński' }).first()
    ).toBeVisible();

    // Verify selected customer reflected in Checkout panel
    const checkoutPanel = page.locator('section', { hasText: '// KASA & PŁATNOŚĆ' });
    await expect(checkoutPanel.getByText('Piotr Zieliński')).toBeVisible();

    // Safe customer deletion: navigate to Admin Panel in v3
    await page.getByRole('button', { name: 'PANEL ADMINA' }).click();
    const loginModal = page.getByRole('dialog', { name: /\/\/ AUTORYZACJA ADMINISTRATORA/i });
    await expect(loginModal).toBeVisible();
    await page.getByLabel(/Hasło dostępu administratora:/i).fill('admin123');
    await page.getByRole('button', { name: /AUTORYZUJ DOSTĘP/i }).click();

    // AdminPanel open -> switch to [4] KLIENCI tab
    await expect(
      page.getByRole('heading', { name: /\/\/ SEKCJA ADMINISTRACYJNA \/\/ TRYB UPRAWNIONY/i })
    ).toBeVisible();
    await page.getByRole('tab', { name: /\[4\] KLIENCI/i }).click();

    // Verify unmasked emails are shown in Admin view
    await expect(page.getByText(/anna@nowak\.pl|anna\.nowak@example\.com/i)).toBeVisible();

    // Delete customer Anna Nowak (who has pre-seeded order in history)
    const deleteAnnaBtn = page.getByRole('button', { name: /Usuń klienta Anna Nowak/i });
    await deleteAnnaBtn.click();
    await page.getByRole('button', { name: /POTWIERDŹ USUŃ\?/i }).click();
    await expect(deleteAnnaBtn).not.toBeVisible();

    // Return to shop view
    await page.getByRole('button', { name: /\[<- POWRÓT DO SKLEPU\]/i }).click();
    await expect(page.getByRole('heading', { name: /\/\/ KATALOG PRODUKTÓW/i })).toBeVisible();

    // Customer Anna Nowak is no longer in active customers panel
    await expect(customersPanel.getByText('Anna Nowak')).toHaveCount(0);

    // Order history table still preserves Anna Nowak snapshot!
    const ordersPanel = page.locator('section', { hasText: '// HISTORIA ZAMÓWIEŃ' });
    await expect(ordersPanel.getByText('Anna Nowak')).toBeVisible();

    // Open details modal
    const detailsBtn = ordersPanel
      .locator('tr', { hasText: 'Anna Nowak' })
      .getByRole('button', { name: /Szczegóły/i });
    await detailsBtn.click();

    const modal = page.getByRole('dialog', { name: /\/\/ SZCZEGÓŁY ZAMÓWIENIA/i });
    await expect(modal).toBeVisible();
    await expect(modal.getByText('Anna Nowak')).toBeVisible();

    // Close modal
    await modal.getByRole('button', { name: /ZAMKNIJ \[ESC\]/i }).click();
    await expect(modal).not.toBeVisible();
  });

  test('Scenario 5: Negative & positive validation for all 3 payment methods with PCI-DSS card masking and no CVV', async ({
    page,
  }) => {
    await page.goto('./');
    await expect(
      page.getByRole('heading', { name: /SHOPPING CART \/\/ TERMINAL v2\.0/i })
    ).toBeVisible();

    // Ensure cart has an item
    const clearBtn = page.getByRole('button', { name: /WYCZYŚĆ/i });
    if (await clearBtn.isVisible()) {
      await clearBtn.click();
    }
    const floppyArticle = page.locator('article', { hasText: 'AC-FLOPPY-08' });
    await floppyArticle.getByRole('button', { name: /DODAJ ->/i }).click();

    const checkoutPanel = page.locator('section', { hasText: '// KASA & PŁATNOŚĆ' });

    // 1. Credit Card - invalid Luhn
    await checkoutPanel.getByRole('button', { name: 'Karta kredytowa' }).click();
    await page.getByLabel(/Numer karty/i).fill('4532 0151 1283 0367');
    await page.getByLabel(/Ważność/i).fill('12/28');
    await page.getByLabel(/Kod CVV/i).fill('123');
    await checkoutPanel.getByRole('button', { name: /ZAMÓW I ZAPŁAĆ/i }).click();

    await expect(checkoutPanel.getByRole('alert')).toContainText(
      'Nieprawidłowa suma kontrolna numeru karty'
    );

    // Credit Card - invalid CVV
    await page.getByLabel(/Numer karty/i).fill('4532 0151 1283 0366');
    await page.getByLabel(/Kod CVV/i).fill('12');
    await checkoutPanel.getByRole('button', { name: /ZAMÓW I ZAPŁAĆ/i }).click();
    await expect(checkoutPanel.getByRole('alert')).toContainText(
      'Kod CVV musi składać się z 3 lub 4 cyfr'
    );

    // Credit Card - valid submission
    await page.getByLabel(/Kod CVV/i).fill('789');
    await checkoutPanel.getByRole('button', { name: /ZAMÓW I ZAPŁAĆ/i }).click();

    // Verify order in history
    const ordersPanel = page.locator('section', { hasText: '// HISTORIA ZAMÓWIEŃ' });
    await expect(ordersPanel.getByText(/0366/)).toBeVisible();

    // PCI-DSS Hygiene: verify CVV is NOT in DOM and NOT in storage
    await expect(page.locator('body')).not.toContainText('789');
    const storedJson = await page.evaluate(async () => {
      return localStorage.getItem('shopping_cart_v2_backup') ?? '';
    });
    expect(storedJson).not.toContain('789');

    // 2. PayPal
    await floppyArticle.getByRole('button', { name: /DODAJ ->/i }).click();
    await checkoutPanel.getByRole('button', { name: 'PayPal' }).click();
    await page.getByLabel(/Adres e-mail konta PayPal/i).fill('zly-email');
    await checkoutPanel.getByRole('button', { name: /ZAMÓW I ZAPŁAĆ/i }).click();
    await expect(checkoutPanel.getByRole('alert')).toContainText(
      'Nieprawidłowy adres e-mail konta PayPal'
    );

    await page.getByLabel(/Adres e-mail konta PayPal/i).fill('jan.klient@paypal.com');
    await checkoutPanel.getByRole('button', { name: /ZAMÓW I ZAPŁAĆ/i }).click();
    await expect(ordersPanel.getByText('PayPal (jan.klient@paypal.com)')).toBeVisible();

    // 3. Bitcoin
    await floppyArticle.getByRole('button', { name: /DODAJ ->/i }).click();
    await checkoutPanel.getByRole('button', { name: 'Bitcoin' }).click();
    await expect(checkoutPanel.getByText(/Równowartość BTC:/i)).toBeVisible();

    await page.getByLabel(/Adres portfela Bitcoin/i).fill('zly-adres-btc');
    await checkoutPanel.getByRole('button', { name: /ZAMÓW I ZAPŁAĆ/i }).click();
    await expect(checkoutPanel.getByRole('alert')).toContainText(
      'Nieprawidłowy adres portfela Bitcoin'
    );

    await page.getByLabel(/Adres portfela Bitcoin/i).fill('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa');
    await checkoutPanel.getByRole('button', { name: /ZAMÓW I ZAPŁAĆ/i }).click();
    await expect(ordersPanel.getByText(/BTC \(1A1zP1\.\.\.vfNa\)/i)).toBeVisible();
  });

  test('Scenario 6: Order persistence in IndexedDB after page reload', async ({ page }) => {
    await page.goto('./');
    await expect(
      page.getByRole('heading', { name: /SHOPPING CART \/\/ TERMINAL v2\.0/i })
    ).toBeVisible();

    // Register unique customer (name letters only per v3 domain rules)
    const randomSuffix = Math.random().toString(36).replace(/[^a-z]/g, '').slice(0, 5);
    const uniqueName = `Klient Trwaly ${randomSuffix.toUpperCase()}`;
    const uniqueEmail = `trwaly.${Date.now()}@indexeddb.pl`;
    await page.getByLabel(/Imię i nazwisko:/i).fill(uniqueName);
    await page.getByLabel(/Adres e-mail:/i).fill(uniqueEmail);
    await page.getByRole('button', { name: /\+ DODAJ KLIENTA/i }).click();

    // Verify customer is selected and listed
    await expect(
      page.locator('section', { hasText: '// BAZA KLIENTÓW' }).getByText(uniqueName).first()
    ).toBeVisible();

    // Add product to cart
    const floppy = page.locator('article', { hasText: 'AC-FLOPPY-08' });
    await floppy.getByRole('button', { name: /DODAJ ->/i }).click();

    // Checkout with PayPal
    const checkoutPanel = page.locator('section', { hasText: '// KASA & PŁATNOŚĆ' });
    await checkoutPanel.getByRole('button', { name: 'PayPal' }).click();
    await page.getByLabel(/Adres e-mail konta PayPal/i).fill('trwaly@paypal.com');
    await checkoutPanel.getByRole('button', { name: /ZAMÓW I ZAPŁAĆ/i }).click();

    const ordersPanel = page.locator('section', { hasText: '// HISTORIA ZAMÓWIEŃ' });
    await expect(ordersPanel.getByText(uniqueName)).toBeVisible();

    // Brief pause to allow async IndexedDB write before reload
    await page.waitForTimeout(300);

    // RELOAD PAGE
    await page.reload();
    await expect(
      page.getByRole('heading', { name: /SHOPPING CART \/\/ TERMINAL v2\.0/i })
    ).toBeVisible();

    // Verify customer and order are still present after reload from IndexedDB
    await expect(
      page.locator('section', { hasText: '// BAZA KLIENTÓW' }).getByText(uniqueName).first()
    ).toBeVisible();
    await expect(
      page.locator('section', { hasText: '// HISTORIA ZAMÓWIEŃ' }).getByText(uniqueName)
    ).toBeVisible();
  });

  test('Scenario 7: Order details modal Esc closure and ASCII report export .txt validation', async ({
    page,
  }) => {
    await page.goto('./');
    await expect(
      page.getByRole('heading', { name: /SHOPPING CART \/\/ TERMINAL v2\.0/i })
    ).toBeVisible();

    const ordersPanel = page.locator('section', { hasText: '// HISTORIA ZAMÓWIEŃ' });
    const firstDetailsBtn = ordersPanel.getByRole('button', { name: /Szczegóły/i }).first();
    await firstDetailsBtn.click();

    const modal = page.getByRole('dialog', { name: /\/\/ SZCZEGÓŁY ZAMÓWIENIA/i });
    await expect(modal).toBeVisible();

    // Close modal via Escape key
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();

    // Download .TXT report
    const downloadPromise = page.waitForEvent('download');
    await ordersPanel.getByRole('button', { name: /EXPORT \.TXT/i }).click();
    const download = await downloadPromise;

    // Verify filename matches convention
    expect(download.suggestedFilename()).toMatch(/^order_history_\d{8}_\d{6}\.txt$/);

    // Read content
    const readable = await download.createReadStream();
    let content = '';
    for await (const chunk of readable) {
      content += chunk.toString();
    }

    // Verify table borders and columns
    expect(content).toContain('+');
    expect(content).toContain('SHOPPING CART - ORDER HISTORY EXPORT');
    expect(content).toContain('DATA');
    expect(content).toContain('KLIENT');
    expect(content).toContain('PLATNOSC');
    expect(content).toContain('TOTAL');

    // Verify strict PCI-DSS: no CVV in the text file
    expect(content.toLowerCase()).not.toContain('cvv');
    expect(content.toLowerCase()).not.toContain('cvc');
  });

  test('Scenario 8: JSON backup export and import flow', async ({ page }) => {
    await page.goto('./');
    await expect(
      page.getByRole('heading', { name: /SHOPPING CART \/\/ TERMINAL v2\.0/i })
    ).toBeVisible();

    // Export JSON backup
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /EXPORT JSON/i }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/^shopping_cart_backup_\d{8}_\d{6}\.json$/);

    const readable = await download.createReadStream();
    let jsonText = '';
    for await (const chunk of readable) {
      jsonText += chunk.toString();
    }

    const parsed = JSON.parse(jsonText);
    expect([2, 3]).toContain(parsed.version);
    expect(Array.isArray(parsed.customers)).toBe(true);
    expect(Array.isArray(parsed.orders)).toBe(true);

    // Reset demo data to alter state
    await page.getByRole('button', { name: /RESET DEMO/i }).click();
    await page.getByRole('button', { name: /POTWIERDŹ RESET\?/i }).click();
    await expect(page.getByRole('status')).toContainText('PRZYWRÓCONO DOMYŚLNE DANE DEMO');

    // Re-import the downloaded backup
    const fileInput = page.locator('#import-json-input');
    const tempPath = await download.path();
    if (tempPath) {
      await fileInput.setInputFiles(tempPath);
      await expect(page.getByRole('status')).toContainText('IMPORT ZAKOŃCZONY');
    }
  });

  test('Scenario 9: CRT FX toggle persistence and mobile viewport 390x844 layout without horizontal scroll', async ({
    page,
  }) => {
    await page.goto('./');
    await expect(
      page.getByRole('heading', { name: /SHOPPING CART \/\/ TERMINAL v2\.0/i })
    ).toBeVisible();

    const crtBtn = page.getByRole('button', { name: /CRT FX:/i });
    const appRoot = page.locator('.retro-app');

    // Initially CRT FX is ON
    await expect(crtBtn).toHaveText('CRT FX: ON');
    await expect(appRoot).toHaveClass(/crt-fx-enabled/);

    // Turn OFF
    await crtBtn.click();
    await expect(crtBtn).toHaveText('CRT FX: OFF');
    await expect(appRoot).not.toHaveClass(/crt-fx-enabled/);

    // Wait a brief moment for IndexedDB persist before reload
    await page.waitForTimeout(300);

    // Reload and check persistence
    await page.reload();
    await expect(page.getByRole('button', { name: /CRT FX: OFF/i })).toBeVisible();
    await expect(page.locator('.retro-app')).not.toHaveClass(/crt-fx-enabled/);

    // Re-enable CRT FX
    await page.getByRole('button', { name: /CRT FX: OFF/i }).click();
    await expect(page.locator('.retro-app')).toHaveClass(/crt-fx-enabled/);

    // Mobile viewport test (390x844 - standard mobile size)
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);

    // Verify no horizontal overflow
    const isOverflowing = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(isOverflowing).toBe(false);

    // Verify panels are visible
    await expect(page.getByRole('heading', { name: /\/\/ KATALOG PRODUKTÓW/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /\/\/ KOSZYK/i })).toBeVisible();
  });

  test('Scenario 10: Axe accessibility audit (zero critical and serious violations in main view, modals, and AdminPanel tabs)', async ({
    page,
  }) => {
    await page.goto('./');
    await expect(
      page.getByRole('heading', { name: /SHOPPING CART \/\/ TERMINAL v2\.0/i })
    ).toBeVisible();

    // 1. Analyze main shop view
    const mainResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    const mainSevereViolations = mainResults.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );
    expect(mainSevereViolations).toEqual([]);

    // 2. Open Order Details Modal & Analyze
    const detailsBtn = page.getByRole('button', { name: /Szczegóły/i }).first();
    await detailsBtn.click();

    const orderModal = page.getByRole('dialog', { name: /\/\/ SZCZEGÓŁY ZAMÓWIENIA/i });
    await expect(orderModal).toBeVisible();

    const orderModalResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    const orderModalViolations = orderModalResults.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );
    expect(orderModalViolations).toEqual([]);

    // Close details modal
    await page.keyboard.press('Escape');
    await expect(orderModal).not.toBeVisible();

    // 3. Open AdminLoginModal & Analyze
    await page.getByRole('button', { name: 'PANEL ADMINA' }).click();
    const loginModal = page.getByRole('dialog', { name: /\/\/ AUTORYZACJA ADMINISTRATORA/i });
    await expect(loginModal).toBeVisible();

    const loginModalResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    const loginModalViolations = loginModalResults.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );
    expect(loginModalViolations).toEqual([]);

    // 4. Log in and scan AdminPanel tabs
    await page.getByLabel(/Hasło dostępu administratora:/i).fill('admin123');
    await page.getByRole('button', { name: /AUTORYZUJ DOSTĘP/i }).click();

    await expect(
      page.getByRole('heading', { name: /\/\/ SEKCJA ADMINISTRACYJNA \/\/ TRYB UPRAWNIONY/i })
    ).toBeVisible();

    // Tab 1: KATEGORIE
    const tab1Results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    const tab1Violations = tab1Results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );
    expect(tab1Violations).toEqual([]);

    // Tab 2: PRODUKTY
    await page.getByRole('tab', { name: /\[2\] PRODUKTY/i }).click();
    await page.waitForTimeout(250);
    const tab2Results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    const tab2Violations = tab2Results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );
    expect(tab2Violations).toEqual([]);

    // Tab 3: MIGRACJA PRODUKTÓW
    await page.getByRole('tab', { name: /\[3\] MIGRACJA PRODUKTÓW/i }).click();
    await page.waitForTimeout(250);
    const tab3Results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    const tab3Violations = tab3Results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );
    expect(tab3Violations).toEqual([]);

    // Tab 4: KLIENCI
    await page.getByRole('tab', { name: /\[4\] KLIENCI/i }).click();
    await page.waitForTimeout(250);
    const tab4Results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    const tab4Violations = tab4Results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );
    expect(tab4Violations).toEqual([]);
  });

  test('Scenario 11: Admin catalog configuration, product migration, and storefront purchase flow', async ({
    page,
  }) => {
    await page.goto('./');
    await expect(
      page.getByRole('heading', { name: /SHOPPING CART \/\/ TERMINAL v2\.0/i })
    ).toBeVisible();

    // 1. Open Admin Panel & Log in
    await page.getByRole('button', { name: 'PANEL ADMINA' }).click();
    const loginModal = page.getByRole('dialog', { name: /\/\/ AUTORYZACJA ADMINISTRATORA/i });
    await expect(loginModal).toBeVisible();
    await page.getByLabel(/Hasło dostępu administratora:/i).fill('admin123');
    await page.getByRole('button', { name: /AUTORYZUJ DOSTĘP/i }).click();

    await expect(
      page.getByRole('heading', { name: /\/\/ SEKCJA ADMINISTRACYJNA \/\/ TRYB UPRAWNIONY/i })
    ).toBeVisible();

    // 2. Tab 1: Create new Category "Cyberdecki"
    await page.getByLabel(/Nazwa kategorii/i).fill('Cyberdecki');
    await page.getByLabel(/Opis kategorii/i).fill('Terminale mobilne retro cyberware');
    await page.getByRole('button', { name: /\+ DODAJ KATEGORIĘ/i }).click();
    await expect(page.locator('strong', { hasText: 'Cyberdecki' })).toBeVisible();

    // 3. Tab 2: Create new Product in Cyberdecki
    await page.getByRole('tab', { name: /\[2\] PRODUKTY/i }).click();
    await page.getByLabel(/SKU \(Unikalny kod\):/i).fill('HW-DECK-01');
    await page.getByLabel(/Nazwa produktu:/i).fill('Cyberdeck Onyx 486');
    await page.locator('#prod-cat-select').selectOption({ label: 'Cyberdecki' });
    await page.getByLabel(/Cena \(PLN\):/i).fill('1299.99');
    await page.getByLabel(/Stan magazynowy \(szt\.\):/i).fill('5');
    await page.getByLabel(/Opis produktu:/i).fill('Mobilny terminal z monochromatycznym ekranem');
    await page.getByRole('button', { name: /\+ DODAJ PRODUKT DO KATALOGU/i }).click();

    await expect(page.locator('strong', { hasText: 'Cyberdeck Onyx 486' })).toBeVisible();

    // 4. Tab 3: Migrate products between categories
    await page.getByRole('tab', { name: /\[3\] MIGRACJA PRODUKTÓW/i }).click();
    await expect(
      page.getByText(/\/\/ MASOWA MIGRACJA PRODUKTÓW MIĘDZY KATEGORIAMI/i)
    ).toBeVisible();

    // Select source: Cyberdecki, target: Elektronika
    const cyberVal = await page
      .locator('#migrate-source-cat option', { hasText: 'Cyberdecki' })
      .getAttribute('value');
    await page.locator('#migrate-source-cat').selectOption(cyberVal!);

    const elekVal = await page
      .locator('#migrate-target-cat option', { hasText: 'Elektronika' })
      .getAttribute('value');
    await page.locator('#migrate-target-cat').selectOption(elekVal!);
    await page.getByRole('button', { name: /MIGRUJ WYBRANE PRODUKTY/i }).click();
    await expect(page.getByText(/SUKCES: Pomyślnie przeniesiono/i)).toBeVisible();

    // Migrate back to Cyberdecki
    await page.locator('#migrate-source-cat').selectOption(elekVal!);
    const cyberTargetVal = await page
      .locator('#migrate-target-cat option', { hasText: 'Cyberdecki' })
      .getAttribute('value');
    await page.locator('#migrate-target-cat').selectOption(cyberTargetVal!);
    await page.getByRole('button', { name: /MIGRUJ WYBRANE PRODUKTY/i }).click();
    await expect(page.getByText(/SUKCES: Pomyślnie przeniesiono/i)).toBeVisible();

    // 5. Return to store
    await page.getByRole('button', { name: /\[<- POWRÓT DO SKLEPU\]/i }).click();
    await expect(page.getByRole('heading', { name: /\/\/ KATALOG PRODUKTÓW/i })).toBeVisible();

    // Ensure active customer exists for checkout
    const customersPanel = page.locator('section', { hasText: '// BAZA KLIENTÓW' });
    const firstCustomerBtn = customersPanel.getByRole('button', { name: /Wybierz/i }).first();
    if (await firstCustomerBtn.isVisible()) {
      await firstCustomerBtn.click();
    }

    // 6. Filter by new category "Cyberdecki"
    const cyberdeckFilterBtn = page.getByRole('button', { name: /Cyberdecki/i });
    await expect(cyberdeckFilterBtn).toBeVisible();
    await cyberdeckFilterBtn.click();

    // 7. Add Cyberdeck Onyx 486 to cart
    const deckArticle = page.locator('article', { hasText: 'HW-DECK-01' });
    await expect(deckArticle).toBeVisible();
    await deckArticle.getByRole('button', { name: /DODAJ ->/i }).click();

    // Verify in cart
    const cartPanel = page.locator('section', { hasText: '// KOSZYK' });
    await expect(cartPanel.getByText('Cyberdeck Onyx 486')).toBeVisible();

    // 8. Place order
    const checkoutPanel = page.locator('section', { hasText: '// KASA & PŁATNOŚĆ' });
    await checkoutPanel.getByRole('button', { name: 'PayPal' }).click();
    await page.getByLabel(/Adres e-mail konta PayPal/i).fill('deck.runner@cyber.net');
    await checkoutPanel.getByRole('button', { name: /ZAMÓW I ZAPŁAĆ/i }).click();

    // Verify in order history
    const ordersPanel = page.locator('section', { hasText: '// HISTORIA ZAMÓWIEŃ' });
    await expect(ordersPanel.getByText('PayPal (deck.runner@cyber.net)')).toBeVisible();

    // Verify order items inside Details modal
    const detailsBtn = ordersPanel.getByRole('button', { name: /Szczegóły/i }).first();
    await detailsBtn.click();
    const modal = page.getByRole('dialog', { name: /\/\/ SZCZEGÓŁY ZAMÓWIENIA/i });
    await expect(modal).toBeVisible();
    await expect(modal.getByText('Cyberdeck Onyx 486')).toBeVisible();
    await modal.getByRole('button', { name: /ZAMKNIJ \[ESC\]/i }).click();
    await expect(modal).not.toBeVisible();
  });

  test('Scenario 12: API Security - unauthenticated mutating requests return 401 Unauthorized', async ({
    request,
  }) => {
    // 1. DELETE /api/customers without session
    const deleteCustRes = await request.delete('./api/customers?id=cust-demo-1');
    expect(deleteCustRes.status()).toBe(401);
    const deleteCustData = await deleteCustRes.json();
    expect(deleteCustData.error).toContain('Brak uprawnień');

    // 2. POST /api/products without session
    const postProdRes = await request.post('./api/products', {
      data: {
        sku: 'HACK-01',
        name: 'Nieautoryzowany Produkt',
        priceCents: 1000,
        stockQuantity: 10,
        categoryId: 'cat-default',
      },
    });
    expect(postProdRes.status()).toBe(401);
    const postProdData = await postProdRes.json();
    expect(postProdData.error).toContain('Brak uprawnień');

    // 3. POST /api/categories without session
    const postCatRes = await request.post('./api/categories', {
      data: {
        name: 'Nieautoryzowana Kategoria',
      },
    });
    expect(postCatRes.status()).toBe(401);

    // 4. POST /api/categories/migrate without session
    const migrateRes = await request.post('./api/categories/migrate', {
      data: {
        sourceCategoryId: 'cat-default',
        targetCategoryId: 'cat-elektronika',
      },
    });
    expect(migrateRes.status()).toBe(401);
  });
});
