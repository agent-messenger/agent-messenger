export const TEAMS_COMPANION_REQUIRED =
  'On macOS, Teams operations must use the signed Agent Messenger Teams Bridge dispatcher.'

export function assertTeamsOperatorBoundary(
  platform: NodeJS.Platform = process.platform,
  companionMediated = process.env.AGENT_TEAMS_COMPANION_MEDIATED,
): void {
  if (platform === 'darwin' && companionMediated !== '1') {
    throw new Error(TEAMS_COMPANION_REQUIRED)
  }
}
