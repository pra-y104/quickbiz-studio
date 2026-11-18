import { HOMEPAGE } from '../../../content/homepage';
import { Container } from '../../ui/container';
import { SectionHeading } from '../section-heading';

export function PromiseSection() {
  const content = HOMEPAGE.promise;

  return (
    <section
      id="promise"
      aria-labelledby="promise-title"
      className="scroll-mt-24 border-b border-border bg-canvas py-16 sm:py-20"
    >
      <Container>
        <SectionHeading
          eyebrow={content.eyebrow}
          title={content.title}
          description={content.description}
          titleId="promise-title"
        />

        <ol className="mt-10 grid gap-x-10 gap-y-7 sm:grid-cols-2">
          {content.items.map((item, index) => (
            <li key={item.title} className="flex gap-4 border-t border-border pt-5">
              <span className="mt-0.5 text-sm font-semibold tabular-nums text-primary">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div>
                <h3 className="text-[15px] font-semibold text-ink">{item.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-ink-muted">{item.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <p className="mt-9 max-w-3xl text-xs leading-relaxed text-ink-subtle">{content.footnote}</p>
      </Container>
    </section>
  );
}
