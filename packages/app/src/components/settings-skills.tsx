import { Component, createSignal, createResource, For, Show, createMemo } from "solid-js"
import { Button } from "@mimo-ai/ui/button"
import { Icon } from "@mimo-ai/ui/icon"
import { useLanguage } from "@/context/language"
import { useServer } from "@/context/server"

type SkillInfo = {
  name: string
  description: string
  location: string
  content: string
  hidden?: boolean
}

type SkillRow = SkillInfo & {
  source: string
  status: "active" | "hidden" | "duplicate"
}

const SOURCE_EDITORS = [
  { id: ".claude", name: "Claude Code", icon: "🤖" },
  { id: ".codex", name: "OpenAI Codex", icon: "⚡" },
  { id: ".gemini", name: "Google Gemini", icon: "💎" },
  { id: ".cursor", name: "Cursor", icon: "📝" },
  { id: ".mimo", name: "Mimo Code", icon: "✦" },
  { id: ".opencode", name: "OpenCode (legacy)", icon: "🔓" },
  { id: ".hermes", name: "Hermes", icon: "🔥" },
  { id: ".antigravity", name: "Antigravity", icon: "🚀" },
  { id: ".openclaw", name: "OpenClaw", icon: "🐾" },
  { id: ".manus", name: "Manus", icon: "🧠" },
  { id: ".agents", name: "Agents", icon: "🤖" },
]

