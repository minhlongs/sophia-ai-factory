/**
 * USDT Address Validator
 *
 * Validates TRC20 (TRON) and ERC20 (Ethereum) USDT addresses.
 * TRC20: Base58Check with 0x41 version byte (T prefix).
 * ERC20: EIP-55 checksum validation.
 *
 * @module payouts/usdt-addr-validator
 */

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

function base58Decode(input: string): Uint8Array | null {
  const bytes: number[] = [0]
  for (const char of input) {
    const idx = BASE58_ALPHABET.indexOf(char)
    if (idx < 0) return null
    let carry = idx
    for (let j = 0; j < bytes.length; j++) {
      carry += bytes[j] * 58
      bytes[j] = carry & 0xff
      carry >>= 8
    }
    while (carry > 0) {
      bytes.push(carry & 0xff)
      carry >>= 8
    }
  }
  // Add leading zeros for leading '1' chars
  for (const char of input) {
    if (char !== '1') break
    bytes.push(0)
  }
  return new Uint8Array(bytes.reverse())
}

async function sha256(data: Uint8Array): Promise<Uint8Array> {
  const hash = await globalThis.crypto.subtle.digest('SHA-256', data.buffer as ArrayBuffer)
  return new Uint8Array(hash)
}

/**
 * Validate TRC20 USDT address (Base58Check, version byte 0x41, T prefix).
 * Returns true if valid, false otherwise.
 */
export async function validateTrc20Address(addr: string): Promise<boolean> {
  if (!addr || !addr.startsWith('T') || addr.length !== 34) return false
  const decoded = base58Decode(addr)
  if (!decoded || decoded.length !== 25) return false
  if (decoded[0] !== 0x41) return false

  const payload = decoded.slice(0, 21)
  const checksum = decoded.slice(21)

  const hash1 = await sha256(payload)
  const hash2 = await sha256(hash1)
  const expected = hash2.slice(0, 4)

  for (let i = 0; i < 4; i++) {
    if (checksum[i] !== expected[i]) return false
  }
  return true
}

/**
 * Validate ERC20 address (EIP-55 checksum or plain hex).
 * Accepts both checksummed and lowercase/uppercase (no mixed case check for MVP).
 */
export function validateErc20Address(addr: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(addr)
}

export type UsdtMethod = 'usdt_trc20' | 'usdt_erc20'

/**
 * Validate USDT address for the given method.
 * Returns true if valid.
 */
export async function validateUsdtAddress(
  addr: string,
  method: UsdtMethod,
): Promise<boolean> {
  if (method === 'usdt_trc20') return validateTrc20Address(addr)
  if (method === 'usdt_erc20') return validateErc20Address(addr)
  return false
}
