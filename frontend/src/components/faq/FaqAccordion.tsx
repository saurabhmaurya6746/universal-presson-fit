import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/Accordion";
import type { FaqItem } from "@/types";

export interface FaqAccordionProps {
  items: FaqItem[];
  className?: string;
}

export function FaqAccordion({ items, className }: FaqAccordionProps) {
  return (
    <Accordion type="single" collapsible className={`mx-auto max-w-3xl ${className ?? ""}`}>
      {items.map((faq, i) => (
        <AccordionItem value={`faq-${i}`} key={faq.question}>
          <AccordionTrigger className="py-6 text-left text-base no-underline hover:no-underline sm:text-lg">
            {faq.question}
          </AccordionTrigger>
          <AccordionContent className="max-w-2xl pb-6 leading-7 text-muted-foreground">
            {faq.answer}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
