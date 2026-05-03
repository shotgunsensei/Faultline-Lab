import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppStore } from '@/stores/useAppStore';
import {
  ArrowRight,
  Check,
  Search,
  Wrench,
  ClipboardCheck,
  Sparkles,
  X,
} from 'lucide-react';
import type { AppView } from '@/types';

type StepId = 'welcome' | 'pick-incident' | 'investigate' | 'debrief';

interface TourStep {
  id: StepId;
  title: string;
  body: string;
  /**
   * If set, this step is only eligible to render when the app is currently
   * showing this view. The tour shows the first eligible unseen step.
   */
  requiredView?: AppView;
  /** CSS selector resolved when the step is shown; null = centered card. */
  anchorSelector?: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
}

const STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Faultline Lab',
    body:
      'Faultline Lab drops you into broken systems. Read the briefing, run real commands, gather evidence, then submit your diagnosis. This quick tour walks you through the three screens you will use most.',
    requiredView: 'incident-board',
    icon: Sparkles,
  },
  {
    id: 'pick-incident',
    title: 'Step 1 — Pick an incident',
    body:
      'Every card on this board is a self-contained scenario with its own briefing, telemetry, and scoring rubric. Click a playable card to begin — the four free starters are a good place to learn the rhythm.',
    requiredView: 'incident-board',
    anchorSelector: '[data-tour="case-grid"]',
    icon: Search,
  },
  {
    id: 'investigate',
    title: 'Step 2 — Run the investigation',
    body:
      'This is your investigation workspace. Use the terminal, event logs, and ticket history on the left; pin findings to the evidence locker on the right. The scoring engine rewards efficient diagnostics.',
    requiredView: 'investigation',
    anchorSelector: '[data-tour="investigation-workspace"]',
    icon: Wrench,
  },
  {
    id: 'debrief',
    title: 'Step 3 — Review your debrief',
    body:
      'After you submit a diagnosis, the debrief screen breaks down what you got right, what you missed, and where to improve next time. Replay the case any time to chase a higher tier.',
    requiredView: 'debrief',
    anchorSelector: '[data-tour="debrief-summary"]',
    icon: ClipboardCheck,
  },
];

