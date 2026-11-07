import { Link } from "react-router-dom";
import { Gem, Heart, Palette, Ruler, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ImageCard } from "@/components/ui/ImageCard";
import { FinalCta } from "@/components/ui/FinalCta";
import { SEO } from "@/components/common/SEO";
import { services } from "@/data/services";
import { gallery } from "@/data/gallery";
import { siteConfig } from "@/data/siteConfig";
import logo from "@/assets/logo/aura-nails-logo.png";
import heroNails from "@/assets/images/hero-nails.jpg";
import mintNails from "@/assets/images/nails-mint.jpg";
import blushNails from "@/assets/images/nails-blush.jpg";
import ivoryNails from "@/assets/images/nails-ivory.jpg";

export function Home() {
  const values = [
    [Heart, "Handmade with Love"],
    [Gem, "Premium Finish"],
    [Palette, "Custom Designs"],
    [Ruler, "Perfect Fit"],
    [Sparkles, "Made for Your Aura"],
  ] as const;

  return (
    <>
      <SEO
        title="Luxury Nails"
        description="Luxury nail extensions and handmade custom press-on nails, created with love by Khushi."
      />

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-lavender/35">
        <div className="section-shell grid items-center gap-10 py-12 lg:h-[calc(100svh-5rem)] lg:max-h-[900px] lg:min-h-[720px] lg:grid-cols-[.9fr_1.1fr] lg:py-16">
          <div className="relative z-10 reveal">
            <img
              src={logo}
              alt="Aura Nails by Khushi"
              className="mb-7 size-28 rounded-full object-cover shadow-luxe sm:size-36"
            />
            <p className="text-xs font-bold uppercase tracking-[.22em] text-lavender-deep">
              Luxury nail atelier
            </p>
            <h1 className="mt-4 max-w-2xl text-6xl font-semibold leading-[.88] sm:text-8xl">
              Elevate Your Nails.
              <br />
              <em className="font-medium text-lavender-deep">Elevate Your Aura.</em>
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-muted-foreground">
              Luxury nail extensions and custom press-on nails, handmade with love by Khushi.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link to="/booking">Book Your Appointment</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/gallery">Explore Our Nails</Link>
              </Button>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-2xl lg:max-w-none">
            <div className="absolute -left-6 top-12 size-28 rotate-12 border border-lavender-deep/25 bg-mint/60 sm:size-40" />
            <div className="relative ml-auto aspect-[7/6] w-[92%] overflow-hidden rounded-t-[48%] shadow-luxe">
              <img
                src={heroNails}
                alt="Lavender chrome manicure with mint crystals"
                width={1408}
                height={1200}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="absolute -bottom-5 left-0 border border-border bg-background p-5 shadow-soft">
              <p className="font-display text-2xl font-medium">Handcrafted beauty</p>
              <p className="text-xs text-muted-foreground">Made to match your aura</p>
            </div>
          </div>
        </div>
      </section>

      {/* Atelier Story Preview */}
      <section className="py-24">
        <div className="section-shell grid items-center gap-12 lg:grid-cols-2">
          <SectionHeading
            eyebrow="The atelier"
            title="Where Beauty Meets Your Aura"
            text="Aura Nails creates elegant nail extensions and handmade custom press-on nails designed to reflect your personality, mood, and individual style."
          />
          <div className="grid grid-cols-2 gap-4">
            <img
              src={mintNails}
              alt="Mint botanical nail art"
              loading="lazy"
              className="aspect-[4/5] w-full object-cover"
            />
            <img
              src={blushNails}
              alt="Blush press-on nail collection"
              loading="lazy"
              className="mt-12 aspect-square w-full object-cover"
            />
          </div>
        </div>
      </section>

      {/* Signature Services */}
      <section className="bg-blush/25 py-24">
        <div className="section-shell">
          <SectionHeading
            eyebrow="Our artistry"
            title="Signature Services"
            text="Personalized nail artistry, thoughtfully made from first detail to final finish."
          />
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {services.slice(0, 4).map((s) => (
              <ImageCard key={s.title} {...s} />
            ))}
          </div>
        </div>
      </section>

      {/* Featured Press-On Collection */}
      <section className="py-24">
        <div className="section-shell">
          <SectionHeading eyebrow="The press-on edit" title="Featured Collection" />
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {gallery.slice(0, 3).map((item) => (
              <ImageCard
                key={item.name}
                image={item.image}
                title={item.name}
                description={`${item.category} — ${item.description}`}
                to="/gallery"
              />
            ))}
          </div>
          <div className="mt-10 text-center">
            <Button asChild variant="outline">
              <a href={siteConfig.instagramUrl} target="_blank" rel="noreferrer">
                Order via Instagram
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* AI Size Finder Highlight */}
      <section className="bg-mint/30 py-24">
        <div className="section-shell grid items-center gap-10 lg:grid-cols-2">
          <div className="relative">
            <img
              src={ivoryNails}
              alt="Perfectly fitted nail extensions"
              loading="lazy"
              className="mx-auto aspect-[4/5] max-h-[620px] w-full max-w-lg object-cover shadow-luxe"
            />
            <span className="absolute -right-3 -top-3 grid size-24 place-items-center rounded-full bg-lavender font-display text-xl text-foreground">
              AI fit
              <br />
              demo
            </span>
          </div>
          <div>
            <SectionHeading
              eyebrow="Size finder"
              title="Your Perfect Fit Starts Here"
              text="Not sure what nail size you need? Use our AI-powered Nail Size Finder demo to discover how the perfect press-on fit experience works."
            />
            <Button asChild className="mt-8" size="lg">
              <Link to="/ai-nail-size-finder">Find My Nail Size</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Why Aura Nails */}
      <section className="py-24">
        <div className="section-shell">
          <SectionHeading
            centered
            eyebrow="The Aura difference"
            title="Why Aura Nails"
          />
          <div className="mt-12 grid gap-px overflow-hidden border border-border bg-border sm:grid-cols-2 lg:grid-cols-5">
            {values.map(([Icon, label]) => (
              <div key={label} className="bg-background p-8 text-center">
                <Icon className="mx-auto size-6 text-lavender-deep" />
                <h3 className="mt-5 font-display text-2xl">{label}</h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Instagram Studio Notes */}
      <section className="bg-ivory py-24">
        <div className="section-shell">
          <SectionHeading eyebrow="From the studio" title="Nail Notes" />
          <div className="mt-10 columns-2 gap-4 md:columns-4">
            {gallery.slice(0, 6).map((item, i) => (
              <img
                key={`${item.name}-${i}`}
                src={item.image}
                alt={item.name}
                loading="lazy"
                className="mb-4 w-full break-inside-avoid object-cover"
              />
            ))}
          </div>
          <div className="mt-8 text-center">
            <Button asChild variant="outline">
              <a href={siteConfig.instagramUrl} target="_blank" rel="noreferrer">
                Follow {siteConfig.instagram}
              </a>
            </Button>
          </div>
        </div>
      </section>

      <FinalCta />
    </>
  );
}
