import { createSignal, createMemo, For, Show, onMount, onCleanup } from "solid-js"
import { DateTime } from "luxon"

export type AgentStatus = "active" | "thinking" | "waiting" | "idle" | "done" | "error"
export type SubAgent = {
  id: string
  label: string
  status: AgentStatus
  task: string
  parentId?: string
  startedAt: number
  messages: number
  tokensUsed: number
  toolsUsed: string[]
  currentStep?: string
  result?: string
}

const STATUS_META: Record<AgentStatus, { color: string; icon: string; label: string }> = {
  active: { color: "#10b981", icon: "●", label: "Active" },
  thinking: { color: "#8b5cf6", icon: "◎", label: "Thinking" },
  waiting: { color: "#f59e0b", icon: "◉", label: "Waiting" },
  idle: { color: "#6b7280", icon: "○", label: "Idle" },
  done: { color: "#3b82f6", icon: "✓", label: "Done" },
  error: { color: "#ef4444", icon: "✗", label: "Error" },
}

function elapsed(ms: number) {
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${s % 60}s`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

function AgentNode(props: {
  agent: SubAgent
  children: SubAgent[]
  now: number
  depth: number
  onStop: (id: string) => void
  onSelect: (id: string) => void
  selectedId: string | null
}) {
  const meta = () => STATUS_META[props.agent.status]
  const isActive = () => props.agent.status === "active" || props.agent.status === "thinking"
  const time = () => elapsed(props.now - props.agent.startedAt)
  const isSelected = () => props.selectedId === props.agent.id

  return (
    <div style={{ "padding-left": `${props.depth * 16 + 8}px` }} class="pr-2">
      <div
        class="group flex items-start gap-2.5 py-2 px-2.5 rounded-xl cursor-pointer transition-all"
        classList={{
          "bg-amber-500/8 border border-amber-500/20": isSelected(),
          "hover:bg-background-surface-base border border-transparent": !isSelected(),
        }}
        onClick={() => props.onSelect(props.agent.id)}
      >
        {/* Status indicator */}
        <div class="mt-1 relative shrink-0">
          <div
            class="size-2.5 rounded-full"
            classList={{ "animate-pulse": isActive() }}
            style={{ background: meta().color }}
          />
          <Show when={isActive()}>
            <div class="absolute inset-0 rounded-full animate-ping opacity-30" style={{ background: meta().color }} />
          </Show>
        </div>

        {/* Content */}
        <div class="flex-1 min-w-0 flex flex-col gap-0.5">
          <div class="flex items-center gap-2">
            <span class="text-12-medium text-text-base truncate">{props.agent.label}</span>
            <span class="text-9-regular px-1.5 py-0 rounded-full" style={{ background: `${meta().color}18`, color: meta().color }}>
              {meta().label}
            </span>
          </div>

          <div class="text-11-regular text-text-weak truncate">{props.agent.task}</div>

          <Show when={props.agent.currentStep && isActive()}>
            <div class="flex items-center gap-1.5 mt-0.5">
              <div class="h-1 w-16 rounded-full bg-background-base overflow-hidden">
                <div class="h-full rounded-full bg-amber-500 animate-pulse" style={{ width: "60%" }} />
              </div>
              <span class="text-9-regular text-text-weaker truncate">{props.agent.currentStep}</span>
            </div>
          </Show>

          <div class="flex items-center gap-3 text-9-regular text-text-weaker mt-0.5">
            <span>{time()}</span>
            <span>{props.agent.messages} msgs</span>
            <span>{props.agent.tokensUsed > 1000 ? `${(props.agent.tokensUsed / 1000).toFixed(1)}K` : props.agent.tokensUsed} tok</span>
            <Show when={props.agent.toolsUsed.length > 0}>
              <span>{props.agent.toolsUsed.length} tools</span>
            </Show>
          </div>

          <Show when={props.agent.result}>
            <div class="text-10-regular text-emerald-400 mt-0.5 truncate">{props.agent.result}</div>
          </Show>
        </div>

        {/* Actions */}
        <Show when={isActive()}>
          <button
            class="text-9-regular text-text-weaker hover:text-red-400 opacity-0 group-hover:opacity-100
                   transition-all px-1.5 py-0.5 rounded hover:bg-red-500/10 shrink-0"
            onClick={(e) => { e.stopPropagation(); props.onStop(props.agent.id) }}
          >
            stop
          </button>
        </Show>
      </div>

      {/* Children */}
      <For each={props.children}>
        {(child) => (
          <AgentNode
            agent={child}
            children={[]}
            now={props.now}
            depth={props.depth + 1}
            onStop={props.onStop}
            onSelect={props.onSelect}
            selectedId={props.selectedId}
          />
        )}
      </For>
    </div>
  )
}

export function AgentOrchestrator(props?: { agents?: SubAgent[] }) {
  const [tick, setTick] = createSignal(Date.now())
  const [selectedId, setSelectedId] = createSignal<string | null>(null)
  let timer: ReturnType<typeof setInterval>
  onMount(() => { timer = setInterval(() => setTick(Date.now()), 1000) })
  onCleanup(() => clearInterval(timer))

  const agents = createMemo(() => props?.agents ?? [
    { id: "a1", label: "Orchestrator", status: "active" as const, task: "Coordinating Mimo Desktop UI rebuild with 6 concurrent workstreams", startedAt: Date.now() - 180000, messages: 47, tokensUsed: 12400, toolsUsed: ["read_file", "edit_file", "grep", "glob"], currentStep: "Analyzing component architecture" },
    { id: "a2", label: "Workflow Builder", status: "thinking" as const, task: "Building n8n-style visual workflow editor with node canvas", startedAt: Date.now() - 120000, messages: 31, tokensUsed: 8900, toolsUsed: ["write_file", "read_file"], parentId: "a1", currentStep: "Generating canvas renderer" },
    { id: "a3", label: "Memory Engine", status: "done" as const, task: "Persistent memory system with semantic search", startedAt: Date.now() - 90000, messages: 22, tokensUsed: 6200, toolsUsed: ["write_file"], parentId: "a1", result: "Completed: 8 memory types with auto-matching" },
    { id: "a4", label: "Style Auditor", status: "active" as const, task: "Scanning all components for consistent Mimo theme tokens", startedAt: Date.now() - 60000, messages: 15, tokensUsed: 3400, toolsUsed: ["grep", "read_file"], parentId: "a1", currentStep: "Checking CSS variable usage" },
    { id: "a5", label: "i18n Patcher", status: "done" as const, task: "Replace all OpenCode references in 14 locale files", startedAt: Date.now() - 150000, messages: 28, tokensUsed: 5100, toolsUsed: ["edit_file", "grep"], parentId: "a1", result: "Completed: 280+ string replacements" },
    { id: "a6", label: "Security Scanner", status: "idle" as const, task: "Audit new components for OWASP patterns", startedAt: Date.now() - 30000, messages: 4, tokensUsed: 800, toolsUsed: ["read_file"], parentId: "a1" },
  ])

  const selectedAgent = createMemo(() => agents().find((a) => a.id === selectedId()))
  const roots = () => agents().filter((a) => !a.parentId)
  const children = (parentId: string) => agents().filter((a) => a.parentId === parentId)
  const activeCount = () => agents().filter((a) => a.status === "active" || a.status === "thinking").length
  const totalTokens = () => agents().reduce((sum, a) => sum + a.tokensUsed, 0)

  return (
    <div class="flex flex-col h-full overflow-hidden">
      {/* Header stats */}
      <div class="flex items-center gap-3 px-3 py-2 border-b border-border-weak-base shrink-0">
        <div class="flex items-center gap-1.5">
          <div class="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span class="text-10-regular text-text-weak">{activeCount()} active</span>
        </div>
        <span class="text-9-regular text-text-weaker">·</span>
        <span class="text-10-regular text-text-weak">{agents().length} agents</span>
        <span class="text-9-regular text-text-weaker">·</span>
        <span class="text-10-regular text-text-weak">{(totalTokens() / 1000).toFixed(1)}K tokens</span>
        <button
          class="ml-auto text-10-regular text-red-400 hover:text-red-300 transition-colors"
          onClick={() => {}}
        >
          Stop All
        </button>
      </div>

      {/* Agent tree */}
      <div class="flex-1 overflow-y-auto py-1">
        <For each={roots()}>
          {(agent) => (
            <AgentNode
              agent={agent}
              children={children(agent.id)}
              now={tick()}
              depth={0}
              onStop={() => {}}
              onSelect={setSelectedId}
              selectedId={selectedId()}
            />
          )}
        </For>
      </div>

      {/* Detail panel */}
      <Show when={selectedAgent()}>
        {(agent) => (
          <div class="border-t border-border-weak-base px-3 py-2 shrink-0 bg-background-surface-base">
            <div class="flex items-center gap-2 mb-1.5">
              <span class="text-12-medium text-text-base">{agent().label}</span>
              <span class="text-9-regular px-1.5 py-0 rounded-full"
                    style={{ background: `${STATUS_META[agent().status].color}18`, color: STATUS_META[agent().status].color }}>
                {STATUS_META[agent().status].label}
              </span>
            </div>
            <div class="text-11-regular text-text-weak mb-1.5">{agent().task}</div>
            <Show when={agent().toolsUsed.length > 0}>
              <div class="flex items-center gap-1 flex-wrap">
                <span class="text-9-regular text-text-weaker">Tools:</span>
                <For each={agent().toolsUsed}>
                  {(tool) => (
                    <span class="text-9-regular px-1.5 py-0 rounded bg-background-base text-text-weaker">{tool}</span>
                  )}
                </For>
              </div>
            </Show>
          </div>
        )}
      </Show>
    </div>
  )
}
