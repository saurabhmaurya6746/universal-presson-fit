import { PageIntro } from "@/components/ui/PageIntro";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { FinalCta } from "@/components/ui/FinalCta";
import { SEO } from "@/components/common/SEO";
import founderImage from "@/assets/images/founder-khushi.jpg";

export function About() {
  const philosophy = [
    ["01", "Personal", "Designed around you, never a template."],
    ["02", "Handcrafted", "Made carefully by hand, detail by detail."],
    ["03", "Elegant", "Refined finishes with timeless appeal."],
    ["04", "Expressive", "Nails that say something about your aura."],
  ] as const;

  return (
    <>
      <SEO
        title="Meet Khushi"
        description="Discover the passion, craftsmanship, and personal philosophy behind Aura Nails by Khushi."
      />

      <PageIntro eyebrow="Our story" title="Meet Khushi">
        The artist and heart behind Aura Nails—where creativity, craftsmanship, and
        personal expression meet.
      </PageIntro>

      {/* Founder Story */}
      <section className="py-20 sm:py-24 lg:py-28">
        <div className="section-shell grid items-center gap-12 sm:gap-14 lg:grid-cols-12 lg:gap-16 xl:gap-20">
          <div className="lg:col-span-5 xl:col-span-5">
            <div className="relative mx-auto w-full max-w-md lg:max-w-none">
              <div className="overflow-hidden rounded-2xl bg-muted/40 shadow-luxe">
                <img
                  src={founderImage}
                  alt="Khushi, founder of Aura Nails"
                  width={900}
                  height={1110}
                  className="aspect-[4/5] w-full object-cover object-center transition-transform duration-700 hover:scale-[1.015]"
                  loading="lazy"
                />
              </div>
              <div className="absolute -bottom-5 -right-2 sm:-bottom-6 sm:right-6 md:right-8 bg-lavender/95 px-6 py-4 sm:px-7 sm:py-5 font-display text-xl sm:text-2xl tracking-wide text-foreground shadow-soft backdrop-blur-xs">
                Made with intention
              </div>
            </div>
          </div>
          <div className="flex flex-col justify-center lg:col-span-7 xl:col-span-7 lg:py-4 xl:pl-4">
            <SectionHeading
              eyebrow="A passion in every detail"
              title="Artistry you can feel"
            />
            <div className="mt-8 space-y-6 text-base sm:text-lg leading-relaxed text-muted-foreground font-sans">
              <p>
                Aura Nails began with Khushi’s love for transforming small
                details into something deeply personal. Every extension,
                hand-painted accent, and custom press-on set is approached as
                wearable art.
              </p>
              <p>
                From understanding your style to perfecting the final finish, the
                experience is thoughtful, warm, and tailored to you. It is luxury
                without distance—beautiful craftsmanship made approachable.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Philosophy */}
      <section className="bg-blush/25 py-24">
        <div className="section-shell">
          <SectionHeading
            centered
            eyebrow="Our philosophy"
            title="The Aura Nails Philosophy"
          />
          <div className="mt-12 grid gap-5 md:grid-cols-4">
            {philosophy.map(([number, title, desc]) => (
              <article key={title} className="border-t border-primary p-6">
                <span className="text-xs font-semibold text-lavender-deep">
                  {number}
                </span>
                <h3 className="mt-8 font-display text-3xl">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {desc}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <FinalCta />
    </>
  );
}
