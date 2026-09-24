import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  RotateCw,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Flag,
  ArrowRight,
  ArrowLeft,
  Eye,
  Download,
  Check,
  RefreshCw,
} from 'lucide-react';
import {
  DocumentConversionResult,
  ConvertedPageResult,
  AiGovernanceMode,
  DataResidencyRegion,
  GeminiModelVersion,
} from '../../types';
import { PdfExtractor } from '../../services/pdfExtractor';
import { GeminiService } from '../../services/geminiService';
import { DocxBuilder } from '../../services/docxBuilder';
import { getManuscriptFile } from '../../services/storageService';

interface VerificationStudioProps {
  filename: string;
  conversionResult?: DocumentConversionResult;
  onUpdateConversion: (filename: string, result: DocumentConversionResult) => void;
  apiKey: string;
  governanceMode: AiGovernanceMode;
  dataResidency: DataResidencyRegion;
  vertexProjectId: string;
  selectedModel: GeminiModelVersion;
  onApproveAndNext: () => void;
  onClose: () => void;
  showStatus: (text: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export const VerificationStudio: React.FC<VerificationStudioProps> = ({
  filename,
  conversionResult,
  onUpdateConversion,
  apiKey,
  governanceMode,
  dataResidency,
  vertexProjectId,
  selectedModel,
  onApproveAndNext,
  onClose,
  showStatus,
}) => {
  const [activePageNum, setActivePageNum] = useState<number>(1);
  const [customRotations, setCustomRotations] = useState<Record<number, number>>({});
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [isReExtracting, setIsReExtracting] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const leftPaneRef = useRef<HTMLDivElement | null>(null);
  const rightPaneRef = useRef<HTMLDivElement | null>(null);
  const isSyncScrolling = useRef<boolean>(false);

  // Load PDF Document on mount
  useEffect(() => {
    async function load() {
      const entry = await getManuscriptFile(filename);
      if (entry && entry.type === 'pdf') {
        const doc = await PdfExtractor.loadPdfDocument(entry.data);
        setPdfDoc(doc);
      }
    }
    load();
  }, [filename]);

  // Render PDF Canvas when page or rotation changes
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;
    const rot = customRotations[activePageNum] || 0;
    PdfExtractor.renderPageToCanvas(pdfDoc, activePageNum, canvasRef.current, 1.4, rot);
  }, [pdfDoc, activePageNum, customRotations]);

  // Proportional Synchronized Scrolling
  const handleScroll = (source: 'left' | 'right') => {
    if (isSyncScrolling.current) return;
    isSyncScrolling.current = true;

    const left = leftPaneRef.current;
    const right = rightPaneRef.current;

    if (left && right) {
      if (source === 'left') {
        const scrollPct = left.scrollTop / (left.scrollHeight - left.clientHeight || 1);
        right.scrollTop = scrollPct * (right.scrollHeight - right.clientHeight);
      } else {
        const scrollPct = right.scrollTop / (right.scrollHeight - right.clientHeight || 1);
        left.scrollTop = scrollPct * (left.scrollHeight - left.clientHeight);
      }
    }

    setTimeout(() => {
      isSyncScrolling.current = false;
    }, 50);
  };

  const handleRotatePage = () => {
    setCustomRotations((prev) => ({
      ...prev,
      [activePageNum]: ((prev[activePageNum] || 0) + 90) % 360,
    }));
    showStatus(`Rotated Page ${activePageNum} by 90°.`, 'info');
  };

