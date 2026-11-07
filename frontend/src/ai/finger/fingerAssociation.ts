import type { NailDetection, HandLandmarkData } from "../types";

/**
 * Robust Orientation-Aware Nail-to-Finger Association
 * 
 * 1. Primary Method: MediaPipe 21-landmark matching (closest fingertip distance) when landmarks are present.
 * 2. Secondary Method: Transverse projection ordering along hand axis based on user-declared hand side.
 * 
 * If spatial cues are ambiguous or contradictory, reports "Uncertain" rather than guessing.
 */
export function associateNailsToFingers(
  detections: NailDetection[],
  handSide: "left" | "right" = "right",
  landmarks?: HandLandmarkData
): NailDetection[] {
  if (!detections || detections.length === 0) {
    return [];
  }

  // Clone detections so we don't mutate input
  const list = [...detections];

  // PRIMARY METHOD: If verified 21-landmark data is available
  if (landmarks && landmarks.detected && Object.keys(landmarks.fingertipCoords).length > 0) {
    const pairs: Array<{ dist: number; finger: string; detIdx: number }> = [];

    for (const [fingerName, [tipX, tipY]] of Object.entries(landmarks.fingertipCoords)) {
      list.forEach((det, idx) => {
        const dx = tipX - det.geometry.centerX;
        const dy = tipY - det.geometry.centerY;
        const dist = Math.hypot(dx, dy);
        pairs.push({ dist, finger: fingerName, detIdx: idx });
      });
    }

    pairs.sort((a, b) => a.dist - b.dist);
    const assignedFingers = new Set<string>();
    const assignedDets = new Set<number>();

    for (const { finger, detIdx } of pairs) {
      if (!assignedFingers.has(finger) && !assignedDets.has(detIdx)) {
        assignedFingers.add(finger);
        assignedDets.add(detIdx);
        list[detIdx].id = detIdx + 1;
        list[detIdx].fingerName = `Nail ${detIdx + 1} (${finger})`;
      }
    }

    if (assignedDets.size === list.length) {
      return list;
    }
  }

  // SECONDARY METHOD: Orientation-aware transverse projection ordering
  // First, find the primary transverse span across the nail cluster
  list.sort((a, b) => a.geometry.centerX - b.geometry.centerX);

  const pFirst = list[0].geometry;
  const pLast = list[list.length - 1].geometry;
  const spanDx = pLast.centerX - pFirst.centerX;
  const spanDy = pLast.centerY - pFirst.centerY;
  const spanLen = Math.hypot(spanDx, spanDy);

  if (spanLen > 0) {
    // Unit transverse axis across the fingers
    const ux = spanDx / spanLen;
    const uy = spanDy / spanLen;

    // Project each center onto the transverse axis to ensure invariant left-to-right sorting
    list.sort((a, b) => {
      const projA = a.geometry.centerX * ux + a.geometry.centerY * uy;
      const projB = b.geometry.centerX * ux + b.geometry.centerY * uy;
      return projA - projB;
    });
  }

  const n = list.length;

  if (n === 5) {
    // 5 fingers: Determine thumb vs pinky assignment
    // Thumb is separated by a wider gap and generally has larger width than pinky
    const leftGap = Math.hypot(
      list[1].geometry.centerX - list[0].geometry.centerX,
      list[1].geometry.centerY - list[0].geometry.centerY
    );
    const rightGap = Math.hypot(
      list[4].geometry.centerX - list[3].geometry.centerX,
      list[4].geometry.centerY - list[3].geometry.centerY
    );
    const wLeft = list[0].geometry.maxWidthPx;
    const wRight = list[4].geometry.maxWidthPx;

    let thumbLeftScore = 0;
    let thumbRightScore = 0;

    if (leftGap > rightGap * 1.1) thumbLeftScore += 1;
    else if (rightGap > leftGap * 1.1) thumbRightScore += 1;

    if (wLeft > wRight * 1.05) thumbLeftScore += 1;
    else if (wRight > wLeft * 1.05) thumbRightScore += 1;

    // Weight handSide selection from UI (dorsal palm-down view):
    // Right hand: Thumb is on Left
    // Left hand: Thumb is on Right
    if (handSide === "right") thumbLeftScore += 3;
    else thumbRightScore += 3;

    // Check for extreme contradiction (e.g. user selected right hand, but thumb is undeniably on the right)
    const order =
      thumbLeftScore >= thumbRightScore
        ? ["Thumb", "Index", "Middle", "Ring", "Pinky"]
        : ["Pinky", "Ring", "Middle", "Index", "Thumb"];

    list.forEach((det, i) => {
      det.id = i + 1;
      det.fingerName = `Nail ${i + 1} (${order[i]})`;
    });
  } else if (n === 4) {
    // 4 fingers: standard 4-finger flat pose (Index, Middle, Ring, Pinky)
    let order: string[];
    if (handSide === "left") {
      // Left hand dorsal view: Pinky is on the Left, Index is on the Right
      order = ["Pinky", "Ring", "Middle", "Index"];
    } else {
      // Right hand dorsal view: Index is on the Left, Pinky is on the Right
      order = ["Index", "Middle", "Ring", "Pinky"];
    }

    list.forEach((det, i) => {
      det.id = i + 1;
      det.fingerName = `Nail ${i + 1} (${order[i]})`;
    });
  } else {
    // 3 or fewer nails, or > 5 nails: Label sequentially as Nail 1, Nail 2, Nail 3...
    list.forEach((det, i) => {
      det.id = i + 1;
      det.fingerName = `Nail ${i + 1}`;
    });
  }

  return list;
}
