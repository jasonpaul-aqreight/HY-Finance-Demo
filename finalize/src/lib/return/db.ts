import { getDbFactory } from '../db';
import path from 'path';

const DATA_DIR = path.resolve(process.cwd(), '../data');
let salesAttached = false;

export function getDb() {
  const db = getDbFactory('credit');
  if (!salesAttached) {
    const salesPath = path.join(DATA_DIR, 'sales.db');
    db.exec(`ATTACH DATABASE '${salesPath}' AS sales`);
    salesAttached = true;
  }
  return db;
}
