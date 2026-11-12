/**
 * Pure TypeScript outer-rim radial refinement, robust outlier rejection,
 * perspective ellipse fitting, and bimetallic ring color sampling for the
 * ₹10 (27.0 mm) reference coin calibration engine.
 *
 * Operates strictly in floating-point working-image coordinates so center,
 * radius, and semi-axes retain subpixel precision prior to single-step
 * conversion back into original image coordinates.
 */

export interface WorkImageBuffers {
  width: number;
  height: number;
  /** Original unblurred grayscale channel (Uint8Array, length = width * height). */
  grayData: Uint8Array;
  /** Sobel horizontal gradient on lightly denoised grayscale. */
  gxData: Float32Array;
  /** Sobel vertical gradient on lightly denoised grayscale. */
  gyData: Float32Array;
  /** Gradient magnitude hypot(gx, gy). */
  gradMag: Float32Array;
  /** Interleaved OpenCV CIE Lab buffer (length = width * height * 3). */
  labData: Uint8Array;
  /** Interleaved OpenCV BGR buffer (length = width * height * 3). */
  bgrData: Uint8Array;
}

export interface BoundarySample {
  theta: number;
  x: number;
  y: number;
  r: number;
  mag: number;
  align: number;
  sharpness: number;
  weight: number;
}

export interface CircleFit {
  cx: number;
  cy: number;
  r: number;
  rmse: number;
  mad: number;
  inliers: BoundarySample[];
}

export interface EllipseFit {
  cx: number;
  cy: number;
  a: number;
  b: number;
  /** Orientation of semi-major axis in radians. */
  phi: number;
  rmse: number;
  mad: number;
  axisRatio: number;
  inliers: BoundarySample[];
}

export interface CoinAnatomyStats {
  bIn: number;
  bOut: number;
  bSurround: number;
  bDiff: number;
  warmthIn: number;
  warmthOut: number;
  warmthSurround: number;
  warmthDiff: number;
  ringMinB: number;
  ringSecondMinB: number;
  ringStdB: number;
  ringMeanL: number;
  surroundMeanB: number;
  seamEdgeMean: number;
  /** True when the tested radius appears to sit on the inner silver/brass seam inside a larger brass ring. */
  isInnerSeamCandidate: boolean;
}

export interface RefinedCoinCandidate {
  /** Refined floating-point center in working-image space. */
  cx: number;
  cy: number;
  /** Effective outer physical radius in working-image space (semi-major a if perspective-corrected). */
  radius: number;
  /** Fitted semi-major and semi-minor axes in working-image space. */
  semiMajor: number;
  semiMinor: number;
  ellipseAngleRad: number;
  /** Axis ratio b / a in (0, 1]. */
  axisRatio: number;
  isElliptical: boolean;
  tiltDegrees: number;
  /** Outer boundary quality metrics across N = 72 angular rays. */
  inlierCoverage: number;
  sectorCoverage: number;
  maxMissingSectorGap: number;
  rmsePx: number;
  madPx: number;
  meanInlierGrad: number;
  meanInlierAlign: number;
  meanSharpness: number;
  anatomy: CoinAnatomyStats;
}

const NUM_RAYS = 72;
const NUM_SECTORS = 12;
const INNER_SEAM_RATIO = 0.635; // 17 mm inner core / 27 mm outer coin diameter

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) * 0.5
    : sorted[mid];
}

function sampleGrayBilinear(buf: WorkImageBuffers, x: number, y: number): number {
  const { width, height, grayData } = buf;
  const cx = clamp(x, 0, width - 1.001);
  const cy = clamp(y, 0, height - 1.001);
  const x0 = Math.floor(cx);
  const y0 = Math.floor(cy);
  const x1 = Math.min(width - 1, x0 + 1);
  const y1 = Math.min(height - 1, y0 + 1);
  const fx = cx - x0;
  const fy = cy - y0;
  const row0 = y0 * width;
  const row1 = y1 * width;

  const v00 = grayData[row0 + x0];
  const v10 = grayData[row0 + x1];
  const v01 = grayData[row1 + x0];
  const v11 = grayData[row1 + x1];
  return (v00 * (1 - fx) + v10 * fx) * (1 - fy) + (v01 * (1 - fx) + v11 * fx) * fy;
}

function sampleFloatBilinear(
  arr: Float32Array,
  width: number,
  height: number,
  x: number,
  y: number
): number {
  const cx = clamp(x, 0, width - 1.001);
  const cy = clamp(y, 0, height - 1.001);
  const x0 = Math.floor(cx);
  const y0 = Math.floor(cy);
  const x1 = Math.min(width - 1, x0 + 1);
  const y1 = Math.min(height - 1, y0 + 1);
  const fx = cx - x0;
  const fy = cy - y0;
  const row0 = y0 * width;
  const row1 = y1 * width;

  return (
    (arr[row0 + x0] * (1 - fx) + arr[row0 + x1] * fx) * (1 - fy) +
    (arr[row1 + x0] * (1 - fx) + arr[row1 + x1] * fx) * fy
  );
}

function meanGrayAlongSegment(
  buf: WorkImageBuffers,
  cx: number,
  cy: number,
  cosT: number,
  sinT: number,
  rFrom: number,
  rTo: number
): number {
  const steps = Math.max(2, Math.round(Math.abs(rTo - rFrom) / 1.25));
  let sum = 0;
  let count = 0;
  for (let i = 0; i <= steps; i++) {
    const r = rFrom + ((rTo - rFrom) * i) / steps;
    if (r <= 1) continue;
    const x = cx + r * cosT;
    const y = cy + r * sinT;
    if (x < 1 || y < 1 || x >= buf.width - 1 || y >= buf.height - 1) continue;
    sum += sampleGrayBilinear(buf, x, y);
    count++;
  }
  return count > 0 ? sum / count : 0;
}

/**
 * Predicts radial distance along angle theta for an ellipse centered at (cx, cy).
 */
