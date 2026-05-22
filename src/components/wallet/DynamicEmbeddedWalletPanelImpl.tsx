import { useEffect } from "react";
import { DynamicWidget, useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { WalletCards } from "lucide-react";
import { arcNetwork } from "../../lib/arc";
import { shortAddress } from "../../lib/format";
import { useSettingsStore } from "../../state/useSettingsStore";

type DynamicEmbeddedWalletPanelImplProps = {
  onWalletReady?: () => void;
};

export default function DynamicEmbeddedWalletPanelImpl({ onWalletReady }: DynamicEmbeddedWalletPanelImplProps) {
  const { primaryWallet, user } = useDynamicContext();
  const { upsertConnectedWallet } = useSettingsStore();
  const address = primaryWallet?.address;

  useEffect(() => {
    if (!address) {
      return;
    }

    upsertConnectedWallet({
      address,
      chainId: arcNetwork.chainId,
      connectorId: "dynamic",
      connectorName: "Dynamic"
    });
    onWalletReady?.();
  }, [address, onWalletReady, upsertConnectedWallet]);

  return (
    <div className="surface-row rounded-[18px] p-4">
      <div className="mb-3 flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[var(--arc-soft)]">
          <WalletCards size={18} />
        </span>
        <span className="min-w-0">
          <span className="block font-semibold">Embedded wallet</span>
          <span className="block text-sm text-[var(--text-muted)]">
            {address ? `Connected ${shortAddress(address)}` : user ? "Finish wallet setup in Dynamic." : "Email/social login opens through Dynamic."}
          </span>
        </span>
      </div>
      <DynamicWidget />
    </div>
  );
}
