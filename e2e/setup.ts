import { beforeAll, afterAll } from 'bun:test'

import { $ } from 'bun'

beforeAll(async () => {
  await $`bun link`.quiet()
})

afterAll(async () => {
  await $`bun unlink`.quiet()
})
