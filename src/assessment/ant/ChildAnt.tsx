import { useCallback, useEffect, useRef, useState } from 'react';
import HoldToExit from '../../components/HoldToExit';
import { useChoiceInput, useConfirmInput, type ChoiceEvent } from '../../platform/input';
import { createRng } from '../../platform/rng';
import { deadlineAfter, isAbort, nextPaint, now, waitMs } from '../../platform/timing';
import type { AntConfig, AntScores, AssessmentQuality, Trial } from '../../data/schema';
import { ANT_CONFIG, ANT_TIMINGS } from './config';
import { generatePracticeBlock, generateTestBlock, type PlannedTrial } from './trials';
import { scoreAnt } from './scoring';
import Fish, { type FishStatus } from './Fish';

/**
 * Gehärteter Child ANT (Plan §5.1).
 *
 * Wissenschaftliche Eckpunkte:
 *  - Trial-Sequenz vollständig seeded (Prop `seed`) → reproduzierbar.
 *  - Target-Onset wird nach dem tatsächlichen Paint gestempelt (Double-rAF,
 *    `nextPaint()`); RT = Eingabe-Zeitstempel − Onset, beide auf der
 *    performance-Timeline. Eingaben vor dem Onset-Stempel werden verworfen.
 *  - Antwortfenster `deadlineAfter(onset, 1700 ms)` — läuft relativ zum
 *    Onset, nicht zur Aufrufzeit.
 *  - Feedback nur im Übungsblock; im Testblock füllt ein neutrales
 *    Post-Target-Intervall den Trial auf konstante ~4050 ms auf
 *    (d4 = total − verbraucht). Belohnung im Test nur block-weise (Pausen).
 *  - Vollständiges Trial-Log der Testblöcke; Scoring inkl. Exclusion-Regel.
 */

export interface AntRunResult {
  rngSeed: string;
  config: AntConfig;
  scores: AntScores;
  quality: AssessmentQuality;
  rawTrials: Trial[];
}

interface ChildAntProps {
  /** RNG-Seed des Laufs; wird unverändert in `rngSeed` zurückgegeben. */
  seed: string;
  onComplete: (result: AntRunResult) => void;
  onCancel: () => void;
}

type TrialPhase = 'fixation' | 'cue' | 'postcue' | 'target' | 'feedback' | 'iti';
type FeedbackKind = 'correct' | 'wrong' | 'missed';

type Display =
  | { kind: 'pause'; upcomingBlock: number }
  | {
      kind: 'trial';
      block: number; // 0 = Übung, 1..3 = Testblöcke
      trialIndex: number;
      trialCount: number;
      trial: PlannedTrial;
      phase: TrialPhase;
      feedback: FeedbackKind | null;
    };

function abortError(): DOMException {
  return new DOMException('ANT run aborted', 'AbortError');
}