export function ellipseRadiusAtTheta(
  a: number,
  b: number,
  phi: number,
  theta: number
): number {
  const dTheta = theta - phi;
  const c = Math.cos(dTheta);
  const s = Math.sin(dTheta);
  const denom = Math.hypot(b * c, a * s);
  return denom > 1e-6 ? (a * b) / denom : a;
}

/**
 * Samples N = 72 radial rays around (cx, cy), extracts crisp radially aligned
 * outer-rim gradient peaks with drop-shadow umbra suppression, glare/highlight
 * down-weighting, and parabolic subpixel peak localization.
 */
function sampleRadialBoundaryPoints(
  buf: WorkImageBuffers,
  cx: number,
  cy: number,
  predictR: (theta: number) => number,
  bandInner: number,
  bandOuter: number,
  minWorkR: number,
  maxWorkR: number,
  minEdgeGrad: number
): BoundarySample[] {
  const { width, height, gxData, gyData, gradMag } = buf;
  const stepPx = 0.5;
  const samples: BoundarySample[] = [];

  for (let k = 0; k < NUM_RAYS; k++) {
    const theta = (2 * Math.PI * k) / NUM_RAYS;
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);

    const rNom = predictR(theta);
    const rStart = Math.max(minWorkR * 0.72, rNom * bandInner);
    const rEnd = Math.min(maxWorkR * 1.22, rNom * bandOuter);
    if (rEnd - rStart < 4) continue;

    const numSteps = Math.floor((rEnd - rStart) / stepPx) + 1;
    const radii = new Float32Array(numSteps);
    const energies = new Float32Array(numSteps);
    const mags = new Float32Array(numSteps);
    const aligns = new Float32Array(numSteps);
    let outOfBounds = false;

    for (let i = 0; i < numSteps; i++) {
      const r = rStart + i * stepPx;
      const px = cx + r * cosT;
      const py = cy + r * sinT;
      if (px < 2 || py < 2 || px >= width - 2 || py >= height - 2) {
        if (i < numSteps * 0.4) {
          outOfBounds = true;
          break;
        }
        break;
      }
      const gx = sampleFloatBilinear(gxData, width, height, px, py);
      const gy = sampleFloatBilinear(gyData, width, height, px, py);
      const mag = sampleFloatBilinear(gradMag, width, height, px, py);
      const dir = gx * cosT + gy * sinT;
      const align = mag > 1e-4 ? Math.abs(dir) / mag : 0;

      radii[i] = r;
      mags[i] = mag;
      aligns[i] = align;
      // Favor gradient ridges oriented tightly along the radial vector
      energies[i] = mag * align * align;
    }

    if (outOfBounds) continue;

    interface LocalPeak {
      idx: number;
      r: number;
      mag: number;
      align: number;
      sharpness: number;
      score: number;
    }

    const peaks: LocalPeak[] = [];
    for (let i = 2; i < numSteps - 2; i++) {
      const e = energies[i];
      if (
        mags[i] < minEdgeGrad ||
        aligns[i] < 0.48 ||
        e < energies[i - 1] ||
        e < energies[i + 1]
      ) {
        continue;
      }

      // Compute flank gradient ratio to reward sharp coin rims over diffuse shadows
      let flankSum = 0;
      let flankCount = 0;
      for (let d = -8; d <= 8; d++) {
        if (Math.abs(d) < 3) continue;
        const j = i + d;
        if (j >= 0 && j < numSteps) {
          flankSum += mags[j];
          flankCount++;
        }
      }
      const flankMean = flankCount > 0 ? flankSum / flankCount : 0;
      const sharpness = mags[i] / (flankMean + 6);

      // Local ring brightness vs glare guard
      const rPeak = radii[i];
      const rimGray = sampleGrayBilinear(buf, cx + rPeak * cosT, cy + rPeak * sinT);
      const glareFactor = rimGray > 246 ? 0.55 : 1.0;

      // Soft prior toward expected radius on narrow pass
      const relDist = (rPeak - rNom) / Math.max(8, rNom);
      const radialPrior = Math.exp(-0.5 * (relDist / 0.16) ** 2);

      const sharpnessBonus = clamp(sharpness / 1.8, 0.55, 1.45);
      const score = energies[i] * sharpnessBonus * glareFactor * radialPrior;

      peaks.push({
        idx: i,
        r: rPeak,
        mag: mags[i],
        align: aligns[i],
        sharpness,
        score,
      });
    }

    if (peaks.length === 0) continue;

    // Shadow umbra rejection between two nearby competing peaks:
    // On drop-shadowed sides, p1 = rim->shadow (bright->dark), p2 = shadow->table (dark->bright),
    // with a dark shadow band strictly between p1 and p2.
    if (peaks.length >= 2) {
      peaks.sort((a, b) => a.r - b.r);
      for (let p = 0; p < peaks.length; p++) {
        const inner = peaks[p];
        for (let q = p + 1; q < peaks.length; q++) {
          const outer = peaks[q];
          const gap = outer.r - inner.r;
          if (gap < 3.0 || gap > rNom * 0.30) continue;

          const lInside = meanGrayAlongSegment(
            buf,
            cx,
            cy,
            cosT,
            sinT,
            inner.r - Math.min(7, gap + 2),
            inner.r - 1.5
          );
          const lGap = meanGrayAlongSegment(
            buf,
            cx,
            cy,
            cosT,
            sinT,
            inner.r + 1.2,
            outer.r - 1.2
          );
          const lOutside = meanGrayAlongSegment(
            buf,
            cx,
            cy,
            cosT,
            sinT,
            outer.r + 1.5,
            outer.r + Math.min(7, gap + 2)
          );

          if (lGap < lInside - 15 && lGap < lOutside - 12 && inner.mag >= outer.mag * 0.4) {
            // Outer peak is the outer diffuse shadow edge; strongly down-weight it.
            outer.score *= 0.12;
          }
        }
      }
    }

    // Select best scored peak along ray
    let best = peaks[0];
    for (let p = 1; p < peaks.length; p++) {
      if (peaks[p].score > best.score) best = peaks[p];
    }

    // Parabolic subpixel peak interpolation over [idx - 1, idx, idx + 1]
    const bIdx = best.idx;
    const ePrev = energies[bIdx - 1];
    const eCurr = energies[bIdx];
    const eNext = energies[bIdx + 1];
    const denom = ePrev - 2 * eCurr + eNext;
    const delta =
      Math.abs(denom) > 1e-6 ? clamp((0.5 * (ePrev - eNext)) / denom, -0.5, 0.5) : 0;
    const rSub = rStart + (bIdx + delta) * stepPx;

    const qualityWeight = clamp(
      (best.mag / 45) * (best.align * best.align) * clamp(best.sharpness / 1.5, 0.5, 1.3),
      0.15,
      2.0
    );

    samples.push({
      theta,
      x: cx + rSub * cosT,
      y: cy + rSub * sinT,
      r: rSub,
      mag: best.mag,
      align: best.align,
      sharpness: best.sharpness,
      weight: qualityWeight,
    });
  }

  return samples;
}

