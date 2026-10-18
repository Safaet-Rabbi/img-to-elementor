/**
 * Browser Capture Module
 * Uses headless Chromium / system Chrome via playwright-core for deterministic,
 * pixel-accurate screenshot capture of rendered Elementor templates.
 */

import fs from 'node:fs';
import path from 'node:path';
import { chromium, type Browser, type Page } from 'playwright-core';
import { logger } from '../../lib/logger.js';

export interface ViewportConfig {
  width: number;
  height: number;
  deviceScaleFactor?: number;
}

export interface CaptureOptions {
  viewport?: ViewportConfig;
  fullPage?: boolean;
  timeoutMs?: number;
  executablePath?: string;
}

export class BrowserCapture {
  private browser: Browser | null = null;
  private executablePath: string;

  constructor(executablePath?: string) {
    this.executablePath = executablePath || this.detectChromeExecutable();
  }

  private detectChromeExecutable(): string {
    const candidatePaths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser',
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    ];

    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        return p;
      }
    }

    return 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  }

  private async getBrowser(): Promise<Browser> {
    if (!this.browser) {
      try {
        this.browser = await chromium.launch({
          executablePath: this.executablePath,
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--font-render-hinting=none',
            '--force-color-profile=srgb',
          ],
        });
      } catch (err: any) {
        logger.error({ err: err.message, path: this.executablePath }, 'Failed to launch headless browser');
        throw new Error(`Browser automation failed: could not launch Chrome at "${this.executablePath}": ${err.message}`);
      }
    }
    return this.browser;
  }

  public async captureHtml(htmlContent: string, options: CaptureOptions = {}): Promise<Buffer> {
    const browser = await this.getBrowser();
    const viewport = options.viewport || { width: 1440, height: 900, deviceScaleFactor: 1 };
    const context = await browser.newContext({
      viewport: {
        width: viewport.width,
        height: viewport.height,
      },
      deviceScaleFactor: viewport.deviceScaleFactor || 1,
    });

    const page: Page = await context.newPage();

    try {
      await page.setContent(htmlContent, {
        waitUntil: 'load',
        timeout: options.timeoutMs || 30000,
      });

      // Wait for web fonts to load
      await page.evaluate(async () => {
        if (document.fonts) {
          await document.fonts.ready;
        }
      });

      // Wait for all images to complete loading
      await page.evaluate(async () => {
        const imgs = Array.from(document.querySelectorAll('img'));
        await Promise.all(
          imgs.map((img) => {
            if (img.complete) return Promise.resolve();
            return new Promise((resolve) => {
              img.addEventListener('load', resolve);
              img.addEventListener('error', resolve);
            });
          })
        );
      });

      // Extra short stabilization wait for CSS flex layouts and render tree
      await page.waitForTimeout(150);

      const buffer = await page.screenshot({
        fullPage: options.fullPage ?? false,
        type: 'png',
      });

      return buffer;
    } finally {
      await context.close().catch(() => {});
    }
  }

  public async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
    }
  }
}

let browserCaptureInstance: BrowserCapture | null = null;

export function getBrowserCapture(): BrowserCapture {
  if (!browserCaptureInstance) {
    browserCaptureInstance = new BrowserCapture();
  }
  return browserCaptureInstance;
}
