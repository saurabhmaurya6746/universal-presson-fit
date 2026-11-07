import { useEffect, useRef, useState } from "react";
import { Camera, RefreshCw, Upload, RotateCw, RotateCcw, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PhotoGuidance } from "@/components/size-finder/PhotoGuidance";
import exampleHandImage from "@/assets/images/size-finder-example.webp";
import { normalizeImageFile } from "@/utils/imageNormalizer";

export interface SizeFinderUploadProps {
  file: File | null;
  preview: string;
  error: string;
  handSide: "left" | "right" | null;
  onHandSideSelect: (side: "left" | "right") => void;
  onFileSelect: (file?: File) => void;
  onAnalyze: () => void;
  onError?: (message: string) => void;
}

function normalizeCapturedFile(file: File): File {
  try {
    if (file.name && file.name.includes(".")) {
      return file;
    }
    const ext =
      file.type === "image/png"
        ? ".png"
        : file.type === "image/webp"
        ? ".webp"
        : ".jpg";
    const name = (file.name || "captured_photo") + ext;
    return new File([file], name, {
      type: file.type || "image/jpeg",
      lastModified: file.lastModified || Date.now(),
    });
  } catch {
    return file;
  }
}

export function SizeFinderUpload({
  file,
  preview,
  error,
  handSide,
  onHandSideSelect,
  onFileSelect,
  onAnalyze,
  onError,
}: SizeFinderUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [cameraPermissionState, setCameraPermissionState] = useState<
    "granted" | "denied" | "prompt" | "unknown"
  >("unknown");
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [rotationAngle, setRotationAngle] = useState<number>(0);
  const [isRotating, setIsRotating] = useState<boolean>(false);

  useEffect(() => {
    if (file && !originalFile) {
      setOriginalFile(file);
      setRotationAngle(0);
    }
  }, [file, originalFile]);

  useEffect(() => {
    let isMounted = true;
    if (typeof navigator !== "undefined" && navigator.permissions?.query) {
      try {
        navigator.permissions
          .query({ name: "camera" as PermissionName })
          .then((status) => {
            if (!isMounted) return;
            setCameraPermissionState(status.state);
            status.onchange = () => {
              if (isMounted) setCameraPermissionState(status.state);
            };
          })
          .catch(() => {
            // Not supported on all browsers (e.g. Safari), proceed gracefully
          });
      } catch {
        // Ignore
      }
    }
    return () => {
      isMounted = false;
    };
  }, []);

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      try {
        const raw = normalizeCapturedFile(e.dataTransfer.files[0]);
        const normalized = await normalizeImageFile(raw);
        onFileSelect(normalized);
      } catch (err) {
        console.error("Error processing dropped file:", err);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleRotate = (deg: number) => {
    if (!file) return;
    setIsRotating(true);
    const newAngle = (rotationAngle + deg + 360) % 360;
    setRotationAngle(newAngle);

    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        setIsRotating(false);
        return;
      }

      canvas.width = img.height;
      canvas.height = img.width;

      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((deg * Math.PI) / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);

      canvas.toBlob(
        (blob) => {
          setIsRotating(false);
          if (blob) {
            const rotatedFile = new File([blob], file.name, {
              type: file.type || "image/jpeg",
              lastModified: Date.now(),
            });
            onFileSelect(rotatedFile);
          }
        },
        file.type || "image/jpeg",
        0.95
      );
    };
    img.onerror = () => setIsRotating(false);
    img.src = url;
  };

  const handleResetRotation = () => {
    if (originalFile) {
      setRotationAngle(0);
      onFileSelect(originalFile);
    }
  };

  const handleBrowseImages = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    onError?.("");
    setOriginalFile(null);
    setRotationAngle(0);
    if (fileInputRef.current) {
      try {
        fileInputRef.current.value = "";
      } catch {
        // ignore
      }
      fileInputRef.current.click();
    }
  };

  const handleTakePhoto = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    onError?.("");
    setOriginalFile(null);
    setRotationAngle(0);

    if (cameraPermissionState === "denied") {
      onError?.(
        'Camera access is blocked by your browser settings. Please allow camera permissions or use "Browse Images" instead.'
      );
      return;
    }

    try {
      if (cameraInputRef.current) {
        try {
          cameraInputRef.current.value = "";
        } catch {
          // ignore
        }
        cameraInputRef.current.click();
      }
    } catch {
      onError?.('Unable to open camera. Please use "Browse Images" instead.');
    }
  };

  return (
    <div className="grid gap-10 lg:grid-cols-[1.2fr_.8fr]">
      <div>
        {/* Required Hand Selection & Guidance Card */}
        <div className="mb-6 rounded-3xl border border-lavender-deep/25 bg-card/80 p-5 sm:p-6 shadow-soft text-left">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <span className="inline-block rounded-full bg-lavender/60 px-3 py-1 text-xs font-bold uppercase tracking-wider text-foreground">
                Required Selection
              </span>
              <h3 className="mt-2 font-display text-2xl sm:text-3xl font-medium text-foreground">
                Which hand are you showing?
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Determines anatomical finger sequence for precision press-on sizing.
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => onHandSideSelect("left")}
                className={`flex items-center justify-center rounded-2xl px-5 py-3 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  handSide === "left"
                    ? "bg-foreground text-background shadow-md ring-2 ring-foreground"
                    : "border border-border/80 bg-background/80 text-muted-foreground hover:bg-background hover:text-foreground hover:border-foreground/40"
                }`}
              >
                LEFT HAND
              </button>
              <button
                type="button"
                onClick={() => onHandSideSelect("right")}
                className={`flex items-center justify-center rounded-2xl px-5 py-3 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  handSide === "right"
                    ? "bg-foreground text-background shadow-md ring-2 ring-foreground"
                    : "border border-border/80 bg-background/80 text-muted-foreground hover:bg-background hover:text-foreground hover:border-foreground/40"
                }`}
              >
                RIGHT HAND
              </button>
            </div>
          </div>

          {/* Capture Instructions */}
          <div className="mt-4 border-t border-border/60 pt-3.5 grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="flex size-4.5 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 font-bold text-[11px] shrink-0">✓</span>
              <span className="font-medium text-foreground">Place your hand flat with your fingers pointing upward.</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex size-4.5 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 font-bold text-[11px] shrink-0">✓</span>
              <span className="font-medium text-foreground">Keep your fingers flat and all nails clearly visible.</span>
            </div>
          </div>
        </div>

        <div
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className="relative rounded-3xl border-2 border-dashed border-lavender-deep/35 bg-card/60 p-6 sm:p-8 text-center shadow-soft transition-colors hover:border-lavender-deep/55"
        >
          {!preview ? (
            /* Initial State: No Image Selected — Example Guidance */
            <div className="flex flex-col items-center">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-lavender/40 text-lavender-deep shadow-xs">
                <Upload className="size-6 text-lavender-deep" />
              </div>

              <h2 className="mt-4 font-display text-3xl sm:text-4xl font-medium tracking-tight text-foreground">
                Upload your hand photo
              </h2>

              <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-md">
                Place a physical ₹10 coin flat beside your hand under clear lighting.
                <span className="mt-1 block text-xs text-muted-foreground/80">
                  JPG, JPEG, PNG or WEBP · Maximum 15 MB
                </span>
              </p>

              {/* Visual Guide Card: Expected Hand Position */}
              <div className="mt-5 w-full max-w-md overflow-hidden rounded-2xl border border-lavender-deep/25 bg-background/60 p-3.5 shadow-xs">
                <div className="flex items-center justify-between pb-2 text-left">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-lavender-deep">
                      Expected Hand Position
                    </span>
                    <p className="text-[11px] text-muted-foreground">
                      Follow this example for accurate nail sizing
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 border border-emerald-500/20">
                    Guide Example
                  </span>
                </div>
                <div className="relative overflow-hidden rounded-xl bg-muted/20 border border-border/40">
                  <img
                    src={exampleHandImage}
                    alt="Visual guide: Hand placed flat with 4 straight parallel fingers and ₹10 coin"
                    className="h-auto max-h-52 w-full object-contain"
                    loading="eager"
                  />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-left text-[11px] text-muted-foreground/90">
                  <div className="flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-emerald-500" />
                    <span>Hand flat on surface</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-emerald-500" />
                    <span>Straight parallel fingers</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-emerald-500" />
                    <span>Nails facing camera</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-emerald-500" />
                    <span>₹10 coin flat beside hand</span>
                  </div>
                </div>
              </div>

              {/* Primary Action Buttons */}
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBrowseImages}
                  className="gap-2"
                >
                  <Upload className="size-4" />
                  Browse Images
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTakePhoto}
                  className="gap-2"
                >
                  <Camera className="size-4" />
                  Take Photo
                </Button>
              </div>
            </div>
          ) : (
            /* Selected State: User's Actual Image Preview */
            <div className="flex flex-col">
              <div className="flex items-center justify-between gap-3 border-b border-border/70 pb-3 text-left">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-sm font-medium text-foreground">
                    Photo ready for analysis
                  </span>
                </div>
                <span className="max-w-[160px] sm:max-w-xs truncate text-xs text-muted-foreground">
                  {file?.name || "Uploaded photo"}
                </span>
              </div>

              <div className="mt-4 relative mx-auto w-full overflow-hidden rounded-2xl border border-border/80 bg-background/50 p-2 shadow-xs">
                <div className="flex items-center justify-center overflow-hidden rounded-xl bg-muted/30">
                  <img
                    src={preview}
                    alt="Selected hand preview"
                    className="max-h-80 sm:max-h-96 w-full object-contain rounded-lg"
                  />
                </div>
              </div>

              {/* Orientation & Rotation Toolbar */}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 bg-muted/25 px-3 py-2 text-xs">
                <span className="font-medium text-muted-foreground">
                  Adjust Orientation:
                </span>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleRotate(90)}
                    disabled={isRotating}
                    className="gap-1 h-7 text-xs px-2"
                    title="Rotate 90 degrees clockwise"
                  >
                    <RotateCw className="size-3" />
                    Rotate 90° CW
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleRotate(-90)}
                    disabled={isRotating}
                    className="gap-1 h-7 text-xs px-2"
                    title="Rotate 90 degrees counter-clockwise"
                  >
                    <RotateCcw className="size-3" />
                    Rotate 90° CCW
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleResetRotation}
                    disabled={isRotating || rotationAngle === 0}
                    className="gap-1 h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
                    title="Reset rotation to original image"
                  >
                    <Undo2 className="size-3" />
                    Reset
                  </Button>
                </div>
              </div>

              {/* Action Controls for Selected State */}
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleBrowseImages}
                    className="gap-1.5"
                  >
                    <RefreshCw className="size-3.5" />
                    Change Photo
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleTakePhoto}
                    className="gap-1.5"
                  >
                    <Camera className="size-3.5" />
                    Retake
                  </Button>
                </div>

                <Button
                  type="button"
                  onClick={onAnalyze}
                  className="gap-2 shadow-soft hover:shadow-md"
                >
                  Analyze Nail Sizes
                  <span aria-hidden="true">&rarr;</span>
                </Button>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div
            role="alert"
            className="mt-4 flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
          >
            <span className="size-1.5 rounded-full bg-destructive shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <input
          id="size-finder-file-input"
          name="size-finder-file-input"
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onClick={(e) => {
            (e.target as HTMLInputElement).value = "";
          }}
          onChange={async (e) => {
            try {
              const selected = e.target.files?.[0];
              if (selected) {
                const raw = normalizeCapturedFile(selected);
                const normalized = await normalizeImageFile(raw);
                onFileSelect(normalized);
              }
            } catch (err) {
              console.error("Failed to handle selected file:", err);
            }
          }}
        />
        <input
          id="size-finder-camera-input"
          name="size-finder-camera-input"
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onClick={(e) => {
            (e.target as HTMLInputElement).value = "";
          }}
          onChange={async (e) => {
            try {
              const selected = e.target.files?.[0];
              if (selected) {
                const raw = normalizeCapturedFile(selected);
                const normalized = await normalizeImageFile(raw);
                onFileSelect(normalized);
              }
            } catch (err) {
              console.error("Failed to handle camera captured file:", err);
            }
          }}
        />
      </div>

      <PhotoGuidance />
    </div>
  );
}
