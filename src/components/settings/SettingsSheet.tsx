import {
  BellRing,
  Check,
  ChevronRight,
  Copy,
  Database,
  Eye,
  EyeOff,
  Info,
  Languages,
  Lock,
  Moon,
  ShieldCheck,
  SlidersHorizontal,
  Twitter,
  Trash2,
  Wallet,
  WalletCards
} from "lucide-react";
import { useState, type ReactNode } from "react";
import type { DisplayCurrency, LanguageCode, LocalWallet, SettingsSplitMode, ThemeMode, Wallet as WalletModel } from "../../models";
import { convertUSDCToDisplayAmount, formatUSDC, formatVND, shortAddress } from "../../lib/format";
import { useGroupStore } from "../../state/useGroupStore";
import { useSettingsStore } from "../../state/useSettingsStore";
import { Button } from "../ui/Button";
import { Select } from "../ui/Input";
import { BottomSheet } from "../ui/Modal";

type SettingsSheetProps = {
  open: boolean;
  wallet: WalletModel;
  onClose: () => void;
};

const languages: Array<{ value: LanguageCode; label: string }> = [
  { value: "en", label: "English" },
  { value: "vi", label: "Vietnamese" },
  { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" },
  { value: "zh", label: "Chinese" }
];

const currencies: DisplayCurrency[] = ["USDC", "VND", "USD", "EUR", "JPY", "CNY", "KRW"];
const themes: Array<{ value: ThemeMode; label: string }> = [
  { value: "arc-dark", label: "Arc Dark" },
  { value: "light", label: "Light" },
  { value: "system", label: "System" }
];
const splitModes: Array<{ value: SettingsSplitMode; label: string }> = [
  { value: "equal", label: "Equal" },
  { value: "fixed", label: "Fixed" },
  { value: "custom", label: "Custom" },
  { value: "treasury", label: "Treasury" }
];

export function SettingsSheet({ open, wallet, onClose }: SettingsSheetProps) {
  const settings = useSettingsStore();
  const { seedDemoData } = useGroupStore();
  const activeWallet = settings.activeWallet;
  const primaryWallet = settings.primaryWallet;
  const walletAddress = settings.showWalletAddress ? shortAddress(activeWallet.address) : "Hidden";
  const displayBalance = convertUSDCToDisplayAmount(wallet.balanceUSDC, settings.displayCurrency);
  const [devMessage, setDevMessage] = useState<string>();

  return (
    <BottomSheet open={open} title="Settings" subtitle="Preferences sync when Firebase env is configured" onClose={onClose} fullHeight>
      <div className="space-y-5">
        <SettingsSection icon={<WalletCards size={18} />} title="Wallets">
          <InfoRow label="Active wallet" value={activeWallet.label} supporting={walletAddress} mono />
          <InfoRow label="Primary wallet" value={primaryWallet.label} supporting={settings.showWalletAddress ? shortAddress(primaryWallet.address) : "Hidden"} mono />
          <InfoRow label="USDC balance" value={formatUSDC(wallet.balanceUSDC)} supporting={formatVND(wallet.balanceVND)} />
          <InfoRow label="Display balance" value={displayBalance} />
          {settings.wallets.map((item) => (
            <WalletRow
              key={item.id}
              wallet={item}
              active={item.id === activeWallet.id}
              showAddress={settings.showWalletAddress}
              onCopy={() => copyAddress(item.address)}
              onUse={() => settings.setActiveWallet(item.id)}
              onPrimary={() => settings.setPrimaryWallet(item.id)}
              onToggleStatus={() => settings.toggleWalletStatus(item.id)}
              onRemove={() => settings.removeWallet(item.id)}
              removable={settings.wallets.length > 1}
            />
          ))}
          <Button fullWidth variant="muted" icon={<Wallet size={16} />} onClick={settings.addWalletMock}>
            Add wallet mock
          </Button>
          <ActionRow label="Backup wallet" detail="Placeholder for recovery flow" />
          <ToggleRow label="Auto-lock wallet" enabled={settings.autoLockWallet} onToggle={() => settings.toggle("autoLockWallet")} />
          <ActionRow label="Change password" detail="Placeholder for local password flow" />
          <div className="surface-row rounded-[18px] p-4 text-sm text-[var(--text-secondary)]">
            Wallet controls are MVP mocks. Keep recovery details private when real wallet auth is added.
          </div>
        </SettingsSection>

        <SettingsSection icon={<Languages size={18} />} title="Preferences">
          <Select label="Language" value={settings.language} onChange={(event) => settings.setLanguage(event.target.value as LanguageCode)}>
            {languages.map((language) => (
              <option key={language.value} value={language.value}>
                {language.label}
              </option>
            ))}
          </Select>
          <Select label="Display currency" value={settings.displayCurrency} onChange={(event) => settings.setDisplayCurrency(event.target.value as DisplayCurrency)}>
            {currencies.map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </Select>
          <div className="surface-row rounded-[18px] p-4 text-sm text-[var(--text-secondary)]">
            Display conversion uses mock FX rates. Balances still calculate internally in VND and USDC.
          </div>
        </SettingsSection>

        <SettingsSection icon={<Moon size={18} />} title="Appearance">
          <div className="grid grid-cols-3 gap-2">
            {themes.map((theme) => (
              <button
                key={theme.value}
                type="button"
                className={[
                  "focus-ring min-h-[48px] rounded-2xl border px-2 text-sm font-semibold",
                  settings.theme === theme.value ? "border-[var(--arc-accent)] bg-[var(--arc-soft)]" : "border-[var(--border-soft)] bg-[var(--row-bg)]"
                ].join(" ")}
                onClick={() => settings.setTheme(theme.value)}
              >
                {theme.label}
              </button>
            ))}
          </div>
          <ToggleRow label="Sound" enabled={settings.soundEnabled} onToggle={() => settings.toggle("soundEnabled")} />
          <ToggleRow label="Reduced motion" enabled={settings.reducedMotion} onToggle={() => settings.toggle("reducedMotion")} />
        </SettingsSection>

        <SettingsSection icon={<ShieldCheck size={18} />} title="Privacy & Security">
          <ToggleRow label="Auto-lock wallet" enabled={settings.autoLockWallet} onToggle={() => settings.toggle("autoLockWallet")} />
          <ToggleRow label="Require confirmation before payment" enabled={settings.requirePaymentConfirmation} onToggle={() => settings.toggle("requirePaymentConfirmation")} />
          <ToggleRow label="Hide small balances" enabled={settings.hideSmallBalances} onToggle={() => settings.toggle("hideSmallBalances")} />
          <ToggleRow
            label="Show wallet address"
            enabled={settings.showWalletAddress}
            onToggle={() => settings.toggle("showWalletAddress")}
            icon={settings.showWalletAddress ? <Eye size={16} /> : <EyeOff size={16} />}
          />
        </SettingsSection>

        <SettingsSection icon={<SlidersHorizontal size={18} />} title="Group Defaults">
          <Select label="Default split mode" value={settings.defaultSplitMode} onChange={(event) => settings.setDefaultSplitMode(event.target.value as SettingsSplitMode)}>
            {splitModes.map((mode) => (
              <option key={mode.value} value={mode.value}>
                {mode.label}
              </option>
            ))}
          </Select>
          <Select label="Default group currency" value={settings.defaultGroupCurrency} onChange={(event) => settings.setDefaultGroupCurrency(event.target.value as "VND" | "USD")}>
            <option value="VND">VND</option>
            <option value="USD">USD</option>
          </Select>
          <ToggleRow label="Payment confirmation reminder" enabled={settings.paymentConfirmationReminder} onToggle={() => settings.toggle("paymentConfirmationReminder")} />
        </SettingsSection>

        <SettingsSection icon={<Info size={18} />} title="About ArcNest">
          <InfoRow label="App version" value="0.3.0 firebase" />
          <ActionRow label="About us" detail="Placeholder" />
          <ActionRow label="X / Twitter" detail="Placeholder" icon={<Twitter size={16} />} />
          <ActionRow label="Terms of Use" detail="Placeholder" />
          <ActionRow label="Privacy Policy" detail="Placeholder" />
          <ActionRow label="Contact / Support" detail="Placeholder" />
        </SettingsSection>

        {import.meta.env.DEV ? (
          <SettingsSection icon={<Database size={18} />} title="Developer Demo">
            <Button
              fullWidth
              variant="muted"
              icon={<Database size={16} />}
              onClick={() => {
                const result = seedDemoData();
                setDevMessage(result.ok ? "C1K Tennis demo data seeded." : result.message ?? "Could not seed demo data.");
              }}
            >
              Seed C1K demo data
            </Button>
            <div className="surface-row rounded-[18px] p-4 text-sm text-[var(--text-secondary)]">
              Seeds one group, four members, two expenses, one pending payment, one paid payment, and recent activity.
            </div>
            {devMessage ? (
              <div className="rounded-[18px] border border-[var(--arc-accent)]/40 bg-[var(--arc-soft)] p-4 text-sm text-[var(--text-secondary)]">
                {devMessage}
              </div>
            ) : null}
          </SettingsSection>
        ) : null}
      </div>
    </BottomSheet>
  );
}

function SettingsSection({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="glass-card rounded-[22px] p-4">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[var(--arc-soft)]">{icon}</span>
        <h3 className="font-display text-lg font-bold">{title}</h3>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function InfoRow({ label, value, supporting, mono }: { label: string; value: string; supporting?: string; mono?: boolean }) {
  return (
    <div className="surface-row flex min-h-[56px] items-center justify-between gap-4 rounded-[18px] px-4">
      <span className="text-sm text-[var(--text-muted)]">{label}</span>
      <span className="min-w-0 text-right">
        <span className={[mono ? "number" : "", "block truncate font-semibold"].join(" ")}>{value}</span>
        {supporting ? <span className="block text-xs text-[var(--text-muted)]">{supporting}</span> : null}
      </span>
    </div>
  );
}

function ActionRow({ label, detail, icon }: { label: string; detail: string; icon?: ReactNode }) {
  return (
    <button type="button" className="surface-row focus-ring flex min-h-[56px] w-full items-center justify-between gap-4 rounded-[18px] px-4 text-left">
      <span className="flex min-w-0 items-center gap-3">
        {icon ?? <Lock size={16} />}
        <span className="min-w-0">
          <span className="block truncate font-semibold">{label}</span>
          <span className="block truncate text-xs text-[var(--text-muted)]">{detail}</span>
        </span>
      </span>
      <ChevronRight size={17} className="shrink-0 text-[var(--text-muted)]" />
    </button>
  );
}

function WalletRow({
  wallet,
  active,
  showAddress,
  removable,
  onCopy,
  onUse,
  onPrimary,
  onToggleStatus,
  onRemove
}: {
  wallet: LocalWallet;
  active: boolean;
  showAddress: boolean;
  removable: boolean;
  onCopy: () => void;
  onUse: () => void;
  onPrimary: () => void;
  onToggleStatus: () => void;
  onRemove: () => void;
}) {
  const status = wallet.isPrimary ? "primary" : wallet.status;

  return (
    <div className={["surface-row rounded-[18px] p-4", active ? "border-[var(--arc-accent)] bg-[var(--arc-soft)]" : ""].join(" ")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">{wallet.label}</p>
          <p className="number mt-1 truncate text-xs text-[var(--text-muted)]">{showAddress ? shortAddress(wallet.address) : "Hidden"}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Tag label={wallet.type} />
            <Tag label={status} tone={wallet.status === "active" ? "success" : "muted"} />
            {active ? <Tag label="active wallet" tone="accent" /> : null}
          </div>
        </div>
        <Button aria-label={`Copy ${wallet.label}`} variant="muted" size="icon" className="h-9 w-9 rounded-[14px]" onClick={onCopy}>
          <Copy size={15} />
        </Button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button variant={active ? "secondary" : "muted"} size="sm" onClick={onUse} disabled={active || wallet.status === "disconnected"}>
          Use
        </Button>
        <Button variant={wallet.isPrimary ? "secondary" : "muted"} size="sm" onClick={onPrimary} disabled={wallet.isPrimary}>
          Primary
        </Button>
        <Button variant="muted" size="sm" onClick={onToggleStatus}>
          {wallet.status === "active" ? "Disconnect" : "Reconnect"}
        </Button>
        <Button variant="muted" size="sm" icon={<Trash2 size={14} />} onClick={onRemove} disabled={!removable}>
          Remove
        </Button>
      </div>
    </div>
  );
}

function Tag({ label, tone = "muted" }: { label: string; tone?: "success" | "accent" | "muted" }) {
  return (
    <span
      className={[
        "rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize",
        tone === "success" ? "border-[var(--success)]/40 text-[var(--success)]" : "",
        tone === "accent" ? "border-[var(--arc-accent)] text-[var(--text-primary)]" : "",
        tone === "muted" ? "border-[var(--border-soft)] text-[var(--text-muted)]" : ""
      ].join(" ")}
    >
      {label}
    </span>
  );
}

function ToggleRow({ label, enabled, onToggle, icon }: { label: string; enabled: boolean; onToggle: () => void; icon?: ReactNode }) {
  return (
    <button type="button" className="surface-row focus-ring flex min-h-[56px] w-full items-center justify-between gap-4 rounded-[18px] px-4 text-left" onClick={onToggle}>
      <span className="flex items-center gap-3 font-semibold">
        {icon ?? <BellRing size={16} />}
        {label}
      </span>
      <span className={["flex h-7 w-12 items-center rounded-full border p-1 transition", enabled ? "border-[var(--arc-accent)] bg-[var(--arc-soft)]" : "border-[var(--border-strong)]"].join(" ")}>
        <span className={["flex h-5 w-5 items-center justify-center rounded-full bg-[var(--text-primary)] text-[var(--bg-main)] transition", enabled ? "translate-x-5" : ""].join(" ")}>
          {enabled ? <Check size={12} /> : null}
        </span>
      </span>
    </button>
  );
}

function copyAddress(address: string) {
  void navigator.clipboard?.writeText(address);
}
