import { expect, test } from 'bun:test'

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
  createSlackClient,
} from '@/platforms/slack/index'

test('SlackClient is exported from barrel', () => {
  expect(typeof SlackClient).toBe('function')
})

test('SlackError is exported from barrel', () => {
  expect(typeof SlackError).toBe('function')
})

test('CredentialManager is exported from barrel', () => {
  expect(typeof CredentialManager).toBe('function')
})

test('SlackCredentialManager is exported from barrel', () => {
  expect(typeof SlackCredentialManager).toBe('function')
})

test('createSlackClient is exported from barrel', () => {
  expect(typeof createSlackClient).toBe('function')
})

test('SlackChannelSchema is exported from barrel', () => {
  expect(typeof SlackChannelSchema.parse).toBe('function')
})

test('SlackReactionSchema is exported from barrel', () => {
  expect(typeof SlackReactionSchema.parse).toBe('function')
})

test('SlackFileSchema is exported from barrel', () => {
  expect(typeof SlackFileSchema.parse).toBe('function')
})

test('SlackMessageSchema is exported from barrel', () => {
  expect(typeof SlackMessageSchema.parse).toBe('function')
})

test('SlackUserSchema is exported from barrel', () => {
  expect(typeof SlackUserSchema.parse).toBe('function')
})

test('WorkspaceCredentialsSchema is exported from barrel', () => {
  expect(typeof WorkspaceCredentialsSchema.parse).toBe('function')
})

test('ConfigSchema is exported from barrel', () => {
  expect(typeof ConfigSchema.parse).toBe('function')
})
