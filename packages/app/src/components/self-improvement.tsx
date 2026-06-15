import { createSignal, createMemo, For, Show, onMount, onCleanup } from "solid-js"

export type DreamPhase = "idle" | "dreaming" | "distilling" | "consolidating" | "complete"
export type DreamLog = { timestamp: number; phase: DreamPhase; message: string }

export type Capability = {
  id: string
  name: string
  category: string
  level: number
  maxLevel: number
  unlockedAt?: number
  description: string
}

export type DistilledKnowledge = {
  id: string
  title: string
  source: string
  confidence: number
  distilledAt: number
  tags: string[]
}

function PhaseRing(props: { phase: DreamPhase; tick: number }) {
  const isRunning = () => props.phase === "dreaming" || props.phase === "distilling" || props.phase === "consolidating"
  const pulse = () => isRunning() ? Math.sin(props.tick / 500) * 0.3 + 0.7 : 1

  const PHASE_META = {
    idle: { color: "#6b7280", icon: "◎", label: "Ready" },
    dreaming: { color: "#8b5cf6", icon: "✦", label: "Dreaming" },
    distilling: { color: "#f59e0b", icon: "◇", label: "Distilling" },
    consolidating: { color: "#3b82f6", icon: "◈", label: "Consolidating" },
    complete: { color: "#10b981", icon: "✓", label: "Complete" },
  }

  const meta = () => PHASE_META[props.phase]
  const size = 120

  return (
    <div class="relative flex items-center justify-center" style={{ width: `${size}px`, height: `${size}px` }}>
      {/* Outer glow */}
      <Show when={isRunning()}>
        <div
          class="absolute inset-0 rounded-full transition-all duration-300"
          style={{
            background: `radial-gradient(circle, ${meta().color}15 0%, transparent 70%)`,
            transform: `scale(${1 + pulse() * 0.3})`,
          }}
        />
      </Show>

      {/* Ring */}
      <svg viewBox={`0 0 ${size} ${size}`} class="w-full h-full absolute inset-0">
        <defs>
          <linearGradient id="ring-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color={meta().color} stop-opacity="0.8" />
            <stop offset="100%" stop-color={meta().color} stop-opacity="0.2" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={size / 2 - 4} fill="none"
                stroke="var(--color-border-weak-base)" stroke-width="2" />
        <circle cx={size / 2} cy={size / 2} r={size / 2 - 4} fill="none"
                stroke={meta().color} stroke-width="2" stroke-linecap="round"
                stroke-dasharray={`${Math.PI * (size - 8)}`}
                stroke-dashoffset={isRunning() ? `${Math.PI * (size - 8) * (1 - pulse())}` : `${Math.PI * (size - 8)}`}
                class="transition-all duration-500" />
      </svg>

      {/* Center */}
      <div
        class="relative z-10 size-16 rounded-full flex items-center justify-center text-2xl"
        style={{ background: `${meta().color}18`, color: meta().color }}
      >
        {meta().icon}
      </div>
    </div>
  )
}

function CapabilityCard(props: { cap: Capability }) {
  const pct = () => (props.cap.level / props.cap.maxLevel) * 100
  return (
    <div class="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-background-surface-base transition-colors">
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <span class="text-11-medium text-text-base">{props.cap.name}</span>
          <span class="text-9-regular text-text-weaker">Lv.{props.cap.level}/{props.cap.maxLevel}</span>
        </div>
        <div class="text-9-regular text-text-weaker truncate">{props.cap.description}</div>
      </div>
      <div class="w-16 h-1.5 rounded-full bg-background-base overflow-hidden shrink-0">
        <div class="h-full rounded-full bg-amber-500 transition-all duration-500" style={{ width: `${pct()}%` }} />
      </div>
    </div>
  )
}

