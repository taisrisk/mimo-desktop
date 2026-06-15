import { createSignal, createMemo, For, Show, onMount } from "solid-js"
import { DateTime } from "luxon"

export type FileChange = {
  path: string
  additions: number
  deletions: number
  type: "added" | "modified" | "deleted" | "renamed"
}

export type ReviewIssue = {
  id: string
  severity: "critical" | "warning" | "info"
  file: string
  line: number
  message: string
  category: string
}

export type ReviewMetrics = {
  totalFiles: number
  totalAdditions: number
  totalDeletions: number
  issues: ReviewIssue[]
  qualityScore: number
  testCoverage: number
  complexityScore: number
  securityScore: number
  files: FileChange[]
  reviewTime?: number
  commitsAnalyzed?: number
}

const SEVERITY_COLORS = { critical: "#ef4444", warning: "#f59e0b", info: "#3b82f6" }

function ScoreRing(props: { score: number; label: string; color: string; size?: number }) {
  const size = () => props.size ?? 64
  const r = () => size() / 2 - 6
  const circumference = () => 2 * Math.PI * r()
  const offset = () => circumference() * (1 - props.score / 100)
  const grade = () => props.score >= 90 ? "A+" : props.score >= 80 ? "A" : props.score >= 70 ? "B" : props.score >= 60 ? "C" : "D"

  return (
    <div class="flex flex-col items-center gap-1.5">
      <div class="relative" style={{ width: `${size()}px`, height: `${size()}px` }}>
        <svg viewBox={`0 0 ${size()} ${size()}`} class="w-full h-full -rotate-90">
          <circle cx={size() / 2} cy={size() / 2} r={r()} fill="none" stroke="var(--color-border-weak-base)" stroke-width="4" />
          <circle
            cx={size() / 2} cy={size() / 2} r={r()} fill="none"
            stroke={props.color} stroke-width="4" stroke-linecap="round"
            stroke-dasharray={`${circumference()}`} stroke-dashoffset={`${offset()}`}
            class="transition-all duration-1000"
          />
        </svg>
        <div class="absolute inset-0 flex flex-col items-center justify-center">
          <span class="text-14-bold" style={{ color: props.color }}>{grade()}</span>
          <span class="text-8-regular text-text-weaker">{props.score}</span>
        </div>
      </div>
      <span class="text-9-regular text-text-weaker">{props.label}</span>
    </div>
  )
}

function MetricCard(props: { label: string; value: string; trend?: number; color: string; icon: string }) {
  return (
    <div class="flex flex-col gap-1.5 p-3 rounded-xl border border-border-weak-base bg-background-surface-base">
      <div class="flex items-center justify-between">
        <span class="text-10-regular text-text-weaker">{props.label}</span>
        <span class="text-11" style={{ color: props.color }}>{props.icon}</span>
      </div>
      <div class="text-20-bold" style={{ color: props.color }}>{props.value}</div>
      <Show when={props.trend !== undefined}>
        <div class="flex items-center gap-0.5">
          <svg viewBox="0 0 20 20" width="9" height="9" fill="currentColor"
               style={{ color: (props.trend ?? 0) >= 0 ? "#10b981" : "#ef4444" }}>
            {(props.trend ?? 0) >= 0
              ? <path d="M10 4L16 10H13V16H7V10H4L10 4Z" />
              : <path d="M10 16L4 10H7V4H13V10H16L10 16Z" />}
          </svg>
          <span class="text-9-regular" style={{ color: (props.trend ?? 0) >= 0 ? "#10b981" : "#ef4444" }}>
            {Math.abs(props.trend ?? 0)}%
          </span>
        </div>
      </Show>
    </div>
  )
}

function IssueRow(props: { issue: ReviewIssue }) {
  const color = () => SEVERITY_COLORS[props.issue.severity]
  return (
    <div class="flex items-start gap-2 px-3 py-2 hover:bg-background-surface-base rounded-lg transition-colors">
      <div class="mt-1 size-1.5 rounded-full shrink-0" style={{ background: color() }} />
      <div class="flex-1 min-w-0">
        <div class="text-11-regular text-text-base">{props.issue.message}</div>
        <div class="flex items-center gap-2 mt-0.5">
          <span class="text-9-regular text-text-weaker">{props.issue.file}:{props.issue.line}</span>
          <span class="text-9-regular px-1.5 py-0 rounded" style={{ background: `${color()}15`, color: color() }}>
            {props.issue.severity}
          </span>
          <span class="text-9-regular text-text-weaker">{props.issue.category}</span>
        </div>
      </div>
    </div>
  )
}

