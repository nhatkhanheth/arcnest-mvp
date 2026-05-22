import type { ReactNode } from "react";
import { EthereumWalletConnectors } from "@dynamic-labs/ethereum";
import { DynamicContextProvider } from "@dynamic-labs/sdk-react-core";
import { arcNetwork } from "./arc";
import { dynamicEnvironmentId } from "./dynamic";

export default function DynamicProviderImpl({ children }: { children: ReactNode }) {
  return (
    <DynamicContextProvider
      settings={{
        appName: "ArcNest",
        environmentId: dynamicEnvironmentId,
        mobileExperience: "redirect",
        networkValidationMode: "never",
        useMetamaskSdk: false,
        walletConnectors: [EthereumWalletConnectors],
        walletConnectPreferredChains: [`eip155:${arcNetwork.chainId}`]
      }}
    >
      {children}
    </DynamicContextProvider>
  );
}
