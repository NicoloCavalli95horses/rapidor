import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ClientSiblingGroups } from '../src/analysis/clientSiblingGroups';
import { REDIRECT_AWAY_PREFIX } from '../src/analysis/clientRoutingVerifier';

const redirect = (target: string) => `${REDIRECT_AWAY_PREFIX} from the candidate route (${target} != /stories/x/read)`;

/** Drives evaluate() with a fixed probe verdict; returns the recorded sibling names and whether the probe ran. */
function harness(groups: ClientSiblingGroups) {
  const recorded: string[] = [];
  const run = async ({ name, reason = null, keep = true, group = 'G' }: { name: string; reason?: string | null; keep?: boolean; group?: string }) => {
    let probed = false;
    await groups.evaluate({
      groupKey: group, context: name, record: () => recorded.push(name),
      probe: async () => { probed = true; return reason; },
      keep: async () => keep,
    });
    return probed;
  };
  return { recorded, run };
}

describe('ClientSiblingGroups — positive inference', () => {
  it('recovers a flaky-rejected sibling once another sibling genuinely confirms the group (ejoy)', async () => {
    const { recorded, run } = harness(new ClientSiblingGroups(3));
    await run({ name: '1033', reason: 'inert content' });
    assert.deepEqual(recorded, []);
    await run({ name: '1032' });
    assert.deepEqual(recorded, ['1032', '1033']);
  });

  it('records a sibling of an already-confirmed group without probing it', async () => {
    const { recorded, run } = harness(new ClientSiblingGroups(3));
    await run({ name: 'a' });
    assert.equal(await run({ name: 'b', reason: 'would reject' }), false);
    assert.deepEqual(recorded, ['a', 'b']);
  });

  it('never confirms a group with zero genuine accepts, nor on a content-guard drop', async () => {
    const groups = new ClientSiblingGroups(3);
    const { recorded, run } = harness(groups);
    await run({ name: 'a', reason: 'not found' });
    await run({ name: 'b', keep: false });   // probe accepted, but already-accessible content
    groups.finalize();
    assert.deepEqual(recorded, []);
  });

  it('keeps groups apart', async () => {
    const { recorded, run } = harness(new ClientSiblingGroups(3));
    await run({ name: 'x', reason: 'inert content', group: 'G1' });
    await run({ name: 'y', group: 'G2' });
    assert.deepEqual(recorded, ['y']);
  });
});

describe('ClientSiblingGroups — negative inference', () => {
  it('skips the rest of a group after N redirects to the SAME target (clozemaster /pro)', async () => {
    const groups = new ClientSiblingGroups(2);
    const { run } = harness(groups);
    assert.equal(await run({ name: '1', reason: redirect('/pro') }), true);
    assert.equal(await run({ name: '2', reason: redirect('/pro') }), true);
    assert.equal(await run({ name: '3', reason: redirect('/pro') }), false);
    assert.equal(groups.skipped, 1);
  });

  it('counts only redirect-away rejects, per target, and is off at 0', async () => {
    const mixed = new ClientSiblingGroups(2);
    const m = harness(mixed);
    await m.run({ name: '1', reason: redirect('/pro') });
    await m.run({ name: '2', reason: redirect('/login') });
    await m.run({ name: '3', reason: 'inert content' });
    assert.equal(await m.run({ name: '4', reason: 'inert content' }), true);
    const off = new ClientSiblingGroups(0);
    const o = harness(off);
    for (const n of ['1', '2', '3']) assert.equal(await o.run({ name: n, reason: redirect('/pro') }), true);
  });

  it('confirmation wins: skipped siblings are recovered by a later genuine accept (via finalize)', async () => {
    const groups = new ClientSiblingGroups(1);
    const { recorded, run } = harness(groups);
    await run({ name: '1', reason: redirect('/pro') });   // group rejected
    await run({ name: '2' });                             // skipped (stashed), never probed
    assert.deepEqual(recorded, []);
    groups.finalize();                                    // still no confirmation → nothing
    assert.deepEqual(recorded, []);
    groups.reset();
    assert.equal(groups.skipped, 0);
  });
});

describe('ClientSiblingGroups.key', () => {
  it('ignores the candidate value and authz key order, splits on a different authz signature', () => {
    const cand = (candidateValue: string) => ({ stateId: 1, referenceNodeId: 'n', path: ['props', 'id'], candidateValue }) as never;
    const authz = (sensitiveKeys: string[]) => ({ sensitiveKeys }) as never;
    const k = (v: string, keys: string[]) => ClientSiblingGroups.key({ pageUrl: 'https://x/p', candidate: cand(v), authz: authz(keys) });
    assert.equal(k('1', ['lock', 'premium']), k('2', ['premium', 'lock']));
    assert.notEqual(k('1', ['lock']), k('1', ['premium']));
  });
});
