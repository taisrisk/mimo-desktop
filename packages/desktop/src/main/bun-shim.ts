import * as fs from "node:fs"
import * as fsPromises from "node:fs/promises"
import * as path from "node:path"
import * as crypto from "node:crypto"

if (typeof globalThis.Bun === "undefined") {
  const fileCache = new Map<string, { text: () => Promise<string>; exists: () => Promise<boolean>; arrayBuffer: () => Promise<ArrayBuffer> }>()

  function bunFile(filePath: string) {
    const cached = fileCache.get(filePath)
    if (cached) return cached

    const entry = {
      text: () => fsPromises.readFile(filePath, "utf-8").catch(() => ""),
      exists: () => fsPromises.access(filePath).then(() => true, () => false),
      arrayBuffer: () => fsPromises.readFile(filePath).then((buf) => buf.buffer),
      size: () => fsPromises.stat(filePath).then((s) => s.size, () => 0),
    }
    fileCache.set(filePath, entry)
    return entry
  }

  async function bunWrite(input: string | { path?: string } | URL, data: string | ArrayBuffer | Uint8Array | Response): Promise<number> {
    let filePath: string
    if (typeof input === "string") {
      filePath = input
    } else if (input instanceof URL) {
      filePath = input.pathname
    } else if (typeof input === "object" && "path" in input) {
      filePath = input.path ?? ""
    } else {
      return 0
    }

    const content = typeof data === "string" ? data : Buffer.from(data instanceof ArrayBuffer ? data : data as Uint8Array)
    await fsPromises.writeFile(filePath, content)
    return typeof content === "string" ? Buffer.byteLength(content) : content.length
  }

  globalThis.Bun = {
    file: bunFile,
    write: bunWrite,
    sleep: (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
    sleepSync: (ms: number) => {
      const start = Date.now()
      while (Date.now() - start < ms) {}
    },
    hash: (algorithm: string, data: string | ArrayBuffer | Uint8Array) => {
      const hash = crypto.createHash(algorithm.replace("-", ""))
      if (typeof data === "string") hash.update(data)
      else hash.update(Buffer.from(data instanceof ArrayBuffer ? data : data as Uint8Array))
      return hash.digest("hex")
    },
    password: {
      hash: async (password: string, options?: { algorithm?: string; memoryCost?: number; timeCost?: number }) => {
        const salt = crypto.randomBytes(16)
        const derived = crypto.pbkdf2Sync(password, salt, options?.timeCost ?? 100000, 32, "sha256")
        return `$pbkdf2$${salt.toString("hex")}$${derived.toString("hex")}`
      },
      verify: async (hash: string, password: string) => {
        const parts = hash.split("$")
        if (parts.length < 3) return false
        const salt = Buffer.from(parts[2], "hex")
        const derived = crypto.pbkdf2Sync(password, salt, 100000, 32, "sha256")
        return derived.toString("hex") === parts[3]
      },
    },
    env: { ...process.env },
    stdin: {
      text: async () => {
        const chunks: Buffer[] = []
        for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk))
        return Buffer.concat(chunks).toString("utf-8")
      },
    },
    spawn: (args: { cmd: string[]; cwd?: string; env?: Record<string, string> }) => {
      const { spawnSync } = require("child_process") as typeof import("child_process")
      const result = spawnSync(args.cmd[0], args.cmd.slice(1), {
        cwd: args.cwd,
        env: { ...process.env, ...args.env },
        stdio: ["pipe", "pipe", "pipe"],
      })
      return {
        stdout: new ReadableStream({
          start(controller) {
            if (result.stdout) controller.enqueue(new Uint8Array(result.stdout))
            controller.close()
          },
        }),
        stderr: new ReadableStream({
          start(controller) {
            if (result.stderr) controller.enqueue(new Uint8Array(result.stderr))
            controller.close()
          },
        }),
        exitCode: result.status ?? 1,
      }
    },
    which: async (cmd: string) => {
      const { execSync } = require("child_process") as typeof import("child_process")
      try {
        const result = process.platform === "win32"
          ? execSync(`where ${cmd}`, { encoding: "utf-8" }).trim().split("\n")[0]
          : execSync(`which ${cmd}`, { encoding: "utf-8" }).trim()
        return result || null
      } catch {
        return null
      }
    },
    serve: () => {
      throw new Error("Bun.serve is not supported in Electron. Use the Node.js http server instead.")
    },
  } as any

  console.log("[bun-shim] Bun polyfill installed for Electron")
}
