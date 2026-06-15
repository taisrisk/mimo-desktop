import { createSignal, For, Show } from "solid-js"

export type PersonalizationConfig = {
  theme: string
  accentColor: string
  sidebarStyle: "compact" | "expanded" | "rail"
  fontSize: "small" | "medium" | "large"
  codeFont: "mono" | "sans" | "serif"
  showWelcome: boolean
  autoSaveMemory: boolean
  contextSuggestions: boolean
  dreamNotifications: boolean
}

const ACCENT_COLORS = [
  { id: "amber", label: "Amber", color: "#f59e0b" },
  { id: "blue", label: "Blue", color: "#3b82f6" },
  { id: "emerald", label: "Emerald", color: "#10b981" },
  { id: "purple", label: "Purple", color: "#8b5cf6" },
  { id: "rose", label: "Rose", color: "#f43f5e" },
  { id: "cyan", label: "Cyan", color: "#06b6d4" },
]

function SettingRow(props: { label: string; description?: string; children: any }) {
  return (
    <div class="flex items-center justify-between py-2.5 px-1">
      <div class="flex flex-col gap-0">
        <span class="text-12-regular text-text-base">{props.label}</span>
        <Show when={props.description}>
          <span class="text-10-regular text-text-weaker">{props.description}</span>
        </Show>
      </div>
      <div class="shrink-0">{props.children}</div>
    </div>
  )
}

function Toggle(props: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      class="relative w-8 h-4.5 rounded-full transition-colors"
      style={{
        background: props.checked ? "var(--color-accent)" : "var(--color-border-weak-base)",
        height: "18px",
      }}
      onClick={() => props.onChange(!props.checked)}
    >
      <div
        class="absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-white transition-transform shadow-sm"
        style={{
          width: "14px",
          height: "14px",
          transform: props.checked ? "translateX(14px)" : "translateX(0)",
        }}
      />
    </button>
  )
}

function SegmentedControl<T extends string>(props: {
  options: Array<{ id: T; label: string }>
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div class="flex gap-0.5 p-0.5 rounded-lg bg-background-base border border-border-weak-base">
      <For each={props.options}>
        {(opt) => (
          <button
            class="px-2.5 py-1 rounded-md text-10-regular transition-all"
            classList={{
              "bg-background-surface-base text-text-base shadow-sm": props.value === opt.id,
              "text-text-weaker hover:text-text-base": props.value !== opt.id,
            }}
            onClick={() => props.onChange(opt.id)}
          >
            {opt.label}
          </button>
        )}
      </For>
    </div>
  )
}

