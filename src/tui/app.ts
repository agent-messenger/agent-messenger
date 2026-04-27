import blessed from 'blessed'

import type { AuthIO, PlatformAdapter, UnifiedChannel, UnifiedMessage, Workspace } from './adapters/types'
import { formatTimestamp } from './utils'
import { ChannelPicker } from './views/channel-picker'
import { WorkspacePicker } from './views/workspace-picker'

type PlatformAdapterFactory = () => Promise<PlatformAdapter>

class LazyPlatformAdapter implements PlatformAdapter {
  readonly name: string
  private adapter: PlatformAdapter | null = null
  private loadPromise: Promise<PlatformAdapter> | null = null

  constructor(
    name: string,
    private readonly fallbackAuthHint: string,
    private readonly factory: PlatformAdapterFactory,
  ) {
    this.name = name
  }

  private async load(): Promise<PlatformAdapter> {
    if (this.adapter) return this.adapter
    this.loadPromise ??= this.factory()
      .then((adapter) => {
        this.adapter = adapter
        return adapter
      })
      .catch((error: unknown) => {
        this.loadPromise = null
        throw error
      })
    return this.loadPromise
  }

  async login(): Promise<void> {
    await (await this.load()).login()
  }

  async getChannels(): Promise<UnifiedChannel[]> {
    return (await this.load()).getChannels()
  }

  async getMessages(channelId: string, limit?: number): Promise<UnifiedMessage[]> {
    return (await this.load()).getMessages(channelId, limit)
  }

  async sendMessage(channelId: string, text: string): Promise<void> {
    await (await this.load()).sendMessage(channelId, text)
  }

  async startListening(onMessage: (msg: UnifiedMessage) => void): Promise<void> {
    const adapter = await this.load()
    await adapter.startListening?.(onMessage)
  }

  stopListening(): void {
    this.adapter?.stopListening?.()
  }

  async getWorkspaces(): Promise<Workspace[]> {
    return (await this.load()).getWorkspaces?.() ?? []
  }

  async switchWorkspace(workspaceId: string): Promise<void> {
    await (await this.load()).switchWorkspace?.(workspaceId)
  }

  getCurrentWorkspace(): Workspace | null {
    return this.adapter?.getCurrentWorkspace?.() ?? null
  }

  getAuthHint() {
    return this.adapter?.getAuthHint() ?? { command: this.fallbackAuthHint, description: `Authenticate ${this.name}` }
  }

  async authenticate(io: AuthIO): Promise<void> {
    await (await this.load()).authenticate(io)
  }
}

function lazyAdapter(name: string, fallbackAuthHint: string, factory: PlatformAdapterFactory): PlatformAdapter {
  return new LazyPlatformAdapter(name, fallbackAuthHint, factory)
}

type AppMode = 'selection' | 'read' | 'write' | 'auth'
type NavLevel = 'platform' | 'workspace' | 'channel'

interface PlatformState {
  adapter: PlatformAdapter
  label: string
  enabled: boolean
  channels: UnifiedChannel[] | null
  workspaces: Workspace[] | null
  listening: boolean
  lastChannelId: string | null
}