/**
 * Discovers up to 3 candidate radial shells around a Hough proposal center so that
 * an initial Hough detection on the inner silver/brass seam expands outward to the
 * true outer physical rim.
 */
function discoverRadialShells(
  buf: WorkImageBuffers,
  cx: number,
  cy: number,
  rInit: number,
  minWorkR: number,
  maxWorkR: number
): number[] {
  const { width, height, gxData, gyData, gradMag, labData } = buf;
  const rMin = Math.max(minWorkR * 0.78, rInit * 0.72);
  const rMax = Math.min(maxWorkR * 1.22, rInit * 1.76);
  const binStep = 2.0;
  const numBins = Math.floor((rMax - rMin) / binStep) + 1;
  if (numBins < 5) return [rInit];

  const shellRays = 36;
  const hist = new Float32Array(numBins);
  for (let k = 0; k < shellRays; k++) {
    const theta = (2 * Math.PI * k) / shellRays;
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);

    for (let b = 0; b < numBins; b++) {
      const r = rMin + b * binStep;
      const px = Math.round(cx + r * cosT);
      const py = Math.round(cy + r * sinT);
      if (px < 2 || py < 2 || px >= width - 2 || py >= height - 2) break;

      const idx = py * width + px;
      const mag = gradMag[idx];
      if (mag < 12) continue;

      const align = Math.abs(gxData[idx] * cosT + gyData[idx] * sinT) / mag;
      if (align < 0.52) continue;
      hist[b] += mag * align * align;
    }
  }

  // Smooth profile with [0.25, 0.5, 0.25] twice so minor center offsets still peak crisply
  let smooth = new Float32Array(hist);
  for (let pass = 0; pass < 2; pass++) {
    const next = new Float32Array(numBins);
    for (let i = 0; i < numBins; i++) {
      const l = i > 0 ? smooth[i - 1] : smooth[i];
      const r = i + 1 < numBins ? smooth[i + 1] : smooth[i];
      next[i] = 0.25 * l + 0.5 * smooth[i] + 0.25 * r;
    }
    smooth = next;
  }

  const peaks: Array<{ r: number; val: number }> = [];
  for (let i = 1; i < numBins - 1; i++) {
    if (smooth[i] >= smooth[i - 1] && smooth[i] >= smooth[i + 1] && smooth[i] > 90) {
      peaks.push({ r: rMin + i * binStep, val: smooth[i] });
    }
  }

  peaks.sort((a, b) => b.val - a.val);
  const seeds: number[] = [];
  for (const p of peaks) {
    if (seeds.every((s) => Math.abs(p.r - s) >= Math.max(6, 0.14 * s))) {
      seeds.push(p.r);
    }
    if (seeds.length >= 2) break;
  }

  // Always retain the raw Hough radius as one candidate seed if distinct
  if (
    rInit >= minWorkR * 0.8 &&
    rInit <= maxWorkR * 1.15 &&
    seeds.every((s) => Math.abs(rInit - s) >= Math.max(5, 0.08 * s))
  ) {
    seeds.push(rInit);
  }

  // Check if top seed looks like the inner silver/brass seam (~0.635 R),
  // and if so, explicitly hypothesize its scaled outer rim (r / 0.635).
  if (seeds.length > 0) {
    const primary = seeds[0];
    const outerGuess = primary / INNER_SEAM_RATIO;
    if (
      outerGuess >= minWorkR &&
      outerGuess <= maxWorkR * 1.15 &&
      seeds.every((s) => Math.abs(outerGuess - s) >= Math.max(6, 0.10 * s))
    ) {
      // Quick Lab-b contrast check inside primary vs just outside primary
      let bCoreSum = 0;
      let bCoreN = 0;
      let bHaloSum = 0;
      let bHaloN = 0;
      for (let k = 0; k < 24; k++) {
        const theta = (2 * Math.PI * k) / 24;
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);

        const xIn = Math.round(cx + primary * 0.45 * cosT);
        const yIn = Math.round(cy + primary * 0.45 * sinT);
        if (xIn >= 0 && yIn >= 0 && xIn < width && yIn < height) {
          bCoreSum += labData[(yIn * width + xIn) * 3 + 2];
          bCoreN++;
        }

        const xHalo = Math.round(cx + primary * 1.24 * cosT);
        const yHalo = Math.round(cy + primary * 1.24 * sinT);
        if (xHalo >= 0 && yHalo >= 0 && xHalo < width && yHalo < height) {
          bHaloSum += labData[(yHalo * width + xHalo) * 3 + 2];
          bHaloN++;
        }
      }
      const bCore = bCoreN > 0 ? bCoreSum / bCoreN : 128;
      const bHalo = bHaloN > 0 ? bHaloSum / bHaloN : 128;
      if (bHalo - bCore > 5.0) {
        seeds.push(outerGuess);
      }
    }
  }

  return seeds;
}

