const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

type CryptoLike = { getRandomValues: (arr: Uint8Array) => Uint8Array };

export function shortId(length = 10): string {
  let id = '';
  const g = globalThis as unknown as { crypto?: CryptoLike };
  const cryptoRef = g.crypto;
  if (cryptoRef?.getRandomValues) {
    const bytes = new Uint8Array(length);
    cryptoRef.getRandomValues(bytes);
    for (let i = 0; i < length; i++) {
      id += ALPHABET[bytes[i]! % ALPHABET.length];
    }
    return id;
  }
  for (let i = 0; i < length; i++) {
    id += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return id;
}
