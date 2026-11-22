import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { configSchema } from '@reforma-digital/core';
import { closeDb } from '@reforma-digital/db';
import {
  loadDataset,
  runExperiment,
  formatReport,
  compareReports,
  regressionGate,
  repoRoot,
  type Report,
} from './index';
import { categorySchema } from './schema';
const args = process.argv.slice(2).filter((a) => a !== '--');
const value = (key: string, fallback: string) => {
  const i = args.indexOf(key);
  if (i < 0) return fallback;
  const v = args[i + 1];
  if (!v || v.startsWith('--')) throw new Error('Falta valor para ' + key);
  return v;
};
try {
  const known = [
    '--dataset',
    '--category',
    '--retrieval-only',
    '--compare',
    '--config',
    '--mode',
    '--judges',
    '--ci',
    '--limit',
    '--save-baseline',
    '--thresholds',
    '--concurrency',
  ];
  for (const arg of args)
    if (arg.startsWith('--') && !known.includes(arg)) throw new Error('Opción desconocida: ' + arg);
  const dataset = await loadDataset(value('--dataset', 'full'));
  const category = value('--category', '');
  if (category)
    dataset.cases = dataset.cases.filter(
      (c) => c.metadata.category === categorySchema.parse(category),
    );
  const limit = Number(value('--limit', '150'));
  if (!Number.isInteger(limit) || limit < 1) throw new Error('--limit inválido');
  dataset.cases = dataset.cases.slice(0, limit);
  const mode = value('--mode', process.env.SEARCH_MODE === 'live' ? 'live' : 'preview');
  if (mode !== 'live' && mode !== 'preview') throw new Error('--mode debe ser live o preview');
  if (mode === 'live' && !(process.env.NAN_API_KEY && process.env.EXA_API_KEY))
    throw new Error(
      'Modo live requiere NAN_API_KEY y EXA_API_KEY. Usa --mode preview --retrieval-only para verificar el runner sin simular calidad de producción.',
    );
  const configPath = value('--config', '');
  const config = configSchema.parse(
    configPath ? JSON.parse(await readFile(configPath, 'utf8')) : {},
  );
  const report = await runExperiment({
    dataset,
    config,
    mode,
    retrievalOnly: args.includes('--retrieval-only') || mode === 'preview',
    judges: args.includes('--judges'),
    concurrency: Math.min(5, Math.max(1, Number(value('--concurrency', '3')) || 3)),
  });
  console.log(formatReport(report));
  let baseline: Report | undefined;
  if (args.includes('--compare')) {
    const name = value('--compare', 'baseline');
    const p =
      name === 'baseline' ? path.join(repoRoot, 'packages/evals/baselines/baseline.json') : name;
    baseline = JSON.parse(await readFile(p, 'utf8')) as Report;
    console.log('\nVS BASELINE\n' + JSON.stringify(compareReports(report, baseline), null, 2));
  }
  if (args.includes('--save-baseline')) {
    const existing = await readFile(
      path.join(repoRoot, 'packages/evals/baselines/baseline.json'),
      'utf8',
    ).catch((error: unknown) => {
      // Todavía no hay baseline: se guarda el primero.
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null;
      throw error;
    });
    if (existing && JSON.parse(existing).approved)
      throw new Error(
        'No se sobrescribe un baseline aprobado. Guarda el experimento y propón su revisión.',
      );
    await mkdir(path.join(repoRoot, 'packages/evals/baselines'), {
      recursive: true,
    });
    await writeFile(
      path.join(repoRoot, 'packages/evals/baselines/baseline.json'),
      JSON.stringify(report, null, 2),
    );
    console.log('Baseline provisional guardado: approved=false. No certifica producción.');
  }
  if (args.includes('--ci')) {
    const file = value('--thresholds', '');
    const thresholds = file ? JSON.parse(await readFile(file, 'utf8')) : undefined;
    const failures = regressionGate(report, baseline, thresholds);
    if (failures.length) {
      console.error('\nCI BLOCKED\n' + failures.join('\n'));
      process.exitCode = 1;
    }
  }
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await closeDb();
}
