#!/usr/bin/env bun

import { Script } from "@mimo-ai/script"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const dir = path.resolve(__dirname, "..")

process.chdir(dir)

await import("./generate.ts")

// Load migrations from migration directories
const migrationDirs = (
  await fs.promises.readdir(path.join(dir, "migration"), {
    withFileTypes: true,
  })
)
  .filter((entry) => entry.isDirectory() && /^\d{4}\d{2}\d{2}\d{2}\d{2}\d{2}/.test(entry.name))
  .map((entry) => entry.name)
  .sort()

const migrations = await Promise.all(
  migrationDirs.map(async (name) => {
    const file = path.join(dir, "migration", name, "migration.sql")
    const sql = await Bun.file(file).text()
    const match = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/.exec(name)
    const timestamp = match
      ? Date.UTC(
          Number(match[1]),
          Number(match[2]) - 1,
          Number(match[3]),
          Number(match[4]),
          Number(match[5]),
          Number(match[6]),
        )
      : 0
    return { sql, timestamp, name }
  }),
)
console.log(`Loaded ${migrations.length} migrations`)

// Write constants for electron-vite to consume as defines.
// We skip Bun.build() here because Bun's bundler on Windows can't follow
// Windows directory junction points (node_modules/.bun/ stubs). Instead,
// electron-vite's Rollup (Node.js) does the actual bundling — it handles
// junctions correctly.
await fs.promises.mkdir("./dist/node", { recursive: true })
await fs.promises.writeFile(
  "./dist/node/constants.json",
  JSON.stringify({ migrations, channel: Script.channel }),
)

// Write a pass-through entry that electron-vite's Rollup will bundle.
// Rollup runs on Node.js which follows junctions, resolving all npm packages.
await fs.promises.writeFile(
  "./dist/node/node.js",
  `export * from "../../src/node.ts"\n`,
)

console.log("Build complete")
