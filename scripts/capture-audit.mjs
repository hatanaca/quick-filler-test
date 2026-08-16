import { chromium } from 'playwright';
import { join } from 'path';

const OUTPUT_DIR = '/home/ThiagoHatanaka/projects/quick-filler-test/output/playwright';
const BASE_URL = 'http://localhost:5173';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  // 1. Upload screen - empty state
  await page.goto(BASE_URL);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: join(OUTPUT_DIR, '01-upload-empty.png'), fullPage: true });
  console.log('✓ 01-upload-empty.png');

  // 2. Upload screen - holerite type selected
  await page.click('input[value="holerite"]');
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(OUTPUT_DIR, '02-upload-holerite-selected.png'), fullPage: true });
  console.log('✓ 02-upload-holerite-selected.png');

  // 3. Upload with a real PDF file (cartao-ponto)
  const pdfPath = '/home/ThiagoHatanaka/projects/quick-filler-test/exemplos/cartao-ponto-1.pdf';
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.click('input[type="file"]'),
  ]);
  await fileChooser.setFiles(pdfPath);
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(OUTPUT_DIR, '03-upload-file-selected.png'), fullPage: true });
  console.log('✓ 03-upload-file-selected.png');

  // 4. Submit and capture processing state
  await page.click('button:has-text("Enviar e processar")');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(OUTPUT_DIR, '04-processing.png'), fullPage: true });
  console.log('✓ 04-processing.png');

  // 5. Wait for completion and capture review screen
  try {
    await page.waitForSelector('text=Revisão da transcrição', { timeout: 120000 });
    await page.waitForTimeout(3000); // let it stabilize
    await page.screenshot({ path: join(OUTPUT_DIR, '05-review-timecard.png'), fullPage: true });
    console.log('✓ 05-review-timecard.png');
  } catch (e) {
    console.log('⚠ Timeout waiting for review screen, capturing current state');
    await page.screenshot({ path: join(OUTPUT_DIR, '05-review-timecard.png'), fullPage: true });
  }

  // 6. Check for warnings
  const warningCount = await page.locator('span').filter({ hasText: /^(⚠|•)/ }).count();
  if (warningCount > 0) {
    console.log(`  Found ${warningCount} warning badges`);
  }

  // 7. Capture mobile viewport
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(OUTPUT_DIR, '06-review-mobile.png'), fullPage: true });
  console.log('✓ 06-review-mobile.png');

  // 8. Back to desktop
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.waitForTimeout(500);

  // 9. Try editing a cell in the review table
  const inputs = await page.locator('table input').all();
  if (inputs.length > 1) {
    await inputs[1].click();
    await inputs[1].fill('09:00');
    await page.waitForTimeout(600); // wait for debounce save
    await page.screenshot({ path: join(OUTPUT_DIR, '07-review-edited.png'), fullPage: true });
    console.log('✓ 07-review-edited.png');
  }

  // 10. Go back to upload for fresh state
  await page.goto(BASE_URL);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: join(OUTPUT_DIR, '08-upload-fresh.png'), fullPage: true });
  console.log('✓ 08-upload-fresh.png');

  await browser.close();
  console.log('\nDone! Screenshots saved to:', OUTPUT_DIR);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
