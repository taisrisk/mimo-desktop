/**
 * Mimo Memory Panel
 * Shows persistent cross-session memories the agent has stored.
 * Users can pin (protect) or prune (delete) individual entries.
 */
import { createSignal, For, Show, type JSX } from "solid-js"
import { createStore, produce } from "solid-js/store"
import { IconButton } from "@mimo-ai/ui/icon-button"
import { Icon } from "@mimo-ai/ui/icon"

export type MemoryEntry = {
  id: string
  content: string
  tag: "user" | "feedback" | "project" | "reference"
  pinned?: boolean
  createdAt: number
}

type Props = {
  entries?: MemoryEntry[]
  onPin?: (id: string, pinned: boolean) => void
  onPrune?: (id: string) => void
}

const TAG_LABELS: Record<MemoryEntry["tag"], string> = {
  user: "User",
  feedback: "Pref",
  project: "Proj",
  reference: "Ref",
}

export function MemoryPanel(props: Props) {
  const [entries, setEntries] = createStore<MemoryEntry[]>(props.entries ?? DEMO_ENTRIES)

  const pinEntry = (id: string) => {
    setEntries(
      produce((draft) => {
        const entry = draft.find((e) => e.id === id)
        if (!entry) return
        entry.pinned = !entry.pinned
        props.onPin?.(id, !!entry.pinned)
      }),
    )
  }

  const pruneEntry = (id: string) => {
    setEntries(
      produce((draft) => {
        const index = draft.findIndex((e) => e.id === id)
        if (index === -1) return
        draft.splice(index, 1)
        props.onPrune?.(id)
      }),
    )
  }

  const pinned = () => entries.filter((e) => e.pinned)
  const unpinned = () => entries.filter((e) => !e.pinned)
  const isEmpty = () => entries.length === 0

  return (
    <div class="mimo-panel">
      <div class="mimo-panel-header">
        <span class="mimo-panel-title">Memory</span>
        <span
          style={{
            "font-size": "11px",
            color: "var(--text-weak)",
          }}
        >
          {entries.length} {entries.length === 1 ? "entry" : "entries"}
        </span>
      </div>

      <div class="mimo-panel-body">
        <Show
          when={!isEmpty()}
          fallback={
            <div class="mimo-empty-state">
              <span class="mimo-empty-state-icon">◎</span>
              <span>No memories yet. The agent will remember important context across sessions.</span>
            </div>
          }
        >
          <Show when={pinned().length > 0}>
            <SectionLabel>Pinned</SectionLabel>
            <For each={pinned()}>
              {(entry) => <MemoryItem entry={entry} onPin={pinEntry} onPrune={pruneEntry} />}
            </For>
          </Show>

          <Show when={unpinned().length > 0}>
            <Show when={pinned().length > 0}>
              <SectionLabel>Recent</SectionLabel>
            </Show>
            <For each={unpinned()}>
              {(entry) => <MemoryItem entry={entry} onPin={pinEntry} onPrune={pruneEntry} />}
            </For>
          </Show>
        </Show>
      </div>
    </div>
  )
}

function SectionLabel(props: { children: JSX.Element }) {
  return (
    <div
      style={{
        "font-size": "10px",
        "font-weight": "600",
        "letter-spacing": "0.06em",
        "text-transform": "uppercase",
        color: "var(--text-weak)",
        padding: "8px 2px 4px",
      }}
    >
      {props.children}
    </div>
  )
}

function MemoryItem(props: {
  entry: MemoryEntry
  onPin: (id: string) => void
  onPrune: (id: string) => void
}) {
  const { entry } = props
  return (
    <div class="mimo-memory-item">
      <span class="mimo-memory-item-tag">{TAG_LABELS[entry.tag]}</span>
      <span class="mimo-memory-item-content">{entry.content}</span>
      <div class="mimo-memory-actions">
        <button
          type="button"
          title={entry.pinned ? "Unpin" : "Pin"}
          onClick={() => props.onPin(entry.id)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "2px",
            "border-radius": "4px",
            color: entry.pinned ? "var(--primary)" : "var(--text-weak)",
            "line-height": "1",
          }}
        >
          {entry.pinned ? "◈" : "◇"}
        </button>
        <button
          type="button"
          title="Prune"
          onClick={() => props.onPrune(entry.id)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "2px",
            "border-radius": "4px",
            color: "var(--text-weak)",
            "line-height": "1",
          }}
        >
          ×
        </button>
      </div>
    </div>
  )
}

const DEMO_ENTRIES: MemoryEntry[] = [
  {
    id: "1",
    content: "User prefers concise responses without trailing summaries.",
    tag: "feedback",
    pinned: true,
    createdAt: Date.now() - 86400000,
  },
  {
    id: "2",
    content: "Project uses Bun + Effect-TS + SolidJS stack throughout.",
    tag: "project",
    createdAt: Date.now() - 3600000,
  },
  {
    id: "3",
    content: "User is a senior desktop engineer, comfortable with Electron internals.",
    tag: "user",
    createdAt: Date.now() - 7200000,
  },
]
