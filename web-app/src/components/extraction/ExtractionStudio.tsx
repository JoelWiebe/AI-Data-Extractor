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
  Search,
  Scale,
  Zap,
  Layers,
  HelpCircle,
} from 'lucide-react';
import {
  Pass2ExtractedVariable,
  DocumentConversionResult,
  CodebookVariable,
  AiGovernanceMode,
  DataResidencyRegion,
  GeminiModelVersion,
  ExtractionStrategyMode,
  ConsensusComparisonItem,
  StrategyBenchmarkMetrics,
} from '../../types';
import { ExtractionEngine } from '../../services/extractionEngine';
import { SearchExtractionEngine } from '../../services/searchExtractionEngine';
import { WholeDocExtractionEngine } from '../../services/wholeDocEngine';

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
  const [selectedStrategy, setSelectedStrategy] = useState<ExtractionStrategyMode>('INDEXED_SEARCH');
  const [filterDomain, setFilterDomain] = useState<string>('all');
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  // Benchmark & Consensus state
  const [benchmarkMetrics, setBenchmarkMetrics] = useState<StrategyBenchmarkMetrics[]>([]);
  const [consensusItems, setConsensusItems] = useState<ConsensusComparisonItem[]>([]);
  const [showConsensusView, setShowConsensusView] = useState<boolean>(false);

  const filenames = Object.keys(conversionResults);

  const handleRunExtraction = async () => {
    if (filenames.length === 0) {
      showStatus('No converted manuscripts available. Please upload & verify manuscripts first.', 'warning');
      return;
    }
    if (!apiKey && !(governanceMode === 'ENTERPRISE_ZERO_TRAINING' && vertexProjectId)) {
      showStatus('Please configure your Gemini API Key or Vertex Project ID in Settings (⚙️).', 'error');
      return;
    }

    setIsExtracting(true);
    const startTime = Date.now();
    const accumulatedResults: Pass2ExtractedVariable[] = [];
    const metrics: StrategyBenchmarkMetrics[] = [];

    try {
      for (let fIdx = 0; fIdx < filenames.length; fIdx++) {
        const fname = filenames[fIdx];
        const conv = conversionResults[fname];
        if (!conv || !conv.pages || conv.pages.length === 0) continue;

        // 1. Prepare linear block stream & stop at REFERENCES
        const { items } = ExtractionEngine.prepareDocumentContent(conv.pages);

        // MODE 1: Indexed BM25 Targeted Search (Strategy B)
        if (selectedStrategy === 'INDEXED_SEARCH') {
          showStatus(`Running Fast Indexed BM25 Search on [${fname}]...`, 'info');
          const searchRes = await SearchExtractionEngine.runIndexedSearchExtraction(
            fname,
            items,
            codebookVariables,
            apiKey,
            governanceMode,
            dataResidency,
            vertexProjectId,
            selectedModel,
            (cur, tot, vName) => {
              setProgress({
                current: cur,
                total: tot,
                label: `BM25 Search [${fname}] -> ${vName}`,
              });
            }
          );
          accumulatedResults.push(...searchRes.results.map((r) => ({ ...r, strategyUsed: 'BM25 Search' })));
          metrics.push({
            strategyName: 'BM25 Targeted Search',
            totalTokens: searchRes.totalTokensEstimated,
            durationMs: Date.now() - startTime,
            variablesExtracted: searchRes.results.length,
          });
        }

        // MODE 2: Classic 2-Pass Heading Classifier (Strategy A)
        else if (selectedStrategy === 'HEADING_CLASSIFIER') {
          showStatus(`Running Classic 2-Pass Heading Classification on [${fname}]...`, 'info');
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
            (cur, tot, vName) => {
              setProgress({
                current: cur,
                total: tot,
                label: `Pass 2: Extracting [${fname}] -> ${vName}`,
              });
            }
          );
          accumulatedResults.push(...pass2Results.map((r) => ({ ...r, strategyUsed: '2-Pass Heading' })));
          metrics.push({
            strategyName: '2-Pass Heading Classifier',
            totalTokens: items.reduce((acc, it) => acc + it.content.split(/\s+/).length, 0) * 2,
            durationMs: Date.now() - startTime,
            variablesExtracted: pass2Results.length,
          });
        }

        // MODE 3: Whole-Document Long-Context (Strategy C)
        else if (selectedStrategy === 'WHOLE_DOC_SYNTHESIS') {
          showStatus(`Running Whole-Document Long-Context Synthesis on [${fname}]...`, 'info');
          const wholeDocRes = await WholeDocExtractionEngine.runWholeDocExtraction(
            fname,
            items,
            codebookVariables,
            apiKey,
            governanceMode,
            dataResidency,
            vertexProjectId,
            selectedModel,
            (status) => {
              setProgress({
                current: 1,
                total: 1,
                label: `Whole-Doc [${fname}]: ${status}`,
              });
            }
          );
          accumulatedResults.push(...wholeDocRes.results.map((r) => ({ ...r, strategyUsed: 'Whole-Doc Synthesis' })));
          metrics.push({
            strategyName: 'Whole-Document Synthesis',
            totalTokens: wholeDocRes.totalTokensEstimated,
            durationMs: Date.now() - startTime,
            variablesExtracted: wholeDocRes.results.length,
          });
        }

        // MODE 4: Multi-Strategy Consensus Benchmark (Runs A & B in parallel)
        else if (selectedStrategy === 'CONSENSUS_BENCHMARK') {
          showStatus(`Running Multi-Strategy Consensus Benchmark on [${fname}]...`, 'info');

          // Run Search in parallel
          const searchPromise = SearchExtractionEngine.runIndexedSearchExtraction(
            fname,
            items,
            codebookVariables,
            apiKey,
            governanceMode,
            dataResidency,
            vertexProjectId,
            selectedModel
          );

          // Run 2-Pass Heading in parallel
          const headingPromise = (async () => {
            const p1 = await ExtractionEngine.runPass1Classification(
              items,
              codebookVariables,
              apiKey,
              governanceMode,
              dataResidency,
              vertexProjectId,
              selectedModel
            );
            return await ExtractionEngine.runPass2Extraction(
              fname,
              items,
              codebookVariables,
              p1,
              apiKey,
              governanceMode,
              dataResidency,
              vertexProjectId,
              selectedModel
            );
          })();

          setProgress({ current: 1, total: 2, label: `Running BM25 Search & 2-Pass in parallel on [${fname}]...` });
          const [searchRes, headingRes] = await Promise.all([searchPromise, headingPromise]);

          // Assemble Consensus Matrix
          const comparisonItems: ConsensusComparisonItem[] = [];
          let matchCount = 0;

          codebookVariables.forEach((v) => {
            const valA = headingRes.find((r) => r.variable === v.variable);
            const valB = searchRes.results.find((r) => r.variable === v.variable);

            const strA = (valA?.extractedValue || 'Not Found').toLowerCase().trim();
            const strB = (valB?.extractedValue || 'Not Found').toLowerCase().trim();

            const isConsensus =
              strA === strB ||
              (strA.includes(strB) && strB.length > 3) ||
              (strB.includes(strA) && strA.length > 3);

            if (isConsensus) matchCount++;

            comparisonItems.push({
              variable: v.variable,
              domain: v.domain,
              strategyAValue: valA?.extractedValue || 'Not Found',
              strategyBValue: valB?.extractedValue || 'Not Found',
              isConsensus,
              confidenceA: valA?.confidence || 0,
              confidenceB: valB?.confidence || 0,
              justificationA: valA?.justification || '',
              justificationB: valB?.justification || '',
              humanVerifiedValue: isConsensus ? valB?.extractedValue : '',
            });
          });

          setConsensusItems(comparisonItems);
          setShowConsensusView(true);

          const agreementRate = codebookVariables.length > 0 ? (matchCount / codebookVariables.length) * 100 : 100;

          metrics.push({
            strategyName: 'BM25 Search (Consensus Track)',
            totalTokens: searchRes.totalTokensEstimated,
            durationMs: Date.now() - startTime,
            variablesExtracted: searchRes.results.length,
            agreementRate,
          });

          // Use search results as default active results
          accumulatedResults.push(...searchRes.results.map((r) => ({ ...r, strategyUsed: 'Consensus (BM25 + 2-Pass)' })));
        }

        onUpdateResults([...accumulatedResults]);
      }

      setBenchmarkMetrics(metrics);
      showStatus(`🎉 Extraction complete! Processed ${accumulatedResults.length} variables.`, 'success');
    } catch (err: any) {
      showStatus(`Extraction failed: ${err.message}`, 'error');
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
    a.download = `synthesis_matrix_${selectedStrategy.toLowerCase()}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    showStatus('Synthesis matrix Excel workbook exported.', 'success');
  };

  const domains = Array.from(new Set(extractedResults.map((r) => r.domain || 'other')));

  const filteredResults =
    filterDomain === 'all' ? extractedResults : extractedResults.filter((r) => r.domain === filterDomain);

  return (
    <div className="space-y-5 animate-in fade-in">
      {/* Strategy Selector Strip */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {/* Strategy B: Indexed BM25 Search */}
        <div
          onClick={() => setSelectedStrategy('INDEXED_SEARCH')}
          className={`p-3.5 rounded-xl border cursor-pointer transition flex flex-col justify-between space-y-2 ${
            selectedStrategy === 'INDEXED_SEARCH'
              ? 'bg-indigo-950/40 border-indigo-500 ring-2 ring-indigo-500/40 shadow-lg'
              : 'bg-slate-900 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-400 flex items-center space-x-1.5">
              <Search className="h-4 w-4" />
              <span>BM25 Targeted Search</span>
            </span>
            <span className="text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-800 px-1.5 py-0.5 rounded font-mono">
              70% Less Tokens
            </span>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            Indexes paper into BM25 inverted index. Queries academic synonyms and extracts from sliced context windows.
          </p>
        </div>

        {/* Strategy A: 2-Pass Heading Classifier */}
        <div
          onClick={() => setSelectedStrategy('HEADING_CLASSIFIER')}
          className={`p-3.5 rounded-xl border cursor-pointer transition flex flex-col justify-between space-y-2 ${
            selectedStrategy === 'HEADING_CLASSIFIER'
              ? 'bg-indigo-950/40 border-indigo-500 ring-2 ring-indigo-500/40 shadow-lg'
              : 'bg-slate-900 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-200 flex items-center space-x-1.5">
              <Layers className="h-4 w-4 text-cyan-400" />
              <span>2-Pass Heading Model</span>
            </span>
            <span className="text-[10px] bg-slate-950 text-slate-400 border border-slate-800 px-1.5 py-0.5 rounded font-mono">
              Classic Baseline
            </span>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            Pass 1 tags sections with domain clusters. Pass 2 extracts clustered variables with strict study scoping.
          </p>
        </div>

        {/* Strategy C: Whole Document Synthesis */}
        <div
          onClick={() => setSelectedStrategy('WHOLE_DOC_SYNTHESIS')}
          className={`p-3.5 rounded-xl border cursor-pointer transition flex flex-col justify-between space-y-2 ${
            selectedStrategy === 'WHOLE_DOC_SYNTHESIS'
              ? 'bg-indigo-950/40 border-indigo-500 ring-2 ring-indigo-500/40 shadow-lg'
              : 'bg-slate-900 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-200 flex items-center space-x-1.5">
              <Zap className="h-4 w-4 text-amber-400" />
              <span>Whole-Doc Long-Context</span>
            </span>
            <span className="text-[10px] bg-slate-950 text-slate-400 border border-slate-800 px-1.5 py-0.5 rounded font-mono">
              Single-Shot
            </span>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            Feeds full document pre-references text in 1 prompt to extract all codebook variables at once.
          </p>
        </div>

        {/* Strategy 4: Multi-Strategy Consensus Benchmark */}
        <div
          onClick={() => setSelectedStrategy('CONSENSUS_BENCHMARK')}
          className={`p-3.5 rounded-xl border cursor-pointer transition flex flex-col justify-between space-y-2 ${
            selectedStrategy === 'CONSENSUS_BENCHMARK'
              ? 'bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/40 shadow-lg'
              : 'bg-slate-900 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-400 flex items-center space-x-1.5">
              <Scale className="h-4 w-4" />
              <span>Consensus Benchmark</span>
            </span>
            <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 px-1.5 py-0.5 rounded font-mono">
              Multi-Method
            </span>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            Runs BM25 Search & 2-Pass in parallel. Automatically verifies consensus & flags discrepancies for review.
          </p>
        </div>
      </div>

      {/* Control Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 rounded-lg">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
              <span>Extraction Matrix & Synthesis</span>
              <span className="text-[11px] bg-indigo-950 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-800 font-mono">
                {selectedStrategy}
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Extracted variables, confidence scores, exact paragraph citations & AI justifications
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center space-x-2.5">
          {consensusItems.length > 0 && (
            <button
              onClick={() => setShowConsensusView(!showConsensusView)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border flex items-center space-x-1.5 transition ${
                showConsensusView
                  ? 'bg-emerald-600/30 border-emerald-500 text-emerald-300'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Scale className="h-3.5 w-3.5" />
              <span>{showConsensusView ? 'Show Standard Matrix' : 'Show Consensus Diff'}</span>
            </button>
          )}

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
              <span>Export .xlsx</span>
            </button>
          )}

          <button
            onClick={handleRunExtraction}
            disabled={isExtracting || filenames.length === 0}
            className="px-4 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg shadow flex items-center space-x-1.5 transition disabled:opacity-50"
          >
            {isExtracting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            <span>{isExtracting ? 'Extracting...' : `Run ${selectedStrategy}`}</span>
          </button>
        </div>
      </div>

      {/* Benchmark Metrics Strip */}
      {benchmarkMetrics.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {benchmarkMetrics.map((m, idx) => (
            <div key={idx} className="bg-slate-900 border border-slate-800 p-3 rounded-xl space-y-1">
              <span className="text-[11px] font-bold text-indigo-400 block">{m.strategyName}</span>
              <div className="flex items-center justify-between text-xs text-slate-300 font-mono">
                <span>Tokens: ~{m.totalTokens.toLocaleString()}</span>
                <span>Latency: {(m.durationMs / 1000).toFixed(1)}s</span>
              </div>
              {m.agreementRate !== undefined && (
                <div className="text-[11px] font-bold text-emerald-400 pt-0.5">
                  Inter-Strategy Agreement: {m.agreementRate.toFixed(1)}%
                </div>
              )}
            </div>
          ))}
        </div>
      )}

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

      {/* Consensus Diff View (When active) */}
      {showConsensusView && consensusItems.length > 0 ? (
        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/80 shadow-xl space-y-0">
          <div className="p-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-400 flex items-center space-x-1.5">
              <Scale className="h-4 w-4" />
              <span>Multi-Strategy Consensus Comparison (Strategy A vs. Strategy B)</span>
            </span>
            <span className="text-[11px] text-slate-400">
              Matches are auto-verified; discrepancies highlighted for review
            </span>
          </div>

          <div className="overflow-x-auto max-h-[600px]">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-900/90 text-slate-300 border-b border-slate-800 sticky top-0 z-10 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3 w-8 text-center">#</th>
                  <th className="p-3 w-40">Variable</th>
                  <th className="p-3">2-Pass Heading Value</th>
                  <th className="p-3">BM25 Search Value</th>
                  <th className="p-3 w-28 text-center">Consensus</th>
                  <th className="p-3 w-64">Adjudicated Override</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {consensusItems.map((c, idx) => (
                  <tr
                    key={idx}
                    className={`hover:bg-slate-900/50 transition ${
                      c.isConsensus ? 'bg-slate-950' : 'bg-amber-950/20'
                    }`}
                  >
                    <td className="p-3 text-center text-slate-500 font-mono text-[11px]">{idx + 1}</td>
                    <td className="p-3">
                      <span className="font-mono text-indigo-300 font-semibold">{c.variable}</span>
                    </td>
                    <td className="p-3 font-medium text-slate-200">{c.strategyAValue}</td>
                    <td className="p-3 font-medium text-slate-200">{c.strategyBValue}</td>
                    <td className="p-3 text-center">
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border ${
                          c.isConsensus
                            ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                            : 'bg-amber-950 text-amber-300 border-amber-800'
                        }`}
                      >
                        {c.isConsensus ? '✅ CONSENSUS' : '⚠️ DISCREPANCY'}
                      </span>
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        value={c.humanVerifiedValue || ''}
                        onChange={(e) => {
                          const updated = [...consensusItems];
                          updated[idx].humanVerifiedValue = e.target.value;
                          setConsensusItems(updated);
                        }}
                        placeholder="Final adjudicated value..."
                        className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded px-2.5 py-1 text-slate-200 text-xs"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : extractedResults.length === 0 ? (
        <div className="border border-slate-800 rounded-xl p-12 text-center bg-slate-950/60 space-y-3">
          <div className="p-3 bg-slate-900 text-slate-400 rounded-2xl w-fit mx-auto border border-slate-800">
            <FileCheck className="h-8 w-8" />
          </div>
          <h4 className="text-sm font-bold text-slate-200">No Extractions Run Yet</h4>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Select an extraction strategy above and click <strong>Run Extraction</strong> to extract data from your
            verified manuscripts.
          </p>
        </div>
      ) : (
        /* Standard Extraction Results Table */
        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/80 shadow-xl">
          <div className="overflow-x-auto max-h-[600px]">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-900/90 text-slate-300 border-b border-slate-800 sticky top-0 z-10 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3 w-8 text-center">#</th>
                  <th className="p-3 w-36">Manuscript</th>
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
                        <td className="p-2.5 font-medium text-slate-300 truncate max-w-[150px]" title={r.filename}>
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
                                Strategy: {r.strategyUsed || 'AI Extractor'} | Deduction & Justification
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
