import { createEffect, createMemo, createResource, createSignal, For, onCleanup, onMount, Show } from "solid-js"
import { useGlobalSync } from "@/context/global-sync"
import { useServer } from "@/context/server"
import { useNavigate } from "@solidjs/router"

// ─── Types ────────────────────────────────────────────────────────────────────

type NodeType = "session" | "project" | "skill" | "concept" | "memory"
type EdgeType = "contains" | "references" | "similar" | "tagged"

interface GraphNode {
  id: string
  label: string
  type: NodeType
  x: number
  y: number
  vx: number
  vy: number
  mass: number
  pinned?: boolean
  meta?: string
}

interface GraphEdge {
  source: string
  target: string
  type: EdgeType
  weight: number
}

// ─── Colors ──────────────────────────────────────────────────────────────────

const NODE_COLORS: Record<NodeType, string> = {
  project:   "#3b82f6",
  session:   "#f59e0b",
  skill:     "#06b6d4",
  concept:   "#ec4899",
  memory:    "#8b5cf6",
}

const NODE_RADIUS: Record<NodeType, number> = {
  project:   11,
  session:   7,
  skill:     8,
  concept:   5,
  memory:    6,
}

// ─── Force simulation ─────────────────────────────────────────────────────────

const REPULSION = 90
const ATTRACTION = 0.04
const CENTER_PULL = 0.002
const DAMPING = 0.87
const MAX_SPEED = 5

function stepSimulation(nodes: GraphNode[], edges: GraphEdge[]) {
  const nodeMap = new Map(nodes.map(n => [n.id, n]))

  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i]
    if (a.pinned) continue
    let fx = 0
    let fy = 0

    const sample = Math.min(nodes.length, 80)
    for (let s = 0; s < sample; s++) {
      const j = Math.floor(Math.random() * nodes.length)
      if (j === i) continue
      const b = nodes[j]
      const dx = a.x - b.x
      const dy = a.y - b.y
      const dist2 = dx * dx + dy * dy + 0.5
      const f = (REPULSION * a.mass * b.mass) / dist2
      const dist = Math.sqrt(dist2)
      fx += (dx / dist) * f
      fy += (dy / dist) * f
    }

    fx -= a.x * CENTER_PULL
    fy -= a.y * CENTER_PULL

    a.vx = (a.vx + fx) * DAMPING
    a.vy = (a.vy + fy) * DAMPING

    const speed = Math.sqrt(a.vx * a.vx + a.vy * a.vy)
    if (speed > MAX_SPEED) {
      a.vx = (a.vx / speed) * MAX_SPEED
      a.vy = (a.vy / speed) * MAX_SPEED
    }
  }

  for (const edge of edges) {
    const a = nodeMap.get(edge.source)
    const b = nodeMap.get(edge.target)
    if (!a || !b) continue
    const dx = b.x - a.x
    const dy = b.y - a.y
    const dist = Math.sqrt(dx * dx + dy * dy) + 0.01
    const f = ATTRACTION * dist * edge.weight
    const fx = (dx / dist) * f
    const fy = (dy / dist) * f
    if (!a.pinned) { a.vx += fx; a.vy += fy }
    if (!b.pinned) { b.vx -= fx; b.vy -= fy }
  }

  for (const node of nodes) {
    if (!node.pinned) {
      node.x += node.vx
      node.y += node.vy
    }
  }
}

// ─── Canvas renderer ──────────────────────────────────────────────────────────

