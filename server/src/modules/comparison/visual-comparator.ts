/**
 * Visual Comparator Module
 * Evaluates pixel-level difference, SSIM structural similarity, region-level fidelity,
 * and generates visual difference heatmaps.
 */

import sharp from 'sharp';
import pixelmatch from 'pixelmatch';
import { logger } from '../../lib/logger.js';

export interface RegionFidelity {
  regionName: string;
  yStartPct: number;
  yEndPct: number;
  mismatchPct: number;
  matchScore: number;
  passed: boolean;
}

export interface ComparisonResult {
  width: number;
  height: number;
  totalPixels: number;
  mismatchedPixels: number;
  mismatchPercentage: number;
  pixelMatchScore: number; // 0 - 100%
  ssimScore: number; // 0.0 - 1.0
  compositeSimilarityScore: number; // 0 - 100%
  regionFidelities: RegionFidelity[];
  diffImageBuffer: Buffer;
  passed: boolean;
  diagnostics: string[];
}

export class VisualComparator {
  /**
   * Compares a reference screenshot with a generated screenshot.
   */
  public async compare(
    referenceBuffer: Buffer,
    generatedBuffer: Buffer,
    targetDimensions = { width: 1440, height: 900 }
  ): Promise<ComparisonResult> {
    const { width, height } = targetDimensions;

    // 1. Normalize both images to exact target dimensions & raw RGBA
    const [refRaw, genRaw] = await Promise.all([
      sharp(referenceBuffer)
        .resize(width, height, { fit: 'fill' })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true }),
      sharp(generatedBuffer)
        .resize(width, height, { fit: 'fill' })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true }),
    ]);

    const totalPixels = width * height;
    const diffBuffer = Buffer.alloc(totalPixels * 4);

    // 2. Compute pixelmatch difference
    const mismatchedPixels = pixelmatch(
      refRaw.data,
      genRaw.data,
      diffBuffer,
      width,
      height,
      {
        threshold: 0.12,
        includeAA: true,
        diffColor: [255, 0, 90], // Neon magenta for differences
      }
    );

    const mismatchPercentage = Number(((mismatchedPixels / totalPixels) * 100).toFixed(2));
    const pixelMatchScore = Number(Math.max(0, 100 - mismatchPercentage).toFixed(2));

    // 3. Compute SSIM (Structural Similarity)
    const ssimScore = this.computeSSIM(refRaw.data, genRaw.data, width, height);

    // 4. Region-level comparison
    const regions = [
      { name: 'header', yStartPct: 0, yEndPct: 0.14 },
      { name: 'hero_headline_cta', yStartPct: 0.14, yEndPct: 0.48 },
      { name: 'statistics_cards', yStartPct: 0.48, yEndPct: 0.84 },
      { name: 'bottom_service_ticker', yStartPct: 0.84, yEndPct: 1.0 },
    ];

    const regionFidelities: RegionFidelity[] = [];
    const diagnostics: string[] = [];

    for (const r of regions) {
      const startY = Math.floor(r.yStartPct * height);
      const endY = Math.floor(r.yEndPct * height);
      const regionH = endY - startY;
      const regPixels = width * regionH;

      let regDiffCount = 0;
      for (let y = startY; y < endY; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4;
          // In pixelmatch output, changed pixels have red = 255 and alpha = 255
          if (diffBuffer[idx] === 255 && diffBuffer[idx + 1] === 0 && diffBuffer[idx + 2] === 90) {
            regDiffCount++;
          }
        }
      }

      const regMismatchPct = Number(((regDiffCount / regPixels) * 100).toFixed(2));
      const regMatchScore = Number(Math.max(0, 100 - regMismatchPct).toFixed(2));
      const passed = regMatchScore >= 80;

      regionFidelities.push({
        regionName: r.name,
        yStartPct: r.yStartPct,
        yEndPct: r.yEndPct,
        mismatchPct: regMismatchPct,
        matchScore: regMatchScore,
        passed,
      });

      if (!passed) {
        diagnostics.push(`Region "${r.name}" has high visual variance (${regMismatchPct}% mismatch, score: ${regMatchScore}%)`);
      }
    }

    // 5. Composite similarity score
    const avgRegionScore = regionFidelities.reduce((acc, r) => acc + r.matchScore, 0) / regionFidelities.length;
    const compositeSimilarityScore = Number((
      ssimScore * 100 * 0.4 +
      pixelMatchScore * 0.35 +
      avgRegionScore * 0.25
    ).toFixed(2));

    const passed = compositeSimilarityScore >= 75 && mismatchPercentage <= 25;

    // 6. Convert diff buffer into a clear visual difference PNG
    const diffImageBuffer = await sharp(diffBuffer, {
      raw: {
        width,
        height,
        channels: 4,
      },
    })
      .png()
      .toBuffer();

    return {
      width,
      height,
      totalPixels,
      mismatchedPixels,
      mismatchPercentage,
      pixelMatchScore,
      ssimScore: Number(ssimScore.toFixed(4)),
      compositeSimilarityScore,
      regionFidelities,
      diffImageBuffer,
      passed,
      diagnostics,
    };
  }

  /**
   * Standard block-based Mean Structural Similarity Index (MSSIM)
   * Evaluates local structural similarity across 16x16 blocks and averages them.
   */
  private computeSSIM(refData: Buffer, genData: Buffer, width: number, height: number): number {
    const C1 = 6.5025; // (0.01 * 255)^2
    const C2 = 58.5225; // (0.03 * 255)^2
    const blockSize = 4;

    const blocksX = Math.floor(width / blockSize);
    const blocksY = Math.floor(height / blockSize);
    const totalBlocks = blocksX * blocksY;

    if (totalBlocks === 0) return 1.0;

    let ssimTotal = 0;

    for (let by = 0; by < blocksY; by++) {
      const startY = by * blockSize;
      for (let bx = 0; bx < blocksX; bx++) {
        const startX = bx * blockSize;

        let sumRef = 0;
        let sumGen = 0;
        const nPixels = blockSize * blockSize;

        for (let y = 0; y < blockSize; y++) {
          const rowOffset = ((startY + y) * width + startX) * 4;
          for (let x = 0; x < blockSize; x++) {
            const idx = rowOffset + x * 4;
            const yRef = 0.299 * refData[idx] + 0.587 * refData[idx + 1] + 0.114 * refData[idx + 2];
            const yGen = 0.299 * genData[idx] + 0.587 * genData[idx + 1] + 0.114 * genData[idx + 2];
            sumRef += yRef;
            sumGen += yGen;
          }
        }

        const meanRef = sumRef / nPixels;
        const meanGen = sumGen / nPixels;

        let varRef = 0;
        let varGen = 0;
        let covar = 0;

        for (let y = 0; y < blockSize; y++) {
          const rowOffset = ((startY + y) * width + startX) * 4;
          for (let x = 0; x < blockSize; x++) {
            const idx = rowOffset + x * 4;
            const yRef = 0.299 * refData[idx] + 0.587 * refData[idx + 1] + 0.114 * refData[idx + 2];
            const yGen = 0.299 * genData[idx] + 0.587 * genData[idx + 1] + 0.114 * genData[idx + 2];
            const dRef = yRef - meanRef;
            const dGen = yGen - meanGen;
            varRef += dRef * dRef;
            varGen += dGen * dGen;
            covar += dRef * dGen;
          }
        }

        varRef /= nPixels;
        varGen /= nPixels;
        covar /= nPixels;

        const num = (2 * meanRef * meanGen + C1) * (2 * covar + C2);
        const den = (meanRef * meanRef + meanGen * meanGen + C1) * (varRef + varGen + C2);
        const blockSSIM = den > 0 ? Math.max(0, Math.min(1, num / den)) : 1.0;

        ssimTotal += blockSSIM;
      }
    }

    return ssimTotal / totalBlocks;
  }
}

let comparatorInstance: VisualComparator | null = null;

export function getVisualComparator(): VisualComparator {
  if (!comparatorInstance) {
    comparatorInstance = new VisualComparator();
  }
  return comparatorInstance;
}
