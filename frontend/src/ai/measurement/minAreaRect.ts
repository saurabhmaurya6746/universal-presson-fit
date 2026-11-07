export interface RotatedRectResult {
  width: number; // transverse_px = min(dim1, dim2) (nail width)
  height: number; // longitudinal_px = max(dim1, dim2) (nail length)
  angle: number; // orientation angle in degrees
  center: [number, number];
  area: number;
  corners?: Array<[number, number]>;
}

/**
 * Computes 2D Convex Hull using Andrew's Monotone Chain algorithm.
 * Time complexity: O(N log N)
 */
export function computeConvexHull(
  points: Array<[number, number]>
): Array<[number, number]> {
  if (points.length <= 2) {
    return [...points];
  }

  // Remove duplicates and sort by x ascending, then by y ascending
  const sorted = [...points].sort((a, b) => {
    if (a[0] !== b[0]) return a[0] - b[0];
    return a[1] - b[1];
  });

  const unique: Array<[number, number]> = [];
  for (let i = 0; i < sorted.length; i++) {
    if (
      i === 0 ||
      sorted[i][0] !== sorted[i - 1][0] ||
      sorted[i][1] !== sorted[i - 1][1]
    ) {
      unique.push(sorted[i]);
    }
  }

  if (unique.length <= 2) {
    return unique;
  }

  const cross = (
    o: [number, number],
    a: [number, number],
    b: [number, number]
  ) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

  // Lower hull
  const lower: Array<[number, number]> = [];
  for (const p of unique) {
    while (
      lower.length >= 2 &&
      cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0
    ) {
      lower.pop();
    }
    lower.push(p);
  }

  // Upper hull
  const upper: Array<[number, number]> = [];
  for (let i = unique.length - 1; i >= 0; i--) {
    const p = unique[i];
    while (
      upper.length >= 2 &&
      cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0
    ) {
      upper.pop();
    }
    upper.push(p);
  }

  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

/**
 * Computes the orientation-invariant minimum-area rotated bounding box
 * for a 2D contour using the Rotating Calipers algorithm.
 * 
 * Equivalent to cv2.minAreaRect(contour):
 * - dim1, dim2 = rotated_box_dimensions
 * - transverse_px = min(dim1, dim2) = nail width
 * - longitudinal_px = max(dim1, dim2) = nail length
 */
export function computeMinAreaRect(
  points: Array<[number, number]>
): RotatedRectResult {
  if (!points || points.length === 0) {
    return { width: 0, height: 0, angle: 0, center: [0, 0], area: 0 };
  }

  if (points.length < 3) {
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    for (const [x, y] of points) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    const w = Math.max(1, maxX - minX);
    const h = Math.max(1, maxY - minY);
    return {
      width: Math.min(w, h),
      height: Math.max(w, h),
      angle: 0,
      center: [(minX + maxX) / 2, (minY + maxY) / 2],
      area: w * h,
    };
  }

  // Try OpenCV.js WebAssembly if available in browser context
  if (
    typeof window !== "undefined" &&
    (window as any).cv &&
    typeof (window as any).cv.minAreaRect === "function" &&
    typeof (window as any).cv.matFromArray === "function"
  ) {
    try {
      const cv = (window as any).cv;
      const flat: number[] = new Array(points.length * 2);
      for (let i = 0; i < points.length; i++) {
        flat[i * 2] = points[i][0];
        flat[i * 2 + 1] = points[i][1];
      }
      const mat = cv.matFromArray(points.length, 1, cv.CV_32SC2, flat);
      const rect = cv.minAreaRect(mat);
      mat.delete();

      const d1 = Math.max(0.1, rect.size.width);
      const d2 = Math.max(0.1, rect.size.height);
      const transverse = Math.min(d1, d2);
      const longitudinal = Math.max(d1, d2);

      return {
        width: Math.round(transverse * 100) / 100,
        height: Math.round(longitudinal * 100) / 100,
        angle: Math.round(rect.angle * 10) / 10,
        center: [
          Math.round(rect.center.x * 10) / 10,
          Math.round(rect.center.y * 10) / 10,
        ],
        area: Math.round(transverse * longitudinal),
      };
    } catch {
      // Fallback to pure TS rotating calipers if OpenCV.js call fails
    }
  }

  // Pure TypeScript Rotating Calipers implementation
  const hull = computeConvexHull(points);
  if (hull.length < 3) {
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    for (const [x, y] of points) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    const w = Math.max(1, maxX - minX);
    const h = Math.max(1, maxY - minY);
    return {
      width: Math.min(w, h),
      height: Math.max(w, h),
      angle: 0,
      center: [(minX + maxX) / 2, (minY + maxY) / 2],
      area: w * h,
      corners: [
        [minX, minY],
        [maxX, minY],
        [maxX, maxY],
        [minX, maxY],
      ],
    };
  }

  let minArea = Infinity;
  let bestWidth = 1;
  let bestHeight = 1;
  let bestAngle = 0;
  let bestCenter: [number, number] = [0, 0];
  let bestCorners: Array<[number, number]> = [];

  const n = hull.length;
  for (let i = 0; i < n; i++) {
    const p1 = hull[i];
    const p2 = hull[(i + 1) % n];
    const dx = p2[0] - p1[0];
    const dy = p2[1] - p1[1];
    const len = Math.hypot(dx, dy);
    if (len === 0) continue;

    const ux = dx / len;
    const uy = dy / len;
    const vx = -uy;
    const vy = ux;

    let minU = Infinity, maxU = -Infinity;
    let minV = Infinity, maxV = -Infinity;

    for (const p of hull) {
      const u = p[0] * ux + p[1] * uy;
      const v = p[0] * vx + p[1] * vy;
      if (u < minU) minU = u;
      if (u > maxU) maxU = u;
      if (v < minV) minV = v;
      if (v > maxV) maxV = v;
    }

    const w = maxU - minU;
    const h = maxV - minV;
    const area = w * h;

    if (area < minArea && w > 0 && h > 0) {
      minArea = area;
      bestWidth = Math.min(w, h);
      bestHeight = Math.max(w, h);
      bestAngle = (Math.atan2(uy, ux) * 180) / Math.PI;

      const midU = (minU + maxU) / 2;
      const midV = (minV + maxV) / 2;
      bestCenter = [
        midU * ux + midV * vx,
        midU * uy + midV * vy,
      ];

      bestCorners = [
        [Math.round((minU * ux + minV * vx) * 10) / 10, Math.round((minU * uy + minV * vy) * 10) / 10],
        [Math.round((maxU * ux + minV * vx) * 10) / 10, Math.round((maxU * uy + minV * vy) * 10) / 10],
        [Math.round((maxU * ux + maxV * vx) * 10) / 10, Math.round((maxU * uy + maxV * vy) * 10) / 10],
        [Math.round((minU * ux + maxV * vx) * 10) / 10, Math.round((minU * uy + maxV * vy) * 10) / 10],
      ];
    }
  }

  return {
    width: Math.round(bestWidth * 100) / 100,
    height: Math.round(bestHeight * 100) / 100,
    angle: Math.round(bestAngle * 10) / 10,
    center: [
      Math.round(bestCenter[0] * 10) / 10,
      Math.round(bestCenter[1] * 10) / 10,
    ],
    area: Math.round(minArea),
    corners: bestCorners,
  };
}
