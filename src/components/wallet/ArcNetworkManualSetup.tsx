import { Copy, ExternalLink } from "lucide-react";
import { arcNetwork } from "../../lib/arc";
import { getWalletRuntime, openMetaMaskDeepLink } from "../../lib/mobileWallet";
import { useClipboardToast } from "../../hooks/useClipboardToast";
import { Button } from "../ui/Button";
import { CopyToast } from "../ui/CopyToast";

export function ArcNetworkManualSetup() {
  const { toastMessage, copyWithToast } = useClipboardToast();
  const walletRuntime = getWalletRuntime();
  const fields = [
    ["Network", arcNetwork.name],
    ["Chain ID", String(arcNetwork.chainId)],
    ["RPC URL", arcNetwork.rpcUrl || "Not configured"],
    ["Explorer", arcNetwork.explorerUrl || "Not configured"],
    ["USDC", arcNetwork.usdcAddress || "Not configured"]
  ];

  return (
    <div className="surface-row space-y-3 rounded-[18px] p-3 text-left">
      <CopyToast message={toastMessage} />
      <div>
        <p className="text-sm font-semibold text-[var(--text-primary)]">Manual setup required</p>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Your wallet did not switch automatically. Add Arc Testnet manually using the details below.
        </p>
      </div>

      <div className="space-y-2">
        {fields.map(([label, value]) => (
          <div key={label} className="flex min-h-11 items-center justify-between gap-3 rounded-2xl border border-[var(--border-soft)] px-3 py-2">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[var(--text-muted)]">{label}</p>
              <p className="number truncate text-sm font-semibold text-[var(--text-primary)]">{value}</p>
            </div>
            <button
              type="button"
              aria-label={`Copy ${label}`}
              className="focus-ring inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--border-soft)] text-[var(--text-muted)]"
              onClick={() => void copyWithToast(value, `${label} copied`)}
            >
              <Copy size={15} />
            </button>
          </div>
        ))}
      </div>

      {walletRuntime.isMobile && !walletRuntime.isInMetaMask ? (
        <Button fullWidth variant="secondary" icon={<ExternalLink size={16} />} onClick={() => openMetaMaskDeepLink()}>
          Open wallet app
        </Button>
      ) : null}
    </div>
  );
}
