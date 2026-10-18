/**
 * Elementor-to-HTML Preview Renderer
 * Deterministically renders an Elementor template JSON structure into pixel-accurate HTML and CSS.
 * Faithfully applies Elementor Flexbox Container, Typography, Spacing, and Widget models.
 */

import fs from 'node:fs';
import path from 'node:path';
import type { ElementorDocument, ElementorElement } from '../elementor/types.js';

export interface RenderOptions {
  viewport?: { width: number; height: number };
  device?: 'desktop' | 'tablet' | 'mobile';
  storageRootDir?: string;
  assetUrlResolver?: (url: string) => string;
}

export class ElementorRenderer {
  private options: RenderOptions;

  constructor(options: RenderOptions = {}) {
    this.options = {
      device: 'desktop',
      viewport: { width: 1440, height: 900 },
      storageRootDir: path.resolve(process.cwd(), 'storage/uploads'),
      ...options,
    };
  }

  public renderToHtml(doc: ElementorDocument, options?: RenderOptions): string {
    const opts = { ...this.options, ...options };
    const device = opts.device || 'desktop';
    const pageBg = doc.page_settings?.background_color || '#ffffff';
    const renderOpts = { ...opts, pageBg };

    const renderedContent = (doc.content || [])
      .map((el) => this.renderElement(el, device, renderOpts, true))
      .join('\n');


    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(doc.title || 'Elementor Preview')}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    html, body {
      width: 100%;
      min-height: 100%;
      background-color: ${pageBg};
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #1e293b;
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      overflow-x: hidden;
    }
    .elementor-element {
      position: relative;
    }
    .e-con {
      display: flex;
      position: relative;
      width: 100%;
      box-sizing: border-box;
    }
    .e-con-boxed {
      align-items: center;
    }
    .e-con-inner {
      width: 100%;
      margin-left: auto;
      margin-right: auto;
      display: flex;
      box-sizing: border-box;
    }
    .e-con-full {
      width: 100%;
    }
    .elementor-widget {
      position: relative;
      width: auto;
      box-sizing: border-box;
    }
    .elementor-heading-title {
      margin: 0;
      padding: 0;
      line-height: 1.15;
    }
    .elementor-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      text-decoration: none;
      cursor: pointer;
      border: none;
      outline: none;
      white-space: nowrap;
      transition: all 0.2s ease-in-out;
    }
    .elementor-icon-list-items {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .elementor-inline-items {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
    }
    .elementor-icon-list-item {
      display: inline-flex;
      align-items: center;
    }
    .elementor-icon-list-item a {
      color: inherit;
      text-decoration: none;
    }
    img {
      max-width: 100%;
      height: auto;
      display: inline-block;
      vertical-align: middle;
    }
    .stat-counter-wrapper {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
    }
    .ticker-bar-container {
      width: 100vw;
      margin-left: calc(-50vw + 50%);
      margin-right: calc(-50vw + 50%);
      overflow: hidden;
      white-space: nowrap;
    }
  </style>
</head>
<body>
  <div id="elementor-preview-root" class="elementor elementor-page">
${renderedContent}
  </div>
</body>
</html>`;
  }

  private renderElement(
    el: ElementorElement,
    device: 'desktop' | 'tablet' | 'mobile',
    opts: RenderOptions,
    isRoot: boolean = false
  ): string {
    if (el.elType === 'container') {
      return this.renderContainer(el, device, opts, isRoot);
    }
    if (el.elType === 'widget') {
      return this.renderWidget(el, device, opts);
    }
    return '';
  }

  private renderContainer(
    el: ElementorElement,
    device: 'desktop' | 'tablet' | 'mobile',
    opts: RenderOptions,
    isRoot: boolean = false
  ): string {
    const s = el.settings || {};
    const isBoxed = isRoot ? s.content_width !== 'full' : s.content_width === 'boxed';
    const isGrid = s.container_type === 'grid';

    // Boxed widths
    let boxedWidth = 1120;
    if (device === 'tablet' && s.boxed_width_tablet?.size) {
      boxedWidth = s.boxed_width_tablet.size;
    } else if (device === 'mobile' && s.boxed_width_mobile?.size) {
      boxedWidth = s.boxed_width_mobile.size;
    } else if (s.boxed_width?.size) {
      boxedWidth = s.boxed_width.size;
    }

    // Direction
    let flexDir = s.flex_direction || 'column';
    if (device === 'tablet' && s.flex_direction_tablet) {
      flexDir = s.flex_direction_tablet;
    } else if (device === 'mobile' && s.flex_direction_mobile) {
      flexDir = s.flex_direction_mobile;
    }

    // Alignment and Justify
    const justify = this.cssJustify(s.flex_justify_content);
    const align = this.cssAlign(s.flex_align_items);
    const wrap = s.flex_wrap === 'wrap' ? 'wrap' : 'nowrap';

    // Gap
    let gap = this.resolveGap(s, device);

    // Padding & Margin
    const padding = this.resolveSpacing(s, 'padding', device);
    const margin = this.resolveSpacing(s, 'margin', device);

    // Background & Borders
    const fallbackBg = (opts as any).pageBg || '#ffffff';
    const bg = s.background_color || (s.background_background === 'classic' ? fallbackBg : 'transparent');
    const border = this.resolveBorder(s);
    const radius = this.resolveRadius(s);

    // Custom Width
    let customWidth = '';
    if (s.width?.size) {
      const u = s.width.unit || 'px';
      customWidth = `width: ${s.width.size}${u}; max-width: 100%;`;
    }

    const childHtml = (el.elements || [])
      .map((child) => this.renderElement(child, device, opts, false))
      .join('\n');

    const outerStyles = [
      `background-color: ${bg};`,
      padding ? `padding: ${padding};` : '',
      margin ? `margin: ${margin};` : '',
      border ? border : '',
      radius ? `border-radius: ${radius};` : '',
      customWidth,
    ].filter(Boolean).join(' ');

    if (isBoxed) {
      const innerStyles = [
        `max-width: ${boxedWidth}px;`,
        isGrid ? `display: grid; grid-template-columns: repeat(${s.grid_columns_grid?.size || 4}, 1fr);` : 'display: flex;',
        !isGrid ? `flex-direction: ${flexDir};` : '',
        !isGrid && justify ? `justify-content: ${justify};` : '',
        !isGrid && align ? `align-items: ${align};` : '',
        !isGrid ? `flex-wrap: ${wrap};` : '',
        gap ? `gap: ${gap};` : '',
        'width: 100%; margin-left: auto; margin-right: auto;',
      ].filter(Boolean).join(' ');

      return `    <div class="e-con e-con-boxed elementor-element-${el.id}" style="${outerStyles}">
      <div class="e-con-inner" style="${innerStyles}">
${childHtml}
      </div>
    </div>`;
    }

    // Full width container
    const fullStyles = [
      outerStyles,
      isGrid ? `display: grid; grid-template-columns: repeat(${s.grid_columns_grid?.size || 4}, 1fr);` : 'display: flex;',
      !isGrid ? `flex-direction: ${flexDir};` : '',
      !isGrid && justify ? `justify-content: ${justify};` : '',
      !isGrid && align ? `align-items: ${align};` : '',
      !isGrid ? `flex-wrap: ${wrap};` : '',
      gap ? `gap: ${gap};` : '',
    ].filter(Boolean).join(' ');

    return `    <div class="e-con e-con-full elementor-element-${el.id}" style="${fullStyles}">
${childHtml}
    </div>`;
  }

  private renderWidget(el: ElementorElement, device: 'desktop' | 'tablet' | 'mobile', opts: RenderOptions): string {
    const s = el.settings || {};
    const type = el.widgetType;

    switch (type) {
      case 'heading': {
        const tag = s.header_size || 'h2';
        const color = s.title_color || '#0F1A2C';
        const align = s.align || 'left';
        const typo = this.resolveTypography(s, device, { fontSize: 32, fontWeight: '700', lineHeight: 1.2 });
        // Format title preserving newlines as <br> if not already HTML
        let rawTitle = s.title || '';
        let titleHtml = rawTitle;
        if (!titleHtml.includes('<br') && titleHtml.includes('\n')) {
          titleHtml = titleHtml.replace(/\n/g, '<br/>');
        }

        return `      <div class="elementor-element elementor-widget elementor-widget-heading elementor-element-${el.id}" style="text-align: ${align};">
        <${tag} class="elementor-heading-title" style="color: ${color}; ${typo}">${titleHtml}</${tag}>
      </div>`;
      }

      case 'text-editor': {
        const color = s.text_color || '#475569';
        const align = s.align || 'left';
        const typo = this.resolveTypography(s, device, { fontSize: 15, fontWeight: '400', lineHeight: 1.6 });
        const content = s.editor || '';

        return `      <div class="elementor-element elementor-widget elementor-widget-text-editor elementor-element-${el.id}" style="color: ${color}; text-align: ${align}; ${typo}">
        ${content}
      </div>`;
      }

      case 'button': {
        const text = s.text || 'Click here';
        const bg = s.background_color || '#0F1A2C';
        const color = s.button_text_color || '#ffffff';
        const typo = this.resolveTypography(s, device, { fontSize: 14, fontWeight: '600' });
        const radius = this.resolveRadius(s, 'border_radius', '50px');
        const padding = this.resolveSpacing(s, 'button_padding', device) || '12px 24px';
        const isTransparent = bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)';

        return `      <div class="elementor-element elementor-widget elementor-widget-button elementor-element-${el.id}">
        <a href="${s.link?.url || '#'}" class="elementor-button" style="background-color: ${bg}; color: ${color}; border-radius: ${radius}; padding: ${padding}; ${typo} ${isTransparent ? 'box-shadow: none;' : 'box-shadow: 0 2px 4px rgba(0,0,0,0.08);'}">
          <span>${text}</span>
        </a>
      </div>`;
      }

      case 'image': {
        const rawUrl = s.image?.url || '';
        const resolvedUrl = this.resolveAssetUrl(rawUrl, opts);
        const alt = this.escapeHtml(s.alt_text || s.caption || 'Image');
        const width = s.width?.size ? `${s.width.size}${s.width.unit || 'px'}` : 'auto';
        const radius = this.resolveRadius(s, 'border_radius', '0px');

        return `      <div class="elementor-element elementor-widget elementor-widget-image elementor-element-${el.id}" style="text-align: ${s.align || 'center'};">
        <img src="${resolvedUrl}" alt="${alt}" style="width: ${width}; max-width: 100%; border-radius: ${radius}; object-fit: contain;" />
      </div>`;
      }

      case 'counter': {
        const num = `${s.prefix || ''}${s.ending_number ?? 100}${s.suffix || ''}`;
        const title = s.title || '';
        const numColor = s.number_color || '#0F1A2C';
        const titleColor = s.title_color || '#64748B';
        const numSize = s.typography_number_font_size?.size || 48;

        return `      <div class="elementor-element elementor-widget elementor-widget-counter elementor-element-${el.id}">
        <div class="stat-counter-wrapper">
          <div class="elementor-counter-number-wrapper" style="font-size: ${numSize}px; font-weight: 700; color: ${numColor}; line-height: 1;">${num}</div>
          ${title ? `<div class="elementor-counter-title" style="font-size: 13px; color: ${titleColor}; margin-top: 6px;">${title}</div>` : ''}
        </div>
      </div>`;
      }

      case 'icon-list': {
        const items = s.icon_list || [];
        const isInline = s.view === 'inline';
        const color = s.text_color || '#64748B';
        const gap = s.space_between?.size ? `${s.space_between.size}px` : '24px';
        const typo = this.resolveTypography(s, device, { fontSize: 14, fontWeight: '500' });

        const itemsHtml = items.map((it: any) => {
          return `<li class="elementor-icon-list-item">
            <a href="${it.link?.url || '#'}" style="color: ${color};">${it.text}</a>
          </li>`;
        }).join('\n');

        return `      <div class="elementor-element elementor-widget elementor-widget-icon-list elementor-element-${el.id}">
        <ul class="elementor-icon-list-items ${isInline ? 'elementor-inline-items' : ''}" style="gap: ${gap}; ${typo}">
          ${itemsHtml}
        </ul>
      </div>`;
      }

      case 'divider': {
        const style = s.style || 'solid';
        const weight = s.weight?.size ? `${s.weight.size}px` : '1px';
        const color = s.color || '#E5E7EB';

        return `      <div class="elementor-element elementor-widget elementor-widget-divider elementor-element-${el.id}" style="width: 100%; border-top: ${weight} ${style} ${color}; margin: 12px 0;"></div>`;
      }

      case 'spacer': {
        const h = s.space?.size || 30;
        return `      <div class="elementor-element elementor-widget elementor-widget-spacer elementor-element-${el.id}" style="height: ${h}px;"></div>`;
      }

      case 'html': {
        return `      <div class="elementor-element elementor-widget elementor-widget-html elementor-element-${el.id}">
        ${s.html || ''}
      </div>`;
      }

      default: {
        return `      <div class="elementor-element elementor-widget elementor-widget-${type} elementor-element-${el.id}">
        <!-- Widget ${type} -->
      </div>`;
      }
    }
  }

  private resolveAssetUrl(url: string, opts: RenderOptions): string {
    if (!url) return '';
    if (opts.assetUrlResolver) {
      return opts.assetUrlResolver(url);
    }
    if (url.startsWith('data:image/svg+xml')) {
      if (url.includes('"')) {
        const commaIdx = url.indexOf(',');
        if (commaIdx !== -1) {
          const content = decodeURIComponent(url.slice(commaIdx + 1).replace(/%23/g, '#'));
          return `data:image/svg+xml;base64,${Buffer.from(content).toString('base64')}`;
        }
      }
      return url;
    }
    if (url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    // Attempt to convert local /storage/... or /uploads/... path into base64 data URI
    try {
      const storageRoot = opts.storageRootDir || path.resolve(process.cwd(), 'storage/uploads');
      let relativePath = url;
      if (relativePath.startsWith('/storage/')) {
        relativePath = relativePath.slice('/storage/'.length);
      } else if (relativePath.startsWith('/uploads/')) {
        relativePath = relativePath.slice('/uploads/'.length);
      } else if (relativePath.startsWith('/')) {
        relativePath = relativePath.slice(1);
      }

      const fullPath = path.resolve(storageRoot, relativePath);
      if (fs.existsSync(fullPath)) {
        const buffer = fs.readFileSync(fullPath);
        const ext = path.extname(fullPath).toLowerCase();
        const mime = ext === '.svg' ? 'image/svg+xml' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
        return `data:${mime};base64,${buffer.toString('base64')}`;
      }
    } catch {
      // ignore
    }
    return url;
  }

  private resolveTypography(s: Record<string, any>, device: 'desktop' | 'tablet' | 'mobile', fallback: { fontSize: number; fontWeight: string; lineHeight?: number }): string {
    let size = fallback.fontSize;
    if (device === 'tablet' && s.typography_font_size_tablet?.size) {
      size = s.typography_font_size_tablet.size;
    } else if (device === 'mobile' && s.typography_font_size_mobile?.size) {
      size = s.typography_font_size_mobile.size;
    } else if (s.typography_font_size?.size) {
      size = s.typography_font_size.size;
    }

    const weight = s.typography_font_weight || fallback.fontWeight;
    const lh = s.typography_line_height?.size || fallback.lineHeight || 1.3;
    const ls = s.typography_letter_spacing?.size ? `letter-spacing: ${s.typography_letter_spacing.size}px;` : '';
    const font = s.typography_font_family ? `font-family: '${s.typography_font_family}', sans-serif;` : '';

    return `font-size: ${size}px; font-weight: ${weight}; line-height: ${lh}; ${ls} ${font}`;
  }

  private resolveSpacing(s: Record<string, any>, prefix: string, device: 'desktop' | 'tablet' | 'mobile'): string | null {
    let prop = s[prefix];
    if (device === 'tablet' && s[`${prefix}_tablet`]) {
      prop = s[`${prefix}_tablet`];
    } else if (device === 'mobile' && s[`${prefix}_mobile`]) {
      prop = s[`${prefix}_mobile`];
    }
    if (!prop) return null;

    const u = prop.unit || 'px';
    const top = prop.top ?? 0;
    const right = prop.right ?? 0;
    const bottom = prop.bottom ?? 0;
    const left = prop.left ?? 0;
    return `${top}${u} ${right}${u} ${bottom}${u} ${left}${u}`;
  }

  private resolveGap(s: Record<string, any>, device: 'desktop' | 'tablet' | 'mobile'): string | null {
    let gap = s.flex_gap;
    if (device === 'tablet' && s.flex_gap_tablet) gap = s.flex_gap_tablet;
    if (device === 'mobile' && s.flex_gap_mobile) gap = s.flex_gap_mobile;
    if (gap?.size !== undefined) {
      return `${gap.size}${gap.unit || 'px'}`;
    }
    return null;
  }

  private resolveRadius(s: Record<string, any>, propName: string = 'border_radius', fallback: string = ''): string {
    const rad = s[propName];
    if (!rad) return fallback;
    const u = rad.unit || 'px';
    if (rad.isLinked || (rad.top === rad.right && rad.right === rad.bottom && rad.bottom === rad.left)) {
      return `${rad.top ?? 0}${u}`;
    }
    return `${rad.top ?? 0}${u} ${rad.right ?? 0}${u} ${rad.bottom ?? 0}${u} ${rad.left ?? 0}${u}`;
  }

  private resolveBorder(s: Record<string, any>): string {
    if (!s.border_border && !s.border_width) return '';
    const style = s.border_border || 'solid';
    const color = s.border_color || '#E5E7EB';
    const w = s.border_width;
    if (!w) return `border: 1px ${style} ${color};`;
    const u = w.unit || 'px';
    if (w.isLinked) {
      return `border: ${w.top ?? 1}${u} ${style} ${color};`;
    }
    return `border-top: ${w.top ?? 0}${u} ${style} ${color}; border-right: ${w.right ?? 0}${u} ${style} ${color}; border-bottom: ${w.bottom ?? 0}${u} ${style} ${color}; border-left: ${w.left ?? 0}${u} ${style} ${color};`;
  }

  private cssJustify(val?: string): string {
    switch (val) {
      case 'center': return 'center';
      case 'space-between': return 'space-between';
      case 'space-around': return 'space-around';
      case 'space-evenly': return 'space-evenly';
      case 'flex-end': return 'flex-end';
      case 'flex-start':
      default: return 'flex-start';
    }
  }

  private cssAlign(val?: string): string {
    switch (val) {
      case 'center': return 'center';
      case 'flex-end': return 'flex-end';
      case 'stretch': return 'stretch';
      case 'flex-start':
      default: return 'flex-start';
    }
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
