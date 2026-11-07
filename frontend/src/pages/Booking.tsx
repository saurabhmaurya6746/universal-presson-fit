import { useState } from "react";
import { PageIntro } from "@/components/ui/PageIntro";
import { BookingForm } from "@/components/booking/BookingForm";
import { BookingConfirmation } from "@/components/booking/BookingConfirmation";
import { SEO } from "@/components/common/SEO";

export function Booking() {
  const [submitted, setSubmitted] = useState(false);

  return (
    <>
      <SEO
        title="Book Your Appointment"
        description="Request an Aura Nails appointment for extensions, press-ons, nail art, bridal nails, or a custom set."
      />

      {submitted ? (
        <BookingConfirmation onReset={() => setSubmitted(false)} />
      ) : (
        <>
          <PageIntro eyebrow="Your next set" title="Book Your Aura">
            Share your preferences below. This is a request; your appointment is
            confirmed after Khushi contacts you.
          </PageIntro>

          <section className="section-shell py-20">
            <BookingForm onSuccess={() => setSubmitted(true)} />
          </section>
        </>
      )}
    </>
  );
}