function FileChangeBar(props: { file: FileChange; maxLines: number }) {
  const addPct = () => Math.max(1, (props.file.additions / props.maxLines) * 100)
  const delPct = () => Math.max(1, (props.file.deletions / props.maxLines) * 100)
  const typeColor = () => ({
    added: "#10b981",
    modified: "#3b82f6",
    deleted: "#ef4444",
    renamed: "#8b5cf6",
  })[props.file.type]

  return (
    <div class="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-background-surface-base transition-colors">
      <div class="size-2 rounded-sm shrink-0" style={{ background: typeColor() }} />
      <span class="text-11-regular text-text-base truncate flex-1 min-w-0">{props.file.path.split("/").pop()}</span>
      <div class="flex items-center gap-1 shrink-0">
        <span class="text-9-regular text-emerald-400">+{props.file.additions}</span>
        <span class="text-9-regular text-red-400">-{props.file.deletions}</span>
      </div>
      <div class="w-20 h-1.5 rounded-full bg-background-base overflow-hidden flex shrink-0">
        <div class="h-full rounded-full bg-emerald-500/60" style={{ width: `${addPct()}%` }} />
        <div class="h-full rounded-full bg-red-500/60" style={{ width: `${delPct()}%` }} />
      </div>
    </div>
  )
}

