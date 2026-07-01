import { cpSync, rmSync, existsSync } from "node:fs"
import { resolve } from "node:path"
import { resolveChannel } from "./utils"

const arg = process.argv[2]
const channel = arg === "dev" || arg === "beta" || arg === "prod" ? arg : resolveChannel()

const src = resolve(`./icons/${channel}`)
const dest = resolve("resources/icons")

if (existsSync(dest)) {
  rmSync(dest, { recursive: true, force: true })
}
cpSync(src, dest, { recursive: true })
console.log(`Copied ${channel} icons from ${src} to ${dest}`)
