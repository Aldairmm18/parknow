import { LegalDocumentView } from '@/components/LegalDocumentView';
import { TERMS_OF_SERVICE } from '@/constants/legal';

export default function TermsScreen() {
  return <LegalDocumentView document={TERMS_OF_SERVICE} />;
}
