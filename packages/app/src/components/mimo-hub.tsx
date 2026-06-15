import { createSignal, For, Match, Show, Switch } from "solid-js"
import { createStore } from "solid-js/store"
import { MemoryEngine, type MemoryEntry, type MemoryType } from "./memory-engine"
import { AgentOrchestrator, type SubAgent } from "./agent-orchestrator"
import { GoalTracker, type Goal } from "./goal-tracker"
import { WorkflowEditor, type WorkflowDef } from "./workflow-editor"
import { SelfImprovement, type DreamPhase } from "./self-improvement"
import { CodeReviewStats } from "./code-review-stats"
import { Personalization } from "./personalization"
import McpConnector from "./mcp-connector"
import SkillManager from "./skill-manager"

type Tab = "memory" | "agents" | "goals" | "workflows" | "self" | "review" | "mcp" | "skills" | "settings"

const DEMO_MEMORIES: MemoryEntry[] = [
  { id: "1", type: "user-pref", content: "User prefers TypeScript strict mode with explicit return types", tags: ["typescript", "prefs"], pinned: true, confidence: 96, relevance: 0.92, accessedAt: Date.now() - 3600000, accessCount: 14, createdAt: Date.now() - 86400000 * 2 },
  { id: "2", type: "project-ctx", content: "Project uses Bun + electron-vite monorepo pattern", tags: ["bun", "electron", "monorepo"], pinned: false, confidence: 92, relevance: 0.85, accessedAt: Date.now() - 1800000, accessCount: 8, createdAt: Date.now() - 3600000 * 5 },
  { id: "3", type: "feedback", content: "Avoid using `any` — use `unknown` and narrow safely", tags: ["typescript", "quality"], pinned: false, confidence: 98, relevance: 0.95, accessedAt: Date.now() - 900000, accessCount: 22, createdAt: Date.now() - 3600000 * 2 },
  { id: "4", type: "reference", content: "Mimo Desktop rebrand: github.com/taisrisk/mimo-desktop", tags: ["mimo", "brand"], pinned: false, confidence: 85, relevance: 0.78, accessedAt: Date.now() - 600000, accessCount: 3, createdAt: Date.now() - 3600000 },
  { id: "5", type: "project-ctx", content: "SolidJS: prefer createStore over multiple createSignal", tags: ["solidjs", "patterns"], pinned: false, confidence: 90, relevance: 0.88, accessedAt: Date.now() - 300000, accessCount: 11, createdAt: Date.now() - 1800000 },
]

const DEMO_AGENTS: SubAgent[] = [
  { id: "a1", label: "Orchestrator", status: "active", task: "Coordinating UI rebrand", startedAt: Date.now() - 45000, messages: 12, tokensUsed: 4200, toolsUsed: ["file-read", "grep", "edit"] },
  { id: "a2", label: "File Scanner", status: "done", task: "Scanned 847 files for OpenCode refs", parentId: "a1", startedAt: Date.now() - 40000, messages: 6, tokensUsed: 1800, toolsUsed: ["glob", "grep"] },
  { id: "a3", label: "i18n Patcher", status: "active", task: "Patching locale strings", parentId: "a1", startedAt: Date.now() - 30000, messages: 8, tokensUsed: 2400, toolsUsed: ["read", "edit"] },
]

const DEMO_GOALS: Goal[] = [
  {
    id: "g1",
    title: "Rebrand Mimo Desktop",
    description: "Replace all OpenCode references, add Mimo feature panels, launch dev build",
    cycleType: "compose",
    iterationCount: 3,
    status: "running",
    startedAt: Date.now() - 600000,
    tokensUsed: 24800,
    steps: [
      { id: "s1", label: "Audit codebase for OpenCode strings", status: "done", completedAt: Date.now() - 500000 },
      { id: "s2", label: "Fix i18n locale files", status: "done", completedAt: Date.now() - 400000 },
      { id: "s3", label: "Replace Logo SVG with Mimo wordmark", status: "done", completedAt: Date.now() - 300000 },
      { id: "s4", label: "Redesign home page", status: "done", completedAt: Date.now() - 200000 },
      { id: "s5", label: "Build Mimo feature hub panels", status: "active", detail: "Memory, Agents, Goals, Workflows, Self-Improvement, Code Review tabs", startedAt: Date.now() - 100000 },
      { id: "s6", label: "Wire IPC and launch dev build", status: "pending" },
      { id: "s7", label: "Test and verify all panels", status: "pending" },
    ],
  },
]