export async function createApp(): Promise<void> {
  let mode: AppMode = 'selection'
  let navLevel: NavLevel = 'platform'
  let activePlatformIndex = -1
  let activeChannelId: string | null = null

  const platformStates: PlatformState[] = [
    {
      adapter: lazyAdapter(
        'Slack',
        'agent-slack auth extract',
        async () => new (await import('./adapters/slack-adapter')).SlackAdapter(),
      ),
      label: 'Slack',
      enabled: false,
      channels: null,
      workspaces: null,
      listening: false,
      lastChannelId: null,
    },
    {
      adapter: lazyAdapter(
        'Discord',
        'agent-discord auth extract',
        async () => new (await import('./adapters/discord-adapter')).DiscordAdapter(),
      ),
      label: 'Discord',
      enabled: false,
      channels: null,
      workspaces: null,
      listening: false,
      lastChannelId: null,
    },
    {
      adapter: lazyAdapter(
        'Teams',
        'agent-teams auth extract',
        async () => new (await import('./adapters/teams-adapter')).TeamsAdapter(),
      ),
      label: 'Teams',
      enabled: false,
      channels: null,
      workspaces: null,
      listening: false,
      lastChannelId: null,
    },
    {
      adapter: lazyAdapter(
        'Webex',
        'agent-webex auth extract',
        async () => new (await import('./adapters/webex-adapter')).WebexAdapter(),
      ),
      label: 'Webex',
      enabled: false,
      channels: null,
      workspaces: null,
      listening: false,
      lastChannelId: null,
    },
    {
      adapter: lazyAdapter(
        'Telegram',
        'agent-telegram auth login',
        async () => new (await import('./adapters/telegram-adapter')).TelegramAdapter(),
      ),
      label: 'Telegram',
      enabled: false,
      channels: null,
      workspaces: null,
      listening: false,
      lastChannelId: null,
    },
    {
      adapter: lazyAdapter(
        'WhatsApp',
        'agent-whatsapp auth login',
        async () => new (await import('./adapters/whatsapp-adapter')).WhatsAppAdapter(),
      ),
      label: 'WhatsApp',
      enabled: false,
      channels: null,
      workspaces: null,
      listening: false,
      lastChannelId: null,
    },
    {
      adapter: lazyAdapter(
        'LINE',
        'agent-line auth login',
        async () => new (await import('./adapters/line-adapter')).LineAdapter(),
      ),
      label: 'LINE',
      enabled: false,
      channels: null,
      workspaces: null,
      listening: false,
      lastChannelId: null,
    },
    {
      adapter: lazyAdapter(
        'Instagram',
        'agent-instagram auth login',
        async () => new (await import('./adapters/instagram-adapter')).InstagramAdapter(),
      ),
      label: 'Instagram',
      enabled: false,
      channels: null,
      workspaces: null,
      listening: false,
      lastChannelId: null,
    },
    {
      adapter: lazyAdapter(
        'KakaoTalk',
        'agent-kakaotalk auth extract',
        async () => new (await import('./adapters/kakaotalk-adapter')).KakaoTalkAdapter(),
      ),
      label: 'KakaoTalk',
      enabled: false,
      channels: null,
      workspaces: null,
      listening: false,
      lastChannelId: null,
    },
    {
      adapter: lazyAdapter(
        'Channel Talk',
        'agent-channeltalk auth extract',
        async () => new (await import('./adapters/channeltalk-adapter')).ChannelTalkAdapter(),
      ),
      label: 'Channel Talk',
      enabled: false,
      channels: null,
      workspaces: null,
      listening: false,
      lastChannelId: null,
    },
  ]

  const screen = blessed.screen({
    smartCSR: true,
    fullUnicode: true,
    title: 'Agent Messenger',
  })

  const header = blessed.box({
    parent: screen,
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    tags: true,
    style: { fg: 'white', bg: 'black' },
  })

  const sidebar = blessed.list({
    parent: screen,
    left: 0,
    top: 1,
    width: 28,
    height: '100%-4',
    border: { type: 'line' },
    style: {
      border: { fg: '#444444' },
      selected: { bg: 'blue', fg: 'white', bold: true },
      item: { fg: 'white' },
    },
    keys: true,
    mouse: true,
    scrollable: true,
    label: ' Platforms ',
  })

  const messageLog = blessed.log({
    parent: screen,
    left: 28,
    top: 1,
    right: 0,
    height: '100%-4',
    border: { type: 'line' },
    style: {
      border: { fg: '#444444' },
      fg: 'white',
    },
    tags: true,
    keys: true,
    scrollable: true,
    scrollbar: { style: { bg: 'blue' } },
    mouse: true,
    label: ' Messages ',
  })

  const inputBox = blessed.textarea({
    parent: screen,
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    border: { type: 'line' },
    style: {
      border: { fg: '#444444' },
      fg: 'white',
    },
    inputOnFocus: true,
    label: ' Message ',
  })

  const statusBar = blessed.box({
    parent: screen,
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
    tags: true,
    style: { fg: 'gray', bg: 'black' },
  })

  const channelPicker = new ChannelPicker(screen)
  const workspacePicker = new WorkspacePicker(screen)

  // --- Auth mode ---

  let authResolve: ((value: string) => void) | null = null
  let authReject: ((reason: Error) => void) | null = null

  function createAuthIO(): AuthIO {
    return {
      print(message: string): void {
        messageLog.log(message)
        screen.render()
      },
      prompt(label: string): Promise<string> {
        messageLog.log(`{yellow-fg}${label}:{/}`)
        inputBox.clearValue()
        inputBox.setLabel(` ${label} `)
        focusInput()
        screen.render()
        return new Promise<string>((resolve, reject) => {
          authResolve = resolve
          authReject = reject
        })
      },
    }
  }

  async function startAuth(platform: PlatformState, platformIndex: number): Promise<void> {
    mode = 'auth'
    messageLog.setLabel(` ${platform.label} `)
    messageLog.setContent('')
    messageLog.log(`{bold}Authenticating ${platform.label}...{/}`)
    screen.render()

    const io = createAuthIO()
    try {
      await platform.adapter.authenticate(io)
      platform.enabled = true
      activePlatformIndex = platformIndex
      messageLog.setContent('')
      messageLog.setLabel(' Messages ')
      inputBox.setLabel(' Message ')
      mode = 'selection'
      renderHeader()
      await showWorkspaceLevel()
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      if (detail !== 'Authentication cancelled') {
        messageLog.log(`{red-fg}Authentication failed: ${detail}{/}`)
      }
      mode = 'selection'
      inputBox.setLabel(' Message ')
      focusSidebar()
      renderAll()
    }
  }

  function enabledIndices(): number[] {
    return platformStates.map((p, i) => (p.enabled ? i : -1)).filter((i) => i >= 0)
  }

  function activePlatform(): PlatformState | null {
    return activePlatformIndex >= 0 ? platformStates[activePlatformIndex] : null
  }

  // --- Rendering ---

  function renderHeader(): void {
    const p = activePlatform()
    if (!p) {
      header.setContent(' {bold}Agent Messenger{/}')
      return
    }
    const parts: string[] = [p.label]
    const ws = p.adapter.getCurrentWorkspace?.()
    if (ws) parts.push(ws.name)
    const channel = p.channels?.find((ch) => ch.id === activeChannelId)
    if (channel) parts.push(channel.name)
    header.setContent(` {bold}${parts.join(' \u203A ')}{/}`)
  }

  function renderStatusBar(): void {
    if (mode === 'selection') {
      const hints: string[] = ['{gray-fg}\u2191\u2193{/}: Navigate']
      if (navLevel === 'platform') {
        hints.push('{gray-fg}Enter{/}: Select')
      } else {
        hints.push('{gray-fg}Enter/\u2192{/}: Select', '{gray-fg}\u2190/Esc{/}: Back')
      }
      if (activeChannelId) {
        hints.push('{gray-fg}Esc{/}: Read')
      }
      hints.push('{gray-fg}Ctrl+C{/}: Quit')
      statusBar.setContent(' ' + hints.join('  '))
    } else if (mode === 'auth') {
      statusBar.setContent(' {gray-fg}Enter{/}: Submit  {gray-fg}Esc{/}: Cancel  {gray-fg}Ctrl+C{/}: Quit')
    } else if (mode === 'read') {
      statusBar.setContent(
        ' {gray-fg}Enter{/}: Write  {gray-fg}Esc{/}: Selection  {gray-fg}Ctrl+K{/}: Channel  {gray-fg}Ctrl+W{/}: Workspace  {gray-fg}Ctrl+C{/}: Quit',
      )
    } else {
      statusBar.setContent(
        ' {gray-fg}Enter{/}: Send  {gray-fg}Esc{/}: Read  {gray-fg}Ctrl+K{/}: Channel  {gray-fg}Ctrl+W{/}: Workspace  {gray-fg}Ctrl+C{/}: Quit',
      )
    }
  }

  function renderAll(): void {
    renderHeader()
    renderStatusBar()
    screen.render()
  }

  // --- Focus management ---

  function applyFocusStyle(widget: blessed.Widgets.BlessedElement, focused: boolean): void {
    widget.style.border.fg = focused ? 'blue' : '#444444'
  }

  function focusSidebar(): void {
    applyFocusStyle(sidebar, true)
    applyFocusStyle(messageLog, false)
    applyFocusStyle(inputBox, false)
    sidebar.focus()
  }

  function focusMessages(): void {
    applyFocusStyle(sidebar, false)
    applyFocusStyle(messageLog, true)
    applyFocusStyle(inputBox, false)
    messageLog.focus()
  }

  function focusInput(): void {
    applyFocusStyle(sidebar, false)
    applyFocusStyle(messageLog, false)
    applyFocusStyle(inputBox, true)
    inputBox.focus()
  }

  // --- Sidebar population ---

  async function showPlatformLevel(): Promise<void> {
    navLevel = 'platform'
    sidebar.setLabel(' Platforms ')
    const items = platformStates.map((p, i) => {
      const marker = i === activePlatformIndex ? '\u25B6 ' : '  '
      return p.enabled ? `${marker}${p.label}` : `${marker}${p.label} (offline)`
    })
    sidebar.setItems(items as any)
    const activeInList = activePlatformIndex >= 0 ? activePlatformIndex : 0
    sidebar.select(activeInList)
    renderAll()
  }

  async function showWorkspaceLevel(): Promise<void> {
    const p = activePlatform()
    if (!p || !p.adapter.getWorkspaces) {
      await showChannelLevel()
      return
    }
    if (!p.workspaces) {
      sidebar.setLabel(` ${p.label} \u203A Workspaces `)
      sidebar.setItems(['Loading...' as any])
      screen.render()
      try {
        p.workspaces = await p.adapter.getWorkspaces()
      } catch {
        p.workspaces = []
      }
    }
    if (p.workspaces.length <= 1) {
      await showChannelLevel()
      return
    }
    navLevel = 'workspace'
    sidebar.setLabel(` ${p.label} \u203A Workspaces `)
    const currentWs = p.adapter.getCurrentWorkspace?.()
    const items = p.workspaces.map((ws) => {
      const marker = currentWs && ws.id === currentWs.id ? '\u25B6 ' : '  '
      return `${marker}${ws.name}`
    })
    sidebar.setItems(items as any)
    const currentIdx = currentWs ? p.workspaces.findIndex((ws) => ws.id === currentWs.id) : 0
    sidebar.select(Math.max(0, currentIdx))
    renderAll()
  }

  async function showChannelLevel(): Promise<void> {
    const p = activePlatform()
    if (!p) return
    navLevel = 'channel'
    const wsLabel = p.adapter.getCurrentWorkspace?.()?.name
    sidebar.setLabel(wsLabel ? ` ${p.label}:${wsLabel} \u203A Channels ` : ` ${p.label} \u203A Channels `)

    if (!p.channels) {
      sidebar.setItems(['Loading...' as any])
      screen.render()
      try {
        p.channels = await p.adapter.getChannels()
      } catch {
        p.channels = []
      }
    }

    const items = p.channels.map((ch) => {
      const marker = ch.id === activeChannelId ? '\u25B6 ' : '  '
      return `${marker}${ch.name}`
    })
    sidebar.setItems(items as any)
    const currentIdx = activeChannelId ? p.channels.findIndex((ch) => ch.id === activeChannelId) : 0
    sidebar.select(Math.max(0, currentIdx))
    renderAll()
  }

  // --- Mode transitions ---

  function enterSelectionMode(level?: NavLevel): void {
    mode = 'selection'
    inputBox.cancel()
    focusSidebar()

    if (level) {
      switch (level) {
        case 'platform':
          showPlatformLevel()
          break
        case 'workspace':
          showWorkspaceLevel()
          break
        case 'channel':
          showChannelLevel()
          break
      }
    } else {
      if (activePlatformIndex >= 0) {
        showChannelLevel()
      } else {
        showPlatformLevel()
      }
    }
  }

  function enterReadMode(): void {
    if (!activeChannelId) return
    mode = 'read'
    const p = activePlatform()
    const wsLabel = p?.adapter.getCurrentWorkspace?.()?.name
    sidebar.setLabel(wsLabel ? ` ${p?.label}:${wsLabel} ` : ` ${p?.label} `)

    if (p?.channels) {
      const items = p.channels.map((ch) => {
        const marker = ch.id === activeChannelId ? '\u25B6 ' : '  '
        return `${marker}${ch.name}`
      })
      sidebar.setItems(items as any)
    }

    focusMessages()
    renderAll()
  }

  function enterWriteMode(): void {
    if (!activeChannelId) return
    mode = 'write'
    focusInput()
    renderAll()
  }

  // --- Messages ---

  function appendMessage(msg: UnifiedMessage): void {
    const time = formatTimestamp(msg.timestamp)
    messageLog.log(`{gray-fg}${time}{/gray-fg} {bold}{cyan-fg}${msg.author}{/cyan-fg}{/bold} ${msg.content}`)
    screen.render()
  }

  async function loadChannel(channelId: string): Promise<void> {
    const p = activePlatform()
    if (!p) return

    activeChannelId = channelId
    p.lastChannelId = channelId
    messageLog.setContent('')

    const channel = p.channels?.find((ch) => ch.id === channelId)
    messageLog.setLabel(channel ? ` ${channel.name} ` : ' Messages ')
    screen.render()

    try {
      const messages = await p.adapter.getMessages(channelId)
      for (const msg of messages) appendMessage(msg)
    } catch (err) {
      messageLog.log(`{red-fg}Error: ${err}{/red-fg}`)
    }

    if (!p.listening && p.adapter.startListening) {
      try {
        await p.adapter.startListening((msg) => {
          if (msg.channelId === activeChannelId) appendMessage(msg)
        })
        p.listening = true
      } catch {}
    }

    screen.render()
  }

  // --- Selection mode navigation ---

  async function drillDown(): Promise<void> {
    const selectedIndex = (sidebar as any).selected as number

    switch (navLevel) {
      case 'platform': {
        const selected = platformStates[selectedIndex]
        if (!selected) return
        if (!selected.enabled) {
          startAuth(selected, selectedIndex)
          return
        }
        activePlatformIndex = selectedIndex
        renderHeader()
        await showWorkspaceLevel()
        break
      }
      case 'workspace': {
        const p = activePlatform()
        if (!p?.workspaces?.[selectedIndex]) return
        const ws = p.workspaces[selectedIndex]
        try {
          await p.adapter.switchWorkspace?.(ws.id)
          p.channels = null
          renderHeader()
        } catch {}
        await showChannelLevel()
        break
      }
      case 'channel': {
        const p = activePlatform()
        if (!p?.channels?.[selectedIndex]) return
        const channel = p.channels[selectedIndex]
        await loadChannel(channel.id)
        enterReadMode()
        break
      }
    }
  }

  async function drillUp(): Promise<void> {
    switch (navLevel) {
      case 'channel': {
        const p = activePlatform()
        const hasWorkspaces = p?.workspaces && p.workspaces.length > 1
        if (hasWorkspaces) {
          await showWorkspaceLevel()
        } else {
          await showPlatformLevel()
        }
        break
      }
      case 'workspace':
        await showPlatformLevel()
        break
      case 'platform':
        if (activeChannelId) enterReadMode()
        break
    }
  }

  // --- Key bindings ---

  sidebar.on('select', () => {
    if (mode === 'selection') drillDown()
  })

  sidebar.key(['right'], () => {
    if (mode === 'selection') drillDown()
  })

  sidebar.key(['left'], () => {
    if (mode === 'selection') drillUp()
  })

  screen.key(['tab'], () => {
    if (mode === 'auth' || channelPicker.isActive() || workspacePicker.isActive()) return
    if (mode === 'read') enterWriteMode()
    else if (mode === 'write') enterReadMode()
  })

  screen.key(['S-tab'], () => {
    if (mode === 'auth' || channelPicker.isActive() || workspacePicker.isActive()) return
    if (mode === 'write') enterReadMode()
    else if (mode === 'read') enterWriteMode()
  })

  screen.key(['escape'], () => {
    if (mode === 'auth' || channelPicker.isActive() || workspacePicker.isActive()) return
    if (mode === 'read') enterSelectionMode()
    else if (mode === 'selection') drillUp()
  })

  messageLog.key(['enter'], () => {
    if (mode === 'read') enterWriteMode()
  })

  screen.key(['C-k'], () => {
    if (mode === 'auth' || channelPicker.isActive() || workspacePicker.isActive()) return
    const p = activePlatform()
    if (!p?.channels?.length) return
    channelPicker.open(p.channels, async (channel) => {
      await loadChannel(channel.id)
      enterReadMode()
    })
  })

  screen.key(['C-w'], () => {
    if (mode === 'selection' || mode === 'auth' || channelPicker.isActive() || workspacePicker.isActive()) return
    const p = activePlatform()
    if (!p?.adapter.getWorkspaces) return
    p.adapter
      .getWorkspaces()
      .then((workspaces) => {
        if (workspaces.length <= 1) return
        workspacePicker.open(workspaces, (workspace) => {
          if (!p.adapter.switchWorkspace) return
          p.adapter
            .switchWorkspace(workspace.id)
            .then(() => {
              p.channels = null
              p.workspaces = null
              renderHeader()
              if (activeChannelId) {
                activeChannelId = null
                messageLog.setContent('')
                messageLog.setLabel(' Messages ')
              }
              enterSelectionMode('channel')
            })
            .catch(() => {})
        })
      })
      .catch(() => {})
  })

  inputBox.on('keypress', (_ch: string, key: blessed.Widgets.Events.IKeyEventArg) => {
    if (mode === 'auth') {
      if (key.name === 'escape') {
        inputBox.cancel()
        inputBox.clearValue()
        if (authReject) {
          const reject = authReject
          authResolve = null
          authReject = null
          reject(new Error('Authentication cancelled'))
        }
        return
      }
      if (key.name === 'enter' || key.name === 'return') {
        const value = inputBox.getValue().trim()
        inputBox.clearValue()
        screen.render()
        if (authResolve) {
          const resolve = authResolve
          authResolve = null
          authReject = null
          resolve(value)
        }
        return
      }
      return
    }
    if (key.name === 'escape') {
      inputBox.cancel()
      enterReadMode()
      return
    }
    if (key.name === 'tab') {
      inputBox.cancel()
      enterReadMode()
      return
    }
    if (key.ctrl && key.name === 'k') {
      inputBox.cancel()
      const p = activePlatform()
      if (!p?.channels?.length) return
      channelPicker.open(p.channels, async (channel) => {
        await loadChannel(channel.id)
        enterReadMode()
      })
      return
    }
    if (key.name === 'enter' || key.name === 'return') {
      const text = inputBox.getValue().trim()
      if (text && activeChannelId) {
        const p = activePlatform()
        inputBox.clearValue()
        screen.render()
        p?.adapter
          .sendMessage(activeChannelId, text)
          .then(() => {
            if (!p?.listening) {
              appendMessage({
                id: Date.now().toString(),
                channelId: activeChannelId!,
                author: 'you',
                content: text,
                timestamp: (Date.now() / 1000).toString(),
              })
            }
          })
          .catch((err: unknown) => {
            const detail = err instanceof Error ? err.message : String(err)
            appendMessage({
              id: 'err',
              channelId: activeChannelId!,
              author: 'system',
              content: `{red-fg}Send failed: ${detail}{/red-fg}`,
              timestamp: (Date.now() / 1000).toString(),
            })
          })
      }
      return
    }
  })

  screen.key(['C-c'], () => {
    for (const p of platformStates) {
      p.adapter.stopListening?.()
    }
    screen.destroy()
    process.exit(0)
  })

  // --- Startup ---

  screen.render()
  header.setContent(' {yellow-fg}Connecting...{/}')
  screen.render()

  const origStdoutWrite = process.stdout.write.bind(process.stdout)
  const origStderrWrite = process.stderr.write.bind(process.stderr)
  process.stdout.write = (...args: any[]) => {
    const str = typeof args[0] === 'string' ? args[0] : ''
    if (str.includes('\x1b[')) return origStdoutWrite(...(args as [any, any, any]))
    return true
  }
  process.stderr.write = () => true
  const results = await Promise.allSettled(platformStates.map((p) => p.adapter.login()))
  process.stdout.write = origStdoutWrite
  process.stderr.write = origStderrWrite
  screen.alloc()
  screen.render()

  for (let i = 0; i < results.length; i++) {
    if (results[i].status === 'fulfilled') {
      platformStates[i].enabled = true
    }
  }

  const enabled = enabledIndices()
  if (enabled.length === 1) {
    activePlatformIndex = enabled[0]
    renderHeader()
    await showChannelLevel()
    focusSidebar()
    renderAll()
  } else {
    await showPlatformLevel()
    focusSidebar()
    renderAll()
  }
}