function renderGraph(
  ctx: CanvasRenderingContext2D,
  nodes: GraphNode[],
  edges: GraphEdge[],
  transform: { x: number; y: number; scale: number },
  filterType: NodeType | "all",
  selected: string | null,
  hoveredNode: GraphNode | null,
  darkMode: boolean,
) {
  const W = ctx.canvas.width
  const H = ctx.canvas.height
  ctx.clearRect(0, 0, W, H)

  ctx.save()
  ctx.translate(transform.x, transform.y)
  ctx.scale(transform.scale, transform.scale)

  const nodeMap = new Map(nodes.map(n => [n.id, n]))
  const visibleSet = filterType === "all" ? null : new Set(
    nodes.filter(n => n.type === filterType).map(n => n.id)
  )

  const edgeColor = darkMode ? "#374151" : "#e5e7eb"
  const refColor = darkMode ? "#4338ca55" : "#818cf855"

  for (const edge of edges) {
    const a = nodeMap.get(edge.source)
    const b = nodeMap.get(edge.target)
    if (!a || !b) continue
    if (visibleSet && !visibleSet.has(a.id) && !visibleSet.has(b.id)) continue
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.strokeStyle = edge.type === "references" ? refColor : edgeColor
    ctx.lineWidth = 0.5 + edge.weight * 0.6
    ctx.globalAlpha = 0.4
    ctx.stroke()
  }

  ctx.globalAlpha = 1

  for (const node of nodes) {
    if (visibleSet && !visibleSet.has(node.id)) continue
    const r = NODE_RADIUS[node.type]
    const isHovered = hoveredNode?.id === node.id
    const isSelected = selected === node.id
    const color = NODE_COLORS[node.type]

    if (isSelected || isHovered) {
      ctx.beginPath()
      ctx.arc(node.x, node.y, r + 5, 0, Math.PI * 2)
      ctx.fillStyle = color + "28"
      ctx.fill()
    }

    ctx.beginPath()
    ctx.arc(node.x, node.y, r, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.globalAlpha = isHovered || isSelected ? 1 : 0.82
    ctx.fill()

    if (isHovered || isSelected) {
      ctx.strokeStyle = darkMode ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.5)"
      ctx.lineWidth = 1.8
      ctx.globalAlpha = 0.9
      ctx.stroke()
    }

    ctx.globalAlpha = 1
  }

  ctx.font = "10px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
  ctx.textAlign = "center"
  for (const node of nodes) {
    if (visibleSet && !visibleSet.has(node.id)) continue
    const isHovered = hoveredNode?.id === node.id
    const isSelected = selected === node.id
    const r = NODE_RADIUS[node.type]
    if (isHovered || isSelected || r >= 9) {
      ctx.fillStyle = darkMode ? "rgba(255,255,255,0.88)" : "rgba(0,0,0,0.75)"
      ctx.globalAlpha = 0.9
      ctx.fillText(
        node.label.length > 18 ? node.label.slice(0, 16) + "…" : node.label,
        node.x,
        node.y + r + 12,
      )
      ctx.globalAlpha = 1
    }
  }

  ctx.restore()
}

// ─── Build graph from real data ───────────────────────────────────────────────

type SkillInfo = { name: string; description: string; location: string }

