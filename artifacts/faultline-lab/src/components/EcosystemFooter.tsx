import { ExternalLink } from 'lucide-react';

interface EcosystemLink {
  name: string;
  href: string;
  blurb: string;
}

const ECOSYSTEM_LINKS: EcosystemLink[] = [
  { name: 'ShotgunNinjas.com', href: 'https://shotgunninjas.com', blurb: 'Studio hub' },
  { name: 'TorqueShed.pro', href: 'https://torqueshed.pro', blurb: 'Auto diagnostics' },
  { name: 'TradeFlowKit.com', href: 'https://tradeflowkit.com', blurb: 'Ops & revenue' },
  { name: 'TechDeck.app', href: 'https://techdeck.app', blurb: 'IT cockpit' },
  { name: 'PulseDesk.support', href: 'https://pulsedesk.support', blurb: 'Healthcare ops' },
  { name: 'ShotgunNinjaVillage.com', href: 'https://shotgunninjavillage.com', blurb: 'Community' },
];

interface Props {
  variant?: 'full' | 'compact';
}

export default function EcosystemFooter({ variant = 'full' }: Props) {
  if (variant === 'compact') {
    return (
      <footer className="border-t border-zinc-800/40 px-4 sm:px-6 py-4 mt-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 flex-wrap text-xs text-zinc-500 font-mono">
          <span>
            Built by{' '}
            <a
              href="https://shotgunninjas.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-red-400/80 hover:text-red-300 transition-colors"
            >
              Shotgun Ninjas Productions
            </a>
          </span>
          <span className="text-zinc-600">FaultlineLab.com</span>
        </div>
      </footer>
    );
  }

  return (
    <footer className="border-t border-zinc-800/40 mt-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500/70" />
          <span className="text-[11px] uppercase tracking-[0.2em] text-zinc-500 font-mono">
            Shotgun Ninjas Ecosystem
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          {ECOSYSTEM_LINKS.map((link) => (
            <a
              key={link.name}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col gap-1 p-3 rounded border border-zinc-800/50 hover:border-red-500/30 bg-[#0d1219]/60 hover:bg-[#111822] transition-all"
            >
              <span className="text-xs text-zinc-200 group-hover:text-red-300 font-mono flex items-center gap-1.5 transition-colors">
                {link.name}
                <ExternalLink size={10} className="opacity-0 group-hover:opacity-60 transition-opacity" />
              </span>
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">
                {link.blurb}
              </span>
            </a>
          ))}
        </div>

        <div className="flex items-center justify-between gap-4 flex-wrap text-xs text-zinc-500 font-mono pt-4 border-t border-zinc-800/30">
          <span>
            Built by{' '}
            <a
              href="https://shotgunninjas.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-red-400/80 hover:text-red-300 transition-colors"
            >
              Shotgun Ninjas Productions
            </a>
          </span>
          <span className="text-zinc-600">
            FaultlineLab.com · Diagnostic training for technical minds
          </span>
        </div>
      </div>
    </footer>
  );
}
