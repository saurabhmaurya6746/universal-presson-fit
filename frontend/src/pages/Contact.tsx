import { useState } from "react";
import { Instagram, Mail, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PageIntro } from "@/components/ui/PageIntro";
import { SEO } from "@/components/common/SEO";
import { siteConfig } from "@/data/siteConfig";

const inputStyle =
  "mt-2 h-12 w-full border border-input bg-background px-4 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/20";

export function Contact() {
  const [done, setDone] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDone(true);
  };

  const handleReset = () => {
    setName("");
    setEmail("");
    setPhone("");
    setMessage("");
    setDone(false);
  };

  return (
    <>
      <SEO
        title="Contact Aura Nails"
        description="Contact Aura Nails by Khushi for custom nail designs, press-ons, appointments, and collaborations."
      />

      <PageIntro eyebrow="Get in touch" title="Let's Create Your Aura">
        Tell us what you’re dreaming of. We’ll help bring the details together.
      </PageIntro>

      <section className="section-shell grid gap-14 py-20 lg:grid-cols-[.8fr_1.2fr]">
        {/* Left column: Direct channels */}
        <div>
          <h2 className="font-display text-4xl">Start a conversation</h2>
          <div className="mt-8 space-y-4">
            <a
              className="flex items-center gap-4 border-b border-border py-5 transition-colors hover:text-lavender-deep"
              href={siteConfig.instagramUrl}
              target="_blank"
              rel="noreferrer"
            >
              <Instagram className="size-5 shrink-0" />
              <span>
                <b className="block">Instagram</b>
                <small className="text-muted-foreground">{siteConfig.instagram}</small>
              </span>
            </a>

            <div className="flex items-center gap-4 border-b border-border py-5 text-muted-foreground">
              <MessageCircle className="size-5 shrink-0" />
              <span>
                <b className="block text-foreground">WhatsApp</b>
                <small>{siteConfig.whatsappDisplay}</small>
              </span>
            </div>

            <div className="flex items-center gap-4 border-b border-border py-5 text-muted-foreground">
              <Mail className="size-5 shrink-0" />
              <span>
                <b className="block text-foreground">Email</b>
                <small>{siteConfig.emailDisplay}</small>
              </span>
            </div>
          </div>
        </div>

        {/* Right column: Form or confirmation */}
        {done ? (
          <div className="grid min-h-80 place-items-center bg-mint/30 p-10 text-center">
            <div>
              <h2 className="font-display text-5xl">Message received.</h2>
              <p className="mt-4 text-muted-foreground">
                Thank you. Khushi will get back to you shortly.
              </p>
              <Button className="mt-7" onClick={handleReset}>
                Send another
              </Button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="grid gap-5 bg-card p-6 shadow-soft sm:p-10"
          >
            <h2 className="font-display text-4xl">Send a message</h2>

            <label className="text-sm font-medium">
              Name <span className="text-destructive">*</span>
              <input
                required
                maxLength={100}
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className={inputStyle}
              />
            </label>

            <div className="grid gap-5 sm:grid-cols-2">
              <label className="text-sm font-medium">
                Email <span className="text-destructive">*</span>
                <input
                  required
                  type="email"
                  maxLength={255}
                  name="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your.email@example.com"
                  className={inputStyle}
                />
              </label>

              <label className="text-sm font-medium">
                Phone <span className="text-destructive">*</span>
                <input
                  required
                  type="tel"
                  maxLength={20}
                  name="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Your phone number"
                  className={inputStyle}
                />
              </label>
            </div>

            <label className="text-sm font-medium">
              Message <span className="text-destructive">*</span>
              <textarea
                required
                maxLength={1000}
                minLength={10}
                name="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={6}
                placeholder="Tell us about the design, occasion, or questions you have..."
                className="mt-2 w-full border border-input bg-background p-4 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/20"
              />
            </label>

            <Button type="submit" size="lg" className="w-full sm:w-auto">
              Send Message
            </Button>
          </form>
        )}
      </section>
    </>
  );
}
