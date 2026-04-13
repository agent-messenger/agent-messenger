import { beforeEach, describe, expect, mock, test } from 'bun:test'

const mockSendTextMessage = mock(() =>
  Promise.resolve({
    messaging_product: 'whatsapp',
    contacts: [{ input: '+1234567890', wa_id: '1234567890' }],
    messages: [{ id: 'wamid.test123' }],
  }),
)

const mockSendTemplateMessage = mock(() =>
  Promise.resolve({
    messaging_product: 'whatsapp',
    contacts: [{ input: '+1234567890', wa_id: '1234567890' }],
    messages: [{ id: 'wamid.template123' }],
  }),
)

const mockSendReaction = mock(() =>
  Promise.resolve({
    messaging_product: 'whatsapp',
    contacts: [{ input: '+1234567890', wa_id: '1234567890' }],
    messages: [{ id: 'wamid.reaction123' }],
  }),
)

const mockSendImageMessage = mock(() =>
  Promise.resolve({
    messaging_product: 'whatsapp',
    contacts: [{ input: '+1234567890', wa_id: '1234567890' }],
    messages: [{ id: 'wamid.image123' }],
  }),
)

const mockSendDocumentMessage = mock(() =>
  Promise.resolve({
    messaging_product: 'whatsapp',
    contacts: [{ input: '+1234567890', wa_id: '1234567890' }],
    messages: [{ id: 'wamid.doc123' }],
  }),
)

const mockClient = {
  sendTextMessage: mockSendTextMessage,
  sendTemplateMessage: mockSendTemplateMessage,
  sendReaction: mockSendReaction,
  sendImageMessage: mockSendImageMessage,
  sendDocumentMessage: mockSendDocumentMessage,
}

mock.module('./shared', () => ({
  getClient: async () => mockClient,
}))

import { sendAction, sendDocumentAction, sendImageAction, sendReactionAction, sendTemplateAction } from './message'

describe('message commands', () => {
  beforeEach(() => {
    mockSendTextMessage.mockClear()
    mockSendTemplateMessage.mockClear()
    mockSendReaction.mockClear()
    mockSendImageMessage.mockClear()
    mockSendDocumentMessage.mockClear()
  })

  describe('sendAction', () => {
    test('sends a text message and returns result', async () => {
      const result = await sendAction('+1234567890', 'Hello!', {})

      expect(result.messaging_product).toBe('whatsapp')
      expect(result.messages).toHaveLength(1)
      expect(result.messages?.[0].id).toBe('wamid.test123')
      expect(mockSendTextMessage).toHaveBeenCalledWith('+1234567890', 'Hello!')
    })

    test('returns error when client throws', async () => {
      mockSendTextMessage.mockImplementationOnce(() => Promise.reject(new Error('Network error')))

      const result = await sendAction('+1234567890', 'Hello!', {})

      expect(result.error).toBe('Network error')
    })
  })

  describe('sendTemplateAction', () => {
    test('sends a template message with default language', async () => {
      const result = await sendTemplateAction('+1234567890', 'hello_world', {})

      expect(result.messaging_product).toBe('whatsapp')
      expect(result.messages?.[0].id).toBe('wamid.template123')
      expect(mockSendTemplateMessage).toHaveBeenCalledWith('+1234567890', 'hello_world', 'en_US', undefined)
    })

    test('sends a template message with custom language', async () => {
      const result = await sendTemplateAction('+1234567890', 'hello_world', { language: 'pt_BR' })

      expect(mockSendTemplateMessage).toHaveBeenCalledWith('+1234567890', 'hello_world', 'pt_BR', undefined)
      expect(result.error).toBeUndefined()
    })

    test('parses and passes components JSON', async () => {
      const components = [{ type: 'body', parameters: [{ type: 'text', text: 'World' }] }]
      const result = await sendTemplateAction('+1234567890', 'hello_world', {
        components: JSON.stringify(components),
      })

      expect(mockSendTemplateMessage).toHaveBeenCalledWith('+1234567890', 'hello_world', 'en_US', components)
      expect(result.error).toBeUndefined()
    })

    test('returns error for invalid components JSON', async () => {
      const result = await sendTemplateAction('+1234567890', 'hello_world', {
        components: 'not-valid-json',
      })

      expect(result.error).toBe('Invalid --components JSON')
    })

    test('returns error when client throws', async () => {
      mockSendTemplateMessage.mockImplementationOnce(() => Promise.reject(new Error('Template not found')))

      const result = await sendTemplateAction('+1234567890', 'missing_template', {})

      expect(result.error).toBe('Template not found')
    })
  })

  describe('sendReactionAction', () => {
    test('sends a reaction and returns result', async () => {
      const result = await sendReactionAction('+1234567890', 'wamid.msg123', '👍', {})

      expect(result.messaging_product).toBe('whatsapp')
      expect(result.messages?.[0].id).toBe('wamid.reaction123')
      expect(mockSendReaction).toHaveBeenCalledWith('+1234567890', 'wamid.msg123', '👍')
    })

    test('returns error when client throws', async () => {
      mockSendReaction.mockImplementationOnce(() => Promise.reject(new Error('Message not found')))

      const result = await sendReactionAction('+1234567890', 'wamid.bad', '👍', {})

      expect(result.error).toBe('Message not found')
    })
  })

  describe('sendImageAction', () => {
    test('sends an image message and returns result', async () => {
      const result = await sendImageAction('+1234567890', 'https://example.com/image.jpg', {})

      expect(result.messaging_product).toBe('whatsapp')
      expect(result.messages?.[0].id).toBe('wamid.image123')
      expect(mockSendImageMessage).toHaveBeenCalledWith('+1234567890', 'https://example.com/image.jpg', undefined)
    })

    test('passes caption when provided', async () => {
      const result = await sendImageAction('+1234567890', 'https://example.com/image.jpg', { caption: 'My photo' })

      expect(mockSendImageMessage).toHaveBeenCalledWith('+1234567890', 'https://example.com/image.jpg', 'My photo')
      expect(result.error).toBeUndefined()
    })

    test('returns error when client throws', async () => {
      mockSendImageMessage.mockImplementationOnce(() => Promise.reject(new Error('Invalid URL')))

      const result = await sendImageAction('+1234567890', 'bad-url', {})

      expect(result.error).toBe('Invalid URL')
    })
  })

  describe('sendDocumentAction', () => {
    test('sends a document message and returns result', async () => {
      const result = await sendDocumentAction('+1234567890', 'https://example.com/doc.pdf', {})

      expect(result.messaging_product).toBe('whatsapp')
      expect(result.messages?.[0].id).toBe('wamid.doc123')
      expect(mockSendDocumentMessage).toHaveBeenCalledWith(
        '+1234567890',
        'https://example.com/doc.pdf',
        undefined,
        undefined,
      )
    })

    test('passes filename and caption when provided', async () => {
      const result = await sendDocumentAction('+1234567890', 'https://example.com/doc.pdf', {
        filename: 'report.pdf',
        caption: 'Monthly report',
      })

      expect(mockSendDocumentMessage).toHaveBeenCalledWith(
        '+1234567890',
        'https://example.com/doc.pdf',
        'report.pdf',
        'Monthly report',
      )
      expect(result.error).toBeUndefined()
    })

    test('returns error when client throws', async () => {
      mockSendDocumentMessage.mockImplementationOnce(() => Promise.reject(new Error('Upload failed')))

      const result = await sendDocumentAction('+1234567890', 'https://example.com/doc.pdf', {})

      expect(result.error).toBe('Upload failed')
    })
  })
})
