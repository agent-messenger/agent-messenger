declare module '@/vendor/linejs/client/mod.js' {
  import type { InitOptions, WithPasswordOptions, WithQROptions } from '@/vendor/linejs/_dist/client/login.js'
  export { Client } from '@/vendor/linejs/_dist/client/client.js'
  import type { Client } from '@/vendor/linejs/_dist/client/client.js'

  export function loginWithQR(opts: WithQROptions, init: InitOptions): Promise<Client>
  export function loginWithPassword(opts: WithPasswordOptions, init: InitOptions): Promise<Client>
  export function loginWithAuthToken(authToken: string, init: InitOptions): Promise<Client>
}

declare module '@/vendor/linejs/base/storage/mod.js' {
  export { FileStorage } from '@/vendor/linejs/_dist/base/storage/file.js'
}

declare module '@/vendor/linejs/base/mod.js' {
  export { BaseClient } from '@/vendor/linejs/_dist/base/core/mod.js'
}
