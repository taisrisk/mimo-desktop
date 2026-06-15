import { createEffect, createMemo, createSignal, For, Show, type Accessor, type JSX } from "solid-js"
import { useNavigate, useLocation } from "@solidjs/router"
import {
  DragDropProvider, DragDropSensors, DragOverlay, SortableProvider,
  closestCenter, type DragEvent,
} from "@thisbeyond/solid-dnd"
import { ConstrainDragXAxis } from "@/utils/solid-dnd"
import { IconButton } from "@mimo-ai/ui/icon-button"
import { Tooltip, TooltipKeybind } from "@mimo-ai/ui/tooltip"
import { type LocalProject } from "@/context/layout"

// ─── Design tokens (match home.tsx) ──────────────────────────────────────────
const BG_RAIL  = "#0d0d10"
const CARD_BDR = "rgba(255,255,255,0.07)"
const TEXT_1   = "#ffffff"
const TEXT_2   = "rgba(255,255,255,0.55)"
const TEXT_3   = "rgba(255,255,255,0.3)"
const PURPLE   = "#c084fc"
const PURPLE_D = "#7c3aed"

const RAIL_COLLAPSED = 64   // px
const RAIL_EXPANDED  = 220  // px

// ─── Nav items ────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  {
    id: "dashboard",
    label: "Dashboard",
    href: "/",
    exact: true,
    icon: () => (
      <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">
        <rect x="2" y="2" width="7" height="7" rx="1.5" />
        <rect x="11" y="2" width="7" height="7" rx="1.5" />
        <rect x="2" y="11" width="7" height="7" rx="1.5" />
        <rect x="11" y="11" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    id: "memory",
    label: "Memory",
    href: "/memory",
    exact: false,
    icon: () => (
      <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round">
        <path d="M13.33 8.75C11.49 8.75 10 7.26 10 5.41M6.67 11.25C8.51 11.25 10 12.74 10 14.58M10 2.78V17.07M16 15.05A5.83 5.83 0 0017.92 12.2c0-.86-.36-1.64-.93-2.2.57-.56.93-1.34.93-2.2 0-1.59-1.2-2.9-2.75-3.06A4.17 4.17 0 0011.76 2.08c-.64 0-1.24.17-1.76.47-.52-.3-1.12-.47-1.76-.47a4.17 4.17 0 00-4.17 3.66A3.33 3.33 0 003 7.8c0 .86.36 1.64.93 2.2-.57.56-.93 1.34-.93 2.2 0 1.34.79 2.44 1.93 2.85A4.17 4.17 0 007.8 17.92c.81 0 1.57-.25 2.2-.67.63.42 1.39.67 2.2.67A4.17 4.17 0 0016 15.05z" />
      </svg>
    ),
  },
  {
    id: "projects",
    label: "Projects",
    href: "#",
    exact: false,
    icon: () => (
      <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">
        <path d="M2 6.5C2 5.67 2.67 5 3.5 5H8l1.5 2H16.5C17.33 7 18 7.67 18 8.5v6c0 .83-.67 1.5-1.5 1.5h-13C2.67 16 2 15.33 2 14.5V6.5z" />
      </svg>
    ),
  },
  {
    id: "skills",
    label: "Skills",
    href: "#",
    exact: false,
    icon: () => (
      <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round">
        <path d="M10 2C6.13 2 3 5.13 3 9c0 2.21.9 4.21 2.34 5.66L6 16h8l.66-1.34A8 8 0 0017 9c0-3.87-3.13-7-7-7z" />
        <path d="M7 16v1a1 1 0 001 1h4a1 1 0 001-1v-1" />
      </svg>
    ),
  },
  {
    id: "community",
    label: "Community",
    href: "#",
    exact: false,
    icon: () => (
      <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round">
        <circle cx="8" cy="8" r="3" />
        <circle cx="15" cy="6" r="2" />
        <path d="M2 18c0-3.31 2.69-6 6-6s6 2.69 6 6" />
        <path d="M15 12c1.66 0 3 1.34 3 3" />
      </svg>
    ),
  },
]

