"use client";

export function ExportsPage() {
  return (
    <div className="h-full overflow-y-auto bg-slate-950 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">Exports</h2>
      <p className="mt-1 text-xs text-slate-300">
        Export map view PNG, route comparison PDF, cost estimate PDF, route CSV/GeoJSON, and stakeholder/project summary PDF.
      </p>
      <p className="mt-4 rounded border border-slate-700 bg-slate-950 p-2 text-xs text-slate-200">
        Coming online next: export buttons that generate files and store results in planning_exports.
      </p>
    </div>
  );
}
