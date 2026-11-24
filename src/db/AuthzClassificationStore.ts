import type Database from 'better-sqlite3';

export interface AuthzClassificationStoreOptions {
  db: Database.Database;   // shared connection (opened once per crawler run via openDatabase)
  clearOnStart: boolean;   // wipe authz_classifications once, at construction — off by default (see below)
}

/**
 * Persistent cache for AuthzClassifier: a classification is a pure function of the key string
 * (independent of site or run), so unlike every other table here it is NOT cleared by the main
 * db.clearOnStart — only by its own cfg.db.clearClassifierCache flag, since recomputing embeddings
 * for keys already seen is pure waste.
 */
export class AuthzClassificationStore {
  private db: Database.Database;

  constructor({ db, clearOnStart }: AuthzClassificationStoreOptions) {
    this.db = db;
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS authz_classifications (
        key TEXT PRIMARY KEY,
        score REAL NOT NULL,
        is_authz_relevant INTEGER NOT NULL
      )
    `);
    // Entitlement POLARITY cache (EntitlementPolarity, NLI model): same lifecycle as the relevance
    // cache above — a pure function of the term, wiped only by the same clearClassifierCache flag.
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS authz_polarity (
        key TEXT PRIMARY KEY,
        polarity REAL NOT NULL,
        relevance REAL NOT NULL
      )
    `);
    if (clearOnStart) this.db.exec('DELETE FROM authz_classifications; DELETE FROM authz_polarity;');
  }

  get(key: string): { score: number; isAuthZRelevant: boolean } | undefined {
    const row = this.db.prepare('SELECT score, is_authz_relevant FROM authz_classifications WHERE key = ?').get(key) as
      { score: number; is_authz_relevant: number } | undefined;
    return row ? { score: row.score, isAuthZRelevant: Boolean(row.is_authz_relevant) } : undefined;
  }

  set(key: string, result: { score: number; isAuthZRelevant: boolean }): void {
    this.db.prepare(`
      INSERT INTO authz_classifications (key, score, is_authz_relevant) VALUES (@key, @score, @isAuthZRelevant)
      ON CONFLICT(key) DO UPDATE SET score = @score, is_authz_relevant = @isAuthZRelevant
    `).run({ key, score: result.score, isAuthZRelevant: result.isAuthZRelevant ? 1 : 0 });
  }

  getPolarity(key: string): { polarity: number; relevance: number } | undefined {
    return this.db.prepare('SELECT polarity, relevance FROM authz_polarity WHERE key = ?').get(key) as
      { polarity: number; relevance: number } | undefined;
  }

  setPolarity(key: string, result: { polarity: number; relevance: number }): void {
    this.db.prepare(`
      INSERT INTO authz_polarity (key, polarity, relevance) VALUES (@key, @polarity, @relevance)
      ON CONFLICT(key) DO UPDATE SET polarity = @polarity, relevance = @relevance
    `).run({ key, ...result });
  }

  count(): number {
    return (this.db.prepare('SELECT COUNT(*) AS n FROM authz_classifications').get() as { n: number }).n;
  }
}
