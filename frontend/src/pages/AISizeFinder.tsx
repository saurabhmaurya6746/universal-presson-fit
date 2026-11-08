import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Sparkles, X, HelpCircle } from "lucide-react";
import { PageIntro } from "@/components/ui/PageIntro";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { FaqAccordion } from "@/components/faq/FaqAccordion";
import { SizeFinderUpload } from "@/components/size-finder/SizeFinderUpload";
import { SizeFinderAnalyzing } from "@/components/size-finder/SizeFinderAnalyzing";
import { SizeFinderResults } from "@/components/size-finder/SizeFinderResults";
import { BrandFitComparison } from "@/components/brand/BrandFitComparison";
import { SEO } from "@/components/common/SEO";
import { sizeFinderFaqs } from "@/data/faq";
import { getBrandById } from "@/services/brandService";
import {
  analyzeNailImage,
  validateNailPhoto,
} from "@/services/sizeFinderService";
import type { NailSizeResult } from "@/types";
import type { PipelineProgressInfo } from "@/ai/types";

export function AISizeFinder() {
  const [searchParams, setSearchParams] = useSearchParams();
  const brandParam = searchParams.get("brand") || null;
  const targetBrand = brandParam ? getBrandById(brandParam) : null;

  const [handSide, setHandSide] = useState<"left" | "right" | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [stage, setStage] = useState<"upload" | "analyzing" | "results">("upload");
  const [analyzingStatus, setAnalyzingStatus] = useState<string>("");
  const [progressInfo, setProgressInfo] = useState<PipelineProgressInfo | null>(null);
  const [error, setError] = useState<string>("");
  const [results, setResults] = useState<NailSizeResult | null>(null);

  const handleBrandSelect = (brandId: string | null) => {
    if (brandId) {
      setSearchParams({ brand: brandId }, { replace: true });
    } else {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("brand");
      setSearchParams(nextParams, { replace: true });
    }
  };

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const handleFileSelect = (selectedFile?: File) => {
    setError("");
    if (!selectedFile) return;

    const validation = validateNailPhoto(selectedFile);
    if (!validation.isValid) {
      setError(validation.error || "Invalid file.");
      return;
    }

    if (preview) URL.revokeObjectURL(preview);
    setFile(selectedFile);
    setPreview(URL.createObjectURL(selectedFile));
  };

  const handleAnalyze = async () => {
    if (!file) return;

    if (!handSide) {
      setError("Please select which hand you are showing (Left Hand or Right Hand).");
      return;
    }

    setError("");
    setAnalyzingStatus("Initializing browser AI vision...");
    setProgressInfo(null);
    setStage("analyzing");

    try {
      const data = await analyzeNailImage(file, handSide, (status, progress) => {
        setAnalyzingStatus(status);
        if (progress) setProgressInfo(progress);
      });
      if (typeof window !== "undefined") {
        (window as any).__LAST_AI_RESULTS__ = data;
      }
      setResults(data);
      setStage("results");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to analyze photo.";
      setError(message);
      setStage("upload");
    }
  };

  const handleReset = () => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview("");
    setError("");
    setHandSide(null);
    setProgressInfo(null);
    setResults(null);
    setStage("upload");
  };

  return (
    <>
      <SEO
        title="Find My Size | Nail World Universal Sizing"
        description="Nail World: Universal AI-powered press-on nail sizing platform by TechHelp Solutions. Perfect Fit. Every Time. Measure your natural fingernails in millimeters using a ₹10 reference coin and compare with any press-on brand."
      />

      <PageIntro
        eyebrow="Nail World Universal Sizing"
        title="Find Your Perfect Press-On Nail Size"
      >
        Upload an overhead photo of your hand with a ₹10 coin. Get calibrated millimeter widths and find your exact size for any press-on nail brand. No login required.
      </PageIntro>

      <section className="section-shell py-14">
        <div className="mx-auto max-w-5xl">
          {/* How Sizing Works Educational Banner */}
          <div className="mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl bg-card border border-border/80 p-4 text-xs shadow-xs">
            <div className="flex items-center gap-2.5">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-lavender/60 text-lavender-deep">
                <HelpCircle className="size-4" />
              </span>
              <span className="text-muted-foreground">
                <strong className="text-foreground">How it works:</strong> ₹10 reference coin calibrates true millimeter scale; AI measures natural nail widths; compare with any brand chart.
              </span>
            </div>
            <Link
              to="/how-sizing-works"
              className="inline-flex shrink-0 items-center gap-1 font-semibold text-lavender-deep hover:underline ml-9 sm:ml-0"
            >
              How sizing works & fit tips →
            </Link>
          </div>

          {stage === "upload" && (
            <>
              {targetBrand && (
                <div className="mb-6 flex items-center justify-between gap-3 rounded-2xl border border-lavender-deep/30 bg-lavender/25 p-4 text-xs sm:text-sm">
                  <div className="flex items-center gap-2">
                    <Sparkles className="size-4 text-lavender-deep" />
                    <span>
                      Measuring for <strong>{targetBrand.name}</strong> sizing chart.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleBrandSelect(null)}
                    className="inline-flex items-center gap-1 font-semibold text-muted-foreground hover:text-foreground"
                    title="Remove brand target"
                  >
                    <span>Clear</span>
                    <X className="size-3.5" />
                  </button>
                </div>
              )}
              <SizeFinderUpload
                file={file}
                preview={preview}
                error={error}
                handSide={handSide}
                onHandSideSelect={setHandSide}
                onFileSelect={handleFileSelect}
                onAnalyze={handleAnalyze}
                onError={setError}
              />
            </>
          )}

          {stage === "analyzing" && (
            <SizeFinderAnalyzing status={analyzingStatus} progress={progressInfo} />
          )}

          {stage === "results" && results && (
            <>
              <BrandFitComparison
                results={results}
                selectedBrandId={brandParam}
                onBrandSelect={handleBrandSelect}
              />
              <SizeFinderResults results={results} onReset={handleReset} />
            </>
          )}
        </div>
      </section>

      {/* Size Finder FAQ Section */}
      <section className="bg-blush/20 py-20">
        <div className="section-shell">
          <SectionHeading
            centered
            eyebrow="Size finder FAQ"
            title="Before You Measure"
          />
          <div className="mt-10">
            <FaqAccordion items={sizeFinderFaqs} />
          </div>
        </div>
      </section>
    </>
  );
}
