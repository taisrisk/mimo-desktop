import { createSignal, For, Show, createMemo, createEffect } from "solid-js"

export type Skill = {
  id: string
  name: string
  description: string
  source: string
  category: string
  enabled: boolean
  trusted: boolean
  version?: string
  author?: string
  lastUsed?: string
  toolCount: number
  tags: string[]
}

const EDITOR_PATHS: { editor: string; path: string; icon: string }[] = [
  { editor: "Claude Code", path: ".claude/skills", icon: "◆" },
  { editor: "Codex CLI", path: ".codex/skills", icon: "◎" },
  { editor: "Gemini", path: ".gemini/skills", icon: "◇" },
  { editor: "Manus", path: ".manus/skills", icon: "◈" },
  { editor: "OpenClaw", path: ".openclaw/skills", icon: "✦" },
  { editor: "Cursor", path: ".cursor/skills", icon: "▸" },
  { editor: "OpenCode", path: ".opencode/skills", icon: "●" },
  { editor: "Mimo Code", path: ".mimo/skills", icon: "■" },
  { editor: "Hermes", path: ".hermes/skills", icon: "◆" },
  { editor: "Antigravity", path: ".antigravity/skills", icon: "◎" },
]

const DEMO_SKILLS: Skill[] = [
  { id: "s1", name: "deep-research", description: "Deep research with web search and report generation", source: ".claude/skills", category: "Research", enabled: true, trusted: true, version: "1.2.0", author: "community", toolCount: 12, tags: ["research", "web", "search"] },
  { id: "s2", name: "code-reviewer", description: "Thorough code review with security and performance analysis", source: ".mimo/skills", category: "Code", enabled: true, trusted: true, version: "2.0.1", author: "mimo", toolCount: 8, tags: ["review", "security", "performance"] },
  { id: "s3", name: "browser-use", description: "Browser automation for web testing and data extraction", source: ".claude/skills", category: "Automation", enabled: false, trusted: true, version: "1.0.0", author: "community", toolCount: 15, tags: ["browser", "automation", "testing"] },
  { id: "s4", name: "frontend-design", description: "Production-grade frontend interface creation", source: ".codex/skills", category: "Design", enabled: true, trusted: false, version: "1.5.2", author: "community", toolCount: 6, tags: ["design", "ui", "frontend"] },
  { id: "s5", name: "systematic-debugging", description: "Structured debugging methodology for any bug", source: ".mimo/skills", category: "Debug", enabled: true, trusted: true, version: "1.1.0", author: "mimo", toolCount: 10, tags: ["debug", "troubleshoot", "error"] },
  { id: "s6", name: "memory", description: "Persistent memory management across sessions", source: ".mimo/skills", category: "Core", enabled: true, trusted: true, version: "1.0.0", author: "mimo", toolCount: 4, tags: ["memory", "persistence", "context"] },
]

const CATEGORIES = ["All", "Core", "Research", "Code", "Design", "Automation", "Debug", "Security"]

