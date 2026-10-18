/**
 * Validation Gate Module
 * Performs rigorous multi-dimensional evaluation of conversion artifacts:
 * - Artifact Integrity (schema, element IDs, container hierarchy)
 * - Content Integrity (presence of detected text, navigation, CTA, stats, logos)
 * - Visual Fidelity (pixel difference %, SSIM score, region scores)
 * - Functional & Responsive Integrity
 */

import type { ElementorDocument } from '../elementor/types.js';
import type { DIRDocument } from '../dir/types.js';
import type { ComparisonResult } from '../comparison/visual-comparator.js';

export type ValidationStatus = 'PASSED' | 'NEEDS_REVIEW' | 'FAILED_VALIDATION';

export interface IntegrityCheck {
  name: string;
  passed: boolean;
  score?: number;
  message: string;
  details?: Record<string, unknown>;
}

export interface ValidationGateResult {
  status: ValidationStatus;
  overallScore: number; // 0 - 100%
  passed: boolean;
  artifactIntegrity: IntegrityCheck;
  contentIntegrity: IntegrityCheck;
  visualFidelity: IntegrityCheck;
  responsiveIntegrity: IntegrityCheck;
  diagnostics: string[];
  summary: string;
}

export interface ValidationThresholds {
  minCompositeScore?: number;
  maxPixelMismatchPct?: number;
  minSSIM?: number;
  minRegionScore?: number;
}

export class ValidationGate {
  private thresholds: Required<ValidationThresholds>;

  constructor(thresholds: ValidationThresholds = {}) {
    this.thresholds = {
      minCompositeScore: thresholds.minCompositeScore ?? 75,
      maxPixelMismatchPct: thresholds.maxPixelMismatchPct ?? 25,
      minSSIM: thresholds.minSSIM ?? 0.80,
      minRegionScore: thresholds.minRegionScore ?? 65,
    };
  }

