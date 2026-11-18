import { ArrowRight, Sparkles } from 'lucide-react';
import { Link } from 'react-router';
import { HOMEPAGE } from '../../content/homepage';
import { cn } from '../../lib/cn';
import { Button } from '../ui/button';
import { Container } from '../ui/container';
import { HeroPreview } from './hero-preview';

/**
 * Signature hero band. It intentionally keeps a deep navy surface in both
 * themes so the product shot stays the focal point; the rest of the page follows
 * the active light/dark theme.
 */
export function Hero() {
  const { hero } = HOMEPAGE;

  return (
    <section className="relative isolate overflow-hidden bg-navy-950">
      <div className="qb-aura absolute inset-0 -z-10" aria-hidden="true" />
      <div className="qb-grid absolute inset-0 -z-10" aria-hidden="true" />

      <Container className="relative py-14 sm:py-20 lg:py-24">
        <div className="grid items-center gap-10 lg:grid-cols-[1.02fr_0.98fr] lg:gap-14">
          <div>
            <p className="inline-flex items-center gap-2 rounded-pill border border-white/12 bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-white/70">
              <Sparkles className="size-3.5 text-brand-300" aria-hidden="true" />
              {hero.eyebrow}
            </p>

            <h1 className="mt-5 text-[2.1rem] font-semibold leading-[1.06] tracking-tight text-white sm:text-5xl lg:text-[3.4rem]">
              {hero.titleLead}{' '}
              <span className="bg-gradient-to-r from-brand-300 via-brand-200 to-electric-300 bg-clip-text text-transparent">
                {hero.titleAccent}
              </span>
            </h1>

            <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-white/65 sm:text-base">
              {hero.subtitle}
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button asChild size="lg">
                <Link to="/tools">
                  {hero.primaryCta}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white/20 bg-white/[0.04] text-white hover:bg-white/10 hover:text-white"
              >
                <a href="#pricing">{hero.secondaryCta}</a>
              </Button>
            </div>

            <p className="mt-5 text-xs text-white/40">{hero.reassurance}</p>

            <div className="mt-9 border-t border-white/10 pt-6">
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/35">
                {hero.audienceLabel}
              </p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {hero.audiences.map((audience) => (
                  <li
                    key={audience}
                    className="rounded-pill border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/60"
                  >
                    {audience}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <HeroPreview className={cn('lg:pl-2')} />
        </div>
      </Container>
    </section>
  );
}
