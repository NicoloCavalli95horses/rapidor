import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readPath, diffValue, findCandidates } from '../src/analysis/matchFinder';
import type { RapidorGraph } from '../src/db/ReactStateStore';

describe('readPath', () => {
  it('walks a path into an object, undefined on a missing or non-object step', () => {
    assert.equal(readPath({ props: { id: '42' } }, ['props', 'id']), '42');
    assert.equal(readPath({ props: { id: '42' } }, ['props', 'missing']), undefined);
    assert.equal(readPath({ props: 'not-an-object' }, ['props', 'id']), undefined);
  });
});

describe('diffValue', () => {
  it('extracts the single differing token between two tokenized strings', () => {
    assert.equal(diffValue({ referenceRaw: 'users/42', candidateRaw: 'users/43' }), '43');
  });

  it('returns undefined when there is no diff, or more than one', () => {
    assert.equal(diffValue({ referenceRaw: 'users/42', candidateRaw: 'users/42' }), undefined);
    assert.equal(diffValue({ referenceRaw: 'a/b', candidateRaw: 'c/d' }), undefined);
  });

  it('compares POSITIONALLY: same token count, one differing position', () => {
    // a set difference would pair `/my-plan/<id>/73` with `/profile` (promova settings-link FP)
    assert.equal(diffValue({ referenceRaw: '/my-plan/app3X/73', candidateRaw: '/profile' }), undefined);
    assert.equal(diffValue({ referenceRaw: 'a/b', candidateRaw: 'a/b/c' }), undefined);
  });

  it('requires the differing token to be the matched URL value (mangolanguages 403 FP)', () => {
    const ref = '/pathway/from/en-US/to/fr/485/1/1/1';
    const cand = '/pathway/from/en-US/to/fr/485/1/1/4';
    // matched on the pathway id `485`, but the sibling differs at the lesson number: not a swap of 485
    assert.equal(diffValue({ referenceRaw: ref, candidateRaw: cand, matchedValue: '485' }), undefined);
    // matched on `1`: the lesson-number position holds `1`, so `4` is a coherent swap
    assert.equal(diffValue({ referenceRaw: ref, candidateRaw: cand, matchedValue: '1' }), '4');
    assert.equal(diffValue({ referenceRaw: 'users/42', candidateRaw: 'users/43', matchedValue: '42' }), '43');
  });

  it('falls back to straight inequality for non-string values', () => {
    assert.equal(diffValue({ referenceRaw: 42, candidateRaw: 43 }), '43');
    assert.equal(diffValue({ referenceRaw: 42, candidateRaw: 42 }), undefined);
  });

  it('is undefined when the candidate value is missing', () => {
    assert.equal(diffValue({ referenceRaw: '42', candidateRaw: undefined }), undefined);
  });
});

describe('findCandidates', () => {
  const graph: RapidorGraph = {
    fingerprint: 'f',
    nodes: {
      'node-1': { id: 'node-1', componentId: 1, props: { id: 'free-id', premium: false } },
      'node-2': { id: 'node-2', componentId: 1, props: { id: 'premium-id', premium: true } },
      'node-3': { id: 'node-3', componentId: 2, props: { id: 'other-component' } },
    },
    componentIndex: { '1': ['node-1', 'node-2'] },
  };

  it('finds a sibling instance with a different value at the same path', () => {
    const candidates = findCandidates({ stateId: 1, graph, nodeId: 'node-1', path: ['props', 'id'] });
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].candidateNodeId, 'node-2');
    assert.equal(candidates[0].candidateValue, 'premium-id');
    assert.deepEqual(candidates[0].referenceProps, { id: 'free-id', premium: false });
    assert.deepEqual(candidates[0].candidateProps, { id: 'premium-id', premium: true });
  });

  it('is empty for an orphan node (no componentId) or a component with no recorded instances', () => {
    assert.deepEqual(findCandidates({ stateId: 1, graph, nodeId: 'node-3', path: ['props', 'id'] }), []);
    const lonely: RapidorGraph = { fingerprint: 'f', nodes: graph.nodes, componentIndex: { '2': ['node-3'] } };
    assert.deepEqual(findCandidates({ stateId: 1, graph: lonely, nodeId: 'node-3', path: ['props', 'id'] }), []);
  });

  it('is empty when the reference value itself cannot be read at that path', () => {
    assert.deepEqual(findCandidates({ stateId: 1, graph, nodeId: 'node-1', path: ['props', 'missing'] }), []);
  });
});
