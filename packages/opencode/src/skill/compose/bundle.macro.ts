import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

// import.meta.dir is Bun-only. When this file is bundled by Bun as a macro,
// the call site is replaced at build time so this line never actually runs.
// When bundled by a non-Bun bundler (Vite/Rollup for the Electron build), the
// macro attribute is ignored, this file runs as a normal module at runtime,
// and import.meta.dir is undefined — so derive the same directory from
// import.meta.url instead, which both Bun and Node support.
const moduleDir = typeof import.meta.dir === "string" ? import.meta.dir : path.dirname(fileURLToPath(import.meta.url))

function walkDir(base: string, rel: string, out: Record<string, string>) {
  const fullPath = rel ? path.join(base, rel) : base
  for (const entry of fs.readdirSync(fullPath, { withFileTypes: true })) {
    const relPath = rel ? `${rel}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      walkDir(base, relPath, out)
    } else {
      out[relPath] = fs.readFileSync(path.join(fullPath, entry.name), "utf8")
    }
  }
}

export function loadComposeBundle(): Record<string, Record<string, string>> {
  const dir = path.resolve(moduleDir, ".bundle")
  const result: Record<string, Record<string, string>> = {}

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const files: Record<string, string> = {}
    walkDir(path.join(dir, entry.name), "", files)
    if (Object.keys(files).length > 0) {
      result[entry.name] = files
    }
  }

  return result
}
