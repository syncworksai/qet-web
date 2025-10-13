// src/components/AccountManager.jsx
import React from "react";

export default function AccountManager({
  accounts = [],
  selectedId = "",
  onClose,
  onSelect,
  onRename,
  onDelete,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* overlay */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-label="Close"
      />
      {/* panel */}
      <div className="relative z-10 w-[92vw] max-w-2xl rounded-xl border border-slate-700 bg-[#0b1220] p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-100">Manage Accounts</h2>
          <button
            className="rounded-md border border-slate-600 px-2 py-1 text-sm text-slate-200 hover:bg-slate-800"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="max-h-[60vh] overflow-auto rounded-lg border border-slate-700">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-900/60 text-slate-300">
              <tr>
                <th className="px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(accounts || []).map((a, i) => {
                const isSel = String(a.id) === String(selectedId);
                return (
                  <tr
                    key={a.id}
                    className="border-t border-slate-800 align-top hover:bg-slate-800/40"
                  >
                    <td className="px-3 py-2 text-slate-300">{i + 1}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div
                          className={`rounded-md px-2 py-0.5 text-[11px] ${
                            isSel
                              ? "bg-indigo-600/20 text-indigo-300 border border-indigo-700/50"
                              : "bg-slate-800 text-slate-300 border border-slate-700"
                          }`}
                          title={`Account id ${a.id}`}
                        >
                          ID {a.id}
                        </div>
                        <div className="font-medium text-slate-100">
                          {a.name || `Acc ${a.id}`}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="rounded-md border border-slate-600 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800"
                          onClick={() => onSelect && onSelect(a.id)}
                          title="Use this account"
                        >
                          Select
                        </button>
                        <button
                          className="rounded-md border border-slate-600 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800"
                          onClick={() => onRename && onRename(a.id)}
                        >
                          Rename
                        </button>
                        <button
                          className="rounded-md border border-rose-700/60 bg-rose-900/20 px-2 py-1 text-xs text-rose-300 hover:bg-rose-900/40"
                          onClick={() => onDelete && onDelete(a.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {(!accounts || accounts.length === 0) && (
                <tr>
                  <td className="px-3 py-6 text-slate-400" colSpan={3}>
                    No accounts yet. Create one from the TraderLab header.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-3 text-right">
          <button
            className="rounded-md border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
