import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;

  constructor(private configService: ConfigService) {
    const keyHex = this.configService.get<string>('ENCRYPTION_KEY');
    if (!keyHex) {
      throw new Error(
        'ENCRYPTION_KEY is not set in environment variables. Please generate one using crypto.randomBytes(32).toString("hex")',
      );
    }

    // Ensure the key is exactly 32 bytes (256 bits) for AES-256
    this. key = Buffer.from(keyHex, 'hex');
    if (this.key.length !== 32) {
      throw new Error('ENCRYPTION_KEY must be exactly 32 bytes (64 hex chars)');
    }
  }

  /**
   * Encrypts plaintext using AES-256-GCM.
   * @param plaintext The text to encrypt
   * @returns Object containing ciphertext, IV, and auth tag
   */
  encrypt(plaintext: string): {
    ciphertext: string;
    iv: string;
    authTag: string;
  } {
    // Generate a random initialization vector
    const iv = crypto.randomBytes(16);

    // Create cipher
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

    // Encrypt the data
    let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
    ciphertext += cipher.final('hex');

    // Get the authentication tag
    const authTag = cipher.getAuthTag();

    return {
      ciphertext,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
    };
  }

  /**
   * Decrypts ciphertext using AES-256-GCM.
   * @param ciphertext The encrypted text
   * @param iv The initialization vector
   * @param authTag The authentication tag
   * @returns Decrypted plaintext
   */
  decrypt(ciphertext: string, iv: string, authTag: string): string {
    const ivBuffer = Buffer.from(iv, 'hex');
    const authTagBuffer = Buffer.from(authTag, 'hex');

    // Create decipher
    const decipher = crypto.createDecipheriv(this.algorithm, this.key, ivBuffer);

    // Set the auth tag
    decipher.setAuthTag(authTagBuffer);

    // Decrypt the data
    let plaintext = decipher.update(ciphertext, 'hex', 'utf8');
    plaintext += decipher.final('utf8');

    return plaintext;
  }
}
