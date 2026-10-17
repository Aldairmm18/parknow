import { LegalDocumentView } from '@/components/LegalDocumentView';
import { PRIVACY_POLICY } from '@/constants/legal';

export default function PrivacyScreen() {
  return <LegalDocumentView document={PRIVACY_POLICY} />;
}