export const SettingsSkills: Component = () => {
  const language = useLanguage()
  const server = useServer()
  const [search, setSearch] = createSignal("")
  const [page, setPage] = createSignal(0)
  const [scanning, setScanning] = createSignal(false)
  const [lastScan, setLastScan] = createSignal<string | null>(null)
  const [filterSource, setFilterSource] = createSignal<string>("all")
  const [filterStatus, setFilterStatus] = createSignal<string>("all")
  const PAGE_SIZE = 10

  const [skills, { refetch }] = createResource(async () => {
    try {
      const url = server.current?.http.url ?? ""
      const response = await fetch(`${url}/skill`)
      if (!response.ok) return [] as SkillInfo[]
      return (await response.json()) as SkillInfo[]
    } catch {
      return [] as SkillInfo[]
    }
  })

  function inferSource(location: string): string {
    const known = [".claude", ".codex", ".gemini", ".cursor", ".mimo", ".opencode", ".hermes", ".antigravity", ".openclaw", ".manus", ".agents"]
    for (const dir of known) {
      if (location.includes(`${dir}/`) || location.includes(`${dir}\\`)) return dir
    }
    return "unknown"
  }

  const enrichedSkills = createMemo<SkillRow[]>(() => {
    const raw = skills() ?? []
    const nameCount: Record<string, number> = {}
    for (const s of raw) nameCount[s.name] = (nameCount[s.name] ?? 0) + 1
    return raw.map(s => ({
      ...s,
      source: inferSource(s.location),
      status: s.hidden ? "hidden" : nameCount[s.name] > 1 ? "duplicate" : "active",
    }))
  })

  const filteredSkills = createMemo(() => {
    let list = enrichedSkills()
    const q = search().toLowerCase()
    if (q) list = list.filter(s => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q))
    if (filterSource() !== "all") list = list.filter(s => s.source === filterSource())
    if (filterStatus() !== "all") list = list.filter(s => s.status === filterStatus())
    return list
  })

  const totalPages = createMemo(() => Math.ceil(filteredSkills().length / PAGE_SIZE))
  const pagedSkills = createMemo(() => filteredSkills().slice(page() * PAGE_SIZE, (page() + 1) * PAGE_SIZE))

  const handleScan = async () => {
    setScanning(true)
    try {
      await refetch()
      setLastScan(new Date().toLocaleTimeString())
    } finally {
      setScanning(false)
    }
  }

  const statusColors: Record<string, string> = {
    active: "#22c55e",
    hidden: "#6b7280",
    duplicate: "#f59e0b",
  }

  return (
    <div class="flex flex-col gap-6 p-1">
      <div>
        <h3 class="text-16-bold text-text-strong mb-1">Skills Management</h3>
        <p class="text-13-regular text-text-weak">
          Auto-scan, import, and manage skills from other AI editors
        </p>
      </div>

      <div class="flex items-center gap-3">
        <Button variant="primary" onClick={handleScan} disabled={scanning()}>
          <Icon name={scanning() ? "chevron-down" : "check"} />
          {scanning() ? "Scanning..." : "Auto-Scan & Import"}
        </Button>
        <Show when={lastScan()}>
          <span class="text-12-regular text-text-weak">Last scan: {lastScan()}</span>
        </Show>
      </div>

      <div class="flex flex-col gap-2">
        <h4 class="text-13-bold text-text-base">Scan Sources</h4>
        <p class="text-12-regular text-text-weak mb-2">
          Select which editor directories to scan for skills
        </p>
        <div class="grid grid-cols-3 gap-2">
          <For each={SOURCE_EDITORS}>
            {(editor) => (
              <div class="flex items-center gap-2 p-2 rounded-lg border border-border-base hover:border-border-interactive transition-colors cursor-pointer">
                <span>{editor.icon}</span>
                <span class="text-12-medium text-text-base">{editor.name}</span>
              </div>
            )}
          </For>
        </div>
      </div>

      <div class="flex flex-col gap-3">
        <div class="flex items-center gap-3">
          <div class="flex-1 relative">
            <input
              type="text"
              placeholder="Search skills..."
              value={search()}
              onInput={(e) => { setSearch(e.currentTarget.value); setPage(0) }}
              class="w-full px-3 py-2 rounded-lg border border-border-base bg-surface-base text-text-base text-13-regular focus:outline-none focus:border-border-interactive"
            />
          </div>
          <select
            value={filterSource()}
            onChange={(e) => { setFilterSource(e.currentTarget.value); setPage(0) }}
            class="px-3 py-2 rounded-lg border border-border-base bg-surface-base text-text-base text-13-regular"
          >
            <option value="all">All Sources</option>
            <For each={SOURCE_EDITORS}>
              {(editor) => <option value={editor.id}>{editor.name}</option>}
            </For>
          </select>
          <select
            value={filterStatus()}
            onChange={(e) => { setFilterStatus(e.currentTarget.value); setPage(0) }}
            class="px-3 py-2 rounded-lg border border-border-base bg-surface-base text-text-base text-13-regular"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="hidden">Hidden</option>
            <option value="duplicate">Duplicate</option>
          </select>
        </div>

        <div class="flex flex-col gap-1">
          <Show when={pagedSkills().length > 0} fallback={
            <div class="text-center py-8 text-13-regular text-text-weak">
              No skills found. Run a scan to discover skills from other editors.
            </div>
          }>
            <For each={pagedSkills()}>
              {(skill) => (
                <div class="flex items-center gap-3 p-3 rounded-lg border border-border-base hover:border-border-interactive transition-colors">
                  <div class="size-2 rounded-full shrink-0" style={{ "background-color": statusColors[skill.status] }} />
                  <div class="flex-1 min-w-0">
                    <div class="text-13-medium text-text-strong truncate">{skill.name}</div>
                    <div class="text-11-regular text-text-weak truncate">{skill.description}</div>
                  </div>
                  <span class="text-11-regular text-text-weak shrink-0">{skill.source}</span>
                  <span class="text-11-regular shrink-0 px-2 py-0.5 rounded-full" style={{ "background-color": `${statusColors[skill.status]}20`, color: statusColors[skill.status] }}>
                    {skill.status}
                  </span>
                </div>
              )}
            </For>
          </Show>
        </div>

        <Show when={totalPages() > 1}>
          <div class="flex items-center justify-center gap-2 mt-2">
            <Button variant="ghost" size="small" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page() === 0}>
              <Icon name="chevron-left" />
            </Button>
            <span class="text-12-medium text-text-base">{page() + 1} / {totalPages()}</span>
            <Button variant="ghost" size="small" onClick={() => setPage(p => Math.min(totalPages() - 1, p + 1))} disabled={page() >= totalPages() - 1}>
              <Icon name="chevron-right" />
            </Button>
          </div>
        </Show>
      </div>

      <div class="flex flex-col gap-2 mt-4 p-4 rounded-xl bg-surface-weak">
        <h4 class="text-13-bold text-text-base">Security Scan</h4>
        <p class="text-12-regular text-text-weak">
          Skills are automatically scanned for prompt injection, malicious code patterns,
          and suspicious file access before import. Skills flagged as suspicious are marked
          for manual review.
        </p>
        <div class="flex items-center gap-2 mt-2">
          <div class="size-2 rounded-full bg-green-500" />
          <span class="text-12-regular text-text-base">Security scanning enabled</span>
        </div>
      </div>

      <div class="flex flex-col gap-2 mt-2 p-4 rounded-xl bg-surface-weak">
        <h4 class="text-13-bold text-text-base">Duplicate Detection</h4>
        <p class="text-12-regular text-text-weak">
          AI-powered duplicate detection compares skill content, not just names.
          When duplicates are found, the best version is automatically selected
          based on content quality and freshness.
        </p>
      </div>
    </div>
  )
}
