import {
  CodebookVariable,
  ExtractedParagraphItem,
  Pass2ExtractedVariable,
  AiGovernanceMode,
  DataResidencyRegion,
  GeminiModelVersion,
} from '../types';
import { BM25Indexer } from './bm25Indexer';
import { QueryExpander } from './queryExpander';
import { GeminiService, GeminiPayload } from './geminiService';

export class SearchExtractionEngine {
  /**
   * Strategy B: Indexed BM25 Targeted Search Extraction
   * Indexes the paper into BM25 documents, queries with expanded academic synonyms,
   * slices top context windows, and extracts with Gemini using 70-85% fewer tokens.
   */
  public static async runIndexedSearchExtraction(
    filename: string,
    items: ExtractedParagraphItem[],
    variables: CodebookVariable[],
    apiKey: string,
    mode: AiGovernanceMode = 'DATA_SHARING_FREE',
    region: DataResidencyRegion = 'us-central1',
    vertexProjectId?: string,
    modelName: GeminiModelVersion = 'gemini-2.0-flash',
    onProgress?: (current: number, total: number, variableName: string) => void
  ): Promise<{ results: Pass2ExtractedVariable[]; totalTokensEstimated: number }> {
    // 1. Build Inverted Index
    const indexer = new BM25Indexer();
    indexer.buildIndex(items);

    const extractedResults: Pass2ExtractedVariable[] = [];
    let totalEstimatedTokens = 0;

    for (let vIdx = 0; vIdx < variables.length; vIdx++) {
      const v = variables[vIdx];
      if (onProgress) onProgress(vIdx + 1, variables.length, v.variable);

      // 2. Expand Query Terms
      const queryTerms = QueryExpander.expandQuery(v);

      // 3. Search Top-K most relevant paragraphs
      const searchMatches = indexer.search(queryTerms, 4);
      const topDocs = searchMatches.map((m) => m.doc);

      // 4. Expand Context Windows (include neighboring paragraphs)
      const contextDocs = indexer.getExpandedContext(topDocs);

      // Assemble targeted snippets payload
      const targetedSnippets: Record<string, string> = {};
      let excerptWordCount = 0;

      contextDocs.forEach((d) => {
        targetedSnippets[String(d.globalIndex)] = `[Page ${d.pageNumber} | Heading: ${d.heading}]\n${d.rawText}`;
        excerptWordCount += d.rawText.split(/\s+/).length;
      });

      totalEstimatedTokens += Math.round(excerptWordCount * 1.33);

      const systemPrompt = `You are a precision academic data extractor for systematic literature reviews.
Your task is to extract the target variable from the provided indexed excerpts of an academic manuscript.

CRITICAL PRIMARY STUDY SCOPING RULE:
Focus EXCLUSIVELY on information that describes the primary, current research study being conducted and reported.
Do NOT extract values that pertain to other studies, previous work, or background literature that are merely cited.
If the variable is not found in the excerpts or only cited from other works, return "Not Found".

TARGET VARIABLE SPECIFICATION:
Name: ${v.variable}
Domain: ${v.domain}
Description: ${v.description}
Examples: ${v.example || 'N/A'}
Notes/Guiding Questions: ${v.notesQuestions || 'N/A'}

OUTPUT SCHEMA:
Return a JSON object with:
{
  "value": string,          // Extracted value or "Not Found"
  "confidence": number,     // 0.0 to 1.0
  "indices": number[],      // Integer global indices of the excerpts directly supporting this value
  "justification": string   // Single concise sentence explaining the derivation referencing the source excerpt
}`;

      const userPrompt = `INDEXED EXCERPTS:\n${JSON.stringify(targetedSnippets, null, 2)}`;

      const payload: GeminiPayload = {
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature: 0.0,
          responseMimeType: 'application/json',
        },
      };

      try {
        const res = await GeminiService.callWithBackoff(payload, apiKey, mode, region, vertexProjectId, modelName);
        const rawJson = res?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        const parsed = JSON.parse(rawJson);

        const indices = Array.isArray(parsed.indices)
          ? parsed.indices.map((i: any) => parseInt(i, 10)).filter((n: number) => !isNaN(n))
          : [];

        const relevantSnippets = indices
          .map((idx: number) => {
            const item = items.find((it) => it.globalIndex === idx);
            return item ? `[Idx ${idx} | P.${item.pageNumber}] ${item.content}` : '';
          })
          .filter(Boolean);

        extractedResults.push({
          filename,
          variable: v.variable,
          domain: v.domain,
          extractedValue: String(parsed.value || 'Not Found').trim(),
          confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.8,
          indices,
          justification: String(parsed.justification || 'Extracted via indexed BM25 search.').trim(),
          relevantSnippets,
          status: 'pending',
        });
      } catch (err: any) {
        console.error(`[SearchExtractionEngine] Error extracting '${v.variable}':`, err);
        extractedResults.push({
          filename,
          variable: v.variable,
          domain: v.domain,
          extractedValue: 'Extraction Error',
          confidence: 0,
          indices: [],
          justification: `Failed to extract: ${err.message}`,
          relevantSnippets: [],
          status: 'flagged',
        });
      }
    }

    return { results: extractedResults, totalTokensEstimated: totalEstimatedTokens };
  }
}
