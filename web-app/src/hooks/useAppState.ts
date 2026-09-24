import { useState, useEffect, useCallback } from 'react';
import {
  AiGovernanceMode,
  DataResidencyRegion,
  GeminiModelVersion,
  CodebookVariable,
  DocumentConversionResult,
  Pass2ExtractedVariable,
  CodebookSnapshot,
} from '../types';
import {
  loadSetting,
  saveSetting,
  listCodebookSnapshots,
  saveCodebookSnapshot,
  storeManuscriptFile,
  getManuscriptFile,
  removeManuscriptFile,
} from '../services/storageService';
import { CodebookService } from '../services/codebookService';

export function useAppState() {
  // Wizard Navigation
  const [activeStep, setActiveStep] = useState<number>(0);

  // Settings & Credentials
  const [apiKey, setApiKey] = useState<string>('');
  const [governanceMode, setGovernanceMode] = useState<AiGovernanceMode>('DATA_SHARING_FREE');
  const [dataResidency, setDataResidency] = useState<DataResidencyRegion>('us-central1');
  const [vertexProjectId, setVertexProjectId] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<GeminiModelVersion>('gemini-2.0-flash');

  // Codebook State
  const [codebookVariables, setCodebookVariables] = useState<CodebookVariable[]>(CodebookService.DEFAULT_ECE_TEMPLATE);
  const [codebookSnapshots, setCodebookSnapshots] = useState<CodebookSnapshot[]>([]);

  // Manuscripts & Conversion State
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ name: string; size: number; type: 'pdf' | 'docx' }>>([]);
  const [conversionResults, setConversionResults] = useState<Record<string, DocumentConversionResult>>({});
  const [activeVerificationFile, setActiveVerificationFile] = useState<string | null>(null);

  // Extractions State
  const [extractedResults, setExtractedResults] = useState<Pass2ExtractedVariable[]>([]);
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [extractionProgress, setExtractionProgress] = useState<{ current: number; total: number; label: string } | null>(null);

  // Notification status
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'info' | 'success' | 'warning' | 'error' } | null>(null);

  const showStatus = useCallback((text: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    setStatusMessage({ text, type });
    setTimeout(() => {
      setStatusMessage(null);
    }, 5000);
  }, []);

  // Initialize from IndexedDB on startup
  useEffect(() => {
    async function init() {
      const savedKey = await loadSetting<string>('apiKey', '');
      const savedMode = await loadSetting<AiGovernanceMode>('governanceMode', 'DATA_SHARING_FREE');
      const savedRegion = await loadSetting<DataResidencyRegion>('dataResidency', 'us-central1');
      const savedProj = await loadSetting<string>('vertexProjectId', '');
      const savedModel = await loadSetting<GeminiModelVersion>('selectedModel', 'gemini-2.0-flash');
      const savedVars = await loadSetting<CodebookVariable[]>('codebookVariables', CodebookService.DEFAULT_ECE_TEMPLATE);

      setApiKey(savedKey);
      setGovernanceMode(savedMode);
      setDataResidency(savedRegion);
      setVertexProjectId(savedProj);
      setSelectedModel(savedModel);
      setCodebookVariables(savedVars);

      const snapshots = await listCodebookSnapshots();
      setCodebookSnapshots(snapshots);
    }
    init();
  }, []);

  // Sync settings changes to IndexedDB
  const updateSettings = useCallback(
    async (
      newKey: string,
      newMode: AiGovernanceMode,
      newRegion: DataResidencyRegion,
      newProj: string,
      newModel: GeminiModelVersion
    ) => {
      setApiKey(newKey);
      setGovernanceMode(newMode);
      setDataResidency(newRegion);
      setVertexProjectId(newProj);
      setSelectedModel(newModel);

      await saveSetting('apiKey', newKey);
      await saveSetting('governanceMode', newMode);
      await saveSetting('dataResidency', newRegion);
      await saveSetting('vertexProjectId', newProj);
      await saveSetting('selectedModel', newModel);
      showStatus('Settings & Governance saved securely.', 'success');
    },
    [showStatus]
  );

  // Save Codebook Variables & Auto-Snapshot
  const updateCodebook = useCallback(
    async (variables: CodebookVariable[], source: string = 'Manual Edit', note: string = '') => {
      setCodebookVariables(variables);
      await saveSetting('codebookVariables', variables);
      const snapshot = await saveCodebookSnapshot(variables, source, note);
      setCodebookSnapshots((prev) => [snapshot, ...prev]);
    },
    []
  );

  // Revert Codebook Snapshot
  const restoreCodebookSnapshot = useCallback(
    async (snapshot: CodebookSnapshot) => {
      setCodebookVariables(snapshot.variables);
      await saveSetting('codebookVariables', snapshot.variables);
      const newSnap = await saveCodebookSnapshot(
        snapshot.variables,
        'Snapshot Rollback',
        `Restored from snapshot '${snapshot.id}'`
      );
      setCodebookSnapshots((prev) => [newSnap, ...prev]);
      showStatus(`Restored codebook snapshot from ${new Date(snapshot.timestamp).toLocaleString()}.`, 'success');
    },
    [showStatus]
  );

  // Add Uploaded Files
  const addUploadedFiles = useCallback(async (files: File[]) => {
    const newItems: Array<{ name: string; size: number; type: 'pdf' | 'docx' }> = [];
    for (const f of files) {
      const type = f.name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'docx';
      await storeManuscriptFile(f.name, f);
      newItems.push({ name: f.name, size: f.size, type });
    }
    setUploadedFiles((prev) => {
      const existingNames = new Set(prev.map((p) => p.name));
      const filtered = newItems.filter((it) => !existingNames.has(it.name));
      return [...prev, ...filtered];
    });
  }, []);

  // Remove Manuscript
  const removeUploadedFile = useCallback(async (filename: string) => {
    await removeManuscriptFile(filename);
    setUploadedFiles((prev) => prev.filter((p) => p.name !== filename));
    setConversionResults((prev) => {
      const next = { ...prev };
      delete next[filename];
      return next;
    });
  }, []);

  return {
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
  };
}