export function Personalization(props?: { config?: PersonalizationConfig; onChange?: (cfg: PersonalizationConfig) => void }) {
  const [config, setConfig] = createSignal<PersonalizationConfig>(props?.config ?? {
    theme: "mimo",
    accentColor: "amber",
    sidebarStyle: "expanded",
    fontSize: "medium",
    codeFont: "mono",
    showWelcome: true,
    autoSaveMemory: true,
    contextSuggestions: true,
    dreamNotifications: false,
  })

  function update<K extends keyof PersonalizationConfig>(key: K, value: PersonalizationConfig[K]) {
    const next = { ...config(), [key]: value }
    setConfig(next)
    props?.onChange?.(next)
  }

  return (
    <div class="flex flex-col h-full overflow-y-auto p-3">
      {/* Appearance */}
      <div class="mb-4">
        <div class="text-10-medium text-text-weaker uppercase tracking-widest mb-2 px-1">Appearance</div>
        <div class="rounded-xl border border-border-weak-base bg-background-surface-base px-3 divide-y divide-border-weak-base">
          <SettingRow label="Accent Color">
            <div class="flex gap-1.5">
              <For each={ACCENT_COLORS}>
                {(c) => (
                  <button
                    class="size-5 rounded-full border-2 transition-all"
                    style={{
                      background: c.color,
                      "border-color": config().accentColor === c.id ? "white" : "transparent",
                      "box-shadow": config().accentColor === c.id ? `0 0 0 2px ${c.color}` : "none",
                    }}
                    title={c.label}
                    onClick={() => update("accentColor", c.id)}
                  />
                )}
              </For>
            </div>
          </SettingRow>

          <SettingRow label="Sidebar Style">
            <SegmentedControl
              options={[
                { id: "compact" as const, label: "Compact" },
                { id: "expanded" as const, label: "Full" },
                { id: "rail" as const, label: "Rail" },
              ]}
              value={config().sidebarStyle}
              onChange={(v) => update("sidebarStyle", v)}
            />
          </SettingRow>

          <SettingRow label="Font Size">
            <SegmentedControl
              options={[
                { id: "small" as const, label: "S" },
                { id: "medium" as const, label: "M" },
                { id: "large" as const, label: "L" },
              ]}
              value={config().fontSize}
              onChange={(v) => update("fontSize", v)}
            />
          </SettingRow>

          <SettingRow label="Code Font">
            <SegmentedControl
              options={[
                { id: "mono" as const, label: "Mono" },
                { id: "sans" as const, label: "Sans" },
                { id: "serif" as const, label: "Serif" },
              ]}
              value={config().codeFont}
              onChange={(v) => update("codeFont", v)}
            />
          </SettingRow>
        </div>
      </div>

      {/* Intelligence */}
      <div class="mb-4">
        <div class="text-10-medium text-text-weaker uppercase tracking-widest mb-2 px-1">Intelligence</div>
        <div class="rounded-xl border border-border-weak-base bg-background-surface-base px-3 divide-y divide-border-weak-base">
          <SettingRow label="Auto-Save Memory" description="Remember preferences and patterns automatically">
            <Toggle checked={config().autoSaveMemory} onChange={(v) => update("autoSaveMemory", v)} />
          </SettingRow>

          <SettingRow label="Context Suggestions" description="Auto-suggest relevant context from memory">
            <Toggle checked={config().contextSuggestions} onChange={(v) => update("contextSuggestions", v)} />
          </SettingRow>

          <SettingRow label="Dream Notifications" description="Get notified when dream/distill cycles complete">
            <Toggle checked={config().dreamNotifications} onChange={(v) => update("dreamNotifications", v)} />
          </SettingRow>
        </div>
      </div>

      {/* General */}
      <div class="mb-4">
        <div class="text-10-medium text-text-weaker uppercase tracking-widest mb-2 px-1">General</div>
        <div class="rounded-xl border border-border-weak-base bg-background-surface-base px-3 divide-y divide-border-weak-base">
          <SettingRow label="Show Welcome Screen" description="Display the dashboard on startup">
            <Toggle checked={config().showWelcome} onChange={(v) => update("showWelcome", v)} />
          </SettingRow>
        </div>
      </div>

      {/* Keyboard shortcuts */}
      <div class="mb-4">
        <div class="text-10-medium text-text-weaker uppercase tracking-widest mb-2 px-1">Keyboard Shortcuts</div>
        <div class="rounded-xl border border-border-weak-base bg-background-surface-base px-3 divide-y divide-border-weak-base">
          <For each={[
            { keys: "Cmd+Shift+M", action: "Toggle Mimo Hub" },
            { keys: "Cmd+B", action: "Toggle Sidebar" },
            { keys: "Cmd+O", action: "Open Project" },
            { keys: "Cmd+,", action: "Open Settings" },
            { keys: "Cmd+Shift+T", action: "Cycle Theme" },
            { keys: "Cmd+Shift+S", action: "Cycle Color Scheme" },
          ]}>
            {(shortcut) => (
              <div class="flex items-center justify-between py-2 px-1">
                <span class="text-11-regular text-text-base">{shortcut.action}</span>
                <div class="flex gap-0.5">
                  <For each={shortcut.keys.split("+")}>
                    {(key) => (
                      <kbd class="text-9-regular px-1.5 py-0.5 rounded bg-background-base border border-border-weak-base text-text-weaker font-mono">
                        {key}
                      </kbd>
                    )}
                  </For>
                </div>
              </div>
            )}
          </For>
        </div>
      </div>
    </div>
  )
}
