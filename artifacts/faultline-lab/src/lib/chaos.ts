export interface ChaosSettings {
  shuffleEvidence: boolean;
  injectRedHerrings: boolean;
  timePressure: boolean;
  hintBlackout: boolean;
  intensity: number;
}

export const DEFAULT_CHAOS: ChaosSettings = {
  shuffleEvidence: false,
  injectRedHerrings: false,
  timePressure: false,
  hintBlackout: false,
  intensity: 1,
};

const STORAGE_KEY = 'faultline-lab-chaos-settings';

export function loadChaosSettings(caseId: string): ChaosSettings {
  if (typeof localStorage === 'undefined') return DEFAULT_CHAOS;
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}:${caseId}`);
    if (!raw) return DEFAULT_CHAOS;
    return { ...DEFAULT_CHAOS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_CHAOS;
  }
}

export function saveChaosSettings(caseId: string, settings: ChaosSettings) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(`${STORAGE_KEY}:${caseId}`, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
}

export function isChaosActive(chaos: ChaosSettings | undefined | null): boolean {
  if (!chaos) return false;
  return (
    chaos.shuffleEvidence ||
    chaos.injectRedHerrings ||
    chaos.timePressure ||
    chaos.hintBlackout ||
    chaos.intensity > 1
  );
}

export function countActiveToggles(chaos: ChaosSettings | undefined | null): number {
  if (!chaos) return 0;
  return (
    (chaos.shuffleEvidence ? 1 : 0) +
    (chaos.injectRedHerrings ? 1 : 0) +
    (chaos.timePressure ? 1 : 0) +
    (chaos.hintBlackout ? 1 : 0)
  );
}

export function chaosTimeLimitMs(chaos: ChaosSettings | undefined | null): number | undefined {
  if (!chaos || !chaos.timePressure) return undefined;
  const intensity = Math.max(1, chaos.intensity);
  return Math.round(600_000 / intensity);
}

export function computeChaosMultiplier(chaos: ChaosSettings | undefined | null): number {
  if (!isChaosActive(chaos)) return 1;
  const intensityBoost = (chaos!.intensity - 1) * 0.25;
  const toggleBoost = countActiveToggles(chaos) * 0.05;
  return Math.max(1, 1 + intensityBoost + toggleBoost);
}
