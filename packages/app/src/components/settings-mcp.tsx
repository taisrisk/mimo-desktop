import { Component, createSignal, createResource, For, Show, createMemo } from "solid-js"
import { Button } from "@mimo-ai/ui/button"
import { Icon } from "@mimo-ai/ui/icon"
import { useServer } from "@/context/server"

type McpStatusValue =
  | { status: "connected" }
  | { status: "disabled" }
  | { status: "pending" }
  | { status: "failed"; error: string }
  | { status: "needs_auth" }
  | { status: "needs_client_registration"; error: string }

type McpState = Record<string, McpStatusValue>

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  connected: { color: "#22c55e", label: "Connected" },
  disabled: { color: "#6b7280", label: "Disabled" },
  pending: { color: "#f59e0b", label: "Connecting…" },
  failed: { color: "#ef4444", label: "Failed" },
  needs_auth: { color: "#f59e0b", label: "Needs Auth" },
  needs_client_registration: { color: "#ef4444", label: "Registration" },
}

export const SettingsMcp: Component = () => {
  const server = useServer()
  const [showAddDialog, setShowAddDialog] = createSignal(false)
  const [newName, setNewName] = createSignal("")
  const [newType, setNewType] = createSignal<"local" | "remote">("local")
  const [newCommand, setNewCommand] = createSignal("")
  const [newUrl, setNewUrl] = createSignal("")
  const [addError, setAddError] = createSignal<string | null>(null)
  const [actionPending, setActionPending] = createSignal<string | null>(null)

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

  const handleAdd = async () => {
    if (!newName()) return
    setAddError(null)
    const config = newType() === "local"
      ? { type: "local", command: newCommand().split(" ").filter(Boolean) }
      : { type: "remote", url: newUrl() }
    try {
      const res = await fetch(`${apiUrl()}/mcp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName(), config }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setAddError((body as any)?.error ?? "Failed to add server")
        return
      }
      setShowAddDialog(false)
      setNewName("")
      setNewCommand("")
      setNewUrl("")
      await refetch()
    } catch (e: any) {
      setAddError(e?.message ?? "Network error")
    }
  }

  async function toggleConnect(name: string, status: McpStatusValue) {
    setActionPending(name)
    const endpoint = status.status === "connected" ? "disconnect" : "connect"
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
    <div class="flex flex-col gap-6 p-1">
      <div>
        <h3 class="text-16-bold text-text-strong mb-1">MCP Connector</h3>
        <p class="text-13-regular text-text-weak">
          Connect Model Context Protocol servers to add external tools, APIs, and data sources
        </p>
      </div>

      <div class="flex items-center gap-4">
        <div class="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-weak">
          <div class="size-2 rounded-full bg-green-500" />
          <span class="text-12-medium text-text-base">{connectedCount()} connected</span>
        </div>
        <span class="text-12-regular text-text-weak">of {serverEntries().length} servers</span>
        <div class="flex-1" />
        <Button variant="primary" onClick={() => { setShowAddDialog(true); setAddError(null) }}>
          <Icon name="plus" />
          Add MCP Server
        </Button>
      </div>

      <Show when={showAddDialog()}>
        <div class="flex flex-col gap-4 p-4 rounded-xl border border-border-interactive bg-surface-base">
          <h4 class="text-14-bold text-text-strong">Add New MCP Server</h4>
          <div class="flex flex-col gap-2">
            <label class="text-12-medium text-text-base">Server Name</label>
            <input
              type="text"
              placeholder="e.g. filesystem, github, postgres"
              value={newName()}
              onInput={(e) => setNewName(e.currentTarget.value)}
              class="px-3 py-2 rounded-lg border border-border-base bg-surface-base text-text-base text-13-regular focus:outline-none focus:border-border-interactive"
            />
          </div>
          <div class="flex flex-col gap-2">
            <label class="text-12-medium text-text-base">Connection Type</label>
            <div class="flex gap-2">
              <button
                class={`px-4 py-2 rounded-lg border text-13-medium transition-colors ${newType() === "local" ? "border-border-interactive bg-surface-interactive text-text-interactive" : "border-border-base bg-surface-base text-text-base"}`}
                onClick={() => setNewType("local")}
              >
                Local (stdio)
              </button>
              <button
                class={`px-4 py-2 rounded-lg border text-13-medium transition-colors ${newType() === "remote" ? "border-border-interactive bg-surface-interactive text-text-interactive" : "border-border-base bg-surface-base text-text-base"}`}
                onClick={() => setNewType("remote")}
              >
                Remote (SSE/HTTP)
              </button>
            </div>
          </div>
          <Show when={newType() === "local"}>
            <div class="flex flex-col gap-2">
              <label class="text-12-medium text-text-base">Command</label>
              <input
                type="text"
                placeholder="e.g. npx -y @modelcontextprotocol/server-filesystem /path"
                value={newCommand()}
                onInput={(e) => setNewCommand(e.currentTarget.value)}
                class="px-3 py-2 rounded-lg border border-border-base bg-surface-base text-text-base text-13-regular font-mono focus:outline-none focus:border-border-interactive"
              />
            </div>
          </Show>
          <Show when={newType() === "remote"}>
            <div class="flex flex-col gap-2">
              <label class="text-12-medium text-text-base">URL</label>
              <input
                type="text"
                placeholder="e.g. https://mcp.linear.app/sse"
                value={newUrl()}
                onInput={(e) => setNewUrl(e.currentTarget.value)}
                class="px-3 py-2 rounded-lg border border-border-base bg-surface-base text-text-base text-13-regular font-mono focus:outline-none focus:border-border-interactive"
              />
            </div>
          </Show>
          <Show when={addError()}>
            <div class="text-12-regular px-3 py-2 rounded-lg" style={{ color: "#ef4444", background: "rgba(239,68,68,0.08)" }}>
              {addError()}
            </div>
          </Show>
          <div class="flex items-center gap-2 mt-2">
            <Button variant="primary" onClick={handleAdd} disabled={!newName()}>
              Connect
            </Button>
            <Button variant="ghost" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </Show>

      <div class="flex flex-col gap-1">
        <Show when={mcpData.loading}>
          <div class="flex items-center gap-2 py-8 text-12-regular text-text-weaker">
            <div class="size-1.5 rounded-full bg-border-weak-base animate-pulse" />
            Loading…
          </div>
        </Show>
        <Show when={!mcpData.loading && serverEntries().length === 0}>
          <div class="text-center py-8 text-13-regular text-text-weak">
            No MCP servers configured. Add one to get started.
          </div>
        </Show>
        <For each={serverEntries()}>
          {([name, status]) => {
            const cfg = STATUS_CONFIG[status.status] ?? { color: "#6b7280", label: status.status }
            return (
              <div class="flex items-center gap-3 p-3 rounded-lg border border-border-base hover:border-border-interactive transition-colors">
                <div class="size-2 rounded-full shrink-0" style={{ "background-color": cfg.color }} />
                <div class="flex-1 min-w-0">
                  <div class="text-13-medium text-text-strong">{name}</div>
                  <Show when={(status as any).error}>
                    <div class="text-11-regular text-text-weaker truncate">{(status as any).error}</div>
                  </Show>
                </div>
                <Show when={status.status === "needs_auth"}>
                  <button
                    class="px-2 py-1 rounded-lg text-11-medium cursor-pointer"
                    style={{ color: "#f59e0b", background: "rgba(245,158,11,0.1)" }}
                    onClick={() => triggerAuth(name)}
                    disabled={actionPending() === name}
                  >
                    Authenticate
                  </button>
                </Show>
                <span
                  class="text-11-regular shrink-0 px-2 py-0.5 rounded-full"
                  style={{ "background-color": `${cfg.color}20`, color: cfg.color }}
                >
                  {cfg.label}
                </span>
                <Show when={status.status !== "needs_auth" && status.status !== "pending"}>
                  <button
                    class="text-11-medium px-2 py-1 rounded-lg cursor-pointer shrink-0"
                    style={{
                      color: status.status === "connected" ? "#ef4444" : "#10b981",
                      background: status.status === "connected" ? "rgba(239,68,68,0.08)" : "rgba(16,185,129,0.08)",
                    }}
                    onClick={() => toggleConnect(name, status)}
                    disabled={actionPending() === name}
                  >
                    {actionPending() === name ? "…" : status.status === "connected" ? "Disconnect" : "Connect"}
                  </button>
                </Show>
              </div>
            )
          }}
        </For>
      </div>

      <div class="flex flex-col gap-2 mt-4 p-4 rounded-xl bg-surface-weak">
        <h4 class="text-13-bold text-text-base">About MCP</h4>
        <p class="text-12-regular text-text-weak">
          Model Context Protocol (MCP) servers provide tools, resources, and prompts to AI assistants.
          Many providers offer their own MCP servers with pre-built integrations for GitHub, databases,
          search, and more.
        </p>
      </div>
    </div>
  )
}
