import { createSignal, createResource, For, Show, createMemo } from "solid-js"
import { useServer } from "@/context/server"

type McpStatusValue =
  | { status: "connected" }
  | { status: "disabled" }
  | { status: "pending" }
  | { status: "failed"; error: string }
  | { status: "needs_auth" }
  | { status: "needs_client_registration"; error: string }

type McpState = Record<string, McpStatusValue>

const PRESETS: {
  name: string
  type: "local" | "remote"
  command?: string[]
  url?: string
  description: string
}[] = [
  { name: "github", type: "local", command: ["npx", "-y", "@modelcontextprotocol/server-github"], description: "GitHub API — PRs, issues, code search" },
  { name: "filesystem", type: "local", command: ["npx", "-y", "@modelcontextprotocol/server-filesystem", "."], description: "Read/write files on disk" },
  { name: "brave-search", type: "local", command: ["npx", "-y", "@modelcontextprotocol/server-brave-search"], description: "Web search via Brave Search API" },
  { name: "memory", type: "local", command: ["npx", "-y", "@modelcontextprotocol/server-memory"], description: "Persistent memory store for agents" },
  { name: "puppeteer", type: "local", command: ["npx", "-y", "@modelcontextprotocol/server-puppeteer"], description: "Browser automation and screenshots" },
  { name: "postgres", type: "local", command: ["npx", "-y", "@modelcontextprotocol/server-postgres"], description: "PostgreSQL database queries" },
  { name: "slack", type: "local", command: ["npx", "-y", "@modelcontextprotocol/server-slack"], description: "Slack workspace integration" },
  { name: "linear", type: "remote", url: "https://mcp.linear.app/sse", description: "Linear issue tracker" },
]

function statusColor(s: McpStatusValue["status"]) {
  if (s === "connected") return "#10b981"
  if (s === "failed" || s === "needs_auth" || s === "needs_client_registration") return "#ef4444"
  if (s === "pending") return "#f59e0b"
  return "#6b7280"
}

function statusLabel(s: McpStatusValue["status"]) {
  if (s === "connected") return "Connected"
  if (s === "disabled") return "Disabled"
  if (s === "pending") return "Connecting…"
  if (s === "failed") return "Failed"
  if (s === "needs_auth") return "Auth required"
  if (s === "needs_client_registration") return "Registration needed"
  return s
}

