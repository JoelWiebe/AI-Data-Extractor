export type ExtractionStrategyMode =
  | 'INDEXED_SEARCH'       // Strategy B: BM25 + Query Expansion [Fast & Lowest Token Cost]
  | 'HEADING_CLASSIFIER'   // Strategy A: Classic 2-Pass Heading Classification [Baseline]
  | 'WHOLE_DOC_SYNTHESIS'  // Strategy C: Whole Document Long-Context [Single-Shot]
  | 'CONSENSUS_BENCHMARK'; // Multi-Strategy Comparison & Consensus [Runs A & B in parallel]

export interface StrategyBenchmarkMetrics {
  strategyName: string;
  totalTokens: number;
  durationMs: number;
  variablesExtracted: number;
  agreementRate?: number;
}