const DEMO_WORKFLOWS: WorkflowDef[] = [
  {
    id: "wf1", name: "Code Review Pipeline", description: "Automated code review with Mimo analysis", lastRun: Date.now() - 3600000, status: "idle",
    nodes: [
      { id: "n1", type: "trigger", label: "PR Created", x: 200, y: 40 },
      { id: "n2", type: "prompt", label: "Mimo Review", x: 200, y: 140 },
      { id: "n3", type: "output", label: "Post Comment", x: 200, y: 240 },
    ],
    connections: [
      { id: "c1", from: "n1", to: "n2", fromPort: 0, toPort: 0 },
      { id: "c2", from: "n2", to: "n3", fromPort: 0, toPort: 0 },
    ],
  },
]

export function MimoHub(props: { visible?: boolean; onClose?: () => void }) {
  const [activeTab, setActiveTab] = createSignal<Tab>("memory")
  const [dreamPhase, setDreamPhase] = createSignal<DreamPhase>("idle")

  const TABS: Array<{ id: Tab; label: string; icon: string; color: string }> = [
    { id: "memory", label: "Memory", icon: "◎", color: "#3b82f6" },
    { id: "agents", label: "Agents", icon: "◈", color: "#10b981" },
    { id: "goals", label: "Goals", icon: "◉", color: "#f59e0b" },
    { id: "workflows", label: "Workflows", icon: "⬡", color: "#06b6d4" },
    { id: "self", label: "Self", icon: "✦", color: "#8b5cf6" },
    { id: "review", label: "Review", icon: "◇", color: "#ec4899" },
    { id: "mcp", label: "MCP", icon: "⊕", color: "#f97316" },
    { id: "skills", label: "Skills", icon: "⚙", color: "#14b8a6" },
    { id: "settings", label: "Settings", icon: "◆", color: "#6b7280" },
  ]

  return (
    <Show when={props.visible !== false}>
      <div
        class="flex flex-col border-l border-border-weak-base bg-background-base"
        style={{ width: "340px", "min-width": "280px", "max-width": "400px" }}
      >
        {/* Header */}
        <div class="flex items-center justify-between px-4 py-3 border-b border-border-weak-base shrink-0">
          <div class="flex items-center gap-2">
            <span class="text-13-medium text-text-base tracking-tight">Mimo Hub</span>
            <span class="text-9-regular text-text-weaker px-1.5 py-0 rounded-full bg-background-surface-base border border-border-weak-base">
              BETA
            </span>
          </div>
          <Show when={props.onClose}>
            <button
              class="size-5 flex items-center justify-center rounded text-text-weaker hover:text-text-base transition-colors"
              onClick={props.onClose}
            >
              <svg viewBox="0 0 20 20" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
                <path d="M4 4L16 16M16 4L4 16" />
              </svg>
            </button>
          </Show>
        </div>

        {/* Tabs */}
        <div class="flex border-b border-border-weak-base shrink-0 overflow-x-auto">
          <For each={TABS}>
            {(tab) => (
              <button
                class="flex-1 flex flex-col items-center gap-0.5 py-2 text-center transition-all border-b-2 min-w-0"
                classList={{
                  "border-b-transparent text-text-weak hover:text-text-base hover:bg-background-surface-base": activeTab() !== tab.id,
                  "text-text-base bg-background-surface-base": activeTab() === tab.id,
                }}
                style={activeTab() === tab.id ? { "border-bottom-color": tab.color } : {}}
                onClick={() => setActiveTab(tab.id)}
              >
                <span class="text-sm leading-none" style={{ color: activeTab() === tab.id ? tab.color : undefined }}>
                  {tab.icon}
                </span>
                <span class="text-8-regular truncate">{tab.label}</span>
              </button>
            )}
          </For>
        </div>

        {/* Content */}
        <div class="flex-1 overflow-hidden">
          <Switch>
            <Match when={activeTab() === "memory"}>
              <MemoryEngine initialMemories={DEMO_MEMORIES} />
            </Match>
            <Match when={activeTab() === "agents"}>
              <AgentOrchestrator agents={DEMO_AGENTS} />
            </Match>
            <Match when={activeTab() === "goals"}>
              <GoalTracker goals={DEMO_GOALS} />
            </Match>
            <Match when={activeTab() === "workflows"}>
              <WorkflowEditor workflows={DEMO_WORKFLOWS} />
            </Match>
            <Match when={activeTab() === "self"}>
              <SelfImprovement phase={dreamPhase()} />
            </Match>
            <Match when={activeTab() === "review"}>
              <CodeReviewStats />
            </Match>
            <Match when={activeTab() === "mcp"}>
              <McpConnector />
            </Match>
            <Match when={activeTab() === "skills"}>
              <SkillManager />
            </Match>
            <Match when={activeTab() === "settings"}>
              <Personalization />
            </Match>
          </Switch>
        </div>
      </div>
    </Show>
  )
}
