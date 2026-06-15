import { createSignal, createMemo, For, Show, onMount, onCleanup } from "solid-js"
import { DateTime } from "luxon"

function elapsed(ms: number) {
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${s % 60}s`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

export type StepStatus = "done" | "active" | "pending" | "error" | "skipped"
export type GoalStep = {
  id: string
  label: string
  status: StepStatus
  detail?: string
  startedAt?: number
  completedAt?: number
}

export type CycleType = "dream" | "distill" | "compose" | "explore" | "consolidate" | "standard"
export type Goal = {
  id: string
  title: string
  description?: string
  steps: GoalStep[]
  cycleType: CycleType
  iterationCount: number
  maxIterations?: number
  status: "running" | "paused" | "complete" | "error"
  startedAt: number
  tokensUsed: number
}

const CYCLE_COLORS: Record<CycleType, string> = {
  dream: "#8b5cf6",
  distill: "#f59e0b",
  compose: "#3b82f6",
  explore: "#10b981",
  consolidate: "#ec4899",
  standard: "#6b7280",
}

const STEP_COLORS: Record<StepStatus, string> = {
  done: "#10b981",
  active: "#f59e0b",
  pending: "#6b728040",
  error: "#ef4444",
  skipped: "#6b7280",
}

function GoalStepItem(props: { step: GoalStep; isLast: boolean; cycleColor: string }) {
  const color = () =>
    props.step.status === "done" ? STEP_COLORS.done
    : props.step.status === "active" ? props.cycleColor
    : props.step.status === "error" ? STEP_COLORS.error
    : STEP_COLORS.pending

  return (
    <div class="flex gap-3 relative">
      <div class="flex flex-col items-center shrink-0">
        <div
          class="size-4 rounded-full border-2 flex items-center justify-center z-10 transition-all"
          classList={{ "animate-pulse": props.step.status === "active" }}
          style={{ "border-color": color(), background: props.step.status === "done" ? color() : "var(--background-base)" }}
        >
          <Show when={props.step.status === "done"}>
            <svg viewBox="0 0 20 20" width="8" height="8" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round">
              <path d="M4 10L8 14L16 6" />
            </svg>
          </Show>
          <Show when={props.step.status === "error"}>
            <svg viewBox="0 0 20 20" width="8" height="8" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round">
              <path d="M5 5L15 15M15 5L5 15" />
            </svg>
          </Show>
          <Show when={props.step.status === "skipped"}>
            <svg viewBox="0 0 20 20" width="8" height="8" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round">
              <path d="M5 10L15 10" />
            </svg>
          </Show>
        </div>
        <Show when={!props.isLast}>
          <div class="w-px flex-1 mt-1" style={{ background: `${color()}40` }} />
        </Show>
      </div>

      <div class="flex flex-col gap-0.5 pt-0.5 pb-3 flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <span class="text-12-medium text-text-base">{props.step.label}</span>
          <Show when={props.step.status === "active"}>
            <span class="text-9-regular px-1.5 py-0 rounded-full bg-amber-500/15 text-amber-400">running</span>
          </Show>
          <Show when={props.step.status === "error"}>
            <span class="text-9-regular px-1.5 py-0 rounded-full bg-red-500/15 text-red-400">failed</span>
          </Show>
        </div>
        <Show when={props.step.detail}>
          <div class="text-11-regular text-text-weak">{props.step.detail}</div>
        </Show>
        <div class="flex items-center gap-2 text-9-regular text-text-weaker">
          <Show when={props.step.startedAt && props.step.completedAt}>
            <span>{DateTime.fromMillis(props.step.completedAt!).diff(DateTime.fromMillis(props.step.startedAt!)).toFormat("s")}s</span>
          </Show>
          <Show when={props.step.startedAt && !props.step.completedAt}>
            <span class="text-amber-400">in progress...</span>
          </Show>
        </div>
      </div>
    </div>
  )
}

function LifecycleBar(props: { goal: Goal }) {
  const done = () => props.goal.steps.filter((s) => s.status === "done").length
  const total = () => props.goal.steps.length
  const pct = () => total() > 0 ? Math.round((done() / total()) * 100) : 0
  const color = () => CYCLE_COLORS[props.goal.cycleType]

  const segments = createMemo(() =>
    props.goal.steps.map((s) => ({
      status: s.status,
      color: s.status === "done" ? "#10b981"
        : s.status === "active" ? color()
        : s.status === "error" ? "#ef4444"
        : "var(--color-border-weak-base)",
    }))
  )

  return (
    <div class="flex flex-col gap-1.5">
      <div class="flex h-2 rounded-full overflow-hidden bg-background-base gap-px">
        <For each={segments()}>
          {(seg) => (
            <div
              class="flex-1 rounded-full transition-all duration-500"
              style={{ background: seg.color, opacity: seg.status === "pending" ? 0.3 : 1 }}
            />
          )}
        </For>
      </div>
      <div class="flex items-center justify-between text-9-regular text-text-weaker">
        <span>{done()}/{total()} steps · {pct()}%</span>
        <span>{(props.goal.tokensUsed / 1000).toFixed(1)}K tokens</span>
      </div>
    </div>
  )
}

export function GoalTracker(props?: { goals?: Goal[] }) {
  const [tick, setTick] = createSignal(Date.now())
  let timer: ReturnType<typeof setInterval>
  onMount(() => { timer = setInterval(() => setTick(Date.now()), 1000) })
  onCleanup(() => clearInterval(timer))

  const goals = createMemo(() => props?.goals ?? [
    {
      id: "g1",
      title: "Rebrand Mimo Desktop",
      description: "Replace all OpenCode references and build Mimo feature panels",
      cycleType: "compose" as const,
      iterationCount: 3,
      status: "running" as const,
      startedAt: Date.now() - 600000,
      tokensUsed: 45200,
      steps: [
        { id: "s1", label: "Audit codebase for OpenCode strings", status: "done" as const, startedAt: Date.now() - 580000, completedAt: Date.now() - 520000 },
        { id: "s2", label: "Fix i18n locale files (14 locales)", status: "done" as const, startedAt: Date.now() - 520000, completedAt: Date.now() - 440000 },
        { id: "s3", label: "Replace Logo SVG with Mimo wordmark", status: "done" as const, startedAt: Date.now() - 440000, completedAt: Date.now() - 400000 },
        { id: "s4", label: "Build Mimo Hub panels (Memory, Agents, Goals, Workflows, Dream)", status: "active" as const, detail: "Creating workflow editor and memory engine", startedAt: Date.now() - 400000 },
        { id: "s5", label: "Enhance code review stats", status: "pending" as const },
        { id: "s6", label: "Wire IPC and test desktop build", status: "pending" as const },
      ],
    },
    {
      id: "g2",
      title: "Dream Cycle: UI Patterns",
      description: "Explore new UI patterns for agentic workflows",
      cycleType: "dream" as const,
      iterationCount: 1,
      status: "running" as const,
      startedAt: Date.now() - 300000,
      tokensUsed: 18700,
      steps: [
        { id: "d1", label: "Analyze existing workflow editors", status: "done" as const, startedAt: Date.now() - 280000, completedAt: Date.now() - 220000 },
        { id: "d2", label: "Generate node canvas concepts", status: "done" as const, startedAt: Date.now() - 220000, completedAt: Date.now() - 160000 },
        { id: "d3", label: "Prototype connection rendering", status: "active" as const, startedAt: Date.now() - 160000 },
        { id: "d4", label: "Test interaction patterns", status: "pending" as const },
      ],
    },
  ])

  const runningGoal = createMemo(() => goals().find((g) => g.status === "running"))
  const completedGoals = createMemo(() => goals().filter((g) => g.status === "complete"))

  return (
    <div class="flex flex-col h-full overflow-hidden">
      <div class="flex-1 overflow-y-auto py-2">
        <For each={goals()}>
          {(goal) => {
            const color = () => CYCLE_COLORS[goal.cycleType]
            const done = () => goal.steps.filter((s) => s.status === "done").length
            const total = () => goal.steps.length
            const pct = () => total() > 0 ? Math.round((done() / total()) * 100) : 0
            const elapsedMs = () => tick() - goal.startedAt

            return (
              <div class="mx-3 mb-3 p-3 rounded-xl border border-border-weak-base bg-background-surface-base">
                {/* Goal header */}
                <div class="flex items-start justify-between mb-2">
                  <div class="flex flex-col gap-0.5">
                    <div class="flex items-center gap-2">
                      <span
                        class="text-9-regular px-1.5 py-0 rounded-full uppercase font-medium"
                        style={{ background: `${color()}18`, color: color() }}
                      >
                        {goal.cycleType}
                      </span>
                      <Show when={goal.status === "running"}>
                        <div class="flex items-center gap-1">
                          <div class="size-1.5 rounded-full animate-pulse" style={{ background: color() }} />
                          <span class="text-9-regular" style={{ color: color() }}>running</span>
                        </div>
                      </Show>
                      <Show when={goal.iterationCount > 1}>
                        <span class="text-9-regular text-text-weaker">iter {goal.iterationCount}</span>
                      </Show>
                    </div>
                    <span class="text-13-medium text-text-base">{goal.title}</span>
                    <Show when={goal.description}>
                      <span class="text-11-regular text-text-weak">{goal.description}</span>
                    </Show>
                  </div>
                  <span class="text-9-regular text-text-weaker shrink-0">{elapsed(elapsedMs())}</span>
                </div>

                <LifecycleBar goal={goal} />

                {/* Steps */}
                <div class="mt-3">
                  <For each={goal.steps}>
                    {(step, i) => (
                      <GoalStepItem
                        step={step}
                        isLast={i() === goal.steps.length - 1}
                        cycleColor={color()}
                      />
                    )}
                  </For>
                </div>
              </div>
            )
          }}
        </For>

        <Show when={goals().length === 0}>
          <div class="flex flex-col items-center gap-2 py-12 text-center">
            <div class="text-2xl opacity-30">◎</div>
            <div class="text-12-medium text-text-base">No active goals</div>
            <div class="text-11-regular text-text-weak">Start a task to track progress here</div>
          </div>
        </Show>
      </div>
    </div>
  )
}
