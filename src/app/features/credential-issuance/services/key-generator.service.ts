import { Injectable } from '@angular/core';
import { HolderKeyMaterial, HolderPublicJwk } from 'src/app/core/models/entity/lear-credential-issuance';

/**
 * Generates the holder key pair for credential types that bind to one without a wallet proof.
 *
 * The key used to be generated from a button on the issuance form, which forced this service to
 * keep it in signals for the template to read. It is now generated during submission and shown
 * once, in the result dialog, so `generateHolderKeyPair()` RETURNS the material and this service
 * holds no state at all: nothing to read back, nothing to leak into a later issuance, nothing
 * left behind if the Operator navigates away.
 */
@Injectable({ providedIn: 'root' })
export class KeyGeneratorService {

  /**
   * A P-256 pair, as the three representations the flow needs: the private half to show the
   * Operator, the did:key that goes in `mandatee.id`, and the public JWK that goes in
   * `holder_key.jwk`. All three derive from the same `CryptoKeyPair`, so they cannot drift.
   */
  public async generateHolderKeyPair(): Promise<HolderKeyMaterial> {
    const keyPair = await this.generateP256KeyPair();

    const privateKeyHex = await this.generateP256PrivateKeyHex(keyPair);
    const publicKeyHex = await this.generateP256PublicKeyHex(keyPair);
    const didKey = await this.generateDidKey(publicKeyHex);
    const publicJwk = await this.exportPublicJwk(keyPair);

    return { privateKeyHex, didKey, publicJwk };
  }

  /**
   * Only `kty`/`crv`/`x`/`y` survive the export. WebCrypto also returns `ext` and `key_ops`,
   * which are browser bookkeeping rather than key material and have no business on the wire.
   */
  private async exportPublicJwk(keyPair: CryptoKeyPair): Promise<HolderPublicJwk> {
    const jwk = await globalThis.crypto.subtle.exportKey('jwk', keyPair.publicKey);
    if (!jwk.x || !jwk.y) {
      throw new Error('Exported public JWK is missing its EC coordinates');
    }
    return { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y };
  }

  private async generateP256KeyPair(): Promise<CryptoKeyPair> {
      return await globalThis.crypto.subtle.generateKey(
        {
          name: "ECDSA",
          namedCurve: "P-256"
        },
        true,
        ["sign", "verify"]
      );
  }

  private async generateP256PrivateKeyHex(keyPair: CryptoKeyPair): Promise<string> {
    const privateKeyPkcs8: ArrayBuffer = await globalThis.crypto.subtle.exportKey("pkcs8", keyPair.privateKey);

    const privateKeyPkcs8Bytes: Uint8Array = new Uint8Array(privateKeyPkcs8);

    const privateKeyBytes: Uint8Array = privateKeyPkcs8Bytes.slice(36, 36 + 32);

    const privateKeyHexBytes: string = this.bytesToHexString(privateKeyBytes);

    return privateKeyHexBytes;
  }

  private async generateDidKey(publicKeyHex: string): Promise<string>{
      const publicKeyHexWithout0xAndPrefix = publicKeyHex.slice(4)

      const publicKeyX = publicKeyHexWithout0xAndPrefix.slice(0, 64)

      const publicKeyY = publicKeyHexWithout0xAndPrefix.slice(64)
      const isPublicKeyYEven = this.isHexNumberEven(publicKeyY)

      const compressedPublicKeyX = (isPublicKeyYEven ? "02" : "03") + publicKeyX;

      const multicodecHex = "8024" + compressedPublicKeyX

      const matchResult = multicodecHex.match(/.{1,2}/g);
      if (!matchResult) {
        throw new Error('Invalid multicodecHex string');
      }
      const multicodecBytes = new Uint8Array(matchResult.map(byte => Number.parseInt(byte, 16)));
      const MAP = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
      const multicodecBase58 = this.base58encode(multicodecBytes, MAP);

      return 'did:key:z' + multicodecBase58;
  }

  private async generateP256PublicKeyHex(keyPair: CryptoKeyPair): Promise<string> {
      const publicKey: ArrayBuffer = await globalThis.crypto.subtle.exportKey("raw", keyPair.publicKey);

      const publicKeyBytes: Uint8Array = new Uint8Array(publicKey);

      return this.bytesToHexString(publicKeyBytes);
  }

  private bytesToHexString(bytesToTransform: Uint8Array): string {
      return `0x${Array.from(bytesToTransform).map(b => b.toString(16).padStart(2, '0')).join('')}`;
  }

  private isHexNumberEven(hexNumber: string): boolean {
      const decimalNumber: bigint = BigInt("0x" + hexNumber);
      const stringNumber: string = decimalNumber.toString();

      const lastNumPosition: number = stringNumber.length - 1;
      const lastNumDecimal: number = Number.parseInt(stringNumber[lastNumPosition]);

      const isEven: boolean = lastNumDecimal % 2 === 0;
      return isEven;
  }

  private base58encode(
      B: Uint8Array,     // Raw byte input
      A: string          // Base58 characters, e.g., "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
  ): string {
      const d: number[] = [];  // Stream of base58 digits
      let s = "";              // Result string

      for (let i = 0; i < B.length; i++) {
          let j = 0;
          let c = B[i];
          s += c || s.length ^ i ? "" : "1"; // Prepend '1' for leading zeros

          while (j < d.length || c) {
              let n = d[j];
              n = n ? n * 256 + c : c;
              c = Math.floor(n / 58);
              d[j] = n % 58;
              j++;
          }
      }

      while (d.length) {
          s += A[d.pop()!]; // `!` because we know pop() won't return undefined here
      }

      return s;
  }

}
