import { Sparkles, Wand2 } from 'lucide-react';
import { HOMEPAGE } from '../../content/homepage';
import { cn } from '../../lib/cn';

/**
 * Illustrative example of the planned AI Writer screen.
 *
 * This is static markup, not a working AI call. It is captioned as an example so it
 * cannot be mistaken for a live generation.
 */
export function HeroPreview({ className }: { className?: string }) {
  return (
    <figure className={cn('w-full', className)}>
      <div className="relative">
        <div
          className="pointer-events-none absolute -inset-6 -z-10 rounded-[2rem] bg-brand-500/20 blur-2xl"
          aria-hidden="true"
        />

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.045] shadow-[0_40px_80px_-40px_rgba(0,0,0,0.9)] backdrop-blur-xl">
          {/* Window bar */}
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex size-6 items-center justify-center rounded-md bg-gradient-to-br from-brand-400 to-electric-500 text-white">
                <Wand2 className="size-3.5" aria-hidden="true" />
              </span>
              <span className="text-[13px] font-medium text-white/90">AI Writer</span>
            </div>
          </div>

          <div className="space-y-4 p-4 sm:p-5">
            <div className="space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-wider text-white/40">
                Brief
              </p>
              <div className="rounded-lg border border-white/10 bg-navy-950/60 p-3 text-[12.5px] leading-relaxed text-white/70">
                A polite follow-up email to a client whose invoice is eight days overdue. Warm, not
                pushy. Include a payment link placeholder.
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-wider text-white/40">
                Draft
              </p>
              <div className="space-y-2.5 rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <p className="text-[12.5px] font-medium text-white/85">
                  Subject: Quick nudge on invoice 1042
                </p>
                <p className="text-[12.5px] leading-relaxed text-white/60">
                  Hello Adaeze, I hope the week is treating you well. This is a gentle reminder that
                  invoice 1042 (₦48,500) was due on the 9th.
                </p>
                <p className="text-[12.5px] leading-relaxed text-white/60">
                  If it has already gone out, please ignore this note — and thank you. Otherwise you
                  can settle it here: [payment link].
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <span className="text-[11px] text-white/40">Sample output</span>
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-[12px] font-medium text-white/70">
                <Sparkles className="size-3.5" aria-hidden="true" />
                Example only
              </span>
            </div>
          </div>
        </div>
      </div>

      <figcaption className="mt-3 text-center text-[11px] text-white/35 sm:text-left">
        {HOMEPAGE.hero.previewCaption}
      </figcaption>
    </figure>
  );
}
