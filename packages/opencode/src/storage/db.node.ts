import { DatabaseSync } from "node:sqlite"
import { drizzle, type NodeSQLiteDatabase } from "drizzle-orm/node-sqlite"

export { migrate } from "drizzle-orm/node-sqlite/migrator"
export type Client = NodeSQLiteDatabase

export function init(path: string) {
  const sqlite = new DatabaseSync(path)
  const db = drizzle({ client: sqlite })
  return db
}
