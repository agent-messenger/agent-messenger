import { Command } from 'commander'

import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'

import { SlackClient } from '../client'
import { CredentialManager } from '../credential-manager'

async function addAction(
  channel: string,
  title: string,
  link: string,
  options: { emoji?: string; type?: string; pretty?: boolean },
): Promise<void> {
  try {
    const credManager = new CredentialManager()
    const ws = await credManager.getWorkspace()

    if (!ws) {
      console.log(formatOutput({ error: 'No current workspace set. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    const client = await new SlackClient().login({ token: ws.token, cookie: ws.cookie })
    channel = await client.resolveChannel(channel)
    const bookmark = await client.addBookmark(channel, title, link, {
      emoji: options.emoji,
      type: options.type,
    })

    console.log(formatOutput(bookmark, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

async function editAction(
  channel: string,
  bookmarkId: string,
  options: { title?: string; link?: string; emoji?: string; pretty?: boolean },
): Promise<void> {
  try {
    const credManager = new CredentialManager()
    const ws = await credManager.getWorkspace()

    if (!ws) {
      console.log(formatOutput({ error: 'No current workspace set. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    if (!options.title && !options.link && !options.emoji) {
      console.log(formatOutput({ error: 'At least one of --title, --link, or --emoji is required.' }, options.pretty))
      process.exit(1)
    }

    const client = await new SlackClient().login({ token: ws.token, cookie: ws.cookie })
    channel = await client.resolveChannel(channel)
    const bookmark = await client.editBookmark(channel, bookmarkId, {
      title: options.title,
      link: options.link,
      emoji: options.emoji,
    })

    console.log(formatOutput(bookmark, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

async function removeAction(channel: string, bookmarkId: string, options: { pretty?: boolean }): Promise<void> {
  try {
    const credManager = new CredentialManager()
    const ws = await credManager.getWorkspace()

    if (!ws) {
      console.log(formatOutput({ error: 'No current workspace set. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    const client = await new SlackClient().login({ token: ws.token, cookie: ws.cookie })
    channel = await client.resolveChannel(channel)
    await client.removeBookmark(channel, bookmarkId)

    console.log(formatOutput({ success: true, channel, bookmark_id: bookmarkId }, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

async function listAction(channel: string, options: { pretty?: boolean }): Promise<void> {
  try {
    const credManager = new CredentialManager()
    const ws = await credManager.getWorkspace()

    if (!ws) {
      console.log(formatOutput({ error: 'No current workspace set. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    const client = await new SlackClient().login({ token: ws.token, cookie: ws.cookie })
    channel = await client.resolveChannel(channel)
    const bookmarks = await client.listBookmarks(channel)

    console.log(formatOutput(bookmarks, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

export const bookmarkCommand = new Command('bookmark')
  .description('Bookmark commands')
  .addCommand(
    new Command('add')
      .description('Add a bookmark to a channel')
      .argument('<channel>', 'Channel ID or name')
      .argument('<title>', 'Bookmark title')
      .argument('<link>', 'Bookmark URL')
      .option('--emoji <emoji>', 'Emoji for the bookmark')
      .option('--type <type>', 'Bookmark type (default: link)')
      .option('--pretty', 'Pretty print JSON output')
      .action(addAction),
  )
  .addCommand(
    new Command('edit')
      .description('Edit a bookmark in a channel')
      .argument('<channel>', 'Channel ID or name')
      .argument('<bookmark-id>', 'Bookmark ID')
      .option('--title <title>', 'New title')
      .option('--link <link>', 'New URL')
      .option('--emoji <emoji>', 'New emoji')
      .option('--pretty', 'Pretty print JSON output')
      .action(editAction),
  )
  .addCommand(
    new Command('remove')
      .description('Remove a bookmark from a channel')
      .argument('<channel>', 'Channel ID or name')
      .argument('<bookmark-id>', 'Bookmark ID')
      .option('--pretty', 'Pretty print JSON output')
      .action(removeAction),
  )
  .addCommand(
    new Command('list')
      .description('List bookmarks in a channel')
      .argument('<channel>', 'Channel ID or name')
      .option('--pretty', 'Pretty print JSON output')
      .action(listAction),
  )
