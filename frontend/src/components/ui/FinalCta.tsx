import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { siteConfig } from "@/data/siteConfig";

export function FinalCta() {
  return (
    <section className="bg-lavender/40 py-20">
      <div className="section-shell text-center">
        <SectionHeading
          centered
          title="Ready to Elevate Your Aura?"
          text="Book your appointment or order your custom press-on set."
        />
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link to="/booking">Book Appointment</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <a href={siteConfig.instagramUrl} target="_blank" rel="noreferrer">
              Message on Instagram
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}
