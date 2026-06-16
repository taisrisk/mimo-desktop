/**
 * Mimo Sub-Agent Monitor
 * Real-time visual hierarchy of active sub-agents: their assignments,
 * status, and communication links.
 */
import { createSignal, For, Show, createMemo, onCleanup, onMount } from "solid-js"

export type AgentStatus = "active" | "waiting" | "idle" | "done" | "error"

export type SubAgent = {
  id: string
  label: string
  status: AgentStatus
  task?: string
  parentId?: string
  startedAt?: number
  messages?: number
}

type Props = {
  agents?: SubAgent[]
  onStopAgent?: (id: string) => void
  onStopAll?: () => void
}

const STATUS_LABEL: Record<AgentStatus, string> = {
  active: "Active",
  waiting: "Waiting",
  idle: "Idle",
  done: "Done",
  error: "Error",
}

function elapsed(ms: number): string {
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${s % 60}s`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

export function SubAgentPanel(props: Props) {
  const [now, setNow] = createSignal(Date.now())
  let interval: ReturnType<typeof setInterval>

  // ⚡ Bolt: Memory Leak Fix
  // Wrapping setInterval in onMount and explicitly cleaning it up in onCleanup
  // prevents multiple intervals from accumulating when the component is repeatedly mounted/unmounted.
  // This reduces unnecessary background CPU usage and eliminates a memory leak over time.
  onMount(() => {
    interval = setInterval(() => setNow(Date.now()), 1000)
  })

  onCleanup(() => {
    clearInterval(interval)
  })

  const agents = () => props.agents ?? DEMO_AGENTS

  const roots = createMemo(() => agents().filter((a) => !a.parentId))
  const children = (parentId: string) => agents().filter((a) => a.parentId === parentId)

  const activeCount = createMemo(() => agents().filter((a) => a.status === "active").length)

  return (
    <div class="mimo-panel">
      <div class="mimo-panel-header">
        <span class="mimo-panel-title">Sub-Agents</span>
        <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
          <Show when={activeCount() > 0}>
            <span
              class="mimo-agent-badge mimo-agent-badge--active"
              style={{ "font-size": "10px", padding: "1px 6px" }}
            >
              <span class="mimo-agent-dot mimo-agent-dot--pulse" />
              {activeCount()} active
            </span>
          </Show>
          <Show when={agents().length > 0 && props.onStopAll}>
            <button
              type="button"
              onClick={() => props.onStopAll?.()}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                "font-size": "10px",
                color: "var(--text-weak)",
                padding: "2px 4px",
                "border-radius": "4px",
              }}
              title="Stop all agents"
            >
              Stop all
            </button>
          </Show>
        </div>
      </div>

      <div class="mimo-panel-body">
        <Show
          when={agents().length > 0}
          fallback={
            <div class="mimo-empty-state">
              <span class="mimo-empty-state-icon">⬡</span>
              <span>No active sub-agents. They appear here during multi-agent tasks.</span>
            </div>
          }
        >
          <For each={roots()}>
            {(agent) => (
              <AgentNode
                agent={agent}
                now={now()}
                children={children(agent.id)}
                onStop={props.onStopAgent}
                depth={0}
              />
            )}
          </For>
        </Show>
      </div>
    </div>
  )
}

function AgentNode(props: {
  agent: SubAgent
  now: number
  children: SubAgent[]
  onStop?: (id: string) => void
  depth: number
}) {
  const { agent } = props
  const age = () => (agent.startedAt ? elapsed(props.now - agent.startedAt) : undefined)

  const badgeClass = () => {
    if (agent.status === "active") return "mimo-agent-badge mimo-agent-badge--active"
    if (agent.status === "waiting") return "mimo-agent-badge mimo-agent-badge--waiting"
    return "mimo-agent-badge mimo-agent-badge--idle"
  }

  return (
    <div
      style={{
        "padding-left": `${props.depth * 16}px`,
        "margin-bottom": "4px",
      }}
    >
      <div
        style={{
          display: "flex",
          "align-items": "flex-start",
          gap: "8px",
          padding: "8px 10px",
          "border-radius": "8px",
          background: agent.status === "active" ? "rgba(74,222,128,0.04)" : "transparent",
          border: "1px solid transparent",
          transition: "background 150ms",
          cursor: "default",
        }}
      >
        {/* Connection line for children */}
        <Show when={props.depth > 0}>
          <div
            style={{
              position: "absolute",
              left: `${(props.depth - 1) * 16 + 18}px`,
              width: "12px",
              height: "1px",
              background: "var(--border-weak-base, rgba(0,0,0,0.07))",
              "margin-top": "10px",
            }}
          />
        </Show>

        <div style={{ flex: "1", "min-width": "0" }}>
          <div style={{ display: "flex", "align-items": "center", gap: "6px", "flex-wrap": "wrap" }}>
            <span
              style={{
                "font-size": "12px",
                "font-weight": "500",
                color: "var(--text-strong)",
                "white-space": "nowrap",
              }}
            >
              {agent.label}
            </span>
            <span class={badgeClass()}>
              <Show when={agent.status === "active"}>
                <span class="mimo-agent-dot mimo-agent-dot--pulse" />
              </Show>
              {STATUS_LABEL[agent.status]}
            </span>
            <Show when={age()}>
              <span style={{ "font-size": "10px", color: "var(--text-weak)" }}>{age()}</span>
            </Show>
          </div>

          <Show when={agent.task}>
            <div
              style={{
                "font-size": "11px",
                color: "var(--text-weak)",
                "margin-top": "2px",
                overflow: "hidden",
                "text-overflow": "ellipsis",
                "white-space": "nowrap",
              }}
            >
              {agent.task}
            </div>
          </Show>

          <Show when={agent.messages !== undefined && agent.messages > 0}>
            <div style={{ "font-size": "10px", color: "var(--text-weak)", "margin-top": "2px" }}>
              {agent.messages} {agent.messages === 1 ? "message" : "messages"}
            </div>
          </Show>
        </div>

        <Show when={agent.status === "active" && props.onStop}>
          <button
            type="button"
            onClick={() => props.onStop!(agent.id)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              "font-size": "11px",
              color: "var(--text-weak)",
              padding: "2px 6px",
              "border-radius": "4px",
              "flex-shrink": "0",
            }}
            title="Stop agent"
          >
            ✕
          </button>
        </Show>
      </div>

      {/* Render children */}
      <Show when={props.children.length > 0}>
        <For each={props.children}>
          {(child) => (
            <AgentNode
              agent={child}
              now={props.now}
              children={[]}
              onStop={props.onStop}
              depth={props.depth + 1}
            />
          )}
        </For>
      </Show>
    </div>
  )
}

const DEMO_AGENTS: SubAgent[] = [
  {
    id: "orchestrator",
    label: "Orchestrator",
    status: "active",
    task: "Coordinating parallel file analysis",
    startedAt: Date.now() - 45000,
    messages: 12,
  },
  {
    id: "agent-a",
    label: "Analyzer A",
    status: "active",
    task: "Reading src/main/index.ts",
    parentId: "orchestrator",
    startedAt: Date.now() - 30000,
    messages: 4,
  },
  {
    id: "agent-b",
    label: "Analyzer B",
    status: "waiting",
    task: "Pending: Review packages/ui/src",
    parentId: "orchestrator",
    startedAt: Date.now() - 28000,
    messages: 2,
  },
]
