export type ClipboardCopyResult = {
  ok: boolean;
  message: string;
};

export async function copyToClipboard(value?: string): Promise<ClipboardCopyResult> {
  const text = value?.trim();

  if (!text) {
    return { ok: false, message: "Nothing to copy." };
  }

  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return { ok: true, message: "Copied." };
    }
  } catch {
    // Fall back to a temporary textarea below.
  }

  try {
    if (typeof document === "undefined") {
      return { ok: false, message: "Copy is not available in this browser." };
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    document.body.removeChild(textarea);

    return copied
      ? { ok: true, message: "Copied." }
      : { ok: false, message: "Copy is not available in this browser." };
  } catch {
    return { ok: false, message: "Copy is not available in this browser." };
  }
}
