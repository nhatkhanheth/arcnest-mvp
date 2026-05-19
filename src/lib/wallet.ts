import { shortAddress } from "./format";

export function getWalletLabel(address?: string) {
  return shortAddress(address);
}