  // One-Click Single-Page Gemini Vision Re-Extraction
  const handleGeminiPageReExtraction = async () => {
    if (!canvasRef.current || !conversionResult) return;

    if (!apiKey && !(governanceMode === 'ENTERPRISE_ZERO_TRAINING' && vertexProjectId)) {
      showStatus('Please configure an API Key or Vertex Project in Settings (⚙️) first.', 'error');
      return;
    }

    setIsReExtracting(true);
    showStatus(`Re-extracting Page ${activePageNum} with Gemini Vision...`, 'info');

    try {
      const base64Png = PdfExtractor.canvasToBase64Image(canvasRef.current);

      const prompt = `You are an expert OCR & academic document layout extraction engine.
Analyze this academic research paper page image.
Extract all headings, paragraphs, and tables with 100% fidelity.

CRITICAL INSTRUCTIONS:
1. Preserve true multi-column reading order (Left column Top-to-Bottom, then Right column Top-to-Bottom).
2. Convert all structured tables into standard GitHub Flavored Markdown (GFM) tables (| Header | ... |).
3. Do NOT omit numeric values, statistical symbols (p, F, t, d, M, SD), or formula notations.
4. Output a clean JSON array of structured elements:
[
  { "type": "heading", "level": 1 or 2, "content": "HEADING TEXT" },
  { "type": "paragraph", "content": "Paragraph text..." },
  { "type": "table_markdown", "content": "| Col 1 | Col 2 |\\n|---|---|\\n| Val 1 | Val 2 |" }
]`;

      const payload = {
        systemInstruction: { parts: [{ text: 'Respond only with a JSON array of structured page elements.' }] },
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: 'image/png',
                  data: base64Png,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.0,
          responseMimeType: 'application/json',
        },
      };

      const res = await GeminiService.callWithBackoff(
        payload,
        apiKey,
        governanceMode,
        dataResidency,
        vertexProjectId,
        selectedModel
      );

      const rawJson = res?.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
      const parsedElements = JSON.parse(rawJson);

      const updatedPages = [...conversionResult.pages];
      const pIdx = updatedPages.findIndex((p) => p.pageNumber === activePageNum);

      const newPageResult: ConvertedPageResult = {
        pageNumber: activePageNum,
        method: 'gemini_vision',
        rawText: parsedElements.map((el: any) => el.content).join('\n\n'),
        structuredElements: parsedElements,
      };

      if (pIdx >= 0) {
        updatedPages[pIdx] = newPageResult;
      } else {
        updatedPages.push(newPageResult);
      }

      const docxBlob = await DocxBuilder.buildDocxBlob(updatedPages);

      onUpdateConversion(filename, {
        ...conversionResult,
        pages: updatedPages,
        docxBlob,
      });

      showStatus(`Page ${activePageNum} successfully refined with Gemini Vision!`, 'success');
    } catch (err: any) {
      showStatus(`Gemini Vision extraction failed: ${err.message}`, 'error');
    } finally {
      setIsReExtracting(false);
    }
  };

  const handleDownloadDocx = () => {
    if (!conversionResult?.docxBlob) return;
    const url = URL.createObjectURL(conversionResult.docxBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.replace(/\.pdf$/i, '.docx');
    a.click();
    URL.revokeObjectURL(url);
    showStatus('Downloaded converted DOCX.', 'success');
  };

  const totalPages = conversionResult?.totalPages || pdfDoc?.numPages || 1;
  const activePageData = conversionResult?.pages.find((p) => p.pageNumber === activePageNum);
  const health = activePageData?.healthReport;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col animate-in fade-in">
      {/* Top Studio Control Bar */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-3 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center space-x-3 min-w-0">
          <div className="p-2 bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 rounded-lg">
            <FileText className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center space-x-2">
              <span className="text-xs bg-indigo-950 text-indigo-300 border border-indigo-800 px-2 py-0.5 rounded font-mono font-bold uppercase">
                Dual Verification
              </span>
              <h2 className="text-sm font-bold text-slate-100 truncate">{filename}</h2>
            </div>
            <p className="text-xs text-slate-400">
              Compare original PDF (left) against extracted DOCX structure (right)
            </p>
          </div>
        </div>

        {/* Page Nav & Action Controls */}
        <div className="flex items-center space-x-3 shrink-0">
          {/* Page Selector */}
          <div className="flex items-center space-x-1.5 bg-slate-950 border border-slate-800 px-2.5 py-1 rounded-lg text-xs">
            <button
              onClick={() => setActivePageNum((p) => Math.max(1, p - 1))}
              disabled={activePageNum <= 1}
              className="p-1 hover:text-indigo-400 disabled:opacity-30"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
            </button>
            <span className="font-mono text-slate-300 font-semibold px-2">
              Page {activePageNum} of {totalPages}
            </span>
            <button
              onClick={() => setActivePageNum((p) => Math.min(totalPages, p + 1))}
              disabled={activePageNum >= totalPages}
              className="p-1 hover:text-indigo-400 disabled:opacity-30"
            >
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Rotate 90° */}
          <button
            onClick={handleRotatePage}
            className="px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg flex items-center space-x-1.5 transition"
          >
            <RotateCw className="h-3.5 w-3.5 text-slate-400" />
            <span>Rotate 90°</span>
          </button>

          {/* Gemini Page Re-Extraction */}
          <button
            onClick={handleGeminiPageReExtraction}
            disabled={isReExtracting}
            className="px-3 py-1.5 text-xs font-semibold bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white rounded-lg shadow flex items-center space-x-1.5 transition disabled:opacity-50"
          >
            {isReExtracting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            <span>Refine Page with Gemini</span>
          </button>

          {/* Download DOCX */}
          <button
            onClick={handleDownloadDocx}
            className="px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg flex items-center space-x-1.5 transition"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export DOCX</span>
          </button>

          {/* Approve & Next */}
          <button
            onClick={onApproveAndNext}
            className="px-4 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow flex items-center space-x-1.5 transition"
          >
            <Check className="h-4 w-4" />
            <span>Approve Manuscript</span>
          </button>

          {/* Close Studio */}
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition"
          >
            Exit Studio
          </button>
        </div>
      </div>

      {/* Main Dual-Pane Viewport */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 overflow-hidden bg-slate-950 divide-x divide-slate-800">
        {/* Left Pane: Original Native PDF Canvas */}
        <div
          ref={leftPaneRef}
          onScroll={() => handleScroll('left')}
          className="h-full overflow-y-auto p-6 flex flex-col items-center bg-slate-900/40"
        >
          <div className="w-full max-w-2xl bg-slate-950 border border-slate-800 rounded-xl p-3 shadow-2xl space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-800 pb-2 px-1">
              <span className="font-semibold text-slate-200">📄 Original PDF Page View</span>
              <span>Render Scale: 1.4x</span>
            </div>
            <div className="flex justify-center overflow-auto rounded bg-white/5 p-2">
              <canvas ref={canvasRef} className="shadow-lg max-w-full h-auto rounded" />
            </div>
          </div>
        </div>

        {/* Right Pane: Structured Extracted DOCX Stream */}
        <div
          ref={rightPaneRef}
          onScroll={() => handleScroll('right')}
          className="h-full overflow-y-auto p-6 space-y-4 bg-slate-950"
        >
          {/* Page Health / QC Badge Strip */}
          {health && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-start space-x-2.5 ${
                health.needsGeminiFallback
                  ? 'bg-amber-950/40 border-amber-800/80 text-amber-300'
                  : 'bg-emerald-950/40 border-emerald-800/80 text-emerald-300'
              }`}
            >
              {health.needsGeminiFallback ? (
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-400" />
              ) : (
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-400" />
              )}
              <div className="space-y-1">
                <div className="font-bold flex items-center space-x-2">
                  <span>
                    {health.needsGeminiFallback
                      ? '⚠️ Layout Anomaly Detected (Gemini Refinement Recommended)'
                      : '✅ Clean Extraction Health Check'}
                  </span>
                  <span className="text-[10px] bg-slate-900 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700 font-mono">
                    {health.detectedColumns}-Column Mode
                  </span>
                </div>
                {health.reasons.length > 0 && (
                  <ul className="list-disc pl-4 text-[11px] space-y-0.5 text-amber-200/80">
                    {health.reasons.map((r, idx) => (
                      <li key={idx}>{r}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {/* Render Structured Elements of Active Page */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4 shadow-xl">
            <div className="text-[11px] font-mono text-indigo-400 font-bold border-b border-slate-800 pb-2 flex items-center justify-between">
              <span>--- PAGE {activePageNum} STRUCTURED STREAM ---</span>
              <span className="text-slate-400 font-normal">
                Method: {activePageData?.method === 'gemini_vision' ? 'Gemini Multimodal' : 'Spatial Algorithm'}
              </span>
            </div>

            {!activePageData || activePageData.structuredElements.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-8 text-center">
                No structured text extracted on this page yet.
              </p>
            ) : (
              activePageData.structuredElements.map((el, eIdx) => {
                if (el.type === 'heading') {
                  return (
                    <h3
                      key={eIdx}
                      className={`font-bold text-indigo-300 ${
                        el.level === 1 ? 'text-base mt-4 border-b border-slate-800 pb-1' : 'text-sm mt-3'
                      }`}
                    >
                      {el.content}
                    </h3>
                  );
                } else if (el.type === 'table_markdown') {
                  return (
                    <div key={eIdx} className="bg-slate-950 p-3 rounded-lg border border-slate-800 overflow-x-auto">
                      <pre className="text-xs font-mono text-emerald-400 whitespace-pre-wrap">{el.content}</pre>
                    </div>
                  );
                } else {
                  return (
                    <p key={eIdx} className="text-xs text-slate-300 leading-relaxed">
                      {el.content}
                    </p>
                  );
                }
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
