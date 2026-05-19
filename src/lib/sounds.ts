export type SoundEvent = "payment_success" | "save_success" | "send_success" | "qr_scan" | "warning";

export function playSoundPreview(_event: SoundEvent, enabled: boolean) {
  return enabled;
}
