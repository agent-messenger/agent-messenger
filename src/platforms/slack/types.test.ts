import { expect, test } from 'bun:test'

import {
  ConfigSchema,
  SlackChannelSchema,
  SlackFileSchema,
  SlackMessageSchema,
  SlackReactionSchema,
  SlackUserSchema,
  WorkspaceCredentialsSchema,
} from '@/platforms/slack/types'

test('SlackChannelSchema validates correct data', () => {
  const validChannel = {
    id: 'C123456',
    name: 'general',
    is_private: false,
    is_archived: false,
    created: 1234567890,
    creator: 'U123456',
  }
  expect(() => SlackChannelSchema.parse(validChannel)).not.toThrow()
})

test('SlackChannelSchema validates with optional fields', () => {
  const validChannel = {
    id: 'C123456',
    name: 'general',
    is_private: false,
    is_archived: false,
    created: 1234567890,
    creator: 'U123456',
    topic: {
      value: 'Channel topic',
      creator: 'U123456',
      last_set: 1234567890,
    },
    purpose: {
      value: 'Channel purpose',
      creator: 'U123456',
      last_set: 1234567890,
    },
  }
  expect(() => SlackChannelSchema.parse(validChannel)).not.toThrow()
})

test('SlackChannelSchema rejects missing required fields', () => {
  const invalidChannel = {
    id: 'C123456',
    name: 'general',
  }
  expect(() => SlackChannelSchema.parse(invalidChannel)).toThrow()
})

test('SlackMessageSchema validates correct data', () => {
  const validMessage = {
    ts: '1234567890.123456',
    text: 'Hello world',
    type: 'message',
  }
  expect(() => SlackMessageSchema.parse(validMessage)).not.toThrow()
})

test('SlackMessageSchema validates with optional fields', () => {
  const validMessage = {
    ts: '1234567890.123456',
    text: 'Hello world',
    user: 'U123456',
    username: 'john',
    type: 'message',
    thread_ts: '1234567890.123456',
    reply_count: 5,
    replies: [{ user: 'U123456', ts: '1234567890.123456' }],
    edited: {
      user: 'U123456',
      ts: '1234567890.123456',
    },
  }
  expect(() => SlackMessageSchema.parse(validMessage)).not.toThrow()
})

test('SlackMessageSchema validates with files', () => {
  const validMessage = {
    ts: '1234567890.123456',
    text: 'Hello world',
    type: 'message',
    user: 'U123456',
    files: [
      {
        id: 'F123456',
        name: 'screenshot.png',
        title: 'Screenshot',
        mimetype: 'image/png',
        size: 2048,
        url_private: 'https://files.slack.com/...',
        created: 1234567890,
        user: 'U123456',
        channels: ['C123456'],
      },
    ],
  }
  expect(() => SlackMessageSchema.parse(validMessage)).not.toThrow()
})

test('SlackMessageSchema rejects missing required fields', () => {
  const invalidMessage = {
    ts: '1234567890.123456',
  }
  expect(() => SlackMessageSchema.parse(invalidMessage)).toThrow()
})

test('SlackUserSchema validates correct data', () => {
  const validUser = {
    id: 'U123456',
    name: 'john',
    real_name: 'John Doe',
    is_admin: false,
    is_owner: false,
    is_bot: false,
    is_app_user: false,
  }
  expect(() => SlackUserSchema.parse(validUser)).not.toThrow()
})

test('SlackUserSchema validates with optional profile', () => {
  const validUser = {
    id: 'U123456',
    name: 'john',
    real_name: 'John Doe',
    is_admin: false,
    is_owner: false,
    is_bot: false,
    is_app_user: false,
    profile: {
      email: 'john@example.com',
      phone: '555-1234',
      title: 'Engineer',
      status_text: 'Working from home',
    },
  }
  expect(() => SlackUserSchema.parse(validUser)).not.toThrow()
})

test('SlackUserSchema rejects missing required fields', () => {
  const invalidUser = {
    id: 'U123456',
    name: 'john',
  }
  expect(() => SlackUserSchema.parse(invalidUser)).toThrow()
})

test('SlackReactionSchema validates correct data', () => {
  const validReaction = {
    name: 'thumbsup',
    count: 3,
    users: ['U123456', 'U234567', 'U345678'],
  }
  expect(() => SlackReactionSchema.parse(validReaction)).not.toThrow()
})

test('SlackReactionSchema rejects invalid data', () => {
  const invalidReaction = {
    name: 'thumbsup',
    count: 'three',
    users: ['U123456'],
  }
  expect(() => SlackReactionSchema.parse(invalidReaction)).toThrow()
})

test('SlackFileSchema validates correct data', () => {
  const validFile = {
    id: 'F123456',
    name: 'document.pdf',
    title: 'My Document',
    mimetype: 'application/pdf',
    size: 1024,
    url_private: 'https://files.slack.com/...',
    created: 1234567890,
    user: 'U123456',
  }
  expect(() => SlackFileSchema.parse(validFile)).not.toThrow()
})

test('SlackFileSchema validates with optional channels', () => {
  const validFile = {
    id: 'F123456',
    name: 'document.pdf',
    title: 'My Document',
    mimetype: 'application/pdf',
    size: 1024,
    url_private: 'https://files.slack.com/...',
    created: 1234567890,
    user: 'U123456',
    channels: ['C123456', 'C234567'],
  }
  expect(() => SlackFileSchema.parse(validFile)).not.toThrow()
})

test('SlackFileSchema rejects missing required fields', () => {
  const invalidFile = {
    id: 'F123456',
    name: 'document.pdf',
  }
  expect(() => SlackFileSchema.parse(invalidFile)).toThrow()
})

test('WorkspaceCredentialsSchema validates correct data', () => {
  const validCredentials = {
    workspace_id: 'T123456',
    workspace_name: 'my-workspace',
    token: 'xoxb-...',
    cookie: 'session=...',
  }
  expect(() => WorkspaceCredentialsSchema.parse(validCredentials)).not.toThrow()
})

test('WorkspaceCredentialsSchema rejects missing fields', () => {
  const invalidCredentials = {
    workspace_id: 'T123456',
    workspace_name: 'my-workspace',
  }
  expect(() => WorkspaceCredentialsSchema.parse(invalidCredentials)).toThrow()
})

test('ConfigSchema validates correct data', () => {
  const validConfig = {
    current_workspace: 'T123456',
    workspaces: {
      T123456: {
        workspace_id: 'T123456',
        workspace_name: 'my-workspace',
        token: 'xoxb-...',
        cookie: 'session=...',
      },
    },
  }
  expect(() => ConfigSchema.parse(validConfig)).not.toThrow()
})

test('ConfigSchema validates with null current_workspace', () => {
  const validConfig = {
    current_workspace: null,
    workspaces: {
      T123456: {
        workspace_id: 'T123456',
        workspace_name: 'my-workspace',
        token: 'xoxb-...',
        cookie: 'session=...',
      },
    },
  }
  expect(() => ConfigSchema.parse(validConfig)).not.toThrow()
})

test('ConfigSchema rejects invalid workspace credentials', () => {
  const invalidConfig = {
    current_workspace: 'T123456',
    workspaces: {
      T123456: {
        workspace_id: 'T123456',
      },
    },
  }
  expect(() => ConfigSchema.parse(invalidConfig)).toThrow()
})
