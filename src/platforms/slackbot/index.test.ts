import { expect, it } from 'bun:test'

import {
  SlackBotClient,
  SlackBotConfigSchema,
  SlackBotCredentialManager,
  SlackBotCredentialsSchema,
  SlackBotError,
  SlackBotListener,
  SlackChannelSchema,
  SlackFileSchema,
  SlackMessageSchema,
  SlackReactionSchema,
  SlackUserSchema,
} from '@/platforms/slackbot/index'

it('SlackBotClient is exported from barrel', () => {
  expect(typeof SlackBotClient).toBe('function')
})

it('SlackBotError is exported from barrel', () => {
  expect(typeof SlackBotError).toBe('function')
})

it('SlackBotCredentialManager is exported from barrel', () => {
  expect(typeof SlackBotCredentialManager).toBe('function')
})

it('SlackBotListener is exported from barrel', () => {
  expect(typeof SlackBotListener).toBe('function')
})

it('SlackBotConfigSchema is exported from barrel', () => {
  expect(typeof SlackBotConfigSchema.parse).toBe('function')
})

it('SlackBotCredentialsSchema is exported from barrel', () => {
  expect(typeof SlackBotCredentialsSchema.parse).toBe('function')
})

it('SlackChannelSchema is exported from barrel', () => {
  expect(typeof SlackChannelSchema.parse).toBe('function')
})

it('SlackMessageSchema is exported from barrel', () => {
  expect(typeof SlackMessageSchema.parse).toBe('function')
})

it('SlackUserSchema is exported from barrel', () => {
  expect(typeof SlackUserSchema.parse).toBe('function')
})

it('SlackReactionSchema is exported from barrel', () => {
  expect(typeof SlackReactionSchema.parse).toBe('function')
})

it('SlackFileSchema is exported from barrel', () => {
  expect(typeof SlackFileSchema.parse).toBe('function')
})