export function CodeReviewStats(props?: { metrics?: ReviewMetrics }) {
  const [filter, setFilter] = createSignal<"all" | "critical" | "warning" | "info">("all")
  const [tab, setTab] = createSignal<"overview" | "files" | "issues">("overview")

  const metrics = createMemo(() => props?.metrics ?? {
    totalFiles: 12,
    totalAdditions: 347,
    totalDeletions: 89,
    qualityScore: 87,
    testCoverage: 72,
    complexityScore: 81,
    securityScore: 94,
    commitsAnalyzed: 8,
    reviewTime: 14,
    files: [
      { path: "src/components/mimo-hub.tsx", additions: 142, deletions: 0, type: "added" as const },
      { path: "src/components/workflow-editor.tsx", additions: 198, deletions: 0, type: "added" as const },
      { path: "src/components/memory-engine.tsx", additions: 134, deletions: 0, type: "added" as const },
      { path: "src/pages/home.tsx", additions: 45, deletions: 32, type: "modified" as const },
      { path: "src/pages/layout.tsx", additions: 22, deletions: 8, type: "modified" as const },
      { path: "src/components/titlebar.tsx", additions: 8, deletions: 12, type: "modified" as const },
      { path: "src/i18n/en.ts", additions: 18, deletions: 14, type: "modified" as const },
      { path: "src/pages/layout/deep-links.ts", additions: 12, deletions: 6, type: "modified" as const },
      { path: "logo.tsx", additions: 23, deletions: 25, type: "modified" as const },
      { path: "mimo-components.css", additions: 451, deletions: 0, type: "added" as const },
      { path: "src/components/old-panel.tsx", additions: 0, deletions: 18, type: "deleted" as const },
      { path: "README.md", additions: 5, deletions: 3, type: "modified" as const },
    ],
    issues: [
      { id: "i1", severity: "warning" as const, file: "src/components/mimo-hub.tsx", line: 142, message: "Potential memory leak: setInterval not cleaned up on unmount", category: "performance" },
      { id: "i2", severity: "info" as const, file: "src/pages/home.tsx", line: 89, message: "Consider memoizing chart rendering for large datasets", category: "performance" },
      { id: "i3", severity: "warning" as const, file: "src/components/workflow-editor.tsx", line: 267, message: "Mouse event handlers should be passive where possible", category: "accessibility" },
      { id: "i4", severity: "info" as const, file: "src/pages/layout.tsx", line: 544, message: "MimoHub state could be extracted into a dedicated context", category: "architecture" },
      { id: "i5", severity: "critical" as const, file: "src/components/memory-engine.tsx", line: 18, message: "Simple text similarity is not sufficient for production — use embeddings", category: "security" },
    ],
  })

  const maxLines = createMemo(() => Math.max(...metrics().files.map((f) => f.additions + f.deletions), 1))
  const filteredIssues = createMemo(() =>
    filter() === "all" ? metrics().issues : metrics().issues.filter((i) => i.severity === filter())
  )
  const issueCounts = createMemo(() => ({
    critical: metrics().issues.filter((i) => i.severity === "critical").length,
    warning: metrics().issues.filter((i) => i.severity === "warning").length,
    info: metrics().issues.filter((i) => i.severity === "info").length,
  }))

  return (
    <div class="flex flex-col h-full overflow-hidden">
      {/* Tabs */}
      <div class="flex items-center border-b border-border-weak-base shrink-0 px-3">
        <For each={[
          { id: "overview" as const, label: "Overview" },
          { id: "files" as const, label: `Files (${metrics().totalFiles})` },
          { id: "issues" as const, label: `Issues (${metrics().issues.length})` },
        ]}>
          {(t) => (
            <button
              class="flex items-center gap-1.5 px-3 py-2.5 text-11-medium transition-colors border-b-2"
              classList={{
                "border-amber-500 text-text-base": tab() === t.id,
                "border-transparent text-text-weak hover:text-text-base": tab() !== t.id,
              }}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          )}
        </For>
      </div>

      <div class="flex-1 overflow-y-auto">
        <Show when={tab() === "overview"}>
          <div class="p-3 flex flex-col gap-3">
            {/* Score rings */}
            <div class="flex items-center justify-around py-4 px-3 rounded-xl border border-border-weak-base bg-background-surface-base">
              <ScoreRing score={metrics().qualityScore} label="Quality" color="#10b981" />
              <ScoreRing score={metrics().testCoverage} label="Coverage" color="#3b82f6" />
              <ScoreRing score={metrics().complexityScore} label="Complexity" color="#8b5cf6" />
              <ScoreRing score={metrics().securityScore} label="Security" color="#f59e0b" />
            </div>

            {/* Metric cards */}
            <div class="grid grid-cols-4 gap-2">
              <MetricCard label="Files Changed" value={String(metrics().totalFiles)} color="#f59e0b" icon="◈" />
              <MetricCard label="Lines Added" value={`+${metrics().totalAdditions}`} trend={12} color="#10b981" icon="↗" />
              <MetricCard label="Lines Removed" value={`-${metrics().totalDeletions}`} trend={-3} color="#ef4899" icon="↙" />
              <MetricCard label="Review Time" value={`${metrics().reviewTime ?? 0}m`} color="#6366f1" icon="◷" />
            </div>

            {/* Issue summary bar */}
            <div class="rounded-xl border border-border-weak-base p-3 bg-background-surface-base">
              <div class="text-11-medium text-text-base mb-2">Issue Summary</div>
              <div class="flex gap-1 h-3 rounded-full overflow-hidden bg-background-base">
                <Show when={issueCounts().critical > 0}>
                  <div class="bg-red-500 h-full rounded-l-full"
                       style={{ width: `${(issueCounts().critical / metrics().issues.length) * 100}%` }} />
                </Show>
                <Show when={issueCounts().warning > 0}>
                  <div class="bg-amber-500 h-full"
                       style={{ width: `${(issueCounts().warning / metrics().issues.length) * 100}%` }} />
                </Show>
                <Show when={issueCounts().info > 0}>
                  <div class="bg-blue-500 h-full rounded-r-full"
                       style={{ width: `${(issueCounts().info / metrics().issues.length) * 100}%` }} />
                </Show>
              </div>
              <div class="flex items-center gap-3 mt-2 text-9-regular">
                <span class="text-red-400">{issueCounts().critical} critical</span>
                <span class="text-amber-400">{issueCounts().warning} warnings</span>
                <span class="text-blue-400">{issueCounts().info} info</span>
              </div>
            </div>
          </div>
        </Show>

        <Show when={tab() === "files"}>
          <div class="p-3 flex flex-col gap-1">
            <div class="flex items-center justify-between px-2 py-1.5">
              <span class="text-10-medium text-text-weaker uppercase tracking-widest">Changed Files</span>
              <span class="text-9-regular text-text-weaker">{metrics().files.length} files</span>
            </div>
            <For each={metrics().files}>
              {(file) => <FileChangeBar file={file} maxLines={maxLines()} />}
            </For>
          </div>
        </Show>

        <Show when={tab() === "issues"}>
          <div class="p-3 flex flex-col gap-2">
            {/* Filter */}
            <div class="flex gap-1 px-1">
              <For each={["all", "critical", "warning", "info"] as const}>
                {(f) => (
                  <button
                    class="px-2 py-0.5 rounded-full text-9-regular transition-all"
                    style={{
                      background: filter() === f
                        ? f === "all" ? "rgba(255,255,255,0.08)" : `${SEVERITY_COLORS[f as keyof typeof SEVERITY_COLORS]}20`
                        : "transparent",
                      color: filter() === f
                        ? f === "all" ? "var(--color-text-base)" : SEVERITY_COLORS[f as keyof typeof SEVERITY_COLORS]
                        : "var(--color-text-weaker)",
                      border: `1px solid ${filter() === f
                        ? f === "all" ? "var(--color-border-base)" : `${SEVERITY_COLORS[f as keyof typeof SEVERITY_COLORS]}40`
                        : "transparent"}`,
                    }}
                    onClick={() => setFilter(f)}
                  >
                    {f}{f !== "all" ? ` (${f === "critical" ? issueCounts().critical : f === "warning" ? issueCounts().warning : issueCounts().info})` : ""}
                  </button>
                )}
              </For>
            </div>
            <For each={filteredIssues()}>
              {(issue) => <IssueRow issue={issue} />}
            </For>
          </div>
        </Show>
      </div>
    </div>
  )
}
