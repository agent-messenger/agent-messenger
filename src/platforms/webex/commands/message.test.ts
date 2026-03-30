import { afterEach, beforeEach, expect, mock, spyOn, test } from 'bun:test'

import { WebexClient } from '../client'
import { WebexCredentialManager } from '../credential-manager'
import { deleteAction, editAction, getAction, listAction, sendAction } from './message'

let clientSendMessageSpy: ReturnType<typeof spyOn>
let clientListMessagesSpy: ReturnType<typeof spyOn>
let clientGetMessageSpy: ReturnType<typeof spyOn>
let clientDeleteMessageSpy: ReturnType<typeof spyOn>
let clientEditMessageSpy: ReturnType<typeof spyOn>
let credManagerGetTokenSpy: ReturnType<typeof spyOn>
const originalConsoleLog = console.log

const mockMessage = {
  id: 'msg_123',
  roomId: 'space_456',
  roomType: 'group' as const,
  text: 'Hello world',
  personId: 'person_789',
  personEmail: 'user@example.com',
  created: '2025-01-29T10:00:00.000Z',
}

const mockMessage2 = {
  id: 'msg_124',
  roomId: 'space_456',
  roomType: 'group' as const,
  text: 'Second message',
  personId: 'person_789',
  personEmail: 'user@example.com',
  created: '2025-01-29T10:01:00.000Z',
}

beforeEach(() => {
  clientSendMessageSpy = spyOn(WebexClient.prototype, 'sendMessage').mockResolvedValue(mockMessage)

  clientListMessagesSpy = spyOn(WebexClient.prototype, 'listMessages').mockResolvedValue([
    mockMessage,
    mockMessage2,
  ])

  clientGetMessageSpy = spyOn(WebexClient.prototype, 'getMessage').mockResolvedValue(mockMessage)

  clientDeleteMessageSpy = spyOn(WebexClient.prototype, 'deleteMessage').mockResolvedValue(
    undefined,
  )

  clientEditMessageSpy = spyOn(WebexClient.prototype, 'editMessage').mockResolvedValue({
    ...mockMessage,
    text: 'Updated message',
  })

  credManagerGetTokenSpy = spyOn(WebexCredentialManager.prototype, 'getToken').mockResolvedValue(
    'test_token',
  )
})

afterEach(() => {
  clientSendMessageSpy?.mockRestore()
  clientListMessagesSpy?.mockRestore()
  clientGetMessageSpy?.mockRestore()
  clientDeleteMessageSpy?.mockRestore()
  clientEditMessageSpy?.mockRestore()
  credManagerGetTokenSpy?.mockRestore()
  console.log = originalConsoleLog
})

test('send: calls sendMessage with correct args and outputs result', async () => {
  const consoleSpy = mock((_msg: string) => {})
  console.log = consoleSpy

  await sendAction('space_456', 'Hello world', { pretty: false })

  expect(clientSendMessageSpy).toHaveBeenCalledWith('space_456', 'Hello world', {
    markdown: undefined,
  })
  expect(consoleSpy).toHaveBeenCalled()
  const output = consoleSpy.mock.calls[0][0]
  expect(output).toContain('msg_123')
  expect(output).toContain('space_456')
  expect(output).toContain('user@example.com')
})

test('send: with --markdown passes markdown option', async () => {
  const consoleSpy = mock((_msg: string) => {})
  console.log = consoleSpy

  await sendAction('space_456', '**bold**', { markdown: true, pretty: false })

  expect(clientSendMessageSpy).toHaveBeenCalledWith('space_456', '**bold**', { markdown: true })
})

test('send: not authenticated shows error', async () => {
  credManagerGetTokenSpy.mockResolvedValue(null)
  const consoleSpy = mock((_msg: string) => {})
  console.log = consoleSpy

  const originalExit = process.exit
  process.exit = mock((_code?: number) => {
    throw new Error('process.exit called')
  }) as never

  try {
    await sendAction('space_456', 'Hello', { pretty: false })
  } catch (_e) {
  } finally {
    process.exit = originalExit
  }

  expect(consoleSpy).toHaveBeenCalled()
  const output = consoleSpy.mock.calls[0][0]
  expect(output).toContain('Not authenticated')
})

test('list: calls listMessages with limit and outputs array', async () => {
  const consoleSpy = mock((_msg: string) => {})
  console.log = consoleSpy

  await listAction('space_456', { limit: 50, pretty: false })

  expect(clientListMessagesSpy).toHaveBeenCalledWith('space_456', { max: 50 })
  expect(consoleSpy).toHaveBeenCalled()
  const output = consoleSpy.mock.calls[0][0]
  expect(output).toContain('msg_123')
  expect(output).toContain('msg_124')
})

