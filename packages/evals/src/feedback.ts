import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { connection, closeDb } from '@reforma-digital/db';
import { repoRoot } from './index';
const rowSchema = z.object({
  id: z.string(),
  reason: z.string().nullable(),
  comment: z.string().nullable(),
  result: z.object({
    id: z.string(),
    query: z.string(),
    evidence: z.unknown(),
    answer: z.unknown(),
  }),
});
try {
  const rows = z.array(rowSchema).parse(
    await connection()`SELECT f.id, f.reason, f.comment, s.result
      FROM feedback f JOIN searches s ON s.id = f.search_id
      WHERE f.rating = -1 AND f.reviewed_at IS NULL`,
  );
  const candidates = rows.map((r) => ({
    id: 'production-' + r.id,
    query: r.result.query,
    metadata: { category: 'unanswerable', difficulty: 'hard' },
    critical: false,
    golden: false,
    review: {
      status: 'pending',
      reviewer: null,
      reviewedAt: null,
      evidenceNotes: `Feedback: ${r.reason ?? ''}. Review search ${r.result.id}; decide expected.shouldAnswer and evidence manually.`,
    },
    expected: {
      relevantSourceIds: [],
      relevantDocumentIds: [],
      relevanceGrades: {},
      mustContainFacts: [],
      mustNotContainFacts: [],
      shouldAnswer: false,
    },
    context: {
      comment: r.comment,
      evidence: r.result.evidence,
      answer: r.result.answer,
    },
  }));
  const dir = path.join(repoRoot, 'artifacts/feedback');
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'review-queue.json'), JSON.stringify(candidates, null, 2));
  console.log(
    `${candidates.length} candidatos exportados. No se han modificado expectativas ni el golden set.`,
  );
} finally {
  await closeDb();
}