// ─── NavItem ──────────────────────────────────────────────────────────────────
function NavItem(props: {
  item: (typeof NAV_ITEMS)[number]
  expanded: boolean
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const isActive = createMemo(() =>
    props.item.exact ? location.pathname === props.item.href : location.pathname.startsWith(props.item.href) && props.item.href !== "#"
  )

  const btn = (
    <button
      onClick={() => { if (props.item.href !== "#") navigate(props.item.href) }}
      style={{
        width: "100%",
        display: "flex",
        "align-items": "center",
        "justify-content": props.expanded ? "flex-start" : "center",
        gap: props.expanded ? "10px" : "0",
        padding: props.expanded ? "9px 12px" : "10px 0",
        "border-radius": "14px",
        background: isActive() ? `linear-gradient(135deg, rgba(124,58,237,0.55), rgba(109,40,217,0.35))` : "transparent",
        border: isActive() ? "1px solid rgba(192,132,252,0.25)" : "1px solid transparent",
        color: isActive() ? TEXT_1 : TEXT_2,
        cursor: "pointer",
        transition: "all 0.15s",
        "white-space": "nowrap",
        overflow: "hidden",
      }}
      onMouseEnter={e => {
        if (!isActive()) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"
      }}
      onMouseLeave={e => {
        if (!isActive()) (e.currentTarget as HTMLElement).style.background = "transparent"
      }}
    >
      <span style={{ "flex-shrink": 0, display: "flex", "align-items": "center", "justify-content": "center" }}>
        {props.item.icon()}
      </span>
      <Show when={props.expanded}>
        <span style={{ "font-size": "13px", "font-weight": isActive() ? "600" : "400", overflow: "hidden", "text-overflow": "ellipsis" }}>
          {props.item.label}
        </span>
      </Show>
    </button>
  )

  return (
    <Show when={!props.expanded} fallback={btn}>
      <Tooltip placement="right" value={props.item.label}>{btn}</Tooltip>
    </Show>
  )
}

// ─── Main sidebar content ─────────────────────────────────────────────────────
export const SidebarContent = (props: {
  mobile?: boolean
  opened: Accessor<boolean>
  aimMove: (event: MouseEvent) => void
  projects: Accessor<LocalProject[]>
  renderProject: (project: LocalProject) => JSX.Element
  handleDragStart: (event: unknown) => void
  handleDragEnd: () => void
  handleDragOver: (event: DragEvent) => void
  openProjectLabel: JSX.Element
  openProjectKeybind: Accessor<string | undefined>
  onOpenProject: () => void
  renderProjectOverlay: () => JSX.Element
  settingsLabel: Accessor<string>
  settingsKeybind: Accessor<string | undefined>
  onOpenSettings: () => void
  helpLabel: Accessor<string>
  onOpenHelp: () => void
  renderPanel: () => JSX.Element
}): JSX.Element => {
  const sessionOpen = createMemo(() => !!props.mobile || props.opened())
  let panel: HTMLDivElement | undefined

  const [navExpanded, setNavExpanded] = createSignal(true)
  const railPx = createMemo(() => navExpanded() ? RAIL_EXPANDED : RAIL_COLLAPSED)
  const placement = () => (props.mobile ? "bottom" : "right") as "bottom" | "right"

  createEffect(() => {
    const el = panel
    if (!el) return
    if (sessionOpen()) { el.removeAttribute("inert") } else { el.setAttribute("inert", "") }
  })

  return (
    <div style={{ display: "flex", height: "100%", width: "100%", "min-width": 0, overflow: "hidden" }}>

      {/* ─── Rail ───────────────────────────────────────────────────────────── */}
      <div
        style={{
          width: `${railPx()}px`,
          "min-width": `${railPx()}px`,
          "max-width": `${railPx()}px`,
          "flex-shrink": 0,
          background: BG_RAIL,
          "border-right": `1px solid ${CARD_BDR}`,
          display: "flex",
          "flex-direction": "column",
          overflow: "hidden",
          transition: "width 200ms ease, min-width 200ms ease, max-width 200ms ease",
        }}
        onMouseMove={props.aimMove}
      >
        {/* ── Logo + toggle ── */}
        <div style={{
          display: "flex",
          "align-items": "center",
          "justify-content": navExpanded() ? "space-between" : "center",
          padding: navExpanded() ? "16px 12px 12px" : "16px 0 12px",
          "flex-shrink": 0,
        }}>
          <Show when={navExpanded()}>
            <div style={{ display: "flex", "align-items": "center", gap: "8px", "padding-left": "4px", "overflow": "hidden", "white-space": "nowrap" }}>
              <div style={{ width: "26px", height: "26px", "border-radius": "8px", background: `linear-gradient(135deg, ${PURPLE_D}, #6366f1)`, display: "flex", "align-items": "center", "justify-content": "center", "font-size": "12px", "font-weight": "800", color: "#fff", "flex-shrink": 0 }}>
                M
              </div>
              <span style={{ "font-size": "14px", "font-weight": "700", color: TEXT_1 }}>Mimo</span>
            </div>
          </Show>
          <Tooltip placement={placement()} value={navExpanded() ? "Collapse" : "Expand"}>
            <button
              style={{ width: "32px", height: "32px", display: "flex", "align-items": "center", "justify-content": "center", "border-radius": "10px", background: "transparent", border: "none", cursor: "pointer", color: TEXT_2, "flex-shrink": 0, transition: "background 0.15s" }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
              onClick={() => setNavExpanded(v => !v)}
            >
              <svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
                <Show when={navExpanded()} fallback={<path d="M3 6h14M3 10h14M3 14h14" />}>
                  <path d="M3 6h14M3 10h8M3 14h14" />
                </Show>
              </svg>
            </button>
          </Tooltip>
        </div>

        {/* ── Primary nav ── */}
        <div style={{ padding: navExpanded() ? "0 8px" : "0 10px", display: "flex", "flex-direction": "column", gap: "2px", "flex-shrink": 0 }}>
          <For each={NAV_ITEMS}>
            {(item) => <NavItem item={item} expanded={navExpanded()} />}
          </For>
        </div>

        {/* ── Projects section label ── */}
        <Show when={navExpanded()}>
          <div style={{ padding: "14px 20px 4px", "font-size": "10px", "font-weight": "500", color: TEXT_3, "letter-spacing": "0.08em", "text-transform": "uppercase", "flex-shrink": 0 }}>
            Open
          </div>
        </Show>

        {/* ── Project list (sortable) ── */}
        <div style={{ flex: 1, "min-height": 0, overflow: "hidden" }}>
          <DragDropProvider
            onDragStart={props.handleDragStart}
            onDragEnd={props.handleDragEnd}
            onDragOver={props.handleDragOver}
            collisionDetector={closestCenter}
          >
            <DragDropSensors />
            <ConstrainDragXAxis />
            <div style={{ height: "100%", display: "flex", "flex-direction": "column", gap: "2px", "overflow-y": "auto", padding: navExpanded() ? "0 8px" : "0 10px" }}>
              <SortableProvider ids={props.projects().map(p => p.worktree)}>
                <For each={props.projects()}>{(p) => props.renderProject(p)}</For>
              </SortableProvider>
              <Tooltip
                placement={placement()}
                value={
                  <div style={{ display: "flex", "align-items": "center", gap: "6px" }}>
                    <span>{props.openProjectLabel}</span>
                    <Show when={!props.mobile && !!props.openProjectKeybind()}>
                      <span style={{ "font-size": "11px" }}>{props.openProjectKeybind()}</span>
                    </Show>
                  </div>
                }
              >
                <IconButton icon="plus" variant="ghost" size="large" onClick={props.onOpenProject} aria-label={typeof props.openProjectLabel === "string" ? props.openProjectLabel : undefined} />
              </Tooltip>
            </div>
            <DragOverlay>{props.renderProjectOverlay()}</DragOverlay>
          </DragDropProvider>
        </div>

        {/* ── Bottom: Settings + Help ── */}
        <div style={{ "flex-shrink": 0, padding: navExpanded() ? "8px 8px 20px" : "8px 10px 20px", display: "flex", "flex-direction": "column", gap: "2px", "border-top": `1px solid ${CARD_BDR}` }}>
          <Show when={navExpanded()}>
            <div style={{ "font-size": "10px", "font-weight": "500", color: TEXT_3, "letter-spacing": "0.08em", "text-transform": "uppercase", padding: "4px 4px 6px" }}>System</div>
          </Show>

          {/* Settings */}
          <Show
            when={navExpanded()}
            fallback={
              <TooltipKeybind placement={placement()} title={props.settingsLabel()} keybind={props.settingsKeybind() ?? ""}>
                <IconButton icon="settings-gear" variant="ghost" size="large" onClick={props.onOpenSettings} aria-label={props.settingsLabel()} />
              </TooltipKeybind>
            }
          >
            <button
              style={{ width: "100%", display: "flex", "align-items": "center", gap: "10px", padding: "9px 12px", "border-radius": "14px", background: "transparent", border: "none", cursor: "pointer", color: TEXT_2, "font-size": "13px", "white-space": "nowrap", overflow: "hidden", transition: "background 0.15s" }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
              onClick={props.onOpenSettings}
            >
              <svg viewBox="0 0 20 20" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" style={{ "flex-shrink": 0 }}>
                <path d="M10 13a3 3 0 100-6 3 3 0 000 6z" />
                <path d="M10 2v1.5M10 16.5V18M3.5 5.22l1.06 1.06M15.44 13.72l1.06 1.06M2 10h1.5M16.5 10H18M3.56 14.78l1.06-1.06M15.38 6.28l1.06-1.06" />
              </svg>
              Settings
            </button>
          </Show>

          {/* Help */}
          <Show
            when={navExpanded()}
            fallback={
              <Tooltip placement={placement()} value={props.helpLabel()}>
                <IconButton icon="help" variant="ghost" size="large" onClick={props.onOpenHelp} aria-label={props.helpLabel()} />
              </Tooltip>
            }
          >
            <button
              style={{ width: "100%", display: "flex", "align-items": "center", gap: "10px", padding: "9px 12px", "border-radius": "14px", background: "transparent", border: "none", cursor: "pointer", color: TEXT_2, "font-size": "13px", "white-space": "nowrap", overflow: "hidden", transition: "background 0.15s" }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
              onClick={props.onOpenHelp}
            >
              <svg viewBox="0 0 20 20" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" style={{ "flex-shrink": 0 }}>
                <circle cx="10" cy="10" r="8" />
                <path d="M10 14v.5" stroke-width="2" />
                <path d="M7.5 7.5a2.5 2.5 0 014.5 1.5c0 1.5-2.5 2-2.5 3.5" />
              </svg>
              Support
            </button>
          </Show>
        </div>
      </div>

      {/* ─── Session panel ─────────────────────────────────────────────────── */}
      <div
        ref={el => { panel = el }}
        style={{ flex: 1, display: "flex", height: "100%", "min-height": 0, "min-width": 0, overflow: "hidden", "pointer-events": sessionOpen() ? "auto" : "none" }}
        aria-hidden={!sessionOpen()}
      >
        {props.renderPanel()}
      </div>
    </div>
  )
}
