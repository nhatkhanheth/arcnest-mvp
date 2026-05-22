import { createConfig, http, injected } from "wagmi";
import { walletConnect } from "wagmi/connectors";
import { defineChain, isAddress, type Address } from "viem";

export const ARC_TESTNET_CHAIN_ID = 5042002;

const fallbackLocalRpcUrl = "http://127.0.0.1:8545";
const defaultArcExplorerUrl = "https://testnet.arcscan.app";

const arcRpcUrl = readEnv("VITE_ARC_RPC_URL");
const arcChainId = parseChainId(readEnv("VITE_ARC_CHAIN_ID")) ?? ARC_TESTNET_CHAIN_ID;
const arcExplorerUrl = stripTrailingSlash(readEnv("VITE_ARC_EXPLORER_URL") || defaultArcExplorerUrl);
const rawUsdcAddress = readEnv("VITE_ARC_USDC_ADDRESS");
const arcUsdcAddress = rawUsdcAddress && isAddress(rawUsdcAddress) ? (rawUsdcAddress as Address) : undefined;
const walletConnectProjectId = readEnv("VITE_WALLETCONNECT_PROJECT_ID");

const missingPaymentEnvVars = [
  arcRpcUrl ? undefined : "VITE_ARC_RPC_URL",
  arcUsdcAddress ? undefined : "VITE_ARC_USDC_ADDRESS"
].filter(Boolean) as string[];

export const arcNetwork = {
  chain: "arc" as const,
  name: "Arc Testnet",
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
  id: arcNetwork.chainId,
  name: "Arc Testnet",
  nativeCurrency: {
    decimals: 6,
    name: "USDC",
    symbol: "USDC"
  },
  rpcUrls: {
    default: {
      http: [arcNetwork.rpcUrl || fallbackLocalRpcUrl]
    }
  },
  blockExplorers: arcNetwork.explorerUrl
    ? {
        default: {
          name: "Arcscan",
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
  return `Arc Testnet (${arcNetwork.chainId})`;
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
    { key: "VITE_ARC_CHAIN_ID", present: true, optional: true },
    { key: "VITE_ARC_EXPLORER_URL", present: Boolean(arcExplorerUrl) },
    { key: "VITE_ARC_USDC_ADDRESS", present: Boolean(arcUsdcAddress) },
    { key: "VITE_WALLETCONNECT_PROJECT_ID", present: Boolean(walletConnectProjectId), optional: true }
  ];
}

export function getArcAddEthereumChainParams() {
  return {
    chainId: toHexChainId(arcNetwork.chainId),
    chainName: "Arc Testnet",
    nativeCurrency: {
      name: "USDC",
      symbol: "USDC",
      decimals: 6
    },
    rpcUrls: arcNetwork.rpcUrl ? [arcNetwork.rpcUrl] : [],
    blockExplorerUrls: arcNetwork.explorerUrl ? [arcNetwork.explorerUrl] : []
  };
}

export async function requestAddArcTestnet() {
  const provider = getInjectedProvider();

  if (!provider) {
    throw new Error("No browser wallet was found. Open ArcNest in MetaMask, Rabby, or another EVM wallet.");
  }

  if (!arcNetwork.rpcUrl) {
    throw new Error("Arc RPC URL is missing. Configure VITE_ARC_RPC_URL before adding Arc Testnet.");
  }

  await provider.request({
    method: "wallet_addEthereumChain",
    params: [getArcAddEthereumChainParams()]
  });
}

export async function requestSwitchArcTestnet() {
  const provider = getInjectedProvider();

  if (!provider) {
    throw new Error("No browser wallet was found. Open ArcNest in MetaMask, Rabby, or another EVM wallet.");
  }

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: toHexChainId(arcNetwork.chainId) }]
    });
  } catch (error) {
    if (isUnknownChainError(error)) {
      await requestAddArcTestnet();
      return;
    }

    throw error;
  }
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

function toHexChainId(chainId: number) {
  return `0x${chainId.toString(16)}`;
}

function getInjectedProvider(): Eip1193Provider | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  return (window as Window & { ethereum?: Eip1193Provider }).ethereum;
}

function isUnknownChainError(error: unknown) {
  if (!isRecord(error)) {
    return false;
  }

  return error.code === 4902 || error.code === -32603 || String(error.message ?? "").toLowerCase().includes("unrecognized chain");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return typeof error === "string" ? error : "";
}

type Eip1193Provider = {
  isMetaMask?: boolean;
  isRabby?: boolean;
  request: (request: { method: string; params?: unknown[] | Record<string, unknown> }) => Promise<unknown>;
};
