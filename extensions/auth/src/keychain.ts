import fs from 'node:fs';
import path from 'node:path';

/**
 * Secure credential storage using Electron's safeStorage API when available,
 * with plaintext fallback for development environments.
 */
export class Keychain {
  private storagePath: string;

  constructor(storagePath: string) {
    this.storagePath = storagePath;
    if (!fs.existsSync(this.storagePath)) {
      fs.mkdirSync(this.storagePath, { recursive: true });
    }
  }

  async set(key: string, value: string): Promise<void> {
    try {
      const { safeStorage } = await import('electron');
      if (safeStorage.isEncryptionAvailable()) {
        const encrypted = safeStorage.encryptString(value);
        const filePath = path.join(this.storagePath, `${key}.enc`);
        fs.writeFileSync(filePath, encrypted);
        return;
      }
    } catch {
      // electron safeStorage not available (e.g. running outside Electron)
    }

    // Dev fallback: plaintext storage
    const filePath = path.join(this.storagePath, `${key}.txt`);
    fs.writeFileSync(filePath, value, 'utf-8');
  }

  async get(key: string): Promise<string | null> {
    // Try encrypted file first
    const encPath = path.join(this.storagePath, `${key}.enc`);
    if (fs.existsSync(encPath)) {
      try {
        const { safeStorage } = await import('electron');
        const encrypted = fs.readFileSync(encPath);
        return safeStorage.decryptString(encrypted);
      } catch {
        // electron safeStorage not available
        return null;
      }
    }

    // Plaintext fallback
    const txtPath = path.join(this.storagePath, `${key}.txt`);
    if (fs.existsSync(txtPath)) {
      return fs.readFileSync(txtPath, 'utf-8');
    }

    return null;
  }

  async delete(key: string): Promise<void> {
    const encPath = path.join(this.storagePath, `${key}.enc`);
    const txtPath = path.join(this.storagePath, `${key}.txt`);

    if (fs.existsSync(encPath)) fs.unlinkSync(encPath);
    if (fs.existsSync(txtPath)) fs.unlinkSync(txtPath);
  }
}
