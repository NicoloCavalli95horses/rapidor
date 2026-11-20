import type Database from 'better-sqlite3';
import { collectPreindexRows } from '../analysis/preindex';
import type { RapidorGraph } from './ReactStateStore';

export interface PreindexMatch {
  stateId: number;
  nodeId: string;
  path: (string | number)[];
  depth: number;
}

export interface PreindexedValueStoreOptions {
  db: Database.Database;   // shared connection (opened once per crawler run via openDatabase)
  clearOnStart: boolean;   // wipe preindexed_values once, at construction
}

/**
 * SQL equivalent of RAPIDOR's IndexedDB `PREINDEXING` store: one row per token (its multiEntry
 * index, flattened), so an exact-value lookup is a plain indexed equality query.
 */
export class PreindexedValueStore {
  private db: Database.Database;

  constructor({ db, clearOnStart }: PreindexedValueStoreOptions) {
    this.db = db;
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS preindexed_values (
        id INTEGER PRIMARY KEY,
        state_id INTEGER NOT NULL,
        node_id TEXT NOT NULL,
        value TEXT NOT NULL,
        path TEXT NOT NULL,
        depth INTEGER NOT NULL
      )
    `);
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_preindexed_values_value ON preindexed_values(value)');
    if (clearOnStart) this.db.exec('DELETE FROM preindexed_values');
  }

  /**
   * Removes every row belonging to one site. preindexed_values has no `site` column of its own: each
   * row points at a react_states row via state_id, so a site's rows are those whose state_id belongs
   * to that site. Must run BEFORE the react_states rows themselves are deleted, or the subquery finds
   * nothing.
   */
  clearSite({ site }: { site: string }): void {
    this.db.prepare('DELETE FROM preindexed_values WHERE state_id IN (SELECT id FROM react_states WHERE site = ?)').run(site);
  }

  /** Replaces this state's rows with a fresh preindex of its graph (cheap: one state at a time). */
  reindex({ stateId, graph }: { stateId: number; graph: RapidorGraph }): void {
    const nodes = graph.nodes ?? {};
    const rows = Object.entries(nodes).flatMap(([nodeId, node]) =>
      collectPreindexRows({ nodeId, key: node.key, props: node.props }));

    const insert = this.db.prepare(`
      INSERT INTO preindexed_values (state_id, node_id, value, path, depth)
      VALUES (@stateId, @nodeId, @value, @path, @depth)
    `);
    const replace = this.db.transaction(() => {
      this.db.prepare('DELETE FROM preindexed_values WHERE state_id = ?').run(stateId);
      for (const row of rows) {
        insert.run({ stateId, nodeId: row.nodeId, value: row.value, path: JSON.stringify(row.path), depth: row.depth });
      }
    });
    replace();
  }

  /**
   * Preindexed nodes carrying this exact value, SCOPED to one site. The scope is essential: the DB holds
   * many sites at once (`db.overwriteExistingDomain` wipes only the domain being re-crawled, never the
   * others), and preindexed_values has no site column, so an unscoped `value = ?` returns another site's
   * nodes too — celpipsimulator's `/blog?_rsc=` segment `blog` matched babbel's footer `blog` link and
   * forged celpipsimulator's `/privacy` from babbel's sibling, a cross-site false positive. We scope via
   * the state's own site (state_id -> react_states.site, indexed), not a denormalized column, so it is
   * correct on an existing DB with no migration.
   */
  findByValue({ value, site }: { value: string; site: string }): PreindexMatch[] {
    const rows = this.db.prepare(
      'SELECT state_id, node_id, path, depth FROM preindexed_values WHERE value = ? AND state_id IN (SELECT id FROM react_states WHERE site = ?)',
    ).all(value, site) as { state_id: number; node_id: string; path: string; depth: number }[];
    return rows.map((r) => ({ stateId: r.state_id, nodeId: r.node_id, path: JSON.parse(r.path), depth: r.depth }));
  }

  /**
   * How many preindexed nodes of THIS SITE carry this exact value (uses idx_preindexed_values_value +
   * the react_states site index). Lets a caller cheaply tell a user-scoped identifier — which appears a
   * bounded handful of times (an objective/exercise id: tens) — apart from a generic keyword that
   * happens to also be a URL segment (a DOM tag/role/category word like "svg"/"grammar": thousands),
   * before paying to fetch and diff every match. Scoped for the same reason as findByValue.
   */
  countByValue({ value, site }: { value: string; site: string }): number {
    return (this.db.prepare(
      'SELECT COUNT(*) AS n FROM preindexed_values WHERE value = ? AND state_id IN (SELECT id FROM react_states WHERE site = ?)',
    ).get(value, site) as { n: number }).n;
  }

  count(): number {
    return (this.db.prepare('SELECT COUNT(*) AS n FROM preindexed_values').get() as { n: number }).n;
  }
}
