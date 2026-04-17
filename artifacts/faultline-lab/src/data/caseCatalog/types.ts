import type { CaseCategory, Difficulty } from '@/types';

export type CaseSourceType = 'starter' | 'pack';

export type CaseCatalogStatus = 'playable' | 'planned' | 'disabled';

export type CaseAccessModel = 'free' | 'pack' | 'pro' | 'bundle';

export type RedHerringLevel = 'low' | 'medium' | 'high';

export interface CaseCatalogEntry {
  id: string;
  slug: string;
  title: string;
  shortSummary: string;
  mobileSummary: string;
  category: CaseCategory;
  difficulty: Difficulty;
  estimatedMinutes: number;
  sourceType: CaseSourceType;
  status: CaseCatalogStatus;
  accessModel: CaseAccessModel;
  sourceProductId: string;
  requiredEntitlements: string[];
  requiredToolSlugs: string[];
  previewSymptoms: string[];
  previewSystems: string[];
  redHerringLevel: RedHerringLevel;
  implementationRef?: string;
  definitionRef?: string;
  tags: string[];
  isStarter: boolean;
  isFeatured: boolean;
  isDailyEligible: boolean;
  isSandboxEligible: boolean;
  sortOrder: number;
}

export interface CaseCardState {
  entry: CaseCatalogEntry;
  owned: boolean;
  playable: boolean;
  locked: boolean;
  comingSoon: boolean;
  requiredProductId: string | null;
}
