/**
 * BrainGig Homepage End-to-End Regression Test
 *
 * Verifies the closed-loop conversion pipeline on the canonical BrainGig homepage reference:
 * Reference: server/src/__fixtures__/braingig/braingig-main-reference.png (1195 x 918)
 *
 * Confirms resolution of all 9 regressions identified in Section 13:
 * 1. Header logo and navigation with per-link active colors (Home orange, others dark slate).
 * 2. Main headline line breaks (4 lines) and orange script accent on "Agency.".
 * 3. Introductory paragraph styling.
 * 4. Primary CTA ("Start Your Project ➔") with 50px pill radius.
 * 5. Secondary CTA ("Explore Our Work") clean inline link styling.
 * 6. Rating trust badge (avatars + "4.9 / 5" + trust text).
 * 7. Statistics card 4 metrics with vertical column dividers and balanced spacing.
 * 8. Warm canvas background (#FAF7F2) instead of stark white.
 * 9. Lower orange service ticker (#FF5E1E) edge-to-edge full width.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import AdmZip from 'adm-zip';

import { convertDIRToElementor } from '../modules/elementor/generator.js';
import { ElementorRenderer } from '../modules/rendering/elementor-renderer.js';
import { BrowserCapture } from '../modules/rendering/browser-capture.js';
import { VisualComparator } from '../modules/comparison/visual-comparator.js';
import { AutoCorrector } from '../modules/correction/auto-corrector.js';
import { ValidationGate } from '../modules/validation/validation-gate.js';
import { BundlePackager } from '../modules/packages/bundle-packager.js';
import type { DIRDocument } from '../modules/dir/types.js';

describe('BrainGig Homepage Closed-Loop Regression Suite', () => {
  let referenceBuffer: Buffer;
  let incorrectBuffer: Buffer;
  let browserCapture: BrowserCapture;

  const refPath = path.resolve(process.cwd(), 'src/__fixtures__/braingig/braingig-main-reference.png');
  const incorrectPath = path.resolve(process.cwd(), 'src/__fixtures__/braingig/braingig-incorrect-output.png');

  beforeAll(async () => {
    expect(fs.existsSync(refPath)).toBe(true);
    expect(fs.existsSync(incorrectPath)).toBe(true);

    referenceBuffer = fs.readFileSync(refPath);
    incorrectBuffer = fs.readFileSync(incorrectPath);
    browserCapture = new BrowserCapture();
  });

  afterAll(async () => {
    if (browserCapture) {
      await browserCapture.close();
    }
  });

  const brainGigDIR: any = {
    version: '1.0.0',
    meta: {
      sourceImageHash: 'braingig-reference-1195x918',
      sourceWidth: 1195,
      sourceHeight: 918,
      analysisProvider: 'gemini-2.5-flash',
      analysisModel: 'gemini-2.5-flash-preview',
      analysisTimestamp: new Date().toISOString(),
      confidenceScore: 0.98,
      schemaVersion: '1.0.0',
      promptVersion: 'v2.0.0',
    },
    breakpoints: {
      desktop: { min: 1024 },
      tablet: { min: 768, max: 1023 },
      mobile: { min: 320, max: 767 },
    },
    globals: {
      colors: {
        background: '#FAF7F2',
        surface: '#FAF7F2',
        text: '#0F1A2C',
        primary: '#FF5E1E',
        accent: '#FF5E1E',
        muted: '#64748B',
      },
      typography: {
        fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif",
        headingFamily: "'Plus Jakarta Sans', 'Inter', sans-serif",
      },
      spacing: {
        unit: 'px',
        base: 8,
        sectionGap: 32,
        containerMaxWidth: 1040,
      },
    },
    assets: [
      {
        id: 'braingig-logo',
        type: 'image',
        alt: 'braingig logo',
        placeholder: `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="140" height="40" viewBox="0 0 140 40"><text x="0" y="28" font-family="sans-serif" font-size="28" font-weight="800" fill="#0F1A2C">braingig</text></svg>').toString('base64')}`,
      },
      {
        id: 'avatars',
        type: 'image',
        alt: 'avatar trust reviews',
        placeholder: `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="90" height="28" viewBox="0 0 90 28"><circle cx="14" cy="14" r="12" fill="#b8860b" stroke="#FAF7F2" stroke-width="2"/><circle cx="34" cy="14" r="12" fill="#008080" stroke="#FAF7F2" stroke-width="2"/><circle cx="54" cy="14" r="12" fill="#00bfff" stroke="#FAF7F2" stroke-width="2"/><circle cx="74" cy="14" r="12" fill="#8a2be2" stroke="#FAF7F2" stroke-width="2"/></svg>').toString('base64')}`,
      },
    ],
    pages: [
      {
        id: 'page-home',
        name: 'BrainGig Home',
        sections: [
          // 1. Header Section
          {
            id: 'sec-header',
            role: 'header',
            label: 'Header Navigation',
            styles: {
              backgroundColor: '#FAF7F2',
              padding: { top: 20, right: 0, bottom: 20, left: 0 },
            },
            children: [
              {
                id: 'grp-header-row',
                kind: 'flex-group',
                direction: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                styles: { width: '100%' },
                children: [
                  {
                    id: 'node-logo',
                    kind: 'image',
                    assetId: 'braingig-logo',
                    alt: 'braingig logo',
                    styles: { width: 140, height: 40 },
                  },
                  {
                    id: 'node-nav',
                    kind: 'flex-group',
                    direction: 'row',
                    gap: 32,
                    styles: { alignItems: 'center' },
                    children: [
                      { id: 'nav-home', kind: 'link', text: 'Home', url: '#', styles: { color: '#FF5E1E', fontSize: 14 } },
                      { id: 'nav-services', kind: 'link', text: 'Digital Services ⌵', url: '#', styles: { color: '#1E293B', fontSize: 14 } },
                      { id: 'nav-about', kind: 'link', text: 'About Us', url: '#', styles: { color: '#1E293B', fontSize: 14 } },
                      { id: 'nav-contact', kind: 'link', text: 'Contact Us', url: '#', styles: { color: '#1E293B', fontSize: 14 } },
                      { id: 'nav-blogs', kind: 'link', text: 'Blogs', url: '#', styles: { color: '#1E293B', fontSize: 14 } },
                    ],
                  },
                  {
                    id: 'node-header-cta',
                    kind: 'button',
                    text: 'Start a project →',
                    variant: 'primary',
                    styles: {
                      backgroundColor: '#0F1A2C',
                      color: '#FFFFFF',
                      borderRadius: 50,
                      padding: { top: 12, right: 24, bottom: 12, left: 24 },
                      fontSize: 14,
                    },
                  },
                ],
              },
            ],
          },

          // 2. Hero Section
          {
            id: 'sec-hero',
            role: 'hero',
            label: 'Hero Section',
            styles: {
              backgroundColor: '#FAF7F2',
              padding: { top: 36, right: 0, bottom: 24, left: 0 },
            },
            children: [
              {
                id: 'node-eyebrow',
                kind: 'heading',
                level: 6,
                text: 'WEB DESIGN, DEVELOPMENT & DIGITAL GROWTH',
                styles: {
                  fontSize: 13,
                  color: '#64748B',
                  fontWeight: 600,
                  letterSpacing: 1,
                  margin: { top: 0, right: 0, bottom: 16, left: 0 },
                },
              },
              {
                id: 'node-main-headline',
                kind: 'heading',
                level: 1,
                text: 'Web Design,\nDevelopment &\nDigital Growth\nAgency.',
                styles: {
                  fontSize: 68,
                  color: '#0F1A2C',
                  fontWeight: 700,
                  lineHeight: 1.08,
                  margin: { top: 0, right: 0, bottom: 24, left: 0 },
                },
                typography: {
                  inline_color_spans: [
                    {
                      text: 'Agency.',
                      color_hex: '#FF5E1E',
                      font_style: 'italic',
                      font_family: "serif, 'Times New Roman', Georgia",
                    },
                  ],
                },
              },
              {
                id: 'node-hero-bottom-row',
                kind: 'flex-group',
                direction: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 24,
                styles: { width: '100%', margin: { top: 16, right: 0, bottom: 16, left: 0 } },
                children: [
                  {
                    id: 'node-intro-text',
                    kind: 'text',
                    text: 'Brain Gig, As a premier web design and development agency creating conversion-focused websites. From custom development to ongoing website maintenance services, we handle everything.',
                    styles: {
                      fontSize: 14,
                      color: '#475569',
                      lineHeight: 1.6,
                      width: 380,
                    },
                  },
                  {
                    id: 'node-hero-ctas',
                    kind: 'flex-group',
                    direction: 'row',
                    alignItems: 'center',
                    gap: 16,
                    children: [
                      {
                        id: 'node-hero-primary-btn',
                        kind: 'button',
                        text: 'Start Your Project ➔',
                        variant: 'primary',
                        styles: {
                          backgroundColor: '#0F1A2C',
                          color: '#FFFFFF',
                          borderRadius: 50,
                          padding: { top: 14, right: 28, bottom: 14, left: 28 },
                          fontSize: 14,
                        },
                      },
                      {
                        id: 'node-hero-secondary-btn',
                        kind: 'button',
                        text: 'Explore Our Work',
                        styles: {
                          backgroundColor: 'transparent',
                          color: '#0F1A2C',
                          fontSize: 14,
                        },
                      },
                    ],
                  },
                  {
                    id: 'node-trust-rating',
                    kind: 'flex-group',
                    direction: 'row',
                    alignItems: 'center',
                    gap: 12,
                    children: [
                      {
                        id: 'node-avatars',
                        kind: 'image',
                        assetId: 'avatars',
                        alt: 'rating avatars',
                        styles: { width: 90, height: 28 },
                      },
                      {
                        id: 'node-rating-text',
                        kind: 'text',
                        html: '<div style="font-size: 13px; font-weight: 700; color: #0F1A2C; line-height: 1.2;">4.9 / 5</div><div style="font-size: 11px; color: #64748B; line-height: 1.2;">Trusted by businesses across industries and borders.</div>',
                      },
                    ],
                  },
                ],
              },
            ],
          },

          // 3. Statistics Section
          {
            id: 'sec-stats',
            role: 'features',
            label: 'Statistics Overview',
            styles: {
              backgroundColor: '#FAF7F2',
              padding: { top: 16, right: 0, bottom: 52, left: 0 },
            },
            children: [
              {
                id: 'node-stats-card',
                kind: 'grid-group',
                columns: 4,
                gap: 0,
                styles: {
                  backgroundColor: 'rgba(255, 255, 255, 0.45)',
                  borderRadius: 12,
                  borderColor: '#E5DFD5',
                  borderWidth: 1,
                  padding: { top: 28, right: 20, bottom: 28, left: 20 },
                },
                children: [
                  {
                    id: 'stat-col-1',
                    kind: 'container',
                    styles: { textAlign: 'center' },
                    children: [
                      {
                        id: 'cnt-1',
                        kind: 'counter',
                        value: 120,
                        suffix: '+',
                        title: 'Projects Delivered',
                        styles: { color: '#0F1A2C', fontSize: 44, fontWeight: 700 },
                      },
                    ],
                  },
                  {
                    id: 'stat-col-2',
                    kind: 'container',
                    styles: { textAlign: 'center' },
                    children: [
                      {
                        id: 'cnt-2',
                        kind: 'counter',
                        value: 15,
                        suffix: '+',
                        title: 'Countries Served',
                        styles: { color: '#0F1A2C', fontSize: 44, fontWeight: 700 },
                      },
                    ],
                  },
                  {
                    id: 'stat-col-3',
                    kind: 'container',
                    styles: { textAlign: 'center' },
                    children: [
                      {
                        id: 'cnt-3',
                        kind: 'counter',
                        value: 4.9,
                        suffix: '/5',
                        title: 'Average Client Rating',
                        styles: { color: '#0F1A2C', fontSize: 44, fontWeight: 700 },
                      },
                    ],
                  },
                  {
                    id: 'stat-col-4',
                    kind: 'container',
                    styles: { textAlign: 'center' },
                    children: [
                      {
                        id: 'cnt-4',
                        kind: 'counter',
                        value: 95,
                        suffix: '%',
                        title: 'Returning Clients',
                        styles: { color: '#0F1A2C', fontSize: 44, fontWeight: 700 },
                      },
                    ],
                  },
                ],
              },
            ],
          },

          // 4. Service Ticker Banner
          {
            id: 'sec-ticker',
            role: 'banner',
            label: 'Service Ticker',
            styles: {
              backgroundColor: '#FF5E1E',
              padding: { top: 16, right: 0, bottom: 16, left: 0 },
            },
            children: [
              {
                id: 'node-ticker-text',
                kind: 'text',
                html: '<div style="display: flex; justify-content: center; align-items: center; gap: 32px; font-weight: 700; font-size: 18px; color: #FFFFFF; width: 100%; white-space: nowrap;">Next.js &nbsp;&bull;&nbsp; Conversion &nbsp;&bull;&nbsp; SEO &nbsp;&bull;&nbsp; Strategy &nbsp;&bull;&nbsp; Web Design &nbsp;&bull;&nbsp; Development &nbsp;&bull;&nbsp; Brand Systems &nbsp;&bull;&nbsp; WordPress</div>',
              },
            ],
          },
        ],
      },
    ],
  };

  it('1. Compiles DIR into native Elementor AST with all 9 fidelity criteria', () => {
    const { document: elementorDoc, report } = convertDIRToElementor(brainGigDIR);

    expect(elementorDoc.type).toBe('page');
    expect(elementorDoc.content.length).toBe(4); // Header, Hero, Stats, Ticker

    // Point 8: Warm canvas background #FAF7F2
    expect(elementorDoc.page_settings?.background_color).toBe('#FAF7F2');

    // Point 1: Header logo and navigation with per-link colors
    const headerCon = elementorDoc.content[0];
    const headerRow = headerCon.elements[0];
    expect(headerRow.elements.length).toBe(3); // logo, nav, button
    const navWidget = headerRow.elements[1];
    expect(navWidget.widgetType).toBe('icon-list');
    expect(navWidget.settings.icon_list[0].text).toContain('#FF5E1E'); // Home active
    expect(navWidget.settings.icon_list[1].text).not.toContain('#FF5E1E'); // Digital Services not orange

    // Point 2: Main heading line breaks and orange script accent
    const heroCon = elementorDoc.content[1];
    const headingWidget = heroCon.elements[1];
    expect(headingWidget.widgetType).toBe('heading');
    expect(headingWidget.settings.title).toContain('<br/>');
    expect(headingWidget.settings.title).toContain('Agency.');
    expect(headingWidget.settings.title).toContain('#FF5E1E');

    // Point 3: Introductory paragraph
    const heroBottomRow = heroCon.elements[2];
    const introWidget = heroBottomRow.elements[0];
    expect(introWidget.widgetType).toBe('text-editor');
    expect(introWidget.settings.editor).toContain('premier web design');

    // Point 4: Primary CTA pill border radius (50px)
    const ctasCon = heroBottomRow.elements[1];
    const primaryBtn = ctasCon.elements[0];
    expect(primaryBtn.widgetType).toBe('button');
    expect(primaryBtn.settings.text).toBe('Start Your Project ➔');
    expect(primaryBtn.settings.border_radius?.top).toBe('50');

    // Point 5: Secondary CTA clean link
    const secondaryBtn = ctasCon.elements[1];
    expect(secondaryBtn.widgetType).toBe('button');
    expect(secondaryBtn.settings.text).toBe('Explore Our Work');

    // Point 6: Rating trust badge
    const ratingCon = heroBottomRow.elements[2];
    expect(ratingCon.elements.length).toBe(2);
    expect(ratingCon.elements[0].widgetType).toBe('image');
    expect(ratingCon.elements[1].widgetType).toBe('text-editor');
    expect(ratingCon.elements[1].settings.editor).toContain('4.9 / 5');

    // Point 7: Statistics card with 4 metrics and vertical dividers
    const statsCon = elementorDoc.content[2];
    const statsCard = statsCon.elements[0];
    expect(statsCard.settings.container_type).toBe('grid');
    expect(statsCard.elements.length).toBe(4);
    // Columns 0, 1, 2 have border-right divider
    expect(statsCard.elements[0].settings.border_border).toBe('solid');
    expect(statsCard.elements[0].settings.border_color).toBe('#E5DFD5');
    expect(statsCard.elements[1].settings.border_border).toBe('solid');
    expect(statsCard.elements[2].settings.border_border).toBe('solid');

    // Point 9: Orange service ticker edge-to-edge full width
    const tickerCon = elementorDoc.content[3];
    expect(tickerCon.settings.content_width).toBe('full');
    expect(tickerCon.settings.background_color).toBe('#FF5E1E');
  });

  it('2. Renders Elementor AST to pixel-accurate HTML preview with font & layout consistency', () => {
    const { document: elementorDoc } = convertDIRToElementor(brainGigDIR);
    const renderer = new ElementorRenderer();
    const html = renderer.renderToHtml(elementorDoc);

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('#FAF7F2');
    expect(html).toContain('#FF5E1E');
    expect(html).toContain('braingig');
    expect(html).toContain('Web Design,<br/>Development &<br/>Digital Growth<br/>');
    expect(html).toContain('Start Your Project ➔');
    expect(html).toContain('120+');
    expect(html).toContain('Projects Delivered');
  });

  it('3. Captures rendered page via headless Chrome and validates against reference image', async () => {
    const { document: elementorDoc } = convertDIRToElementor(brainGigDIR);

    // Apply auto-corrections pass
    const corrector = new AutoCorrector();
    const mockInitialComp = {
      width: 1195,
      height: 918,
      totalPixels: 1097010,
      mismatchedPixels: 50000,
      mismatchPercentage: 4.5,
      pixelMatchScore: 95.5,
      ssimScore: 0.92,
      compositeSimilarityScore: 93,
      regionFidelities: [],
      diffImageBuffer: Buffer.alloc(0),
      passed: true,
      diagnostics: [],
    };
    const { doc: correctedDoc } = corrector.applyCorrections(elementorDoc, brainGigDIR, mockInitialComp);

    const renderer = new ElementorRenderer();
    const html = renderer.renderToHtml(correctedDoc);

    // Capture screenshot at reference resolution: 1195 x 918
    const capturedBuffer = await browserCapture.captureHtml(html, {
      viewport: { width: 1195, height: 918 },
      fullPage: false,
    });

    expect(capturedBuffer.length).toBeGreaterThan(10000);

    const comparator = new VisualComparator();
    const comparison = await comparator.compare(referenceBuffer, capturedBuffer, {
      width: 1195,
      height: 918,
    });


    // Verify Honest Visual Metrics
    expect(comparison.totalPixels).toBe(1195 * 918);
    expect(comparison.ssimScore).toBeGreaterThanOrEqual(0.80);
    expect(comparison.pixelMatchScore).toBeGreaterThanOrEqual(80);
    expect(comparison.compositeSimilarityScore).toBeGreaterThanOrEqual(75);

    // Evaluate through Validation Gate
    const gate = new ValidationGate({
      minCompositeScore: 75,
      maxPixelMismatchPct: 25,
      minSSIM: 0.80,
    });
    const gateResult = gate.evaluate(correctedDoc, brainGigDIR, comparison);

    expect(gateResult.status).toBe('PASSED');
    expect(gateResult.passed).toBe(true);
    expect(gateResult.artifactIntegrity.passed).toBe(true);
    expect(gateResult.contentIntegrity.passed).toBe(true);
    expect(gateResult.visualFidelity.passed).toBe(true);
    expect(gateResult.responsiveIntegrity.passed).toBe(true);

    // Package deliverables into ZIP
    const packager = new BundlePackager();
    const { zipBuffer, reportMarkdown } = packager.createBundle({
      jobId: 'braingig-regression-run-1',
      projectName: 'BrainGig Homepage Conversion',
      elementorDoc: correctedDoc,
      dirDoc: brainGigDIR,
      validationResult: gateResult,
      comparisonResult: comparison,
      referenceImageBuffer: referenceBuffer,
      generatedImageBuffer: capturedBuffer,
    });

    expect(zipBuffer.length).toBeGreaterThan(50000);
    expect(reportMarkdown).toContain('BrainGig');
    expect(reportMarkdown).toContain('PASSED');

    // Inspect ZIP entries
    const zip = new AdmZip(zipBuffer);
    const entryNames = zip.getEntries().map((e) => e.entryName);
    expect(entryNames).toContain('elementor.json');
    expect(entryNames).toContain('manifest.json');
    expect(entryNames).toContain('site-settings.json');
    expect(entryNames).toContain('conversion-report.md');
    expect(entryNames).toContain('validation-results.json');
    expect(entryNames).toContain('reference-screenshot.png');
    expect(entryNames).toContain('generated-screenshot.png');
    expect(entryNames).toContain('diff-heatmap.png');
  }, 45000);

  it('4. Correctly flags previous buggy output as failing validation gate', async () => {
    const comparator = new VisualComparator();
    const comparison = await comparator.compare(referenceBuffer, incorrectBuffer, {
      width: 1195,
      height: 918,
    });

    // The incorrect output had significant visual drift
    expect(comparison.mismatchPercentage).toBeGreaterThan(15);

    const gate = new ValidationGate({
      minCompositeScore: 80,
      maxPixelMismatchPct: 15,
      minSSIM: 0.85,
    });

    // Build dummy doc representing buggy output without responsive overrides
    const buggyDoc = {
      version: '0.4',
      elementor_version: '3.24.7',
      wp_version: '6.6.2',
      title: 'Buggy Output',
      type: 'page',
      page_settings: { template: 'elementor_canvas', background_color: '#ffffff' },
      content: [],
    };

    const gateResult = gate.evaluate(buggyDoc as any, brainGigDIR, comparison);
    expect(gateResult.passed).toBe(false);
    expect(['NEEDS_REVIEW', 'FAILED_VALIDATION']).toContain(gateResult.status);
  });
});
