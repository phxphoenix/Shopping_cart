import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Retro Shopping Cart v2.0 - E2E Suite', () => {
  test('Scenario 1: Application loads under /Shopping_cart/ with 0 console errors, 0 page errors, and 0 HTTP >= 400 responses', async ({
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

  test('Scenario 4: Customer registration, selection, and safe removal without corrupting orders', async ({
    page,
  }) => {
    await page.goto('./');
    await expect(
      page.getByRole('heading', { name: /SHOPPING CART \/\/ TERMINAL v2\.0/i })
    ).toBeVisible();

    const customersPanel = page.locator('section', { hasText: '// BAZA KLIENTÓW' });

    // Register new customer
    await page.getByLabel(/Imię i nazwisko:/i).fill('Piotr Zieliński');
    await page.getByLabel(/Adres e-mail:/i).fill('piotr.zielinski@kadra.pl');
    await page.getByRole('button', { name: /\+ DODAJ KLIENTA/i }).click();

    // Select new customer
    const piotrBtn = customersPanel.getByRole('button', { name: /\[○\] Piotr Zieliński/i });
    await expect(piotrBtn).toBeVisible();
    await piotrBtn.click();

    await expect(
      customersPanel.locator('strong', { hasText: 'Piotr Zieliński' }).first()
    ).toBeVisible();

    // Verify selected customer reflected in Checkout panel
    const checkoutPanel = page.locator('section', { hasText: '// KASA & PŁATNOŚĆ' });
    await expect(checkoutPanel.getByText('Piotr Zieliński')).toBeVisible();

    // Delete Anna Nowak (who has pre-seeded order in history)
    const deleteAnnaBtn = customersPanel.getByRole('button', { name: /Usuń klienta Anna Nowak/i });
    await deleteAnnaBtn.click();
    await expect(deleteAnnaBtn).not.toBeVisible();

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
    await expect(modal.getByText('anna.nowak@example.com').first()).toBeVisible();

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
    await expect(ordersPanel.getByText('**** **** **** 0366')).toBeVisible();

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

    // Register unique customer
    const uniqueName = `Klient Trwały ${Date.now()}`;
    await page.getByLabel(/Imię i nazwisko:/i).fill(uniqueName);
    await page.getByLabel(/Adres e-mail:/i).fill('trwaly@indexeddb.pl');
    await page.getByRole('button', { name: /\+ DODAJ KLIENTA/i }).click();

    // Select this customer
    await page
      .locator('section', { hasText: '// BAZA KLIENTÓW' })
      .getByRole('button', { name: new RegExp(`\\[○\\] ${uniqueName}`, 'i') })
      .click();

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
    expect(parsed.version).toBe(2);
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

  test('Scenario 10: Axe accessibility audit (zero critical and serious violations in main view and details modal)', async ({
    page,
  }) => {
    await page.goto('./');
    await expect(
      page.getByRole('heading', { name: /SHOPPING CART \/\/ TERMINAL v2\.0/i })
    ).toBeVisible();

    // Analyze main view
    const mainResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    const mainSevereViolations = mainResults.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );
    expect(mainSevereViolations).toEqual([]);

    // Open Order Details Modal
    const detailsBtn = page.getByRole('button', { name: /Szczegóły/i }).first();
    await detailsBtn.click();

    const modal = page.getByRole('dialog', { name: /\/\/ SZCZEGÓŁY ZAMÓWIENIA/i });
    await expect(modal).toBeVisible();

    // Analyze view with modal open
    const modalResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    const modalSevereViolations = modalResults.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );
    expect(modalSevereViolations).toEqual([]);
  });
});
