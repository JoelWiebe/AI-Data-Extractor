import {
  CodebookVariable,
  ExtractedParagraphItem,
  Pass2ExtractedVariable,
  AiGovernanceMode,
  DataResidencyRegion,
  GeminiModelVersion,
} from '../types';
import { GeminiService, GeminiPayload } from './geminiService';

export class WholeDocExtractionEngine {
  /**
   * Strategy C: Whole-Document Long-Context Extraction
   * Feeds the complete pre-references manuscript into Gemini in a single prompt to extract all codebook variables at once.
   */
  public static async runWholeDocExtraction(
    filename: string,
    items: ExtractedParagraphItem[],
    variables: CodebookVariable[],
    apiKey: string,
    mode: AiGovernanceMode = 'DATA_SHARING_FREE',
    region: DataResidencyRegion = 'us-central1',
    vertexProjectId?: string,
    modelName: GeminiModelVersion = 'gemini-2.0-flash',
    onProgress?: (status: string) => void
  ): Promise<{ results: Pass2ExtractedVariable[]; totalTokensEstimated: number }> {
    if (onProgress) onProgress(`Formatting whole manuscript for ${variables.length} variables...`);

    const fullDocumentPayload: Record<string, string> = {};
    let totalWords = 0;

    items.forEach((it) => {
      fullDocumentPayload[String(it.globalIndex)] = `[Page ${it.pageNumber} | Heading: ${it.heading}]\n${it.type === 'table_markdown' ? '[Table MD]\n' : ''}${it.content}`;
      totalWords += it.content.split(/\s+/).length;
    });

    const totalEstimatedTokens = Math.round(totalWords * 1.33);

    const varSpecs: Record<string, any> = {};
    variables.forEach((v) => {
      varSpecs[v.variable] = {
        domain: v.domain,
        description: v.description,
        examples: v.example,
        notes_questions: v.notesQuestions,
      };
    });

    const systemPrompt = `You are an expert research data extractor for academic systematic reviews.
You are given the entire text of a research paper up to the REFERENCES section.
Your task is to extract values for ALL specified target variables in a single comprehensive synthesis.

CRITICAL PRIMARY STUDY SCOPING RULE:
Focus EXCLUSIVELY on information that describes the primary, current research study being conducted and reported.
Do NOT extract values that pertain to other studies or background literature that are merely cited.
If a variable is only mentioned in cited works or not found, return "Not Found".

TARGET VARIABLES:
${JSON.stringify(varSpecs, null, 2)}

OUTPUT SCHEMA:
Return a JSON object where each key is a variable name mapping to:
{
  "value": string,
  "confidence": number,
  "indices": number[],
  "justification": string
}`;

    const userPrompt = `MANUSCRIPT EXCERPTS:\n${JSON.stringify(fullDocumentPayload, null, 2)}`;

    const payload: GeminiPayload = {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: 0.0,
        responseMimeType: 'application/json',
      },
    };

    if (onProgress) onProgress(`Calling Gemini (${totalEstimatedTokens.toLocaleString()} tokens)...`);

    const extractedResults: Pass2ExtractedVariable[] = [];

    try {
      const res = await GeminiService.callWithBackoff(payload, apiKey, mode, region, vertexProjectId, modelName);
      const rawJson = res?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      const parsed = JSON.parse(rawJson);

      for (const v of variables) {
        const out = parsed[v.variable] || {};
        const indices = Array.isArray(out.indices)
          ? out.indices.map((i: any) => parseInt(i, 10)).filter((n: number) => !isNaN(n))
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
          extractedValue: String(out.value || 'Not Found').trim(),
          confidence: typeof out.confidence === 'number' ? out.confidence : 0.75,
          indices,
          justification: String(out.justification || 'Extracted via whole-document synthesis.').trim(),
          relevantSnippets,
          status: 'pending',
        });
      }
    } catch (err: any) {
      console.error(`[WholeDocExtractionEngine] Error in whole doc extraction:`, err);
      variables.forEach((v) => {
        extractedResults.push({
          filename,
          variable: v.variable,
          domain: v.domain,
          extractedValue: 'Extraction Error',
          confidence: 0,
          indices: [],
          justification: `Whole document extraction failed: ${err.message}`,
          relevantSnippets: [],
          status: 'flagged',
        });
      });
    }

    return { results: extractedResults, totalTokensEstimated: totalEstimatedTokens };
  }
}