function solveCircumcircle(
  p1: BoundarySample,
  p2: BoundarySample,
  p3: BoundarySample
): { cx: number; cy: number; r: number } | null {
  const ax = p1.x;
  const ay = p1.y;
  const bx = p2.x;
  const by = p2.y;
  const cx = p3.x;
  const cy = p3.y;

  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  if (Math.abs(d) < 1e-5) return null;

  const aSq = ax * ax + ay * ay;
  const bSq = bx * bx + by * by;
  const cSq = cx * cx + cy * cy;

  const ux = (aSq * (by - cy) + bSq * (cy - ay) + cSq * (ay - by)) / d;
  const uy = (aSq * (cx - bx) + bSq * (ax - cx) + cSq * (bx - ax)) / d;
  const r = Math.hypot(ax - ux, ay - uy);
  if (!Number.isFinite(ux) || !Number.isFinite(uy) || !Number.isFinite(r) || r <= 1) {
    return null;
  }
  return { cx: ux, cy: uy, r };
}

/**
 * Solves weighted 3x3 linear system A * x = b via Gaussian elimination with partial pivoting.
 */
function solveLinearSystem(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((row, idx) => [...row, b[idx]]);

  for (let col = 0; col < n; col++) {
    let pivotRow = col;
    let pivotAbs = Math.abs(M[col][col]);
    for (let r = col + 1; r < n; r++) {
      const v = Math.abs(M[r][col]);
      if (v > pivotAbs) {
        pivotAbs = v;
        pivotRow = r;
      }
    }
    if (pivotAbs < 1e-12) return null;
    if (pivotRow !== col) {
      const tmp = M[col];
      M[col] = M[pivotRow];
      M[pivotRow] = tmp;
    }

    const diag = M[col][col];
    for (let r = col + 1; r < n; r++) {
      const factor = M[r][col] / diag;
      if (factor === 0) continue;
      for (let c = col; c <= n; c++) {
        M[r][c] -= factor * M[col][c];
      }
    }
  }

  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = M[r][n];
    for (let c = r + 1; c < n; c++) {
      s -= M[r][c] * x[c];
    }
    x[r] = s / M[r][r];
    if (!Number.isFinite(x[r])) return null;
  }
  return x;
}

/**
 * Deterministic consensus + weighted Gauss-Newton geometric circle fit.
 */
export function fitRobustCircle(
  samples: BoundarySample[],
  roughToleranceRatio = 0.085,
  tightInlierFit = true
): CircleFit | null {
  if (samples.length < 8) return null;

  const medR = median(samples.map((s) => s.r));
  const roughTol = Math.max(2.2, medR * roughToleranceRatio);

  // Deterministic ~120°-spaced triplet consensus
  let bestCx = 0;
  let bestCy = 0;
  let bestR = medR;
  let bestConsensusScore = -1;

  const n = samples.length;
  const stepI = Math.max(1, Math.floor(n / 24));
  const third = Math.max(1, Math.floor(n / 3));

  for (let i = 0; i < n; i += stepI) {
    for (let shift = -2; shift <= 2; shift += 2) {
      const j = (i + third + shift + n) % n;
      const k = (i + 2 * third - shift + n) % n;
      if (i === j || j === k || i === k) continue;
      const circ = solveCircumcircle(samples[i], samples[j], samples[k]);
      if (!circ || circ.r < medR * 0.65 || circ.r > medR * 1.45) continue;

      let score = 0;
      for (const s of samples) {
        const err = Math.abs(Math.hypot(s.x - circ.cx, s.y - circ.cy) - circ.r);
        if (err <= roughTol) {
          score += s.weight * (1 - 0.35 * (err / roughTol));
        }
      }
      if (score > bestConsensusScore) {
        bestConsensusScore = score;
        bestCx = circ.cx;
        bestCy = circ.cy;
        bestR = circ.r;
      }
    }
  }

  if (bestConsensusScore <= 0) return null;

  // Subset to rough consensus inliers
  let active = samples.filter(
    (s) => Math.abs(Math.hypot(s.x - bestCx, s.y - bestCy) - bestR) <= roughTol
  );
  if (active.length < 8) return null;

  let cx = bestCx;
  let cy = bestCy;
  let r = bestR;

  // Iterative Gauss-Newton geometric least squares with Tukey/Huber robust weights
  for (let iter = 0; iter < 6; iter++) {
    const absRes = active.map((s) => Math.abs(Math.hypot(s.x - cx, s.y - cy) - r));
    const currentMad = median(absRes);
    const huberK = Math.max(1.4, 1.8 * currentMad);

    const JtJ = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ];
    const Jtr = [0, 0, 0];

    for (const s of active) {
      const dx = s.x - cx;
      const dy = s.y - cy;
      const d = Math.hypot(dx, dy);
      if (d < 1e-4) continue;

      const res = d - r;
      const absE = Math.abs(res);
      const robWeight = absE <= huberK ? 1 : huberK / absE;
      const w = s.weight * robWeight;

      const j0 = -dx / d;
      const j1 = -dy / d;
      const j2 = -1;

      JtJ[0][0] += w * j0 * j0;
      JtJ[0][1] += w * j0 * j1;
      JtJ[0][2] += w * j0 * j2;
      JtJ[1][1] += w * j1 * j1;
      JtJ[1][2] += w * j1 * j2;
      JtJ[2][2] += w * j2 * j2;

      Jtr[0] += w * j0 * res;
      Jtr[1] += w * j1 * res;
      Jtr[2] += w * j2 * res;
    }

    JtJ[1][0] = JtJ[0][1];
    JtJ[2][0] = JtJ[0][2];
    JtJ[2][1] = JtJ[1][2];

    const step = solveLinearSystem(JtJ, Jtr.map((v) => -v));
    if (!step) break;
    cx += step[0];
    cy += step[1];
    r += step[2];

    if (Math.hypot(step[0], step[1], step[2]) < 1e-4) break;
  }

  if (!Number.isFinite(r) || r <= 2) return null;

  const allRes = samples.map((s) => Math.abs(Math.hypot(s.x - cx, s.y - cy) - r));
  const madAll = median(active.map((s) => Math.abs(Math.hypot(s.x - cx, s.y - cy) - r)));
  const finalTol = tightInlierFit
    ? Math.max(2.0, Math.min(r * 0.045, 2.5 * Math.max(madAll, 0.8)))
    : roughTol;

  const inliers = samples.filter((_, i) => allRes[i] <= finalTol);
  if (inliers.length < 8) return null;

  const inlierErrs = inliers.map((s) => Math.abs(Math.hypot(s.x - cx, s.y - cy) - r));
  const sqSum = inlierErrs.reduce((acc, e) => acc + e * e, 0);
  const rmse = Math.sqrt(sqSum / inliers.length);
  const mad = median(inlierErrs);

  return { cx, cy, r, rmse, mad, inliers };
}

