import bcrypt from 'bcryptjs'

const SALT_ROUNDS = 12

/**
 * Hashes a plain-text password using bcrypt.
 *
 * @param plain - The plain-text password to hash.
 * @returns The bcrypt hash string (60 characters).
 */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS)
}

/**
 * Compares a plain-text password against a stored bcrypt hash.
 *
 * @param plain - The plain-text password supplied by the user.
 * @param hash - The stored bcrypt hash to compare against.
 * @returns `true` if the password matches, `false` otherwise.
 */
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}
