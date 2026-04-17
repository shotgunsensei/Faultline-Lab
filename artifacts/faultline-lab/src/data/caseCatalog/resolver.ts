import type { CaseDefinition } from '@/types';
import { CASE_DEFINITIONS } from '@/data/cases';
import { CASE_BY_ID } from './selectors';
import type { CaseCatalogEntry } from './types';
import { getSandboxAuthoredCaseDef } from '@/lib/sandboxScenarios';

export function resolveCaseDefinition(entry: CaseCatalogEntry): CaseDefinition | undefined {
  if (!entry.implementationRef) return undefined;
  return CASE_DEFINITIONS[entry.implementationRef];
}

export function resolveCaseDefinitionByEntryId(entryId: string): CaseDefinition | undefined {
  const entry = CASE_BY_ID.get(entryId);
  if (entry) {
    const def = resolveCaseDefinition(entry);
    if (def) return def;
  }
  // Fall back to user-authored sandbox scenarios so authors can play their
  // own puzzles. Catalog cases always win when both exist.
  return getSandboxAuthoredCaseDef(entryId);
}