export default function ChildAnt({ seed, onComplete, onCancel }: ChildAntProps) {
  const [display, setDisplay] = useState<Display>({ kind: 'pause', upcomingBlock: 0 });

  // Kommunikation zwischen Event-Handlern und dem async Trial-Loop:
  const pendingResponseRef = useRef<((e: ChoiceEvent) => void) | null>(null);
  const onsetRef = useRef<number | null>(null);
  const continueRef = useRef<(() => void) | null>(null);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // Dauerhaft aktiv: Der Onset-Filter (statt enabled-Toggling) stellt sicher,
  // dass ein schon vor dem Target gehaltener Arcade-Button beim Onset nicht
  // als neue Antwort zählt (Rising-Edge bleibt über Phasen hinweg erhalten).
  useChoiceInput(
    useCallback((e: ChoiceEvent) => {
      const onset = onsetRef.current;
      if (onset === null || e.timeStamp <= onset) return;
      const resolve = pendingResponseRef.current;
      if (resolve) {
        pendingResponseRef.current = null;
        resolve(e);
      }
    }, []),
  );

  useConfirmInput(
    useCallback(() => {
      continueRef.current?.();
    }, []),
    { enabled: display.kind === 'pause' },
  );

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;

    const awaitContinue = () =>
      new Promise<void>((resolve, reject) => {
        if (signal.aborted) {
          reject(abortError());
          return;
        }
        const onAbort = () => {
          continueRef.current = null;
          reject(abortError());
        };
        continueRef.current = () => {
          signal.removeEventListener('abort', onAbort);
          continueRef.current = null;
          resolve();
        };
        signal.addEventListener('abort', onAbort, { once: true });
      });

    const run = async () => {
      const rng = createRng(seed);
      const rawTrials: Trial[] = [];
      let testTrialIndex = 0;

      for (let block = 0; block <= ANT_CONFIG.testBlocks; block++) {
        setDisplay({ kind: 'pause', upcomingBlock: block });
        await awaitContinue();

        const planned = block === 0 ? generatePracticeBlock(rng) : generateTestBlock(rng);

        for (const [trialIndex, trial] of planned.entries()) {
          const trialStart = now();
          const base = { kind: 'trial', block, trialIndex, trialCount: planned.length, trial } as const;

          setDisplay({ ...base, phase: 'fixation', feedback: null });
          await waitMs(trial.fixationMs, signal);

          setDisplay({ ...base, phase: 'cue', feedback: null });
          await waitMs(ANT_TIMINGS.cueMs, signal);

          setDisplay({ ...base, phase: 'postcue', feedback: null });
          await waitMs(ANT_TIMINGS.postCueFixationMs, signal);

          // Antwort-Promise VOR dem Onset registrieren (keine Lücke zwischen
          // Stempel und Lauschen); Eingaben vor dem Stempel filtert der
          // Onset-Check im Handler.
          const responsePromise = new Promise<ChoiceEvent>((resolve) => {
            pendingResponseRef.current = resolve;
          });
          onsetRef.current = null;
          setDisplay({ ...base, phase: 'target', feedback: null });
          const onset = await nextPaint(signal);
          onsetRef.current = onset;

          const response = await Promise.race([
            responsePromise,
            deadlineAfter(onset, ANT_TIMINGS.targetMaxMs, signal).then(() => null),
          ]);
          onsetRef.current = null;
          pendingResponseRef.current = null;

          const rt = response ? response.timeStamp - onset : null;
          const correct = response ? response.choice === trial.targetDir : null;

          if (block > 0) {
            rawTrials.push({
              index: testTrialIndex++,
              block,
              cue: trial.cue,
              flanker: trial.flanker,
              position: trial.position,
              targetDir: trial.targetDir,
              responseDir: response ? response.choice : null,
              correct,
              rt,
              onsetTs: onset,
              fixationMs: trial.fixationMs,
            });
          }

          if (block === 0) {
            const feedback: FeedbackKind =
              correct === true ? 'correct' : correct === false ? 'wrong' : 'missed';
            setDisplay({ ...base, phase: 'feedback', feedback });
            await waitMs(ANT_TIMINGS.practiceFeedbackMs, signal);
          } else {
            const remainingMs = ANT_TIMINGS.totalTrialMs - (now() - trialStart);
            setDisplay({ ...base, phase: 'iti', feedback: null });
            await waitMs(Math.max(0, remainingMs), signal);
          }
        }
      }

      const { scores, quality } = scoreAnt(rawTrials);
      onCompleteRef.current({ rngSeed: seed, config: ANT_CONFIG, scores, quality, rawTrials });
    };

    run().catch((err: unknown) => {
      if (!isAbort(err)) {
        console.error('Child ANT: Lauf unerwartet abgebrochen', err);
      }
    });

    return () => controller.abort();
  }, [seed]);

  if (display.kind === 'pause') {
    return (
      <PauseScreen
        upcomingBlock={display.upcomingBlock}
        onContinue={() => continueRef.current?.()}
        onCancel={onCancel}
      />
    );
  }

  return <TrialScreen display={display} onCancel={onCancel} />;
}

function PauseScreen({
  upcomingBlock,
  onContinue,
  onCancel,
}: {
  upcomingBlock: number;
  onContinue: () => void;
  onCancel: () => void;
}) {
  const isIntro = upcomingBlock === 0;
  const isFirstTestBlock = upcomingBlock === 1;

  return (
    <div className="fixed inset-0 z-40 bg-sky-50 flex items-center justify-center">
      <HoldToExit onExit={onCancel} />
      <div className="text-center p-10 bg-white rounded-3xl shadow-sm border border-slate-100 max-w-xl mx-4">
        {isIntro ? (
          <>
            <div className="flex justify-center mb-6">
              <Fish direction="R" />
            </div>
            <h2 className="text-4xl font-bold text-slate-800 mb-4">Der Fischfang beginnt!</h2>
            <p className="text-xl text-slate-600 mb-3">
              Schau auf den <strong>mittleren</strong> Fisch: In welche Richtung schwimmt er?
            </p>
            <p className="text-lg text-slate-500 mb-8">
              Drücke <strong>links</strong> oder <strong>rechts</strong> — so schnell du kannst.
              Zuerst üben wir ein paar Mal zusammen.
            </p>
          </>
        ) : isFirstTestBlock ? (
          <>
            <div className="text-6xl mb-6">🎉</div>
            <h2 className="text-4xl font-bold text-slate-800 mb-4">Übung geschafft!</h2>
            <p className="text-xl text-slate-600 mb-8">
              Jetzt geht das richtige Spiel los: 3 Runden. Gib dein Bestes!
            </p>
          </>
        ) : (
          <>
            <div className="text-6xl mb-6">🏆</div>
            <h2 className="text-4xl font-bold text-slate-800 mb-4">Super gemacht!</h2>
            <p className="text-xl text-slate-600 mb-8">
              Runde {upcomingBlock - 1} von {ANT_CONFIG.testBlocks} geschafft. Ruh dich kurz aus —
              weiter geht&rsquo;s, wenn du bereit bist.
            </p>
          </>
        )}
        <button
          onClick={onContinue}
          className="w-full bg-purple-600 text-white font-bold py-4 rounded-2xl hover:bg-purple-700 transition-colors text-xl"
        >
          {isIntro ? 'Los geht’s!' : 'Weiter geht’s!'}
        </button>
        <p className="text-sm text-slate-400 mt-4">Enter, Leertaste oder Arcade-Button drücken</p>
      </div>
    </div>
  );
}

