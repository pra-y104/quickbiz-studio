import { HOMEPAGE } from '../../../content/homepage';
import { Container } from '../../ui/container';
import { Disclosure } from '../../ui/disclosure';
import { SectionHeading } from '../section-heading';

export function FaqSection() {
  const content = HOMEPAGE.faq;

  return (
    <section
      id="questions"
      aria-labelledby="questions-title"
      className="scroll-mt-24 border-b border-border bg-canvas py-16 sm:py-20"
    >
      <Container className="max-w-3xl">
        <SectionHeading
          eyebrow={content.eyebrow}
          title={content.title}
          description={content.description}
          titleId="questions-title"
        />

        <div className="mt-8 space-y-3">
          {content.items.map((item) => (
            <Disclosure key={item.question} question={item.question} answer={item.answer} />
          ))}
        </div>
      </Container>
    </section>
  );
}
