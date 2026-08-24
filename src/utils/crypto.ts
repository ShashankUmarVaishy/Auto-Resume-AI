const ALGORITHM = 'AES-GCM';
const KDF_ALGORITHM = 'PBKDF2';
const HASH = 'SHA-256';
const ITERATIONS = 100000;
const KEY_LEN = 256;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(password),
    { name: KDF_ALGORITHM },
    false,
    ['deriveKey', 'deriveBits']
  );
  
  return crypto.subtle.deriveKey(
    {
      name: KDF_ALGORITHM,
      salt: salt as any,
      iterations: ITERATIONS,
      hash: HASH
    },
    baseKey,
    { name: ALGORITHM, length: KEY_LEN },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a plaintext string using a password.
 * Returns a base64 encoded string containing the salt, IV, and ciphertext.
 */
export async function encryptText(text: string, password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  
  const encrypted = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    textEncoder.encode(text)
  );
  
  const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(encrypted), salt.length + iv.length);
  
  // Convert binary to binary-string to base64
  let binary = '';
  const len = combined.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(combined[i]!);
  }
  return btoa(binary);
}

/**
 * Decrypts a base64 encoded string using a password.
 * Throws an error if decryption fails (incorrect password).
 */
export async function decryptText(base64Text: string, password: string): Promise<string> {
  try {
    const binaryString = atob(base64Text);
    const len = binaryString.length;
    const combined = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      combined[i] = binaryString.charCodeAt(i);
    }
    
    const salt = combined.slice(0, 16);
    const iv = combined.slice(16, 28);
    const encrypted = combined.slice(28);
    
    const key = await deriveKey(password, salt);
    
    const decrypted = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv },
      key,
      encrypted
    );
    
    return textDecoder.decode(decrypted);
  } catch (error) {
    throw new Error('Incorrect password');
  }
}
