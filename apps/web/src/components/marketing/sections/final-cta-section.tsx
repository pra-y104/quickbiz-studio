import { ArrowRight } from 'lucide-react';
import { HOMEPAGE } from '../../../content/homepage';
import { Button } from '../../ui/button';
import { Container } from '../../ui/container';

export function FinalCtaSection() {
  const content = HOMEPAGE.finalCta;

  return (
    <section className="relative isolate overflow-hidden bg-navy-950 py-16 sm:py-20">
      <div className="qb-aura absolute inset-0 -z-10" aria-hidden="true" />
      <div className="qb-grid absolute inset-0 -z-10" aria-hidden="true" />

      <Container className="max-w-2xl text-center">
        <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          {content.title}
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-white/60 sm:text-base">
          {content.body}
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild size="lg">
            <a href="#free-tools">
              {content.cta}
              <ArrowRight className="size-4" aria-hidden="true" />
            </a>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="border-white/20 bg-white/[0.04] text-white hover:bg-white/10 hover:text-white"
          >
            <a href="#pricing">See credit pricing</a>
          </Button>
        </div>
        <p className="mt-6 text-xs text-white/35">{content.note}</p>
      </Container>
    </section>
  );
}
