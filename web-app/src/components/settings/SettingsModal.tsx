import React, { useState } from 'react';
import {
  Key,
  Shield,
  Zap,
  Globe,
  Sparkles,
  X,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { AiGovernanceMode, DataResidencyRegion, GeminiModelVersion } from '../../types';
import { GeminiService } from '../../services/geminiService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey: string;
  governanceMode: AiGovernanceMode;
  dataResidency: DataResidencyRegion;
  vertexProjectId: string;
  selectedModel: GeminiModelVersion;
  onSave: (
    key: string,
    mode: AiGovernanceMode,
    region: DataResidencyRegion,
    proj: string,
    model: GeminiModelVersion
  ) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  apiKey,
  governanceMode,
  dataResidency,
  vertexProjectId,
  selectedModel,
  onSave,
}) => {
  const [localKey, setLocalKey] = useState<string>(apiKey);
  const [localMode, setLocalMode] = useState<AiGovernanceMode>(governanceMode);
  const [localRegion, setLocalRegion] = useState<DataResidencyRegion>(dataResidency);
  const [localProjectId, setLocalProjectId] = useState<string>(vertexProjectId);
  const [localModel, setLocalModel] = useState<GeminiModelVersion>(selectedModel);

  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ valid: boolean; message: string } | null>(null);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await GeminiService.testConnection(
        localKey.trim(),
        localMode,
        localRegion,
        localProjectId.trim(),
        localModel
      );
      setTestResult(res);
    } catch (err: any) {
      setTestResult({ valid: false, message: `Test failed: ${err.message || err}` });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    onSave(localKey.trim(), localMode, localRegion, localProjectId.trim(), localModel);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
      <div className="bg-slate-950 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-md">
              <Key className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-base">AI Governance & API Settings</h3>
              <p className="text-xs text-slate-400">Configure foundation model, BYOK credentials & privacy mode</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-900 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* AI Governance Mode */}
        <div className="space-y-3">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-200">
            Select AI Governance & Privacy Mode
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Enterprise Vertex Mode */}
            <div
              onClick={() => {
                setLocalMode('ENTERPRISE_ZERO_TRAINING');
                setTestResult(null);
              }}
              className={`p-4 rounded-xl border cursor-pointer transition flex flex-col justify-between space-y-2 ${
                localMode === 'ENTERPRISE_ZERO_TRAINING'
                  ? 'bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/40 shadow-lg'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="flex items-center space-x-1.5 text-xs font-bold text-emerald-400">
                    <Shield className="h-4 w-4" />
                    <span>Enterprise Vertex Mode</span>
                  </span>
                  {localMode === 'ENTERPRISE_ZERO_TRAINING' && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  )}
                </div>
                <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded-full font-mono block w-fit">
                  Zero Data Retention
                </span>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Enterprise Google Cloud Vertex AI REST connection. Data is isolated to your GCP Project and never used for training.
                </p>
              </div>
            </div>

            {/* Google AI Studio Free Mode */}
            <div
              onClick={() => {
                setLocalMode('DATA_SHARING_FREE');
                setTestResult(null);
              }}
              className={`p-4 rounded-xl border cursor-pointer transition flex flex-col justify-between space-y-2 ${
                localMode === 'DATA_SHARING_FREE'
                  ? 'bg-amber-950/40 border-amber-500 ring-2 ring-amber-500/40 shadow-lg'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="flex items-center space-x-1.5 text-xs font-bold text-amber-400">
                    <Zap className="h-4 w-4" />
                    <span>Google AI Studio</span>
                  </span>
                  {localMode === 'DATA_SHARING_FREE' && (
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  )}
                </div>
                <span className="text-[10px] bg-amber-950 text-amber-300 border border-amber-800 px-2 py-0.5 rounded-full font-mono block w-fit">
                  Standard API Key
                </span>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Connect using a standard Gemini API key (`AIzaSy...`). Simple setup, ideal for non-confidential published literature.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Gemini Model Selector */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 space-y-2">
          <label className="text-xs font-bold text-slate-200 flex items-center space-x-1.5">
            <Sparkles className="h-4 w-4 text-indigo-400" />
            <span>Gemini Foundation Model</span>
          </label>
          <select
            value={localModel}
            onChange={(e) => setLocalModel(e.target.value as GeminiModelVersion)}
            className="w-full bg-slate-950 border border-slate-700 text-xs rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 font-medium"
          >
            <option value="gemini-2.0-flash">⚡ Gemini 2.0 Flash (Recommended: Fast & Multimodal)</option>
            <option value="gemini-2.5-flash">🚀 Gemini 2.5 Flash (Advanced Synthesis)</option>
            <option value="gemini-2.5-pro">🧠 Gemini 2.5 Pro (Deep Research & Complex Extraction)</option>
            <option value="gemini-1.5-pro">🏛️ Gemini 1.5 Pro (Extended Context Window)</option>
          </select>
        </div>

        {/* Enterprise Vertex Settings */}
        {localMode === 'ENTERPRISE_ZERO_TRAINING' && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 space-y-2.5 animate-in fade-in">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 flex items-center space-x-1.5">
                <Globe className="h-4 w-4 text-emerald-400" />
                <span>Geographic Data Residency</span>
              </span>
            </div>
            <select
              value={localRegion}
              onChange={(e) => setLocalRegion(e.target.value as DataResidencyRegion)}
              className="w-full bg-slate-950 border border-slate-700 text-xs rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500 font-medium"
            >
              <option value="us-central1">🇺🇸 USA (Iowa - us-central1)</option>
              <option value="us-east4">🇺🇸 USA East (N. Virginia - us-east4)</option>
              <option value="northamerica-northeast1">🇨🇦 Canada (Montreal - northamerica-northeast1)</option>
              <option value="europe-west3">🇪🇺 Europe (Frankfurt - europe-west3)</option>
              <option value="asia-northeast1">🇯🇵 Asia (Tokyo - asia-northeast1)</option>
            </select>

            <div className="space-y-1 pt-1">
              <label className="block text-[11px] text-slate-400">Google Cloud Project ID</label>
              <input
                type="text"
                value={localProjectId}
                onChange={(e) => setLocalProjectId(e.target.value)}
                placeholder="e.g. my-research-project-12345"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        )}

        {/* API Key Input */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
          <label className="text-xs font-bold text-slate-200 flex items-center justify-between">
            <span>{localMode === 'ENTERPRISE_ZERO_TRAINING' ? 'OAuth Bearer Token / GCP Key' : 'Google AI Studio API Key'}</span>
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting}
              className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center space-x-1"
            >
              {isTesting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              <span>Test Connection</span>
            </button>
          </label>
          <input
            type="password"
            value={localKey}
            onChange={(e) => setLocalKey(e.target.value)}
            placeholder={localMode === 'ENTERPRISE_ZERO_TRAINING' ? 'ya29.a0... or GCP Key' : 'AIzaSy...'}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
          />

          {testResult && (
            <div
              className={`p-2.5 rounded-lg border text-xs flex items-start space-x-2 ${
                testResult.valid
                  ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
                  : 'bg-rose-950/60 border-rose-800 text-rose-300'
              }`}
            >
              {testResult.valid ? <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" /> : <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />}
              <span>{testResult.message}</span>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end space-x-3 pt-2 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-900 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg shadow-md hover:shadow-indigo-500/25 transition"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};
