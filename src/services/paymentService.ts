import type { GroupMember, Payment, PaymentRequest } from "../models";
import { collection, doc, onSnapshot, orderBy, query, setDoc } from "firebase/firestore";
import { erc20Abi, isAddress, parseUnits, type Address, type Hash } from "viem";
import { getConnection, waitForTransactionReceipt, writeContract } from "wagmi/actions";
import { arcNetwork, getArcPaymentMode, wagmiConfig, type ArcPaymentMode } from "../lib/arc";
import { USDC_VND_RATE } from "./balanceService";
import { getFirestoreOrThrow, handleFirestoreError, sortByCreatedAt, stripUndefined, type FirestoreFailureHandler } from "./firestoreHelpers";

const usdcDecimals = 6;

type PaymentValidationResult =
  | {
      valid: true;
      amountUnits: bigint;
      fromWalletAddress: Address;
      toWalletAddress: Address;
    }
  | {
      valid: false;
      message: string;
    };

export type USDCPaymentResult = {
  mode: ArcPaymentMode;
  txHash: Hash;
};

type ExecuteUSDCPaymentOptions = {
  now?: number;
  onSubmitted?: (txHash: Hash) => void | Promise<void>;
};

export function validatePaymentRequest(request: PaymentRequest): PaymentValidationResult {
  return validateUSDCTransferFields({
    amountUSDC: request.amountUSDC,
    fromWalletAddress: request.fromWalletAddress,
    toWalletAddress: request.toWalletAddress
  });
}

export function createPendingMockPayment({
  request,
  currentUserId,
  members,
  now
}: {
  request: PaymentRequest;
  currentUserId: string;
  members: GroupMember[];
  now: number;
}): Payment {
  const groupId = request.groupId ?? inferGroupId(request, members);
  const fromMemberId = request.fromMemberId ?? inferMemberIdFromWallet(request.fromWalletAddress, groupId, members);
  const toMemberId = request.toMemberId ?? inferMemberIdFromWallet(request.toWalletAddress, groupId, members);

  return {
    id: getPaymentRecordId(request.id, now),
    groupId,
    balanceId: request.balanceId ?? request.id,
    fromMemberId,
    toMemberId,
    fromWalletAddress: request.fromWalletAddress,
    toWalletAddress: request.toWalletAddress,
    amountUSDC: request.amountUSDC,
    amountVND: request.amountVND,
    chain: "arc",
    status: "unpaid",
    paymentType: request.balanceId || request.id.startsWith("balance_") ? "balance_payment" : "qr_payment",
    note: request.note,
    createdByUserId: currentUserId,
    createdAt: now,
    updatedAt: now
  };
}

function getPaymentRecordId(requestId: string, now: number) {
  if (requestId.startsWith("payment_") || requestId.startsWith("qr_payment_")) {
    return requestId;
  }

  return `payment_${now.toString(36)}`;
}

export function markPaymentPaid(payment: Payment, now: number, txHash = generateMockTxHash(payment.id, now)): Payment {
  return {
    ...payment,
    txHash,
    status: "paid",
    updatedAt: now,
    confirmedAt: now,
    failedAt: undefined
  };
}

export function markPaymentPending(payment: Payment, now: number, txHash?: Hash): Payment {
  return {
    ...payment,
    txHash: txHash ?? payment.txHash,
    status: "pending",
    updatedAt: now,
    failedAt: undefined,
    confirmedAt: undefined
  };
}

export async function executeUSDCPayment(payment: Payment, options: ExecuteUSDCPaymentOptions = {}): Promise<USDCPaymentResult> {
  const now = options.now ?? Date.now();
  const validation = validateUSDCTransferFields(payment);

  if (!validation.valid) {
    throw new Error(validation.message);
  }

  if (payment.status !== "pending" && payment.status !== "unpaid") {
    throw new Error("Only unpaid or pending payments can be confirmed.");
  }

  if (getArcPaymentMode() === "mock") {
    const mockTxHash = generateMockTxHash(payment.id, now) as Hash;
    await options.onSubmitted?.(mockTxHash);

    return {
      mode: "mock",
      txHash: mockTxHash
    };
  }

  const chainId = arcNetwork.chainId;
  const usdcAddress = arcNetwork.usdcAddress;

  if (!chainId || !usdcAddress) {
    throw new Error(`Arc testnet payment config is incomplete. Missing ${arcNetwork.missingPaymentEnvVars.join(", ")}.`);
  }

  const connection = getConnection(wagmiConfig);

  if (!connection.isConnected || !connection.address) {
    throw new Error("Connect your wallet before signing this payment.");
  }

  if (connection.address.toLowerCase() !== validation.fromWalletAddress.toLowerCase()) {
    throw new Error("Connected wallet does not match the payer wallet for this payment.");
  }

  if (connection.chainId !== chainId) {
    throw new Error("Your wallet is on the wrong network. Switch to Arc before paying.");
  }

  const txHash = await writeContract(wagmiConfig, {
    abi: erc20Abi,
    address: usdcAddress,
    functionName: "transfer",
    args: [validation.toWalletAddress, validation.amountUnits],
    chainId
  });

  await options.onSubmitted?.(txHash);

  await waitForTransactionReceipt(wagmiConfig, {
    hash: txHash,
    chainId,
    timeout: 60_000
  });

  return {
    mode: "testnet",
    txHash
  };
}