function TrialScreen({
  display,
  onCancel,
}: {
  display: Extract<Display, { kind: 'trial' }>;
  onCancel: () => void;
}) {
  const { block, trialIndex, trialCount, trial, phase, feedback } = display;
  const isPractice = block === 0;

  const showCueTop =
    phase === 'cue' && (trial.cue === 'double' || (trial.cue === 'spatial' && trial.position === 'top'));
  const showCueBottom =
    phase === 'cue' &&
    (trial.cue === 'double' || (trial.cue === 'spatial' && trial.position === 'bottom'));
  const showFish = phase === 'target' || phase === 'feedback';

  return (
    <div className="fixed inset-0 z-40 bg-sky-50 flex flex-col items-center justify-center overflow-hidden select-none">
      <HoldToExit onExit={onCancel} />

      {/* Dezenter Fortschritts-HUD (kein belohnendes Element im Testblock) */}
      <div className="absolute top-8 left-8 text-lg font-semibold text-slate-300">
        {isPractice ? 'Übung' : `Runde ${block} / ${ANT_CONFIG.testBlocks}`}
        <span className="ml-4 font-normal">
          {trialIndex + 1} / {trialCount}
        </span>
      </div>

      <div className="relative w-full h-[600px] flex flex-col items-center justify-center">
        {/* Obere Zone */}
        <div className="absolute top-0 h-48 w-full flex items-center justify-center">
          {showCueTop && <CueStar />}
          {showFish && trial.position === 'top' && (
            <FishRow trial={trial} feedback={phase === 'feedback' ? feedback : null} />
          )}
        </div>

        {/* Fixation / Center-Cue */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-24 flex items-center justify-center">
          {phase === 'cue' && trial.cue === 'central' ? (
            <CueStar />
          ) : (
            <div className="text-6xl font-light text-slate-800">+</div>
          )}
        </div>

        {/* Untere Zone */}
        <div className="absolute bottom-0 h-48 w-full flex items-center justify-center">
          {showCueBottom && <CueStar />}
          {showFish && trial.position === 'bottom' && (
            <FishRow trial={trial} feedback={phase === 'feedback' ? feedback : null} />
          )}
        </div>
      </div>

      {/* Feedback-Text nur im Übungsblock */}
      {phase === 'feedback' && feedback !== null && (
        <div className="absolute bottom-16 text-3xl font-bold text-slate-700">
          {feedback === 'correct' && 'Super! 🎣'}
          {feedback === 'wrong' && 'Ups — andere Richtung!'}
          {feedback === 'missed' && 'Zu langsam — probier’s schneller!'}
        </div>
      )}
    </div>
  );
}

/** Statischer Cue-Stern (bewusst ohne Animation — Test bleibt RT-rein). */
function CueStar() {
  return <div className="text-6xl">⭐</div>;
}

function FishRow({
  trial,
  feedback,
}: {
  trial: PlannedTrial;
  feedback: FeedbackKind | null;
}) {
  const targetDir = trial.targetDir;
  const flankerDir =
    trial.flanker === 'incongruent' ? (targetDir === 'L' ? 'R' : 'L') : targetDir;

  const targetStatus: FishStatus =
    feedback === 'correct' ? 'success' : feedback === 'wrong' || feedback === 'missed' ? 'error' : 'neutral';

  if (trial.flanker === 'neutral') {
    return (
      <div className="flex h-24 items-center justify-center">
        <div className="w-24 mx-1" />
        <div className="w-24 mx-1" />
        <Fish direction={targetDir} status={targetStatus} className="mx-1" />
        <div className="w-24 mx-1" />
        <div className="w-24 mx-1" />
      </div>
    );
  }

  return (
    <div className="flex h-24 items-center justify-center">
      <Fish direction={flankerDir} className="mx-1" />
      <Fish direction={flankerDir} className="mx-1" />
      <Fish direction={targetDir} status={targetStatus} className="mx-1" />
      <Fish direction={flankerDir} className="mx-1" />
      <Fish direction={flankerDir} className="mx-1" />
    </div>
  );
}
