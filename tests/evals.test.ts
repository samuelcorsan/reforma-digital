import { describe, it, expect } from 'vitest';
import {
  loadDataset,
  compareReports,
  regressionGate,
  type Report,
} from '../packages/evals/src/index';
import { retrievalMetrics, aggregate } from '../packages/evals/src/metrics';
import { defaultConfig, type Evidence } from '../packages/core/src/index';
import { evalCaseSchema } from '../packages/evals/src/schema';
const c = evalCaseSchema.parse({
  id: 'test',
  query: 'vida laboral',
  metadata: { category: 'common', difficulty: 'easy' },
  review: {
    status: 'pending',
    reviewer: null,
    reviewedAt: null,
    evidenceNotes: '',
  },
  expected: {
    shouldAnswer: true,
    relevantDocumentIds: ['gold'],
    relevantSourceIds: ['seg-social'],
    expectedJurisdiction: 'ES',
    relevanceGrades: { gold: 3, other: 1 },
  },
});
const e = (id: string): Evidence => ({
  documentId: id,
  chunkId: id,
  sourceId: 'seg-social',
  canonicalUrl: 'https://portal.seg-social.gob.es/a',
  title: id,
  heading: '',
  content: 'contenido',
  organization: 'Seguridad Social',
  jurisdiction: 'ES',
  authorityScore: 100,
  crawledAt: '2026-01-01',
  sourceUpdatedAt: null,
  available: true,
  score: 1,
});
describe('Eval metrics', () => {
  it('measures document ranks, not duplicate chunks', () => {
    const m = retrievalMetrics(c, [e('other'), { ...e('other'), chunkId: 'another' }, e('gold')]);
    expect(m.recall1).toBe(0);
    expect(m.recall3).toBe(1);
    expect(m.mrr).toBe(0.5);
    expect(m.ndcg10).toBeLessThan(1);
  });
  it('does not pretend a source ID is document-level recall', () =>
    expect(
      retrievalMetrics({ ...c, expected: { ...c.expected, relevantDocumentIds: [] } }, [e('gold')])
        .recall5,
    ).toBeNull());
  it('counts failed retrieval as zero when gold exists', () =>
    expect(retrievalMetrics(c, []).recall5).toBe(0));
  it('ignores missing semantic scores instead of giving full credit', () =>
    expect(
      aggregate([
        {
          case: c,
          result: null,
          metrics: { faithfulness: null },
          failures: [],
        },
      ]).faithfulness,
    ).toBeNull());
  it('has the requested category distribution and no automatic approvals', async () => {
    const d = await loadDataset();
    const counts = Object.fromEntries(
      [
        'common',
        'jurisdiction',
        'ambiguous',
        'unanswerable',
        'adversarial',
        'freshness',
        'citation',
      ].map((cat) => [cat, d.cases.filter((c) => c.metadata.category === cat).length]),
    );
    expect(counts).toEqual({
      common: 50,
      jurisdiction: 25,
      ambiguous: 15,
      unanswerable: 20,
      adversarial: 20,
      freshness: 10,
      citation: 10,
    });
    expect(d.cases.filter((c) => c.golden)).toHaveLength(50);
    expect(new Set(d.cases.map((c) => c.query)).size).toBe(150);
  });
});
const report = {
  id: 'r',
  metadata: {
    gitCommit: 'test',
    dirty: false,
    timestamp: '2026-09-30',
    datasetVersion: 'v1',
    datasetHash: 'abc',
    sourcesHash: 'def',
    model: 'test',
    retrievalBackend: 'web-search',
    promptVersion: 'v1',
    retrievalConfig: defaultConfig,
    mode: 'live',
    retrievalOnly: false,
    judges: true,
    reviewedCases: 1,
    totalCases: 1,
    evaluatorVersion: 'metrics-v1',
  },
  metrics: {
    recall5: 1,
    faithfulness: 0.99,
    citationPrecision: 0.99,
    wrongJurisdiction: 0,
  },
  categories: {},
  cases: [],
  approved: true,
} satisfies Report;
describe('Regression gate', () => {
  it('rejects different dataset versions', () =>
    expect(() =>
      compareReports(
        {
          ...report,
          metadata: { ...report.metadata, datasetHash: 'different' },
        },
        report,
      ),
    ).toThrow('Comparación inválida'));
  it('rejects preview scores', () =>
    expect(
      regressionGate({
        ...report,
        metadata: { ...report.metadata, mode: 'preview' },
      }),
    ).toContain('La vista previa no certifica producción'));
  it('rejects missing judges', () =>
    expect(
      regressionGate({ ...report, metrics: { ...report.metrics, faithfulness: null } }, report),
    ).toContain('faithfulness ausente o inferior al umbral'));
  it('fails a critical regression even with good aggregates', () =>
    expect(
      regressionGate(
        {
          ...report,
          cases: [
            {
              case: { ...c, critical: true },
              result: null,
              metrics: {},
              failures: ['cita inventada'],
            },
          ],
        },
        report,
      ),
    ).toContain('Falla un caso crítico'));
  it('fails more than three percentage points recall regression', () =>
    expect(
      regressionGate({ ...report, metrics: { ...report.metrics, recall5: 0.95 } }, report),
    ).toContain('Recall@5 cae más de 3pp'));
});
