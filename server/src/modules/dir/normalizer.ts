/**
 * Deterministic Normalizer for Design Intermediate Representation (DIR)
 *
 * Safely normalizes unambiguous AI output formats to strictly conform to the authoritative DIR schema:
 * 1. Disentangles pages and sections (e.g. sections misplaced directly into pages[]).
 * 2. Converts numeric strings (e.g. "24" or "24px") to numbers on explicitly numeric schema fields.
 * 3. Maps CSS property aliases in styles (e.g. marginTop -> margin.top, gridTemplateColumns -> grid columns).
 * 4. Repairs missing required fields semantically (e.g. text.html from text.text, grid columns).
 * 5. Rejects ambiguous CSS values (e.g. "1.5rem") without corrupting layout intent.
 */

import { DIRDocument, DIRSectionRole, DIRNodeKind } from './types.js';

const VALID_SECTION_ROLES = new Set<DIRSectionRole>([
  'header', 'navigation', 'hero', 'feature', 'content', 'cta',
  'testimonial', 'pricing', 'stats', 'gallery', 'team', 'faq',
  'contact', 'form', 'footer', 'banner', 'logo-bar', 'generic'
]);

const VALID_STYLE_KEYS = new Set([
  'width', 'height', 'minWidth', 'maxWidth', 'minHeight', 'maxHeight',
  'padding', 'margin', 'gap',
  'backgroundColor', 'backgroundImage', 'backgroundGradient', 'backgroundSize', 'backgroundPosition', 'backgroundOverlay',
  'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'textAlign', 'textTransform', 'textDecoration', 'color',
  'borderWidth', 'borderColor', 'borderStyle', 'borderRadius',
  'boxShadow', 'textShadow',
  'display', 'position', 'overflow', 'opacity', 'zIndex',
  'flexDirection', 'justifyContent', 'alignItems', 'alignSelf', 'flexGrow', 'flexShrink', 'flexBasis', 'flexWrap'
]);

const COMMON_NODE_KEYS = new Set([
  'id', 'kind', 'label', 'confidence', 'styles', 'responsiveOverrides',
  'typography', 'form_details', 'composite_graphic_asset', 'layout_tree'
]);

const KIND_ALLOWED_KEYS: Record<string, Set<string>> = {
  container: new Set(['direction', 'wrap', 'gap', 'children']),
  'flex-group': new Set(['direction', 'justifyContent', 'alignItems', 'wrap', 'gap', 'children']),
  'grid-group': new Set(['columns', 'rows', 'gap', 'children']),
  heading: new Set(['text', 'level', 'htmlTag']),
  text: new Set(['html', 'text']),
  button: new Set(['text', 'url', 'variant', 'size', 'icon', 'iconPosition']),
  image: new Set(['assetId', 'alt', 'caption', 'objectFit', 'aspectRatio', 'url', 'width', 'height', 'seed', 'prompt']),
  icon: new Set(['iconName', 'iconLibrary']),
  'icon-text': new Set(['iconName', 'iconLibrary', 'text', 'title', 'subtext', 'iconPosition', 'url']),
  link: new Set(['text', 'url']),
  list: new Set(['ordered', 'children']),
  'list-item': new Set(['text', 'icon']),
  divider: new Set(['thickness']),
  spacer: new Set(['height']),
  card: new Set(['children']),
  form: new Set(['children', 'action', 'method']),
  input: new Set(['inputType', 'placeholder', 'label']),
  video: new Set(['url', 'provider']),
  map: new Set(['location']),
  'social-icons': new Set(['platforms']),
  counter: new Set(['value', 'prefix', 'suffix', 'title', 'duration']),
  'progress-bar': new Set(['value', 'max', 'label']),
  tabs: new Set(['tabs']),
  accordion: new Set(['items']),
  rating: new Set(['rating', 'maxRating', 'icon']),
  badge: new Set(['text', 'icon']),
  unknown: new Set(['originalKind', 'fallbackText']),
};

/**
 * Safely parses an unambiguous numeric string (e.g. "24", "24px", 24).
 * Returns undefined for ambiguous values like "1.5rem", "auto", "inherit".
 */
