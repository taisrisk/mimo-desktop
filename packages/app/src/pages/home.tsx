import { createMemo, createResource, createSignal, For, Match, Show, Switch } from "solid-js"
import { useNavigate } from "@solidjs/router"
import { DateTime } from "luxon"
import { useGlobalSync } from "@/context/global-sync"
import { useServer } from "@/context/server"
import { useLayout } from "@/context/layout"
import { usePlatform } from "@/context/platform"
import { useDialog } from "@mimo-ai/ui/context/dialog"
import { base64Encode } from "@mimo-ai/shared/util/encode"
import { DialogSelectDirectory } from "@/components/dialog-select-directory"
import { DialogSelectServer } from "@/components/dialog-select-server"
import { useLanguage } from "@/context/language"

// ─── Tokens ───────────────────────────────────────────────────────────────────
const CARD_BG  = "rgba(255,255,255,0.04)"
const CARD_BDR = "rgba(255,255,255,0.08)"
const TEXT_1   = "#ffffff"
const TEXT_2   = "rgba(255,255,255,0.55)"
const TEXT_3   = "rgba(255,255,255,0.3)"
const PURPLE   = "#c084fc"
const PURPLE_D = "#7c3aed"
const GREEN    = "#4ade80"
const RADIUS   = "20px"
const PILL     = "50px"

const card = {
  background: CARD_BG,
  border: `1px solid ${CARD_BDR}`,
  "border-radius": RADIUS,
  "backdrop-filter": "blur(20px)",
  "-webkit-backdrop-filter": "blur(20px)",
}

// ─── Utilities ────────────────────────────────────────────────────────────────
type SkillInfo = { name: string; description: string; location: string }

function getUserName(p: string): string {
  if (!p) return "Developer"
  const parts = p.replace(/\\/g, "/").split("/").filter(Boolean)
  const last = parts.at(-1) ?? ""
  return last ? last.charAt(0).toUpperCase() + last.slice(1) : "Developer"
}

function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0 }
  return Math.abs(h)
}

const PALETTES = [
  ["#a855f7","#6366f1"],["#ec4899","#f43f5e"],["#3b82f6","#06b6d4"],
  ["#10b981","#14b8a6"],["#f59e0b","#ef4444"],["#8b5cf6","#ec4899"],
  ["#06b6d4","#3b82f6"],["#f97316","#eab308"],
]
function gradientFor(name: string) {
  const [a, b] = PALETTES[hashStr(name) % PALETTES.length]!
  return `linear-gradient(135deg, ${a}, ${b})`
}

function projectName(worktree: string) {
  return worktree.replace(/\\/g, "/").split("/").pop() ?? worktree
}

