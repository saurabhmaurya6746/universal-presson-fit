import { Instagram, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PageIntro } from "@/components/ui/PageIntro";
import { siteConfig } from "@/data/siteConfig";

export interface BookingConfirmationProps {
  onReset: () => void;
}

export function BookingConfirmation({ onReset }: BookingConfirmationProps) {
  return (
    <>
      <PageIntro
        eyebrow="Request received"
        title="Your booking request has been received."
      >
        Khushi will get back to you shortly.
      </PageIntro>

      <section className="section-shell py-20 text-center">
        <div className="mx-auto flex max-w-md flex-col gap-3">
          <Button asChild size="lg">
            <a href={siteConfig.instagramUrl} target="_blank" rel="noreferrer">
              <Instagram className="size-4" />
              Message on Instagram
            </a>
          </Button>
          <Button size="lg" variant="outline" disabled>
            <MessageCircle className="size-4" />
            WhatsApp coming soon
          </Button>
          <Button variant="link" onClick={onReset} className="mt-2">
            Submit another request
          </Button>
        </div>
      </section>
    </>
  );
}
