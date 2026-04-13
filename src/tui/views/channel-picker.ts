import blessed from 'blessed'

import type { UnifiedChannel } from '../adapters/types'
import { fuzzyMatch } from '../utils'

export class ChannelPicker {
  private screen: blessed.Widgets.Screen
  private overlay: blessed.Widgets.BoxElement
  private searchInput: blessed.Widgets.TextboxElement
  private resultsList: blessed.Widgets.ListElement
  private allChannels: UnifiedChannel[] = []
  private filteredChannels: UnifiedChannel[] = []
  private onSelectCallback: ((channel: UnifiedChannel) => void) | null = null
  private active = false

  constructor(screen: blessed.Widgets.Screen) {
    this.screen = screen

    this.overlay = blessed.box({
      parent: screen,
      top: 'center',
      left: 'center',
      width: '60%',
      height: '60%',
      border: { type: 'line' },
      style: {
        border: { fg: 'blue' },
        bg: 'black',
      },
      hidden: true,
      label: ' Switch Channel (Ctrl+K) ',
    })

    this.searchInput = blessed.textbox({
      parent: this.overlay,
      top: 0,
      left: 0,
      right: 0,
      height: 3,
      border: { type: 'line' },
      style: {
        border: { fg: 'gray' },
        fg: 'white',
        focus: { border: { fg: 'blue' } },
      },
      inputOnFocus: true,
      label: ' Search ',
    })

    this.resultsList = blessed.list({
      parent: this.overlay,
      top: 3,
      left: 0,
      right: 0,
      bottom: 0,
      style: {
        selected: { bg: 'blue', fg: 'white', bold: true },
        item: { fg: 'white' },
      },
      keys: true,
      vi: true,
      mouse: true,
    })

    this.searchInput.on('keypress', (_ch: string, key: blessed.Widgets.Events.IKeyEventArg) => {
      if (key.name === 'escape') {
        this.close()
        return
      }
      if (key.name === 'down' || (key.ctrl && key.name === 'n')) {
        this.resultsList.down(1)
        this.screen.render()
        return
      }
      if (key.name === 'up' || (key.ctrl && key.name === 'p')) {
        this.resultsList.up(1)
        this.screen.render()
        return
      }
      if (key.name === 'enter' || key.name === 'return') {
        const selectedIndex = (this.resultsList as any).selected as number
        const channel = this.filteredChannels[selectedIndex]
        if (channel && this.onSelectCallback) {
          this.onSelectCallback(channel)
        }
        this.close()
        return
      }

      process.nextTick(() => {
        const query = this.searchInput.getValue()
        this.filterChannels(query)
      })
    })

    this.resultsList.on('select', (_item: blessed.Widgets.BlessedElement, index: number) => {
      const channel = this.filteredChannels[index]
      if (channel && this.onSelectCallback) {
        this.onSelectCallback(channel)
      }
      this.close()
    })

    this.resultsList.key(['escape'], () => {
      this.close()
    })
  }

  open(channels: UnifiedChannel[], onSelect: (channel: UnifiedChannel) => void): void {
    this.allChannels = channels
    this.filteredChannels = [...channels]
    this.onSelectCallback = onSelect
    this.active = true

    this.searchInput.clearValue()
    this.resultsList.setItems(channels.map((ch) => ch.name) as any)
    this.resultsList.select(0)

    this.overlay.show()
    this.overlay.setFront()
    this.searchInput.focus()
    this.screen.render()
  }

  close(): void {
    this.active = false
    this.overlay.hide()
    this.onSelectCallback = null
    this.screen.render()
  }

  isActive(): boolean {
    return this.active
  }

  private filterChannels(query: string): void {
    if (!query) {
      this.filteredChannels = [...this.allChannels]
    } else {
      this.filteredChannels = this.allChannels.filter((ch) => fuzzyMatch(query, ch.name))
    }
    this.resultsList.setItems(this.filteredChannels.map((ch) => ch.name) as any)
    this.resultsList.select(0)
    this.screen.render()
  }
}
