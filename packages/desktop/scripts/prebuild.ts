#!/usr/bin/env bun
import { $ } from "bun"

import { resolveChannel } from "./utils"

const channel = resolveChannel()
await $`bun ./scripts/copy-icons.ts ${channel}`

await $`cd ../opencode && bun --config=bunfig.node.toml script/build-node.ts`
