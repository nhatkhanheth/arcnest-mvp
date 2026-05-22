import { erc20Abi, formatUnits, isAddress, type Address } from "viem";
import { getBalance, readContract } from "wagmi/actions";
import { arcNetwork, wagmiConfig } from "../lib/arc";
import { USDC_VND_RATE } from "./balanceService";

export type ArcUSDCBalance = {
  balanceUSDC: string;
  balanceVND: number;
  source: "erc20" | "native" | "empty";
};

export async function fetchArcUSDCBalance(address: string): Promise<ArcUSDCBalance> {
  if (!isAddress(address)) {
    return createBalance("0", "empty");
  }

  if (!arcNetwork.hasPaymentConfig || !arcNetwork.usdcAddress) {
    return createBalance("0", "empty");
  }

  try {
    const units = await readContract(wagmiConfig, {
      abi: erc20Abi,
      address: arcNetwork.usdcAddress,
      functionName: "balanceOf",
      args: [address as Address],
      chainId: arcNetwork.chainId
    });

    return createBalance(formatUnits(units, 6), "erc20");
  } catch {
    const nativeBalance = await getBalance(wagmiConfig, {
      address: address as Address,
      chainId: arcNetwork.chainId
    });

    return createBalance(formatUnits(nativeBalance.value, 18), "native");
  }
}

function createBalance(amountUSDC: string, source: ArcUSDCBalance["source"]): ArcUSDCBalance {
  const numeric = Number(amountUSDC);
  const safeAmount = Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
  const fixedAmount = safeAmount.toFixed(6);
  const displayAmount = fixedAmount.includes(".") ? fixedAmount.replace(/0+$/, "").replace(/\.$/, "") : fixedAmount;
  const balanceUSDC = displayAmount || "0";

  return {
    balanceUSDC,
    balanceVND: Math.round(safeAmount * USDC_VND_RATE),
    source
  };
}
