type PrivatePinRecord = {
  digits: 4 | 6;
  salt: string;
  hash: string;
};

export type PrivateChatEntry = {
  id: string;
  title: string;
  locked: boolean;
  updatedAt: number;
};

export function privateChatTitleForDisplay(title: string) {
  const displayTitle = title.replace(/^ksemo-ephemeral::/, "").trim();
  if (!displayTitle || /^(ephemeral|temporary)( chat| conversation)?$/i.test(displayTitle)) {
    return "Private conversation";
  }
  return displayTitle;
}

function pinKey(userId: string | number) {
  return `ksemo-private-chat-pin:${String(userId)}`;
}

function chatsKey(userId: string | number) {
  return `ksemo-private-chat-index:${String(userId)}`;
}

function toBase64(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach(byte => (binary += String.fromCharCode(byte)));
  return btoa(binary);
}

function fromBase64(value: string) {
  return Uint8Array.from(atob(value), character => character.charCodeAt(0));
}

async function derivePinHash(pin: string, salt: Uint8Array) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: salt.slice().buffer as ArrayBuffer,
      iterations: 180_000,
    },
    key,
    256
  );
  return toBase64(new Uint8Array(bits));
}

export function readPrivatePinRecord(userId: string | number): PrivatePinRecord | null {
  try {
    const value = localStorage.getItem(pinKey(userId));
    if (!value) return null;
    const record = JSON.parse(value) as PrivatePinRecord;
    if (
      (record.digits !== 4 && record.digits !== 6) ||
      typeof record.salt !== "string" ||
      typeof record.hash !== "string"
    ) return null;
    return record;
  } catch {
    return null;
  }
}

export async function setPrivatePin(
  userId: string | number,
  pin: string,
  digits: 4 | 6
) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const record = { digits, salt: toBase64(salt), hash: await derivePinHash(pin, salt) };
  localStorage.setItem(pinKey(userId), JSON.stringify(record));
}

export async function verifyPrivatePin(userId: string | number, pin: string) {
  const record = readPrivatePinRecord(userId);
  if (!record) return false;
  const hash = await derivePinHash(pin, fromBase64(record.salt));
  const actual = fromBase64(hash);
  const expected = fromBase64(record.hash);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  actual.forEach((byte, index) => { diff |= byte ^ expected[index]!; });
  return diff === 0;
}

export function readPrivateChatEntries(userId: string | number): PrivateChatEntry[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(chatsKey(userId)) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    const entries = parsed.filter((item): item is PrivateChatEntry =>
      item && typeof item.id === "string" && typeof item.title === "string" &&
      typeof item.updatedAt === "number"
    ).map(item => ({
      ...item,
      title: privateChatTitleForDisplay(item.title),
      locked: item.locked === true,
    }));
    localStorage.setItem(chatsKey(userId), JSON.stringify(entries));
    return entries.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export function writePrivateChatEntries(
  userId: string | number,
  entries: PrivateChatEntry[]
) {
  localStorage.setItem(chatsKey(userId), JSON.stringify(entries));
}

export function clearPrivatePin(userId: string | number) {
  localStorage.removeItem(pinKey(userId));
}
