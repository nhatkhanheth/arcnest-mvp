import { lazy, Suspense } from "react";

const DynamicEmbeddedWalletPanelImpl = lazy(() => import("./DynamicEmbeddedWalletPanelImpl"));

type DynamicEmbeddedWalletPanelProps = {
  onWalletReady?: () => void;
};

export function DynamicEmbeddedWalletPanel(props: DynamicEmbeddedWalletPanelProps) {
  return (
    <Suspense fallback={<div className="surface-row rounded-[18px] p-4 text-sm text-[var(--text-secondary)]">Loading embedded wallet...</div>}>
      <DynamicEmbeddedWalletPanelImpl {...props} />
    </Suspense>
  );
}
