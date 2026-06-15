import { defineConfig } from "electron-vite"
import appPlugin from "@mimo-ai/app/vite"
import * as fs from "node:fs/promises"
import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const channel = (() => {
  const raw = process.env.MIMO_CHANNEL
  if (raw === "dev" || raw === "beta" || raw === "prod") return raw
  return "dev"
})()

// Read the constants written by build-node.ts so we can pass them as defines.
// These are needed because OPENCODE_MIGRATIONS and OPENCODE_CHANNEL are declared
// as global constants in the opencode source and must be replaced at bundle time.
const MIMO_SERVER_DIST = path.resolve(__dirname, "../opencode/dist/node")
let opencodeConstants: { migrations: unknown[]; channel: string } = {
  migrations: [],
  channel: "local",
}
try {
  opencodeConstants = JSON.parse(
    readFileSync(path.join(MIMO_SERVER_DIST, "constants.json"), "utf-8"),
  )
} catch {
  // constants.json not present yet (first-time build); defaults used
}

const nodePtyPkg = `@lydell/node-pty-${process.platform}-${process.arch}`

export default defineConfig({
  main: {
    define: {
      "import.meta.env.MIMO_CHANNEL": JSON.stringify(channel),
      // Opencode global constants — replaced at bundle time
      OPENCODE_MIGRATIONS: JSON.stringify(opencodeConstants.migrations),
      OPENCODE_CHANNEL: JSON.stringify(opencodeConstants.channel),
    },
    resolve: {
      alias: {
        "@/": path.resolve(__dirname, "../opencode/src/") + "/",
        "@tui/": path.resolve(__dirname, "../opencode/src/cli/cmd/tui/") + "/",
      },
    },
    build: {
      rollupOptions: {
        input: { index: "src/main/index.ts" },
      },
      externalizeDeps: { include: [nodePtyPkg] },
    },
    plugins: [
      {
        name: "mimo:node-pty-narrower",
        enforce: "pre",
        resolveId(s) {
          if (s === "@lydell/node-pty") return nodePtyPkg
        },
      },
      {
        name: "mimo:virtual-server-module",
        enforce: "pre",
        resolveId(id) {
          if (id === "virtual:mimo-server") return this.resolve(`${MIMO_SERVER_DIST}/node.js`)
        },
      },
      {
        // Provide an empty module for the embedded web UI (Electron uses the proxy fallback).
        name: "mimo:virtual-web-ui",
        enforce: "pre",
        resolveId(id) {
          if (id === "opencode-web-ui.gen.ts") return "\0opencode-web-ui-virtual"
        },
        load(id) {
          if (id === "\0opencode-web-ui-virtual") return "export default {}"
        },
      },
      {
        // WASM imports use Bun's `with: { type: "wasm" }` attribute which Vite can't load.
        // For the Electron main process (Node.js), return a file:// URL so resolveWasm() in bash.ts
        // can convert it to an absolute path at runtime.
        name: "mimo:wasm-to-url",
        enforce: "pre",
        load(id) {
          if (!id.endsWith(".wasm")) return null
          return `export default ${JSON.stringify(pathToFileURL(id).href)}`
        },
      },
      {
        // Text imports use Bun's `with: { type: "text" }` attribute (e.g. workflow script files).
        // Rollup doesn't understand this attribute; intercept and return the file content as a string.
        name: "mimo:text-import",
        enforce: "pre",
        resolveId(id, importer, options) {
          if ((options as { attributes?: Record<string, string> })?.attributes?.type === "text") {
            const base = importer ? path.dirname(importer.replace(/\0.*$/, "")) : process.cwd()
            const abs = path.resolve(base, id)
            return `\0text:${abs}`
          }
          return null
        },
        async load(id) {
          if (!id.startsWith("\0text:")) return null
          const filePath = id.slice("\0text:".length)
          const content = await fs.readFile(filePath, "utf-8")
          return `export default ${JSON.stringify(content)}`
        },
      },
      {
        name: "mimo:copy-server-assets",
        async writeBundle() {
          for (const l of await fs.readdir(MIMO_SERVER_DIST)) {
            if (!l.endsWith(".wasm")) continue
            await fs.writeFile(`./out/main/chunks/${l}`, await fs.readFile(`${MIMO_SERVER_DIST}/${l}`))
          }
        },
      },
    ],
  },
  preload: {
    build: {
      rollupOptions: {
        input: { index: "src/preload/index.ts" },
        output: {
          format: "cjs",
          entryFileNames: "[name].js",
        },
      },
    },
  },
  renderer: {
    plugins: [appPlugin],
    publicDir: "../../../app/public",
    root: "src/renderer",
    define: {
      "import.meta.env.VITE_MIMO_CHANNEL": JSON.stringify(channel),
    },
    build: {
      rollupOptions: {
        input: {
          main: "src/renderer/index.html",
          loading: "src/renderer/loading.html",
        },
      },
    },
  },
})
