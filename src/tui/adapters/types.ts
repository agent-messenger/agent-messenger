export interface UnifiedChannel {
  id: string
  name: string
  parentId?: string
}

export interface UnifiedMessage {
  id: string
  channelId: string
  author: string
  content: string
  timestamp: string
}

export interface Workspace {
  id: string
  name: string
}

export interface AuthHint {
  command: string
  description: string
}

export interface AuthIO {
  print(message: string): void
  prompt(label: string, options?: { secret?: boolean }): Promise<string>
}

export interface PlatformAdapter {
  readonly name: string
  login(): Promise<void>
  getChannels(): Promise<UnifiedChannel[]>
  getMessages(channelId: string, limit?: number): Promise<UnifiedMessage[]>
  sendMessage(channelId: string, text: string): Promise<void>
  startListening?(onMessage: (msg: UnifiedMessage) => void): Promise<void>
  stopListening?(): void
  getWorkspaces?(): Promise<Workspace[]>
  switchWorkspace?(workspaceId: string): Promise<void>
  getCurrentWorkspace?(): Workspace | null
  getAuthHint(): AuthHint
  authenticate(io: AuthIO): Promise<void>
}