/**
 * Signed Sampson approximate geometric residual (in px) from point (px, py)
 * to rotated ellipse (cx, cy, a, b, phi). Positive outside, negative inside.
 */
function ellipseSampsonSignedDist(
  px: number,
  py: number,
  cx: number,
  cy: number,
  a: number,
  b: number,
  phi: number
): number {
  const cosP = Math.cos(phi);
  const sinP = Math.sin(phi);
  const dx = px - cx;
  const dy = py - cy;
  const u = dx * cosP + dy * sinP;
  const v = -dx * sinP + dy * cosP;

  const a2 = a * a;
  const b2 = b * b;
  const f = (u * u) / a2 + (v * v) / b2 - 1;
  const gradNorm = Math.hypot((2 * u) / a2, (2 * v) / b2);
  return gradNorm > 1e-8 ? f / gradNorm : 0;
}

/**
 * Fits an outer ellipse via harmonic 2-theta initialization + damped
 * Levenberg-Marquardt minimizing geometric Sampson residuals with MAD trimming.
 */
export function fitRobustEllipse(
  samples: BoundarySample[],
  initCircle: CircleFit
): EllipseFit | null {
  if (samples.length < 24) return null;

  // Initial broad inlier set allowing mild elliptical eccentricity (up to ~0.75 axisRatio)
  const broadTol = Math.max(3.5, initCircle.r * 0.14);
  const candidates = samples.filter(
    (s) => Math.abs(Math.hypot(s.x - initCircle.cx, s.y - initCircle.cy) - initCircle.r) <= broadTol
  );
  if (candidates.length < 24) return null;

  // 5-term Fourier radial approximation: r(θ) ≈ c0 + cx_d cosθ + cy_d sinθ + c2 cos2θ + s2 sin2θ
  const A = Array.from({ length: 5 }, () => new Array(5).fill(0));
  const B = new Array(5).fill(0);

  for (const s of candidates) {
    const theta = Math.atan2(s.y - initCircle.cy, s.x - initCircle.cx);
    const ri = Math.hypot(s.x - initCircle.cx, s.y - initCircle.cy);
    const basis = [1, Math.cos(theta), Math.sin(theta), Math.cos(2 * theta), Math.sin(2 * theta)];
    const w = s.weight;
    for (let i = 0; i < 5; i++) {
      B[i] += w * basis[i] * ri;
      for (let j = 0; j < 5; j++) {
        A[i][j] += w * basis[i] * basis[j];
      }
    }
  }

  let cx = initCircle.cx;
  let cy = initCircle.cy;
  let a = initCircle.r;
  let b = initCircle.r;
  let phi = 0;

  const fCoeff = solveLinearSystem(A, B);
  if (fCoeff) {
    const [c0, dx, dy, c2, s2] = fCoeff;
    cx = initCircle.cx + clamp(dx, -initCircle.r * 0.1, initCircle.r * 0.1);
    cy = initCircle.cy + clamp(dy, -initCircle.r * 0.1, initCircle.r * 0.1);
    const amp = Math.min(c0 * 0.2, Math.hypot(c2, s2));
    a = Math.max(4, c0 + amp);
    b = Math.max(4, c0 - amp);
    phi = amp > 0.25 ? 0.5 * Math.atan2(s2, c2) : 0;
  }

  // Damped Levenberg-Marquardt over [cx, cy, a, b, phi] minimizing Sampson distance
  const eps = [1e-3, 1e-3, 1e-3, 1e-3, 1e-4];
  let lambda = 1e-3;
  let active = candidates;

  for (let iter = 0; iter < 8; iter++) {
    const absErrs = active.map((s) =>
      Math.abs(ellipseSampsonSignedDist(s.x, s.y, cx, cy, a, b, phi))
    );
    const curMad = median(absErrs);
    const huberK = Math.max(1.4, 2.0 * curMad);

    const JtJ = Array.from({ length: 5 }, () => new Array(5).fill(0));
    const Jtr = new Array(5).fill(0);
    let costBefore = 0;

    const params = [cx, cy, a, b, phi];
    for (const s of active) {
      const res = ellipseSampsonSignedDist(s.x, s.y, cx, cy, a, b, phi);
      const absE = Math.abs(res);
      const robW = absE <= huberK ? 1 : huberK / absE;
      const w = s.weight * robW;
      costBefore += w * res * res;

      const jac = new Array(5);
      for (let p = 0; p < 5; p++) {
        const pPlus = [...params];
        const pMinus = [...params];
        pPlus[p] += eps[p];
        pMinus[p] -= eps[p];
        const fPlus = ellipseSampsonSignedDist(
          s.x,
          s.y,
          pPlus[0],
          pPlus[1],
          pPlus[2],
          pPlus[3],
          pPlus[4]
        );
        const fMinus = ellipseSampsonSignedDist(
          s.x,
          s.y,
          pMinus[0],
          pMinus[1],
          pMinus[2],
          pMinus[3],
          pMinus[4]
        );
        jac[p] = (fPlus - fMinus) / (2 * eps[p]);
      }

      for (let i = 0; i < 5; i++) {
        Jtr[i] -= w * jac[i] * res;
        for (let j = i; j < 5; j++) {
          JtJ[i][j] += w * jac[i] * jac[j];
        }
      }
    }

    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < i; j++) JtJ[i][j] = JtJ[j][i];
      JtJ[i][i] += lambda * Math.max(1, JtJ[i][i]);
    }

    const delta = solveLinearSystem(JtJ, Jtr);
    if (!delta) {
      lambda *= 10;
      continue;
    }

    const nCx = cx + clamp(delta[0], -10, 10);
    const nCy = cy + clamp(delta[1], -10, 10);
    const nA = clamp(a + clamp(delta[2], -15, 15), initCircle.r * 0.75, initCircle.r * 1.45);
    const nB = clamp(b + clamp(delta[3], -15, 15), initCircle.r * 0.65, initCircle.r * 1.35);
    const nPhi = phi + clamp(delta[4], -0.4, 0.4);

    let costAfter = 0;
    for (const s of active) {
      const res = ellipseSampsonSignedDist(s.x, s.y, nCx, nCy, nA, nB, nPhi);
      const absE = Math.abs(res);
      const robW = absE <= huberK ? 1 : huberK / absE;
      costAfter += s.weight * robW * res * res;
    }

    if (costAfter <= costBefore + 1e-6) {
      cx = nCx;
      cy = nCy;
      a = nA;
      b = nB;
      phi = nPhi;
      lambda = Math.max(1e-5, lambda * 0.4);

      if (Math.hypot(delta[0], delta[1], delta[2], delta[3]) < 1e-3) break;
    } else {
      lambda *= 5;
    }

    // Re-trim extreme outliers after iteration 3
    if (iter === 3) {
      const trimTol = Math.max(2.2, Math.min(initCircle.r * 0.06, 2.5 * Math.max(curMad, 0.8)));
      const trimmed = candidates.filter(
        (s) => Math.abs(ellipseSampsonSignedDist(s.x, s.y, cx, cy, a, b, phi)) <= trimTol
      );
      if (trimmed.length >= 24) active = trimmed;
    }
  }

  // Canonicalize a >= b and phi in [-pi/2, pi/2)
  if (b > a) {
    const tmp = a;
    a = b;
    b = tmp;
    phi += Math.PI * 0.5;
  }
  while (phi >= Math.PI * 0.5) phi -= Math.PI;
  while (phi < -Math.PI * 0.5) phi += Math.PI;

  const errsAll = samples.map((s) =>
    Math.abs(ellipseSampsonSignedDist(s.x, s.y, cx, cy, a, b, phi))
  );
  const madActive = median(
    active.map((s) => Math.abs(ellipseSampsonSignedDist(s.x, s.y, cx, cy, a, b, phi)))
  );
  const finalTol = Math.max(2.0, Math.min(a * 0.045, 2.5 * Math.max(madActive, 0.8)));
  const inliers = samples.filter((_, i) => errsAll[i] <= finalTol);
  if (inliers.length < 18) return null;

  const inlierErrs = inliers.map((s) =>
    Math.abs(ellipseSampsonSignedDist(s.x, s.y, cx, cy, a, b, phi))
  );
  const rmse = Math.sqrt(inlierErrs.reduce((acc, e) => acc + e * e, 0) / inliers.length);
  const mad = median(inlierErrs);

  return {
    cx,
    cy,
    a,
    b,
    phi,
    rmse,
    mad,
    axisRatio: a > 1e-6 ? clamp(b / a, 0, 1) : 1,
    inliers,
  };
}

