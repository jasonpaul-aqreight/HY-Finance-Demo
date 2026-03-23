import { getDbFactory } from '../db';

export function getDb() {
  return getDbFactory('margin');
}
