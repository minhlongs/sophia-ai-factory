/**
 * Error hierarchy for Mekong Crypto operations.
 * @module tree/mekong/crypto/errors
 */

export class MekongCryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MekongCryptoError';
    Object.setPrototypeOf(this, MekongCryptoError.prototype);
  }
}

export class MekongTamperError extends MekongCryptoError {
  constructor(message = 'Payload integrity verification failed: ciphertext or IV tampered') {
    super(message);
    this.name = 'MekongTamperError';
    Object.setPrototypeOf(this, MekongTamperError.prototype);
  }
}

export class MekongKeyError extends MekongCryptoError {
  constructor(message = 'Invalid secret or key material') {
    super(message);
    this.name = 'MekongKeyError';
    Object.setPrototypeOf(this, MekongKeyError.prototype);
  }
}

export class MekongPayloadError extends MekongCryptoError {
  constructor(message = 'Malformed encrypted payload envelope') {
    super(message);
    this.name = 'MekongPayloadError';
    Object.setPrototypeOf(this, MekongPayloadError.prototype);
  }
}
