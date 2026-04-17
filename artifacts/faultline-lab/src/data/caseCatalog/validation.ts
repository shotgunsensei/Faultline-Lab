import { CASE_CATALOG_ENTRIES } from './entries';
import { CATALOG } from '@/data/catalog';

export interface CatalogValidationIssue {
  level: 'error' | 'warning';
  code: string;
  message: string;
  caseId?: string;
  productId?: string;
}

export function validateCaseCatalog(): CatalogValidationIssue[] {
  const issues: CatalogValidationIssue[] = [];
  const seenIds = new Set<string>();
  const seenSlugs = new Set<string>();
  const productIds = new Set(CATALOG.map((p) => p.id));

  for (const entry of CASE_CATALOG_ENTRIES) {
    if (seenIds.has(entry.id)) {
      issues.push({
        level: 'error',
        code: 'duplicate-case-id',
        caseId: entry.id,
        message: `Duplicate case id: ${entry.id}`,
      });
    }
    seenIds.add(entry.id);

    if (seenSlugs.has(entry.slug)) {
      issues.push({
        level: 'error',
        code: 'duplicate-case-slug',
        caseId: entry.id,
        message: `Duplicate case slug: ${entry.slug}`,
      });
    }
    seenSlugs.add(entry.slug);

    if (!entry.title || !entry.shortSummary || !entry.mobileSummary) {
      issues.push({
        level: 'error',
        code: 'missing-summary',
        caseId: entry.id,
        message: `Case ${entry.id} missing required title/summary fields`,
      });
    }

    if (!productIds.has(entry.sourceProductId)) {
      issues.push({
        level: 'error',
        code: 'missing-source-product',
        caseId: entry.id,
        productId: entry.sourceProductId,
        message: `Case ${entry.id} references missing product ${entry.sourceProductId}`,
      });
    }

    if (entry.isStarter && entry.sourceType !== 'starter') {
      issues.push({
        level: 'warning',
        code: 'starter-source-mismatch',
        caseId: entry.id,
        message: `Case ${entry.id} is marked starter but sourceType is ${entry.sourceType}`,
      });
    }

    if (entry.sourceType === 'pack' && entry.isStarter) {
      issues.push({
        level: 'error',
        code: 'paid-as-starter',
        caseId: entry.id,
        message: `Pack-sourced case ${entry.id} cannot be starter`,
      });
    }

    if (entry.status === 'playable' && !entry.implementationRef) {
      issues.push({
        level: 'error',
        code: 'playable-without-impl',
        caseId: entry.id,
        message: `Playable case ${entry.id} has no implementationRef`,
      });
    }

    if (entry.status === 'planned' && entry.implementationRef) {
      issues.push({
        level: 'warning',
        code: 'planned-with-impl',
        caseId: entry.id,
        message: `Planned case ${entry.id} has implementationRef ${entry.implementationRef} — promote to status:'playable'`,
      });
    }
  }

  // Pack-side validations: each content pack should reference real cases.
  const productCaseCounts = new Map<string, number>();
  for (const entry of CASE_CATALOG_ENTRIES) {
    productCaseCounts.set(
      entry.sourceProductId,
      (productCaseCounts.get(entry.sourceProductId) || 0) + 1
    );
  }

  for (const product of CATALOG) {
    if (product.entitlementType !== 'content-pack') continue;
    const mapped = productCaseCounts.get(product.id) || 0;
    if (mapped === 0) {
      issues.push({
        level: 'error',
        code: 'pack-without-cases',
        productId: product.id,
        message: `Content pack ${product.id} has no mapped cases in the registry`,
      });
    }
    if (product.caseCount && product.caseCount !== mapped) {
      issues.push({
        level: 'warning',
        code: 'pack-count-mismatch',
        productId: product.id,
        message: `Pack ${product.id} advertises caseCount=${product.caseCount} but registry has ${mapped} entries`,
      });
    }
  }

  return issues;
}

export function logCatalogValidation(): void {
  const issues = validateCaseCatalog();
  if (issues.length === 0) return;

  const errors = issues.filter((i) => i.level === 'error');
  const warnings = issues.filter((i) => i.level === 'warning');

  if (errors.length > 0) {
    // eslint-disable-next-line no-console
    console.error(
      `[case-catalog] ${errors.length} error(s) and ${warnings.length} warning(s) detected:`,
      issues
    );
    if (import.meta.env.DEV) {
      throw new Error(
        `Case catalog validation failed: ${errors.map((e) => e.message).join('; ')}`
      );
    }
  } else if (warnings.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(`[case-catalog] ${warnings.length} warning(s) detected:`, warnings);
  }
}
