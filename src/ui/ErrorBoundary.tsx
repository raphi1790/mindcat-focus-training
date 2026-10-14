import { Component, type ErrorInfo, type ReactNode } from "react";
import { useConfirmInput } from "../platform/input";

/**
 * Fängt Renderfehler im Übungs-/Testbereich ab (AP6, Fix-Plan Testrunde 1):
 * statt die ganze App aus der Sitzung zu werfen, zeigt sie einen kindgerechten
 * Fehler-Screen mit Rückweg zum Dashboard. Zusammen mit dem inkrementellen
 * Speichern (Runner) ist ein Crash damit folgenlos — der nächste Start setzt am
 * letzten Checkpoint fort.
 *
 * Nur eine Klassen-Komponente kann `getDerivedStateFromError`/`componentDidCatch`
 * nutzen; daher bewusst kein Hook in der Shell, sondern Fallback-Funktionskomponente.
 */

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Zurück zum Dashboard (der Aufrufer räumt die Sitzungsansicht auf). */
  onReset: () => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Diagnose für die Absturz-Ursachen-Analyse (AP6 Punkt 8 / AP7).
    console.error("Fehler im Übungsbereich abgefangen", error, info.componentStack);
  }

  private handleReset = (): void => {
    this.setState({ error: null });
    this.props.onReset();
  };

  render(): ReactNode {
    if (this.state.error) {
      return <ErrorFallback onReset={this.handleReset} />;
    }
    return this.props.children;
  }
}

function ErrorFallback({ onReset }: { onReset: () => void }) {
  useConfirmInput(onReset);

  return (
    <div className="fixed inset-0 z-40 bg-sky-50 flex items-center justify-center overflow-auto">
      <div className="text-center p-10 bg-white rounded-3xl shadow-sm border border-slate-100 mx-4 my-8 max-w-xl">
        <div className="text-7xl mb-4">🙈</div>
        <h2 className="text-3xl font-bold text-slate-800 mb-2">Hoppla…</h2>
        <p className="text-slate-600 mb-8">
          Da ist etwas schiefgelaufen. Kein Problem — dein Fortschritt ist gespeichert. Du kannst
          gleich weitermachen.
        </p>
        <button
          onClick={onReset}
          className="w-full bg-purple-600 text-white font-bold py-4 rounded-2xl hover:bg-purple-700 transition-colors text-xl cursor-pointer"
        >
          Zurück zum Dashboard
        </button>
        <p className="text-xs text-slate-400 mt-3">Arcade-Button oder Enter drücken</p>
      </div>
    </div>
  );
}
