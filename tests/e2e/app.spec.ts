import { test, expect } from '@playwright/test'

test.describe('Quick Filler App', () => {
  test('homepage loads correctly', async ({ page }) => {
    await page.goto('/')

    // Should show the main page
    await expect(page).toHaveTitle(/Quick Filler/i)
  })

  test('health check endpoint responds', async ({ request }) => {
    const response = await request.get('http://localhost:3001/healthz')
    expect(response.ok()).toBeTruthy()

    const body = await response.json()
    expect(body).toHaveProperty('status', 'ok')
  })

  test('upload form is visible', async ({ page }) => {
    await page.goto('/')

    // Look for upload area or button
    const uploadArea = page
      .locator('input[type="file"]')
      .or(page.locator('[data-testid="upload"]'))
      .or(page.locator('text=upload').or(page.locator('text=enviar')))

    await expect(uploadArea.first()).toBeVisible({ timeout: 10000 })
  })

  test('can navigate to the app', async ({ page }) => {
    await page.goto('/')

    // Wait for the page to be fully loaded
    await page.waitForLoadState('networkidle')

    // Check that the page doesn't show error
    const errorText = page.locator('text=erro').or(page.locator('text=error'))
    await expect(errorText).not.toBeVisible({ timeout: 5000 })
  })
})
