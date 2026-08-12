import { useState } from 'react';
import { useChildContext } from './ChildContext';
import ChildForm from './ChildForm';
import type { Child, ChildInput } from '../data/schema';

/**
 * Sachliche Betreuer-Verwaltung: Liste, Anlegen, Bearbeiten, Archivieren.
 * Kein Hard-Delete — archivierte Kinder bleiben in Firestore, verschwinden
 * nur aus der Kind-Auswahl (Plan §4 Punkt 1).
 */

const AGE_LABEL: Record<number, string> = { 4: '4 Jahre', 6: '6 Jahre' };
const SEX_LABEL: Record<string, string> = { m: 'männlich', f: 'weiblich', x: 'divers' };
const STUDY_GROUP_LABEL: Record<string, string> = { trained: 'Trainiert', control: 'Kontrolle' };

interface ChildManagementProps {
  onBack: () => void;
}

type Panel = { mode: 'closed' } | { mode: 'create' } | { mode: 'edit'; child: Child };

export default function ChildManagement({ onBack }: ChildManagementProps) {
  const {
    children,
    loading,
    error,
    addChild,
    editChild,
    archiveChild,
    unarchiveChild,
    includeArchived,
    setIncludeArchived,
  } = useChildContext();
  const [panel, setPanel] = useState<Panel>({ mode: 'closed' });

  const handleCreate = async (input: ChildInput) => {
    await addChild(input);
    setPanel({ mode: 'closed' });
  };

  const handleEdit = async (input: ChildInput) => {
    if (panel.mode !== 'edit') return;
    await editChild(panel.child.id, input);
    setPanel({ mode: 'closed' });
  };

  return (
    <div className="min-h-screen w-full bg-slate-50 p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Kinder verwalten</h1>
            <p className="text-slate-500 text-sm mt-1">
              Anlegen, Bearbeiten und Archivieren der Kinder dieses Betreuer-Kontos.
            </p>
          </div>
          <button
            onClick={onBack}
            className="px-4 py-2 rounded-lg border border-slate-300 text-slate-600 font-medium hover:bg-white"
          >
            Zurück zur Auswahl
          </button>
        </div>

        {panel.mode === 'closed' && (
          <div className="flex items-center justify-between mb-4">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={includeArchived}
                onChange={(e) => setIncludeArchived(e.target.checked)}
              />
              Archivierte Kinder anzeigen
            </label>
            <button
              onClick={() => setPanel({ mode: 'create' })}
              className="px-4 py-2 rounded-lg bg-purple-600 text-white font-semibold hover:bg-purple-700"
            >
              + Kind anlegen
            </button>
          </div>
        )}

        {panel.mode === 'create' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4">Neues Kind anlegen</h2>
            <ChildForm
              submitLabel="Kind anlegen"
              onSubmit={handleCreate}
              onCancel={() => setPanel({ mode: 'closed' })}
            />
          </div>
        )}

        {panel.mode === 'edit' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4">
              „{panel.child.displayName}" bearbeiten
            </h2>
            <ChildForm
              initial={panel.child}
              submitLabel="Änderungen speichern"
              onSubmit={handleEdit}
              onCancel={() => setPanel({ mode: 'closed' })}
            />
          </div>
        )}

        {error && (
          <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200 mb-4">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-slate-500">Lade Kinder…</p>
        ) : children.length === 0 ? (
          <p className="text-slate-500">Noch keine Kinder angelegt.</p>
        ) : (
          <ul className="space-y-3">
            {children.map((child) => (
              <li
                key={child.id}
                className={`bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between gap-4 ${
                  child.archived ? 'opacity-60' : ''
                }`}
              >
                <div>
                  <div className="font-semibold text-slate-800">
                    {child.displayName}
                    {child.archived && (
                      <span className="ml-2 text-xs font-bold uppercase text-slate-400">
                        Archiviert
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-slate-500 mt-0.5 flex gap-2 flex-wrap">
                    <span>{AGE_LABEL[child.ageGroup]}</span>
                    {child.sex && <span>· {SEX_LABEL[child.sex]}</span>}
                    {child.studyGroup && <span>· {STUDY_GROUP_LABEL[child.studyGroup]}</span>}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => setPanel({ mode: 'edit', child })}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 text-sm font-medium hover:bg-slate-50"
                  >
                    Bearbeiten
                  </button>
                  {child.archived ? (
                    <button
                      onClick={() => unarchiveChild(child.id)}
                      className="px-3 py-1.5 rounded-lg border border-green-300 text-green-700 text-sm font-medium hover:bg-green-50"
                    >
                      Reaktivieren
                    </button>
                  ) : (
                    <button
                      onClick={() => archiveChild(child.id)}
                      className="px-3 py-1.5 rounded-lg border border-red-300 text-red-600 text-sm font-medium hover:bg-red-50"
                    >
                      Archivieren
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
