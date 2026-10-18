import { describe, it, expect } from 'vitest';
import { ElementorRenderer } from '../modules/rendering/elementor-renderer.js';
import { VisualComparator } from '../modules/comparison/visual-comparator.js';
import { AutoCorrector } from '../modules/correction/auto-corrector.js';
import { ValidationGate } from '../modules/validation/validation-gate.js';
import { BundlePackager } from '../modules/packages/bundle-packager.js';
import type { ElementorDocument } from '../modules/elementor/types.js';
import type { DIRDocument } from '../modules/dir/types.js';
import AdmZip from 'adm-zip';
import sharp from 'sharp';

describe('Closed-Loop Fidelity Pipeline Modules', () => {
  const sampleElementorDoc: ElementorDocument = {
    version: '0.4',
    elementor_version: '3.24.7',
    wp_version: '6.6.2',
    title: 'Test Landing',
    type: 'page',
    page_settings: {
      template: 'elementor_canvas',
      background_background: 'classic',
      background_color: '#FAF7F2',
    },
    content: [
      {
        id: 'con1234',
        elType: 'container',
        settings: {
          container_type: 'flex',
          flex_direction: 'column',
          content_width: 'boxed',
          boxed_width: { unit: 'px', size: 1200 },
          boxed_width_tablet: { unit: 'px', size: 768 },
          boxed_width_mobile: { unit: 'px', size: 360 },
          background_color: '#FAF7F2',
          padding: { top: 32, right: 32, bottom: 32, left: 32, unit: 'px' },
        },
        elements: [
          {
            id: 'hdg1234',
            elType: 'widget',
            widgetType: 'heading',
            settings: {
              title: 'Web Design,\nDevelopment &\nDigital Growth\nAgency.',
              header_size: 'h1',
              title_color: '#0F1A2C',
              typography_font_size: { unit: 'px', size: 64 },
              typography_font_weight: '700',
            },
            elements: [],
          },
          {
            id: 'btn1234',
            elType: 'widget',
            widgetType: 'button',
            settings: {
              text: 'Start Your Project ➔',
              background_color: '#0F1A2C',
              button_text_color: '#FFFFFF',
              border_radius: { unit: 'px', top: '50', right: '50', bottom: '50', left: '50', isLinked: true },
            },
            elements: [],
          },
        ],
      },
    ],
  };

  const sampleDirDoc: any = {
    version: '1.0.0',
    meta: {
      sourceImageHash: 'testhash123',
      sourceWidth: 1440,
      sourceHeight: 900,
      analysisProvider: 'test',
      analysisModel: 'test-model',
      analysisTimestamp: new Date().toISOString(),
      confidenceScore: 0.95,
      schemaVersion: '1.0.0',
      promptVersion: 'v2.0.0',
    },
    breakpoints: { desktop: { min: 1024 }, tablet: { min: 768, max: 1023 }, mobile: { min: 320, max: 767 } },
    globals: {
      colors: { background: '#FAF7F2', text: '#0F1A2C', primary: '#FF5E1E' },
      spacing: { unit: 'px', base: 8, sectionGap: 64, containerMaxWidth: 1200 },
    },
    assets: [],
    pages: [
      {
        id: 'p1',
        name: 'Home',
        sections: [
          {
            id: 's1',
            role: 'hero',
            label: 'Hero',
            styles: { backgroundColor: '#FAF7F2' },
            children: [
              {
                id: 'n1',
                kind: 'heading',
                text: 'Web Design,\nDevelopment &\nDigital Growth\nAgency.',
                level: 1,
                styles: { color: '#0F1A2C' },
              },
            ],
          },
        ],
      },
    ],
  };

  it('ElementorRenderer generates valid HTML with flexbox and typography styles', () => {
    const renderer = new ElementorRenderer();
    const html = renderer.renderToHtml(sampleElementorDoc);

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('#FAF7F2');
    expect(html).toContain('e-con-boxed');
    expect(html).toContain('Web Design,<br/>Development &<br/>Digital Growth<br/>Agency.');
    expect(html).toContain('Start Your Project ➔');
  });

  it('VisualComparator accurately computes pixel diff, SSIM, and region fidelity', async () => {
    const comparator = new VisualComparator();

    // Create 2 test buffers using sharp
    const buf1 = await sharp({
      create: {
        width: 200,
        height: 200,
        channels: 4,
        background: { r: 250, g: 247, b: 242, alpha: 1 },
      },
    }).png().toBuffer();

    const buf2 = await sharp({
      create: {
        width: 200,
        height: 200,
        channels: 4,
        background: { r: 250, g: 247, b: 242, alpha: 1 },
      },
    }).png().toBuffer();

    const comparison = await comparator.compare(buf1, buf2, { width: 200, height: 200 });

    expect(comparison.totalPixels).toBe(40000);
    expect(comparison.mismatchedPixels).toBe(0);
    expect(comparison.pixelMatchScore).toBe(100);
    expect(comparison.ssimScore).toBeGreaterThanOrEqual(0.99);
    expect(comparison.passed).toBe(true);
    expect(comparison.diffImageBuffer.length).toBeGreaterThan(0);
  });

  it('AutoCorrector repairs heading linebreaks and accent font styling', () => {
    const corrector = new AutoCorrector();
    const testComparison = {
      width: 1440,
      height: 900,
      totalPixels: 1296000,
      mismatchedPixels: 20000,
      mismatchPercentage: 15,
      pixelMatchScore: 85,
      ssimScore: 0.88,
      compositeSimilarityScore: 86,
      regionFidelities: [],
      diffImageBuffer: Buffer.alloc(0),
      passed: false,
      diagnostics: ['Hero region variance'],
    };

    const { doc, corrections } = corrector.applyCorrections(sampleElementorDoc, sampleDirDoc, testComparison);

    expect(corrections.length).toBeGreaterThan(0);
    const heading = doc.content[0].elements[0];
    expect(heading.settings.title).toContain('<br/>');
    expect(heading.settings.title).toContain('style="color: #FF5E1E;');
  });

  it('ValidationGate performs honest multi-dimensional gate scoring', () => {
    const gate = new ValidationGate({
      minCompositeScore: 75,
      maxPixelMismatchPct: 25,
      minSSIM: 0.80,
    });

    const mockComparison = {
      width: 1440,
      height: 900,
      totalPixels: 1296000,
      mismatchedPixels: 100000,
      mismatchPercentage: 7.7,
      pixelMatchScore: 92.3,
      ssimScore: 0.91,
      compositeSimilarityScore: 91.5,
      regionFidelities: [
        { regionName: 'header', yStartPct: 0, yEndPct: 0.14, mismatchPct: 5, matchScore: 95, passed: true },
      ],
      diffImageBuffer: Buffer.alloc(0),
      passed: true,
      diagnostics: [],
    };

    const result = gate.evaluate(sampleElementorDoc, sampleDirDoc, mockComparison);


    expect(result.status).toBe('PASSED');
    expect(result.passed).toBe(true);
    expect(result.overallScore).toBeGreaterThanOrEqual(80);
    expect(result.artifactIntegrity.passed).toBe(true);
    expect(result.visualFidelity.passed).toBe(true);
  });

  it('BundlePackager generates complete deliverable ZIP with manifest, elementor.json and report', () => {
    const packager = new BundlePackager();
    const mockVal = {
      status: 'PASSED' as const,
      overallScore: 92,
      passed: true,
      artifactIntegrity: { name: 'Artifact', passed: true, score: 100, message: 'OK' },
      contentIntegrity: { name: 'Content', passed: true, score: 95, message: 'OK' },
      visualFidelity: { name: 'Visual', passed: true, score: 90, message: 'OK' },
      responsiveIntegrity: { name: 'Responsive', passed: true, score: 90, message: 'OK' },
      diagnostics: [],
      summary: 'PASSED with high fidelity',
    };

    const { zipBuffer, reportMarkdown } = packager.createBundle({
      jobId: 'job-unit-test-1',
      projectName: 'BrainGig Unit Test',
      elementorDoc: sampleElementorDoc,
      dirDoc: sampleDirDoc,
      validationResult: mockVal,
    });

    expect(zipBuffer.length).toBeGreaterThan(100);
    expect(reportMarkdown).toContain('# BrainGig Design-to-Elementor Conversion & Quality Report');

    // Verify zip contents
    const zip = new AdmZip(zipBuffer);
    const entries = zip.getEntries().map((e) => e.entryName);
    expect(entries).toContain('elementor.json');
    expect(entries).toContain('manifest.json');
    expect(entries).toContain('site-settings.json');
    expect(entries).toContain('conversion-report.md');
    expect(entries).toContain('validation-results.json');
  });
});