function measureSectorCoverage(inliers: BoundarySample[]): {
  sectorCoverage: number;
  maxMissingGap: number;
  quadrantMask: number;
} {
  const sectorHit = new Uint8Array(NUM_SECTORS);
  let quadrantMask = 0;

  for (const s of inliers) {
    let ang = s.theta % (2 * Math.PI);
    if (ang < 0) ang += 2 * Math.PI;
    const sec = Math.min(NUM_SECTORS - 1, Math.floor((ang / (2 * Math.PI)) * NUM_SECTORS));
    sectorHit[sec] = 1;
    const quad = Math.min(3, Math.floor((ang / (2 * Math.PI)) * 4));
    quadrantMask |= 1 << quad;
  }

  let covered = 0;
  for (let i = 0; i < NUM_SECTORS; i++) covered += sectorHit[i];

  // Circular longest consecutive zero run
  let maxGap = 0;
  let curGap = 0;
  for (let i = 0; i < NUM_SECTORS * 2; i++) {
    if (sectorHit[i % NUM_SECTORS] === 0) {
      curGap++;
      if (curGap > maxGap) maxGap = curGap;
    } else {
      curGap = 0;
    }
  }
  maxGap = Math.min(NUM_SECTORS, maxGap);

  return {
    sectorCoverage: covered / NUM_SECTORS,
    maxMissingGap: maxGap,
    quadrantMask,
  };
}

/**
 * Evaluates internal copper-nickel silver core, outer brass ring (across 8 sectors),
 * surround background, inner seam gradient strength, and inner-seam falsification
 * in a single fast pass over typed image arrays aligned with (cx, cy, a, b, phi).
 */
