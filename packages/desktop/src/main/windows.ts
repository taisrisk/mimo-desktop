import windowState from "electron-window-state"
import { app, BrowserWindow, dialog, net, nativeImage, nativeTheme, protocol } from "electron"
import { dirname, isAbsolute, join, relative, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import type { TitlebarTheme } from "../preload/types"
import { createUnresponsiveSampler } from "./unresponsive"
import { write as writeLog } from "./logging"

const root = dirname(fileURLToPath(import.meta.url))
const rendererRoot = join(root, "../renderer")
const rendererProtocol = "oc"
const rendererHost = "renderer"

protocol.registerSchemesAsPrivileged([
  {
    scheme: rendererProtocol,
    privileges: {
      secure: true,
      standard: true,
      supportFetchAPI: true,
    },
  },
])

let backgroundColor: string | undefined
let relaunchHandler = () => {
  app.relaunch()
  app.exit(0)
}
const titlebarThemes = new WeakMap<BrowserWindow, Partial<TitlebarTheme>>()

export function setRelaunchHandler(handler: () => void) {
  relaunchHandler = handler
}

export function setBackgroundColor(color: string) {
  backgroundColor = color
  // Update all existing open windows immediately (#32046)
  for (const win of BrowserWindow.getAllWindows()) {
    win.setBackgroundColor(color)
  }
}

export function getBackgroundColor(): string | undefined {
  return backgroundColor
}

function iconsDir() {
  return app.isPackaged ? join(process.resourcesPath, "icons") : join(root, "../../resources/icons")
}

function iconPath() {
  const ext = process.platform === "win32" ? "ico" : "png"
  return join(iconsDir(), `icon.${ext}`)
}

function tone() {
  return nativeTheme.shouldUseDarkColors ? "dark" : "light"
}

function overlay(theme: Partial<TitlebarTheme> = {}) {
  const mode = theme.mode ?? tone()
  return {
    color: "#00000000",
    symbolColor: mode === "dark" ? "white" : "black",
    height: 40,
  }
}

export function setTitlebar(win: BrowserWindow, theme: Partial<TitlebarTheme> = {}) {
  if (process.platform !== "win32") return
  titlebarThemes.set(win, theme)
  win.setTitleBarOverlay(overlay(theme))
}

export function setDockIcon() {
  if (process.platform !== "darwin") return
  // Fallback chain: dock.png → icon.png → skip (#32020)
  for (const name of ["dock.png", "icon.png"]) {
    const icon = nativeImage.createFromPath(join(iconsDir(), name))
    if (!icon.isEmpty()) {
      app.dock?.setIcon(icon)
      return
    }
  }
}

export function createMainWindow() {
  const state = windowState({
    defaultWidth: 1280,
    defaultHeight: 800,
  })

  const mode = tone()
  const win = new BrowserWindow({
    x: state.x,
    y: state.y,
    width: state.width,
    height: state.height,
    show: false,
    title: "Mimo Desktop",
    icon: iconPath(),
    backgroundColor,
    autoHideMenuBar: true,
    ...(process.platform === "darwin"
      ? {
          titleBarStyle: "hidden" as const,
          trafficLightPosition: { x: 12, y: 14 },
        }
      : {}),
    ...(process.platform === "win32"
      ? {
          frame: false,
          titleBarStyle: "hidden" as const,
          titleBarOverlay: overlay({ mode }),
        }
      : {}),
    webPreferences: {
      preload: join(root, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // Disable OS spell checking — avoids high CPU on large text streams (#32155, #32158)
      spellcheck: false,
    },
  })

  win.webContents.session.webRequest.onBeforeSendHeaders((details, callback) => {
    const { requestHeaders } = details
    upsertKeyValue(requestHeaders, "Access-Control-Allow-Origin", ["*"])
    callback({ requestHeaders })
  })

  win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    const { responseHeaders = {} } = details
    upsertKeyValue(responseHeaders, "Access-Control-Allow-Origin", ["*"])
    upsertKeyValue(responseHeaders, "Access-Control-Allow-Headers", ["*"])
    callback({ responseHeaders })
  })

  wireWindowRecovery(win, "main")

  state.manage(win)
  loadWindow(win, "index.html")
  wireZoom(win)

  win.once("ready-to-show", () => {
    win.show()
  })

  return win
}