export function getPaymentErrorMessage(error: unknown) {
  const message = getErrorMessage(error);
  const normalized = message.toLowerCase();

  if (!message) {
    return "Payment could not be completed. Please try again.";
  }

  if (normalized.includes("user rejected") || normalized.includes("rejected the request") || normalized.includes("denied")) {
    return "Payment was cancelled in your wallet.";
  }

  if (normalized.includes("insufficient funds") || normalized.includes("exceeds balance")) {
    return "Your test wallet does not have enough test funds for this payment.";
  }

  if (normalized.includes("wrong network") || normalized.includes("chain")) {
    return "Switch your wallet to Arc and try the payment again.";
  }

  return message;
}

export function markPaymentFailed(payment: Payment, now: number): Payment {
  return {
    ...payment,
    status: "failed",
    updatedAt: now,
    failedAt: now
  };
}

export function retryPayment(payment: Payment, now: number): Payment {
  return {
    ...payment,
    txHash: undefined,
    status: "unpaid",
    updatedAt: now,
    failedAt: undefined,
    confirmedAt: undefined
  };
}

export function markPaymentCancelled(payment: Payment, now: number): Payment {
  return {
    ...payment,
    status: "cancelled",
    updatedAt: now,
    failedAt: undefined,
    confirmedAt: undefined
  };
}

export function subscribeGroupPayments(groupId: string, onPayments: (payments: Payment[]) => void, onError?: FirestoreFailureHandler) {
  const database = getFirestoreOrThrow();
  const paymentsQuery = query(collection(database, "groups", groupId, "payments"), orderBy("createdAt", "desc"));

  return onSnapshot(
    paymentsQuery,
    (snapshot) => {
      onPayments(sortByCreatedAt(snapshot.docs.map((paymentSnapshot) => ({ id: paymentSnapshot.id, ...paymentSnapshot.data() }) as Payment)));
    },
    handleFirestoreError(onError)
  );
}

export async function persistPayment(payment: Payment) {
  const database = getFirestoreOrThrow();

  await setDoc(doc(database, "groups", payment.groupId, "payments", payment.id), stripUndefined(payment), { merge: true });
}

export function generateMockTxHash(seed: string, now: number) {
  const source = `${seed}:${now}:${Math.round(Math.random() * USDC_VND_RATE)}`;
  let hash = "";

  for (let index = 0; index < 64; index += 1) {
    const code = source.charCodeAt(index % source.length) + index * 13;
    hash += (code % 16).toString(16);
  }

  return `0x${hash}`;
}

function inferGroupId(request: PaymentRequest, members: GroupMember[]) {
  return members.find((member) => member.walletAddress === request.toWalletAddress || member.walletAddress === request.fromWalletAddress)?.groupId ?? "group_external";
}

function inferMemberIdFromWallet(walletAddress: string, groupId: string, members: GroupMember[]) {
  const member = members.find((item) => item.groupId === groupId && item.walletAddress === walletAddress);

  if (member) {
    return member.id;
  }

  return `external_${groupId}_${walletAddress.slice(-6) || "wallet"}`;
}

function validateUSDCTransferFields({
  amountUSDC,
  fromWalletAddress,
  toWalletAddress
}: {
  amountUSDC: string;
  fromWalletAddress: string;
  toWalletAddress: string;
}): PaymentValidationResult {
  if (!isAddress(fromWalletAddress)) {
    return {
      valid: false,
      message: "Payer wallet address is invalid."
    };
  }

  if (!isAddress(toWalletAddress)) {
    return {
      valid: false,
      message: "Recipient wallet address is invalid."
    };
  }

  try {
    const amountUnits = parseUnits(amountUSDC, usdcDecimals);

    if (amountUnits <= 0n) {
      return {
        valid: false,
        message: "Payment amount must be greater than 0 USDC."
      };
    }

    return {
      valid: true,
      amountUnits,
      fromWalletAddress: fromWalletAddress as Address,
      toWalletAddress: toWalletAddress as Address
    };
  } catch {
    return {
      valid: false,
      message: "Payment amount must be a valid USDC value with up to 6 decimals."
    };
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return typeof error === "string" ? error : "";
}
