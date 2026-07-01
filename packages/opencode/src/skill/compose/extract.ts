import path from "path"
import { pathToFileURL } from "url"
import { Effect } from "effect"
import matter from "gray-matter"
import { AppFileSystem } from "@mimo-ai/shared/filesystem"
import { Path as GlobalPath } from "@/global"
import { InstallationLocal, InstallationVersion } from "@/installation/version"
import { Log } from "@/util"
import { loadComposeBundle } from "./bundle.macro" with { type: "macro" }
import { loadComposeBundle as loadComposeBundleDev } from "./bundle.macro"
import { fallbackSanitization } from "@/config/markdown"

/// Bun macros only resolve in the static import graph of an entry point built
/// by Bun's own bundler. Anywhere else — dynamic import() chains, or a bundler
/// that isn't Bun at all (e.g. Vite/Rollup for the Electron build) — the macro
/// never expands, so calling it runs the real function body at runtime, where
/// Bun-only APIs like `import.meta.dir` are undefined. That surfaces as
/// different error types depending on how it fails (ReferenceError, or a
/// TypeError from passing undefined into path.resolve), so fall back on any
/// failure rather than matching a specific error class.
function safeLoadComposeBundle() {
  try {
    return loadComposeBundle()
  } catch {
    return loadComposeBundleDev()
  }
}
const COMPOSE_BUNDLE = safeLoadComposeBundle()

const log = Log.create({ service: "skill.compose" })

export const extractComposeBundle = Effect.fn("Skill.extractComposeBundle")(function* (
  fsys: AppFileSystem.Interface,
) {
  const root = path.join(GlobalPath.data, "compose", InstallationVersion)
  const marker = path.join(root, ".extracted")

  if (!InstallationLocal && (yield* fsys.existsSafe(marker))) return root

  for (const [skillName, files] of Object.entries(COMPOSE_BUNDLE)) {
    const skillDir = path.join(root, "skills", skillName)
    for (const [relPath, content] of Object.entries(files)) {
      yield* fsys.writeWithDirs(path.join(skillDir, relPath), content)
    }
  }
  yield* fsys.writeWithDirs(marker, InstallationVersion)
  log.info("extracted compose skills", { root })
  return root
})

function parseSkillMeta(content: string) {
  try {
    return matter(content)
  } catch {
    try {
      return matter(fallbackSanitization(content))
    } catch {
      return undefined
    }
  }
}

export function composeSkillsBlock(): string {
  const root = path.join(GlobalPath.data, "compose", InstallationVersion)
  const entries: string[] = []

  for (const [skillName, files] of Object.entries(COMPOSE_BUNDLE)) {
    const skillMd = files["SKILL.md"]
    if (!skillMd) continue
    const parsed = parseSkillMeta(skillMd)
    if (!parsed?.data?.name || !parsed?.data?.description) continue

    const location = pathToFileURL(path.join(root, "skills", skillName, "SKILL.md")).href
    entries.push(
      `  <skill>`,
      `    <name>${parsed.data.name}</name>`,
      `    <description>${parsed.data.description}</description>`,
      `    <location>${location}</location>`,
      `  </skill>`,
    )
  }

  if (entries.length === 0) return ""
  return ["<compose_skills>", ...entries, "</compose_skills>"].join("\n")
}
