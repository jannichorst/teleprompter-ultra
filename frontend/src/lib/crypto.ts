const STORAGE_KEY = "teleprompter-api-key";
const PASSPHRASE = "teleprompter-ultra-local";

async function getKey() {
  const encoder = new TextEncoder();
  const passphraseData = encoder.encode(PASSPHRASE);
  const salt = encoder.encode("teleprompter-ultra-salt");

  const baseKey = await crypto.subtle.importKey("raw", passphraseData, { name: "PBKDF2" }, false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptString(value: string) {
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await getKey();
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(value));
  const payload = new Uint8Array([...iv, ...new Uint8Array(cipher)]);
  return btoa(String.fromCharCode(...payload));
}

export async function decryptString(payload: string) {
  const data = Uint8Array.from(atob(payload), (char) => char.charCodeAt(0));
  const iv = data.slice(0, 12);
  const cipher = data.slice(12);
  const key = await getKey();
  const plainBuffer = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher);
  return new TextDecoder().decode(plainBuffer);
}

export async function loadApiKey(): Promise<string | null> {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return null;
  try {
    return await decryptString(stored);
  } catch (error) {
    console.error("Failed to decrypt stored key", error);
    return null;
  }
}

export async function saveApiKey(value: string) {
  const encrypted = await encryptString(value);
  localStorage.setItem(STORAGE_KEY, encrypted);
}

export function clearApiKey() {
  localStorage.removeItem(STORAGE_KEY);
}
