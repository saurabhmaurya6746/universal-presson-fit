import React from "react";
import {
  Camera,
  Sparkles,
  Scan,
  Coins,
  Ruler,
  Check,
  Loader2,
  ShieldCheck,
  Lock,
} from "lucide-react";
import type { PipelineProgressInfo } from "@/ai/types";

export interface SizeFinderAnalyzingProps {
  status?: string;
  progress?: PipelineProgressInfo | null;
}

interface StepMeta {
  step: 1 | 2 | 3 | 4 | 5;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  detail: string;
  defaultBadge: string;
}

const PIPELINE_STEPS: StepMeta[] = [
  {
    step: 1,
    icon: Camera,
    title: "Photo Optimization & Alignment",
    detail: "Standardizing resolution & orientation for mobile AI",
    defaultBadge: "Photo Optimized",
  },
  {
    step: 2,
    icon: Sparkles,
    title: "AI Vision Engine",
    detail: "Loading local on-device neural vision network",
    defaultBadge: "AI Engine Ready",
  },
  {
    step: 3,
    icon: Scan,
    title: "Nail Detection & Segmentation",
    detail: "Locating nail contours and extracting precision masks",
    defaultBadge: "Nails Located",
  },
  {
    step: 4,
    icon: Coins,
    title: "₹10 Reference Coin Calibration",
    detail: "Verifying 27.0 mm coin scale for millimeter accuracy",
    defaultBadge: "₹10 Coin Verified (27 mm)",
  },
  {
    step: 5,
    icon: Ruler,
    title: "Precision Sizing & Fit Matching",
    detail: "Calculating millimeter dimensions for press-on sizes 0–9",
    defaultBadge: "Custom Sizes Ready",
  },
];

function inferFromStatus(status?: string): {
  step: 1 | 2 | 3 | 4 | 5;
  percent: number;
  completedSteps: number[];
  stepBadges: Record<number, string>;
} {
  const s = (status || "").toLowerCase();
  const badges: Record<number, string> = {};
  const completed: number[] = [];

  if (
    s.includes("photo") ||
    s.includes("image") ||
    s.includes("resolution") ||
    s.includes("downscal")
  ) {
    return { step: 1, percent: 18, completedSteps: [], stepBadges: {} };
  }
  if (
    s.includes("model") ||
    s.includes("engine") ||
    s.includes("neural") ||
    s.includes("runtime") ||
    s.includes("initializ") ||
    s.includes("vision")
  ) {
    completed.push(1);
    badges[1] = "Photo Optimized";
    return { step: 2, percent: 38, completedSteps: completed, stepBadges: badges };
  }
  if (
    s.includes("nail") ||
    s.includes("segment") ||
    s.includes("detect") ||
    s.includes("contour") ||
    s.includes("mask")
  ) {
    completed.push(1, 2);
    badges[1] = "Photo Optimized";
    badges[2] = "AI Engine Ready";
    return { step: 3, percent: 62, completedSteps: completed, stepBadges: badges };
  }
  if (
    s.includes("coin") ||
    s.includes("calibrat") ||
    s.includes("landmark") ||
    s.includes("hand") ||
    s.includes("scale")
  ) {
    completed.push(1, 2, 3);
    badges[1] = "Photo Optimized";
    badges[2] = "AI Engine Ready";
    badges[3] = "Nails Located";
    return { step: 4, percent: 80, completedSteps: completed, stepBadges: badges };
  }
  if (
    s.includes("size") ||
    s.includes("millimeter") ||
    s.includes("measur") ||
    s.includes("fit") ||
    s.includes("profile") ||
    s.includes("complete") ||
    s.includes("finaliz")
  ) {
    completed.push(1, 2, 3, 4);
    badges[1] = "Photo Optimized";
    badges[2] = "AI Engine Ready";
    badges[3] = "Nails Located";
    badges[4] = "₹10 Coin Verified (27 mm)";
    return { step: 5, percent: 95, completedSteps: completed, stepBadges: badges };
  }

  return { step: 1, percent: 15, completedSteps: [], stepBadges: {} };
}