export function evaluateCoinAnatomy(
  buf: WorkImageBuffers,
  cx: number,
  cy: number,
  a: number,
  b: number,
  phi: number
): CoinAnatomyStats {
  const { width, height, labData, bgrData, gradMag } = buf;
  const cosP = Math.cos(phi);
  const sinP = Math.sin(phi);

  const minX = Math.max(0, Math.floor(cx - a * 1.35));
  const maxX = Math.min(width - 1, Math.ceil(cx + a * 1.35));
  const minY = Math.max(0, Math.floor(cy - a * 1.35));
  const maxY = Math.min(height - 1, Math.ceil(cy + a * 1.35));

  // Stride >= 1 on very large radii keeps scanning fast and uniform
  const step = a > 90 ? 2 : 1;

  let bInSum = 0;
  let wInSum = 0;
  let nIn = 0;

  let bOutSum = 0;
  let lOutSum = 0;
  let wOutSum = 0;
  let nOut = 0;

  let bSurSum = 0;
  let wSurSum = 0;
  let nSur = 0;

  const secBSum = new Float64Array(8);
  const secBN = new Int32Array(8);

  const aSafe = Math.max(4, a);
  const bSafe = Math.max(4, b);

  for (let y = minY; y <= maxY; y += step) {
    const dy = y - cy;
    const rowOff = y * width;
    for (let x = minX; x <= maxX; x += step) {
      const dx = x - cx;
      const u = (dx * cosP + dy * sinP) / aSafe;
      const v = (-dx * sinP + dy * cosP) / bSafe;
      const rhoSq = u * u + v * v;
      if (rhoSq > 1.72) continue;

      const rho = Math.sqrt(rhoSq);
      const idx = (rowOff + x) * 3;
      const labL = labData[idx];
      const labB = labData[idx + 2];
      const warmth = (bgrData[idx + 2] + bgrData[idx + 1]) * 0.5 - bgrData[idx];

      if (rho <= 0.52) {
        bInSum += labB;
        wInSum += warmth;
        nIn++;
      } else if (rho >= 0.70 && rho <= 0.95) {
        bOutSum += labB;
        lOutSum += labL;
        wOutSum += warmth;
        nOut++;

        let ang = Math.atan2(v, u);
        if (ang < 0) ang += 2 * Math.PI;
        const s = Math.min(7, Math.floor((ang / (2 * Math.PI)) * 8));
        secBSum[s] += labB;
        secBN[s]++;
      } else if (rho >= 1.08 && rho <= 1.32) {
        bSurSum += labB;
        wSurSum += warmth;
        nSur++;
      }
    }
  }

  const bIn = nIn > 0 ? bInSum / nIn : 128;
  const warmthIn = nIn > 0 ? wInSum / nIn : 0;
  const bOut = nOut > 0 ? bOutSum / nOut : 128;
  const ringMeanL = nOut > 0 ? lOutSum / nOut : 128;
  const warmthOut = nOut > 0 ? wOutSum / nOut : 0;
  const bSurround = nSur > 0 ? bSurSum / nSur : 128;
  const warmthSurround = nSur > 0 ? wSurSum / nSur : 0;

  const sectorBValues: number[] = [];
  for (let s = 0; s < 8; s++) {
    sectorBValues.push(secBN[s] > 0 ? secBSum[s] / secBN[s] : bOut);
  }
  const sortedSecB = [...sectorBValues].sort((x, y) => x - y);
  const ringMinB = sortedSecB[0] ?? bOut;
  const ringSecondMinB = sortedSecB[1] ?? ringMinB;
  const meanSecB = sectorBValues.reduce((acc, val) => acc + val, 0) / 8;
  const ringVarB =
    sectorBValues.reduce((acc, val) => acc + (val - meanSecB) ** 2, 0) / 8;
  const ringStdB = Math.sqrt(ringVarB);

  // Sample inner bimetallic seam edge gradient along ellipse contour at rho = 0.635..0.68
  let seamSum = 0;
  let seamCount = 0;
  for (let i = 0; i < 36; i++) {
    const t = (2 * Math.PI * i) / 36;
    const lx = 0.65 * aSafe * Math.cos(t);
    const ly = 0.65 * bSafe * Math.sin(t);
    const px = cx + lx * cosP - ly * sinP;
    const py = cy + lx * sinP + ly * cosP;
    if (px >= 1 && py >= 1 && px < width - 1 && py < height - 1) {
      seamSum += sampleFloatBilinear(gradMag, width, height, px, py);
      seamCount++;
    }
  }
  const seamEdgeMean = seamCount > 0 ? seamSum / seamCount : 0;

  const bDiff = bOut - bIn;
  const warmthDiff = warmthOut - warmthIn;

  // Detect whether candidate radius sits on the inner seam:
  // Inside [0.70..0.95] is still cool/silver (low bDiff), while [1.08..1.32] outside is warm brass.
  const isInnerSeamCandidate =
    bDiff < 4.5 &&
    bSurround - bOut > 6.0 &&
    warmthSurround - warmthOut > 9.0;

  return {
    bIn,
    bOut,
    bSurround,
    bDiff,
    warmthIn,
    warmthOut,
    warmthSurround,
    warmthDiff,
    ringMinB,
    ringSecondMinB,
    ringStdB,
    ringMeanL,
    surroundMeanB: bSurround,
    seamEdgeMean,
    isInnerSeamCandidate,
  };
}

/**
 * Performs multi-shell discovery + iterative radial outer-boundary refinement
 * around a single Hough candidate `(cxInit, cyInit, rInit)`.
 */
