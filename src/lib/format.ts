import type { DisplayCurrency } from "../models";

const mockFxFromVND: Record<DisplayCurrency, number> = {
  USDC: 1 / 25000,
  VND: 1,
  USD: 1 / 25000,
  EUR: 1 / 27000,
  JPY: 0.0061,
  CNY: 0.00029,
  KRW: 0.055
};

export function formatUSDC(value: string | number, options?: { signed?: boolean }) {
  const numeric = typeof value === "string" ? Number(value) : value;
  const sign = options?.signed && numeric > 0 ? "+" : "";
  return `${sign}${numeric.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })} USDC`;
}

export function formatVND(value: number, options?: { signed?: boolean }) {
  const sign = options?.signed && value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString("vi-VN")} VND`;
}

export function formatDisplayAmount(amountVND: number, currency: DisplayCurrency, options?: { signed?: boolean }) {
  if (currency === "VND") {
    return formatVND(amountVND, options);
  }

  const value = amountVND * mockFxFromVND[currency];
  const sign = options?.signed && value > 0 ? "+" : "";
  const fractionDigits = currency === "JPY" || currency === "KRW" ? 0 : 2;

  return `${sign}${value.toLocaleString("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  })} ${currency}`;
}

export function convertUSDCToDisplayAmount(amountUSDC: string | number, currency: DisplayCurrency, options?: { signed?: boolean }) {
  return formatDisplayAmount(Number(amountUSDC) * 25000, currency, options);
}

export function shortAddress(address?: string) {
  if (!address) {
    return "No wallet";
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(timestamp);
}
