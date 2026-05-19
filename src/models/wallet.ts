export type Wallet = {
  id: string;
  userId: string;
  address: string;
  type: "embedded" | "external" | "readonly";
  provider?: "privy" | "dynamic" | "metamask" | "rabby" | "walletconnect" | "manual";
  chain: "arc";
  isPrimary: boolean;
  balanceUSDC: string;
  balanceVND: number;
  createdAt: number;
  updatedAt: number;
};

export type LocalWallet = {
  id: string;
  label: string;
  address: string;
  type: "embedded" | "external" | "readonly" | "manual";
  provider?: Wallet["provider"];
  connectorId?: string;
  connectorName?: string;
  chainId?: number;
  isPrimary: boolean;
  status: "active" | "disconnected";
  createdAt: number;
  lastConnectedAt?: number;
};
