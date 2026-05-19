import { fxRate } from "../data/mockData";

export function vndToUSDC(amountVND: number) {
  return (amountVND / fxRate.usdcToVnd).toFixed(2);
}

export function usdcToVND(amountUSDC: string) {
  return Math.round(Number(amountUSDC) * fxRate.usdcToVnd);
}