export function refineCoinOuterBoundary(
  buf: WorkImageBuffers,
  cxInit: number,
  cyInit: number,
  rInit: number,
  minWorkR: number,
  maxWorkR: number
): RefinedCoinCandidate | null {
  const shells = discoverRadialShells(buf, cxInit, cyInit, rInit, minWorkR, maxWorkR);

  let bestResult: RefinedCoinCandidate | null = null;
  let bestShellRank = -Infinity;

  for (const seedR of shells) {
    // Pass 1: Moderate radial search around seedR to overcome center drift & inner/outer bias
    const pass1Samples = sampleRadialBoundaryPoints(
      buf,
      cxInit,
      cyInit,
      () => seedR,
      0.80,
      1.22,
      minWorkR,
      maxWorkR,
      14
    );

    const roughCircle = fitRobustCircle(pass1Samples, 0.11, false);
    if (!roughCircle) continue;

    // Pass 2: Re-centered narrower search around refined circle center & radius
    const pass2Samples = sampleRadialBoundaryPoints(
      buf,
      roughCircle.cx,
      roughCircle.cy,
      () => roughCircle.r,
      0.83,
      1.17,
      minWorkR,
      maxWorkR,
      14
    );

    const refinedCircle = fitRobustCircle(pass2Samples, 0.085, true);
    if (!refinedCircle) continue;

    // Evaluate elliptical projection using Pass 2 samples (which preserved up to ±17% anisotropy)
    const ellipse = fitRobustEllipse(pass2Samples, refinedCircle);
    const circleCov = measureSectorCoverage(refinedCircle.inliers);

    let useEllipse = false;
    let finalCx = refinedCircle.cx;
    let finalCy = refinedCircle.cy;
    let semiMajor = refinedCircle.r;
    let semiMinor = refinedCircle.r;
    let angleRad = 0;
    let axisRatio = 1.0;
    let finalInliers = refinedCircle.inliers;
    let rmsePx = refinedCircle.rmse;
    let madPx = refinedCircle.mad;
    let coverage = circleCov;

    if (ellipse) {
      const ellCov = measureSectorCoverage(ellipse.inliers);
      const axisDiff = ellipse.a - ellipse.b;
      const sufficientArcForEllipse =
        ellCov.sectorCoverage >= 0.75 &&
        ellCov.quadrantMask === 0b1111 &&
        ellipse.inliers.length >= 28;

      if (
        sufficientArcForEllipse &&
        ellipse.axisRatio < 0.952 &&
        axisDiff > Math.max(2.4, 0.040 * ellipse.a) &&
        ellipse.rmse < refinedCircle.rmse * 0.72
      ) {
        useEllipse = true;
        finalCx = ellipse.cx;
        finalCy = ellipse.cy;
        semiMajor = ellipse.a;
        semiMinor = ellipse.b;
        angleRad = ellipse.phi;
        axisRatio = ellipse.axisRatio;

        // Pass 3: Tight re-sample directly along the fitted ellipse perimeter
        const pass3Samples = sampleRadialBoundaryPoints(
          buf,
          finalCx,
          finalCy,
          (t) => ellipseRadiusAtTheta(semiMajor, semiMinor, angleRad, t),
          0.90,
          1.10,
          minWorkR,
          maxWorkR,
          14
        );
        const reEllipse = fitRobustEllipse(pass3Samples, {
          ...refinedCircle,
          cx: finalCx,
          cy: finalCy,
          r: (semiMajor + semiMinor) * 0.5,
        });
        if (reEllipse && reEllipse.inliers.length >= 28) {
          finalCx = reEllipse.cx;
          finalCy = reEllipse.cy;
          semiMajor = reEllipse.a;
          semiMinor = reEllipse.b;
          angleRad = reEllipse.phi;
          axisRatio = reEllipse.axisRatio;
          finalInliers = reEllipse.inliers;
          rmsePx = reEllipse.rmse;
          madPx = reEllipse.mad;
          coverage = measureSectorCoverage(finalInliers);
        } else {
          finalInliers = ellipse.inliers;
          rmsePx = ellipse.rmse;
          madPx = ellipse.mad;
          coverage = ellCov;
        }
      }
    }

    if (!useEllipse) {
      // Pass 3: Tight circular re-sample around refined center for sub-0.3px precision
      const pass3CircleSamples = sampleRadialBoundaryPoints(
        buf,
        finalCx,
        finalCy,
        () => semiMajor,
        0.91,
        1.09,
        minWorkR,
        maxWorkR,
        14
      );
      const finalCircle = fitRobustCircle(pass3CircleSamples, 0.05, true);
      if (finalCircle && finalCircle.inliers.length >= refinedCircle.inliers.length * 0.9) {
        finalCx = finalCircle.cx;
        finalCy = finalCircle.cy;
        semiMajor = finalCircle.r;
        semiMinor = finalCircle.r;
        finalInliers = finalCircle.inliers;
        rmsePx = finalCircle.rmse;
        madPx = finalCircle.mad;
        coverage = measureSectorCoverage(finalInliers);
      }
    }

    if (
      finalCx - semiMajor < 4 ||
      finalCy - semiMajor < 4 ||
      finalCx + semiMajor >= buf.width - 4 ||
      finalCy + semiMajor >= buf.height - 4 ||
      semiMajor < minWorkR
    ) {
      continue;
    }

    const anatomy = evaluateCoinAnatomy(
      buf,
      finalCx,
      finalCy,
      semiMajor,
      semiMinor,
      angleRad
    );

    const inlierCoverage = finalInliers.length / NUM_RAYS;
    const meanInlierGrad =
      finalInliers.reduce((acc, s) => acc + s.mag, 0) / Math.max(1, finalInliers.length);
    const meanInlierAlign =
      finalInliers.reduce((acc, s) => acc + s.align, 0) / Math.max(1, finalInliers.length);
    const meanSharpness =
      finalInliers.reduce((acc, s) => acc + s.sharpness, 0) / Math.max(1, finalInliers.length);

    const tiltDegrees = (Math.acos(clamp(axisRatio, 0, 1)) * 180) / Math.PI;

    // Shell selection rank strongly prefers the true outer boundary over any interior seam
    const seamPenalty = anatomy.isInnerSeamCandidate ? -2.0 : 0;
    const outerCompat =
      clamp(anatomy.bDiff / 14, 0, 1) * 0.4 +
      clamp(inlierCoverage / 0.85, 0, 1) * 0.45 +
      clamp(1 - madPx / Math.max(4, semiMajor * 0.04), 0, 1) * 0.15;
    const shellRank = outerCompat + seamPenalty;

    if (shellRank > bestShellRank) {
      bestShellRank = shellRank;
      bestResult = {
        cx: finalCx,
        cy: finalCy,
        radius: semiMajor,
        semiMajor,
        semiMinor,
        ellipseAngleRad: angleRad,
        axisRatio,
        isElliptical: useEllipse,
        tiltDegrees,
        inlierCoverage,
        sectorCoverage: coverage.sectorCoverage,
        maxMissingSectorGap: coverage.maxMissingGap,
        rmsePx,
        madPx,
        meanInlierGrad,
        meanInlierAlign,
        meanSharpness,
        anatomy,
      };
    }
  }

  return bestResult;
}