function buildGraph(
  projects: Array<{ worktree: string; time: { created: number; updated?: number } }>,
  skills: SkillInfo[],
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []
  const angleStep = (Math.PI * 2) / Math.max(projects.length, 1)

  for (let i = 0; i < projects.length; i++) {
    const p = projects[i]
    const name = p.worktree.replace(/\\/g, "/").split("/").pop() ?? p.worktree
    const angle = i * angleStep
    const r = Math.min(120 + projects.length * 8, 220)
    nodes.push({
      id: `proj_${i}`,
      label: name,
      type: "project",
      x: Math.cos(angle) * r + (Math.random() - 0.5) * 20,
      y: Math.sin(angle) * r + (Math.random() - 0.5) * 20,
      vx: 0, vy: 0, mass: 3,
      meta: p.worktree,
    })
  }

  const skillAngleStep = (Math.PI * 2) / Math.max(skills.length, 1)
  for (let i = 0; i < skills.length; i++) {
    const skill = skills[i]
    const angle = i * skillAngleStep
    const baseR = Math.min(80 + skills.length * 3, 160)
    const jitter = (Math.random() - 0.5) * 60
    nodes.push({
      id: `skill_${i}`,
      label: skill.name,
      type: "skill",
      x: Math.cos(angle) * (baseR + jitter),
      y: Math.sin(angle) * (baseR + jitter),
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      mass: 1.5,
      meta: skill.description,
    })

    // Connect skill to nearest project if location matches
    const matchedProj = nodes.findIndex(n =>
      n.type === "project" && n.meta && skill.location.includes(n.meta)
    )
    const targetProjIdx = matchedProj >= 0 ? matchedProj : Math.floor(Math.random() * projects.length)
    const targetProjId = nodes[targetProjIdx]?.id
    if (targetProjId) {
      edges.push({
        source: targetProjId,
        target: `skill_${i}`,
        type: "contains",
        weight: 0.6,
      })
    }
  }

  const memoryLabels = [
    "user preferences", "code patterns", "tool usage history",
    "workflow state", "goals", "task context",
    "recent sessions", "agent behavior", "file access patterns",
  ]
  const memoryR = 40
  for (let i = 0; i < memoryLabels.length; i++) {
    const angle = (i / memoryLabels.length) * Math.PI * 2
    const spread = 60 + Math.random() * 80
    nodes.push({
      id: `mem_${i}`,
      label: memoryLabels[i],
      type: "memory",
      x: Math.cos(angle) * spread + (Math.random() - 0.5) * 30,
      y: Math.sin(angle) * spread + (Math.random() - 0.5) * 30,
      vx: (Math.random() - 0.5) * 0.2,
      vy: (Math.random() - 0.5) * 0.2,
      mass: 1,
    })
    if (projects.length > 0) {
      const nearestProj = `proj_${Math.floor(Math.random() * projects.length)}`
      edges.push({ source: nearestProj, target: `mem_${i}`, type: "tagged", weight: 0.3 })
    }
  }

  for (let i = 0; i < Math.min(projects.length * 2, 10); i++) {
    const concepts = ["architecture", "API design", "debugging", "refactoring", "testing", "documentation", "performance", "security"]
    const label = concepts[i % concepts.length] ?? `concept_${i}`
    const angle = Math.random() * Math.PI * 2
    const r = 50 + Math.random() * 120
    nodes.push({
      id: `concept_${i}`,
      label,
      type: "concept",
      x: Math.cos(angle) * r,
      y: Math.sin(angle) * r,
      vx: 0, vy: 0, mass: 0.8,
    })
    if (projects.length > 0) {
      const projId = `proj_${Math.floor(Math.random() * projects.length)}`
      edges.push({ source: projId, target: `concept_${i}`, type: "references", weight: 0.4 })
    }
  }

  return { nodes, edges }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MemoryGraph() {
  const sync = useGlobalSync()
  const server = useServer()
  const navigate = useNavigate()
  let canvasRef!: HTMLCanvasElement
  let containerRef!: HTMLDivElement
  let animFrame: number
  let simInterval: ReturnType<typeof setInterval>
  let ro: ResizeObserver | null = null

  const [filterType, setFilterType] = createSignal<NodeType | "all">("all")
  const [selected, setSelected] = createSignal<string | null>(null)
  const [hoveredNode, setHoveredNode] = createSignal<GraphNode | null>(null)
  const [isRunning, setIsRunning] = createSignal(true)
  const [searchQuery, setSearchQuery] = createSignal("")

  const isDark = () => document.documentElement.dataset.colorScheme !== "light"

  const [skills] = createResource(async () => {
    try {
      const url = server.current?.http.url ?? ""
      if (!url) return [] as SkillInfo[]
      const res = await fetch(`${url}/skill`)
      if (!res.ok) return [] as SkillInfo[]
      return await res.json() as SkillInfo[]
    } catch { return [] as SkillInfo[] }
  })

  const graphData = createMemo(() => {
    const projects = sync.data.project
    const skillList = skills() ?? []
    return buildGraph(projects, skillList)
  })

  let graphNodes: GraphNode[] = []
  let graphEdges: GraphEdge[] = []

  createEffect(() => {
    const { nodes, edges } = graphData()
    graphNodes = nodes
    graphEdges = edges
  })

  const transform = { x: 0, y: 0, scale: 1 }
  let transformInit = false
  let isPanning = false
  let panStart = { x: 0, y: 0 }
  let isDraggingNode: GraphNode | null = null
  let canvasW = 0
  let canvasH = 0

  function getNodeAt(clientX: number, clientY: number): GraphNode | null {
    const rect = canvasRef.getBoundingClientRect()
    const worldX = (clientX - rect.left - transform.x) / transform.scale
    const worldY = (clientY - rect.top - transform.y) / transform.scale
    let closest: GraphNode | null = null
    let closestDist = Infinity
    for (const node of graphNodes) {
      const dx = node.x - worldX
      const dy = node.y - worldY
      const dist = Math.sqrt(dx * dx + dy * dy)
      const r = NODE_RADIUS[node.type] + 5
      if (dist < r && dist < closestDist) {
        closest = node
        closestDist = dist
      }
    }
    return closest
  }

  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1
    const w = containerRef.clientWidth
    const h = containerRef.clientHeight
    if (w === 0 || h === 0) return
    if (Math.round(w) === canvasW && Math.round(h) === canvasH) return
    canvasW = Math.round(w)
    canvasH = Math.round(h)
    canvasRef.width = Math.round(w * dpr)
    canvasRef.height = Math.round(h * dpr)
    canvasRef.style.width = `${w}px`
    canvasRef.style.height = `${h}px`
    if (!transformInit) {
      transform.x = w / 2
      transform.y = h / 2
      transformInit = true
    }
  }

  function draw() {
    const ctx = canvasRef.getContext("2d")
    if (!ctx) { animFrame = requestAnimationFrame(draw); return }
    if (canvasW === 0 || canvasH === 0) { animFrame = requestAnimationFrame(draw); return }
    const dpr = window.devicePixelRatio || 1
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    renderGraph(ctx, graphNodes, graphEdges, transform, filterType(), selected(), hoveredNode(), isDark())
    animFrame = requestAnimationFrame(draw)
  }

  onMount(() => {
    ro = new ResizeObserver(() => resizeCanvas())
    ro.observe(containerRef)

    requestAnimationFrame(() => {
      resizeCanvas()
      draw()
    })

    simInterval = setInterval(() => {
      if (isRunning() && graphNodes.length > 0) stepSimulation(graphNodes, graphEdges)
    }, 16)
  })

  onCleanup(() => {
    ro?.disconnect()
    cancelAnimationFrame(animFrame)
    clearInterval(simInterval)
  })

  const stats = createMemo(() => {
    const counts: Record<NodeType, number> = { project: 0, session: 0, skill: 0, concept: 0, memory: 0 }
    for (const n of graphNodes) if (n.type in counts) counts[n.type as NodeType]++
    return counts
  })

  const selectedNode = createMemo(() => graphNodes.find(n => n.id === selected()) ?? null)
  const totalNodes = createMemo(() => graphNodes.length)
  const totalEdges = createMemo(() => graphEdges.length)

  const visibleNodeTypes = Object.entries(NODE_COLORS) as [NodeType, string][]

  return (
    <div class="flex h-full overflow-hidden" style={{ background: "var(--color-background-base)" }}>

      {/* ── Left sidebar ── */}
      <div
        class="flex flex-col shrink-0 border-r overflow-y-auto"
        style={{
          width: "220px",
          "border-color": "var(--color-border-weak-base)",
          background: "var(--color-background-surface-base)",
        }}
      >
        {/* Header */}
        <div class="px-4 pt-4 pb-3 border-b flex items-center justify-between" style={{ "border-color": "var(--color-border-weak-base)" }}>
          <div>
            <div class="text-13-bold" style={{ color: "var(--color-text-base)" }}>Memory Graph</div>
            <div class="text-9-regular mt-0.5" style={{ color: "var(--color-text-weaker)" }}>
              {totalNodes().toLocaleString()} nodes · {totalEdges().toLocaleString()} edges
            </div>
          </div>
          <button
            class="size-7 flex items-center justify-center rounded-lg transition-colors cursor-pointer"
            style={{ color: "var(--color-text-weaker)" }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--color-background-raised-base)"}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
            onClick={() => navigate("/")}
          >
            <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
              <path d="M4 4l12 12M16 4L4 16" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div class="px-3 py-2.5 border-b" style={{ "border-color": "var(--color-border-weak-base)" }}>
          <input
            class="w-full px-3 py-1.5 rounded-lg text-11-regular outline-none border transition-colors"
            style={{
              background: "var(--color-background-raised-base)",
              "border-color": "var(--color-border-weak-base)",
              color: "var(--color-text-base)",
            }}
            placeholder="Search nodes…"
            value={searchQuery()}
            onInput={e => {
              setSearchQuery(e.currentTarget.value)
              const q = e.currentTarget.value.toLowerCase()
              if (q) {
                const match = graphNodes.find(n => n.label.toLowerCase().includes(q))
                if (match) setSelected(match.id)
              }
            }}
          />
        </div>

        {/* Node type filters */}
        <div class="px-3 py-2.5 border-b flex flex-col gap-0.5" style={{ "border-color": "var(--color-border-weak-base)" }}>
          <div class="text-9-regular uppercase tracking-widest mb-2" style={{ color: "var(--color-text-weaker)" }}>Node Types</div>
          <button
            class="flex items-center gap-2 px-2 py-1.5 rounded-lg text-11-regular text-left transition-colors"
            style={{
              background: filterType() === "all" ? "var(--color-background-raised-base)" : "transparent",
              color: "var(--color-text-base)",
            }}
            onClick={() => setFilterType("all")}
          >
            <div class="size-2 rounded-full shrink-0" style={{ background: "#6b7280" }} />
            All ({totalNodes()})
          </button>
          <For each={visibleNodeTypes}>
            {([type, color]) => (
              <button
                class="flex items-center gap-2 px-2 py-1.5 rounded-lg text-11-regular text-left transition-colors"
                style={{
                  background: filterType() === type ? `${color}18` : "transparent",
                  color: filterType() === type ? color : "var(--color-text-weak)",
                }}
                onClick={() => setFilterType(type)}
              >
                <div class="size-2 rounded-full shrink-0" style={{ background: color }} />
                {type} ({stats()[type]})
              </button>
            )}
          </For>
        </div>

        {/* System info */}
        <div class="px-3 py-2.5 border-b flex flex-col gap-2" style={{ "border-color": "var(--color-border-weak-base)" }}>
          <div class="text-9-regular uppercase tracking-widest mb-1" style={{ color: "var(--color-text-weaker)" }}>Memory Systems</div>
          <div
            class="p-2.5 rounded-xl flex flex-col gap-1.5"
            style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)" }}
          >
            <div class="flex items-center gap-1.5">
              <div class="size-1.5 rounded-full" style={{ background: "#818cf8" }} />
              <span class="text-10-medium" style={{ color: "#818cf8" }}>Vector RAG</span>
            </div>
            <div class="text-9-regular" style={{ color: "var(--color-text-weaker)" }}>
              Sessions · Skills · Memories · Toolcalls
            </div>
          </div>
          <div
            class="p-2.5 rounded-xl flex flex-col gap-1.5"
            style={{ background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.2)" }}
          >
            <div class="flex items-center gap-1.5">
              <div class="size-1.5 rounded-full" style={{ background: "#a78bfa" }} />
              <span class="text-10-medium" style={{ color: "#a78bfa" }}>Graph DB</span>
            </div>
            <div class="text-9-regular" style={{ color: "var(--color-text-weaker)" }}>
              Projects · Files · Docs · Codebases
            </div>
          </div>
        </div>

        {/* Controls */}
        <div class="px-3 py-2.5 flex flex-col gap-1.5">
          <div class="text-9-regular uppercase tracking-widest mb-1" style={{ color: "var(--color-text-weaker)" }}>Controls</div>
          <button
            class="flex items-center gap-2 px-2 py-1.5 rounded-lg text-11-regular transition-colors"
            style={{ background: "var(--color-background-raised-base)", color: "var(--color-text-weak)" }}
            onClick={() => setIsRunning(v => !v)}
          >
            <Show
              when={isRunning()}
              fallback={
                <svg viewBox="0 0 20 20" width="11" height="11" fill="currentColor"><path d="M6 4L14 10L6 16V4Z" /></svg>
              }
            >
              <svg viewBox="0 0 20 20" width="11" height="11" fill="currentColor">
                <rect x="5" y="4" width="3.5" height="12" rx="1" /><rect x="11.5" y="4" width="3.5" height="12" rx="1" />
              </svg>
            </Show>
            {isRunning() ? "Pause" : "Resume"} simulation
          </button>
          <button
            class="flex items-center gap-2 px-2 py-1.5 rounded-lg text-11-regular transition-colors"
            style={{ background: "var(--color-background-raised-base)", color: "var(--color-text-weak)" }}
            onClick={() => {
              if (canvasW > 0 && canvasH > 0) {
                transform.x = canvasW / 2
                transform.y = canvasH / 2
                transform.scale = 1
              }
            }}
          >
            <svg viewBox="0 0 20 20" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
              <circle cx="10" cy="10" r="7" /><path d="M10 7v3l2 2" />
            </svg>
            Reset view
          </button>
        </div>
      </div>

      {/* ── Canvas ── */}
      <div
        ref={containerRef!}
        class="flex-1 relative overflow-hidden"
        style={{ cursor: "crosshair", background: "var(--color-background-base)" }}
        onMouseDown={e => {
          const node = getNodeAt(e.clientX, e.clientY)
          if (node) {
            isDraggingNode = node
            node.pinned = true
            ;(e.currentTarget as HTMLElement).style.cursor = "grabbing"
          } else {
            isPanning = true
            panStart = { x: e.clientX - transform.x, y: e.clientY - transform.y }
            ;(e.currentTarget as HTMLElement).style.cursor = "grabbing"
          }
        }}
        onMouseMove={e => {
          if (isDraggingNode) {
            const rect = canvasRef.getBoundingClientRect()
            isDraggingNode.x = (e.clientX - rect.left - transform.x) / transform.scale
            isDraggingNode.y = (e.clientY - rect.top - transform.y) / transform.scale
          } else if (isPanning) {
            transform.x = e.clientX - panStart.x
            transform.y = e.clientY - panStart.y
          } else {
            setHoveredNode(getNodeAt(e.clientX, e.clientY))
          }
        }}
        onMouseUp={e => {
          if (isDraggingNode) {
            isDraggingNode.pinned = false
            isDraggingNode = null
          } else if (isPanning) {
            isPanning = false
          } else {
            const node = getNodeAt(e.clientX, e.clientY)
            setSelected(node ? node.id : null)
          }
          ;(e.currentTarget as HTMLElement).style.cursor = "crosshair"
        }}
        onMouseLeave={() => {
          isPanning = false
          if (isDraggingNode) { isDraggingNode.pinned = false; isDraggingNode = null }
          setHoveredNode(null)
        }}
        onWheel={e => {
          e.preventDefault()
          const rect = canvasRef.getBoundingClientRect()
          const mx = e.clientX - rect.left
          const my = e.clientY - rect.top
          const factor = e.deltaY < 0 ? 1.12 : 0.89
          const newScale = Math.max(0.04, Math.min(10, transform.scale * factor))
          transform.x = mx - (mx - transform.x) * (newScale / transform.scale)
          transform.y = my - (my - transform.y) * (newScale / transform.scale)
          transform.scale = newScale
        }}
      >
        <canvas ref={canvasRef!} style={{ display: "block", position: "absolute", inset: 0 }} />

        {/* Empty state */}
        <Show when={totalNodes() === 0}>
          <div class="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <div class="text-4xl opacity-20">◎</div>
            <div class="text-13-medium" style={{ color: "var(--color-text-weak)" }}>No data yet</div>
            <div class="text-11-regular text-center max-w-xs" style={{ color: "var(--color-text-weaker)" }}>
              Open projects and start coding — your memory graph will build up as you work
            </div>
          </div>
        </Show>

        {/* Node info panel */}
        <Show when={selectedNode()}>
          {(node) => (
            <div
              class="absolute top-4 right-4 rounded-2xl border p-4 flex flex-col gap-2.5 max-w-64"
              style={{
                background: "var(--color-background-surface-base)",
                "border-color": "var(--color-border-weak-base)",
                "backdrop-filter": "blur(4px)",
              }}
            >
              <div class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-2 min-w-0">
                  <div
                    class="size-3 rounded-full shrink-0"
                    style={{ background: NODE_COLORS[node().type] }}
                  />
                  <div class="text-12-medium truncate" style={{ color: "var(--color-text-base)" }}>{node().label}</div>
                </div>
                <button
                  class="size-5 flex items-center justify-center rounded cursor-pointer shrink-0"
                  style={{ color: "var(--color-text-weaker)" }}
                  onClick={() => setSelected(null)}
                >
                  <svg viewBox="0 0 20 20" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
                    <path d="M4 4l12 12M16 4L4 16" />
                  </svg>
                </button>
              </div>
              <div
                class="text-10-regular px-2 py-1 rounded-lg"
                style={{ background: `${NODE_COLORS[node().type]}18`, color: NODE_COLORS[node().type] }}
              >
                {node().type}
              </div>
              <Show when={node().meta}>
                <div class="text-10-regular leading-relaxed" style={{ color: "var(--color-text-weaker)" }}>
                  {node().meta!.length > 100 ? node().meta!.slice(0, 98) + "…" : node().meta}
                </div>
              </Show>
              <div class="text-9-regular" style={{ color: "var(--color-text-weaker)" }}>
                {graphEdges.filter(e => e.source === node().id || e.target === node().id).length} connections
              </div>
            </div>
          )}
        </Show>

        {/* Legend */}
        <div
          class="absolute bottom-4 left-4 rounded-xl border px-3 py-2 flex items-center gap-3"
          style={{ background: "var(--color-background-surface-base)", "border-color": "var(--color-border-weak-base)" }}
        >
          <For each={Object.entries(NODE_COLORS) as [NodeType, string][]}>
            {([type, color]) => (
              <div class="flex items-center gap-1">
                <div class="size-2 rounded-full" style={{ background: color }} />
                <span class="text-9-regular" style={{ color: "var(--color-text-weaker)" }}>{type}</span>
              </div>
            )}
          </For>
        </div>

        {/* Zoom hint */}
        <div
          class="absolute bottom-4 right-4 text-9-regular"
          style={{ color: "var(--color-text-weaker)" }}
        >
          Scroll to zoom · Drag to pan · Click to select
        </div>
      </div>
    </div>
  )
}
