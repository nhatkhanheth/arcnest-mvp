export type WalletRuntime = {
  isMobile: boolean;
  isInMetaMask: boolean;
  isInRabby: boolean;
  hasInjectedWallet: boolean;
};

export function getWalletRuntime(): WalletRuntime {
  if (typeof window === "undefined") {
    return {
      isMobile: false,
      isInMetaMask: false,
      isInRabby: false,
      hasInjectedWallet: false
    };
  }

  const userAgent = window.navigator.userAgent.toLowerCase();
  const provider = (window as Window & { ethereum?: { isMetaMask?: boolean; isRabby?: boolean } }).ethereum;

  return {
    isMobile: /android|iphone|ipad|ipod|mobile/i.test(userAgent),
    isInMetaMask: Boolean(provider?.isMetaMask) || userAgent.includes("metamaskmobile"),
    isInRabby: Boolean(provider?.isRabby) || userAgent.includes("rabby"),
    hasInjectedWallet: Boolean(provider)
  };
}

export function getMetaMaskDeepLink(targetUrl = getCurrentUrl()) {
  const destination = targetUrl.replace(/^https?:\/\//i, "");
  return `https://metamask.app.link/dapp/${destination}`;
}

export function openMetaMaskDeepLink(targetUrl?: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.location.assign(getMetaMaskDeepLink(targetUrl));
}

export function getCurrentUrl() {
  if (typeof window === "undefined") {
    return "https://arcnest.vercel.app";
  }

  return window.location.href;
}

export function getWalletRuntimeLabel(runtime = getWalletRuntime()) {
  if (runtime.isInMetaMask) {
    return "MetaMask mobile";
  }

  if (runtime.isInRabby) {
    return "Rabby";
  }

  if (runtime.hasInjectedWallet) {
    return "Browser wallet";
  }

  if (runtime.isMobile) {
    return "Mobile browser";
  }

  return "Desktop browser";
}
