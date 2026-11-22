import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { search } from '@reforma-digital/ai';
import { defaultConfig, type SearchConfig } from '@reforma-digital/core';
import { db, experiments } from '@reforma-digital/db';
import { datasetSchema, type Dataset } from './schema';
import { retrievalMetrics, deterministicAnswerMetrics, aggregate } from './metrics';
import { judgeAnswer } from './judges';
import { sources } from '@reforma-digital/government';
export * from './schema';
export * from './metrics';
export const repoRoot = path.resolve(fileURLToPath(new URL('../../../', import.meta.url)));
export const runsDir = path.join(repoRoot, 'artifacts/runs');
export type { Report } from './reports';
import { compareReports, type Report } from './reports';
export { listReports, compareReports } from './reports';
export async function loadDataset(selection = 'full'): Promise<Dataset> {
  if (!['full', 'golden', 'regressions'].includes(selection))
    throw new Error('Dataset desconocido');
  const data = datasetSchema.parse(
    JSON.parse(
      await readFile(
        path.join(
          repoRoot,
          'packages/evals/datasets',
          selection === 'regressions' ? 'regressions-v1.json' : 'full-v1.json',
        ),
        'utf8',
      ),
    ),
  );
  if (selection === 'golden') data.cases = data.cases.filter((c) => c.golden);
  return data;
}
export async function runExperiment(options: {
  dataset: Dataset;
  config?: SearchConfig;
  mode: 'live' | 'preview';
  retrievalOnly: boolean;
  judges: boolean;
  concurrency?: number;
}): Promise<Report> {
  const config = options.config ?? defaultConfig;
  const hash = (s: string) => createHash('sha256').update(s).digest('hex');
  // Sin git o fuera de un repositorio, el informe queda como «uncommitted» y con cambios.
  const git = (args: string[]) => {
    const run = spawnSync('git', args, {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return run.status === 0 ? run.stdout.trim() : undefined;
  };
  const gitCommit = git(['rev-parse', 'HEAD']) ?? 'uncommitted';
  const dirty = gitCommit === 'uncommitted' || git(['status', '--porcelain']) !== '';
  const codeFiles: string[] = [];
  const collect = async (dir: string): Promise<void> => {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) await collect(p);
      else if (/\.(ts|tsx|sql)$/.test(p)) codeFiles.push(p);
    }
  };
  for (const pkg of ['ai', 'core', 'retrieval', 'government', 'db', 'evals'])
    await collect(path.join(repoRoot, 'packages', pkg, 'src'));
  const codeHash = hash(
    (
      await Promise.all(
        codeFiles
          .sort()
          .map(async (p) => path.relative(repoRoot, p) + '\n' + (await readFile(p, 'utf8'))),
      )
    ).join('\n'),
  );
  const sourcesHash = hash(
    JSON.stringify(
      options.mode === 'live'
        ? sources
        : (await import('@reforma-digital/ai/preview-corpus')).previewCorpus,
    ),
  );
  const report: Report = {
    id: randomUUID(),
    metadata: {
      gitCommit,
      dirty,
      codeHash,
      timestamp: new Date().toISOString(),
      datasetVersion: options.dataset.version,
      datasetHash: hash(JSON.stringify(options.dataset)),
      sourcesHash,
      model: config.generationModel,
      retrievalBackend: 'web-search',
      promptVersion: config.promptVersion,
      retrievalConfig: config,
      mode: options.mode,
      retrievalOnly: options.retrievalOnly,
      judges: options.judges,
      reviewedCases: options.dataset.cases.filter((c) => c.review.status === 'approved').length,
      totalCases: options.dataset.cases.length,
      evaluatorVersion: 'metrics-v2',
    },
    metrics: {},
    categories: {},
    cases: [],
    approved: false,
  };
  const queue = [...options.dataset.cases];
  const runCase = async (c: Dataset['cases'][number]) => {
    try {
      const result = await search(c.query, {
        mode: options.mode,
        config,
        retrievalOnly: options.retrievalOnly,
      });
      const metrics = retrievalMetrics(c, result.evidence);
      const failures: string[] = [];
      let judges: Record<string, unknown> | undefined;
      if (!options.retrievalOnly && options.mode === 'live') {
        Object.assign(metrics, deterministicAnswerMetrics(c, result));
        if (options.judges) {
          const j = await judgeAnswer(c, result);
          judges = j.judges;
          Object.assign(metrics, j.metrics);
        }
      }
      if (metrics.recall5 === 0) failures.push('El documento gold no aparece en top 5');
      if (metrics.organizationAccuracy === 0)
        failures.push('El primer resultado no es del organismo esperado');
      if ((metrics.wrongJurisdiction ?? 0) > 0)
        failures.push('Resultados de jurisdicción incompatible');
      if (metrics.abstentionAccuracy === 0)
        failures.push(
          c.expected.shouldAnswer ? 'Abstención inesperada' : 'Respondió sin evidencia suficiente',
        );
      if (
        metrics.citationCoverage !== undefined &&
        metrics.citationCoverage !== null &&
        metrics.citationCoverage < 1
      )
        failures.push('Faltan citas');
      if (
        metrics.faithfulness !== undefined &&
        metrics.faithfulness !== null &&
        metrics.faithfulness < 1
      )
        failures.push('Claims sin respaldo');
      if (
        metrics.citationPrecision !== undefined &&
        metrics.citationPrecision !== null &&
        metrics.citationPrecision < 1
      )
        failures.push('La cita no implica el claim');
      if (
        metrics.completeness !== undefined &&
        metrics.completeness !== null &&
        metrics.completeness < 1
      )
        failures.push('Faltan hechos esperados');
      report.cases.push({
        case: c,
        result,
        metrics,
        failures,
        ...(judges ? { judges } : {}),
      });
    } catch (e) {
      report.cases.push({
        case: c,
        result: null,
        metrics: {},
        failures: ['Error de ejecución'],
        error: e instanceof Error ? e.message : 'Error',
      });
    }
  };
  await Promise.all(
    Array.from({ length: options.concurrency ?? 3 }, async () => {
      while (queue.length) {
        const c = queue.shift();
        if (c) await runCase(c);
      }
    }),
  );
  report.cases.sort(
    (a, b) => options.dataset.cases.indexOf(a.case) - options.dataset.cases.indexOf(b.case),
  );
  report.metrics = aggregate(report.cases);
  for (const category of new Set(report.cases.map((c) => c.case.metadata.category)))
    report.categories[category] = aggregate(
      report.cases.filter((c) => c.case.metadata.category === category),
    );
  await mkdir(runsDir, { recursive: true });
  await writeFile(path.join(runsDir, report.id + '.json'), JSON.stringify(report, null, 2));
  await writeFile(path.join(runsDir, report.id + '.md'), formatReport(report));
  if (process.env.DATABASE_URL) await db().insert(experiments).values({ id: report.id, report });
  return report;
}

