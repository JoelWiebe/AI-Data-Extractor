import React, { useState } from 'react';
import {
  BookOpen,
  Plus,
  Trash2,
  Download,
  Upload,
  History,
  RotateCcw,
  Sparkles,
  FileSpreadsheet,
} from 'lucide-react';
import { CodebookVariable, CodebookSnapshot } from '../../types';
import { CodebookService } from '../../services/codebookService';

interface CodebookStudioProps {
  variables: CodebookVariable[];
  snapshots: CodebookSnapshot[];
  onUpdateCodebook: (vars: CodebookVariable[], source?: string, note?: string) => void;
  onRestoreSnapshot: (snap: CodebookSnapshot) => void;
  showStatus: (text: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export const CodebookStudio: React.FC<CodebookStudioProps> = ({
  variables,
  snapshots,
  onUpdateCodebook,
  onRestoreSnapshot,
  showStatus,
}) => {
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [filterDomain, setFilterDomain] = useState<string>('all');

  const domains = Array.from(new Set(variables.map((v) => v.domain || 'other')));

  const handleCellChange = (index: number, field: keyof CodebookVariable, value: string) => {
    const updated = [...variables];
    updated[index] = { ...updated[index], [field]: value };
    onUpdateCodebook(updated, 'Cell Edit', `Updated ${field} on row ${index + 1}`);
  };

  const handleAddRow = () => {
    const newVar: CodebookVariable = {
      domain: 'custom_domain',
      variable: `var_${Date.now().toString().slice(-4)}`,
      description: 'Enter targeted extraction description...',
      example: '',
      notesQuestions: '',
    };
    onUpdateCodebook([...variables, newVar], 'Row Added', 'Added new variable row');
  };

  const handleDeleteRow = (index: number) => {
    const updated = variables.filter((_, idx) => idx !== index);
    onUpdateCodebook(updated, 'Row Deleted', `Deleted row ${index + 1}`);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const parsed = CodebookService.parseExcelFile(buffer);
      onUpdateCodebook(parsed, 'Excel Upload', `Imported ${file.name} with ${parsed.length} variables`);
      showStatus(`Successfully imported ${parsed.length} variables from ${file.name}.`, 'success');
    } catch (err: any) {
      showStatus(`Error reading spreadsheet: ${err.message}`, 'error');
    }
    e.target.value = '';
  };

  const handleExport = () => {
    const blob = CodebookService.exportToExcel(variables);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `codebook_export_${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    showStatus('Codebook spreadsheet exported successfully.', 'success');
  };

  const filteredVariables =
    filterDomain === 'all' ? variables : variables.filter((v) => v.domain === filterDomain);

  return (
    <div className="space-y-4 animate-in fade-in">
      {/* Header & Controls Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 rounded-lg">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
              <span>Systematic Review Codebook Grid</span>
              <span className="text-[11px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700">
                {variables.length} Variables
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Define the target extraction variables, descriptions, sample values & domain clusters
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2">
          {/* Domain Filter Dropdown */}
          <select
            value={filterDomain}
            onChange={(e) => setFilterDomain(e.target.value)}
            className="bg-slate-950 border border-slate-700 text-xs rounded-lg px-2.5 py-1.5 text-slate-300 font-medium focus:outline-none focus:border-indigo-500"
          >
            <option value="all">📁 All Domains ({variables.length})</option>
            {domains.map((d) => (
              <option key={d} value={d}>
                {d} ({variables.filter((v) => v.domain === d).length})
              </option>
            ))}
          </select>

          {/* Import Excel */}
          <label className="cursor-pointer px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 flex items-center space-x-1.5 transition">
            <Upload className="h-3.5 w-3.5 text-slate-400" />
            <span>Import .xlsx</span>
            <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="hidden" />
          </label>

          {/* Export Excel */}
          <button
            onClick={handleExport}
            className="px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 flex items-center space-x-1.5 transition"
          >
            <Download className="h-3.5 w-3.5 text-slate-400" />
            <span>Export .xlsx</span>
          </button>

          {/* History / Audit Snapshots Toggle */}
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border flex items-center space-x-1.5 transition ${
              showHistory
                ? 'bg-indigo-600/30 border-indigo-500 text-indigo-300'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <History className="h-3.5 w-3.5" />
            <span>Audit Trail ({snapshots.length})</span>
          </button>

          {/* Add Row */}
          <button
            onClick={handleAddRow}
            className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg shadow-sm flex items-center space-x-1.5 transition"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Variable</span>
          </button>
        </div>
      </div>

      {/* Audit Trail & Snapshot Rollback Drawer */}
      {showHistory && (
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-xs font-bold text-indigo-400 flex items-center space-x-1.5">
              <History className="h-4 w-4" />
              <span>Timestamped Snapshot History & Rollback</span>
            </span>
            <span className="text-[11px] text-slate-400">Restoring creates a pre-rollback safety backup automatically</span>
          </div>

          <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
            {snapshots.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No snapshots recorded yet.</p>
            ) : (
              snapshots.map((snap) => (
                <div
                  key={snap.id}
                  className="flex items-center justify-between p-2.5 bg-slate-900/90 border border-slate-800 rounded-lg text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-slate-200">{snap.source}</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(snap.timestamp).toLocaleString()}
                      </span>
                      <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700 font-mono">
                        {snap.variables.length} vars
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">{snap.note}</p>
                  </div>

                  <button
                    onClick={() => onRestoreSnapshot(snap)}
                    className="px-2.5 py-1 text-[11px] font-semibold bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/40 rounded flex items-center space-x-1 transition"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>Rollback</span>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Codebook Interactive Editable Table */}
      <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/80 shadow-xl">
        <div className="overflow-x-auto max-h-[560px]">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-900/90 text-slate-300 border-b border-slate-800 sticky top-0 z-10 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-3 w-10 text-center">#</th>
                <th className="p-3 w-40">Domain Cluster</th>
                <th className="p-3 w-48">Variable Name</th>
                <th className="p-3">Target Description</th>
                <th className="p-3 w-48">Example Values</th>
                <th className="p-3 w-48">Notes / Questions</th>
                <th className="p-3 w-12 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {filteredVariables.map((v, idx) => {
                const originalIndex = variables.indexOf(v);
                return (
                  <tr key={originalIndex} className="hover:bg-slate-900/50 transition">
                    <td className="p-2.5 text-center text-slate-500 font-mono text-[11px]">{originalIndex + 1}</td>
                    <td className="p-2">
                      <input
                        type="text"
                        value={v.domain}
                        onChange={(e) => handleCellChange(originalIndex, 'domain', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded px-2 py-1 text-slate-200 font-mono text-[11px]"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        value={v.variable}
                        onChange={(e) => handleCellChange(originalIndex, 'variable', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded px-2 py-1 text-indigo-300 font-mono font-semibold text-[11px]"
                      />
                    </td>
                    <td className="p-2">
                      <textarea
                        rows={2}
                        value={v.description}
                        onChange={(e) => handleCellChange(originalIndex, 'description', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded px-2 py-1 text-slate-200 leading-relaxed resize-none"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        value={v.example}
                        onChange={(e) => handleCellChange(originalIndex, 'example', e.target.value)}
                        placeholder="e.g. RCT; Quasi-exp"
                        className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded px-2 py-1 text-slate-300"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        value={v.notesQuestions}
                        onChange={(e) => handleCellChange(originalIndex, 'notesQuestions', e.target.value)}
                        placeholder="Guiding notes..."
                        className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded px-2 py-1 text-slate-400"
                      />
                    </td>
                    <td className="p-2 text-center">
                      <button
                        onClick={() => handleDeleteRow(originalIndex)}
                        className="text-slate-500 hover:text-rose-400 p-1 rounded hover:bg-rose-950/40 transition"
                        title="Delete Variable"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
