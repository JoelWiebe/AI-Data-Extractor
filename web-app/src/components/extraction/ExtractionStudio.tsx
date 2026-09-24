import React, { useState } from 'react';
import {
  Play,
  CheckCircle2,
  AlertTriangle,
  Download,
  Filter,
  Sparkles,
  ChevronDown,
  ChevronUp,
  FileCheck,
  RefreshCw,
} from 'lucide-react';
import {
  Pass2ExtractedVariable,
  DocumentConversionResult,
  CodebookVariable,
  AiGovernanceMode,
  DataResidencyRegion,
  GeminiModelVersion,
} from '../../types';
import { ExtractionEngine } from '../../services/extractionEngine';
import { getManuscriptFile } from '../../services/storageService';
import { PdfExtractor } from '../../services/pdfExtractor';

interface ExtractionStudioProps {
  conversionResults: Record<string, DocumentConversionResult>;
  codebookVariables: CodebookVariable[];
  extractedResults: Pass2ExtractedVariable[];
  onUpdateResults: (results: Pass2ExtractedVariable[]) => void;
  apiKey: string;
  governanceMode: AiGovernanceMode;
  dataResidency: DataResidencyRegion;
  vertexProjectId: string;
  selectedModel: GeminiModelVersion;
  isExtracting: boolean;
  setIsExtracting: (b: boolean) => void;
  progress: { current: number; total: number; label: string } | null;
  setProgress: (p: { current: number; total: number; label: string } | null) => void;
  showStatus: (text: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export const ExtractionStudio: React.FC<ExtractionStudioProps> = ({
  conversionResults,
  codebookVariables,
  extractedResults,
  onUpdateResults,
  apiKey,
  governanceMode,
  dataResidency,
  vertexProjectId,
  selectedModel,
  isExtracting,
  setIsExtracting,
  progress,
  setProgress,
  showStatus,
}) => {
  const [filterDomain, setFilterDomain] = useState<string>('all');
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const filenames = Object.keys(conversionResults);

  const handleStartExtraction = async () => {
    if (filenames.length === 0) {
      showStatus('No converted manuscripts available. Please upload & verify manuscripts first.', 'warning');
      return;
    }
    if (!apiKey && !(governanceMode === 'ENTERPRISE_ZERO_TRAINING' && vertexProjectId)) {
      showStatus('Please configure your Gemini API Key or Vertex Project ID in Settings (⚙️).', 'error');
      return;
    }

    setIsExtracting(true);
    showStatus('Starting 2-Pass AI Literature Review Extraction...', 'info');

    const accumulatedResults: Pass2ExtractedVariable[] = [];

    try {
      for (let fIdx = 0; fIdx < filenames.length; fIdx++) {
        const fname = filenames[fIdx];
        const conv = conversionResults[fname];
        if (!conv || !conv.pages || conv.pages.length === 0) continue;

        // 1. Prepare linear block stream & stop at REFERENCES
        const { items, wasStoppedAtReferences } = ExtractionEngine.prepareDocumentContent(conv.pages);
        console.log(
          `[ExtractionStudio] Prepared ${items.length} paragraphs for '${fname}'. Stopped at references: ${wasStoppedAtReferences}`
        );

        // 2. Pass 1: Classification
        const pass1Results = await ExtractionEngine.runPass1Classification(
          items,
          codebookVariables,
          apiKey,
          governanceMode,
          dataResidency,
          vertexProjectId,
          selectedModel,
          (cur, tot, heading) => {
            setProgress({
              current: cur,
              total: tot,
              label: `Pass 1: Tagging [${fname}] -> ${heading}`,
            });
          }
        );

        // 3. Pass 2: Variable Extraction
        const pass2Results = await ExtractionEngine.runPass2Extraction(
          fname,
          items,
          codebookVariables,
          pass1Results,
          apiKey,
          governanceMode,
          dataResidency,
          vertexProjectId,
          selectedModel,
          (cur, tot, varName) => {
            setProgress({
              current: cur,
              total: tot,
              label: `Pass 2: Extracting [${fname}] -> ${varName}`,
            });
          }
        );

        accumulatedResults.push(...pass2Results);
        onUpdateResults([...accumulatedResults]);
      }

      showStatus(`🎉 Extraction complete! Extracted ${accumulatedResults.length} target variables.`, 'success');
    } catch (err: any) {
      showStatus(`Extraction interrupted: ${err.message}`, 'error');
    } finally {
      setIsExtracting(false);
      setProgress(null);
    }
  };

  const handleHumanValueChange = (index: number, val: string) => {
    const next = [...extractedResults];
    next[index] = {
      ...next[index],
      humanVerifiedValue: val,
      status: val.trim() ? 'verified' : 'pending',
    };
    onUpdateResults(next);
  };

  const handleDownloadSynthesis = () => {
    if (extractedResults.length === 0) return;
    const blob = ExtractionEngine.exportSynthesisToExcel(extractedResults);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `synthesis_matrix_${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    showStatus('Synthesis matrix Excel workbook downloaded.', 'success');
  };

  const domains = Array.from(new Set(extractedResults.map((r) => r.domain || 'other')));

  const filteredResults =
    filterDomain === 'all' ? extractedResults : extractedResults.filter((r) => r.domain === filterDomain);

  return (
    <div className="space-y-4 animate-in fade-in">
      {/* Control Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 rounded-lg">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
              <span>2-Pass Literature Review Extraction Engine</span>
              <span className="text-[11px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700">
                {extractedResults.length} Results
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Pass 1 Paragraph Classification $\rightarrow$ Pass 2 Targeted Variable Extraction w/ Citations
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2.5">
          {domains.length > 0 && (
            <select
              value={filterDomain}
              onChange={(e) => setFilterDomain(e.target.value)}
              className="bg-slate-950 border border-slate-700 text-xs rounded-lg px-2.5 py-1.5 text-slate-300 font-medium focus:outline-none focus:border-indigo-500"
            >
              <option value="all">📁 All Domains ({extractedResults.length})</option>
              {domains.map((d) => (
                <option key={d} value={d}>
                  {d} ({extractedResults.filter((r) => r.domain === d).length})
                </option>
              ))}
            </select>
          )}

          {extractedResults.length > 0 && (
            <button
              onClick={handleDownloadSynthesis}
              className="px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 flex items-center space-x-1.5 transition"
            >
              <Download className="h-3.5 w-3.5 text-slate-400" />
              <span>Export Synthesis .xlsx</span>
            </button>
          )}

          <button
            onClick={handleStartExtraction}
            disabled={isExtracting || filenames.length === 0}
            className="px-4 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg shadow flex items-center space-x-1.5 transition disabled:opacity-50"
          >
            {isExtracting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            <span>{isExtracting ? 'Extracting...' : 'Run 2-Pass Extraction'}</span>
          </button>
        </div>
      </div>

      {/* Live Extraction Progress Indicator */}
      {progress && (
        <div className="bg-slate-900 border border-indigo-500/40 p-3.5 rounded-xl space-y-2 animate-in fade-in shadow-lg">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-indigo-300 flex items-center space-x-2">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              <span>{progress.label}</span>
            </span>
            <span className="font-mono text-slate-400">
              {progress.current} / {progress.total}
            </span>
          </div>
          <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
            <div
              className="h-full bg-indigo-500 transition-all duration-300"
              style={{ width: `${Math.round((progress.current / progress.total) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Extracted Synthesis Table */}
      {extractedResults.length === 0 ? (
        <div className="border border-slate-800 rounded-xl p-12 text-center bg-slate-950/60 space-y-3">
          <div className="p-3 bg-slate-900 text-slate-400 rounded-2xl w-fit mx-auto border border-slate-800">
            <FileCheck className="h-8 w-8" />
          </div>
          <h4 className="text-sm font-bold text-slate-200">No Extractions Run Yet</h4>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Click <strong>Run 2-Pass Extraction</strong> above to analyze your verified manuscripts against the codebook
            variables with automatic stop-at-references enforcement.
          </p>
        </div>
      ) : (
        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/80 shadow-xl">
          <div className="overflow-x-auto max-h-[600px]">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-900/90 text-slate-300 border-b border-slate-800 sticky top-0 z-10 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3 w-8 text-center">#</th>
                  <th className="p-3 w-40">Manuscript</th>
                  <th className="p-3 w-36">Variable</th>
                  <th className="p-3">AI Extracted Value</th>
                  <th className="p-3 w-24 text-center">Confidence</th>
                  <th className="p-3 w-64">Human Verified Override</th>
                  <th className="p-3 w-16 text-center">Evidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {filteredResults.map((r, idx) => {
                  const isExpanded = expandedIndex === idx;
                  return (
                    <React.Fragment key={idx}>
                      <tr className="hover:bg-slate-900/50 transition">
                        <td className="p-2.5 text-center text-slate-500 font-mono text-[11px]">{idx + 1}</td>
                        <td className="p-2.5 font-medium text-slate-300 truncate max-w-[160px]" title={r.filename}>
                          {r.filename}
                        </td>
                        <td className="p-2.5">
                          <span className="font-mono text-indigo-300 font-semibold text-[11px]">{r.variable}</span>
                        </td>
                        <td className="p-2.5">
                          <span
                            className={`font-medium ${
                              r.extractedValue === 'Not Found' ? 'text-slate-500 italic' : 'text-slate-100'
                            }`}
                          >
                            {r.extractedValue}
                          </span>
                        </td>
                        <td className="p-2.5 text-center">
                          <span
                            className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border ${
                              r.confidence >= 0.8
                                ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                                : r.confidence >= 0.5
                                ? 'bg-amber-950 text-amber-300 border-amber-800'
                                : 'bg-rose-950 text-rose-300 border-rose-800'
                            }`}
                          >
                            {Math.round(r.confidence * 100)}%
                          </span>
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={r.humanVerifiedValue || ''}
                            onChange={(e) => handleHumanValueChange(idx, e.target.value)}
                            placeholder="Accept AI or type correction..."
                            className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded px-2.5 py-1 text-slate-200 text-xs"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <button
                            onClick={() => setExpandedIndex(isExpanded ? null : idx)}
                            className="p-1 text-slate-400 hover:text-indigo-300 rounded hover:bg-slate-800 transition"
                            title="Inspect AI Justification & Citations"
                          >
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                        </td>
                      </tr>

                      {/* Evidence & Justification Drawer */}
                      {isExpanded && (
                        <tr className="bg-slate-900/90 border-b border-indigo-500/20">
                          <td colSpan={7} className="p-4 space-y-3">
                            <div className="space-y-1">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                                AI Deduction & Justification
                              </span>
                              <p className="text-xs text-slate-200 leading-relaxed bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                                {r.justification}
                              </p>
                            </div>

                            {r.relevantSnippets.length > 0 && (
                              <div className="space-y-1.5">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                  Cited Paragraph Excerpts (Indices: {r.indices.join(', ')})
                                </span>
                                <div className="space-y-1.5">
                                  {r.relevantSnippets.map((snip, sIdx) => (
                                    <div
                                      key={sIdx}
                                      className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-300 leading-relaxed"
                                    >
                                      {snip}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
