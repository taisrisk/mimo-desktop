import { $ } from "bun"

await $`bun ./scripts/copy-icons.ts ${process.env.MIMO_CHANNEL ?? "dev"}`

await $`cd ../opencode && bun --config=bunfig.node.toml script/build-node.ts`
