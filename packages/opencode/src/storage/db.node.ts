import { DatabaseSync } from "node:sqlite"
import { drizzle, type NodeSQLiteDatabase } from "drizzle-orm/node-sqlite"
import { migrate as nodeMigrate } from "drizzle-orm/node-sqlite/migrator"
import type { MigrationConfig } from "drizzle-orm/migrator"

export type Client = NodeSQLiteDatabase

export function init(path: string) {
  const sqlite = new DatabaseSync(path)
  const db = drizzle({ client: sqlite })
  return db
}

// db.ts calls migrate(db, entries) with entries as a raw array of
// {sql, timestamp, name} (the bundled/dev migration journal), not the
// {migrationsFolder: string} object drizzle-orm's own migrate() expects.
// Passing the array straight through makes it try to readdirSync(undefined)
// and crash. Detect the array shape and drive db.dialect.migrate() directly
// with drizzle's internal MigrationMeta format instead.
export function migrate(
  db: ReturnType<typeof drizzle>,
  config: MigrationConfig | { sql: string; timestamp: number; name: string }[],
) {
  if (Array.isArray(config)) {
    const migrations = config.map((d) => ({
      sql: d.sql.split("--> statement-breakpoint"),
      folderMillis: d.timestamp,
      hash: "",
      bps: true,
      name: d.name,
    }))
    return db.dialect.migrate(migrations, db.session, {})
  }
  return nodeMigrate(db, config)
}
