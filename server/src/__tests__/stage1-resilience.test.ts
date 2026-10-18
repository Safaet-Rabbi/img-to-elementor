import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { checkMagicBytes, validateImage, SUPPORTED_MIME_TYPES } from '../modules/storage/image-processor.js';
import { parseDIRFromAIOutput, validateDIR } from '../modules/dir/schema.js';
import { convertDIRToElementor } from '../modules/elementor/generator.js';
import { validateElementor } from '../modules/elementor/validator.js';
import { GeminiAdapter } from '../modules/ai/providers/gemini.js';

describe('Stage 1 Resilience & Zero-Failure Hardening Suite', () => {
  describe('1. WebP Image Format & Magic Bytes Verification', () => {
    it('recognizes image/webp in supported MIME types', () => {
      expect(SUPPORTED_MIME_TYPES).toContain('image/webp');
    });

    it('validates a real WebP buffer through checkMagicBytes and validateImage', async () => {
      // Create a small 100x100 WebP buffer using Sharp
      const webpBuffer = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 4,
          background: { r: 59, g: 130, b: 246, alpha: 1 },
        },
      })
        .webp()
        .toBuffer();

      const magic = checkMagicBytes(webpBuffer);
      expect(magic).toBe('image/webp');

      const validation = await validateImage(webpBuffer);
      expect(validation.width).toBe(100);
      expect(validation.height).toBe(100);
      expect(validation.format).toBe('webp');
    });
  });

  describe('2. Fault-Tolerant Dirty JSON Sanitization in parseDIRFromAIOutput', () => {
    it('parses JSON with trailing commas, smart quotes, and comments', () => {
      const dirtyJson = `
      \`\`\`json
      // AI response with comments
      {
        "version": "1.0.0",
        "meta": {
          "sourceImageHash": "hash123",
          "sourceWidth": 1440,
          "sourceHeight": 900,
          "analysisProvider": "gemini",
          "analysisModel": "gemini-3.8-flash",
          "analysisTimestamp": "2026-10-18T00:00:00Z",
          "confidenceScore": 0.95,
          "schemaVersion": "1.0.0",
          "promptVersion": "v1.0.0",
        },
        "breakpoints": {
          "desktop": { "min": 1024 },
        },
        "globals": {
          "colors": {
            "background": "#ffffff",
            "text": "#000000",
          },
          "typography": {
            "fontFamilies": ["Inter"],
          },
        },
        "assets": [],
        "pages": [
          {
            "id": "p1",
            "name": “Home”,
            "sections": [
              {
                "id": "s1",
                "role": "hero",
                "confidence": 0.9,
                "styles": { "backgroundColor": "#ffffff", },
                "children": [],
              },
            ],
          },
        ],
      }
      \`\`\`
      `;

      const result = parseDIRFromAIOutput(dirtyJson);
      expect('error' in result).toBe(false);
      if ('parsed' in result) {
        const val = validateDIR(result.parsed);
        expect(val.valid).toBe(true);
      }
    });

    it('gracefully returns error on fundamentally truncated fragment without crashing', () => {
      const truncated = '{"version": "1.0.0", "meta": {"sourceWidth": 1440';
      const result = parseDIRFromAIOutput(truncated);
      expect('error' in result).toBe(true);
    });
  });

  describe('3. Gemini Adapter Timeout & Safety Settings Verification', () => {
    it('initializes with defaultTimeoutMs of 120,000ms', () => {
      const adapter = new GeminiAdapter({ apiKey: 'test-key' });
      expect((adapter as any).defaultTimeoutMs).toBe(120000);
    });
  });

  describe('4. Resilient Fallback DIR Document Schema & AST Validation', () => {
    it('guarantees that synthesized fallback DIR passes schema validation and elementor conversion', () => {
      const fallbackDoc: any = {
        version: '1.0.0',
        meta: {
          sourceImageHash: 'fallback-hash',
          sourceWidth: 1440,
          sourceHeight: 900,
          analysisProvider: 'resilient_synthesizer',
          analysisModel: 'deterministic-fallback',
          analysisTimestamp: new Date().toISOString(),
          confidenceScore: 0.85,
          schemaVersion: '1.0.0',
          promptVersion: 'fallback-v1',
          notes: ['Synthesized fallback DIR to guarantee zero pipeline failure.'],
        },
        breakpoints: {
          desktop: { min: 1024 },
          tablet: { min: 768, max: 1023 },
          mobile: { min: 0, max: 767 },
        },
        globals: {
          colors: {
            primary: '#3B82F6',
            background: '#FFFFFF',
            text: '#111827',
            surface: '#F3F4F6',
          },
          typography: {
            fontFamilies: ['Inter', 'sans-serif'],
            headingFont: 'Inter',
            bodyFont: 'Inter',
            baseSize: 16,
            scale: 1.25,
          },
          spacing: {
            unit: 'px',
            base: 16,
            sectionGap: 64,
            containerMaxWidth: 1200,
          },
        },
        assets: [],
        pages: [
          {
            id: 'page_main',
            name: 'Resilient Site',
            sections: [
              {
                id: 'sec_header',
                role: 'header',
                confidence: 0.9,
                styles: {
                  backgroundColor: '#FFFFFF',
                  padding: { top: 20, bottom: 20, left: 32, right: 32 },
                  flexDirection: 'row',
                },
                children: [
                  {
                    id: 'node_brand',
                    kind: 'heading',
                    text: 'Resilient Site',
                    level: 3,
                    confidence: 0.9,
                    styles: { fontSize: 22, fontWeight: 700, color: '#111827' },
                  },
                ],
              },
              {
                id: 'sec_hero',
                role: 'hero',
                confidence: 0.9,
                styles: {
                  backgroundColor: '#FFFFFF',
                  padding: { top: 64, bottom: 64, left: 32, right: 32 },
                },
                children: [
                  {
                    id: 'node_hero_title',
                    kind: 'heading',
                    text: 'Welcome to Resilient Site',
                    level: 1,
                    confidence: 0.95,
                    styles: { fontSize: 48, fontWeight: 800, color: '#111827' },
                  },
                  {
                    id: 'node_hero_desc',
                    kind: 'text',
                    html: '<p>Built with robust fallbacks.</p>',
                    text: 'Built with robust fallbacks.',
                    confidence: 0.9,
                    styles: { fontSize: 18, color: '#111827' },
                  },
                  {
                    id: 'node_hero_btn',
                    kind: 'button',
                    text: 'Get Started',
                    confidence: 0.9,
                    styles: { backgroundColor: '#3B82F6', color: '#FFFFFF' },
                  },
                ],
              },
            ],
          },
        ],
      };

      const val = validateDIR(fallbackDoc);
      expect(val.valid).toBe(true);

      const { document: elementorDoc, report } = convertDIRToElementor(fallbackDoc);
      expect(elementorDoc).toBeDefined();
      expect(report.elementCount).toBeGreaterThan(0);

      const elVal = validateElementor(elementorDoc);
      expect(elVal.valid).toBe(true);
    });
  });
});
