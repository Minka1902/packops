import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { ALL_MANIFESTS } from '@/modules/registry';

// The generator is plain CommonJS (runs on bare node); import it via createRequire.
const require = createRequire(import.meta.url);
const gen = require('../../../scripts/gen-rules.cjs') as typeof import('../../../scripts/gen-rules.cjs');

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const rulesPath = join(repoRoot, 'firestore.rules');
const snippetsDir = join(repoRoot, 'scripts', 'rules-snippets');

interface NormDM {
  collection: string;
  module: string;
  custom: boolean;
  legacyCaps: string[];
}
const norm = (dm: { collection: string; module: string; custom?: boolean; legacyCaps?: string[] }): NormDM => ({
  collection: dm.collection,
  module: dm.module,
  custom: dm.custom ?? false,
  legacyCaps: dm.legacyCaps ?? [],
});

function loadSnippets(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const file of readdirSync(snippetsDir)) {
    if (file.endsWith('.rules')) out[file.replace(/\.rules$/, '')] = readFileSync(join(snippetsDir, file), 'utf8');
  }
  return out;
}

describe('rules generator ↔ manifest sync', () => {
  it('gen-rules DATA_MODELS matches ALL_MANIFESTS[].dataModels', () => {
    const fromManifests = ALL_MANIFESTS.flatMap((m) => (m.dataModels ?? []).map(norm));
    expect((gen.MODULE_DATA_MODELS as NormDM[]).map(norm)).toEqual(fromManifests);
  });

  it('every custom collection has a snippet file', () => {
    const snippets = loadSnippets();
    for (const dm of gen.DATA_MODELS as NormDM[]) {
      if (dm.custom) expect(snippets[dm.collection], `snippet for ${dm.collection}`).toBeDefined();
    }
  });
});

describe('firestore.rules drift guard', () => {
  // Compare the rule text, not its packaging. Two things otherwise break this
  // guard on a clean checkout: git hands Windows CRLF while the generator emits
  // LF, and extractGeneratedRules keeps the blank lines that sit between the
  // markers and the first/last rule. Neither changes what Firestore enforces.
  const norm = (s: string) => s.replace(/\r/g, '').trim();

  it('committed generated block equals generator output (run `npm run gen:rules`)', () => {
    const rules = readFileSync(rulesPath, 'utf8');
    const expected = gen.generateModuleRules(gen.DATA_MODELS, loadSnippets());
    expect(norm(gen.extractGeneratedRules(rules))).toBe(norm(expected));
  });

  it('the v2 rule helpers are present', () => {
    const rules = readFileSync(rulesPath, 'utf8');
    for (const helper of ['function hasModule(', 'function hasPerm(', 'function can(']) {
      expect(rules).toContain(helper);
    }
  });
});
