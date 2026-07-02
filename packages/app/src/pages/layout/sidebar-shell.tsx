import { createMemo, For, Show, type Accessor, type JSX } from "solid-js"
import { useNavigate, useLocation } from "@solidjs/router"
import {
  DragDropProvider, DragDropSensors, DragOverlay, SortableProvider,
  closestCenter, type DragEvent,
} from "@thisbeyond/solid-dnd"
import { ConstrainDragXAxis } from "@/utils/solid-dnd"
import { IconButton } from "@mimo-ai/ui/icon-button"
import { Tooltip, TooltipKeybind } from "@mimo-ai/ui/tooltip"
import { type LocalProject } from "@/context/layout"

const CARD_BDR = "rgba(255,255,255,0.08)"
const TEXT_1   = "#ffffff"
const TEXT_2   = "rgba(255,255,255,0.55)"

const NAV_ITEMS = [
  {
    id: "dashboard", label: "Dashboard", href: "/", exact: true,
    icon: () => (
      <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">
        <rect x="2" y="2" width="7" height="7" rx="1.5" /><rect x="11" y="2" width="7" height="7" rx="1.5" /><rect x="2" y="11" width="7" height="7" rx="1.5" /><rect x="11" y="11" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    id: "memory", label: "Memory", href: "/memory", exact: false,
    icon: () => (
      <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round">
        <path d="M13.33 8.75C11.49 8.75 10 7.26 10 5.41M6.67 11.25C8.51 11.25 10 12.74 10 14.58M10 2.78V17.07M16 15.05A5.83 5.83 0 0017.92 12.2c0-.86-.36-1.64-.93-2.2.57-.56.93-1.34.93-2.2 0-1.59-1.2-2.9-2.75-3.06A4.17 4.17 0 0011.76 2.08c-.64 0-1.24.17-1.76.47-.52-.3-1.12-.47-1.76-.47a4.17 4.17 0 00-4.17 3.66A3.33 3.33 0 003 7.8c0 .86.36 1.64.93 2.2-.57.56-.93 1.34-.93 2.2 0 1.34.79 2.44 1.93 2.85A4.17 4.17 0 007.8 17.92c.81 0 1.57-.25 2.2-.67.63.42 1.39.67 2.2.67A4.17 4.17 0 0016 15.05z" />
      </svg>
    ),
  },
  {
    id: "projects", label: "Projects", href: "#", exact: false,
    icon: () => (
      <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">
        <path d="M2 6.5C2 5.67 2.67 5 3.5 5H8l1.5 2H16.5C17.33 7 18 7.67 18 8.5v6c0 .83-.67 1.5-1.5 1.5h-13C2.67 16 2 15.33 2 14.5V6.5z" />
      </svg>
    ),
  },
  {
    id: "skills", label: "Skills", href: "#", exact: false,
    icon: () => (
      <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round">
        <path d="M10 2C6.13 2 3 5.13 3 9c0 2.21.9 4.21 2.34 5.66L6 16h8l.66-1.34A8 8 0 0017 9c0-3.87-3.13-7-7-7z" />
        <path d="M7 16v1a1 1 0 001 1h4a1 1 0 001-1v-1" />
      </svg>
    ),
  },
  {
    id: "community", label: "Community", href: "#", exact: false,
    icon: () => (
      <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round">
        <circle cx="8" cy="8" r="3" /><circle cx="15" cy="6" r="2" /><path d="M2 18c0-3.31 2.69-6 6-6s6 2.69 6 6" /><path d="M15 12c1.66 0 3 1.34 3 3" />
      </svg>
    ),
  },
]

function NavItem(props: { item: (typeof NAV_ITEMS)[number]; expanded: boolean }) {
  const location = useLocation()
  const navigate = useNavigate()
  const isActive = createMemo(() =>
    props.item.exact ? location.pathname === props.item.href : location.pathname.startsWith(props.item.href) && props.item.href !== "#"
  )
  return (
    <button
      onClick={() => { if (props.item.href !== "#") navigate(props.item.href) }}
      style={{
        width: "100%", display: "flex", "align-items": "center", gap: "12px",
        padding: "10px 12px", "border-radius": "12px",
        background: isActive() ? "linear-gradient(135deg, rgba(124,58,237,0.55), rgba(109,40,217,0.35))" : "transparent",
        border: isActive() ? "1px solid rgba(192,132,252,0.25)" : "1px solid transparent",
        color: isActive() ? TEXT_1 : TEXT_2, cursor: "pointer", transition: "all 0.15s",
        "font-size": "13px", "font-weight": "500", "white-space": "nowrap",
      }}
      onMouseEnter={e => { if (!isActive()) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)" }}
      onMouseLeave={e => { if (!isActive()) (e.currentTarget as HTMLElement).style.background = "transparent" }}
    >
      <span style={{ "flex-shrink": 0, display: "flex", "align-items": "center", "justify-content": "center" }}>
        {props.item.icon()}
      </span>
      <Show when={props.expanded}>
        <span style={{ "line-height": "1" }}>{props.item.label}</span>
      </Show>
    </button>
  )
}

export const SidebarContent = (props: {
  mobile?: boolean
  opened: Accessor<boolean>
  onToggleOpened: () => void
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
  const expanded = createMemo(() => !!props.mobile || props.opened())
  const placement = () => (props.mobile ? "bottom" : "right") as "bottom" | "right"

  return (
    <div
      style={{
        width: "100%", height: "100%", display: "flex", "flex-direction": "column", overflow: "hidden",
        background: expanded() ? "rgba(30,30,35,0.7)" : "transparent",
        "backdrop-filter": expanded() ? "blur(20px)" : "none",
        "-webkit-backdrop-filter": expanded() ? "blur(20px)" : "none",
        "border-radius": expanded() ? "16px" : "0",
        "box-shadow": expanded() ? "0 8px 40px rgba(0,0,0,0.5)" : "none",
        border: expanded() ? `1px solid ${CARD_BDR}` : "none",
      }}
      onMouseMove={props.aimMove}
    >
      {/* Logo + toggle */}
      <div style={{ display: "flex", "align-items": "center", gap: "12px", padding: expanded() ? "16px 14px 12px" : "16px 0 12px", "flex-shrink": 0, "justify-content": expanded() ? "space-between" : "center" }}>
        <Show when={expanded()}>
          <div style={{ "font-size": "18px", "font-weight": "700", color: TEXT_1, "letter-spacing": "-0.3px", "line-height": "1" }}>mimo</div>
        </Show>
        <Tooltip placement={placement()} value={expanded() ? "Collapse" : "Expand"}>
          <button
            style={{ width: "32px", height: "32px", display: "flex", "align-items": "center", "justify-content": "center", "border-radius": "10px", background: "transparent", border: "none", cursor: "pointer", color: TEXT_2, "flex-shrink": 0, transition: "background 0.15s" }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
            onClick={props.onToggleOpened}
          >
            <svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
              <Show when={expanded()} fallback={<path d="M3 6h14M3 10h14M3 14h14" />}>
                <path d="M3 6h14M3 10h8M3 14h14" />
              </Show>
            </svg>
          </button>
        </Tooltip>
      </div>

      {/* Primary nav */}
      <div style={{ padding: expanded() ? "0 10px" : "0 10px", display: "flex", "flex-direction": "column", gap: "2px", "flex-shrink": 0 }}>
        <For each={NAV_ITEMS}>{(item) => <NavItem item={item} expanded={expanded()} />}</For>
      </div>

      {/* Project rail (collapsed only) */}
      <Show when={!expanded()}>
        <div style={{ flex: "1", "min-height": 0, overflow: "hidden" }}>
          <DragDropProvider
            onDragStart={props.handleDragStart}
            onDragEnd={props.handleDragEnd}
            onDragOver={props.handleDragOver}
            collisionDetector={closestCenter}
          >
            <DragDropSensors />
            <ConstrainDragXAxis />
            <div style={{ height: "100%", display: "flex", "flex-direction": "column", gap: "2px", "overflow-y": "auto", padding: "0 10px" }}>
              <SortableProvider ids={props.projects().map(p => p.worktree)}>
                <For each={props.projects()}>{(p) => props.renderProject(p)}</For>
              </SortableProvider>
              <Tooltip placement={placement()} value={
                <div style={{ display: "flex", "align-items": "center", gap: "6px" }}>
                  <span>{props.openProjectLabel}</span>
                  <Show when={!props.mobile && !!props.openProjectKeybind()}>
                    <span style={{ "font-size": "11px" }}>{props.openProjectKeybind()}</span>
                  </Show>
                </div>
              }>
                <IconButton icon="plus" variant="ghost" size="large" onClick={props.onOpenProject} aria-label={typeof props.openProjectLabel === "string" ? props.openProjectLabel : undefined} />
              </Tooltip>
            </div>
            <DragOverlay>{props.renderProjectOverlay()}</DragOverlay>
          </DragDropProvider>
        </div>
      </Show>

      {/* Panel content (sessions/workspace) — visible when expanded */}
      <Show when={expanded()}>
        <div style={{ flex: "1", "min-height": 0, overflow: "hidden", "margin-top": "6px", "border-top": `1px solid ${CARD_BDR}`, padding: "0 10px" }}>
          {props.renderPanel()}
        </div>
      </Show>

      {/* Bottom: Settings + Help */}
      <div style={{ "flex-shrink": 0, padding: expanded() ? "8px 10px 16px" : "8px 10px 20px", display: "flex", "flex-direction": "column", gap: "2px" }}>
        <Show when={expanded()}>
          <button
            onClick={props.onOpenSettings}
            style={{ width: "100%", display: "flex", "align-items": "center", gap: "12px", padding: "8px 12px", "border-radius": "12px", background: "transparent", border: "none", cursor: "pointer", color: TEXT_2, "font-size": "13px", "font-weight": "500", transition: "background 0.15s" }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
          >
            <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
              <path d="M10 13a3 3 0 100-6 3 3 0 000 6z" /><path d="M10 2v1.5M10 16.5V18M3.5 5.22l1.06 1.06M15.44 13.72l1.06 1.06M2 10h1.5M16.5 10H18M3.56 14.78l1.06-1.06M15.38 6.28l1.06-1.06" />
            </svg>
            <span>{props.settingsLabel()}</span>
          </button>
          <button
            onClick={props.onOpenHelp}
            style={{ width: "100%", display: "flex", "align-items": "center", gap: "12px", padding: "8px 12px", "border-radius": "12px", background: "transparent", border: "none", cursor: "pointer", color: TEXT_2, "font-size": "13px", "font-weight": "500", transition: "background 0.15s" }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
          >
            <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
              <circle cx="10" cy="10" r="8" /><path d="M8 8a2 2 0 013.4-1.4c.56.56.86 1.35.6 2.1C11.74 9.46 11 9.74 11 10.5" /><path d="M11 13a1 1 0 11-2 0" />
            </svg>
            <span>{props.helpLabel()}</span>
          </button>
        </Show>
        <Show when={!expanded()}>
          <TooltipKeybind placement={placement()} title={props.settingsLabel()} keybind={props.settingsKeybind() ?? ""}>
            <IconButton icon="settings-gear" variant="ghost" size="large" onClick={props.onOpenSettings} aria-label={props.settingsLabel()} />
          </TooltipKeybind>
          <Tooltip placement={placement()} value={props.helpLabel()}>
            <IconButton icon="help" variant="ghost" size="large" onClick={props.onOpenHelp} aria-label={props.helpLabel()} />
          </Tooltip>
        </Show>
      </div>
    </div>
  )
}