export function createLoadingWindow() {
  const mode = tone()
  const win = new BrowserWindow({
    width: 640,
    height: 480,
    resizable: false,
    center: true,
    show: true,
    icon: iconPath(),
    backgroundColor,
    autoHideMenuBar: true,
    ...(process.platform === "darwin" ? { titleBarStyle: "hidden" as const } : {}),
    ...(process.platform === "win32"
      ? {
          frame: false,
          titleBarStyle: "hidden" as const,
          titleBarOverlay: overlay({ mode }),
        }
      : {}),
    webPreferences: {
      preload: join(root, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  })

  loadWindow(win, "loading.html")

  return win
}

export function registerRendererProtocol() {
  if (protocol.isProtocolHandled(rendererProtocol)) return

  protocol.handle(rendererProtocol, async (request) => {
    const url = new URL(request.url)
    if (url.host !== rendererHost) {
      return new Response("Not found", { status: 404 })
    }

    const file = resolve(rendererRoot, `.${decodeURIComponent(url.pathname)}`)
    const rel = relative(rendererRoot, file)
    if (rel.startsWith("..") || isAbsolute(rel)) {
      return new Response("Not found", { status: 404 })
    }

    try {
      return await net.fetch(pathToFileURL(file).toString())
    } catch (error) {
      writeLog("protocol", "fetch error", { url: request.url, file, error }, "error")
      return new Response("Not found", { status: 404 })
    }
  })
}

function wireWindowRecovery(win: BrowserWindow, name: string) {
  let showing = false
  const sampler = createUnresponsiveSampler(win, name)

  const show = async (message: string, detail: string, wait: boolean) => {
    if (showing || win.isDestroyed()) return
    showing = true
    try {
      const result = await dialog.showMessageBox(win, {
        type: "warning",
        title: "Mimo Desktop — Window Unresponsive",
        message,
        detail,
        buttons: ["Export Logs", "Relaunch", "Quit", "Wait"],
        defaultId: 1,
        cancelId: 3,
      })
      const button = ["Export Logs", "Relaunch", "Quit", "Wait"][result.response]
      if (button === "Relaunch") {
        sampler.stopAndFlush()
        relaunchHandler()
      } else if (button === "Quit") {
        sampler.stopAndFlush()
        app.quit()
      } else if (wait) {
        sampler.start()
      }
    } finally {
      showing = false
    }
  }

  win.on("unresponsive", () => {
    sampler.start()
    void show(
      "Mimo Desktop is not responding",
      "The renderer process stopped responding. You can wait, relaunch, or quit.",
      true,
    )
  })

  win.on("responsive", () => {
    sampler.stopAndFlush()
  })
}

function loadWindow(win: BrowserWindow, html: string) {
  const devUrl = process.env.ELECTRON_RENDERER_URL
  if (devUrl) {
    const url = new URL(html, devUrl)
    void win.loadURL(url.toString())
    return
  }

  void win.loadURL(`${rendererProtocol}://${rendererHost}/${html}`)
}

function wireZoom(win: BrowserWindow) {
  win.webContents.setZoomFactor(1)
  win.webContents.on("zoom-changed", () => {
    win.webContents.setZoomFactor(1)
  })
}

function upsertKeyValue(obj: Record<string, any>, keyToChange: string, value: any) {
  const keyToChangeLower = keyToChange.toLowerCase()
  for (const key of Object.keys(obj)) {
    if (key.toLowerCase() === keyToChangeLower) {
      obj[key] = value
      return
    }
  }
  obj[keyToChange] = value
}
