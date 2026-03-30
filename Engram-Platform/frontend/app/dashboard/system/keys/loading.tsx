import { LoadingState } from '@/src/design-system/components/LoadingState';

export default function ApiKeysLoading() {
  return <LoadingState variant="spinner" label="Loading API keys..." />;
}
