import { expect, it } from 'bun:test'

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
} from '@/platforms/teams/index'

it('TeamsClient is exported from barrel', () => {
  expect(typeof TeamsClient).toBe('function')
})

it('TeamsError is exported from barrel', () => {
  expect(typeof TeamsError).toBe('function')
})

it('TeamsCredentialManager is exported from barrel', () => {
  expect(typeof TeamsCredentialManager).toBe('function')
})

it('TeamsTeamSchema is exported from barrel', () => {
  expect(typeof TeamsTeamSchema.parse).toBe('function')
})

it('TeamsChannelSchema is exported from barrel', () => {
  expect(typeof TeamsChannelSchema.parse).toBe('function')
})

it('TeamsMessageSchema is exported from barrel', () => {
  expect(typeof TeamsMessageSchema.parse).toBe('function')
})

it('TeamsUserSchema is exported from barrel', () => {
  expect(typeof TeamsUserSchema.parse).toBe('function')
})

it('TeamsReactionSchema is exported from barrel', () => {
  expect(typeof TeamsReactionSchema.parse).toBe('function')
})

it('TeamsFileSchema is exported from barrel', () => {
  expect(typeof TeamsFileSchema.parse).toBe('function')
})

it('TeamsCredentialsSchema is exported from barrel', () => {
  expect(typeof TeamsCredentialsSchema.parse).toBe('function')
})

it('TeamsAccountTypeSchema is exported from barrel', () => {
  expect(typeof TeamsAccountTypeSchema.parse).toBe('function')
})

it('TeamsAccountSchema is exported from barrel', () => {
  expect(typeof TeamsAccountSchema.parse).toBe('function')
})

it('TeamsConfigSchema is exported from barrel', () => {
  expect(typeof TeamsConfigSchema.parse).toBe('function')
})

it('TeamsConfigLegacySchema is exported from barrel', () => {
  expect(typeof TeamsConfigLegacySchema.parse).toBe('function')
})
