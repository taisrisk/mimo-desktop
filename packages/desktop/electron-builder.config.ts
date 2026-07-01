import { execFile } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

import type { Configuration } from "electron-builder"

const execFileAsync = promisify(execFile)
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const signScript = path.join(rootDir, "script", "sign-windows.ps1")

async function signWindows(configuration: { path: string }) {
  if (process.platform !== "win32") return
  if (process.env.GITHUB_ACTIONS !== "true") return

  await execFileAsync(
    "pwsh",
    ["-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", signScript, configuration.path],
    { cwd: rootDir },
  )
}

const channel = (() => {
  const raw = process.env.MIMO_CHANNEL
  if (raw === "dev" || raw === "beta" || raw === "prod") return raw
  return "dev"
})()

const hasCert = !!process.env.CSC_LINK

const getBase = (): Configuration => ({
  artifactName: "mimo-desktop-${os}-${arch}.${ext}",
  executableName: "mimo-desktop",
  directories: {
    output: "dist",
    buildResources: "resources",
  },
  files: ["out/**/*", "resources/**/*"],
  extraResources: [
    {
      from: "native/",
      to: "native/",
      filter: ["index.js", "index.d.ts", "build/Release/mac_window.node", "swift-build/**"],
    },
  ],
  mac: {
    category: "public.app-category.developer-tools",
    icon: `resources/icons/icon.icns`,
    hardenedRuntime: hasCert,
    gatekeeperAssess: false,
    entitlements: hasCert ? "resources/entitlements.plist" : undefined,
    entitlementsInherit: hasCert ? "resources/entitlements.plist" : undefined,
    notarize: process.env.APPLE_ID ? true : false,
    identity: hasCert ? undefined : null,
    target: ["dmg", "zip"],
  },
  dmg: {
    sign: hasCert,
  },
  protocols: {
    name: "Mimo Desktop",
    schemes: ["mimodesktop"],
  },
  win: {
    icon: `resources/icons/icon.ico`,
    signAndEditExecutable: false,
    target: ["nsis", "zip"],
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    installerIcon: `resources/icons/icon.ico`,
    installerHeaderIcon: `resources/icons/icon.ico`,
    uninstallerIcon: `resources/icons/icon.ico`,
    createStartMenuShortcut: true,
    createDesktopShortcut: true,
    runAfterFinish: true,
    deleteAppDataOnUninstall: false,
  },
  linux: {
    executableName: "mimo-desktop",
    icon: `resources/icons`,
    category: "Development",
    target: ["AppImage", "deb", "rpm"],
  },
})

function getConfig() {
  const base = getBase()

  switch (channel) {
    case "dev": {
      return {
        ...base,
        appId: "ai.mimo.desktop.dev",
        productName: "Mimo Desktop Dev",
        rpm: { packageName: "mimo-desktop-dev" },
      }
    }
    case "beta": {
      return {
        ...base,
        appId: "ai.mimo.desktop.beta",
        productName: "Mimo Desktop Beta",
        protocols: { name: "Mimo Desktop Beta", schemes: ["mimodesktop"] },
        publish: { provider: "github", owner: "taisrisk", repo: "mimo-desktop", channel: "latest" },
        rpm: { packageName: "mimo-desktop-beta" },
      }
    }
    case "prod": {
      return {
        ...base,
        appId: "ai.mimo.desktop",
        productName: "Mimo Desktop",
        protocols: { name: "Mimo Desktop", schemes: ["mimodesktop"] },
        publish: { provider: "github", owner: "taisrisk", repo: "mimo-desktop", channel: "latest" },
        rpm: { packageName: "mimo-desktop" },
      }
    }
  }
}

export default getConfig()
