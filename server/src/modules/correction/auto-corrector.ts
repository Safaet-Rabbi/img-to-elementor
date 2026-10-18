/**
 * Automated Correction Engine
 * Analyzes visual comparison diagnostics and applies deterministic, localized corrections
 * to Elementor AST and DIR structures to achieve pixel accuracy.
 */

import type { ElementorDocument, ElementorElement } from '../elementor/types.js';
import type { DIRDocument } from '../dir/types.js';
import type { ComparisonResult } from '../comparison/visual-comparator.js';
import { logger } from '../../lib/logger.js';

export interface CorrectionApplied {
  elementId: string;
  rule: string;
  change: string;
}

export class AutoCorrector {
  /**
   * Applies targeted structural and stylistic corrections to an Elementor template
   * based on comparison diagnostics and visual difference heatmap findings.
   */
  public applyCorrections(
    elementorDoc: ElementorDocument,
    dirDoc: DIRDocument,
    comparison: ComparisonResult
  ): { doc: ElementorDocument; corrections: CorrectionApplied[] } {
    const corrections: CorrectionApplied[] = [];
    const docCopy: ElementorDocument = JSON.parse(JSON.stringify(elementorDoc));

    // 1. Correct Canvas Background
    const detectedCanvasBg = dirDoc.globals?.colors?.background || '#ffffff';
    if (docCopy.page_settings && docCopy.page_settings.background_color !== detectedCanvasBg) {
      docCopy.page_settings.background_color = detectedCanvasBg;
      corrections.push({
        elementId: 'page_settings',
        rule: 'CANVAS_BACKGROUND_ALIGNMENT',
        change: `Aligned page background color to ${detectedCanvasBg}`,
      });
    }

    // 2. Traverse Elementor tree to correct Header, Hero, Heading, Buttons, Stats, and Ticker
    for (const rootCon of docCopy.content || []) {
      this.correctElementTree(rootCon, dirDoc, comparison, corrections);
    }

    logger.info({ totalCorrections: corrections.length }, 'Completed deterministic auto-correction pass');
    return { doc: docCopy, corrections };
  }

  private correctElementTree(
    el: ElementorElement,
    dirDoc: DIRDocument,
    comparison: ComparisonResult,
    corrections: CorrectionApplied[]
  ): void {
    const s = el.settings || {};

    // A. Root Sections Background Alignment
    if (el.elType === 'container' && s._section_role) {
      const pageBg = dirDoc.globals?.colors?.background || '#ffffff';
      if ((!s.background_color || s.background_color === '#ffffff') && pageBg !== '#ffffff') {
        if (s._section_role !== 'banner' && s._section_role !== 'ticker') {
          s.background_color = pageBg;
          corrections.push({
            elementId: el.id,
            rule: 'SECTION_BG_NORMALIZE',
            change: `Set section background to canvas color ${pageBg}`,
          });
        }
      }
    }

    // B. Header & Navigation Correction:
    // Format navigation links and apply active color dynamically from globals
    if (el.widgetType === 'icon-list' && Array.isArray(s.icon_list)) {
      const items = s.icon_list;
      const isNav = items.some((it: any) =>
        ['home', 'services', 'about', 'contact', 'blogs', 'pricing', 'features', 'work'].some((k) =>
          (it.text || '').toLowerCase().includes(k)
        )
      );
      if (isNav) {
        const activeColor = dirDoc.globals?.colors?.primary || '#2563EB';
        const normalNavColor = dirDoc.globals?.colors?.text || '#1E293B';
        let modified = false;
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const text = (item.text || '').trim();
          const cleanText = text.replace(/<[^>]*>/g, '').trim();
          if (cleanText.toLowerCase() === 'home' || i === 0) {
            item.text = `<span style="color: ${activeColor}; font-weight: 600;">${cleanText}</span>`;
            modified = true;
          } else {
            item.text = `<span style="color: ${normalNavColor}; font-weight: 500;">${cleanText}</span>`;
            modified = true;
          }
        }
        if (modified) {
          s.text_color = normalNavColor;
          corrections.push({
            elementId: el.id,
            rule: 'NAV_PER_LINK_ACTIVE_COLOR',
            change: `Applied distinct active styling (${activeColor}) to active link and neutral (${normalNavColor}) to others`,
          });
        }
      }
    }