export function parseNumeric(val: unknown): number | undefined {
  if (typeof val === 'number') {
    return isNaN(val) ? undefined : val;
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    // Allow pure digits/decimals, optionally followed by "px"
    const match = trimmed.match(/^(-?\d+(?:\.\d+)?)\s*(?:px)?$/i);
    if (match) {
      const num = parseFloat(match[1]);
      return isNaN(num) ? undefined : num;
    }
  }
  return undefined;
}

/**
 * Safely extracts human-readable text from a node or its children.
 */
export function extractNodeText(n: any): string {
  if (!n) return '';
  if (typeof n.text === 'string' && n.text.trim()) return n.text.trim();
  if (typeof n.html === 'string' && n.html.trim()) return n.html.replace(/<[^>]*>/g, '').trim();
  if (typeof n.label === 'string' && n.label.trim()) return n.label.trim();
  if (typeof n.title === 'string' && n.title.trim()) return n.title.trim();
  if (typeof n.content === 'string' && n.content.trim()) return n.content.trim();
  if (Array.isArray(n.children)) {
    for (const child of n.children) {
      const childText = extractNodeText(child);
      if (childText) return childText;
    }
  }
  return '';
}

/**
 * Derives a clean label from a semantic node ID when text was omitted by the AI model.
 */
