import { Link } from "react-router-dom";
import { Clock, IndianRupee } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PageIntro } from "@/components/ui/PageIntro";
import { FinalCta } from "@/components/ui/FinalCta";
import { SEO } from "@/components/common/SEO";
import { services } from "@/data/services";

export function Services() {
  return (
    <>
      <SEO
        title="Nail Services"
        description="Explore luxury nail extensions, custom press-ons, nail art, bridal nails, and custom sets."
      />

      <PageIntro eyebrow="The service menu" title="Made for Your Aura">
        Every service is personalized to your shape, style, and occasion—with
        time and care reserved for the details.
      </PageIntro>

      <section className="py-20">
        <div className="section-shell space-y-16">
          {services.map((service, i) => (
            <article
              key={service.title}
              className="grid items-center gap-10 lg:grid-cols-2"
            >
              <div className={i % 2 ? "lg:order-2" : ""}>
                <img
                  src={service.image}
                  alt={service.title}
                  loading="lazy"
                  className="aspect-[4/3] w-full object-cover shadow-soft"
                />
              </div>
              <div className="max-w-xl">
                <p className="text-xs font-bold uppercase tracking-[.2em] text-lavender-deep">
                  0{i + 1} · {service.category}
                </p>
                <h2 className="mt-3 font-display text-5xl font-semibold">
                  {service.title}
                </h2>
                <p className="mt-5 leading-8 text-muted-foreground">
                  {service.description}
                </p>
                <div className="mt-6 flex flex-wrap gap-5 border-y border-border py-4 text-sm">
                  <span className="flex items-center gap-2 text-foreground">
                    <IndianRupee className="size-4 text-lavender-deep" />
                    {service.priceNote || "Price on consultation"}
                  </span>
                  <span className="flex items-center gap-2 text-foreground">
                    <Clock className="size-4 text-lavender-deep" />
                    {service.durationNote || "Duration varies"}
                  </span>
                </div>
                <Button asChild className="mt-7">
                  <Link to="/booking">Book Now</Link>
                </Button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <FinalCta />
    </>
  );
}
