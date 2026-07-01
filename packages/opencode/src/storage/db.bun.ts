import { Database } from "bun:sqlite"
import { drizzle, type SQLiteBunDatabase } from "drizzle-orm/bun-sqlite"

export { migrate } from "drizzle-orm/bun-sqlite/migrator"
export type Client = SQLiteBunDatabase

export function init(path: string) {
  const sqlite = new Database(path, { create: true })
  const db = drizzle({ client: sqlite })
  return db
}
