export type AiGovernanceMode = 'DATA_SHARING_FREE' | 'ENTERPRISE_ZERO_TRAINING';

export type DataResidencyRegion =
  | 'northamerica-northeast1' // Canada (Montreal)
  | 'us-central1'             // USA (Iowa)
  | 'us-east4'                // USA (N. Virginia)
  | 'europe-west3'            // Europe (Frankfurt)
  | 'europe-west1'            // Europe (Belgium)
  | 'asia-northeast1';        // Asia (Tokyo)

export type GeminiModelVersion =
  | 'gemini-2.5-flash'
  | 'gemini-2.5-pro'
  | 'gemini-2.0-flash'
  | 'gemini-2.0-pro-exp'
  | 'gemini-1.5-pro'
  | 'gemini-1.5-flash';

export interface CodebookVariable {
  domain: string;
  variable: string;
  description: string;
  example: string;
  notesQuestions: string;
}

export interface CodebookDomainCluster {
  [domainName: string]: string[];
}

export interface DocumentSection {
  heading: string;
  level: number;
  content: string[]; // text or table markdown
}

export interface ExtractedParagraphItem {
  globalIndex: number;
  type: 'paragraph' | 'table_markdown' | 'heading';
  heading: string;
  content: string;
  pageNumber: number;
}

export interface LayoutHealthReport {
  pageNumber: number;
  detectedColumns: number;
  isRotated: boolean;
  rotationAngle: number;
  tableChaosScore: number;
  dictionaryEntropyScore: number;
  lineDiscontinuityScore: number;
  needsGeminiFallback: boolean;
  reasons: string[];
}

export interface ConvertedPageResult {
  pageNumber: number;
  method: 'spatial_client' | 'gemini_vision';
  rawText: string;
  structuredElements: Array<{
    type: 'heading' | 'paragraph' | 'table_markdown';
    level?: number;
    content: string;
  }>;
  healthReport?: LayoutHealthReport;
}

export interface DocumentConversionResult {
  filename: string;
  totalPages: number;
  pages: ConvertedPageResult[];
  status: 'converting' | 'completed' | 'failed' | 'needs_review';
  approved: boolean;
  flagged: boolean;
  flaggedReason?: string;
  docxBlob?: Blob;
}

export interface Pass1ClassificationResult {
  heading: string;
  classifications: {
    [globalIndex: number]: Array<{
      tag: string;
      confidence: number;
    }>;
  };
}

export interface Pass2ExtractedVariable {
  filename: string;
  variable: string;
  domain: string;
  extractedValue: string;
  confidence: number;
  indices: number[];
  justification: string;
  relevantSnippets: string[];
  humanVerifiedValue?: string;
  status: 'pending' | 'verified' | 'flagged';
}

export interface CodebookSnapshot {
  id: string;
  timestamp: string;
  source: string;
  note: string;
  variables: CodebookVariable[];
}