export function SizeFinderAnalyzing({ status, progress }: SizeFinderAnalyzingProps) {
  const fallback = inferFromStatus(status);

  const activeStep = progress?.step || fallback.step;
  const currentPercent = progress?.percent || fallback.percent;
  const completedSteps = progress?.completedSteps || fallback.completedSteps;
  const stepBadges = progress?.stepBadges || fallback.stepBadges;

  const currentStepMeta =
    PIPELINE_STEPS.find((s) => s.step === activeStep) || PIPELINE_STEPS[0];
  const activeTitle = progress?.title || status || currentStepMeta.title;
  const activeDetail = progress?.detail || currentStepMeta.detail;

  return (
    <div className="mx-auto w-full max-w-2xl px-2 py-4 sm:px-4 sm:py-8">
      {/* Main Glass/Card Container */}
      <div className="overflow-hidden rounded-3xl border border-lavender-deep/20 bg-gradient-to-b from-white via-card/90 to-lavender/10 p-5 shadow-xl sm:p-8">
        {/* Top Active Step Header */}
        <div className="text-center">
          {/* Step Pill */}
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-primary shadow-xs">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-primary" />
            </span>
            <span>Step {activeStep} of 5</span>
          </div>

          {/* Dynamic Headline */}
          <h2
            key={activeTitle}
            className="mt-3 font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl animate-in fade-in duration-300"
          >
            {activeTitle}
          </h2>

          <p className="mt-1 text-xs text-muted-foreground sm:text-sm tabular-nums">
            {activeDetail}
          </p>
        </div>

        {/* Smooth Gradient Progress Bar */}
        <div className="mt-6 sm:mt-7">
          <div className="mb-2 flex items-center justify-between text-xs font-medium">
            <span className="text-muted-foreground">Analysis Progress</span>
            <span className="font-semibold text-primary">{Math.round(currentPercent)}%</span>
          </div>

          <div
            role="progressbar"
            aria-valuenow={Math.round(currentPercent)}
            aria-valuemin={0}
            aria-valuemax={100}
            className="relative h-2.5 w-full overflow-hidden rounded-full bg-lavender/35 p-0.5"
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary via-lavender-deep to-primary transition-all duration-500 ease-out shadow-xs"
              style={{ width: `${Math.max(8, Math.min(100, currentPercent))}%` }}
            />
          </div>
        </div>

        {/* 5-Step Detailed Checklist */}
        <div className="mt-6 space-y-2.5 sm:mt-8 sm:space-y-3" role="list">
          {PIPELINE_STEPS.map((s) => {
            const isCompleted = completedSteps.includes(s.step);
            const isActive = activeStep === s.step && !isCompleted;
            const isPending = !isCompleted && !isActive;
            const Icon = s.icon;
            const badgeText = stepBadges[s.step] || (isCompleted ? s.defaultBadge : "");

            return (
              <div
                key={s.step}
                role="listitem"
                className={`relative flex items-center gap-3.5 rounded-2xl border p-3 transition-all duration-300 sm:gap-4 sm:p-4 ${
                  isActive
                    ? "border-primary/40 bg-white/95 shadow-md shadow-primary/5 ring-1 ring-primary/20 scale-[1.01]"
                    : isCompleted
                      ? "border-emerald-500/25 bg-emerald-50/30 text-foreground"
                      : "border-border/40 bg-card/40 opacity-60"
                }`}
              >
                {/* Left Status Icon Circle */}
                <div
                  className={`flex size-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold transition-all sm:size-10 sm:text-sm ${
                    isCompleted
                      ? "bg-emerald-500 text-white shadow-sm shadow-emerald-500/20"
                      : isActive
                        ? "bg-primary text-white shadow-md shadow-primary/30"
                        : "bg-muted text-muted-foreground/70"
                  }`}
                >
                  {isCompleted ? (
                    <Check className="size-5 stroke-[2.5]" />
                  ) : isActive ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : (
                    <span className="font-mono">{s.step}</span>
                  )}
                </div>

                {/* Step Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <Icon
                      className={`size-4 shrink-0 ${
                        isActive
                          ? "text-primary"
                          : isCompleted
                            ? "text-emerald-600"
                            : "text-muted-foreground"
                      }`}
                    />
                    <h3
                      className={`truncate text-xs font-semibold sm:text-sm ${
                        isActive
                          ? "text-foreground font-bold"
                          : isCompleted
                            ? "text-foreground"
                            : "text-muted-foreground"
                      }`}
                    >
                      {s.title}
                    </h3>
                  </div>

                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground sm:text-xs">
                    {s.detail}
                  </p>
                </div>

                {/* Right Badge / Status Pill */}
                <div className="shrink-0 text-right">
                  {isCompleted && badgeText && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 shadow-2xs sm:text-xs">
                      <Check className="size-3 stroke-[2.5]" />
                      <span className="truncate max-w-[120px] sm:max-w-none">{badgeText}</span>
                    </span>
                  )}

                  {isActive && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary shadow-2xs sm:text-xs">
                      <span className="size-1.5 animate-ping rounded-full bg-primary" />
                      <span>In Progress</span>
                    </span>
                  )}

                  {isPending && (
                    <span className="text-[11px] font-medium text-muted-foreground/50 sm:text-xs">
                      Queued
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Trust & Privacy Indicator */}
        <div className="mt-6 flex flex-col items-center justify-center gap-1.5 border-t border-border/40 pt-5 text-center text-xs text-muted-foreground sm:mt-8 sm:flex-row sm:gap-2">
          <div className="flex items-center gap-1.5 font-medium text-foreground/80">
            <Lock className="size-3.5 text-primary" />
            <span>100% On-Device AI</span>
          </div>
          <span className="hidden sm:inline text-muted-foreground/40">•</span>
          <span>No camera photos leave your phone</span>
          <span className="hidden sm:inline text-muted-foreground/40">•</span>
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <ShieldCheck className="size-3.5 text-emerald-600" />
            <span>Hardware Accelerated</span>
          </div>
        </div>
      </div>
    </div>
  );
}
