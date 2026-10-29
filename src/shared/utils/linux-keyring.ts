import { execFileSync } from 'node:child_process'

export function lookupLinuxKeyringPassword(appName: string): string {
  // execFileSync (no shell) so app names with spaces, e.g. "Unteams Debug", stay a single
  // argument instead of being word-split by the shell.
  return execFileSync(
    'secret-tool',
    ['lookup', 'xdg:schema', 'chrome_libsecret_os_crypt_password_v2', 'application', appName],
    { timeout: 5000, encoding: 'utf8' },
  ).trim()
}
