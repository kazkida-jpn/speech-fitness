import { LegalDocumentPage } from '@/components/LegalPage';
import { TERMS } from '@/content/terms';

export default function TermsScreen() {
  return <LegalDocumentPage document={TERMS} />;
}
