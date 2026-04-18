import { expect, it } from 'bun:test'

import {
  CredentialManager,
  SlackCredentialManager,
  SlackChannelSchema,
  SlackClient,
  SlackError,
  SlackFileSchema,
  SlackMessageSchema,
  SlackReactionSchema,
  SlackUserSchema,
  WorkspaceCredentialsSchema,
  ConfigSchema,
} from '@/platforms/slack/index'

it('SlackClient is exported from barrel', () => {
  expect(typeof SlackClient).toBe('function')
})

it('SlackError is exported from barrel', () => {
  expect(typeof SlackError).toBe('function')
})

it('CredentialManager is exported from barrel', () => {
  expect(typeof CredentialManager).toBe('function')
})

it('SlackCredentialManager is exported from barrel', () => {
  expect(typeof SlackCredentialManager).toBe('function')
})

it('SlackChannelSchema is exported from barrel', () => {
  expect(typeof SlackChannelSchema.parse).toBe('function')
})

it('SlackReactionSchema is exported from barrel', () => {
  expect(typeof SlackReactionSchema.parse).toBe('function')
})

it('SlackFileSchema is exported from barrel', () => {
  expect(typeof SlackFileSchema.parse).toBe('function')
})

it('SlackMessageSchema is exported from barrel', () => {
  expect(typeof SlackMessageSchema.parse).toBe('function')
})

it('SlackUserSchema is exported from barrel', () => {
  expect(typeof SlackUserSchema.parse).toBe('function')
})

it('WorkspaceCredentialsSchema is exported from barrel', () => {
  expect(typeof WorkspaceCredentialsSchema.parse).toBe('function')
})

it('ConfigSchema is exported from barrel', () => {
  expect(typeof ConfigSchema.parse).toBe('function')
})
