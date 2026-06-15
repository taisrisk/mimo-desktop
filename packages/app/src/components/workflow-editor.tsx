import { createSignal, createMemo, For, Show, onMount, onCleanup } from "solid-js"
import { createStore, produce } from "solid-js/store"
import { DateTime } from "luxon"

// ─── Types ────────────────────────────────────────────────────────────────────

export type NodeType =
  | "trigger"
  | "prompt"
  | "tool"
  | "agent"
  | "condition"
  | "code"
  | "http"
  | "transform"
  | "output"
  | "memory-read"
  | "memory-write"
  | "branch"
  | "loop"
  | "delay"
  | "webhook"

export type WorkflowNode = {
  id: string
  type: NodeType
  label: string
  x: number
  y: number
  config?: Record<string, string>
  inputs?: string[]
  outputs?: string[]
}

export type WorkflowConnection = {
  id: string
  from: string
  fromPort: number
  to: string
  toPort: number
  label?: string
}

export type WorkflowDef = {
  id: string
  name: string
  description?: string
  nodes: WorkflowNode[]
  connections: WorkflowConnection[]
  lastRun?: number
  status?: "idle" | "running" | "error" | "complete"
  tags?: string[]
}

export type NodeTemplate = {
  type: NodeType
  label: string
  category: string
  icon: string
  color: string
  description: string
  defaultConfig?: Record<string, string>
}

// ─── Node Templates ───────────────────────────────────────────────────────────

const NODE_CATEGORIES = ["Triggers", "AI", "Logic", "Data", "Actions", "Memory"] as const

