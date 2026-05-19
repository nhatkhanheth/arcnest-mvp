export type NavTab = "home" | "groups" | "split" | "activity" | "wallet";

export const navTabs: Array<{ id: NavTab; label: string }> = [
  { id: "home", label: "Home" },
  { id: "groups", label: "Groups" },
  { id: "split", label: "Split" },
  { id: "activity", label: "Activity" },
  { id: "wallet", label: "Wallet" }
];
