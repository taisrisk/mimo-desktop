import { createSignal, createMemo, For, Show, onMount, onCleanup } from "solid-js"
import { createStore, produce } from "solid-js/store"
import { DateTime } from "luxon"

// ─── Types ────────────────────────────────────────────────────────────────────

export type MemoryType =
  | "user-pref"
  | "project-ctx"
  | "feedback"
  | "code-pattern"
  | "insight"
  | "reference"
  | "conversation"
  | "task-history"

export type MemoryEntry = {
  id: string
  type: MemoryType
  content: string
  tags: string[]
  pinned: boolean
  confidence: number
  relevance: number
  sessionId?: string
  filePath?: string
  createdAt: number
  accessedAt: number
  accessCount: number
  embedding?: number[]
}

export type ContextMatch = {
  memory: MemoryEntry
  score: number
  reason: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MEMORY_TYPE_META: Record<MemoryType, { label: string; color: string; icon: string }> = {
  "user-pref": { label: "User Preference", color: "#f59e0b", icon: "★" },
  "project-ctx": { label: "Project Context", color: "#3b82f6", icon: "◈" },
  feedback: { label: "Feedback", color: "#10b981", icon: "✓" },
  "code-pattern": { label: "Code Pattern", color: "#8b5cf6", icon: "⟨⟩" },
  insight: { label: "Insight", color: "#ec4899", icon: "◆" },
  reference: { label: "Reference", color: "#6366f1", icon: "◎" },
  conversation: { label: "Conversation", color: "#f97316", icon: "💬" },
  "task-history": { label: "Task History", color: "#6b7280", icon: "◷" },
}

const ALL_TYPES = Object.keys(MEMORY_TYPE_META) as MemoryType[]

// ─── Similarity ───────────────────────────────────────────────────────────────

function simpleSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/))
  const wordsB = new Set(b.toLowerCase().split(/\s+/))
  let overlap = 0
  for (const w of wordsA) if (wordsB.has(w)) overlap++
  const total = new Set([...wordsA, ...wordsB]).size
  return total > 0 ? overlap / total : 0
}

