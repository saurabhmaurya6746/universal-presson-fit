import type { HandLandmarkData } from "../types";

/**
 * Browser Hand Detection Interface
 * 
 * Provides hand landmark detection interface and status reporting.
 * If a browser-compatible ML landmark model is not present, reports
 * detection as pending/unavailable rather than synthesizing fake landmarks.
 */
export class BrowserHandDetector {
  /**
   * Attempt hand landmark detection on image.
   * Currently marks ML landmarks as pending browser model integration.
   */
  public async detectHand(
    _img: HTMLImageElement | HTMLCanvasElement,
    handSideHint: "left" | "right" = "right"
  ): Promise<HandLandmarkData> {
    // Note: A dedicated browser hand landmark model (e.g. MediaPipe Tasks Vision Web)
    // is not currently bundled in this frontend repository.
    // We report this honestly rather than inventing synthetic landmark coordinates.
    return {
      detected: false,
      handedness: handSideHint,
      score: 0.0,
      landmarksPx: [],
      fingertipCoords: {},
    };
  }
}

export const handDetector = new BrowserHandDetector();
