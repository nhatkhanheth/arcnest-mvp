export type ThemeMode = "arc-dark" | "light" | "system";

export type LanguageCode = "en" | "vi" | "ja" | "ko" | "zh";

export type DisplayCurrency = "USDC" | "VND" | "USD" | "EUR" | "JPY" | "CNY" | "KRW";

export type SettingsSplitMode = "equal" | "fixed" | "custom" | "treasury";

export type UserSettings = {
  theme: ThemeMode;
  soundEnabled: boolean;
  language?: LanguageCode;
  displayCurrency?: DisplayCurrency;
  defaultCurrency: "VND" | "USD";
  hideSmallBalances?: boolean;
  reducedMotion?: boolean;
  autoLockWallet?: boolean;
  requirePaymentConfirmation?: boolean;
  showWalletAddress?: boolean;
  defaultSplitMode?: SettingsSplitMode;
  paymentConfirmationReminder?: boolean;
};

export type User = {
  id: string;
  displayName: string;
  email?: string;
  primaryWalletAddress?: string;
  avatarUrl?: string;
  createdAt: number;
  updatedAt: number;
  lastSeenAt?: number;
  settings: UserSettings;
};
