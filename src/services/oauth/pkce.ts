/** PKCE (RFC 7636): verificador aleatório e desafio S256. */
const b64url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export function randomString(byteLength = 32): string {
  const b = new Uint8Array(byteLength);
  crypto.getRandomValues(b);
  return b64url(b);
}
export async function pkcePair(): Promise<{ verifier: string; challenge: string }> {
  const verifier = randomString(64);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return { verifier, challenge: b64url(new Uint8Array(digest)) };
}
