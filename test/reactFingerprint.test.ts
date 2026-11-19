import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { reactContentKey } from '../src/analysis/reactFingerprint';
import type { RapidorGraph } from '../src/db/ReactStateStore';

const graph = (fingerprint: string, id: string): RapidorGraph => ({
  fingerprint,
  nodes: { 'node-0': { id: 'node-0', componentId: 1, tag: 0, props: { id, title: 'Lesson' } } },
});

describe('reactFingerprint: reactContentKey', () => {
  it('is stable: the same structure + data hashes to the same key', () => {
    assert.equal(reactContentKey({ graph: graph('fpA', '101') }), reactContentKey({ graph: graph('fpA', '101') }));
  });

  it('separates instances that SHARE a structure but carry different data (the point of the data half)', () => {
    // same structural fingerprint, different id value → different key: a real sibling leak is NOT merged
    assert.notEqual(reactContentKey({ graph: graph('fpA', '101') }), reactContentKey({ graph: graph('fpA', '102') }));
  });

  it('separates different structures carrying the same data', () => {
    assert.notEqual(reactContentKey({ graph: graph('fpA', '101') }), reactContentKey({ graph: graph('fpB', '101') }));
  });

  it('returns undefined for an unusable graph (no fingerprint / no nodes) — callers then keep the finding', () => {
    assert.equal(reactContentKey({ graph: undefined }), undefined);
    assert.equal(reactContentKey({ graph: { fingerprint: '', nodes: {} } }), undefined);
    assert.equal(reactContentKey({ graph: { fingerprint: 'fp' } as RapidorGraph }), undefined);
  });
});
