import { useState, type FormEvent } from 'react';
import { childInputSchema, type AgeGroup, type ChildInput } from '../data/schema';

/**
 * Anlegen/Bearbeiten eines Kindes — Teil der (sachlichen) Betreuer-Verwaltung.
 * Validiert vor dem Absenden gegen childInputSchema (gleiche Regeln wie an
 * der Firestore-Grenze), damit Fehler früh und verständlich erscheinen.
 */

interface ChildFormProps {
  initial?: Partial<ChildInput>;
  submitLabel: string;
  onSubmit: (input: ChildInput) => Promise<void>;
  onCancel: () => void;
}

type SexOption = '' | 'm' | 'f' | 'x';
type StudyGroupOption = '' | 'trained' | 'control';

export default function ChildForm({ initial, submitLabel, onSubmit, onCancel }: ChildFormProps) {
  const [displayName, setDisplayName] = useState(initial?.displayName ?? '');
  const [ageGroup, setAgeGroup] = useState<AgeGroup | ''>(initial?.ageGroup ?? '');
  const [sex, setSex] = useState<SexOption>(initial?.sex ?? '');
  const [studyGroup, setStudyGroup] = useState<StudyGroupOption>(initial?.studyGroup ?? '');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const candidate = {
      displayName,
      ageGroup: ageGroup === '' ? undefined : ageGroup,
      sex: sex === '' ? undefined : sex,
      studyGroup: studyGroup === '' ? undefined : studyGroup,
    };

    const result = childInputSchema.safeParse(candidate);
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? 'Eingabe ungültig.');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(result.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Speichern fehlgeschlagen.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1" htmlFor="displayName">
          Anzeigename / Pseudonym
        </label>
        <input
          id="displayName"
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={60}
          className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-400"
          placeholder="z. B. Kleiner Fuchs"
          autoFocus
        />
        <p className="text-xs text-slate-500 mt-1">
          Datenschutz-Tipp: Verwende ein Pseudonym oder einen Spitznamen statt des echten Namens.
        </p>
      </div>

      <div>
        <span className="block text-sm font-semibold text-slate-700 mb-1">Altersgruppe</span>
        <div className="flex gap-3">
          {([4, 6] as const).map((age) => (
            <label
              key={age}
              className={`flex-1 text-center px-4 py-2 rounded-lg border cursor-pointer font-medium ${
                ageGroup === age
                  ? 'bg-purple-600 text-white border-purple-600'
                  : 'bg-white text-slate-700 border-slate-300 hover:border-purple-300'
              }`}
            >
              <input
                type="radio"
                name="ageGroup"
                value={age}
                checked={ageGroup === age}
                onChange={() => setAgeGroup(age)}
                className="sr-only"
              />
              {age} Jahre
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1" htmlFor="sex">
            Geschlecht (optional)
          </label>
          <select
            id="sex"
            value={sex}
            onChange={(e) => setSex(e.target.value as SexOption)}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-400"
          >
            <option value="">Keine Angabe</option>
            <option value="m">männlich</option>
            <option value="f">weiblich</option>
            <option value="x">divers</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1" htmlFor="studyGroup">
            Studiengruppe (optional)
          </label>
          <select
            id="studyGroup"
            value={studyGroup}
            onChange={(e) => setStudyGroup(e.target.value as StudyGroupOption)}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-400"
          >
            <option value="">Keine Angabe</option>
            <option value="trained">Trainiert</option>
            <option value="control">Kontrolle</option>
          </select>
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-2 rounded-lg border border-slate-300 text-slate-600 font-medium hover:bg-slate-50"
        >
          Abbrechen
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 px-4 py-2 rounded-lg bg-purple-600 text-white font-semibold hover:bg-purple-700 disabled:opacity-50"
        >
          {submitting ? 'Speichern…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