export default function McpConnector() {
  const server = useServer()
  const [showAdd, setShowAdd] = createSignal(false)
  const [addMode, setAddMode] = createSignal<"preset" | "custom">("preset")
  const [customName, setCustomName] = createSignal("")
  const [customCommand, setCustomCommand] = createSignal("")
  const [customArgs, setCustomArgs] = createSignal("")
  const [customUrl, setCustomUrl] = createSignal("")
  const [customType, setCustomType] = createSignal<"local" | "remote">("local")
  const [search, setSearch] = createSignal("")
  const [expandedName, setExpandedName] = createSignal<string | null>(null)
  const [actionPending, setActionPending] = createSignal<string | null>(null)
  const [addError, setAddError] = createSignal<string | null>(null)

  const apiUrl = () => server.current?.http.url ?? ""

  const [mcpData, { refetch }] = createResource<McpState>(async () => {
    try {
      const res = await fetch(`${apiUrl()}/mcp`)
      if (!res.ok) return {}
      return await res.json()
    } catch {
      return {}
    }
  })

  const serverEntries = createMemo(() => Object.entries(mcpData() ?? {}))
  const connectedCount = createMemo(() => serverEntries().filter(([, s]) => s.status === "connected").length)

  const filteredPresets = createMemo(() =>
    PRESETS.filter(p => p.name.toLowerCase().includes(search().toLowerCase()))
  )

  async function addServer(name: string, config: object) {
    setAddError(null)
    try {
      const res = await fetch(`${apiUrl()}/mcp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, config }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setAddError((body as any)?.error ?? "Failed to add server")
        return
      }
      setShowAdd(false)
      setCustomName("")
      setCustomCommand("")
      setCustomArgs("")
      setCustomUrl("")
      await refetch()
    } catch (e: any) {
      setAddError(e?.message ?? "Network error")
    }
  }

  function addPreset(preset: typeof PRESETS[number]) {
    const config = preset.type === "local"
      ? { type: "local", command: preset.command }
      : { type: "remote", url: preset.url }
    addServer(preset.name, config)
  }

  function addCustom() {
    if (!customName()) return
    const config = customType() === "local"
      ? { type: "local", command: [customCommand(), ...customArgs().split(" ").filter(Boolean)] }
      : { type: "remote", url: customUrl() }
    addServer(customName(), config)
  }

  async function toggleConnect(name: string, current: McpStatusValue) {
    setActionPending(name)
    const endpoint = current.status === "connected" ? "disconnect" : "connect"
    try {
      await fetch(`${apiUrl()}/mcp/${encodeURIComponent(name)}/${endpoint}`, { method: "POST" })
      await refetch()
    } finally {
      setActionPending(null)
    }
  }

  async function triggerAuth(name: string) {
    setActionPending(name)
    try {
      await fetch(`${apiUrl()}/mcp/${encodeURIComponent(name)}/auth/authenticate`, { method: "POST" })
      await refetch()
    } finally {
      setActionPending(null)
    }
  }

  return (
    <div class="flex flex-col gap-4 p-4 h-full overflow-y-auto">
      {/* Header */}
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="text-lg">⊕</div>
          <div>
            <div class="text-14-medium text-text-base">MCP Connector</div>
            <div class="text-11-regular text-text-weaker">
              {serverEntries().length} servers · {connectedCount()} connected
            </div>
          </div>
        </div>
        <button
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-11-medium text-white cursor-pointer transition-opacity hover:opacity-80"
          style={{ background: "#f59e0b" }}
          onClick={() => { setShowAdd(!showAdd()); setAddError(null) }}
        >
          <span>{showAdd() ? "✕" : "+"}</span>
          {showAdd() ? "Cancel" : "Add Server"}
        </button>
      </div>

      {/* Search */}
      <Show when={!showAdd()}>
        <div class="relative">
          <input
            type="text"
            placeholder="Search servers..."
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
      </Show>

      {/* Add panel */}
      <Show when={showAdd()}>
        <div
          class="rounded-2xl border p-4 flex flex-col gap-4"
          style={{ background: "var(--color-background-surface-base)", "border-color": "var(--color-border-weak-base)" }}
        >
          <div class="flex items-center gap-2">
            <button
              class="px-3 py-1 rounded-lg text-11-medium cursor-pointer transition-colors"
              style={{ background: addMode() === "preset" ? "#f59e0b" : "transparent", color: addMode() === "preset" ? "white" : "var(--color-text-weak)" }}
              onClick={() => setAddMode("preset")}
            >
              Presets
            </button>
            <button
              class="px-3 py-1 rounded-lg text-11-medium cursor-pointer transition-colors"
              style={{ background: addMode() === "custom" ? "#f59e0b" : "transparent", color: addMode() === "custom" ? "white" : "var(--color-text-weak)" }}
              onClick={() => setAddMode("custom")}
            >
              Custom
            </button>
          </div>

          <Show when={addMode() === "preset"}>
            <div class="grid grid-cols-2 gap-2">
              <For each={filteredPresets()}>
                {(preset) => (
                  <button
                    class="flex flex-col gap-1 p-3 rounded-xl border text-left cursor-pointer transition-all hover:border-border-base"
                    style={{ background: "var(--color-background-raised-base)", "border-color": "var(--color-border-weak-base)" }}
                    onClick={() => addPreset(preset)}
                  >
                    <div class="text-11-medium text-text-base">{preset.name}</div>
                    <div class="text-10-regular text-text-weaker">{preset.description}</div>
                    <div class="text-9-regular text-text-weaker mt-1 font-mono">{preset.type}</div>
                  </button>
                )}
              </For>
            </div>
          </Show>

          <Show when={addMode() === "custom"}>
            <div class="flex flex-col gap-3">
              <input
                type="text" placeholder="Server name (e.g. my-server)" value={customName()}
                onInput={(e) => setCustomName(e.currentTarget.value)}
                class="px-3 py-2 rounded-xl text-12-regular text-text-base placeholder:text-text-weaker border outline-none"
                style={{ background: "var(--color-background-raised-base)", "border-color": "var(--color-border-weak-base)" }}
              />
              <select
                value={customType()}
                onChange={(e) => setCustomType(e.currentTarget.value as "local" | "remote")}
                class="px-3 py-2 rounded-xl text-12-regular text-text-base border outline-none"
                style={{ background: "var(--color-background-raised-base)", "border-color": "var(--color-border-weak-base)" }}
              >
                <option value="local">Local (Command/stdio)</option>
                <option value="remote">Remote (SSE/HTTP URL)</option>
              </select>
              <Show when={customType() === "local"}>
                <input
                  type="text" placeholder="Command (e.g. npx)" value={customCommand()}
                  onInput={(e) => setCustomCommand(e.currentTarget.value)}
                  class="px-3 py-2 rounded-xl text-12-regular text-text-base placeholder:text-text-weaker border outline-none"
                  style={{ background: "var(--color-background-raised-base)", "border-color": "var(--color-border-weak-base)" }}
                />
                <input
                  type="text" placeholder="Args (space separated, e.g. -y @scope/pkg)" value={customArgs()}
                  onInput={(e) => setCustomArgs(e.currentTarget.value)}
                  class="px-3 py-2 rounded-xl text-12-regular text-text-base placeholder:text-text-weaker border outline-none"
                  style={{ background: "var(--color-background-raised-base)", "border-color": "var(--color-border-weak-base)" }}
                />
              </Show>
              <Show when={customType() === "remote"}>
                <input
                  type="text" placeholder="URL (https://...)" value={customUrl()}
                  onInput={(e) => setCustomUrl(e.currentTarget.value)}
                  class="px-3 py-2 rounded-xl text-12-regular text-text-base placeholder:text-text-weaker border outline-none"
                  style={{ background: "var(--color-background-raised-base)", "border-color": "var(--color-border-weak-base)" }}
                />
              </Show>
              <Show when={addError()}>
                <div class="text-11-regular px-3 py-2 rounded-lg" style={{ color: "#ef4444", background: "rgba(239,68,68,0.08)" }}>
                  {addError()}
                </div>
              </Show>
              <button
                class="px-3 py-2 rounded-xl text-12-medium text-white cursor-pointer transition-opacity hover:opacity-80"
                style={{ background: "#f59e0b" }}
                onClick={addCustom}
                disabled={!customName()}
              >
                Add Server
              </button>
            </div>
          </Show>
        </div>
      </Show>

      {/* Server list */}
      <div class="flex flex-col gap-2">
        <Show when={mcpData.loading}>
          <div class="flex items-center gap-2 py-8 text-11-regular text-text-weaker">
            <div class="size-1.5 rounded-full bg-border-weak-base animate-pulse" />
            Loading MCP servers…
          </div>
        </Show>

        <Show when={!mcpData.loading}>
          <For each={serverEntries().filter(([n]) => !search() || n.toLowerCase().includes(search().toLowerCase()))}>
            {([name, status]) => (
              <div
                class="rounded-xl border overflow-hidden"
                style={{ background: "var(--color-background-surface-base)", "border-color": "var(--color-border-weak-base)" }}
              >
                <div
                  class="flex items-center gap-3 p-3 cursor-pointer select-none"
                  onClick={() => setExpandedName(expandedName() === name ? null : name)}
                >
                  <div class="size-2 rounded-full shrink-0" style={{ background: statusColor(status.status) }} />
                  <div class="flex-1 min-w-0">
                    <div class="text-12-medium text-text-base">{name}</div>
                    <div class="text-10-regular" style={{ color: statusColor(status.status) }}>
                      {statusLabel(status.status)}
                      <Show when={(status as any).error}>
                        <span class="text-text-weaker"> — {(status as any).error}</span>
                      </Show>
                    </div>
                  </div>
                  <Show when={status.status === "needs_auth"}>
                    <button
                      class="px-2 py-1 rounded-lg text-10-medium cursor-pointer"
                      style={{ color: "#f59e0b", background: "rgba(245,158,11,0.1)" }}
                      onClick={(e) => { e.stopPropagation(); triggerAuth(name) }}
                      disabled={actionPending() === name}
                    >
                      Authenticate
                    </button>
                  </Show>
                  <Show when={status.status !== "needs_auth"}>
                    <button
                      class="px-2 py-1 rounded-lg text-10-medium cursor-pointer transition-colors"
                      style={{
                        color: status.status === "connected" ? "#ef4444" : "#10b981",
                        background: status.status === "connected" ? "rgba(239,68,68,0.1)" : "rgba(16,185,129,0.1)",
                      }}
                      onClick={(e) => { e.stopPropagation(); toggleConnect(name, status) }}
                      disabled={actionPending() === name || status.status === "pending"}
                    >
                      {actionPending() === name ? "…" : status.status === "connected" ? "Disconnect" : "Connect"}
                    </button>
                  </Show>
                </div>
                <Show when={expandedName() === name}>
                  <div class="px-3 pb-3 border-t text-10-regular text-text-weaker pt-2" style={{ "border-color": "var(--color-border-weak-base)" }}>
                    Status: <span class="font-mono">{status.status}</span>
                  </div>
                </Show>
              </div>
            )}
          </For>

          <Show when={serverEntries().length === 0}>
            <div class="flex flex-col items-center gap-3 py-12 text-center">
              <div class="text-3xl opacity-30">⊕</div>
              <div class="text-12-medium text-text-base">No MCP servers configured</div>
              <div class="text-11-regular text-text-weaker max-w-xs">
                Add Model Context Protocol servers to give your AI agent access to external tools, APIs, and data sources.
              </div>
              <button
                class="px-4 py-2 rounded-xl text-12-medium text-white cursor-pointer transition-opacity hover:opacity-80 mt-2"
                style={{ background: "#f59e0b" }}
                onClick={() => setShowAdd(true)}
              >
                Add your first server
              </button>
            </div>
          </Show>
        </Show>
      </div>
    </div>
  )
}
