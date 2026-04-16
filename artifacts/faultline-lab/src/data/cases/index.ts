import { windowsAdCase } from './windows-ad-case';
import { networkingVpnCase } from './networking-vpn-case';
import { automotiveCase } from './automotive-case';
import { electronicsSensorCase } from './electronics-sensor-case';
import type { CaseDefinition } from '@/types';

export const allCases: CaseDefinition[] = [
  windowsAdCase,
  networkingVpnCase,
  automotiveCase,
  electronicsSensorCase,
];

export function getCaseById(id: string): CaseDefinition | undefined {
  return allCases.find(c => c.id === id);
}

export function getCasesByCategory(category: string): CaseDefinition[] {
  return allCases.filter(c => c.category === category);
}

export const categoryLabels: Record<string, string> = {
  'windows-ad': 'Windows / Active Directory',
  'networking': 'Networking / VPN',
  'automotive': 'Automotive Diagnostics',
  'electronics': 'Electronics / Sensor Mesh',
  'servers': 'Servers / Services',
  'mixed': 'Mixed Systems',
};

export const difficultyColors: Record<string, string> = {
  beginner: 'text-green-400',
  intermediate: 'text-yellow-400',
  advanced: 'text-orange-400',
  expert: 'text-red-400',
};

export const categoryIcons: Record<string, string> = {
  'windows-ad': 'Monitor',
  'networking': 'Network',
  'automotive': 'Car',
  'electronics': 'Cpu',
  'servers': 'Server',
  'mixed': 'Layers',
};