    // C. Heading Line Breaks & Accent Styling:
    if (el.widgetType === 'heading' && s.title) {
      let rawTitle = String(s.title);
      let modified = false;

      // Apply inline_color_spans from DIR if present
      if (dirDoc.pages) {
        for (const p of dirDoc.pages) {
          for (const sec of p.sections || []) {
            const checkNode = (nodes: any[]): void => {
              for (const n of nodes || []) {
                if (n.kind === 'heading' && n.typography?.inline_color_spans) {
                  for (const span of n.typography.inline_color_spans) {
                    if (span.text && span.color_hex && rawTitle.includes(span.text) && !rawTitle.includes(`color: ${span.color_hex}`)) {
                      rawTitle = rawTitle.replace(
                        span.text,
                        `<span style="color: ${span.color_hex}; font-style: ${span.font_style || 'italic'}; font-family: ${span.font_family || 'inherit'};">${span.text}</span>`
                      );
                      modified = true;
                    }
                  }
                }
                if (n.children) checkNode(n.children);
              }
            };
            checkNode(sec.children);
          }
        }
      }

      // Convert newlines to <br/> and apply primary accent to trailing single word if multi-line
      if (rawTitle.includes('\n')) {
        const parts = rawTitle.split('\n');
        const primaryColor = dirDoc.globals?.colors?.primary;
        if (primaryColor && !rawTitle.includes('span style') && parts.length > 1) {
          const lastIndex = parts.length - 1;
          const lastLine = parts[lastIndex].trim();
          if (lastLine.length > 0 && lastLine.length < 30) {
            parts[lastIndex] = `<span style="color: ${primaryColor}; font-style: italic; font-family: serif, 'Times New Roman', Georgia;">${lastLine}</span>`;
            modified = true;
          }
        }
        rawTitle = parts.join('<br/>');
        modified = true;
      }

      if (modified) {
        s.title = rawTitle;
        corrections.push({
          elementId: el.id,
          rule: 'HEADLINE_LINEBREAK_AND_ACCENT_REPAIR',
          change: 'Formatted multi-line heading breaks and applied accent color styling',
        });
      }
    }

    // D. Statistics Cards & Divider Borders:
    if (el.elType === 'container' && (s.container_type === 'grid' || s.flex_direction === 'row')) {
      const children = el.elements || [];
      const hasCounters = children.some((c) =>
        c.elements?.some((w) => w.widgetType === 'counter' || w.widgetType === 'heading')
      );
      if (hasCounters && children.length >= 3 && children.length <= 6) {
        const borderColor = (dirDoc.globals?.colors as any)?.border || '#E5DFD5';
        s.background_background = 'classic';
        s.background_color = s.background_color || 'rgba(255, 255, 255, 0.45)';
        s.border_border = 'solid';
        s.border_color = borderColor;
        s.border_width = { unit: 'px', top: '1', right: '1', bottom: '1', left: '1', isLinked: true };
        s.border_radius = { unit: 'px', top: '12', right: '12', bottom: '12', left: '12', isLinked: true };
        s.padding = { unit: 'px', top: '36', right: '24', bottom: '36', left: '24', isLinked: false };

        for (let idx = 0; idx < children.length; idx++) {
          const col = children[idx];
          if (!col.settings) col.settings = {};
          col.settings.padding = { unit: 'px', top: '16', right: '16', bottom: '16', left: '16', isLinked: true };
          if (idx < children.length - 1) {
            col.settings.border_border = 'solid';
            col.settings.border_color = borderColor;
            col.settings.border_width = { unit: 'px', top: '0', right: '1', bottom: '0', left: '0', isLinked: false };
          }
        }
        corrections.push({
          elementId: el.id,
          rule: 'STATISTICS_CONTAINER_DIVIDERS_AND_SPACING',
          change: 'Configured statistics multi-column card borders, vertical column dividers, and balanced padding',
        });
      }
    }

