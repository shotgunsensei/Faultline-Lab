import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppStore } from '@/stores/useAppStore';
import { ArrowRight, Check, Search, Wrench, ClipboardCheck, X } from 'lucide-react';

type StepId = 'welcome' | 'pick-incident' | 'investigate' | 'debrief';

interface TourStep {
  id: StepId;
  title: string;
  body: string;
  anchorSelector?: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
}

const STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Faultline Lab',
    body:
      'Faultline Lab drops you into broken systems. Read the briefing, run real commands, gather evidence, then submit your diagnosis. This quick tour shows you the three things to learn first.',
    icon: Search,
  },
  {
    id: 'pick-incident',
    title: 'Step 1 — Pick an incident',
    body:
      'Every card on this board is a self-contained scenario with its own briefing, telemetry, and scoring rubric. Click a playable card to begin. The four free starters are a good place to learn the rhythm.',
    anchorSelector: '[data-tour="case-grid"]',
    icon: Search,
  },
  {
    id: 'investigate',
    title: 'Step 2 — Run the investigation',
    body:
      'Inside a case you get a terminal, event logs, and an evidence locker. Issue real commands, pin findings to the locker, and watch your action log build. The scoring engine rewards efficient diagnostics.',
    icon: Wrench,
  },
  {
    id: 'debrief',
    title: 'Step 3 — Submit and debrief',
    body:
      'When you are confident, open the diagnosis form and lock in your call. The debrief screen breaks down what you got right, what you missed, and where to improve next time.',
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
   * Called whenever the tour is finished, skipped, or dismissed via Esc /
   * backdrop click. Per spec, any dismissal is remembered so the tour never
   * replays unless the user explicitly invokes the Replay action.
   */
  onClose: () => void;
}

export default function OnboardingTour({ open, onClose }: OnboardingTourProps) {
  const [stepIdx, setStepIdx] = useState(0);
  const [anchorRect, setAnchorRect] = useState<AnchorRect | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const primaryActionRef = useRef<HTMLButtonElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  const step = STEPS[stepIdx];
  const isLast = stepIdx === STEPS.length - 1;

  useEffect(() => {
    if (open) setStepIdx(0);
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    const measure = () => setAnchorRect(readAnchorRect(step.anchorSelector));
    // Defer one frame so DOM is settled (e.g. after view transitions).
    const raf = requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [open, step.anchorSelector, stepIdx]);

  // Focus management: capture the previously focused element on open,
  // move focus to the primary action, and restore focus on close.
  useEffect(() => {
    if (!open) return;
    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // Defer one frame so the button is in the DOM.
    const raf = requestAnimationFrame(() => {
      primaryActionRef.current?.focus();
    });
    return () => {
      cancelAnimationFrame(raf);
      const prev = previouslyFocusedRef.current;
      if (prev && document.contains(prev)) prev.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    // Move focus to the primary action whenever the step changes so screen
    // readers announce the new content and keyboard users land on Next/Finish.
    const raf = requestAnimationFrame(() => {
      primaryActionRef.current?.focus();
    });
    return () => cancelAnimationFrame(raf);
  }, [open, stepIdx]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeRef.current();
        return;
      }
      // Enter is intentionally not handled here — the focused primary
      // button (Next/Finish) already activates on Enter natively, so
      // intercepting it would double-fire and skip steps.
      if (e.key === 'ArrowRight') {
        if (isLast) closeRef.current();
        else setStepIdx((i) => Math.min(i + 1, STEPS.length - 1));
        return;
      }
      if (e.key === 'ArrowLeft') {
        setStepIdx((i) => Math.max(i - 1, 0));
        return;
      }
      // Focus trap: keep Tab within the dialog so the dim background can't
      // be reached while the modal is open.
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
  }, [open, isLast]);

  if (!open) return null;

  const Icon = step.icon;

  // Position the card: prefer below the anchor; fall back to centered.
  const cardStyle: React.CSSProperties = (() => {
    if (!anchorRect) {
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
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

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-[100] pointer-events-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-tour-title"
    >
      {/* Dim backdrop. Clicking dismisses (and per spec, marks remembered). */}
      <button
        type="button"
        aria-label="Dismiss tour"
        tabIndex={-1}
        onClick={() => onClose()}
        className="absolute inset-0 w-full h-full bg-black/70 backdrop-blur-[2px]"
      />

      {/* Spotlight ring around the anchor. */}
      <AnimatePresence>
        {anchorRect && (
          <motion.div
            key={`spot-${stepIdx}`}
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

      {/* Tour card */}
      <motion.div
        key={`card-${stepIdx}`}
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
              Tour · {stepIdx + 1} / {STEPS.length}
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
            {STEPS.map((s, i) => (
              <span
                key={s.id}
                className={`h-1.5 w-5 rounded-full transition-colors ${
                  i === stepIdx
                    ? 'bg-cyan-400'
                    : i < stepIdx
                      ? 'bg-emerald-500/60'
                      : 'bg-zinc-700'
                }`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onClose()}
              className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1.5 rounded focus:outline-none focus:ring-2 focus:ring-cyan-400"
            >
              Skip
            </button>
            {stepIdx > 0 && (
              <button
                type="button"
                onClick={() => setStepIdx((i) => Math.max(i - 1, 0))}
                className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 hover:text-zinc-200 transition-colors px-3 py-1.5 rounded border border-zinc-700 hover:border-zinc-600 focus:outline-none focus:ring-2 focus:ring-cyan-400"
              >
                Back
              </button>
            )}
            {isLast ? (
              <button
                ref={primaryActionRef}
                type="button"
                onClick={() => onClose()}
                className="text-[11px] font-mono uppercase tracking-wider text-emerald-200 bg-emerald-500/15 border border-emerald-500/40 hover:bg-emerald-500/25 transition-colors px-3 py-1.5 rounded flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              >
                <Check size={12} />
                Finish
              </button>
            ) : (
              <button
                ref={primaryActionRef}
                type="button"
                onClick={() => setStepIdx((i) => Math.min(i + 1, STEPS.length - 1))}
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

/**
 * Convenience hook: reads/writes the onboarding completion flag from
 * AppSettings. Settings are persisted via the existing localStorage layer
 * for guests and pushed to the server through CloudSyncProvider for
 * signed-in users, so this works in both modes without extra plumbing.
 */
export function useOnboardingTour() {
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);

  const isCompleted = !!settings.onboardingTourCompletedAt;

  return {
    isCompleted,
    markCompleted: () =>
      updateSettings({ onboardingTourCompletedAt: Date.now() }),
    reset: () => updateSettings({ onboardingTourCompletedAt: null }),
  };
}
