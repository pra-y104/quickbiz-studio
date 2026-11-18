import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Button } from '../components/ui/button';
import { Container } from '../components/ui/container';

export function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <Container className="flex min-h-[60dvh] flex-col items-center justify-center py-20 text-center">
      <p className="text-sm font-medium tracking-[0.2em] text-ink-subtle">404</p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
        {t('notFound.title')}
      </h1>
      <p className="mt-2 max-w-sm text-sm text-ink-muted">{t('notFound.body')}</p>
      <Button asChild variant="outline" className="mt-7">
        <Link to="/">
          <ArrowLeft className="size-4" aria-hidden="true" />
          {t('notFound.cta')}
        </Link>
      </Button>
    </Container>
  );
}
