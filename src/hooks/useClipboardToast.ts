import { useCallback, useEffect, useRef, useState } from "react";
import { copyToClipboard, type ClipboardCopyResult } from "../lib/clipboard";

export function useClipboardToast() {
  const [toastMessage, setToastMessage] = useState<string>();
  const timeoutRef = useRef<number>();

  const showToast = useCallback((message: string) => {
    setToastMessage(message);

    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = window.setTimeout(() => setToastMessage(undefined), 1600);
  }, []);

  const copyWithToast = useCallback(
    async (value: string | undefined, successMessage = "Copied."): Promise<ClipboardCopyResult> => {
      const result = await copyToClipboard(value);
      showToast(result.ok ? successMessage : result.message);
      return result;
    },
    [showToast]
  );

  useEffect(
    () => () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    },
    []
  );

  return { toastMessage, copyWithToast, showToast };
}
