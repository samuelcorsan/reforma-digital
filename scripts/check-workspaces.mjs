import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { readSites } from './sites.mjs';

const projects = [];
for (const group of ['apps', 'packages', 'sites']) {
  for (const directory of await readdir(group, { withFileTypes: true })) {
    if (!directory.isDirectory()) continue;
    const root = path.resolve(group, directory.name);
    const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
    assert.equal(pkg.private, true, `${pkg.name} must be a private workspace`);
    projects.push({ group, root, pkg });
  }
}
assert.equal(
  new Set(projects.map((project) => project.pkg.name)).size,
  projects.length,
  'Workspace names must be unique',
);
const byName = new Map(projects.map((project) => [project.pkg.name, project]));
function allowed(source, target) {
  return (
    source === target ||
    target.group === 'packages' ||
    (source.group === 'apps' && target.group === 'sites')
  );
}
for (const project of projects) {
  const deps = {
    ...project.pkg.dependencies,
    ...project.pkg.peerDependencies,
    ...project.pkg.devDependencies,
  };
  for (const dependency of Object.keys(deps)) {
    if (!dependency.startsWith('@reforma-digital/')) continue;
    const target = byName.get(dependency);
    assert.ok(target, `${project.pkg.name}: unknown workspace ${dependency}`);
    assert.ok(allowed(project, target), `${project.pkg.name} cannot depend on ${dependency}`);
  }
  for (const file of await readdir(project.root, { recursive: true })) {
    // readdir(recursive) une las rutas con path.sep: en Windows, node_modules llega con '\' y no se saltaba.
    if (!/\.(ts|tsx)$/.test(file) || file.startsWith(`node_modules${path.sep}`)) continue;
    const absolute = path.join(project.root, file);
    const source = await readFile(absolute, 'utf8');
    for (const match of source.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)['"]([^'"]+)['"]/g)) {
      const specifier = match[1];
      if (specifier.startsWith('@reforma-digital/')) {
        const name = specifier.split('/').slice(0, 2).join('/');
        assert.ok(deps[name], `${project.pkg.name}/${file}: declare dependency ${name}`);
      } else if (specifier.startsWith('.')) {
        const destination = path.resolve(path.dirname(absolute), specifier);
        const target = projects.find((item) => destination.startsWith(item.root + path.sep));
        assert.ok(
          !target || target === project,
          `${project.pkg.name}/${file}: import other workspaces through their package exports`,
        );
      }
    }
  }
  if (project.group === 'sites') {
    for (const entry of [
      'site.config.json',
      'src/adapter.ts',
      'src/pages/index.ts',
      'src/components',
      'src/styles',
      'fixtures',
      'tests',
      'README.md',
    ]) {
      const { stat } = await import('node:fs/promises');
      assert.ok(
        await stat(path.join(project.root, entry)),
        `${project.pkg.name}: missing ${entry}`,
      );
    }
  }
}
const activeSites = await readSites();
console.log(
  `${projects.length} workspaces checked. Active sites: ${activeSites.map((site) => site.id).join(', ') || 'none'}.`,
);