export function deriveTextFromId(id: string): string {
  if (!id || typeof id !== 'string') return '';
  const cleaned = id
    .replace(/^(?:nav_link_|link_|nav_|header_link_|footer_link_|menu_link_|btn_|button_)/i, '')
    .replace(/(?:_link|_btn|_button|_item)$/i, '');
  if (!cleaned || /^[0-9a-f_-]+$/i.test(cleaned) || cleaned.length < 2) return '';
  return cleaned
    .split(/[_-]+/)
    .map((w) => (w.toUpperCase() === 'FAQ' ? 'FAQ' : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(' ');
}

/**
 * Normalizes DIRStyles object, handling numeric strings and CSS alias properties.
 */
export function normalizeStyles(rawStyles: unknown): Record<string, any> {
  if (!rawStyles || typeof rawStyles !== 'object' || Array.isArray(rawStyles)) {
    return {};
  }

  const s = { ...(rawStyles as Record<string, any>) };

  // 1. Explicitly numeric scalar properties
  const numericFields = [
    'fontSize', 'letterSpacing', 'borderWidth', 'gap', 'zIndex',
    'flexGrow', 'flexShrink'
  ];

  for (const field of numericFields) {
    if (s[field] !== undefined) {
      const parsed = parseNumeric(s[field]);
      if (parsed !== undefined) {
        s[field] = parsed;
      }
      // If ambiguous (e.g. "1.5rem"), leave it as-is so strict validation handles/rejects it
    }
  }

  // 2. Opacity (0.0 to 1.0)
  if (s.opacity !== undefined) {
    const parsed = parseNumeric(s.opacity);
    if (parsed !== undefined) {
      s.opacity = Math.max(0, Math.min(1, parsed));
    }
  }

  // 3. Line height (can be number or string)
  if (s.lineHeight !== undefined) {
    const parsed = parseNumeric(s.lineHeight);
    if (parsed !== undefined) {
      s.lineHeight = parsed;
    }
  }

  // 4. Border Radius (number or { topLeft, topRight, bottomRight, bottomLeft })
  if (s.borderRadius !== undefined) {
    const parsed = parseNumeric(s.borderRadius);
    if (parsed !== undefined) {
      s.borderRadius = parsed;
    } else if (typeof s.borderRadius === 'object' && s.borderRadius !== null && !Array.isArray(s.borderRadius)) {
      const corners: Record<string, number> = {};
      for (const c of ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'] as const) {
        if (s.borderRadius[c] !== undefined) {
          const cornerNum = parseNumeric(s.borderRadius[c]);
          if (cornerNum !== undefined) {
            corners[c] = cornerNum;
          }
        }
      }
      s.borderRadius = Object.keys(corners).length > 0 ? corners : undefined;
    }
  }

  // 5. Spacing: Padding
  if (s.padding && typeof s.padding === 'object' && !Array.isArray(s.padding)) {
    const pad: Record<string, number> = {};
    for (const side of ['top', 'right', 'bottom', 'left'] as const) {
      if (s.padding[side] !== undefined) {
        const parsed = parseNumeric(s.padding[side]);
        if (parsed !== undefined) pad[side] = parsed;
      }
    }
    s.padding = Object.keys(pad).length > 0 ? pad : undefined;
  }

  // 6. Spacing: Margin
  if (s.margin && typeof s.margin === 'object' && !Array.isArray(s.margin)) {
    const mar: Record<string, number> = {};
    for (const side of ['top', 'right', 'bottom', 'left'] as const) {
      if (s.margin[side] !== undefined) {
        const parsed = parseNumeric(s.margin[side]);
        if (parsed !== undefined) mar[side] = parsed;
      }
    }
    s.margin = Object.keys(mar).length > 0 ? mar : undefined;
  }

  // 7. Map individual CSS margin properties (e.g. marginBottom, marginTop)
  const cssMarginMap: Record<string, 'top' | 'right' | 'bottom' | 'left'> = {
    marginTop: 'top',
    marginRight: 'right',
    marginBottom: 'bottom',
    marginLeft: 'left',
  };

  for (const [cssProp, side] of Object.entries(cssMarginMap)) {
    if (s[cssProp] !== undefined) {
      const parsed = parseNumeric(s[cssProp]);
      if (parsed !== undefined) {
        s.margin = s.margin || {};
        if (s.margin[side] === undefined) {
          s.margin[side] = parsed;
        }
      }
      delete s[cssProp];
    }
  }

  // 8. Map individual CSS padding properties (e.g. paddingTop, paddingBottom)
  const cssPaddingMap: Record<string, 'top' | 'right' | 'bottom' | 'left'> = {
    paddingTop: 'top',
    paddingRight: 'right',
    paddingBottom: 'bottom',
    paddingLeft: 'left',
  };

  for (const [cssProp, side] of Object.entries(cssPaddingMap)) {
    if (s[cssProp] !== undefined) {
      const parsed = parseNumeric(s[cssProp]);
      if (parsed !== undefined) {
        s.padding = s.padding || {};
        if (s.padding[side] === undefined) {
          s.padding[side] = parsed;
        }
      }
      delete s[cssProp];
    }
  }

  // 9. Remove all unrecognized CSS keys that violate dirStyles.strict()
  for (const key of Object.keys(s)) {
    if (!VALID_STYLE_KEYS.has(key)) {
      delete s[key];
    }
  }

  return s;
}

/**
 * Normalizes a DIRNode and its recursive children.
 */
export function normalizeNode(rawNode: unknown): any {
  if (!rawNode || typeof rawNode !== 'object' || Array.isArray(rawNode)) {
    return rawNode;
  }

  const node = { ...(rawNode as Record<string, any>) };

  // Base fields
  node.id = node.id && typeof node.id === 'string' ? node.id : `node_${Math.random().toString(36).slice(2, 9)}`;
  node.confidence = typeof node.confidence === 'number'
    ? Math.max(0, Math.min(1, node.confidence))
    : parseNumeric(node.confidence) ?? 0.9;

  // Extract styles properties before normalizing styles
  const rawStyles = node.styles && typeof node.styles === 'object' ? node.styles : {};

  // Kind-specific mappings from styles:
  // 1. Grid group: columns
  if (node.kind === 'grid-group') {
    if (node.columns === undefined) {
      if (rawStyles.gridTemplateColumns) {
        const gtc = String(rawStyles.gridTemplateColumns);
        const repeatMatch = gtc.match(/repeat\((\d+)/i);
        if (repeatMatch) {
          node.columns = parseInt(repeatMatch[1], 10);
        } else {
          const count = gtc.trim().split(/\s+/).length;
          node.columns = count > 1 ? count : 2;
        }
      } else if (Array.isArray(node.children) && node.children.length > 0) {
        node.columns = Math.min(node.children.length, 3);
      } else {
        node.columns = 1;
      }
    } else {
      const parsedCol = parseNumeric(node.columns);
      node.columns = parsedCol && parsedCol > 0 ? Math.floor(parsedCol) : 1;
    }
  }

  // 2. Image: objectFit, width, height, seed
  if (node.kind === 'image') {
    if (!node.objectFit && rawStyles.objectFit) {
      const fit = String(rawStyles.objectFit).toLowerCase();
      if (['cover', 'contain', 'fill', 'none'].includes(fit)) {
        node.objectFit = fit;
      }
    }
    if (node.width !== undefined) {
      const w = parseNumeric(node.width);
      if (w && w > 0) node.width = w; else delete node.width;
    }
    if (node.height !== undefined) {
      const h = parseNumeric(node.height);
      if (h && h > 0) node.height = h; else delete node.height;
    }
    if (node.seed !== undefined) {
      const s = parseNumeric(node.seed);
      if (s !== undefined) node.seed = Math.floor(s); else delete node.seed;
    }
  }

  // 3. Text: html
  if (node.kind === 'text') {
    if (!node.html && node.text) {
      node.html = `<p>${escapeHtml(String(node.text))}</p>`;
    } else if (!node.html) {
      const extracted = extractNodeText(node) || deriveTextFromId(node.id);
      node.html = extracted ? `<p>${escapeHtml(extracted)}</p>` : '<p></p>';
    }
    delete node.children;
  }

  // 4. Heading: level
  if (node.kind === 'heading') {
    if (node.level === undefined || typeof node.level !== 'number') {
      const parsedLevel = parseNumeric(node.level);
      if (parsedLevel && [1, 2, 3, 4, 5, 6].includes(parsedLevel)) {
        node.level = parsedLevel;
      } else if (typeof node.htmlTag === 'string' && /^h([1-6])$/i.test(node.htmlTag)) {
        node.level = parseInt(RegExp.$1, 10);
      } else {
        node.level = 2;
      }
    }
  }

  // Normalize styles object
  node.styles = normalizeStyles(rawStyles);

  // Normalize responsiveOverrides if present
  if (node.responsiveOverrides && typeof node.responsiveOverrides === 'object') {
    const normOverrides: Record<string, any> = {};
    for (const device of ['tablet', 'mobile'] as const) {
      if (node.responsiveOverrides[device]) {
        normOverrides[device] = normalizeStyles(node.responsiveOverrides[device]);
      }
    }
    node.responsiveOverrides = normOverrides;
  }

  // 5. Semantic field repair and alias normalization for all node kinds
  if (node.kind === 'heading') {
    if (!node.text) {
      node.text = extractNodeText(node) || deriveTextFromId(node.id) || 'Heading';
    }
    delete node.children;
  } else if (node.kind === 'button') {
    if (!node.text) {
      node.text = extractNodeText(node) || deriveTextFromId(node.id) || 'Button';
    }
    delete node.children;
    if (node.href && !node.url) {
      node.url = node.href;
    }
  } else if (node.kind === 'link') {
    if (!node.text) {
      node.text = extractNodeText(node) || deriveTextFromId(node.id) || 'Link';
    }
    delete node.children;
    if (node.href && !node.url) {
      node.url = node.href;
    }
  } else if (node.kind === 'badge') {
    if (!node.text) {
      node.text = extractNodeText(node) || deriveTextFromId(node.id) || 'Badge';
    }
    delete node.children;
  } else if (node.kind === 'list-item') {
    if (!node.text) {
      node.text = extractNodeText(node) || deriveTextFromId(node.id) || 'Item';
    }
    delete node.children;
  } else if (node.kind === 'icon-text') {
    if (!node.text) {
      node.text = extractNodeText(node) || deriveTextFromId(node.id) || 'Feature';
    }
    delete node.children;
  } else if (node.kind === 'spacer') {
    if (typeof node.height !== 'number') {
      node.height = parseNumeric(rawStyles.height) ?? 20;
    }
    delete node.children;
  } else if (node.kind === 'input') {
    if (node.inputType && !['text', 'email', 'password', 'textarea', 'select', 'checkbox', 'radio'].includes(node.inputType)) {
      node.inputType = 'text';
    }
    delete node.children;
  } else if (node.kind === 'counter') {
    if (typeof node.value !== 'number') {
      node.value = parseNumeric(node.value) ?? 0;
    }
    delete node.children;
  } else if (node.kind === 'rating') {
    if (typeof node.value !== 'number') {
      node.value = parseNumeric(node.value) ?? 5;
    }
    delete node.children;
  } else if (node.kind === 'progress-bar') {
    if (typeof node.value !== 'number') {
      node.value = parseNumeric(node.value) ?? 50;
    }
    delete node.children;
  } else if (node.kind === 'flex-group') {
    if (!node.direction || !['row', 'column'].includes(node.direction)) {
      node.direction = rawStyles.flexDirection === 'row' ? 'row' : 'column';
    }
  }

  // 6. Prune unrecognized keys from node to strictly satisfy dirNodeSchema
  const allowedKeys = KIND_ALLOWED_KEYS[node.kind];
  if (allowedKeys) {
    for (const key of Object.keys(node)) {
      if (!COMMON_NODE_KEYS.has(key) && !allowedKeys.has(key)) {
        delete node[key];
      }
    }
  }

  // 7. Normalize children recursively
  if (Array.isArray(node.children)) {
    node.children = node.children.map(normalizeNode);
  } else if (['container', 'flex-group', 'grid-group', 'card', 'form'].includes(node.kind)) {
    node.children = [];
  }

  return node;
}

/**
 * Normalizes a DIRSection.
 */
export function normalizeSection(rawSection: unknown): any {
  if (!rawSection || typeof rawSection !== 'object' || Array.isArray(rawSection)) {
    return rawSection;
  }

  const sec = { ...(rawSection as Record<string, any>) };

  sec.id = sec.id && typeof sec.id === 'string' ? sec.id : `sec_${Math.random().toString(36).slice(2, 9)}`;
  sec.confidence = typeof sec.confidence === 'number'
    ? Math.max(0, Math.min(1, sec.confidence))
    : parseNumeric(sec.confidence) ?? 0.9;

  // Validate or fallback role
  if (!sec.role || !VALID_SECTION_ROLES.has(sec.role)) {
    sec.role = 'generic';
  }

  sec.styles = normalizeStyles(sec.styles);

  if (sec.responsiveOverrides && typeof sec.responsiveOverrides === 'object') {
    const normOverrides: Record<string, any> = {};
    for (const device of ['tablet', 'mobile'] as const) {
      if (sec.responsiveOverrides[device]) {
        normOverrides[device] = normalizeStyles(sec.responsiveOverrides[device]);
      }
    }
    sec.responsiveOverrides = normOverrides;
  }

  if (Array.isArray(sec.children)) {
    sec.children = sec.children.map(normalizeNode);
  } else {
    sec.children = [];
  }

  const ALLOWED_SECTION_KEYS = new Set([
    'id', 'role', 'label', 'confidence', 'styles', 'children',
    'responsiveNotes', 'responsiveOverrides', 'canvas_bounds'
  ]);
  for (const key of Object.keys(sec)) {
    if (!ALLOWED_SECTION_KEYS.has(key)) {
      delete sec[key];
    }
  }

  return sec;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function isSectionLike(item: any): boolean {
  if (!item || typeof item !== 'object') return false;
  // A section has role and styles/children, but NOT sections
  return (
    (typeof item.role === 'string' && VALID_SECTION_ROLES.has(item.role as DIRSectionRole)) ||
    (Array.isArray(item.children) && !item.sections)
  );
}

/**
 * Deterministically normalizes a full parsed DIR document before schema validation.
 */
export function normalizeDIR(rawDoc: unknown): any {
  if (!rawDoc || typeof rawDoc !== 'object' || Array.isArray(rawDoc)) {
    return rawDoc;
  }

  const doc = JSON.parse(JSON.stringify(rawDoc));

  doc.version = doc.version || '1.0.0';

  // 1. Meta — prune unrecognized keys to conform to strict Zod schema
  const ALLOWED_META_KEYS = new Set([
    'sourceImageHash', 'sourceWidth', 'sourceHeight', 'analysisProvider',
    'analysisModel', 'analysisTimestamp', 'confidenceScore', 'schemaVersion',
    'promptVersion', 'notes', 'canvas_bounds'
  ]);

  if (doc.meta && typeof doc.meta === 'object' && !Array.isArray(doc.meta)) {
    for (const key of Object.keys(doc.meta)) {
      if (!ALLOWED_META_KEYS.has(key)) {
        delete doc.meta[key];
      }
    }
    doc.meta.schemaVersion = '1.0.0';
    if (doc.meta.sourceWidth !== undefined) doc.meta.sourceWidth = parseNumeric(doc.meta.sourceWidth) ?? doc.meta.sourceWidth;
    if (doc.meta.sourceHeight !== undefined) doc.meta.sourceHeight = parseNumeric(doc.meta.sourceHeight) ?? doc.meta.sourceHeight;
    if (doc.meta.confidenceScore !== undefined) {
      const parsedConf = parseNumeric(doc.meta.confidenceScore);
      doc.meta.confidenceScore = parsedConf !== undefined ? Math.max(0, Math.min(1, parsedConf)) : 0.9;
    }
    if (doc.meta.notes !== undefined && !Array.isArray(doc.meta.notes)) {
      doc.meta.notes = [String(doc.meta.notes)];
    }
  }

  // 2. Breakpoints — normalize array to standard desktop/tablet/mobile object
  if (Array.isArray(doc.breakpoints)) {
    doc.breakpoints = {
      desktop: { min: 1024 },
      tablet: { min: 768, max: 1023 },
      mobile: { min: 0, max: 767 }
    };
  } else if (!doc.breakpoints || typeof doc.breakpoints !== 'object') {
    doc.breakpoints = {
      desktop: { min: 1024 },
      tablet: { min: 768, max: 1023 },
      mobile: { min: 0, max: 767 }
    };
  } else {
    if (!doc.breakpoints.desktop || typeof doc.breakpoints.desktop !== 'object') {
      doc.breakpoints.desktop = { min: 1024 };
    } else {
      doc.breakpoints.desktop.min = parseNumeric(doc.breakpoints.desktop.min) ?? 1024;
      if (doc.breakpoints.desktop.max !== undefined) {
        doc.breakpoints.desktop.max = parseNumeric(doc.breakpoints.desktop.max) ?? doc.breakpoints.desktop.max;
      }
    }
    if (doc.breakpoints.tablet && typeof doc.breakpoints.tablet === 'object') {
      doc.breakpoints.tablet.min = parseNumeric(doc.breakpoints.tablet.min) ?? 768;
      doc.breakpoints.tablet.max = parseNumeric(doc.breakpoints.tablet.max) ?? 1023;
    }
    if (doc.breakpoints.mobile && typeof doc.breakpoints.mobile === 'object') {
      doc.breakpoints.mobile.min = parseNumeric(doc.breakpoints.mobile.min) ?? 0;
      if (doc.breakpoints.mobile.max !== undefined) {
        doc.breakpoints.mobile.max = parseNumeric(doc.breakpoints.mobile.max) ?? 767;
      }
    }
  }

  // 3. Globals — guarantee required colors (background, text) and typography (fontFamilies)
  if (!doc.globals || typeof doc.globals !== 'object' || Array.isArray(doc.globals)) {
    doc.globals = {};
  }

  if (!doc.globals.colors || typeof doc.globals.colors !== 'object' || Array.isArray(doc.globals.colors)) {
    doc.globals.colors = {};
  }
  doc.globals.colors.background = typeof doc.globals.colors.background === 'string' && doc.globals.colors.background.trim()
    ? doc.globals.colors.background
    : '#ffffff';
  doc.globals.colors.text = typeof doc.globals.colors.text === 'string' && doc.globals.colors.text.trim()
    ? doc.globals.colors.text
    : '#0f172a';

  if (!doc.globals.typography || typeof doc.globals.typography !== 'object' || Array.isArray(doc.globals.typography)) {
    doc.globals.typography = {};
  }
  if (!Array.isArray(doc.globals.typography.fontFamilies) || doc.globals.typography.fontFamilies.length === 0) {
    doc.globals.typography.fontFamilies = ['Inter', 'sans-serif'];
  }
  if (doc.globals.typography.baseSize !== undefined) {
    doc.globals.typography.baseSize = parseNumeric(doc.globals.typography.baseSize) ?? doc.globals.typography.baseSize;
  }
  if (doc.globals.typography.scale !== undefined) {
    doc.globals.typography.scale = parseNumeric(doc.globals.typography.scale) ?? doc.globals.typography.scale;
  }

  if (doc.globals.spacing && typeof doc.globals.spacing === 'object' && !Array.isArray(doc.globals.spacing)) {
    if (doc.globals.spacing.base !== undefined) {
      doc.globals.spacing.base = parseNumeric(doc.globals.spacing.base) ?? doc.globals.spacing.base;
    }
    if (doc.globals.spacing.sectionGap !== undefined) {
      doc.globals.spacing.sectionGap = parseNumeric(doc.globals.spacing.sectionGap) ?? doc.globals.spacing.sectionGap;
    }
    if (doc.globals.spacing.containerMaxWidth !== undefined) {
      doc.globals.spacing.containerMaxWidth = parseNumeric(doc.globals.spacing.containerMaxWidth) ?? doc.globals.spacing.containerMaxWidth;
    }
  }

  // 4. Assets
  if (Array.isArray(doc.assets)) {
    doc.assets = doc.assets.map((asset: any) => {
      if (!asset || typeof asset !== 'object') return asset;
      const a = { ...asset };
      if (a.confidence !== undefined) {
        const conf = parseNumeric(a.confidence);
        if (conf !== undefined) a.confidence = Math.max(0, Math.min(1, conf));
      }
      if (a.sourceRect && typeof a.sourceRect === 'object') {
        a.sourceRect.x = parseNumeric(a.sourceRect.x) ?? a.sourceRect.x;
        a.sourceRect.y = parseNumeric(a.sourceRect.y) ?? a.sourceRect.y;
        a.sourceRect.width = parseNumeric(a.sourceRect.width) ?? a.sourceRect.width;
        a.sourceRect.height = parseNumeric(a.sourceRect.height) ?? a.sourceRect.height;
      }
      if (a.width !== undefined) {
        const w = parseNumeric(a.width);
        if (w && w > 0) a.width = w; else delete a.width;
      }
      if (a.height !== undefined) {
        const h = parseNumeric(a.height);
        if (h && h > 0) a.height = h; else delete a.height;
      }
      if (a.seed !== undefined) {
        const s = parseNumeric(a.seed);
        if (s !== undefined) a.seed = Math.floor(s); else delete a.seed;
      }
      return a;
    });
  }

  // 5. Pages and Sections Disentanglement (Resolves pages.1 section error)
  if (!Array.isArray(doc.pages) || doc.pages.length === 0) {
    if (Array.isArray(doc.sections) && doc.sections.length > 0) {
      doc.pages = [{
        id: 'page_main',
        name: 'Home',
        sections: doc.sections.map(normalizeSection),
      }];
      delete doc.sections;
    }
  } else {
    // Check if any element in pages is a section-shaped object
    const hasSectionInPages = doc.pages.some(isSectionLike);

    if (hasSectionInPages) {
      const allSections: any[] = [];
      let pageId = 'page_main';
      let pageName = 'Home';

      for (const item of doc.pages) {
        if (isSectionLike(item)) {
          allSections.push(normalizeSection(item));
        } else if (item && typeof item === 'object') {
          if (item.id && typeof item.id === 'string') pageId = item.id;
          if (item.name && typeof item.name === 'string') pageName = item.name;
          if (Array.isArray(item.sections)) {
            allSections.push(...item.sections.map(normalizeSection));
          }
        }
      }

      doc.pages = [{
        id: pageId,
        name: pageName,
        sections: allSections,
      }];
    } else {
      // Each page is a page object
      doc.pages = doc.pages.map((p: any) => {
        if (!p || typeof p !== 'object') return p;
        const page = { ...p };
        if (Array.isArray(page.sections)) {
          page.sections = page.sections.map(normalizeSection);
        }
        return page;
      });
    }
  }

  return doc;
}
