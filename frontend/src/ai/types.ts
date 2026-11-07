/**
 * PressOnAI Client-Side AI Type Definitions
 */

export interface LetterboxMeta {
  origW: number;
  origH: number;
  targetW: number;
  targetH: number;
  ratio: number;
  padX: number;
  padY: number;
  newW: number;
  newH: number;
}

export interface RawBoxCandidate {
  score: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  w: number;
  h: number;
  maskCoeffs: Float32Array | null;
}

export interface MaskGeometry {
  maxWidthPx: number;
  maxHeightPx: number;
  centerX: number;
  centerY: number;
  areaPx: number;
  measureRow: number;
  contourPoints: Array<[number, number]>;
  angleDeg?: number;
  aspectRatio?: number;
  rotatedCorners?: Array<[number, number]>;
}

export interface NailDetection {
  id: number;
  className: string;
  classId: number;
  score: number;
  origBox: [number, number, number, number]; // [x1, y1, x2, y2] in original image px
  letterboxBox: [number, number, number, number]; // [x1, y1, x2, y2] in 416x416 space
  color: { rgb: string; hex: string };
  maskPixels: number;
  maskCanvas: HTMLCanvasElement | null;
  geometry: MaskGeometry;
  fingerName?: string;
  widthMm?: number;
  heightMm?: number;
  recommendedSize?: string;
  angleDeg?: number;
  aspectRatio?: number;
  rotatedCorners?: Array<[number, number]>;
}

export interface ModelDebugInfo {
  modelName: string;
  executionProvider: string;
  inputNames: readonly string[] | string[];
  inputShapes: string[];
  outputNames: readonly string[] | string[];
  outputShapes: string[];
  modelLoadTimeMs: number;
  preprocessTimeMs: number;
  inferenceTimeMs: number;
  postprocessTimeMs: number;
  totalTimeMs: number;
  numDetections: number;
  confidenceThreshold: number;
  iouThreshold: number;
}

export interface CalibrationCandidateDebug {
  center: [number, number];
  radius: number;
  diameterPx: number;
  confidence: number;
  status: "selected" | "rejected";
  reason?: string;
  outerCoverage?: number;
  innerCoverage?: number;
  avgGrad?: number;
  contrast?: number;
  edgeSupport?: number;
  bDiff?: number;
  warmthDiff?: number;
  outerB?: number;
  ringMinB?: number;
  ringStdB?: number;
  seamEdgeMean?: number;
}

export interface CalibrationResult {
  detected: boolean;
  method: string;
  referenceDiameterMm: number;
  detectedDiameterPx?: number;
  pixelsPerMm?: number;
  center?: [number, number];
  radius?: number;
  confidence?: number;
  message: string;
  rejectionReason?: string;
  candidates?: CalibrationCandidateDebug[];
}

export interface HandLandmarkData {
  detected: boolean;
  handedness: "left" | "right" | "unknown";
  score: number;
  landmarksPx: Array<[number, number]>;
  fingertipCoords: Record<string, [number, number]>;
}

export interface ValidationIssue {
  code:
    | "COIN_MISSING_OR_INVALID"
    | "RESOLUTION_TOO_LOW"
    | "NAIL_COUNT_LOW"
    | "NAIL_COUNT_PARTIAL"
    | "NAIL_COUNT_EXCESSIVE"
    | "FINGER_SEPARATION_TOO_CLOSE"
    | "INDEX_VS_PINKY_ABNORMAL"
    | "ASPECT_RATIO_EXCESSIVE"
    | "WIDTH_SUSPICIOUSLY_NARROW"
    | "LONGITUDINAL_CURL";
  severity: "error" | "warning";
  message: string;
  finger?: string;
  metric?: string;
  value?: number;
  threshold?: number;
}

export interface PhotoValidationDiagnostics {
  imageResolution: { width: number; height: number };
  minImageDimension: number;
  coinDetected: boolean;
  coinConfidence: number;
  coinDiameterPx: number;
  pixelsPerMm: number;
  nailCount: number;
  fingerLabels: string[];
  nailMetrics: Array<{
    finger: string;
    widthPx: number;
    heightPx: number;
    widthMm?: number;
    heightMm?: number;
    aspectRatio: number;
    angleDeg?: number;
    contourPointCount?: number;
    boundingBox?: [number, number, number, number];
    center?: [number, number];
    maskPixels?: number;
  }>;
  fingerSeparation?: Array<{
    pair: string;
    distancePx: number;
    avgWidthPx: number;
    ratio: number;
    passed: boolean;
  }>;
  longitudinalDisplacementMm?: number;
}

export interface PhotoValidationResult {
  passed: boolean;
  primaryError?: string;
  issues: ValidationIssue[];
  diagnostics: PhotoValidationDiagnostics;
}

export interface PipelineProgressInfo {
  step: 1 | 2 | 3 | 4 | 5;
  title: string;
  detail: string;
  percent: number;
  badge?: string;
  completedSteps?: number[];
  stepBadges?: Record<number, string>;
}

export interface PipelineExecutionResult {
  success: boolean;
  annotatedImageDataUrl: string;
  detections: NailDetection[];
  calibration: CalibrationResult;
  handLandmarks: HandLandmarkData;
  debugInfo: ModelDebugInfo;
  validation?: PhotoValidationResult;
  error?: string;
}