export default function SkillManager() {
  const [skills, setSkills] = createSignal<Skill[]>(DEMO_SKILLS)
  const [search, setSearch] = createSignal("")
  const [category, setCategory] = createSignal("All")
  const [page, setPage] = createSignal(1)
  const [scanning, setScanning] = createSignal(false)
  const [scanResults, setScanResults] = createSignal<{ editor: string; found: number }[]>([])
  const [showImport, setShowImport] = createSignal(false)
  const perPage = 8

  const filtered = createMemo(() => {
    let result = skills()
    if (category() !== "All") {
      result = result.filter(s => s.category === category())
    }
    if (search()) {
      const q = search().toLowerCase()
      result = result.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.tags.some(t => t.toLowerCase().includes(q))
      )
    }
    return result
  })

  const totalPages = createMemo(() => Math.ceil(filtered().length / perPage))
  const paged = createMemo(() => {
    const start = (page() - 1) * perPage
    return filtered().slice(start, start + perPage)
  })

  createEffect(() => {
    search()
    category()
    setPage(1)
  })

  function toggleSkill(id: string) {
    setSkills(prev => prev.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s))
  }

  function removeSkill(id: string) {
    setSkills(prev => prev.filter(s => s.id !== id))
  }

  async function scanEditors() {
    setScanning(true)
    setScanResults([])
    const results: { editor: string; found: number }[] = []
    for (const editor of EDITOR_PATHS) {
      await new Promise(r => setTimeout(r, 300))
      const found = Math.floor(Math.random() * 5)
      results.push({ editor: editor.editor, found })
      setScanResults([...results])
    }
    setScanning(false)
  }

  return (
    <div class="flex flex-col gap-4 p-4 h-full overflow-y-auto">
      {/* Header */}
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="text-lg">⚙</div>
          <div>
            <div class="text-14-medium text-text-base">Skill Management</div>
            <div class="text-11-regular text-text-weaker">
              {skills().filter(s => s.enabled).length} active · {skills().length} total
            </div>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-11-medium border cursor-pointer transition-colors hover:opacity-80"
            style={{ color: "#3b82f6", "border-color": "#3b82f630", background: "#3b82f610" }}
            onClick={() => setShowImport(!showImport())}
          >
            <span>↓</span> Import
          </button>
          <button
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-11-medium text-white cursor-pointer transition-opacity hover:opacity-80"
            style={{ background: "#f59e0b" }}
            onClick={scanEditors}
          >
            <span>{scanning() ? "⟳" : "⊕"}</span> {scanning() ? "Scanning..." : "Scan Editors"}
          </button>
        </div>
      </div>

      {/* Scan results */}
      <Show when={scanResults().length > 0 || scanning()}>
        <div
          class="rounded-2xl border p-4 flex flex-col gap-3"
          style={{ background: "var(--color-background-surface-base)", "border-color": "var(--color-border-weak-base)" }}
        >
          <div class="text-12-medium text-text-base">Editor Scan Results</div>
          <div class="grid grid-cols-2 gap-2">
            <For each={EDITOR_PATHS}>
              {(editor) => {
                const result = scanResults().find(r => r.editor === editor.editor)
                return (
                  <div
                    class="flex items-center gap-2 p-2 rounded-lg"
                    style={{ background: "var(--color-background-raised-base)" }}
                  >
                    <span class="text-sm">{editor.icon}</span>
                    <div class="flex-1 min-w-0">
                      <div class="text-11-medium text-text-base">{editor.editor}</div>
                      <div class="text-9-regular text-text-weaker font-mono">{editor.path}</div>
                    </div>
                    <Show
                      when={result}
                      fallback={
                        scanning() ? (
                          <div class="text-9-regular text-text-weaker">...</div>
                        ) : null
                      }
                    >
                      <div
                        class="text-10-regular px-1.5 py-0.5 rounded-full"
                        style={{
                          color: (result?.found ?? 0) > 0 ? "#10b981" : "#6b7280",
                          background: (result?.found ?? 0) > 0 ? "rgba(16,185,129,0.12)" : "rgba(107,114,128,0.1)",
                        }}
                      >
                        {(result?.found ?? 0)} skills
                      </div>
                    </Show>
                  </div>
                )
              }}
            </For>
          </div>
        </div>
      </Show>

      {/* Import panel */}
      <Show when={showImport()}>
        <div
          class="rounded-2xl border p-4 flex flex-col gap-3"
          style={{ background: "var(--color-background-surface-base)", "border-color": "var(--color-border-weak-base)" }}
        >
          <div class="text-12-medium text-text-base">Import Skills</div>
          <div class="text-11-regular text-text-weaker">
            Select editors to scan. AI will detect duplicates, verify security, and import the best skills.
          </div>
          <div class="flex flex-wrap gap-2 mt-1">
            <For each={EDITOR_PATHS}>
              {(editor) => (
                <button
                  class="flex items-center gap-1 px-2 py-1 rounded-lg text-10-medium border cursor-pointer transition-colors hover:opacity-80"
                  style={{ color: "var(--color-text-weak)", "border-color": "var(--color-border-weak-base)" }}
                >
                  <span>{editor.icon}</span> {editor.editor}
                </button>
              )}
            </For>
          </div>
        </div>
      </Show>

      {/* Category filter */}
      <div class="flex items-center gap-1.5 overflow-x-auto pb-1">
        <For each={CATEGORIES}>
          {(cat) => (
            <button
              class="px-2.5 py-1 rounded-lg text-10-medium whitespace-nowrap cursor-pointer transition-colors"
              style={{
                color: category() === cat ? "white" : "var(--color-text-weak)",
                background: category() === cat ? "#f59e0b" : "var(--color-background-surface-base)",
                border: `1px solid ${category() === cat ? "#f59e0b" : "var(--color-border-weak-base)"}`,
              }}
              onClick={() => setCategory(cat)}
            >
              {cat}
            </button>
          )}
        </For>
      </div>

      {/* Search */}
      <div class="relative">
        <input
          type="text"
          placeholder="Search skills by name, description, or tag..."
          value={search()}
          onInput={(e) => setSearch(e.currentTarget.value)}
          class="w-full px-3 py-2 rounded-xl text-12-regular text-text-base placeholder:text-text-weaker
                 border outline-none transition-colors focus:border-border-base"
          style={{
            background: "var(--color-background-surface-base)",
            "border-color": "var(--color-border-weak-base)",
          }}
        />
      </div>

      {/* Skills list */}
      <div class="flex flex-col gap-2">
        <For each={paged()}>
          {(skill) => (
            <div
              class="flex items-center gap-3 p-3 rounded-xl border transition-all"
              style={{
                background: "var(--color-background-surface-base)",
                "border-color": skill.enabled ? "#f59e0b30" : "var(--color-border-weak-base)",
                opacity: skill.enabled ? 1 : 0.7,
              }}
            >
              <button
                class="shrink-0 cursor-pointer"
                onClick={() => toggleSkill(skill.id)}
              >
                <div
                  class="w-9 h-9 rounded-xl flex items-center justify-center text-11-bold text-white"
                  style={{ background: skill.enabled ? "linear-gradient(135deg, #f59e0b, #f97316)" : "var(--color-background-raised-base)" }}
                >
                  {skill.name.slice(0, 2).toUpperCase()}
                </div>
              </button>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="text-12-medium text-text-base">{skill.name}</span>
                  <Show when={skill.version}>
                    <span class="text-9-regular text-text-weaker font-mono">v{skill.version}</span>
                  </Show>
                  <Show when={skill.trusted}>
                    <span class="text-9-regular px-1 py-0.5 rounded-full" style={{ color: "#10b981", background: "rgba(16,185,129,0.12)" }}>✓ verified</span>
                  </Show>
                </div>
                <div class="text-10-regular text-text-weaker truncate">{skill.description}</div>
                <div class="flex items-center gap-1.5 mt-1">
                  <For each={skill.tags}>
                    {(tag) => (
                      <span class="text-8-regular px-1 py-0.5 rounded-full text-text-weaker"
                            style={{ background: "var(--color-background-raised-base)" }}>
                        {tag}
                      </span>
                    )}
                  </For>
                  <span class="text-9-regular text-text-weaker ml-1">{skill.toolCount} tools</span>
                  <span class="text-9-regular text-text-weaker">· {skill.source}</span>
                </div>
              </div>
              <div class="flex items-center gap-1 shrink-0">
                <button
                  class="text-10-regular px-2 py-1 rounded-lg cursor-pointer transition-colors hover:opacity-80"
                  style={{
                    color: skill.enabled ? "#10b981" : "#6b7280",
                    background: skill.enabled ? "rgba(16,185,129,0.1)" : "rgba(107,114,128,0.1)",
                  }}
                  onClick={() => toggleSkill(skill.id)}
                >
                  {skill.enabled ? "Enabled" : "Disabled"}
                </button>
                <button
                  class="text-10-regular text-text-weaker hover:text-text-weak cursor-pointer px-1"
                  onClick={() => removeSkill(skill.id)}
                >
                  ✕
                </button>
              </div>
            </div>
          )}
        </For>
      </div>

      {/* Pagination */}
      <Show when={totalPages() > 1}>
        <div class="flex items-center justify-center gap-2">
          <button
            class="px-2 py-1 rounded-lg text-10-medium cursor-pointer transition-colors"
            style={{
              color: page() > 1 ? "var(--color-text-base)" : "var(--color-text-weaker)",
              background: "var(--color-background-surface-base)",
            }}
            disabled={page() <= 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
          >
            ← Prev
          </button>
          <span class="text-10-regular text-text-weaker">
            Page {page()} of {totalPages()}
          </span>
          <button
            class="px-2 py-1 rounded-lg text-10-medium cursor-pointer transition-colors"
            style={{
              color: page() < totalPages() ? "var(--color-text-base)" : "var(--color-text-weaker)",
              background: "var(--color-background-surface-base)",
            }}
            disabled={page() >= totalPages()}
            onClick={() => setPage(p => Math.min(totalPages(), p + 1))}
          >
            Next →
          </button>
        </div>
      </Show>

      <Show when={filtered().length === 0}>
        <div class="flex flex-col items-center gap-3 py-12 text-center">
          <div class="text-3xl opacity-30">⚙</div>
          <div class="text-12-medium text-text-base">No skills found</div>
          <div class="text-11-regular text-text-weaker">
            {search() ? "Try a different search term" : "Scan editors to import skills or add custom ones"}
          </div>
        </div>
      </Show>
    </div>
  )
}
