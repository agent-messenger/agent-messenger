import blessed from 'blessed'

import { fuzzyMatch } from '../utils'
import type { Workspace } from '../adapters/types'

export class WorkspacePicker {
  private screen: blessed.Widgets.Screen
  private overlay: blessed.Widgets.BoxElement
  private searchInput: blessed.Widgets.TextboxElement
  private resultsList: blessed.Widgets.ListElement
  private allWorkspaces: Workspace[] = []
  private filteredWorkspaces: Workspace[] = []
  private onSelectCallback: ((workspace: Workspace) => void) | null = null
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
        border: { fg: 'yellow' },
        bg: 'black',
      },
      hidden: true,
      label: ' Switch Workspace (Ctrl+W) ',
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
        focus: { border: { fg: 'yellow' } },
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
        selected: { bg: 'yellow', fg: 'black', bold: true },
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
        const workspace = this.filteredWorkspaces[selectedIndex]
        if (workspace && this.onSelectCallback) {
          this.onSelectCallback(workspace)
        }
        this.close()
        return
      }

      process.nextTick(() => {
        const query = this.searchInput.getValue()
        this.filterWorkspaces(query)
      })
    })

    this.resultsList.on('select', (_item: blessed.Widgets.BlessedElement, index: number) => {
      const workspace = this.filteredWorkspaces[index]
      if (workspace && this.onSelectCallback) {
        this.onSelectCallback(workspace)
      }
      this.close()
    })

    this.resultsList.key(['escape'], () => {
      this.close()
    })
  }

  open(workspaces: Workspace[], onSelect: (workspace: Workspace) => void): void {
    this.allWorkspaces = workspaces
    this.filteredWorkspaces = [...workspaces]
    this.onSelectCallback = onSelect
    this.active = true

    this.searchInput.clearValue()
    this.resultsList.setItems(workspaces.map((ws) => ws.name) as any)
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

  private filterWorkspaces(query: string): void {
    if (!query) {
      this.filteredWorkspaces = [...this.allWorkspaces]
    } else {
      this.filteredWorkspaces = this.allWorkspaces.filter((ws) => fuzzyMatch(query, ws.name))
    }
    this.resultsList.setItems(this.filteredWorkspaces.map((ws) => ws.name) as any)
    this.resultsList.select(0)
    this.screen.render()
  }
}
