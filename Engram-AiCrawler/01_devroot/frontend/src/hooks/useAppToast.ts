import { useToast } from '../components/Toast';

export function useAppToast() {
  const toast = useToast();

  return {
    success(message: string, action?: { label: string; onClick: () => void }) {
      return toast.success(message, { action });
    },

    error(message: string, detail?: string) {
      return toast.error(message, { detail });
    },

    info(message: string, action?: { label: string; onClick: () => void }) {
      return toast.info(message, { action });
    },

    warning(message: string) {
      return toast.warning(message);
    },

    async promise<T>(
      work: Promise<T>,
      messages: { loading: string; success: string; error: string }
    ): Promise<T> {
      const id = toast.info(messages.loading);
      try {
        const result = await work;
        toast.dismiss(id);
        toast.success(messages.success);
        return result;
      } catch (err) {
        toast.dismiss(id);
        toast.error(messages.error);
        throw err;
      }
    },
  };
}
