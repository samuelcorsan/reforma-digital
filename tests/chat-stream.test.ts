import { describe, expect, it } from 'vitest';
import { collectVerifiedClaims, type AnswerSegment } from '../packages/ai/src/stream-answer';
import { understandQuery } from '../packages/retrieval/src/index';
import { verbatimFigure, type Evidence, type VerifiedClaim } from '../packages/core/src/index';
const evidence: Evidence = {
  chunkId: 'c1',
  documentId: 'd1',
  sourceId: 'seg-social',
  canonicalUrl: 'https://portal.seg-social.gob.es/informe',
  title: 'Vida laboral',
  heading: 'Descarga',
  content: 'Puedes descargar el informe en PDF.',
  organization: 'Seguridad Social',
  jurisdiction: 'ES',
  authorityScore: 100,
  crawledAt: '2026-09-30T00:00:00Z',
  sourceUpdatedAt: null,
  score: 1,
  available: true,
};
const segment: AnswerSegment = {
  kind: 'step',
  text: evidence.content,
  figure: null,
  citations: [{ documentId: 'd1', chunkId: 'c1' }],
};
async function* elements(values: AnswerSegment[]) {
  for (const value of values) yield value;
}
const query = understandQuery('¿Dónde saco mi vida laboral?');
describe('Verified incremental answers', () => {
  it('keeps supported parts when another part has insufficient evidence', async () => {
    const missing: AnswerSegment = {
      kind: 'insufficient_evidence',
      text: 'No consta el coste.',
      citations: [],
    };
    const answer = await collectVerifiedClaims(
      elements([missing, segment]),
      [evidence],
      query,
      async () => true,
    );
    expect(answer.status).toBe('answered');
    expect(answer.claims).toHaveLength(1);
    expect(answer.incomplete).toBe(true);
  });

  it('publishes a verified claim before the remaining model response arrives', async () => {
    let release!: () => void;
    const next = new Promise<void>((resolve) => {
      release = resolve;
    });
    let first!: () => void;
    const published = new Promise<void>((resolve) => {
      first = resolve;
    });
    const seen: VerifiedClaim[] = [];
    async function* stream() {
      yield segment;
      await next;
      yield { ...segment, kind: 'fact' as const };
    }
    const result = collectVerifiedClaims(
      stream(),
      [evidence],
      query,
      async () => true,
      (block) => {
        seen.push(block);
        first();
      },
    );
    await published;
    expect(seen).toHaveLength(1);
    expect(seen[0]?.citations[0]?.quote).toBe(evidence.content);
    release();
    const answer = await result;
    expect(answer.claims).toEqual(seen.map((b) => b.claim));
    expect(answer.citations).toEqual(seen.flatMap((b) => b.citations));
  });
  it('never emits an unsupported claim and flags partial evidence', async () => {
    const seen: VerifiedClaim[] = [];
    const answer = await collectVerifiedClaims(
      elements([segment, { ...segment, text: 'La descarga cuesta 40 euros.' }]),
      [evidence],
      query,
      async (b) => b.claim.text === evidence.content,
      (b) => seen.push(b),
    );
    expect(seen).toHaveLength(1);
    expect(answer.incomplete).toBe(true);
  });
  it.each([
    { ...segment, citations: [{ documentId: 'invented', chunkId: 'c1' }] },
    { ...segment, citations: [] },
    { ...segment, text: 'Visita https://example.com' },
  ])('rejects forged or uncited blocks before semantic verification', async (value) => {
    let called = false;
    const answer = await collectVerifiedClaims(
      elements([value]),
      [evidence],
      query,
      async () => {
        called = true;
        return true;
      },
      () => {
        throw new Error('must not publish');
      },
    );
    expect(called).toBe(false);
    expect(answer.status).toBe('insufficient_evidence');
  });
  it('does not publish incompatible jurisdictions', async () => {
    const answer = await collectVerifiedClaims(
      elements([segment]),
      [{ ...evidence, jurisdiction: 'ES-CT-BARCELONA' }],
      query,
      async () => true,
      () => {
        throw new Error('must not publish');
      },
    );
    expect(answer.status).toBe('insufficient_evidence');
  });
  it('propagates a stream failure after already verified blocks', async () => {
    const seen: VerifiedClaim[] = [];
    async function* broken() {
      yield segment;
      throw new Error('connection lost');
    }
    await expect(
      collectVerifiedClaims(
        broken(),
        [evidence],
        query,
        async () => true,
        (b) => seen.push(b),
      ),
    ).rejects.toThrow('connection lost');
    expect(seen).toHaveLength(1);
  });
});
describe('Answer block rules', () => {
  const cost: AnswerSegment = {
    kind: 'cost',
    text: 'La tasa cuesta 12,00 euros.',
    figure: '12,00 euros',
    citations: [{ documentId: 'd1', chunkId: 'c1' }],
  };
  it('keeps a figure only when a cost or deadline claim contains it word for word', () => {
    expect(verbatimFigure('cost', cost.text, '12,00  euros')).toBe('12,00 euros');
    expect(verbatimFigure('cost', cost.text, '12 €')).toBeUndefined();
    expect(verbatimFigure('deadline', 'Tienes un mes.', 'un mes')).toBeUndefined();
    expect(verbatimFigure('fact', cost.text, '12,00 euros')).toBeUndefined();
  });
  it('drops an invented figure without rejecting the verified claim', async () => {
    const answer = await collectVerifiedClaims(
      elements([{ ...cost, figure: '15 euros' }, cost]),
      [{ ...evidence, content: cost.text }],
      query,
      async () => true,
    );
    expect(answer.claims.map((c) => c.figure)).toEqual([undefined, '12,00 euros']);
  });
  it('drops the numbers and bullets the model writes, since the interface numbers each step', async () => {
    const answer = await collectVerifiedClaims(
      elements([
        { ...segment, text: '1. Solicita cita previa.' },
        { ...segment, text: '2) Acude en persona.' },
        { ...segment, kind: 'document', text: '- El DNI anterior.' },
        { ...segment, kind: 'fact', text: '2026 es el último año.' },
        { ...segment, kind: 'fact', text: '1.500 euros es el límite.' },
        { ...segment, text: '3. ' },
      ]),
      [evidence],
      query,
      async () => true,
    );
    expect(answer.claims.map((c) => c.text)).toEqual([
      'Solicita cita previa.',
      'Acude en persona.',
      'El DNI anterior.',
      '2026 es el último año.',
      '1.500 euros es el límite.',
    ]);
    expect(answer.incomplete).toBe(true);
  });
  it('shows at most one warning; later ones become facts', async () => {
    const warning: AnswerSegment = { ...segment, kind: 'warning' };
    const answer = await collectVerifiedClaims(
      elements([warning, warning]),
      [evidence],
      query,
      async () => true,
    );
    expect(answer.claims.map((c) => c.kind)).toEqual(['warning', 'fact']);
  });
});
