import { beforeEach, describe, expect, mock, test } from 'bun:test'

import type { WhatsAppBotTemplate } from '../types'

const mockTemplates: WhatsAppBotTemplate[] = [
  {
    name: 'hello_world',
    status: 'APPROVED',
    category: 'UTILITY',
    language: 'en_US',
    components: [{ type: 'BODY', text: 'Hello World!' }],
  },
  {
    name: 'order_confirmation',
    status: 'APPROVED',
    category: 'TRANSACTIONAL',
    language: 'en_US',
    components: [{ type: 'BODY', text: 'Your order {{1}} has been confirmed.' }],
  },
]

const mockListTemplates = mock(() => Promise.resolve(mockTemplates))
const mockGetTemplate = mock((name: string) => {
  const template = mockTemplates.find((t) => t.name === name)
  if (!template) {
    return Promise.reject(new Error(`Template "${name}" not found`))
  }
  return Promise.resolve(template)
})

const mockClient = {
  listTemplates: mockListTemplates,
  getTemplate: mockGetTemplate,
}

mock.module('./shared', () => ({
  getClient: async () => mockClient,
}))

import { getAction, listAction } from './template'

describe('template commands', () => {
  beforeEach(() => {
    mockListTemplates.mockClear()
    mockGetTemplate.mockClear()
  })

  describe('listAction', () => {
    test('returns all templates', async () => {
      const result = await listAction({})

      expect(result.templates).toHaveLength(2)
      expect(result.templates?.[0].name).toBe('hello_world')
      expect(result.templates?.[1].name).toBe('order_confirmation')
      expect(mockListTemplates).toHaveBeenCalledWith(undefined)
    })

    test('passes limit when provided', async () => {
      const result = await listAction({ limit: '1' })

      expect(mockListTemplates).toHaveBeenCalledWith({ limit: 1 })
      expect(result.error).toBeUndefined()
    })

    test('returns error for invalid limit', async () => {
      const result = await listAction({ limit: 'abc' })

      expect(result.error).toBeDefined()
      expect(result.error).toContain('Invalid --limit')
    })

    test('returns error for zero limit', async () => {
      const result = await listAction({ limit: '0' })

      expect(result.error).toBeDefined()
      expect(result.error).toContain('Invalid --limit')
    })

    test('returns error when client throws', async () => {
      mockListTemplates.mockImplementationOnce(() => Promise.reject(new Error('API error')))

      const result = await listAction({})

      expect(result.error).toBe('API error')
    })
  })

  describe('getAction', () => {
    test('returns a specific template by name', async () => {
      const result = await getAction('hello_world', {})

      expect(result.template).toBeDefined()
      expect(result.template?.name).toBe('hello_world')
      expect(result.template?.status).toBe('APPROVED')
      expect(mockGetTemplate).toHaveBeenCalledWith('hello_world')
    })

    test('returns error when template not found', async () => {
      const result = await getAction('nonexistent_template', {})

      expect(result.error).toContain('nonexistent_template')
    })

    test('returns error when client throws', async () => {
      mockGetTemplate.mockImplementationOnce(() => Promise.reject(new Error('Network error')))

      const result = await getAction('hello_world', {})

      expect(result.error).toBe('Network error')
    })
  })
})