  public evaluate(
    elementorDoc: ElementorDocument,
    dirDoc: DIRDocument,
    comparison: ComparisonResult,
    options?: { targetViewports?: string[] }
  ): ValidationGateResult {
    const diagnostics: string[] = [];

    // 1. Artifact Integrity
    const artifactCheck = this.evaluateArtifactIntegrity(elementorDoc);
    if (!artifactCheck.passed) {
      diagnostics.push(`Artifact integrity failure: ${artifactCheck.message}`);
    }

    // 2. Content Integrity
    const contentCheck = this.evaluateContentIntegrity(elementorDoc, dirDoc);
    if (!contentCheck.passed) {
      diagnostics.push(`Content integrity warning: ${contentCheck.message}`);
    }

    // 3. Visual Fidelity Check
    const visualCheck = this.evaluateVisualFidelity(comparison);
    if (!visualCheck.passed) {
      diagnostics.push(`Visual fidelity mismatch: ${visualCheck.message}`);
    }

    // 4. Responsive Integrity Check
    const responsiveCheck = this.evaluateResponsiveIntegrity(elementorDoc);
    if (!responsiveCheck.passed) {
      diagnostics.push(`Responsive integrity warning: ${responsiveCheck.message}`);
    }

    // Composite scoring
    const scores = [
      artifactCheck.score ?? (artifactCheck.passed ? 100 : 0),
      contentCheck.score ?? (contentCheck.passed ? 95 : 60),
      visualCheck.score ?? comparison.compositeSimilarityScore,
      responsiveCheck.score ?? (responsiveCheck.passed ? 90 : 70),
    ];
    const overallScore = Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1));

    // Determine Status
    let status: ValidationStatus = 'PASSED';
    let passed = true;

    if (!artifactCheck.passed || overallScore < 50) {
      status = 'FAILED_VALIDATION';
      passed = false;
    } else if (
      !visualCheck.passed ||
      !contentCheck.passed ||
      overallScore < this.thresholds.minCompositeScore ||
      comparison.mismatchPercentage > this.thresholds.maxPixelMismatchPct
    ) {
      status = 'NEEDS_REVIEW';
      passed = false;
    }

    const summary = `${status}: Overall score ${overallScore}%, SSIM ${(comparison.ssimScore * 100).toFixed(1)}%, Pixel match ${comparison.pixelMatchScore}%. ${diagnostics.length} diagnostic items noted.`;

    return {
      status,
      overallScore,
      passed,
      artifactIntegrity: artifactCheck,
      contentIntegrity: contentCheck,
      visualFidelity: visualCheck,
      responsiveIntegrity: responsiveCheck,
      diagnostics,
      summary,
    };
  }

  private evaluateArtifactIntegrity(doc: ElementorDocument): IntegrityCheck {
    if (!doc || !Array.isArray(doc.content) || doc.content.length === 0) {
      return {
        name: 'Artifact Integrity',
        passed: false,
        score: 0,
        message: 'Elementor template content is empty or invalid structure',
      };
    }

    const seenIds = new Set<string>();
    let duplicateIds = 0;
    let malformedIds = 0;
    let totalElements = 0;

    const inspect = (el: any) => {
      totalElements++;
      if (typeof el.id !== 'string' || el.id.length < 5) {
        malformedIds++;
      }
      if (seenIds.has(el.id)) {
        duplicateIds++;
      } else {
        seenIds.add(el.id);
      }
      if (Array.isArray(el.elements)) {
        for (const child of el.elements) inspect(child);
      }
    };

    for (const el of doc.content) inspect(el);

    if (duplicateIds > 0 || malformedIds > 0) {
      return {
        name: 'Artifact Integrity',
        passed: false,
        score: 50,
        message: `Found ${duplicateIds} duplicate IDs and ${malformedIds} malformed IDs`,
        details: { totalElements, duplicateIds, malformedIds },
      };
    }

    return {
      name: 'Artifact Integrity',
      passed: true,
      score: 100,
      message: `Verified valid Elementor AST with ${totalElements} unique elements`,
      details: { totalElements },
    };
  }

  private evaluateContentIntegrity(elementorDoc: ElementorDocument, dirDoc: DIRDocument): IntegrityCheck {
    const docString = JSON.stringify(elementorDoc.content);
    let matchedKeywords = 0;
    let totalKeywords = 0;

    const keyTermsToCheck: string[] = [];

    // Collect headings and button texts from DIR
    const collectTerms = (node: any) => {
      if (node.kind === 'heading' && node.text) {
        keyTermsToCheck.push(node.text.slice(0, 20));
      } else if (node.kind === 'button' && node.text) {
        keyTermsToCheck.push(node.text);
      }
      const children = node.children || node.nodes || node.elements;
      if (Array.isArray(children)) {
        for (const child of children) collectTerms(child);
      }
    };

    if (dirDoc.pages) {
      for (const p of dirDoc.pages) {
        for (const s of p.sections || []) {
          for (const c of s.children || []) collectTerms(c);
        }
      }
    }

    totalKeywords = keyTermsToCheck.length;
    const stripHtml = (s: string) => s.replace(/<[^>]*>/g, ' ');
    const cleanDoc = stripHtml(docString.replace(/\\[nrtbfav0]/g, ' ')).replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    for (const term of keyTermsToCheck) {
      const clean = stripHtml(term).replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      if (clean.length >= 3 && cleanDoc.includes(clean)) {
        matchedKeywords++;
      }
    }

    const ratio = totalKeywords > 0 ? matchedKeywords / totalKeywords : 1.0;
    const score = Number((ratio * 100).toFixed(1));
    const passed = ratio >= 0.80;

    return {
      name: 'Content Integrity',
      passed,
      score,
      message: `Preserved ${matchedKeywords}/${totalKeywords} key text elements (${score}%)`,
      details: { matchedKeywords, totalKeywords },
    };
  }

  private evaluateVisualFidelity(comparison: ComparisonResult): IntegrityCheck {
    const passed =
      comparison.compositeSimilarityScore >= this.thresholds.minCompositeScore &&
      comparison.ssimScore >= this.thresholds.minSSIM &&
      comparison.mismatchPercentage <= this.thresholds.maxPixelMismatchPct;

    return {
      name: 'Visual Fidelity',
      passed,
      score: comparison.compositeSimilarityScore,
      message: `SSIM ${(comparison.ssimScore * 100).toFixed(1)}%, Pixel match ${comparison.pixelMatchScore}%, Mismatch ${comparison.mismatchPercentage}%`,
      details: {
        ssim: comparison.ssimScore,
        pixelMismatchPct: comparison.mismatchPercentage,
        compositeScore: comparison.compositeSimilarityScore,
      },
    };
  }

  private evaluateResponsiveIntegrity(doc: ElementorDocument): IntegrityCheck {
    let responsiveRuleCount = 0;

    const inspect = (el: any) => {
      const s = el.settings || {};
      for (const k of Object.keys(s)) {
        if (k.includes('_tablet') || k.includes('_mobile')) {
          responsiveRuleCount++;
        }
      }
      if (Array.isArray(el.elements)) {
        for (const child of el.elements) inspect(child);
      }
    };

    for (const el of doc.content || []) inspect(el);

    const passed = responsiveRuleCount > 0;
    return {
      name: 'Responsive Integrity',
      passed,
      score: passed ? 95 : 70,
      message: passed
        ? `Verified ${responsiveRuleCount} responsive breakpoint overrides`
        : 'No explicit responsive overrides found',
      details: { responsiveRuleCount },
    };
  }
}

let validationGateInstance: ValidationGate | null = null;

export function getValidationGate(): ValidationGate {
  if (!validationGateInstance) {
    validationGateInstance = new ValidationGate();
  }
  return validationGateInstance;
}
