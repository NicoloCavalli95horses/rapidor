import { log } from 'crawlee';
import type { findCandidates } from './matchFinder';
import type { AuthzAssessment } from './authzClassifier';
import { redirectAwayTarget } from './clientRoutingVerifier';

/**
 * CLIENT-ROUTING SIBLING-GROUP inference (see .claude/rules/analysis.md), per analysis run.
 *
 * POSITIVE: a client-routing probe is flaky on a fetch-gated route (ejoy's locked lessons load their
 * content by id over XHR; one real load can snapshot an incomplete render and read as a false NEGATIVE),
 * so which paid siblings surface flips run-to-run. Siblings of one reference node that share the swap PATH
 * and the authz-relevant keys are structurally identical resources behind the same route: if the probe
 * genuinely confirms ONE (a real, distinct, not-found-passing render), the others follow. A rejected
 * sibling is stashed and recorded once its group is confirmed. SAFETY: this only ever ADDS siblings to an
 * ALREADY-confirmed group — it never confirms a group with zero genuine accepts.
 *
 * NEGATIVE: once `rejectAfter` siblings of a group were rejected by a DETERMINISTIC redirect-away to the
 * SAME target (clozemaster bounces every paid story to /pro), the rest are skipped instead of probed. Only
 * redirect-away counts (flakiness yields inert/capture rejects, never a redirect). Skipped siblings are
 * still stashed, so a later genuine confirmation recovers them (confirmation wins).
 */
export class ClientSiblingGroups {
  private confirmed = new Set<string>();
  private pending = new Map<string, Array<() => void>>();
  private redirects = new Map<string, Map<string, number>>();
  private rejected = new Set<string>();
  private skippedCount = 0;

  // rejectAfter: config.analysis.clientRoutingGroupRejectAfter (0 = negative inference off)
  constructor(private readonly rejectAfter: number) {}

  reset(): void {
    this.confirmed.clear();
    this.pending.clear();
    this.redirects.clear();
    this.rejected.clear();
    this.skippedCount = 0;
  }

  /** Siblings skipped by negative group inference this run (for the end-of-run log). */
  get skipped(): number {
    return this.skippedCount;
  }

  /**
   * Group key: the reference component INSTANCE (stateId + node) on a page, the swapped field (`path`) and
   * the authz-relevant keys. A different authz signature forms a different group, so unrelated
   * entitlements never cross-confirm.
   */
  static key({ pageUrl, candidate, authz }: {
    pageUrl: string; candidate: ReturnType<typeof findCandidates>[number]; authz: AuthzAssessment;
  }): string {
    return [pageUrl, candidate.stateId, candidate.referenceNodeId, JSON.stringify(candidate.path), [...authz.sensitiveKeys].sort().join(',')].join('\u0000');
  }

  /**
   * The group-aware decision for ONE client-routing sibling, shared by the query and path evaluators:
   * already-confirmed group → record without re-probing (a fresh flaky probe could only lose it, and the
   * content guards are skipped for the same reason); rejected group → skip + stash; otherwise `probe`
   * (null = accept, else the reject reason) then `keep` (the content-novelty guard; a drop there is NOT
   * stashed — it is positive evidence, not flakiness). A genuine accept records and confirms the group.
   */
  async evaluate({ groupKey, record, probe, keep, context }: {
    groupKey: string; record: () => void; context: string;
    probe: () => Promise<string | null>; keep: () => Promise<boolean>;
  }): Promise<void> {
    if (this.confirmed.has(groupKey)) { record(); return; }
    if (this.rejected.has(groupKey)) {
      this.skippedCount++;
      this.stash({ groupKey, record });
      return;
    }
    const reason = await probe();
    if (reason) {
      log.debug(`AnalysisPipeline: candidate rejected (${reason}) — ${context}`);
      // maybe a flaky render, not a real negative: recovered if a sibling confirms the group
      this.stash({ groupKey, record });
      this.noteReject({ groupKey, reason });
      return;
    }
    if (!await keep()) return;
    record();
    this.confirmed.add(groupKey);
    this.flush({ groupKey });
  }

  /**
   * End-of-run backstop: records any still-pending sibling whose group was confirmed. evaluate() flushes
   * eagerly on confirm, so this only catches a sibling stashed AFTER its group's confirming flush. Call once
   * after every candidate task settled, before the final finding count.
   */
  finalize(): void {
    for (const groupKey of [...this.pending.keys()]) {
      if (this.confirmed.has(groupKey)) this.flush({ groupKey });
    }
  }

  private stash({ groupKey, record }: { groupKey: string; record: () => void }): void {
    const list = this.pending.get(groupKey) ?? [];
    list.push(record);
    this.pending.set(groupKey, list);
  }

  /** Records every pending sibling of a confirmed group, once (the list is consumed). */
  private flush({ groupKey }: { groupKey: string }): void {
    const list = this.pending.get(groupKey);
    if (!list) return;
    this.pending.delete(groupKey);
    for (const record of list) record();
  }

  /** Counts a redirect-away reject per target; reaching `rejectAfter` for one target rejects the group. */
  private noteReject({ groupKey, reason }: { groupKey: string; reason: string }): void {
    const target = redirectAwayTarget(reason);
    if (this.rejectAfter <= 0 || !target || this.rejected.has(groupKey)) return;
    const perTarget = this.redirects.get(groupKey) ?? new Map<string, number>();
    const count = (perTarget.get(target) ?? 0) + 1;
    perTarget.set(target, count);
    this.redirects.set(groupKey, perTarget);
    if (count >= this.rejectAfter) {
      this.rejected.add(groupKey);
      log.info(`AnalysisPipeline: client-routing sibling group rejected — ${count} siblings redirected to ${target}; skipping the rest of the group`);
    }
  }
}