export function SelfImprovement(props?: {
  phase?: DreamPhase
  onDream?: () => void
  onDistill?: () => void
  onStop?: () => void
}) {
  const [tick, setTick] = createSignal(Date.now())
  const [phase, setPhase] = createSignal<DreamPhase>(props?.phase ?? "idle")
  let timer: ReturnType<typeof setInterval>
  onMount(() => { timer = setInterval(() => setTick(Date.now()), 200) })
  onCleanup(() => clearInterval(timer))

  const isRunning = () => phase() === "dreaming" || phase() === "distilling" || phase() === "consolidating"

  const capabilities = createMemo(() => [
    { id: "c1", name: "Code Generation", category: "Core", level: 8, maxLevel: 10, description: "TypeScript, Python, Go, Rust patterns" },
    { id: "c2", name: "Architecture Design", category: "Core", level: 7, maxLevel: 10, description: "System design and component composition" },
    { id: "c3", name: "Bug Detection", category: "Analysis", level: 9, maxLevel: 10, description: "Static analysis and pattern matching" },
    { id: "c4", name: "Memory Synthesis", category: "Memory", level: 6, maxLevel: 10, description: "Cross-session context retrieval" },
    { id: "c5", name: "Workflow Orchestration", category: "Agentic", level: 5, maxLevel: 10, description: "Multi-agent coordination patterns" },
    { id: "c6", name: "UI/UX Design", category: "Creative", level: 7, maxLevel: 10, description: "Component design and theming" },
  ])

  const knowledge = createMemo(() => [
    { id: "k1", title: "SolidJS createStore patterns", source: "Session #7f2a", confidence: 94, distilledAt: Date.now() - 3600000, tags: ["solidjs", "state"] },
    { id: "k2", title: "Electron IPC best practices", source: "Session #3b9c", confidence: 88, distilledAt: Date.now() - 7200000, tags: ["electron", "ipc"] },
    { id: "k3", title: "CSS variable theming system", source: "Session #ae41", confidence: 91, distilledAt: Date.now() - 14400000, tags: ["css", "theme"] },
    { id: "k4", title: "Node canvas rendering optimization", source: "Dream cycle #2", confidence: 76, distilledAt: Date.now() - 28800000, tags: ["canvas", "perf"] },
  ])

  const logs = createMemo((): DreamLog[] => {
    if (phase() === "idle") return [
      { timestamp: Date.now() - 60000, phase: "complete", message: "Previous dream cycle completed successfully" },
      { timestamp: Date.now() - 120000, phase: "distilling", message: "Distilled 4 new knowledge entries" },
      { timestamp: Date.now() - 180000, phase: "dreaming", message: "Explored 12 new code patterns" },
    ]
    if (phase() === "dreaming") return [
      { timestamp: tick(), phase: "dreaming", message: "Exploring edge cases in workflow orchestration..." },
      { timestamp: tick() - 2000, phase: "dreaming", message: "Analyzing node interaction patterns from electoNeek, n8n..." },
      { timestamp: tick() - 5000, phase: "dreaming", message: "Generating novel canvas rendering strategies..." },
    ]
    if (phase() === "distilling") return [
      { timestamp: tick(), phase: "distilling", message: "Condensing insights into durable knowledge..." },
      { timestamp: tick() - 2000, phase: "distilling", message: "Merging similar patterns across sessions..." },
      { timestamp: tick() - 4000, phase: "distilling", message: "Prioritizing high-signal knowledge entries..." },
    ]
    return [
      { timestamp: tick(), phase: "consolidating", message: "Integrating new capabilities into memory..." },
    ]
  })

  function handleDream() {
    setPhase("dreaming")
    props?.onDream?.()
    setTimeout(() => setPhase("distilling"), 4000)
    setTimeout(() => setPhase("consolidating"), 7000)
    setTimeout(() => setPhase("complete"), 9000)
    setTimeout(() => setPhase("idle"), 12000)
  }

  function handleDistill() {
    setPhase("distilling")
    props?.onDistill?.()
    setTimeout(() => setPhase("consolidating"), 3000)
    setTimeout(() => setPhase("complete"), 5000)
    setTimeout(() => setPhase("idle"), 7000)
  }

  return (
    <div class="flex flex-col h-full overflow-hidden">
      <div class="flex-1 overflow-y-auto">
        {/* Phase ring + controls */}
        <div class="flex flex-col items-center gap-4 py-6 px-3">
          <PhaseRing phase={phase()} tick={tick()} />

          <div class="flex flex-col items-center gap-1 text-center">
            <span class="text-14-medium" style={{ color: { idle: "#9ca3af", dreaming: "#8b5cf6", distilling: "#f59e0b", consolidating: "#3b82f6", complete: "#10b981" }[phase()] }}>
              {{ idle: "Ready to Evolve", dreaming: "Exploring Boundaries", distilling: "Crystallizing Knowledge", consolidating: "Integrating Gains", complete: "Cycle Complete" }[phase()]}
            </span>
            <span class="text-11-regular text-text-weak max-w-xs">
              {{ idle: "Dream expands capabilities. Distill crystallizes knowledge.", dreaming: "Generating new strategies and exploring uncharted patterns.", distilling: "Condensing recent insights into durable, high-signal knowledge.", consolidating: "Merging new capabilities with existing memory structures.", complete: "Capabilities and knowledge have been updated." }[phase()]}
            </span>
          </div>

          <Show when={!isRunning()}>
            <div class="flex gap-2">
              <button
                class="px-4 py-1.5 rounded-xl text-11-medium flex items-center gap-1.5 transition-all
                       border border-purple-500/30 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20"
                onClick={handleDream}
              >
                <span>✦</span> Dream
              </button>
              <button
                class="px-4 py-1.5 rounded-xl text-11-medium flex items-center gap-1.5 transition-all
                       border border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
                onClick={handleDistill}
              >
                <span>◇</span> Distill
              </button>
            </div>
          </Show>

          <Show when={isRunning()}>
            <button
              class="px-4 py-1.5 rounded-xl text-11-medium transition-all border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20"
              onClick={() => { setPhase("idle"); props?.onStop?.() }}
            >
              Stop
            </button>
          </Show>
        </div>

        {/* Activity log */}
        <Show when={isRunning()}>
          <div class="mx-3 mb-3 rounded-xl border border-border-weak-base bg-background-surface-base p-3">
            <div class="text-11-medium text-text-base mb-2">Activity Log</div>
            <div class="flex flex-col gap-1">
              <For each={logs()}>
                {(log) => (
                  <div class="flex items-start gap-2 text-10-regular text-text-weak py-0.5">
                    <div class="size-1 rounded-full mt-1.5 shrink-0"
                         style={{ background: { idle: "#6b7280", dreaming: "#8b5cf6", distilling: "#f59e0b", consolidating: "#3b82f6", complete: "#10b981" }[log.phase] }} />
                    <span>{log.message}</span>
                  </div>
                )}
              </For>
            </div>
          </div>
        </Show>

        {/* Capabilities */}
        <div class="mx-3 mb-3 rounded-xl border border-border-weak-base bg-background-surface-base p-3">
          <div class="text-11-medium text-text-base mb-2">Capabilities</div>
          <div class="flex flex-col gap-0.5">
            <For each={capabilities()}>
              {(cap) => <CapabilityCard cap={cap} />}
            </For>
          </div>
        </div>

        {/* Distilled Knowledge */}
        <div class="mx-3 mb-3 rounded-xl border border-border-weak-base bg-background-surface-base p-3">
          <div class="text-11-medium text-text-base mb-2">Distilled Knowledge</div>
          <div class="flex flex-col gap-1">
            <For each={knowledge()}>
              {(k) => (
                <div class="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-background-base transition-colors">
                  <div class="flex-1 min-w-0">
                    <div class="text-11-regular text-text-base truncate">{k.title}</div>
                    <div class="flex items-center gap-2 text-9-regular text-text-weaker">
                      <span>{k.source}</span>
                      <span>·</span>
                      <span>{k.confidence}%</span>
                    </div>
                  </div>
                  <div class="flex gap-1 shrink-0">
                    <For each={k.tags}>
                      {(tag) => <span class="text-8-regular text-text-weaker px-1 py-0 rounded bg-background-base">#{tag}</span>}
                    </For>
                  </div>
                </div>
              )}
            </For>
          </div>
        </div>
      </div>
    </div>
  )
}