// ─── Activity chart ───────────────────────────────────────────────────────────
function ActivityChart(props: { data: number[] }) {
  const max = createMemo(() => Math.max(...props.data, 1))
  const W = 900; const H = 120
  const points = createMemo(() =>
    props.data.map((v, i) => {
      const x = (i / (props.data.length - 1)) * W
      const y = H - (v / max()) * (H - 10)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
  )
  const line = createMemo(() => `M ${points().join(" L ")}`)
  const area = createMemo(() => `${line()} L ${W},${H} L 0,${H} Z`)

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: "100%", height: "130px", display: "block" }}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color={PURPLE} stop-opacity="0.35" />
          <stop offset="100%" stop-color={PURPLE} stop-opacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area()} fill="url(#chartFill)" />
      <path d={line()} fill="none" stroke={PURPLE} stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Home() {
  const sync   = useGlobalSync()
  const server = useServer()
  const layout = useLayout()
  const plat   = usePlatform()
  const dialog = useDialog()
  const nav    = useNavigate()
  const lang   = useLanguage()

  const [chartRange, setChartRange]     = createSignal<"1D"|"1W"|"1M"|"6M"|"1Y">("6M")
  const [projectFilter, setProjectFilter] = createSignal<"all"|"today"|"week">("all")

  const username = createMemo(() => getUserName(sync.data.path.home))
  const homedir  = createMemo(() => sync.data.path.home)
  const now      = Date.now()
  const weekMs   = 7 * 86_400_000
  const dayMs    = 86_400_000

  const activeWeek  = createMemo(() => sync.data.project.filter(p => (p.time.updated ?? p.time.created) > now - weekMs).length)
  const connCount   = createMemo(() => sync.data.provider.connected.length)

  const [skillCount] = createResource(async () => {
    try {
      const url = server.current?.http.url ?? ""
      if (!url) return 0
      const res = await fetch(`${url}/skill`)
      if (!res.ok) return 0
      return ((await res.json()) as SkillInfo[]).length
    } catch { return 0 }
  })

  const sorted = createMemo(() =>
    sync.data.project.slice().sort((a, b) =>
      (b.time.updated ?? b.time.created) - (a.time.updated ?? a.time.created)
    )
  )

  const filteredProjects = createMemo(() => {
    const f = projectFilter()
    if (f === "today") return sorted().filter(p => (p.time.updated ?? p.time.created) > now - dayMs)
    if (f === "week")  return sorted().filter(p => (p.time.updated ?? p.time.created) > now - weekMs)
    return sorted()
  })

  const activityData = createMemo(() => {
    const buckets = new Array(52).fill(0)
    const start = now - 52 * weekMs
    for (const p of sync.data.project) {
      const t = p.time.updated ?? p.time.created
      const idx = Math.floor((t - start) / weekMs)
      if (idx >= 0 && idx < 52) buckets[idx]++
    }
    return buckets
  })

  function openProject(dir: string) {
    layout.projects.open(dir)
    server.projects.touch(dir)
    nav(`/${base64Encode(dir)}`)
  }

  async function chooseProject() {
    function resolve(result: string | string[] | null) {
      if (Array.isArray(result)) result.forEach(d => openProject(d))
      else if (result) openProject(result)
    }
    if (plat.openDirectoryPickerDialog && server.isLocal()) {
      resolve(await plat.openDirectoryPickerDialog({ title: lang.t("command.project.open"), multiple: true }))
    } else {
      dialog.show(() => <DialogSelectDirectory multiple onSelect={resolve} />, () => resolve(null))
    }
  }

  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]

  return (
    <div style={{ background: "transparent", width: "100%", height: "100%", "overflow-y": "auto", position: "relative", "font-family": "var(--helios-font)" }}>

      <div style={{ position: "relative", "z-index": 1, padding: "24px 32px", display: "flex", "flex-direction": "column", gap: "18px", "max-width": "1320px", margin: "0 auto" }}>

        {/* ══ HEADER ══════════════════════════════════════════════════════════ */}
        <div style={{ display: "flex", "align-items": "flex-start", "justify-content": "space-between" }}>
          {/* Left: greeting */}
          <div>
            <div style={{ "font-size": "30px", "font-weight": "700", color: TEXT_1, "line-height": "1.2", "letter-spacing": "-0.5px" }}>
              Welcome,{" "}
              <span style={{ color: PURPLE }}>{username()}</span>
            </div>
            <div style={{ "font-size": "12px", color: TEXT_2, "margin-top": "4px" }}>
              Here's your AI development overview
            </div>
          </div>

          {/* Right: bell + gear + avatar */}
          <div style={{ display: "flex", "align-items": "center", gap: "10px" }}>
            {/* Bell */}
            <button
              style={{ width: "38px", height: "38px", "border-radius": "50%", background: CARD_BG, border: `1px solid ${CARD_BDR}`, display: "flex", "align-items": "center", "justify-content": "center", cursor: "pointer", color: TEXT_2 }}
              title="Notifications"
            >
              <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
                <path d="M10 2a6 6 0 00-6 6v3l-1.5 2.5h15L16 11V8a6 6 0 00-6-6z" />
                <path d="M8 16a2 2 0 004 0" />
              </svg>
            </button>
            {/* Settings */}
            <button
              style={{ width: "38px", height: "38px", "border-radius": "50%", background: CARD_BG, border: `1px solid ${CARD_BDR}`, display: "flex", "align-items": "center", "justify-content": "center", cursor: "pointer", color: TEXT_2 }}
              onClick={() => nav("/settings")}
              title="Settings"
            >
              <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
                <path d="M10 13a3 3 0 100-6 3 3 0 000 6z" />
                <path d="M10 2v1.5M10 16.5V18M3.5 5.22l1.06 1.06M15.44 13.72l1.06 1.06M2 10h1.5M16.5 10H18M3.56 14.78l1.06-1.06M15.38 6.28l1.06-1.06" />
              </svg>
            </button>
            {/* Avatar + name */}
            <div style={{ display: "flex", "align-items": "center", gap: "10px" }}>
              <div style={{ "text-align": "right" }}>
                <div style={{ "font-size": "13px", "font-weight": "600", color: TEXT_1 }}>{username()}</div>
                <div style={{ "font-size": "11px", color: TEXT_3 }}>
                  {server.name ?? "local"} · {DateTime.now().toFormat("dd LLL")}
                </div>
              </div>
              <div
                style={{ width: "40px", height: "40px", "border-radius": "50%", background: `linear-gradient(135deg, ${PURPLE_D}, #ec4899)`, display: "flex", "align-items": "center", "justify-content": "center", color: "#fff", "font-weight": "700", "font-size": "13px" }}
              >
                {username().slice(0, 2).toUpperCase()}
              </div>
            </div>
          </div>
        </div>

        {/* ══ SUB-HEADER: tabs + search ═══════════════════════════════════════ */}
        <div style={{ display: "flex", "align-items": "center", "justify-content": "space-between" }}>
          {/* Pill tab switcher */}
          <div style={{ display: "flex", "align-items": "center", gap: "4px", padding: "4px", background: CARD_BG, border: `1px solid ${CARD_BDR}`, "border-radius": PILL }}>
            <For each={[
              { id: "projects" as const, label: "Projects" },
              { id: "memory" as const, label: "Memory" },
              { id: "tools" as const, label: "Tools" },
            ]}>
              {(t) => {
                const active = createMemo(() => (t.id === "projects" ? projectFilter() !== "today" && projectFilter() !== "week" : false))
                return (
                  <button
                    style={{
                      padding: "7px 20px",
                      "border-radius": PILL,
                      "font-size": "13px",
                      "font-weight": "500",
                      cursor: "pointer",
                      transition: "all 0.15s",
                      background: t.id === "projects" ? "rgba(255,255,255,0.1)" : "transparent",
                      color: t.id === "projects" ? TEXT_1 : TEXT_2,
                      border: "none",
                    }}
                    onClick={() => {
                      if (t.id === "memory") nav("/memory")
                    }}
                  >
                    {t.label}
                  </button>
                )
              }}
            </For>
          </div>

          {/* Search pill */}
          <button
            style={{ display: "flex", "align-items": "center", gap: "10px", padding: "10px 20px", "border-radius": PILL, background: CARD_BG, border: `1px solid ${CARD_BDR}`, color: TEXT_2, "font-size": "13px", cursor: "pointer", "min-width": "260px" }}
          >
            <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
              <circle cx="9" cy="9" r="6" /><path d="M15 15l3 3" />
            </svg>
            Ask Mimo anything
            <span style={{ "margin-left": "auto", "font-size": "10px", padding: "2px 6px", "border-radius": "6px", background: "rgba(255,255,255,0.08)", color: TEXT_3 }}>/</span>
          </button>
        </div>

        {/* ══ 3-COLUMN MAIN GRID ══════════════════════════════════════════════ */}
        <div style={{ display: "grid", "grid-template-columns": "300px 1fr 300px", gap: "16px", "align-items": "start" }}>

          {/* ── Col 1: Stat card + Promo card ── */}
          <div style={{ display: "flex", "flex-direction": "column", gap: "16px" }}>

            {/* Total Projects card */}
            <div style={{ ...card, padding: "22px" }}>
              <div style={{ display: "flex", "align-items": "center", "justify-content": "space-between" }}>
                <span style={{ "font-size": "12px", color: TEXT_2, "font-weight": "500" }}>Total Projects</span>
                <button
                  style={{ display: "flex", "align-items": "center", gap: "5px", padding: "4px 10px", "border-radius": PILL, background: "rgba(255,255,255,0.06)", border: `1px solid ${CARD_BDR}`, "font-size": "11px", color: TEXT_2, cursor: "pointer" }}
                >
                  6M
                  <svg viewBox="0 0 20 20" width="9" height="9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                    <path d="M5 8l5 5 5-5" />
                  </svg>
                </button>
              </div>
              <div style={{ "font-size": "42px", "font-weight": "700", color: TEXT_1, "margin-top": "14px", "letter-spacing": "-2px", "line-height": "1" }}>
                {sync.data.project.length}
              </div>
              <div style={{ display: "flex", "align-items": "center", gap: "6px", "margin-top": "8px" }}>
                <span style={{ "font-size": "11px", color: GREEN, "font-weight": "600" }}>+{activeWeek()} this week</span>
              </div>
            </div>

            {/* Promo / Dual Memory card */}
            <div style={{ ...card, background: "rgba(60,20,100,0.5)", border: "1px solid rgba(192,132,252,0.2)", padding: "22px", position: "relative", overflow: "hidden", "min-height": "200px" }}>
              {/* Inner glow */}
              <div style={{ position: "absolute", bottom: "-30px", left: "50%", transform: "translateX(-50%)", width: "240px", height: "140px", background: `radial-gradient(ellipse, rgba(192,132,252,0.45) 0%, transparent 70%)`, "pointer-events": "none" }} />
              <div style={{ position: "relative", "z-index": 1 }}>
                <div style={{ "font-size": "14px", "font-weight": "700", color: TEXT_1 }}>Powered by Dual AI Memory</div>
                <div style={{ "font-size": "11px", color: "rgba(196,181,253,0.8)", "margin-top": "6px", "line-height": "1.6" }}>
                  Graph DB + Vector RAG for context-aware intelligence across all your projects.
                </div>
                <button
                  style={{ "margin-top": "20px", background: "linear-gradient(135deg, rgba(168,85,247,0.9), rgba(124,58,237,0.9))", color: "#fff", border: "none", "border-radius": "12px", padding: "10px 0", "font-size": "13px", "font-weight": "600", cursor: "pointer", width: "100%", "letter-spacing": "0.1px" }}
                  onClick={() => nav("/memory")}
                >
                  Explore Memory Graph
                </button>
              </div>
            </div>
          </div>

          {/* ── Col 2: Recent Projects (Watchlist-style) ── */}
          <div style={{ ...card, padding: "0", display: "flex", "flex-direction": "column" }}>
            {/* Header */}
            <div style={{ display: "flex", "align-items": "center", "justify-content": "space-between", padding: "18px 20px 14px" }}>
              <span style={{ "font-size": "14px", "font-weight": "700", color: TEXT_1 }}>Recent Projects</span>
              {/* Sub-filter pills */}
              <div style={{ display: "flex", gap: "4px" }}>
                <For each={[
                  { id: "all" as const, label: "All" },
                  { id: "today" as const, label: "Today" },
                  { id: "week" as const, label: "Week" },
                ]}>
                  {(f) => (
                    <button
                      style={{
                        padding: "4px 12px",
                        "border-radius": PILL,
                        "font-size": "11px",
                        "font-weight": "500",
                        cursor: "pointer",
                        transition: "all 0.15s",
                        background: projectFilter() === f.id ? "rgba(255,255,255,0.12)" : "transparent",
                        color: projectFilter() === f.id ? TEXT_1 : TEXT_2,
                        border: projectFilter() === f.id ? `1px solid ${CARD_BDR}` : "1px solid transparent",
                      }}
                      onClick={() => setProjectFilter(f.id)}
                    >
                      {f.label}
                    </button>
                  )}
                </For>
              </div>
            </div>

            {/* List */}
            <div style={{ display: "flex", "flex-direction": "column", "overflow-y": "auto" }}>
              <Switch>
                <Match when={!sync.ready && sync.data.project.length === 0}>
                  <div style={{ padding: "30px 20px", "font-size": "12px", color: TEXT_3, "text-align": "center" }}>Loading…</div>
                </Match>
                <Match when={filteredProjects().length === 0}>
                  <div style={{ padding: "40px 20px", "text-align": "center" }}>
                    <div style={{ "font-size": "13px", color: TEXT_2, "margin-bottom": "12px" }}>No projects yet</div>
                    <button
                      style={{ "font-size": "12px", padding: "8px 16px", "border-radius": "12px", background: `rgba(192,132,252,0.15)`, border: `1px solid rgba(192,132,252,0.25)`, color: PURPLE, cursor: "pointer" }}
                      onClick={chooseProject}
                    >
                      Open first project
                    </button>
                  </div>
                </Match>
                <Match when>
                  <For each={filteredProjects().slice(0, 7)}>
                    {(proj) => {
                      const name = projectName(proj.worktree)
                      const rel  = DateTime.fromMillis(proj.time.updated ?? proj.time.created).toRelative()
                      const shortPath = proj.worktree.replace(homedir(), "~").replace(/\\/g, "/")
                      return (
                        <button
                          style={{ display: "flex", "align-items": "center", gap: "12px", padding: "12px 20px", background: "transparent", border: "none", cursor: "pointer", transition: "background 0.15s", "border-top": `1px solid ${CARD_BDR}` }}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
                          onClick={() => openProject(proj.worktree)}
                        >
                          <div style={{ width: "36px", height: "36px", "border-radius": "10px", background: gradientFor(name), display: "flex", "align-items": "center", "justify-content": "center", "font-size": "11px", "font-weight": "700", color: "#fff", "flex-shrink": "0" }}>
                            {name.slice(0, 2).toUpperCase()}
                          </div>
                          <div style={{ flex: 1, "min-width": 0, "text-align": "left" }}>
                            <div style={{ "font-size": "13px", "font-weight": "600", color: TEXT_1, "white-space": "nowrap", overflow: "hidden", "text-overflow": "ellipsis" }}>{name}</div>
                            <div style={{ "font-size": "10px", color: TEXT_3, "margin-top": "2px", "white-space": "nowrap", overflow: "hidden", "text-overflow": "ellipsis" }}>{shortPath}</div>
                          </div>
                          <div style={{ "font-size": "11px", color: GREEN, "font-weight": "600", "flex-shrink": "0" }}>{rel}</div>
                        </button>
                      )
                    }}
                  </For>
                </Match>
              </Switch>
            </div>

            {/* Open project footer */}
            <button
              style={{ display: "flex", "align-items": "center", "justify-content": "center", gap: "6px", padding: "14px", background: "transparent", border: "none", "border-top": `1px solid ${CARD_BDR}`, "border-bottom-left-radius": RADIUS, "border-bottom-right-radius": RADIUS, "font-size": "12px", color: TEXT_2, cursor: "pointer", transition: "background 0.15s" }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
              onClick={chooseProject}
            >
              <svg viewBox="0 0 20 20" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10 4v12M4 10h12" /></svg>
              Open Project
            </button>
          </div>

          {/* ── Col 3: My Projects 2×2 grid ── */}
          <div style={{ ...card, padding: "18px" }}>
            <div style={{ display: "flex", "align-items": "center", "justify-content": "space-between", "margin-bottom": "14px" }}>
              <span style={{ "font-size": "14px", "font-weight": "700", color: TEXT_1 }}>My Projects</span>
              <button
                style={{ "font-size": "11px", color: TEXT_2, padding: "4px 10px", "border-radius": PILL, background: "rgba(255,255,255,0.06)", border: `1px solid ${CARD_BDR}`, cursor: "pointer", "font-weight": "500" }}
                onClick={chooseProject}
              >
                See all
              </button>
            </div>

            <div style={{ display: "grid", "grid-template-columns": "1fr 1fr", gap: "8px" }}>
              <Switch>
                <Match when={sorted().length === 0}>
                  <div style={{ "grid-column": "1/-1", "text-align": "center", padding: "20px 0", "font-size": "11px", color: TEXT_3 }}>
                    No projects
                  </div>
                </Match>
                <Match when>
                  <For each={sorted().slice(0, 4)}>
                    {(proj) => {
                      const name = projectName(proj.worktree)
                      const rel  = DateTime.fromMillis(proj.time.updated ?? proj.time.created).toRelative()
                      const totalMs  = (proj.time.updated ?? proj.time.created) - proj.time.created
                      return (
                        <button
                          style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${CARD_BDR}`, "border-radius": "14px", padding: "12px", "text-align": "left", cursor: "pointer", transition: "border-color 0.15s" }}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = "rgba(192,132,252,0.4)"}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = CARD_BDR}
                          onClick={() => openProject(proj.worktree)}
                        >
                          <div style={{ width: "32px", height: "32px", "border-radius": "8px", background: gradientFor(name), display: "flex", "align-items": "center", "justify-content": "center", "font-size": "10px", "font-weight": "700", color: "#fff", "margin-bottom": "8px" }}>
                            {name.slice(0, 2).toUpperCase()}
                          </div>
                          <div style={{ "font-size": "11px", "font-weight": "600", color: TEXT_1, "white-space": "nowrap", overflow: "hidden", "text-overflow": "ellipsis" }}>{name}</div>
                          <div style={{ "font-size": "10px", color: TEXT_3, "margin-top": "3px" }}>
                            {rel}
                          </div>
                          <div style={{ "font-size": "10px", color: GREEN, "margin-top": "4px", "font-weight": "600" }}>
                            +{activeWeek()} active
                          </div>
                        </button>
                      )
                    }}
                  </For>
                </Match>
              </Switch>
            </div>

            {/* Quick stats at bottom */}
            <div style={{ display: "flex", gap: "8px", "margin-top": "12px" }}>
              <div style={{ flex: 1, background: "rgba(255,255,255,0.04)", "border-radius": "12px", padding: "10px 12px" }}>
                <div style={{ "font-size": "10px", color: TEXT_3 }}>Providers</div>
                <div style={{ "font-size": "18px", "font-weight": "700", color: TEXT_1, "margin-top": "2px" }}>{connCount()}</div>
              </div>
              <div style={{ flex: 1, background: "rgba(255,255,255,0.04)", "border-radius": "12px", padding: "10px 12px" }}>
                <div style={{ "font-size": "10px", color: TEXT_3 }}>Skills</div>
                <div style={{ "font-size": "18px", "font-weight": "700", color: TEXT_1, "margin-top": "2px" }}>{skillCount() ?? "—"}</div>
              </div>
            </div>
          </div>
        </div>

        {/* ══ BOTTOM: Activity Chart ═══════════════════════════════════════════ */}
        <div style={{ ...card, padding: "22px", position: "relative", overflow: "hidden" }}>
          {/* Purple glow behind chart */}
          <div style={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "90%", height: "180px", background: `radial-gradient(ellipse, rgba(124,58,237,0.18) 0%, transparent 70%)`, "pointer-events": "none" }} />

          <div style={{ position: "relative", "z-index": 1 }}>
            {/* Chart header */}
            <div style={{ display: "flex", "align-items": "center", "justify-content": "space-between", "margin-bottom": "20px" }}>
              <div>
                <div style={{ "font-size": "14px", "font-weight": "700", color: TEXT_1 }}>Project Activity</div>
                <div style={{ "font-size": "11px", color: TEXT_2, "margin-top": "3px" }}>Projects opened or updated — past 12 months</div>
              </div>
              <div style={{ display: "flex", gap: "4px" }}>
                <For each={["1D","1W","1M","6M","1Y"] as const}>
                  {(range) => (
                    <button
                      style={{
                        padding: "5px 12px",
                        "border-radius": "8px",
                        "font-size": "11px",
                        "font-weight": "500",
                        cursor: "pointer",
                        transition: "all 0.15s",
                        background: chartRange() === range ? "rgba(192,132,252,0.15)" : "transparent",
                        color: chartRange() === range ? PURPLE : TEXT_2,
                        border: chartRange() === range ? `1px solid rgba(192,132,252,0.3)` : `1px solid transparent`,
                      }}
                      onClick={() => setChartRange(range)}
                    >
                      {range}
                    </button>
                  )}
                </For>
              </div>
            </div>

            {/* Chart */}
            <ActivityChart data={activityData()} />

            {/* Month labels */}
            <div style={{ display: "flex", "justify-content": "space-between", "margin-top": "8px" }}>
              <For each={MONTHS}>{(m) => <span style={{ "font-size": "10px", color: TEXT_3 }}>{m}</span>}</For>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