const NODE_TEMPLATES: NodeTemplate[] = [
  { type: "trigger", label: "Manual Trigger", category: "Triggers", icon: "▶", color: "#10b981", description: "Start workflow manually", defaultConfig: {} },
  { type: "webhook", label: "Webhook", category: "Triggers", icon: "⊙", color: "#10b981", description: "HTTP webhook trigger", defaultConfig: { method: "POST", path: "/hook" } },
  { type: "prompt", label: "LLM Prompt", category: "AI", icon: "✦", color: "#8b5cf6", description: "Send prompt to language model", defaultConfig: { model: "default", temperature: "0.7" } },
  { type: "agent", label: "Sub-Agent", category: "AI", icon: "◎", color: "#6366f1", description: "Spawn autonomous sub-agent", defaultConfig: { role: "coder", maxSteps: "10" } },
  { type: "tool", label: "Tool Call", category: "AI", icon: "⚙", color: "#f59e0b", description: "Execute a registered tool", defaultConfig: { tool: "" } },
  { type: "condition", label: "Condition", category: "Logic", icon: "◆", color: "#ec4899", description: "Branch on condition", defaultConfig: { expression: "" } },
  { type: "branch", label: "Parallel Split", category: "Logic", icon: "⟡", color: "#ec4899", description: "Run branches in parallel", defaultConfig: { branches: "2" } },
  { type: "loop", label: "Loop", category: "Logic", icon: "↻", color: "#ec4899", description: "Repeat until condition", defaultConfig: { maxIterations: "5" } },
  { type: "code", label: "Code Exec", category: "Data", icon: "⟨/⟩", color: "#3b82f6", description: "Run JavaScript/TypeScript", defaultConfig: { language: "typescript" } },
  { type: "http", label: "HTTP Request", category: "Data", icon: "⇄", color: "#3b82f6", description: "Make HTTP request", defaultConfig: { method: "GET", url: "" } },
  { type: "transform", label: "Transform", category: "Data", icon: "⇌", color: "#3b82f6", description: "Map/transform data", defaultConfig: { expression: "" } },
  { type: "memory-read", label: "Memory Search", category: "Memory", icon: "◇", color: "#f97316", description: "Search persistent memory", defaultConfig: { query: "", limit: "5" } },
  { type: "memory-write", label: "Memory Store", category: "Memory", icon: "◆", color: "#f97316", description: "Write to persistent memory", defaultConfig: { type: "insight", content: "" } },
  { type: "output", label: "Output", category: "Actions", icon: "↗", color: "#10b981", description: "Return final output", defaultConfig: {} },
  { type: "delay", label: "Delay", category: "Actions", icon: "◷", color: "#6b7280", description: "Wait before continuing", defaultConfig: { duration: "1000" } },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

const NODE_COLORS: Record<NodeType, string> = {
  trigger: "#10b981", webhook: "#10b981",
  prompt: "#8b5cf6", agent: "#6366f1", tool: "#f59e0b",
  condition: "#ec4899", branch: "#ec4899", loop: "#ec4899",
  code: "#3b82f6", http: "#3b82f6", transform: "#3b82f6",
  "memory-read": "#f97316", "memory-write": "#f97316",
  output: "#10b981", delay: "#6b7280",
}

const NODE_ICONS: Record<NodeType, string> = {
  trigger: "▶", webhook: "⊙", prompt: "✦", agent: "◎", tool: "⚙",
  condition: "◆", branch: "⟡", loop: "↻", code: "⟨/⟩", http: "⇄",
  transform: "⇌", "memory-read": "◇", "memory-write": "◆", output: "↗", delay: "◷",
}

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

// ─── Node Palette ─────────────────────────────────────────────────────────────

function NodePalette(props: { onAdd: (type: NodeType) => void }) {
  const [expandedCat, setExpandedCat] = createSignal<string | null>("Triggers")

  const byCategory = createMemo(() => {
    const map = new Map<string, NodeTemplate[]>()
    for (const cat of NODE_CATEGORIES) map.set(cat, [])
    for (const t of NODE_TEMPLATES) map.get(t.category)?.push(t)
    return map
  })

  return (
    <div class="flex flex-col gap-0 overflow-y-auto flex-1 p-2">
      <div class="px-2 pb-2 text-10-medium text-text-weaker uppercase tracking-widest">Node Palette</div>
      <For each={NODE_CATEGORIES}>
        {(cat) => {
          const items = () => byCategory().get(cat) ?? []
          const open = () => expandedCat() === cat
          return (
            <div>
              <button
                class="w-full flex items-center justify-between px-2 py-1.5 text-11-medium text-text-weak
                       hover:text-text-base rounded-md transition-colors"
                onClick={() => setExpandedCat(open() ? null : cat)}
              >
                <span>{cat}</span>
                <svg
                  viewBox="0 0 20 20" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1.5"
                  class="transition-transform"
                  style={{ transform: open() ? "rotate(90deg)" : "rotate(0deg)" }}
                >
                  <path d="M7 4L13 10L7 16" />
                </svg>
              </button>
              <Show when={open()}>
                <div class="flex flex-col gap-0.5 pb-1">
                  <For each={items()}>
                    {(tpl) => (
                      <button
                        class="flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-all
                               hover:bg-background-surface-base group"
                        onClick={() => props.onAdd(tpl.type)}
                      >
                        <div
                          class="size-6 rounded-md flex items-center justify-center text-11-medium shrink-0
                                 group-hover:scale-110 transition-transform"
                          style={{ background: `${tpl.color}20`, color: tpl.color }}
                        >
                          {tpl.icon}
                        </div>
                        <div class="flex flex-col gap-0 min-w-0">
                          <div class="text-11-medium text-text-base truncate">{tpl.label}</div>
                          <div class="text-9-regular text-text-weaker truncate">{tpl.description}</div>
                        </div>
                      </button>
                    )}
                  </For>
                </div>
              </Show>
            </div>
          )
        }}
      </For>
    </div>
  )
}

// ─── Node Component ───────────────────────────────────────────────────────────

function WorkflowNodeCard(props: {
  node: WorkflowNode
  selected: boolean
  onSelect: () => void
  onDelete: () => void
  onDragStart: (e: MouseEvent) => void
  scale: () => number
}) {
  const color = () => NODE_COLORS[props.node.type]
  const icon = () => NODE_ICONS[props.node.type]
  const isTrigger = () => props.node.type === "trigger"
  const isOutput = () => props.node.type === "output"

  return (
    <div
      class="absolute select-none cursor-pointer"
      style={{
        left: `${props.node.x}px`,
        top: `${props.node.y}px`,
        transform: `scale(${props.scale()})`,
        "transform-origin": "top left",
      }}
      onMouseDown={(e) => {
        e.stopPropagation()
        props.onSelect()
        props.onDragStart(e)
      }}
    >
      {/* Connection ports */}
      <Show when={!isTrigger()}>
        <div
          class="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 z-10
                 hover:scale-150 transition-transform"
          style={{ background: "var(--background-base)", "border-color": color() }}
          title="Input"
        />
      </Show>
      <Show when={!isOutput()}>
        <div
          class="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 z-10
                 hover:scale-150 transition-transform"
          style={{ background: color(), "border-color": color() }}
          title="Output"
        />
      </Show>

      {/* Node body */}
      <div
        class="rounded-xl border transition-all duration-150 min-w-[140px] max-w-[200px]"
        style={{
          background: props.selected ? `${color()}12` : "var(--color-background-surface-base)",
          "border-color": props.selected ? color() : "var(--color-border-weak-base)",
          "box-shadow": props.selected ? `0 0 0 1px ${color()}40, 0 4px 12px ${color()}15` : "0 1px 3px rgba(0,0,0,0.12)",
        }}
      >
        {/* Header */}
        <div
          class="flex items-center gap-1.5 px-3 py-2 rounded-t-xl border-b"
          style={{ background: `${color()}10`, "border-color": "var(--color-border-weak-base)" }}
        >
          <div
            class="size-5 rounded-md flex items-center justify-center text-10-medium shrink-0"
            style={{ background: `${color()}25`, color: color() }}
          >
            {icon()}
          </div>
          <div class="text-11-medium text-text-base truncate flex-1">{props.node.label}</div>
          <button
            class="size-4 rounded flex items-center justify-center opacity-0 group-hover:opacity-100
                   hover:bg-red-500/20 transition-all text-text-weaker hover:text-red-400"
            onClick={(e) => { e.stopPropagation(); props.onDelete() }}
          >
            <svg viewBox="0 0 20 20" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M4 4L16 16M16 4L4 16" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div class="px-3 py-2 flex flex-col gap-1">
          <Show when={props.node.config && Object.keys(props.node.config).length > 0}>
            <For each={Object.entries(props.node.config ?? {}).slice(0, 3)}>
              {([key, val]) => (
                <div class="flex items-center gap-1.5 text-9-regular">
                  <span class="text-text-weaker">{key}:</span>
                  <span class="text-text-weak truncate">{val}</span>
                </div>
              )}
            </For>
          </Show>
        </div>
      </div>
    </div>
  )
}

// ─── Connection Lines (SVG) ───────────────────────────────────────────────────

function ConnectionLines(props: {
  nodes: WorkflowNode[]
  connections: WorkflowConnection[]
  scale: () => number
  panX: () => number
  panY: () => number
}) {
  const nodeMap = createMemo(() => {
    const m = new Map<string, WorkflowNode>()
    for (const n of props.nodes) m.set(n.id, n)
    return m
  })

  function getConnectionPath(conn: WorkflowConnection) {
    const from = nodeMap().get(conn.from)
    const to = nodeMap().get(conn.to)
    if (!from || !to) return ""

    const fromX = from.x + 70
    const fromY = from.y + 70
    const toX = to.x + 70
    const toY = to.y

    const dy = Math.abs(toY - fromY) * 0.5
    return `M${fromX},${fromY} C${fromX},${fromY + dy} ${toX},${toY - dy} ${toX},${toY}`
  }

  return (
    <svg
      class="absolute inset-0 pointer-events-none"
      style={{ width: "5000px", height: "5000px", overflow: "visible" }}
    >
      <defs>
        <linearGradient id="conn-gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#8b5cf6" stop-opacity="0.6" />
          <stop offset="100%" stop-color="#f59e0b" stop-opacity="0.6" />
        </linearGradient>
      </defs>
      <For each={props.connections}>
        {(conn) => {
          const d = getConnectionPath(conn)
          if (!d) return null
          return (
            <g>
              <path d={d} fill="none" stroke="url(#conn-gradient)" stroke-width="2" stroke-linecap="round" opacity="0.4" />
              <path d={d} fill="none" stroke="var(--color-border-base)" stroke-width="1" stroke-dasharray="4 3" opacity="0.6" />
              <Show when={conn.label}>
                <text
                  x={(() => {
                    const from = nodeMap().get(conn.from)
                    const to = nodeMap().get(conn.to)
                    if (!from || !to) return 0
                    return (from.x + to.x) / 2 + 70
                  })()}
                  y={(() => {
                    const from = nodeMap().get(conn.from)
                    const to = nodeMap().get(conn.to)
                    if (!from || !to) return 0
                    return (from.y + to.y) / 2 + 35
                  })()}
                  fill="var(--color-text-weaker)"
                  font-size="9"
                  text-anchor="middle"
                >
                  {conn.label}
                </text>
              </Show>
            </g>
          )
        }}
      </For>
    </svg>
  )
}

// ─── Properties Panel ─────────────────────────────────────────────────────────

function PropertiesPanel(props: {
  node: WorkflowNode | null
  onUpdate: (id: string, updates: Partial<WorkflowNode>) => void
  onClose: () => void
}) {
  return (
    <Show when={props.node}>
      {(node) => (
        <div class="flex flex-col h-full">
          <div class="flex items-center justify-between px-3 py-2 border-b border-border-weak-base">
            <div class="flex items-center gap-2">
              <div
                class="size-5 rounded-md flex items-center justify-center text-10-medium"
                style={{ background: `${NODE_COLORS[node().type]}25`, color: NODE_COLORS[node().type] }}
              >
                {NODE_ICONS[node().type]}
              </div>
              <span class="text-12-medium text-text-base">Properties</span>
            </div>
            <button class="text-text-weaker hover:text-text-base transition-colors" onClick={props.onClose}>
              <svg viewBox="0 0 20 20" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
                <path d="M4 4L16 16M16 4L4 16" />
              </svg>
            </button>
          </div>

          <div class="flex flex-col gap-3 p-3 overflow-y-auto flex-1">
            {/* Label */}
            <div class="flex flex-col gap-1">
              <label class="text-10-medium text-text-weaker uppercase tracking-wider">Label</label>
              <input
                class="px-2 py-1.5 rounded-lg bg-background-surface-base border border-border-weak-base
                       text-12-regular text-text-base outline-none focus:border-border-base transition-colors"
                value={node().label}
                onInput={(e) => props.onUpdate(node().id, { label: e.currentTarget.value })}
              />
            </div>

            {/* Type */}
            <div class="flex flex-col gap-1">
              <label class="text-10-medium text-text-weaker uppercase tracking-wider">Type</label>
              <div
                class="px-2 py-1.5 rounded-lg text-12-regular border"
                style={{ background: `${NODE_COLORS[node().type]}10`, color: NODE_COLORS[node().type],
                         "border-color": `${NODE_COLORS[node().type]}30` }}
              >
                {node().type}
              </div>
            </div>

            {/* Config fields */}
            <Show when={node().config && Object.keys(node().config!).length > 0}>
              <div class="text-10-medium text-text-weaker uppercase tracking-wider pt-1">Configuration</div>
              <For each={Object.entries(node().config!)}>
                {([key, val]) => (
                  <div class="flex flex-col gap-1">
                    <label class="text-10-regular text-text-weaker">{key}</label>
                    <input
                      class="px-2 py-1.5 rounded-lg bg-background-surface-base border border-border-weak-base
                             text-11-regular text-text-base outline-none focus:border-border-base transition-colors"
                      value={val}
                      onInput={(e) => {
                        const config = { ...node().config, [key]: e.currentTarget.value }
                        props.onUpdate(node().id, { config })
                      }}
                    />
                  </div>
                )}
              </For>
            </Show>
          </div>
        </div>
      )}
    </Show>
  )
}

// ─── Workflow List ────────────────────────────────────────────────────────────

function WorkflowList(props: {
  workflows: WorkflowDef[]
  activeId: string | null
  onSelect: (id: string) => void
  onNew: () => void
  onRun: (id: string) => void
  onDelete: (id: string) => void
}) {
  return (
    <div class="flex flex-col gap-1 overflow-y-auto flex-1 p-2">
      <div class="flex items-center justify-between px-2 pb-1">
        <span class="text-10-medium text-text-weaker uppercase tracking-widest">Workflows</span>
        <button
          class="text-10-regular text-amber-400 hover:text-amber-300 transition-colors"
          onClick={props.onNew}
        >
          + New
        </button>
      </div>
      <For each={props.workflows}>
        {(wf) => (
          <button
            class="flex flex-col gap-0.5 px-2 py-2 rounded-lg text-left transition-all"
            classList={{
              "bg-amber-500/10 border border-amber-500/30": props.activeId === wf.id,
              "hover:bg-background-surface-base border border-transparent": props.activeId !== wf.id,
            }}
            onClick={() => props.onSelect(wf.id)}
          >
            <div class="flex items-center gap-2">
              <div class="text-11-medium text-text-base truncate flex-1">{wf.name}</div>
              <Show when={wf.status === "running"}>
                <div class="size-1.5 rounded-full bg-amber-400 animate-pulse" />
              </Show>
            </div>
            <Show when={wf.description}>
              <div class="text-9-regular text-text-weaker truncate">{wf.description}</div>
            </Show>
            <div class="flex items-center gap-2 mt-0.5">
              <span class="text-9-regular text-text-weaker">{wf.nodes.length} nodes</span>
              <Show when={wf.lastRun}>
                <span class="text-9-regular text-text-weaker">{DateTime.fromMillis(wf.lastRun!).toRelative()}</span>
              </Show>
            </div>
          </button>
        )}
      </For>
    </div>
  )
}

// ─── Canvas ───────────────────────────────────────────────────────────────────

function Canvas(props: {
  nodes: WorkflowNode[]
  connections: WorkflowConnection[]
  selectedNodeId: string | null
  onSelectNode: (id: string) => void
  onMoveNode: (id: string, x: number, y: number) => void
  onDeleteNode: (id: string) => void
  onCanvasClick: () => void
  scale: () => number
  panX: () => number
  panY: () => number
  onPan: (dx: number, dy: number) => void
  onZoom: (delta: number) => void
}) {
  let canvasRef: HTMLDivElement | undefined
  let draggingNodeId: string | null = null
  let dragStartX = 0
  let dragStartY = 0
  let nodeStartX = 0
  let nodeStartY = 0
  let isPanning = false
  let panStartX = 0
  let panStartY = 0
  let startPanX = 0
  let startPanY = 0

  function handleNodeDragStart(nodeId: string, e: MouseEvent) {
    const node = props.nodes.find((n) => n.id === nodeId)
    if (!node) return
    draggingNodeId = nodeId
    dragStartX = e.clientX
    dragStartY = e.clientY
    nodeStartX = node.x
    nodeStartY = node.y

    const onMove = (ev: MouseEvent) => {
      if (!draggingNodeId) return
      const dx = (ev.clientX - dragStartX) / props.scale()
      const dy = (ev.clientY - dragStartY) / props.scale()
      props.onMoveNode(draggingNodeId, nodeStartX + dx, nodeStartY + dy)
    }

    const onUp = () => {
      draggingNodeId = null
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
    }

    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
  }

  function handleCanvasMouseDown(e: MouseEvent) {
    if (e.target !== canvasRef && !(e.target as HTMLElement).classList.contains("canvas-bg")) return
    props.onCanvasClick()
    isPanning = true
    panStartX = e.clientX
    panStartY = e.clientY
    startPanX = props.panX()
    startPanY = props.panY()

    const onMove = (ev: MouseEvent) => {
      if (!isPanning) return
      props.onPan(ev.clientX - panStartX, ev.clientY - panStartY)
    }

    const onUp = () => {
      isPanning = false
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
    }

    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
  }

  function handleWheel(e: WheelEvent) {
    e.preventDefault()
    props.onZoom(-e.deltaY * 0.001)
  }

  onMount(() => {
    canvasRef?.addEventListener("wheel", handleWheel, { passive: false })
  })

  onCleanup(() => {
    canvasRef?.removeEventListener("wheel", handleWheel)
  })

  return (
    <div
      ref={canvasRef}
      class="relative w-full h-full overflow-hidden canvas-bg"
      style={{ cursor: isPanning ? "grabbing" : "grab" }}
      onMouseDown={handleCanvasMouseDown}
    >
      {/* Grid background */}
      <div
        class="canvas-bg absolute inset-0 pointer-events-none"
        style={{
          "background-image": `
            radial-gradient(circle, var(--color-border-weaker-base) 1px, transparent 1px)
          `,
          "background-size": `${20 * props.scale()}px ${20 * props.scale()}px`,
          "background-position": `${props.panX()}px ${props.panY()}px`,
          opacity: 0.4,
        }}
      />

      {/* Content layer */}
      <div
        class="absolute"
        style={{
          transform: `translate(${props.panX()}px, ${props.panY()}px)`,
          width: "5000px",
          height: "5000px",
        }}
      >
        <ConnectionLines
          nodes={props.nodes}
          connections={props.connections}
          scale={props.scale}
          panX={props.panX}
          panY={props.panY}
        />
        <For each={props.nodes}>
          {(node) => (
            <WorkflowNodeCard
              node={node}
              selected={props.selectedNodeId === node.id}
              onSelect={() => props.onSelectNode(node.id)}
              onDelete={() => props.onDeleteNode(node.id)}
              onDragStart={(e) => handleNodeDragStart(node.id, e)}
              scale={props.scale}
            />
          )}
        </For>
      </div>
    </div>
  )
}

// ─── Main Workflow Editor ─────────────────────────────────────────────────────

export function WorkflowEditor(props: {
  workflows?: WorkflowDef[]
  onRun?: (id: string) => void
}) {
  const [workflows, setWorkflows] = createStore<WorkflowDef[]>(props.workflows ?? [
    {
      id: "wf_1",
      name: "Code Review Pipeline",
      description: "Automated code review with memory-aware suggestions",
      nodes: [
        { id: "n1", type: "trigger", label: "PR Created", x: 200, y: 40 },
        { id: "n2", type: "memory-read", label: "Load Review Rules", x: 200, y: 160, config: { type: "project", query: "review rules" } },
        { id: "n3", type: "agent", label: "Code Analyst", x: 80, y: 300, config: { role: "reviewer", depth: "deep" } },
        { id: "n4", type: "agent", label: "Security Scanner", x: 320, y: 300, config: { role: "security", owasp: "true" } },
        { id: "n5", type: "condition", label: "Has Issues?", x: 200, y: 440, config: { expression: "issues.length > 0" } },
        { id: "n6", type: "prompt", label: "Generate Report", x: 80, y: 560, config: { model: "default" } },
        { id: "n7", type: "memory-write", label: "Store Findings", x: 320, y: 560, config: { type: "insight" } },
        { id: "n8", type: "output", label: "Post Comment", x: 200, y: 680 },
      ],
      connections: [
        { id: "c1", from: "n1", fromPort: 0, to: "n2", toPort: 0 },
        { id: "c2", from: "n2", fromPort: 0, to: "n3", toPort: 0 },
        { id: "c3", from: "n2", fromPort: 0, to: "n4", toPort: 0 },
        { id: "c4", from: "n3", fromPort: 0, to: "n5", toPort: 0 },
        { id: "c5", from: "n4", fromPort: 0, to: "n5", toPort: 0 },
        { id: "c6", from: "n5", fromPort: 0, to: "n6", toPort: 0, label: "yes" },
        { id: "c7", from: "n5", fromPort: 1, to: "n7", toPort: 0, label: "no" },
        { id: "c8", from: "n6", fromPort: 0, to: "n8", toPort: 0 },
        { id: "c9", from: "n7", fromPort: 0, to: "n8", toPort: 0 },
      ],
      status: "idle",
      tags: ["code-review", "automation"],
    },
  ])

  const [activeWfId, setActiveWfId] = createSignal<string | null>("wf_1")
  const [selectedNodeId, setSelectedNodeId] = createSignal<string | null>(null)
  const [scale, setScale] = createSignal(1)
  const [panX, setPanX] = createSignal(0)
  const [panY, setPanY] = createSignal(0)
  const [sidebarTab, setSidebarTab] = createSignal<"workflows" | "nodes" | "properties">("nodes")

  const activeWf = createMemo(() => workflows.find((w) => w.id === activeWfId()) ?? null)
  const selectedNode = createMemo(() => {
    const id = selectedNodeId()
    if (!id || !activeWf()) return null
    return activeWf()!.nodes.find((n) => n.id === id) ?? null
  })

  function addNode(type: NodeType) {
    const tpl = NODE_TEMPLATES.find((t) => t.type === type)
    if (!tpl || !activeWf()) return
    const id = `n${uid()}`
    const node: WorkflowNode = {
      id,
      type,
      label: tpl.label,
      x: 200 + Math.random() * 200,
      y: (activeWf()!.nodes.length * 120) + 40,
      config: { ...tpl.defaultConfig },
    }
    setWorkflows(
      (w) => w.id === activeWfId(),
      produce((w) => { w.nodes.push(node) }),
    )
    setSelectedNodeId(id)
    setSidebarTab("properties")
  }

  function updateNode(id: string, updates: Partial<WorkflowNode>) {
    setWorkflows(
      (w) => w.id === activeWfId(),
      produce((w) => {
        const node = w.nodes.find((n) => n.id === id)
        if (node) Object.assign(node, updates)
      }),
    )
  }

  function deleteNode(id: string) {
    setWorkflows(
      (w) => w.id === activeWfId(),
      produce((w) => {
        w.nodes = w.nodes.filter((n) => n.id !== id)
        w.connections = w.connections.filter((c) => c.from !== id && c.to !== id)
      }),
    )
    setSelectedNodeId(null)
  }

  function moveNode(id: string, x: number, y: number) {
    setWorkflows(
      (w) => w.id === activeWfId(),
      produce((w) => {
        const node = w.nodes.find((n) => n.id === id)
        if (node) { node.x = x; node.y = y }
      }),
    )
  }

  function newWorkflow() {
    const id = `wf_${uid()}`
    setWorkflows((prev) => [...prev, {
      id,
      name: `New Workflow`,
      description: "",
      nodes: [{ id: `n${uid()}`, type: "trigger", label: "Start", x: 200, y: 40 }],
      connections: [],
      status: "idle" as const,
    }])
    setActiveWfId(id)
  }

  function deleteWorkflow(id: string) {
    setWorkflows((prev) => prev.filter((w) => w.id !== id))
    if (activeWfId() === id) setActiveWfId(workflows[0]?.id ?? null)
  }

  return (
    <div class="flex h-full overflow-hidden" style={{ background: "var(--color-background-base)" }}>
      {/* Left sidebar */}
      <div
        class="flex flex-col border-r border-border-weak-base shrink-0 h-full"
        style={{ width: "220px", background: "var(--color-background-surface-base)" }}
      >
        {/* Sidebar tabs */}
        <div class="flex border-b border-border-weak-base shrink-0">
          <For each={[
            { id: "workflows" as const, label: "Workflows" },
            { id: "nodes" as const, label: "Nodes" },
          ]}>
            {(tab) => (
              <button
                class="flex-1 py-2 text-11-medium text-center transition-colors border-b-2"
                classList={{
                  "border-amber-500 text-text-base": sidebarTab() === tab.id,
                  "border-transparent text-text-weak hover:text-text-base": sidebarTab() !== tab.id,
                }}
                onClick={() => setSidebarTab(tab.id)}
              >
                {tab.label}
              </button>
            )}
          </For>
        </div>

        <Show when={sidebarTab() === "workflows"}>
          <WorkflowList
            workflows={workflows}
            activeId={activeWfId()}
            onSelect={setActiveWfId}
            onNew={newWorkflow}
            onRun={(id) => props.onRun?.(id)}
            onDelete={deleteWorkflow}
          />
        </Show>

        <Show when={sidebarTab() === "nodes"}>
          <NodePalette onAdd={addNode} />
        </Show>

        <Show when={sidebarTab() === "properties"}>
          <PropertiesPanel
            node={selectedNode()}
            onUpdate={updateNode}
            onClose={() => { setSelectedNodeId(null); setSidebarTab("nodes") }}
          />
        </Show>
      </div>

      {/* Main canvas area */}
      <div class="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div class="flex items-center justify-between px-4 py-2 border-b border-border-weak-base shrink-0">
          <div class="flex items-center gap-2">
            <Show when={activeWf()}>
              {(wf) => (
                <>
                  <span class="text-13-medium text-text-base">{wf().name}</span>
                  <Show when={wf().tags}>
                    <div class="flex gap-1">
                      <For each={wf().tags!}>
                        {(tag) => (
                          <span class="text-9-regular px-1.5 py-0 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            {tag}
                          </span>
                        )}
                      </For>
                    </div>
                  </Show>
                </>
              )}
            </Show>
          </div>
          <div class="flex items-center gap-1.5">
            <button
              class="px-2 py-1 rounded-md text-10-regular text-text-weak hover:text-text-base
                     hover:bg-background-surface-base transition-colors"
              onClick={() => setScale((s) => Math.max(0.3, s - 0.15))}
            >
              −
            </button>
            <span class="text-10-regular text-text-weaker w-10 text-center">{Math.round(scale() * 100)}%</span>
            <button
              class="px-2 py-1 rounded-md text-10-regular text-text-weak hover:text-text-base
                     hover:bg-background-surface-base transition-colors"
              onClick={() => setScale((s) => Math.min(2, s + 0.15))}
            >
              +
            </button>
            <div class="w-px h-4 bg-border-weak-base mx-1" />
            <button
              class="px-3 py-1 rounded-lg text-11-medium bg-emerald-500/15 text-emerald-400
                     border border-emerald-500/30 hover:bg-emerald-500/25 transition-colors"
              onClick={() => {
                if (!activeWf()) return
                setWorkflows(
                  (w) => w.id === activeWfId(),
                  produce((w) => { w.status = "running" }),
                )
                setTimeout(() => {
                  setWorkflows(
                    (w) => w.id === activeWfId(),
                    produce((w) => { w.status = "complete" }),
                  )
                }, 2000)
              }}
            >
              ▶ Run
            </button>
          </div>
        </div>

        {/* Canvas */}
        <div class="flex-1 min-h-0 relative">
          <Show when={activeWf()}>
            {(wf) => (
              <Canvas
                nodes={wf().nodes}
                connections={wf().connections}
                selectedNodeId={selectedNodeId()}
                onSelectNode={(id) => { setSelectedNodeId(id); setSidebarTab("properties") }}
                onMoveNode={moveNode}
                onDeleteNode={deleteNode}
                onCanvasClick={() => setSelectedNodeId(null)}
                scale={scale}
                panX={panX}
                panY={panY}
                onPan={(dx, dy) => { setPanX(dx); setPanY(dy) }}
                onZoom={(delta) => setScale((s) => Math.max(0.3, Math.min(2, s + delta)))}
              />
            )}
          </Show>
        </div>
      </div>

      {/* Right properties panel */}
      <Show when={selectedNode()}>
        <div
          class="flex flex-col border-l border-border-weak-base shrink-0 h-full"
          style={{ width: "240px", background: "var(--color-background-surface-base)" }}
        >
          <PropertiesPanel
            node={selectedNode()}
            onUpdate={updateNode}
            onClose={() => setSelectedNodeId(null)}
          />
        </div>
      </Show>
    </div>
  )
}
