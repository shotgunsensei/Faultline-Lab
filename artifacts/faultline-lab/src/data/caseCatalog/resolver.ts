import type { CaseDefinition } from '@/types';
import { CASE_DEFINITIONS } from '@/data/cases';
import { CASE_BY_ID } from './selectors';
import type { CaseCatalogEntry } from './types';

export function resolveCaseDefinition(entry: CaseCatalogEntry): CaseDefinition | undefined {
  if (!entry.implementationRef) return undefined;
  return CASE_DEFINITIONS[entry.implementationRef];
}

export function resolveCaseDefinitionByEntryId(entryId: string): CaseDefinition | undefined {
  const entry = CASE_BY_ID.get(entryId);
  if (!entry) return undefined;
  return resolveCaseDefinition(entry);
}