function findSimilarMemories(query: string, memories: MemoryEntry[], limit = 5): ContextMatch[] {
  const scored = memories
    .map((m) => ({
      memory: m,
      score: simpleSimilarity(query, m.content) * 0.6 + (m.confidence / 100) * 0.2 + (m.accessCount > 0 ? 0.2 : 0),
      reason: "",
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)

  for (const s of scored) {
    if (s.score > 0.6) s.reason = "High semantic match"
    else if (s.score > 0.3) s.reason = "Partial keyword overlap"
    else s.reason = "Type-based relevance"
  }

  return scored.filter((s) => s.score > 0.05)
}

// ─── Demo Data ────────────────────────────────────────────────────────────────

const SEED_MEMORIES: MemoryEntry[] = [
  { id: "m1", type: "user-pref", content: "User prefers TypeScript strict mode with explicit return types and never uses `any`", tags: ["typescript", "coding-style"], pinned: true, confidence: 95, relevance: 90, createdAt: Date.now() - 86400000 * 5, accessedAt: Date.now() - 3600000, accessCount: 12 },
  { id: "m2", type: "project-ctx", content: "Project uses Bun runtime + Effect-TS for async operations, electron-vite for desktop builds", tags: ["bun", "effect-ts", "electron"], pinned: false, confidence: 88, relevance: 85, createdAt: Date.now() - 86400000 * 3, accessedAt: Date.now() - 7200000, accessCount: 8 },
  { id: "m3", type: "code-pattern", content: "Prefer early returns over if/else chains, avoid try/catch where possible, use Bun.file() for I/O", tags: ["patterns", "best-practices"], pinned: true, confidence: 92, relevance: 88, createdAt: Date.now() - 86400000 * 2, accessedAt: Date.now() - 1800000, accessCount: 15 },
  { id: "m4", type: "feedback", content: "User corrected: do not use lodash — use native array methods (flatMap, filter, map) instead", tags: ["no-lodash", "native"], pinned: false, confidence: 100, relevance: 95, createdAt: Date.now() - 86400000, accessedAt: Date.now() - 900000, accessCount: 6 },
  { id: "m5", type: "insight", content: "MiMo Desktop rebrand is built on mimocode-src monorepo, packages/desktop + packages/app + packages/ui", tags: ["mimo", "architecture"], pinned: false, confidence: 85, relevance: 80, createdAt: Date.now() - 43200000, accessedAt: Date.now() - 600000, accessCount: 4 },
  { id: "m6", type: "reference", content: "SolidJS: always prefer createStore over multiple createSignal calls for related state", tags: ["solidjs", "state"], pinned: true, confidence: 90, relevance: 92, createdAt: Date.now() - 36000000, accessedAt: Date.now() - 300000, accessCount: 20 },
  { id: "m7", type: "conversation", content: "User wants n8n-style workflow editor with visual node canvas, drag-drop, and connection lines", tags: ["workflow", "feature"], pinned: false, confidence: 75, relevance: 88, createdAt: Date.now() - 18000000, accessedAt: Date.now() - 120000, accessCount: 3 },
  { id: "m8", type: "task-history", content: "Completed: rebrand OpenCode → Mimo Desktop, fix all locale files, update window titles and IPC channels", tags: ["completed", "rebrand"], pinned: false, confidence: 100, relevance: 60, createdAt: Date.now() - 7200000, accessedAt: Date.now() - 60000, accessCount: 2 },
]

// ─── Components ───────────────────────────────────────────────────────────────

function MemorySearchBar(props: {
  query: string
  onQueryChange: (q: string) => void
  filterType: MemoryType | "all"
  onFilterTypeChange: (t: MemoryType | "all") => void
  stats: { total: number; pinned: number; types: number }
}) {
  const [focused, setFocused] = createSignal(false)

  return (
    <div class="flex flex-col gap-2 px-3 pt-3">
      <div
        class="flex items-center gap-2 px-3 py-2 rounded-xl border transition-all"
        style={{
          background: focused() ? "var(--color-background-raised-base)" : "var(--color-background-base)",
          "border-color": focused() ? "var(--color-border-base)" : "var(--color-border-weak-base)",
        }}
      >
        <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5" class="text-text-weaker shrink-0">
          <circle cx="8.5" cy="8.5" r="5.5" />
          <path d="M13 13L17 17" stroke-linecap="round" />
        </svg>
        <input
          class="flex-1 bg-transparent text-12-regular text-text-base outline-none placeholder:text-text-weaker"
          placeholder="Search memories, patterns, preferences..."
          value={props.query}
          onInput={(e) => props.onQueryChange(e.currentTarget.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        <Show when={props.query}>
          <button
            class="text-text-weaker hover:text-text-base transition-colors"
            onClick={() => props.onQueryChange("")}
          >
            <svg viewBox="0 0 20 20" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
              <path d="M4 4L16 16M16 4L4 16" />
            </svg>
          </button>
        </Show>
      </div>

      {/* Stats row */}
      <div class="flex items-center gap-3 text-9-regular text-text-weaker px-1">
        <span>{props.stats.total} memories</span>
        <span>·</span>
        <span>{props.stats.pinned} pinned</span>
        <span>·</span>
        <span>{props.stats.types} types</span>
      </div>

      {/* Type filter */}
      <div class="flex gap-1 flex-wrap px-1">
        <button
          class="px-2 py-0.5 rounded-full text-9-regular transition-all"
          style={{
            background: props.filterType === "all" ? "rgba(255,255,255,0.08)" : "transparent",
            color: props.filterType === "all" ? "var(--color-text-base)" : "var(--color-text-weaker)",
            border: `1px solid ${props.filterType === "all" ? "var(--color-border-base)" : "transparent"}`,
          }}
          onClick={() => props.onFilterTypeChange("all")}
        >
          All
        </button>
        <For each={ALL_TYPES}>
          {(type) => {
            const meta = MEMORY_TYPE_META[type]
            return (
              <button
                class="px-2 py-0.5 rounded-full text-9-regular transition-all flex items-center gap-1"
                style={{
                  background: props.filterType === type ? `${meta.color}20` : "transparent",
                  color: props.filterType === type ? meta.color : "var(--color-text-weaker)",
                  border: `1px solid ${props.filterType === type ? `${meta.color}40` : "transparent"}`,
                }}
                onClick={() => props.onFilterTypeChange(type)}
              >
                <span>{meta.icon}</span>
                <span>{meta.label}</span>
              </button>
            )
          }}
        </For>
      </div>
    </div>
  )
}

function MemoryCard(props: {
  memory: MemoryEntry
  onPin: (id: string) => void
  onForget: (id: string) => void
  onSelect: (id: string) => void
  isMatch?: boolean
  matchScore?: number
  matchReason?: string
}) {
  const meta = () => MEMORY_TYPE_META[props.memory.type]

  return (
    <div
      class="group mx-3 px-3 py-2.5 rounded-xl transition-all cursor-pointer"
      classList={{
        "bg-amber-500/8 border border-amber-500/20": props.isMatch,
        "hover:bg-background-surface-base border border-transparent": !props.isMatch,
      }}
      onClick={() => props.onSelect(props.memory.id)}
    >
      <div class="flex items-start gap-2.5">
        <div
          class="mt-0.5 size-6 rounded-lg flex items-center justify-center text-10-medium shrink-0"
          style={{ background: `${meta().color}18`, color: meta().color }}
        >
          {meta().icon}
        </div>
        <div class="flex flex-col gap-1 flex-1 min-w-0">
          <div class="text-12-regular text-text-base leading-relaxed">{props.memory.content}</div>
          <div class="flex items-center gap-2 flex-wrap">
            <span
              class="text-9-regular px-1.5 py-0 rounded"
              style={{ background: `${meta().color}15`, color: meta().color }}
            >
              {meta().label}
            </span>
            <For each={props.memory.tags}>
              {(tag) => (
                <span class="text-9-regular text-text-weaker">#{tag}</span>
              )}
            </For>
            <span class="text-9-regular text-text-weaker">
              {DateTime.fromMillis(props.memory.accessedAt).toRelative()}
            </span>
          </div>
          <Show when={props.isMatch && props.matchScore !== undefined}>
            <div class="flex items-center gap-2 mt-0.5">
              <div class="flex items-center gap-1">
                <div class="h-1 w-12 rounded-full bg-background-base overflow-hidden">
                  <div
                    class="h-full rounded-full"
                    style={{ width: `${Math.min(100, props.matchScore! * 100)}%`, background: "#f59e0b" }}
                  />
                </div>
                <span class="text-9-regular text-amber-400">{Math.round(props.matchScore! * 100)}%</span>
              </div>
              <span class="text-9-regular text-text-weaker">{props.matchReason}</span>
            </div>
          </Show>
        </div>
        <div class="flex flex-col items-end gap-1 shrink-0">
          <div class="flex items-center gap-0.5 text-9-regular text-text-weaker">
            <span>{props.memory.confidence}%</span>
          </div>
          <div class="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              class="size-5 flex items-center justify-center rounded text-text-weaker hover:text-amber-400 transition-colors"
              title={props.memory.pinned ? "Unpin" : "Pin"}
              onClick={(e) => { e.stopPropagation(); props.onPin(props.memory.id) }}
            >
              <svg viewBox="0 0 20 20" width="10" height="10" fill={props.memory.pinned ? "currentColor" : "none"} stroke="currentColor" stroke-width="1.5">
                <path d="M10 2L10 12M7 5H13M10 12L10 18M6 8L14 8" stroke-linecap="round" />
              </svg>
            </button>
            <button
              class="size-5 flex items-center justify-center rounded text-text-weaker hover:text-red-400 transition-colors"
              title="Forget"
              onClick={(e) => { e.stopPropagation(); props.onForget(props.memory.id) }}
            >
              <svg viewBox="0 0 20 20" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
                <path d="M5 5L15 15M15 5L5 15" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ContextEnginePanel(props: {
  memories: MemoryEntry[]
  query: string
}) {
  const matches = createMemo(() => findSimilarMemories(props.query || "TypeScript patterns", props.memories, 8))

  return (
    <div class="flex flex-col gap-2 p-3">
      <div class="flex items-center gap-2 px-1">
        <div class="size-5 rounded-md bg-amber-500/15 flex items-center justify-center">
          <svg viewBox="0 0 20 20" width="11" height="11" fill="none" stroke="#f59e0b" stroke-width="1.5" stroke-linecap="round">
            <path d="M10 2L10 18M2 10L18 10M4 4L16 16M16 4L4 16" />
          </svg>
        </div>
        <span class="text-12-medium text-text-base">Context Matches</span>
        <span class="text-9-regular text-text-weaker ml-auto">{matches().length} results</span>
      </div>

      <Show when={matches().length > 0} fallback={
        <div class="text-11-regular text-text-weaker text-center py-4">No matches found</div>
      }>
        <For each={matches()}>
          {(match) => (
            <MemoryCard
              memory={match.memory}
              onPin={() => {}}
              onForget={() => {}}
              onSelect={() => {}}
              isMatch
              matchScore={match.score}
              matchReason={match.reason}
            />
          )}
        </For>
      </Show>
    </div>
  )
}

// ─── Main Memory Engine ───────────────────────────────────────────────────────

export function MemoryEngine(props?: { initialMemories?: MemoryEntry[] }) {
  const [memories, setMemories] = createStore<MemoryEntry[]>(props?.initialMemories ?? SEED_MEMORIES)
  const [query, setQuery] = createSignal("")
  const [filterType, setFilterType] = createSignal<MemoryType | "all">("all")
  const [view, setView] = createSignal<"browse" | "context" | "stats">("browse")
  const [selectedId, setSelectedId] = createSignal<string | null>(null)

  const stats = createMemo(() => ({
    total: memories.length,
    pinned: memories.filter((m) => m.pinned).length,
    types: new Set(memories.map((m) => m.type)).size,
  }))

  const filteredMemories = createMemo(() => {
    let result = memories.slice()
    if (filterType() !== "all") result = result.filter((m) => m.type === filterType())
    if (query()) {
      result = result
        .map((m) => ({ m, score: simpleSimilarity(query(), m.content) }))
        .sort((a, b) => b.score - a.score)
        .map((s) => s.m)
    }
    return result.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1
      if (!a.pinned && b.pinned) return 1
      return b.createdAt - a.createdAt
    })
  })

  function togglePin(id: string) {
    setMemories(
      (m) => m.id === id,
      produce((m) => { m.pinned = !m.pinned }),
    )
  }

  function forgetMemory(id: string) {
    setMemories((prev) => prev.filter((m) => m.id !== id))
    if (selectedId() === id) setSelectedId(null)
  }

  function addMemory(type: MemoryType, content: string) {
    setMemories((prev) => [{
      id: `m${Math.random().toString(36).slice(2, 8)}`,
      type,
      content,
      tags: [],
      pinned: false,
      confidence: 80,
      relevance: 70,
      createdAt: Date.now(),
      accessedAt: Date.now(),
      accessCount: 0,
    }, ...prev])
  }

  return (
    <div class="flex flex-col h-full overflow-hidden">
      {/* View tabs */}
      <div class="flex items-center border-b border-border-weak-base shrink-0 px-3">
        <For each={[
          { id: "browse" as const, label: "Browse", icon: "◇" },
          { id: "context" as const, label: "Context Engine", icon: "◎" },
          { id: "stats" as const, label: "Analytics", icon: "◆" },
        ]}>
          {(tab) => (
            <button
              class="flex items-center gap-1.5 px-3 py-2.5 text-11-medium transition-colors border-b-2"
              classList={{
                "border-amber-500 text-text-base": view() === tab.id,
                "border-transparent text-text-weak hover:text-text-base": view() !== tab.id,
              }}
              onClick={() => setView(tab.id)}
            >
              <span class="text-10">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          )}
        </For>
      </div>

      <MemorySearchBar
        query={query()}
        onQueryChange={setQuery}
        filterType={filterType()}
        onFilterTypeChange={setFilterType}
        stats={stats()}
      />

      <div class="flex-1 overflow-y-auto py-1">
        <Show when={view() === "browse"}>
          <For each={filteredMemories()}>
            {(memory) => (
              <MemoryCard
                memory={memory}
                onPin={togglePin}
                onForget={forgetMemory}
                onSelect={setSelectedId}
              />
            )}
          </For>
          <Show when={filteredMemories().length === 0}>
            <div class="flex flex-col items-center gap-2 py-12 text-center">
              <div class="text-2xl opacity-30">◇</div>
              <div class="text-12-medium text-text-base">No memories found</div>
              <div class="text-11-regular text-text-weak">Mimo will remember as you work</div>
            </div>
          </Show>
        </Show>

        <Show when={view() === "context"}>
          <ContextEnginePanel memories={memories} query={query()} />
        </Show>

        <Show when={view() === "stats"}>
          <div class="p-3 flex flex-col gap-3">
            {/* Type breakdown */}
            <div class="rounded-xl border border-border-weak-base p-3 bg-background-surface-base">
              <div class="text-11-medium text-text-base mb-2">Memory Distribution</div>
              <div class="flex flex-col gap-1.5">
                <For each={ALL_TYPES}>
                  {(type) => {
                    const count = memories.filter((m) => m.type === type).length
                    const pct = memories.length > 0 ? (count / memories.length) * 100 : 0
                    const meta = MEMORY_TYPE_META[type]
                    return (
                      <div class="flex items-center gap-2">
                        <span class="text-9-regular text-text-weaker w-20 truncate">{meta.label}</span>
                        <div class="flex-1 h-1.5 rounded-full bg-background-base overflow-hidden">
                          <div class="h-full rounded-full" style={{ width: `${pct}%`, background: meta.color }} />
                        </div>
                        <span class="text-9-regular text-text-weaker w-6 text-right">{count}</span>
                      </div>
                    )
                  }}
                </For>
              </div>
            </div>

            {/* Confidence distribution */}
            <div class="rounded-xl border border-border-weak-base p-3 bg-background-surface-base">
              <div class="text-11-medium text-text-base mb-2">Confidence Levels</div>
              <div class="grid grid-cols-4 gap-2">
                <For each={[{ label: "90-100%", color: "#10b981", count: memories.filter((m) => m.confidence >= 90).length },
                             { label: "70-89%", color: "#3b82f6", count: memories.filter((m) => m.confidence >= 70 && m.confidence < 90).length },
                             { label: "50-69%", color: "#f59e0b", count: memories.filter((m) => m.confidence >= 50 && m.confidence < 70).length },
                             { label: "<50%", color: "#6b7280", count: memories.filter((m) => m.confidence < 50).length }]}>
                  {(bucket) => (
                    <div class="flex flex-col items-center gap-1 p-2 rounded-lg bg-background-base">
                      <div class="text-16-bold" style={{ color: bucket.color }}>{bucket.count}</div>
                      <div class="text-9-regular text-text-weaker">{bucket.label}</div>
                    </div>
                  )}
                </For>
              </div>
            </div>

            {/* Most accessed */}
            <div class="rounded-xl border border-border-weak-base p-3 bg-background-surface-base">
              <div class="text-11-medium text-text-base mb-2">Most Accessed</div>
              <For each={memories.slice().sort((a, b) => b.accessCount - a.accessCount).slice(0, 5)}>
                {(m) => (
                  <div class="flex items-center gap-2 py-1.5">
                    <span class="text-10" style={{ color: MEMORY_TYPE_META[m.type].color }}>
                      {MEMORY_TYPE_META[m.type].icon}
                    </span>
                    <span class="text-11-regular text-text-base flex-1 truncate">{m.content}</span>
                    <span class="text-9-regular text-text-weaker">{m.accessCount}×</span>
                  </div>
                )}
              </For>
            </div>
          </div>
        </Show>
      </div>
    </div>
  )
}
