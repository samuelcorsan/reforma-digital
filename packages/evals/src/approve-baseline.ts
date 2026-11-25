/** Operator command. Never called by the experiment runner or by an LLM. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { closeDb } from '@reforma-digital/db';
import { loadDataset, regressionGate, repoRoot, type Report } from './index';
import { saveReport } from './reports';
const args = process.argv.slice(2);
const value = (name: string) => args[args.indexOf(name) + 1];
try {
  if (!args.includes('--run') || !args.includes('--reviewer'))
    throw new Error('Uso: pnpm eval:approve --run artifacts/runs/ID.json --reviewer NOMBRE');
  const reviewer = value('--reviewer')?.trim();
  if (!reviewer || reviewer.startsWith('--'))
    throw new Error('Identifica a la persona que ha revisado el baseline');
  const report = JSON.parse(await readFile(value('--run')!, 'utf8')) as Report;
  const dataset = await loadDataset('full');
  for (const row of report.cases) {
    const reviewed = dataset.cases.find((c) => c.id === row.case.id);
    if (
      !reviewed ||
      reviewed.review.status !== 'approved' ||
      !reviewed.review.reviewer ||
      !reviewed.review.reviewedAt
    )
      throw new Error(`Revisión humana pendiente: ${row.case.id}`);
    if (JSON.stringify(reviewed.expected) !== JSON.stringify(row.case.expected))
      throw new Error(
        `Las expectativas de ${row.case.id} cambiaron: ejecuta de nuevo el experimento`,
      );
  }
  const failures = regressionGate(report, { ...report, approved: true });
  if (failures.length) throw new Error('No se puede aprobar: ' + failures.join('; '));
  report.approved = true;
  report.approvedBy = reviewer;
  const file = path.join(repoRoot, 'packages/evals/baselines/baseline.json');
  await mkdir(path.dirname(file), { recursive: true });
  await saveReport(report);
  await writeFile(file, JSON.stringify(report, null, 2) + '\n');
  console.log(`Baseline aprobado por ${reviewer}: ${report.id}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Error al aprobar');
  process.exitCode = 1;
} finally {
  await closeDb();
}
