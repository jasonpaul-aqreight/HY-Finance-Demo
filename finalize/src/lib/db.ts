import Database from 'better-sqlite3';
import path from 'path';

const DATA_DIR = path.resolve(process.cwd(), '../data');

const connections = new Map<string, Database.Database>();

export function getDbFactory(dbName: string): Database.Database {
  let db = connections.get(dbName);
  if (!db) {
    db = new Database(path.join(DATA_DIR, `${dbName}.db`), { readonly: true });
    db.pragma('journal_mode = WAL');
    db.pragma('cache_size = 65536');
    db.pragma('synchronous = NORMAL');
    connections.set(dbName, db);
  }
  return db;
}