test('list: not authenticated shows error', async () => {
  credManagerGetTokenSpy.mockResolvedValue(null)
  const consoleSpy = mock((_msg: string) => {})
  console.log = consoleSpy

  const originalExit = process.exit
  process.exit = mock((_code?: number) => {
    throw new Error('process.exit called')
  }) as never

  try {
    await listAction('space_456', { limit: 50, pretty: false })
  } catch (_e) {
  } finally {
    process.exit = originalExit
  }

  expect(consoleSpy).toHaveBeenCalled()
  const output = consoleSpy.mock.calls[0][0]
  expect(output).toContain('Not authenticated')
})

test('get: calls getMessage with correct id and outputs result', async () => {
  const consoleSpy = mock((_msg: string) => {})
  console.log = consoleSpy

  await getAction('msg_123', { pretty: false })

  expect(clientGetMessageSpy).toHaveBeenCalledWith('msg_123')
  expect(consoleSpy).toHaveBeenCalled()
  const output = consoleSpy.mock.calls[0][0]
  expect(output).toContain('msg_123')
  expect(output).toContain('user@example.com')
})

test('get: not authenticated shows error', async () => {
  credManagerGetTokenSpy.mockResolvedValue(null)
  const consoleSpy = mock((_msg: string) => {})
  console.log = consoleSpy

  const originalExit = process.exit
  process.exit = mock((_code?: number) => {
    throw new Error('process.exit called')
  }) as never

  try {
    await getAction('msg_123', { pretty: false })
  } catch (_e) {
  } finally {
    process.exit = originalExit
  }

  expect(consoleSpy).toHaveBeenCalled()
  const output = consoleSpy.mock.calls[0][0]
  expect(output).toContain('Not authenticated')
})

test('delete: with --force calls deleteMessage and outputs deleted id', async () => {
  const consoleSpy = mock((_msg: string) => {})
  console.log = consoleSpy

  await deleteAction('msg_123', { force: true, pretty: false })

  expect(clientDeleteMessageSpy).toHaveBeenCalledWith('msg_123')
  expect(consoleSpy).toHaveBeenCalled()
  const output = consoleSpy.mock.calls[0][0]
  expect(output).toContain('deleted')
  expect(output).toContain('msg_123')
})

test('delete: without --force shows warning and does not delete', async () => {
  const consoleSpy = mock((_msg: string) => {})
  console.log = consoleSpy

  const originalExit = process.exit
  process.exit = mock((_code?: number) => {
    throw new Error('process.exit called')
  }) as never

  try {
    await deleteAction('msg_123', { force: false, pretty: false })
  } catch (_e) {
  } finally {
    process.exit = originalExit
  }

  expect(clientDeleteMessageSpy).not.toHaveBeenCalled()
  expect(consoleSpy).toHaveBeenCalled()
  const output = consoleSpy.mock.calls[0][0]
  expect(output).toContain('warning')
  expect(output).toContain('--force')
})

test('delete: not authenticated shows error', async () => {
  credManagerGetTokenSpy.mockResolvedValue(null)
  const consoleSpy = mock((_msg: string) => {})
  console.log = consoleSpy

  const originalExit = process.exit
  process.exit = mock((_code?: number) => {
    throw new Error('process.exit called')
  }) as never

  try {
    await deleteAction('msg_123', { force: true, pretty: false })
  } catch (_e) {
  } finally {
    process.exit = originalExit
  }

  expect(consoleSpy).toHaveBeenCalled()
  const output = consoleSpy.mock.calls[0][0]
  expect(output).toContain('Not authenticated')
})

test('edit: calls editMessage with roomId in args and outputs result', async () => {
  const consoleSpy = mock((_msg: string) => {})
  console.log = consoleSpy

  await editAction('msg_123', 'space_456', 'Updated message', { pretty: false })

  expect(clientEditMessageSpy).toHaveBeenCalledWith('msg_123', 'space_456', 'Updated message', {
    markdown: undefined,
  })
  expect(consoleSpy).toHaveBeenCalled()
  const output = consoleSpy.mock.calls[0][0]
  expect(output).toContain('msg_123')
  expect(output).toContain('Updated message')
})

test('edit: with --markdown passes markdown option', async () => {
  const consoleSpy = mock((_msg: string) => {})
  console.log = consoleSpy

  await editAction('msg_123', 'space_456', '**updated**', { markdown: true, pretty: false })

  expect(clientEditMessageSpy).toHaveBeenCalledWith('msg_123', 'space_456', '**updated**', {
    markdown: true,
  })
})

test('edit: not authenticated shows error', async () => {
  credManagerGetTokenSpy.mockResolvedValue(null)
  const consoleSpy = mock((_msg: string) => {})
  console.log = consoleSpy

  const originalExit = process.exit
  process.exit = mock((_code?: number) => {
    throw new Error('process.exit called')
  }) as never

  try {
    await editAction('msg_123', 'space_456', 'Updated', { pretty: false })
  } catch (_e) {
  } finally {
    process.exit = originalExit
  }

  expect(consoleSpy).toHaveBeenCalled()
  const output = consoleSpy.mock.calls[0][0]
  expect(output).toContain('Not authenticated')
})
