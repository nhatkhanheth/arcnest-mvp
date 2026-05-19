import { createConfig, http, injected } from "wagmi";
import { walletConnect } from "wagmi/connectors";
import { defineChain, isAddress, type Address } from "viem";

const fallbackLocalChainId = 31337;
const fallbackLocalRpcUrl = "http://127.0.0.1:8545";

const arcRpcUrl = readEnv("VITE_ARC_RPC_URL");
const arcChainId = parseChainId(readEnv("VITE_ARC_CHAIN_ID"));
const arcExplorerUrl = stripTrailingSlash(readEnv("VITE_ARC_EXPLORER_URL"));
const rawUsdcAddress = readEnv("VITE_ARC_USDC_ADDRESS");
const arcUsdcAddress = rawUsdcAddress && isAddress(rawUsdcAddress) ? (rawUsdcAddress as Address) : undefined;
const walletConnectProjectId = readEnv("VITE_WALLETCONNECT_PROJECT_ID");

const missingPaymentEnvVars = [
  arcRpcUrl ? undefined : "VITE_ARC_RPC_URL",
  arcChainId ? undefined : "VITE_ARC_CHAIN_ID",
  arcExplorerUrl ? undefined : "VITE_ARC_EXPLORER_URL",
  arcUsdcAddress ? undefined : "VITE_ARC_USDC_ADDRESS"
].filter(Boolean) as string[];

export const arcNetwork = {
  chain: "arc" as const,
  name: "Arc",
  chainId: arcChainId,
  rpcUrl: arcRpcUrl,
  explorerUrl: arcExplorerUrl,
  usdcAddress: arcUsdcAddress,
  walletConnectProjectId,
  walletConnectEnabled: Boolean(walletConnectProjectId),
  hasPaymentConfig: missingPaymentEnvVars.length === 0,
  missingPaymentEnvVars
};

export const arcChain = defineChain({
  id: arcNetwork.chainId ?? fallbackLocalChainId,
  name: "Arc",
  nativeCurrency: {
    decimals: 18,
    name: "Arc ETH",
    symbol: "ETH"
  },
  rpcUrls: {
    default: {
      http: [arcNetwork.rpcUrl || fallbackLocalRpcUrl]
    }
  },
  blockExplorers: arcNetwork.explorerUrl
    ? {
        default: {
          name: "Arc Explorer",
          url: arcNetwork.explorerUrl
        }
      }
    : undefined,
  testnet: true
});

export const wagmiConfig = createConfig({
  chains: [arcChain],
  connectors: [
    injected({ shimDisconnect: true }),
    ...(walletConnectProjectId
      ? [
          walletConnect({
            projectId: walletConnectProjectId,
            showQrModal: true,
            metadata: {
              name: "ArcNest",
              description: "Shared payments on Arc testnet",
              url: typeof window === "undefined" ? "https://arcnest.vercel.app" : window.location.origin,
              icons: [typeof window === "undefined" ? "https://arcnest.vercel.app/icon.svg" : `${window.location.origin}/icon.svg`]
            }
          })
        ]
      : [])
  ],
  transports: {
    [arcChain.id]: http(arcNetwork.rpcUrl || fallbackLocalRpcUrl)
  }
});

export type ArcPaymentMode = "testnet" | "mock";

export function getArcPaymentMode(): ArcPaymentMode {
  return arcNetwork.hasPaymentConfig ? "testnet" : "mock";
}

export function isWrongArcNetwork(chainId?: number) {
  return Boolean(arcNetwork.chainId && chainId && chainId !== arcNetwork.chainId);
}

export function formatArcChain() {
  return arcNetwork.chainId ? `Arc testnet (${arcNetwork.chainId})` : "Arc config missing";
}

export function getArcExplorerTxUrl(txHash: string) {
  if (!arcNetwork.explorerUrl) {
    return undefined;
  }

  return `${arcNetwork.explorerUrl}/tx/${txHash}`;
}

export function getFriendlyWalletError(error: unknown) {
  const message = getErrorMessage(error);
  const normalized = message.toLowerCase();

  if (!message) {
    return "Wallet action could not be completed. Please try again.";
  }

  if (normalized.includes("user rejected") || normalized.includes("rejected the request") || normalized.includes("denied")) {
    return "Wallet request was cancelled.";
  }

  if (normalized.includes("provider") || normalized.includes("connector not found")) {
    return "No browser wallet was found. Install or unlock MetaMask, Rabby, or another injected wallet.";
  }

  if (normalized.includes("chain") || normalized.includes("network")) {
    return "Your wallet is on the wrong network. Switch to Arc and try again.";
  }

  return message;
}

export function getArcEnvReport() {
  return [
    { key: "VITE_ARC_RPC_URL", present: Boolean(arcRpcUrl) },
    { key: "VITE_ARC_CHAIN_ID", present: Boolean(arcChainId) },
    { key: "VITE_ARC_EXPLORER_URL", present: Boolean(arcExplorerUrl) },
    { key: "VITE_ARC_USDC_ADDRESS", present: Boolean(arcUsdcAddress) },
    { key: "VITE_WALLETCONNECT_PROJECT_ID", present: Boolean(walletConnectProjectId), optional: true }
  ];
}

function readEnv(key: string) {
  const value = import.meta.env[key];
  return typeof value === "string" ? value.trim() : "";
}

function parseChainId(value: string) {
  if (!value) {
    return undefined;
  }

  const parsed = value.toLowerCase().startsWith("0x") ? Number.parseInt(value, 16) : Number.parseInt(value, 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function stripTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return typeof error === "string" ? error : "";
}
