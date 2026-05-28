export type ArcNestPaymentQRPayload = {
  type: "arcnest_payment";
  version: 1;
  network: "arc";
  receiverAddress: string;
  amountUSDC?: string;
  groupId: string;
  paymentId: string;
  note?: string;
};

export type ArcNestInviteQRPayload = {
  type: "arcnest_invite";
  version: 1;
  network: "arc";
  groupId?: string;
  inviteCode: string;
};

export type ArcNestQRPayload = ArcNestPaymentQRPayload | ArcNestInviteQRPayload;

export type QRPayloadResult =
  | {
      ok: true;
      payload: ArcNestQRPayload;
    }
  | {
      ok: false;
      message: "Invalid QR" | "Wrong network" | "Missing payment info";
    };

export type CreatePaymentQRPayloadInput = {
  id?: string;
  paymentId?: string;
  receiverAddress?: string;
  toWalletAddress?: string;
  amountUSDC?: string;
  groupId: string;
  note?: string;
};

export type CreateInviteQRPayloadInput = {
  groupId?: string;
  inviteCode: string;
};

export function createPaymentQRPayload(input: CreatePaymentQRPayloadInput): ArcNestPaymentQRPayload {
  const amountUSDC = getOptionalPositiveAmount(input.amountUSDC);

  return stripUndefined({
    type: "arcnest_payment",
    version: 1,
    network: "arc",
    receiverAddress: input.receiverAddress ?? input.toWalletAddress ?? "",
    amountUSDC,
    groupId: input.groupId,
    paymentId: input.paymentId ?? input.id ?? `qr_${input.groupId}`,
    note: input.note
  });
}

export function createInviteQRPayload(input: CreateInviteQRPayloadInput): ArcNestInviteQRPayload {
  return stripUndefined({
    type: "arcnest_invite",
    version: 1,
    network: "arc",
    groupId: input.groupId,
    inviteCode: input.inviteCode.trim().toUpperCase()
  });
}

export function stringifyQRPayload(payload: ArcNestQRPayload) {
  return JSON.stringify(payload);
}

export function createQRPayloadUri(payload: ArcNestQRPayload) {
  return `arcnest://payload?payload=${encodeURIComponent(stringifyQRPayload(payload))}`;
}

export function parseQRPayload(rawPayload: string): QRPayloadResult {
  const raw = rawPayload.trim();

  if (!raw) {
    return { ok: false, message: "Invalid QR" };
  }

  const source = extractPayloadSource(raw);

  if (source?.startsWith("invite:")) {
    return {
      ok: true,
      payload: createInviteQRPayload({
        inviteCode: source.replace(/^invite:/, "")
      })
    };
  }

  if (!source) {
    return { ok: false, message: "Invalid QR" };
  }

  try {
    return validateQRPayload(JSON.parse(source));
  } catch {
    return { ok: false, message: "Invalid QR" };
  }
}

export function validateQRPayload(value: unknown): QRPayloadResult {
  if (!isRecord(value) || value.version !== 1 || typeof value.type !== "string") {
    return { ok: false, message: "Invalid QR" };
  }

  if (value.network !== "arc") {
    return { ok: false, message: "Wrong network" };
  }

  if (value.type === "arcnest_payment") {
    const receiverAddress = getString(value.receiverAddress);
    const amountUSDC = getString(value.amountUSDC);
    const groupId = getString(value.groupId);
    const paymentId = getString(value.paymentId);
    const note = getOptionalString(value.note);

    if (!receiverAddress || !groupId || !paymentId) {
      return { ok: false, message: "Missing payment info" };
    }

    if (amountUSDC && !hasPositiveAmount(amountUSDC)) {
      return { ok: false, message: "Missing payment info" };
    }

    return {
      ok: true,
      payload: stripUndefined({
        type: "arcnest_payment",
        version: 1,
        network: "arc",
        receiverAddress,
        amountUSDC,
        groupId,
        paymentId,
        note
      })
    };
  }

  if (value.type === "arcnest_invite") {
    const groupId = getString(value.groupId);
    const inviteCode = getString(value.inviteCode);

    if (!inviteCode) {
      return { ok: false, message: "Invalid QR" };
    }

    return {
      ok: true,
      payload: createInviteQRPayload({
        groupId,
        inviteCode
      })
    };
  }

  return { ok: false, message: "Invalid QR" };
}

function extractPayloadSource(raw: string) {
  const inviteCode = extractInviteCodeFromUrl(raw);

  if (inviteCode) {
    return `invite:${inviteCode}`;
  }

  if (!raw.startsWith("arcnest://")) {
    return raw;
  }

  try {
    const url = new URL(raw);
    return url.searchParams.get("payload") ?? "";
  } catch {
    return "";
  }
}

function extractInviteCodeFromUrl(raw: string) {
  try {
    const url = new URL(raw, "https://arcnest.vercel.app");
    const match = url.pathname.match(/^\/invite\/([^/?#]+)/i);

    return match?.[1] ? decodeURIComponent(match[1]).trim().toUpperCase() : "";
  } catch {
    return "";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getOptionalString(value: unknown) {
  const text = getString(value);
  return text || undefined;
}

function hasPositiveAmount(amountUSDC: string) {
  const numeric = Number(amountUSDC);
  return Number.isFinite(numeric) && numeric > 0;
}

function getOptionalPositiveAmount(amountUSDC: string | undefined) {
  const amount = amountUSDC?.trim();

  return amount && hasPositiveAmount(amount) ? amount : undefined;
}

function stripUndefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}