export const thresholds = {
  recall5Drop: 0.03,
  faithfulness: 0.97,
  citationPrecision: 0.97,
  wrongJurisdiction: 0.03,
};
export function regressionGate(r: Report, b?: Report, limits = thresholds): string[] {
  const reasons: string[] = [];
  if (r.metadata.mode !== 'live') reasons.push('La vista previa no certifica producción');
  if (r.metadata.reviewedCases !== r.metadata.totalCases)
    reasons.push('Hay casos sin revisión humana');
  if (!b?.approved) reasons.push('Falta baseline aprobado');
  if (r.cases.some((c) => c.error)) reasons.push('Hay errores de ejecución');
  if (r.cases.some((c) => c.case.critical && c.failures.length))
    reasons.push('Falla un caso crítico');
  if (
    r.cases.some((c) => c.case.expected.shouldAnswer && !c.case.expected.relevantDocumentIds.length)
  )
    reasons.push('Faltan documentos gold');
  if (
    r.metrics.wrongJurisdiction === null ||
    (r.metrics.wrongJurisdiction ?? 1) > limits.wrongJurisdiction
  )
    reasons.push('Wrong-jurisdiction supera el umbral');
  if (!r.metadata.retrievalOnly) {
    for (const k of ['faithfulness', 'citationPrecision'] as const) {
      if (r.metrics[k] == null || r.metrics[k] < limits[k])
        reasons.push(k + ' ausente o inferior al umbral');
    }
    if (!r.metadata.judges) reasons.push('Faltan evaluadores semánticos');
  }
  if (b) {
    const comparison = compareReports(r, b);
    if ((comparison.deltas.recall5 ?? -1) < -limits.recall5Drop)
      reasons.push('Recall@5 cae más de ' + limits.recall5Drop * 100 + 'pp');
  }
  return reasons;
}
export function formatReport(r: Report): string {
  const metric = Object.entries(r.metrics)
    .map(
      ([k, v]) =>
        `${k.padEnd(26)} ${v === null ? 'N/A' : /Latency|tokens/.test(k) ? v.toFixed(1) : k === 'costUsd' ? '$' + v.toFixed(5) : (v * 100).toFixed(1) + '%'}`,
    )
    .join('\n');
  return (
    `GOV SEARCH EVAL\nDataset: ${r.metadata.datasetVersion}\nCases: ${r.cases.length}\nMode: ${r.metadata.mode}\nHuman reviewed: ${r.metadata.reviewedCases}\nRun: ${r.id}\n${metric}\n\nFAILURES\n` +
    r.cases
      .filter((c) => c.failures.length)
      .map(
        (c) =>
          `\nQuery: ${c.case.query}\nExpected sources: ${c.case.expected.relevantSourceIds.join(', ')}\nExpected documents: ${c.case.expected.relevantDocumentIds.join(', ') || 'PENDING REVIEW'}\nRetrieved:\n${c.result?.evidence.map((e, i) => `${i + 1}. ${e.title} (${e.jurisdiction}) ${e.canonicalUrl}`).join('\n') ?? 'ERROR'}\nAnswer: ${JSON.stringify(c.result?.answer)}\nFailure: ${c.failures.join('; ')} ${c.error ?? ''}\nJudge detail: ${JSON.stringify(c.judges ?? {})}`,
      )
      .join('\n')
  );
}
