/**
 * Tabellen-Fallback für jeden Chart (dataviz-Skill: "a table view exists").
 * Eingeklappt per <details>, damit sie den Chart nicht verdrängt.
 */
interface DataTableProps {
  caption: string;
  columns: readonly string[];
  rows: readonly (string | number)[][];
}

export default function DataTable({ caption, columns, rows }: DataTableProps) {
  return (
    <details className="mt-3 text-sm">
      <summary className="cursor-pointer text-slate-400 hover:text-slate-600 select-none">
        Als Tabelle anzeigen
      </summary>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c} className="border-b border-slate-200 py-1 pr-4 font-semibold text-slate-600 whitespace-nowrap">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j} className="border-b border-slate-100 py-1 pr-4 text-slate-600 tabular-nums whitespace-nowrap">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
