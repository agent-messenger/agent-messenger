import { expect, test } from 'bun:test'

import {
  TeamsAccountSchema,
  TeamsAccountTypeSchema,
  TeamsChannelSchema,
  TeamsClient,
  TeamsConfigLegacySchema,
  TeamsConfigSchema,
  TeamsCredentialManager,
  TeamsCredentialsSchema,
  TeamsError,
  TeamsFileSchema,
  TeamsMessageSchema,
  TeamsReactionSchema,
  TeamsTeamSchema,
  TeamsUserSchema,
  createTeamsClient,
} from '@/platforms/teams/index'

test('TeamsClient is exported from barrel', () => {
  expect(typeof TeamsClient).toBe('function')
})

test('TeamsError is exported from barrel', () => {
  expect(typeof TeamsError).toBe('function')
})

test('TeamsCredentialManager is exported from barrel', () => {
  expect(typeof TeamsCredentialManager).toBe('function')
})

test('createTeamsClient is exported from barrel', () => {
  expect(typeof createTeamsClient).toBe('function')
})

test('TeamsTeamSchema is exported from barrel', () => {
  expect(typeof TeamsTeamSchema.parse).toBe('function')
})

test('TeamsChannelSchema is exported from barrel', () => {
  expect(typeof TeamsChannelSchema.parse).toBe('function')
})

test('TeamsMessageSchema is exported from barrel', () => {
  expect(typeof TeamsMessageSchema.parse).toBe('function')
})

test('TeamsUserSchema is exported from barrel', () => {
  expect(typeof TeamsUserSchema.parse).toBe('function')
})

test('TeamsReactionSchema is exported from barrel', () => {
  expect(typeof TeamsReactionSchema.parse).toBe('function')
})

test('TeamsFileSchema is exported from barrel', () => {
  expect(typeof TeamsFileSchema.parse).toBe('function')
})

test('TeamsCredentialsSchema is exported from barrel', () => {
  expect(typeof TeamsCredentialsSchema.parse).toBe('function')
})

test('TeamsAccountTypeSchema is exported from barrel', () => {
  expect(typeof TeamsAccountTypeSchema.parse).toBe('function')
})

test('TeamsAccountSchema is exported from barrel', () => {
  expect(typeof TeamsAccountSchema.parse).toBe('function')
})

test('TeamsConfigSchema is exported from barrel', () => {
  expect(typeof TeamsConfigSchema.parse).toBe('function')
})

test('TeamsConfigLegacySchema is exported from barrel', () => {
  expect(typeof TeamsConfigLegacySchema.parse).toBe('function')
})
