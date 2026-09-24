import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Settings,
  BookOpen,
  FolderOpen,
  Sparkles,
  CheckCircle2,
  Shield,
  HelpCircle,
} from 'lucide-react';
import { useAppState } from './hooks/useAppState';
import { SettingsModal } from './components/settings/SettingsModal';
import { CodebookStudio } from './components/codebook/CodebookStudio';
import { ManuscriptManager } from './components/pdf/ManuscriptManager';
import { VerificationStudio } from './components/studio/VerificationStudio';
import { ExtractionStudio } from './components/extraction/ExtractionStudio';

export function App() {
  const {
    activeStep,
    setActiveStep,
    apiKey,
    governanceMode,
    dataResidency,
    vertexProjectId,
    selectedModel,
    updateSettings,
    codebookVariables,
    updateCodebook,
    codebookSnapshots,
    restoreCodebookSnapshot,
    uploadedFiles,
    addUploadedFiles,
    removeUploadedFile,
    conversionResults,
    setConversionResults,
    activeVerificationFile,
    setActiveVerificationFile,
    extractedResults,
    setExtractedResults,
    isExtracting,
    setIsExtracting,
    extractionProgress,
    setExtractionProgress,
    statusMessage,
    showStatus,
  } = useAppState();

  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  const steps = [
    { id: 0, label: 'Manuscripts & PDF Conversion', icon: FolderOpen },
    { id: 1, label: 'Systematic Codebook Grid', icon: BookOpen },
    { id: 2, label: '2-Pass AI Literature Extraction', icon: Sparkles },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Navigation Bar */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-40 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-gradient-to-br from-indigo-600 to-cyan-600 rounded-xl text-white shadow-md">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-sm font-bold tracking-tight text-white">AI Data Extractor Studio</h1>
              <span className="text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-800 px-2 py-0.5 rounded-full font-mono">
                v2.0 Client Sandbox
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Systematic literature review & structured data extraction workbench
            </p>
          </div>
        </div>

        {/* Status / Governance Badge & Settings Trigger */}
        <div className="flex items-center space-x-3">
          <div className="hidden sm:flex items-center space-x-2 px-3 py-1 bg-slate-900 border border-slate-800 rounded-lg text-xs">
            <Shield className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-slate-300 font-medium">
              {governanceMode === 'ENTERPRISE_ZERO_TRAINING' ? 'Enterprise Vertex Mode' : 'AI Studio BYOK'}
            </span>
          </div>

          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg border border-slate-800 transition flex items-center space-x-1 text-xs font-semibold"
            title="Settings & AI Governance"
          >
            <Settings className="h-4 w-4" />
            <span className="hidden md:inline">Settings</span>
          </button>
        </div>
      </header>

      {/* Stepper Navigation Strip */}
      <div className="bg-slate-900/40 border-b border-slate-800/60 px-6 py-2.5 flex items-center justify-between">
        <div className="flex items-center space-x-2 overflow-x-auto max-w-full">
          {steps.map((s, idx) => {
            const Icon = s.icon;
            const isActive = activeStep === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setActiveStep(s.id)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-2 transition ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{s.label}</span>
              </button>
            );
          })}
        </div>

        {/* Global Stats Summary */}
        <div className="hidden lg:flex items-center space-x-4 text-xs font-mono text-slate-400">
          <span>Manuscripts: <strong className="text-slate-200">{uploadedFiles.length}</strong></span>
          <span>Variables: <strong className="text-slate-200">{codebookVariables.length}</strong></span>
          <span>Extractions: <strong className="text-emerald-400">{extractedResults.length}</strong></span>
        </div>
      </div>

      {/* Toast Notification Banner */}
      {statusMessage && (
        <div
          className={`px-6 py-2 text-xs font-medium flex items-center justify-between border-b ${
            statusMessage.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-800 text-emerald-200'
              : statusMessage.type === 'error'
              ? 'bg-rose-950/80 border-rose-800 text-rose-200'
              : statusMessage.type === 'warning'
              ? 'bg-amber-950/80 border-amber-800 text-amber-200'
              : 'bg-indigo-950/80 border-indigo-800 text-indigo-200'
          }`}
        >
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
        {activeStep === 0 && (
          <ManuscriptManager
            uploadedFiles={uploadedFiles}
            conversionResults={conversionResults}
            onAddFiles={addUploadedFiles}
            onRemoveFile={removeUploadedFile}
            onUpdateConversion={(name, res) =>
              setConversionResults((prev) => ({ ...prev, [name]: res }))
            }
            onOpenVerificationStudio={(name) => setActiveVerificationFile(name)}
            showStatus={showStatus}
          />
        )}

        {activeStep === 1 && (
          <CodebookStudio
            variables={codebookVariables}
            snapshots={codebookSnapshots}
            onUpdateCodebook={updateCodebook}
            onRestoreSnapshot={restoreCodebookSnapshot}
            showStatus={showStatus}
          />
        )}

        {activeStep === 2 && (
          <ExtractionStudio
            conversionResults={conversionResults}
            codebookVariables={codebookVariables}
            extractedResults={extractedResults}
            onUpdateResults={setExtractedResults}
            apiKey={apiKey}
            governanceMode={governanceMode}
            dataResidency={dataResidency}
            vertexProjectId={vertexProjectId}
            selectedModel={selectedModel}
            isExtracting={isExtracting}
            setIsExtracting={setIsExtracting}
            progress={extractionProgress}
            setProgress={setExtractionProgress}
            showStatus={showStatus}
          />
        )}
      </main>

      {/* Full-Screen Dual-Pane Verification Modal Studio */}
      {activeVerificationFile && (
        <VerificationStudio
          filename={activeVerificationFile}
          conversionResult={conversionResults[activeVerificationFile]}
          onUpdateConversion={(name, res) =>
            setConversionResults((prev) => ({ ...prev, [name]: res }))
          }
          apiKey={apiKey}
          governanceMode={governanceMode}
          dataResidency={dataResidency}
          vertexProjectId={vertexProjectId}
          selectedModel={selectedModel}
          onApproveAndNext={() => {
            const currentIdx = uploadedFiles.findIndex((f) => f.name === activeVerificationFile);
            if (conversionResults[activeVerificationFile]) {
              setConversionResults((prev) => ({
                ...prev,
                [activeVerificationFile]: {
                  ...prev[activeVerificationFile],
                  approved: true,
                },
              }));
            }
            showStatus(`Approved manuscript '${activeVerificationFile}'.`, 'success');
            if (currentIdx < uploadedFiles.length - 1) {
              setActiveVerificationFile(uploadedFiles[currentIdx + 1].name);
            } else {
              setActiveVerificationFile(null);
            }
          }}
          onClose={() => setActiveVerificationFile(null)}
          showStatus={showStatus}
        />
      )}

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        apiKey={apiKey}
        governanceMode={governanceMode}
        dataResidency={dataResidency}
        vertexProjectId={vertexProjectId}
        selectedModel={selectedModel}
        onSave={updateSettings}
      />
    </div>
  );
}
