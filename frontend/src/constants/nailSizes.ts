/**
 * Single Centralized Production Size Chart for PressOn AI
 * Exact source of truth matching standard nail manufacturing sizes (0 - 9).
 *
 * Exact Mappings:
 * Nail Number 0 = 18 mm
 * Nail Number 1 = 16 mm
 * Nail Number 2 = 15 mm
 * Nail Number 3 = 14 mm
 * Nail Number 4 = 13 mm
 * Nail Number 5 = 12 mm
 * Nail Number 6 = 11 mm
 * Nail Number 7 = 10 mm
 * Nail Number 8 = 9 mm
 * Nail Number 9 = 8 mm
 */

export interface StandardNailSize {
  size: string;
  nominalMm: number;
  minMm: number;
  maxMm: number;
}

export const PRODUCTION_NAIL_SIZE_CHART: StandardNailSize[] = [
  { size: "0", nominalMm: 18.0, minMm: 17.0, maxMm: Infinity },
  { size: "1", nominalMm: 16.0, minMm: 15.5, maxMm: 17.0 },
  { size: "2", nominalMm: 15.0, minMm: 14.5, maxMm: 15.5 },
  { size: "3", nominalMm: 14.0, minMm: 13.5, maxMm: 14.5 },
  { size: "4", nominalMm: 13.0, minMm: 12.5, maxMm: 13.5 },
  { size: "5", nominalMm: 12.0, minMm: 11.5, maxMm: 12.5 },
  { size: "6", nominalMm: 11.0, minMm: 10.5, maxMm: 11.5 },
  { size: "7", nominalMm: 10.0, minMm: 9.5, maxMm: 10.5 },
  { size: "8", nominalMm: 9.0, minMm: 8.5, maxMm: 9.5 },
  { size: "9", nominalMm: 8.0, minMm: 7.5, maxMm: 8.5 },
];

/**
 * Recommends standard press-on nail size based on calibrated width in millimeters.
 */
export function recommendNailSize(widthMm: number | null | undefined): string {
  if (widthMm === null || widthMm === undefined || isNaN(widthMm)) {
    return "Unknown";
  }

  const roundedWidth = Math.round(widthMm * 100) / 100;

  if (roundedWidth < 7.5) {
    return "Outside supported size range";
  }

  for (const item of PRODUCTION_NAIL_SIZE_CHART) {
    if (roundedWidth >= item.minMm && roundedWidth < item.maxMm) {
      return item.size;
    }
  }

  if (roundedWidth >= 17.0) {
    return "0";
  }

  return "Outside supported size range";
}