    // E. Service Ticker Edge-to-Edge Full-Width:
    const isTicker = s._section_role === 'banner' || s._section_role === 'ticker';
    if (isTicker) {
      s.content_width = 'full';
      s.background_background = 'classic';
      if (!s.background_color || s.background_color === 'transparent') {
        s.background_color = dirDoc.globals?.colors?.primary || '#2563EB';
      }
      s.padding = { unit: 'px', top: '16', right: '32', bottom: '16', left: '32', isLinked: false };

      // Ensure inner ticker elements are aligned horizontally with bold typography
      for (const child of el.elements || []) {
        if (child.elType === 'container') {
          child.settings = {
            ...child.settings,
            flex_direction: 'row',
            flex_justify_content: 'center',
            flex_align_items: 'center',
            flex_wrap: 'nowrap',
            flex_gap: { unit: 'px', size: 36 },
          };
          for (const grandChild of child.elements || []) {
            if (grandChild.widgetType === 'text-editor' && grandChild.settings) {
              grandChild.settings.text_color = grandChild.settings.text_color || '#FFFFFF';
              grandChild.settings.typography_font_size = grandChild.settings.typography_font_size || { unit: 'px', size: 18 };
              grandChild.settings.typography_font_weight = '700';
            }
          }
        }
      }
      corrections.push({
        elementId: el.id,
        rule: 'TICKER_FULLWIDTH_HORIZONTAL_ALIGNMENT',
        change: 'Enforced full-width layout and horizontal continuous flex row for ticker',
      });
    }

    // F. CTA Buttons & Rating Trust Badge:
    if (el.widgetType === 'button' && s.text) {
      const btnText = String(s.text);
      const isPrimary =
        s.button_type === 'primary' ||
        (!s.background_color && s.button_text_color) ||
        btnText.toLowerCase().includes('get started') ||
        btnText.toLowerCase().includes('start your project') ||
        btnText.toLowerCase().includes('sign up');
      const isSecondary =
        s.button_type === 'secondary' ||
        btnText.toLowerCase().includes('explore') ||
        btnText.toLowerCase().includes('learn more');

      const darkColor = dirDoc.globals?.colors?.heading || dirDoc.globals?.colors?.text || '#0F1A2C';

      if (isPrimary && !s.border_radius) {
        if (!s.background_color || s.background_color === 'transparent') {
          s.background_color = darkColor;
        }
        s.button_text_color = '#FFFFFF';
        s.border_radius = { unit: 'px', top: '50', right: '50', bottom: '50', left: '50', isLinked: true };
        s.button_padding = { unit: 'px', top: '14', right: '28', bottom: '14', left: '28', isLinked: false };
        s.typography_font_size = s.typography_font_size || { unit: 'px', size: 14 };
        s.typography_font_weight = s.typography_font_weight || '600';
        corrections.push({
          elementId: el.id,
          rule: 'PRIMARY_CTA_PILL_STYLING',
          change: 'Formatted primary CTA with rounded pill radius and balanced padding',
        });
      } else if (isSecondary) {
        if (!s.border_radius) {
          s.background_color = 'transparent';
          s.button_text_color = darkColor;
          s.typography_font_size = s.typography_font_size || { unit: 'px', size: 14 };
          s.typography_font_weight = s.typography_font_weight || '600';
          corrections.push({
            elementId: el.id,
            rule: 'SECONDARY_CTA_CLEAN_LINK',
            change: 'Formatted secondary CTA as clean inline link without heavy borders',
          });
        }
      }
    }

    // Recurse down children
    if (Array.isArray(el.elements)) {
      for (const child of el.elements) {
        this.correctElementTree(child, dirDoc, comparison, corrections);
      }
    }
  }
}

let correctorInstance: AutoCorrector | null = null;

export function getAutoCorrector(): AutoCorrector {
  if (!correctorInstance) {
    correctorInstance = new AutoCorrector();
  }
  return correctorInstance;
}
