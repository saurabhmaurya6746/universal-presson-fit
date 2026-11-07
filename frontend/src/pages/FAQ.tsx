import { PageIntro } from "@/components/ui/PageIntro";
import { FaqAccordion } from "@/components/faq/FaqAccordion";
import { SEO } from "@/components/common/SEO";
import { faqs } from "@/data/faq";

export function FAQ() {
  return (
    <>
      <SEO
        title="Frequently Asked Questions"
        description="Answers about Aura Nails services, appointments, custom press-ons, sizing, care, and orders."
      />

      <PageIntro
        eyebrow="Questions, answered"
        title="Everything You Need to Know"
      >
        A little clarity before your appointment or custom order.
      </PageIntro>

      <section className="section-shell py-20">
        <FaqAccordion items={faqs} />
      </section>
    </>
  );
}