interface AnchorRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function readAnchorRect(selector?: string): AnchorRect | null {
  if (!selector) return null;
  const el = document.querySelector(selector) as HTMLElement | null;
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return null;
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

interface OnboardingTourProps {
  open: boolean;
  /**
   * Called whenever the user finishes the last step or explicitly dismisses
   * (Esc / backdrop / Skip / X). Per spec, any dismissal is remembered so the
   * tour does not replay until the user invokes the Replay action.
   */
  onClose: () => void;
}

export default function OnboardingTour({ open, onClose }: OnboardingTourProps) {
  const view = useAppStore((s) => s.view);
  const [seen, setSeen] = useState<Set<StepId>>(() => new Set());
  const [anchorRect, setAnchorRect] = useState<AnchorRect | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const primaryActionRef = useRef<HTMLButtonElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  // Reset the seen-set whenever the tour transitions from closed -> open so
  // a Replay action restarts cleanly.
  useEffect(() => {
    if (open) setSeen(new Set());
  }, [open]);

  // The currently displayable step: first not-yet-seen step whose required
  // view matches (or has none). When nothing matches the current view, the
  // overlay hides itself and waits for the user to navigate.
  const step = useMemo<TourStep | null>(() => {
    if (!open) return null;
    for (const s of STEPS) {
      if (seen.has(s.id)) continue;
      if (s.requiredView && s.requiredView !== view) continue;
      return s;
    }
    return null;
  }, [open, seen, view]);

  const isLastUnseen = useMemo(() => {
    if (!step) return false;
    // True iff no other unseen step exists after this one.
    const idx = STEPS.findIndex((s) => s.id === step.id);
    for (let i = idx + 1; i < STEPS.length; i++) {
      if (!seen.has(STEPS[i].id)) return false;
    }
    return true;
  }, [step, seen]);

  useLayoutEffect(() => {
    if (!open || !step) {
      setAnchorRect(null);
      return;
    }
    const measure = () => setAnchorRect(readAnchorRect(step.anchorSelector));
    const raf = requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [open, step]);

  // Focus management: capture previous focus on open, move focus to primary
  // action on each step, restore focus on close.
  useEffect(() => {
    if (!open) return;
    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => {
      const prev = previouslyFocusedRef.current;
      if (prev && document.contains(prev)) prev.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open || !step) return;
    const raf = requestAnimationFrame(() => primaryActionRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [open, step]);

  useEffect(() => {
    if (!open || !step) return;
    const advance = () => {
      const nextSeen = new Set(seen);
      nextSeen.add(step.id);
      setSeen(nextSeen);
      if (isLastUnseen) closeRef.current();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeRef.current();
        return;
      }
      // Enter is left to native button activation to avoid double-firing.
      if (e.key === 'ArrowRight') {
        advance();
        return;
      }
      if (e.key === 'Tab') {
        const root = dialogRef.current;
        if (!root) return;
        const focusables = root.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, step, seen, isLastUnseen]);

  if (!open || !step) return null;

  const Icon = step.icon;

  // Position the card: prefer below the anchor; otherwise center it.
  const cardStyle: React.CSSProperties = (() => {
    if (!anchorRect) {
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 420,
        maxWidth: 'calc(100vw - 32px)',
      };
    }
    const cardWidth = 420;
    const margin = 16;
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const preferredLeft = Math.min(
      Math.max(anchorRect.left + anchorRect.width / 2 - cardWidth / 2, margin),
      viewportW - cardWidth - margin,
    );
    const spaceBelow = viewportH - (anchorRect.top + anchorRect.height);
    const placeBelow = spaceBelow > 240;
    const top = placeBelow
      ? anchorRect.top + anchorRect.height + 16
      : Math.max(anchorRect.top - 240, margin);
    return {
      top,
      left: preferredLeft,
      width: cardWidth,
      maxWidth: `calc(100vw - ${margin * 2}px)`,
    };
  })();

  // Step counter (1-indexed) reflects the canonical 4-step order, not the
  // dynamic seen-set, so the user always sees a stable "n / total" label.
  const stepNumber = STEPS.findIndex((s) => s.id === step.id) + 1;

  const advance = () => {
    const nextSeen = new Set(seen);
    nextSeen.add(step.id);
    setSeen(nextSeen);
    if (isLastUnseen) onClose();
  };

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-[100] pointer-events-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-tour-title"
    >
      <button
        type="button"
        aria-label="Dismiss tour"
        tabIndex={-1}
        onClick={() => onClose()}
        className="absolute inset-0 w-full h-full bg-black/70 backdrop-blur-[2px]"
      />

      <AnimatePresence>
        {anchorRect && (
          <motion.div
            key={`spot-${step.id}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute rounded-lg ring-2 ring-cyan-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]"
            style={{
              top: anchorRect.top - 6,
              left: anchorRect.left - 6,
              width: anchorRect.width + 12,
              height: anchorRect.height + 12,
            }}
          />
        )}
      </AnimatePresence>

      <motion.div
        key={`card-${step.id}`}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="absolute bg-[#0d131c] border border-cyan-500/40 rounded-lg shadow-xl shadow-cyan-500/10 p-5 font-sans"
        style={cardStyle}
      >
        <div className="flex items-start gap-3 mb-3">
          <div className="p-2 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 shrink-0">
            <Icon size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-mono uppercase tracking-widest text-cyan-400/80 mb-0.5">
              Tour · {stepNumber} / {STEPS.length}
            </div>
            <h2
              id="onboarding-tour-title"
              className="text-base font-semibold text-zinc-100 leading-snug"
            >
              {step.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onClose()}
            aria-label="Skip tour"
            className="text-zinc-500 hover:text-zinc-200 transition-colors p-1 rounded focus:outline-none focus:ring-2 focus:ring-cyan-400"
          >
            <X size={14} />
          </button>
        </div>

        <p className="text-sm text-zinc-400 leading-relaxed mb-4">{step.body}</p>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            {STEPS.map((s) => {
              const isCurrent = s.id === step.id;
              const isDone = seen.has(s.id);
              return (
                <span
                  key={s.id}
                  className={`h-1.5 w-5 rounded-full transition-colors ${
                    isCurrent ? 'bg-cyan-400' : isDone ? 'bg-emerald-500/60' : 'bg-zinc-700'
                  }`}
                />
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onClose()}
              className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1.5 rounded focus:outline-none focus:ring-2 focus:ring-cyan-400"
            >
              Skip
            </button>
            {isLastUnseen ? (
              <button
                ref={primaryActionRef}
                type="button"
                onClick={advance}
                className="text-[11px] font-mono uppercase tracking-wider text-emerald-200 bg-emerald-500/15 border border-emerald-500/40 hover:bg-emerald-500/25 transition-colors px-3 py-1.5 rounded flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              >
                <Check size={12} />
                Finish
              </button>
            ) : (
              <button
                ref={primaryActionRef}
                type="button"
                onClick={advance}
                className="text-[11px] font-mono uppercase tracking-wider text-cyan-200 bg-cyan-500/15 border border-cyan-500/40 hover:bg-cyan-500/25 transition-colors px-3 py-1.5 rounded flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-cyan-400"
              >
                Next
                <ArrowRight size={12} />
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

