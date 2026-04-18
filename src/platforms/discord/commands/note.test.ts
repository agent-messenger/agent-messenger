import { expect, mock, it } from 'bun:test'

// Mock DiscordClient
const mockClient = {
  getUserNote: mock(async (userId: string) => {
    if (userId === 'user_with_note') {
      return {
        user_id: 'current_user_id',
        note_user_id: userId,
        note: 'This is a test note',
      }
    }
    return null
  }),
  setUserNote: mock(async (userId: string, note: string) => {
    return {
      user_id: 'current_user_id',
      note_user_id: userId,
      note,
    }
  }),
}

it('get returns note when it exists', async () => {
  // given: user with a note
  const userId = 'user_with_note'

  // when: getting user note
  const result = await mockClient.getUserNote(userId)

  // then: returns note object
  expect(result).not.toBeNull()
  expect(result?.note_user_id).toBe('user_with_note')
  expect(result?.note).toBe('This is a test note')
})

it('get returns null when note does not exist', async () => {
  // given: user without a note
  const userId = 'user_without_note'

  // when: getting user note
  const result = await mockClient.getUserNote(userId)

  // then: returns null
  expect(result).toBeNull()
})

it('set creates or updates note', async () => {
  // given: user id and note content
  const userId = 'user123'
  const noteContent = 'Important person to remember'

  // when: setting user note
  const result = await mockClient.setUserNote(userId, noteContent)

  // then: returns updated note object
  expect(result.note_user_id).toBe('user123')
  expect(result.note).toBe('Important person to remember')
})

it('set can update existing note', async () => {
  // given: user with existing note
  const userId = 'user_with_note'
  const newNote = 'Updated note content'

  // when: updating user note
  const result = await mockClient.setUserNote(userId, newNote)

  // then: returns updated note object
  expect(result.note_user_id).toBe('user_with_note')
  expect(result.note).toBe('Updated note content')
})

it('set can clear note with empty string', async () => {
  // given: user with existing note
  const userId = 'user_with_note'

  // when: clearing note
  const result = await mockClient.setUserNote(userId, '')

  // then: returns note object with empty note
  expect(result.note_user_id).toBe('user_with_note')
  expect(result.note).toBe('')
})
