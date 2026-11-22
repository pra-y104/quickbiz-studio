import { useParams } from 'react-router';
import { LEGAL_DOCUMENTS } from '../../content/legal';
import { LegalPage } from '../../components/creative/legal-page';
import { NotFoundPage } from '../not-found';

/**
 * Renders one document by slug.
 *
 * The route table only registers the four known documents, but the parameter is
 * still validated here so a typo cannot render an empty page.
 */
export function LegalDocumentPage() {
  const { document: slug } = useParams<{ document: string }>();
  const doc = slug ? LEGAL_DOCUMENTS[slug] : undefined;

  if (!doc) return <NotFoundPage />;
  return <LegalPage document={doc} />;
}
