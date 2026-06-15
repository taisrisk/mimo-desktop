import { MetaProvider } from "@solidjs/meta"
import { render } from "solid-js/web"
import "@mimo-ai/app/index.css"
import { Font } from "@mimo-ai/ui/font"
import { Progress } from "@mimo-ai/ui/progress"
import "./styles.css"
import { createEffect, createMemo, createSignal, onCleanup, onMount, Show } from "solid-js"
import type { InitStep, SqliteMigrationProgress } from "../preload/types"

const root = document.getElementById("root")!
const lines = ["Just a moment...", "Migrating your database", "This may take a couple of minutes"]
const delays = [3000, 9000]

render(() => {
  const [step, setStep] = createSignal<InitStep | null>(null)
  const [line, setLine] = createSignal(0)
  const [percent, setPercent] = createSignal(0)
  const [phase, setPhase] = createSignal<"m" | "shine" | "reveal" | "final-shine" | "fade-out" | "done">("m")

  const initPhase = createMemo(() => step()?.phase)

  const value = createMemo(() => {
    if (initPhase() === "done") return 100
    return Math.max(25, Math.min(100, percent()))
  })

  window.api.awaitInitialization((next) => setStep(next as InitStep)).catch(() => undefined)

  onMount(() => {
    setLine(0)
    setPercent(0)

    // M appears (via CSS animation on mount)
    // 700ms → shine glides across M
    // 1600ms → IMO letters fade in (revealing MIMO)
    // 3000ms → final shine across full MIMO
    // 4000ms → fade-out overlay
    // 4800ms → done (signal main window)
    const t1 = setTimeout(() => setPhase("shine"), 700)
    const t2 = setTimeout(() => setPhase("reveal"), 1600)
    const t3 = setTimeout(() => setPhase("final-shine"), 3000)
    const t4 = setTimeout(() => setPhase("fade-out"), 4000)
    const t5 = setTimeout(() => setPhase("done"), 4800)

    const timers = delays.map((ms, i) => setTimeout(() => setLine(i + 1), ms))

    const listener = window.api.onSqliteMigrationProgress((progress: SqliteMigrationProgress) => {
      if (progress.type === "InProgress") setPercent(Math.max(0, Math.min(100, progress.value)))
      if (progress.type === "Done") {
        setPercent(100)
        setStep({ phase: "done" })
      }
    })

    onCleanup(() => {
      listener()
      timers.forEach(clearTimeout)
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
      clearTimeout(t4)
      clearTimeout(t5)
    })
  })

  createEffect(() => {
    if (initPhase() !== "done") return
    if (phase() !== "done") return
    const timer = setTimeout(() => window.api.loadingWindowComplete(), 400)
    onCleanup(() => clearTimeout(timer))
  })

  const status = createMemo(() => {
    if (initPhase() === "done") return "All done"
    if (initPhase() === "sqlite_waiting") return lines[line()]
    return "Just a moment..."
  })

  return (
    <MetaProvider>
      <div
        class="w-screen h-screen bg-background-base flex items-center justify-center"
        style={{
          opacity: phase() === "fade-out" || phase() === "done" ? "0" : "1",
          transition: phase() === "fade-out" || phase() === "done" ? "opacity 0.8s ease-out" : "none",
        }}
      >
        <Font />
        <style>{`
          @keyframes mimo-m-appear {
            0% { opacity: 0; transform: scale(0.82) translateY(4px); }
            100% { opacity: 1; transform: scale(1) translateY(0); }
          }
          @keyframes mimo-letter-in {
            0% { opacity: 0; transform: translateX(-6px); }
            100% { opacity: 1; transform: translateX(0); }
          }
          @keyframes mimo-shine {
            0% { transform: translateX(-180%); }
            100% { transform: translateX(600%); }
          }
          @keyframes mimo-final-shine {
            0% { transform: translateX(-180%); opacity: 0.9; }
            70% { opacity: 0.9; }
            100% { transform: translateX(600%); opacity: 0; }
          }
          .mimo-m {
            opacity: 0;
            animation: mimo-m-appear 0.55s cubic-bezier(0.16, 1, 0.3, 1) 0.1s forwards;
          }
          .mimo-i { opacity: 0; animation: mimo-letter-in 0.38s cubic-bezier(0.16, 1, 0.3, 1) 0s forwards; }
          .mimo-m2 { opacity: 0; animation: mimo-letter-in 0.38s cubic-bezier(0.16, 1, 0.3, 1) 0.08s forwards; }
          .mimo-o { opacity: 0; animation: mimo-letter-in 0.38s cubic-bezier(0.16, 1, 0.3, 1) 0.16s forwards; }
          .shine-bar {
            position: absolute; inset: 0;
            background: linear-gradient(90deg,
              transparent 0%,
              rgba(255,255,255,0.08) 30%,
              rgba(255,255,255,0.55) 50%,
              rgba(255,255,255,0.08) 70%,
              transparent 100%);
            animation: mimo-shine 0.85s cubic-bezier(0.4, 0, 0.2, 1) forwards;
            pointer-events: none;
            border-radius: 4px;
            overflow: hidden;
          }
          .final-shine-bar {
            position: absolute; inset: 0;
            background: linear-gradient(90deg,
              transparent 0%,
              rgba(255,255,255,0.1) 30%,
              rgba(255,255,255,0.65) 50%,
              rgba(255,255,255,0.1) 70%,
              transparent 100%);
            animation: mimo-final-shine 1.1s cubic-bezier(0.4, 0, 0.2, 1) forwards;
            pointer-events: none;
            border-radius: 4px;
            overflow: hidden;
          }
        `}</style>

        <div class="flex flex-col items-center gap-10">
          {/* MIMO wordmark — M first, then IMO reveals */}
          <div class="relative" style={{ "user-select": "none" }}>
            <div
              class="flex items-end"
              style={{
                "font-size": "5rem",
                "font-weight": "800",
                "letter-spacing": "-0.02em",
                "line-height": "1",
                color: "var(--color-text-strong, #1a1a1a)",
              }}
            >
              <span class="mimo-m">M</span>
              <Show when={phase() === "reveal" || phase() === "final-shine" || phase() === "fade-out" || phase() === "done"}>
                <span class="mimo-i">I</span>
                <span class="mimo-m2">M</span>
                <span class="mimo-o">O</span>
              </Show>
            </div>

            {/* Shine on M only */}
            <Show when={phase() === "shine"}>
              <div class="shine-bar" />
            </Show>

            {/* Final shine across full MIMO */}
            <Show when={phase() === "final-shine"}>
              <div class="final-shine-bar" />
            </Show>
          </div>

          <div class="w-64 flex flex-col items-center gap-3" aria-live="polite">
            <span class="w-full text-center text-ellipsis whitespace-nowrap text-text-weaker text-12-normal">
              {status()}
            </span>
            <Progress
              value={value()}
              class="w-24 [&_[data-slot='progress-track']]:h-0.5 [&_[data-slot='progress-track']]:border-0 [&_[data-slot='progress-track']]:rounded-none [&_[data-slot='progress-track']]:bg-border-weak-base [&_[data-slot='progress-fill']]:rounded-none [&_[data-slot='progress-fill']]:bg-text-weaker"
              aria-label="Loading progress"
              getValueLabel={({ value }) => `${Math.round(value)}%`}
            />
          </div>
        </div>
      </div>
    </MetaProvider>
  )
}, root)
