import type { VirusScanner } from './storage.provider';

/** EICAR-aware mock scanner: flags the standard test signature, accepts everything else. */
export class MockVirusScanner implements VirusScanner {
  readonly name = 'mock';
  private readonly eicar = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';
  async scan(bytes: Buffer): Promise<{ clean: boolean; signature?: string }> {
    const head = bytes.subarray(0, 512).toString('latin1');
    if (head.includes(this.eicar)) return { clean: false, signature: 'EICAR-Test-File' };
    return { clean: true };
  }
}

export class NoopVirusScanner implements VirusScanner {
  readonly name = 'none';
  async scan(): Promise<{ clean: boolean }> {
    return { clean: true };
  }
}
