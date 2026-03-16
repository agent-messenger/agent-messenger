import { afterEach, beforeEach, expect, spyOn, test } from 'bun:test'

import { DiscordClient } from '../client'
import { DiscordCredentialManager } from '../credential-manager'

let clientGetRelationshipsSpy: ReturnType<typeof spyOn>
let credManagerLoadSpy: ReturnType<typeof spyOn>

beforeEach(() => {
  clientGetRelationshipsSpy = spyOn(DiscordClient.prototype, 'getRelationships').mockResolvedValue([
    {
      id: 'rel-1',
      type: 1,
      user: {
        id: 'user-1',
        username: 'alice',
        global_name: 'Alice Smith',
        avatar: 'avatar-hash-1',
      },
      nickname: 'Ally',
    },
    {
      id: 'rel-2',
      type: 1,
      user: {
        id: 'user-2',
        username: 'bob',
        global_name: 'Bob Jones',
        avatar: 'avatar-hash-2',
      },
    },
    {
      id: 'rel-3',
      type: 3,
      user: {
        id: 'user-3',
        username: 'charlie',
        global_name: 'Charlie Brown',
        avatar: 'avatar-hash-3',
      },
    },
    {
      id: 'rel-4',
      type: 2,
      user: {
        id: 'user-4',
        username: 'blocked_user',
        avatar: 'avatar-hash-4',
      },
    },
  ])

  credManagerLoadSpy = spyOn(DiscordCredentialManager.prototype, 'load').mockResolvedValue({
    token: 'test-token',
    current_server: null,
    servers: {},
  })
})

afterEach(() => {
  clientGetRelationshipsSpy?.mockRestore()
  credManagerLoadSpy?.mockRestore()
})

test('list: returns all relationships', async () => {
  // given: discord client with relationships
  const client = new DiscordClient('test-token')
  const relationships = await client.getRelationships()

  // when: getting all relationships
  expect(relationships).toBeDefined()

  // then: all relationships are returned
  expect(relationships).toHaveLength(4)
})

test('list: includes relationship metadata', async () => {
  // given: discord client with relationships
  const client = new DiscordClient('test-token')
  const relationships = await client.getRelationships()

  // when: checking relationship properties
  const relationship = relationships[0]

  // then: relationship has id, type, user
  expect(relationship.id).toBeDefined()
  expect(relationship.type).toBeDefined()
  expect(relationship.user).toBeDefined()
  expect(relationship.user.id).toBeDefined()
  expect(relationship.user.username).toBeDefined()
})

test('list: filters friends (type=1)', async () => {
  // given: discord client with relationships
  const client = new DiscordClient('test-token')
  const relationships = await client.getRelationships()

  // when: filtering friends
  const friends = relationships.filter((r) => r.type === 1)

  // then: only friends are returned
  expect(friends).toHaveLength(2)
  expect(friends[0].user.username).toBe('alice')
  expect(friends[1].user.username).toBe('bob')
})

test('list: includes optional nickname', async () => {
  // given: discord client with relationships
  const client = new DiscordClient('test-token')
  const relationships = await client.getRelationships()

  // when: checking for nickname
  const withNickname = relationships.find((r) => r.nickname)
  const withoutNickname = relationships.find((r) => !r.nickname && r.type === 1)

  // then: nickname is optional
  expect(withNickname?.nickname).toBe('Ally')
  expect(withoutNickname?.nickname).toBeUndefined()
})

test('list: distinguishes relationship types', async () => {
  // given: discord client with relationships
  const client = new DiscordClient('test-token')
  const relationships = await client.getRelationships()

  // when: grouping by type
  const friends = relationships.filter((r) => r.type === 1)
  const blocked = relationships.filter((r) => r.type === 2)
  const incoming = relationships.filter((r) => r.type === 3)

  // then: types are correctly identified
  expect(friends).toHaveLength(2)
  expect(blocked).toHaveLength(1)
  expect(incoming).toHaveLength(1)
})
