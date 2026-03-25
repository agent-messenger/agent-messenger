import { Command } from 'commander'

import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'

import { SlackClient } from '../client'
import { CredentialManager } from '../credential-manager'

async function addAction(
  text: string,
  time: string,
  options: { user?: string; pretty?: boolean },
): Promise<void> {
  try {
    const credManager = new CredentialManager()
    const ws = await credManager.getWorkspace()

    if (!ws) {
      console.log(formatOutput({ error: 'No current workspace set. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    const timeValue = Number(time)
    if (!Number.isInteger(timeValue) || timeValue <= 0) {
      console.log(formatOutput({ error: 'Invalid time value. Use a Unix timestamp in seconds (e.g. 1700000000).' }, options.pretty))
      process.exit(1)
    }

    const client = await new SlackClient().login({ token: ws.token, cookie: ws.cookie })
    const reminder = await client.addReminder(text, timeValue, { user: options.user })

    console.log(formatOutput(reminder, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

async function listAction(options: { pretty?: boolean }): Promise<void> {
  try {
    const credManager = new CredentialManager()
    const ws = await credManager.getWorkspace()

    if (!ws) {
      console.log(formatOutput({ error: 'No current workspace set. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    const client = await new SlackClient().login({ token: ws.token, cookie: ws.cookie })
    const reminders = await client.listReminders()

    console.log(formatOutput(reminders, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

async function completeAction(reminderId: string, options: { pretty?: boolean }): Promise<void> {
  try {
    const credManager = new CredentialManager()
    const ws = await credManager.getWorkspace()

    if (!ws) {
      console.log(formatOutput({ error: 'No current workspace set. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    const client = await new SlackClient().login({ token: ws.token, cookie: ws.cookie })
    await client.completeReminder(reminderId)

    console.log(formatOutput({ success: true, reminder_id: reminderId }, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

async function deleteAction(reminderId: string, options: { pretty?: boolean }): Promise<void> {
  try {
    const credManager = new CredentialManager()
    const ws = await credManager.getWorkspace()

    if (!ws) {
      console.log(formatOutput({ error: 'No current workspace set. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    const client = await new SlackClient().login({ token: ws.token, cookie: ws.cookie })
    await client.deleteReminder(reminderId)

    console.log(formatOutput({ success: true, reminder_id: reminderId }, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

export const reminderCommand = new Command('reminder')
  .description('Reminder commands')
  .addCommand(
    new Command('add')
      .description('Add a reminder')
      .argument('<text>', 'Reminder text')
      .argument('<time>', 'Unix timestamp for when to remind')
      .option('--user <user>', 'User ID to remind (defaults to current user)')
      .option('--pretty', 'Pretty print JSON output')
      .action(addAction),
  )
  .addCommand(
    new Command('list')
      .description('List all reminders')
      .option('--pretty', 'Pretty print JSON output')
      .action(listAction),
  )
  .addCommand(
    new Command('complete')
      .description('Mark a reminder as complete')
      .argument('<reminder-id>', 'Reminder ID')
      .option('--pretty', 'Pretty print JSON output')
      .action(completeAction),
  )
  .addCommand(
    new Command('delete')
      .description('Delete a reminder')
      .argument('<reminder-id>', 'Reminder ID')
      .option('--pretty', 'Pretty print JSON output')
      .action(deleteAction),
  )
