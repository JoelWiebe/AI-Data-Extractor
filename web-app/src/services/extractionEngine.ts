import * as XLSX from 'xlsx';
import {
  CodebookVariable,
  ExtractedParagraphItem,
  Pass1ClassificationResult,
  Pass2ExtractedVariable,
  ConvertedPageResult,
  AiGovernanceMode,
  DataResidencyRegion,
  GeminiModelVersion,
} from '../types';
import { GeminiService, GeminiPayload } from './geminiService';
import { CodebookService } from './codebookService';

export class ExtractionEngine {
  /**
   * Linear Block Traversal: Converts structured elements into a sequentially indexed stream [0..N],
   * and enforces strict stop condition at 'REFERENCES' heading.
   */
  public static prepareDocumentContent(
    pages: ConvertedPageResult[]
  ): { items: ExtractedParagraphItem[]; wasStoppedAtReferences: boolean } {
    const items: ExtractedParagraphItem[] = [];
    let globalIndex = 0;
    let currentHeading = 'DOCUMENT_START';
    let wasStoppedAtReferences = false;

    for (const page of pages) {
      if (wasStoppedAtReferences) break;

      for (const el of page.structuredElements) {
        if (el.type === 'heading') {
          const upper = el.content.trim().toUpperCase();
          if (upper === 'REFERENCES' || upper.startsWith('REFERENCES ') || upper === 'WORKS CITED') {
            console.log(`[ExtractionEngine] Encountered stop heading '${el.content}'. Halting extraction stream.`);
            wasStoppedAtReferences = true;
            break;
          }
          currentHeading = el.content.trim();
        } else if (el.type === 'paragraph' || el.type === 'table_markdown') {
          if (!el.content || !el.content.trim()) continue;
          items.push({
            globalIndex: globalIndex++,
            type: el.type,
            heading: currentHeading,
            content: el.content.trim(),
            pageNumber: page.pageNumber,
          });
        }
      }
    }

    return { items, wasStoppedAtReferences };
  }

  /**
   * Pass 1: Paragraph / Table Content Classification
   * Groups items by section heading and prompts Gemini to tag relevant paragraphs with domain labels.
   */
  public static async runPass1Classification(
    items: ExtractedParagraphItem[],
    variables: CodebookVariable[],
    apiKey: string,
    mode: AiGovernanceMode = 'DATA_SHARING_FREE',
    region: DataResidencyRegion = 'us-central1',
    vertexProjectId?: string,
    modelName: GeminiModelVersion = 'gemini-2.0-flash',
    onProgress?: (current: number, total: number, heading: string) => void
  ): Promise<Pass1ClassificationResult[]> {
    const domainClusters = CodebookService.createDomainClusters(variables);

    // Build label descriptions
    const tagDescriptions: Record<string, string> = {};
    for (const [domain, varNames] of Object.entries(domainClusters)) {
      if (domain !== 'other') {
        const descList = varNames
          .map((vn) => variables.find((v) => v.variable === vn)?.description)
          .filter(Boolean)
          .join('; ');
        tagDescriptions[domain] = descList;
      }
    }
    // Standalone variables for 'other'
    (domainClusters['other'] || []).forEach((vn) => {
      const vObj = variables.find((v) => v.variable === vn);
      if (vObj) tagDescriptions[vn] = vObj.description;
    });

    const validLabels = Object.keys(tagDescriptions);

    // Group items by heading
    const sections: Record<string, ExtractedParagraphItem[]> = {};
    for (const it of items) {
      if (!sections[it.heading]) sections[it.heading] = [];
      sections[it.heading].push(it);
    }

    const sectionHeadings = Object.keys(sections);
    const results: Pass1ClassificationResult[] = [];

    for (let sIdx = 0; sIdx < sectionHeadings.length; sIdx++) {
      const heading = sectionHeadings[sIdx];
      const secItems = sections[heading];

      if (onProgress) onProgress(sIdx + 1, sectionHeadings.length, heading);

      const paragraphsPayload: Record<string, string> = {};
      secItems.forEach((it) => {
        paragraphsPayload[String(it.globalIndex)] = `${it.type === 'table_markdown' ? '[Table MD] ' : ''}${it.content}`;
      });

      const systemPrompt = `You are a meticulous systematic literature review research assistant.
You will be provided with a section heading and paragraphs from an academic paper.
Your task is to classify each paragraph/table based on valid label names.

VALID LABELS & DESCRIPTIONS:
${JSON.stringify(tagDescriptions, null, 2)}

OUTPUT REQUIREMENT:
Output a JSON object mapping paragraph indices to arrays of [label_name, confidence_score_float].
Only return labels from the valid label list.
Example format:
{
  "0": [["study_characteristics", 0.95]],
  "1": [["demographic_info", 0.85], ["ai_system", 0.70]]
}`;

      const userPrompt = `HEADING: ${heading}\n\nPARAGRAPHS:\n${JSON.stringify(paragraphsPayload, null, 2)}`;

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
        const parsedClassifications = JSON.parse(rawJson);

        const mapped: Record<number, Array<{ tag: string; confidence: number }>> = {};
        for (const [idxStr, tagPairs] of Object.entries(parsedClassifications)) {
          const numIdx = parseInt(idxStr, 10);
          if (Array.isArray(tagPairs)) {
            mapped[numIdx] = [];
            for (const item of tagPairs) {
              if (Array.isArray(item) && item.length >= 2) {
                const tag = String(item[0]).trim();
                const conf = parseFloat(item[1]) || 0.5;
                if (validLabels.includes(tag)) {
                  mapped[numIdx].push({ tag, confidence: conf });
                }
              }
            }
          }
        }

        results.push({ heading, classifications: mapped });
      } catch (err) {
        console.error(`[ExtractionEngine] Error classifying section '${heading}':`, err);
        results.push({ heading, classifications: {} });
      }
    }

    return results;
  }

  /**
   * Pass 2: Targeted Variable Extraction
   * Evaluates variables against relevant tagged paragraphs with strict primary study scoping.
   */
  public static async runPass2Extraction(
    filename: string,
    items: ExtractedParagraphItem[],
    variables: CodebookVariable[],
    pass1Results: Pass1ClassificationResult[],
    apiKey: string,
    mode: AiGovernanceMode = 'DATA_SHARING_FREE',
    region: DataResidencyRegion = 'us-central1',
    vertexProjectId?: string,
    modelName: GeminiModelVersion = 'gemini-2.0-flash',
    onProgress?: (current: number, total: number, variableName: string) => void
  ): Promise<Pass2ExtractedVariable[]> {
    const domainClusters = CodebookService.createDomainClusters(variables);
    const extractedVariables: Pass2ExtractedVariable[] = [];

    // Flatten pass 1 classifications by globalIndex
    const globalTagMap: Record<number, Set<string>> = {};
    for (const res of pass1Results) {
      for (const [idx, tags] of Object.entries(res.classifications)) {
        const numIdx = parseInt(idx, 10);
        if (!globalTagMap[numIdx]) globalTagMap[numIdx] = new Set();
        tags.forEach((t) => globalTagMap[numIdx].add(t.tag));
      }
    }

    const domains = Object.keys(domainClusters);
    let totalVarCount = variables.length;
    let completedVars = 0;

    for (const domain of domains) {
      const varNames = domainClusters[domain];
      const targetVars = variables.filter((v) => varNames.includes(v.variable));

      // Find paragraphs tagged with this domain or all paragraphs if none explicitly tagged
      let candidateItems = items.filter((it) => globalTagMap[it.globalIndex]?.has(domain));
      if (candidateItems.length === 0) {
        // Fallback: evaluate all items if domain classification yielded 0 matches
        candidateItems = items;
      }

      const snippetsPayload: Record<string, string> = {};
      candidateItems.forEach((it) => {
        snippetsPayload[String(it.globalIndex)] = `[Page ${it.pageNumber}] ${it.type === 'table_markdown' ? '[Table MD]\n' : ''}${it.content}`;
      });

      const varSpecs: Record<string, any> = {};
      targetVars.forEach((v) => {
        varSpecs[v.variable] = {
          description: v.description,
          examples: v.example,
          notes_questions: v.notesQuestions,
        };
      });

      const systemPrompt = `You are an expert research data extractor for academic systematic reviews.
Your goal is to extract specific target variables from the provided research paper excerpts.

CRITICAL PRIMARY STUDY SCOPING RULE:
When extracting values, you MUST focus EXCLUSIVELY on information that describes the primary, current research study being conducted and reported in this paper.
Do NOT extract data or values that pertain to other studies, previous work, or background literature that are merely cited or discussed.
If a variable is only mentioned in the context of cited literature, return "Not Found".

TARGET VARIABLES TO EXTRACT:
${JSON.stringify(varSpecs, null, 2)}

OUTPUT SCHEMA:
Return a JSON object where each key is a variable name mapping to:
{
  "value": string,          // Extracted value or "Not Found"
  "confidence": number,     // 0.0 to 1.0
  "indices": number[],      // 1-5 integer indices of the excerpts directly supporting this value
  "justification": string   // Single concise sentence explaining the derivation referencing the source
}`;

      const userPrompt = `EXCERPTS:\n${JSON.stringify(snippetsPayload, null, 2)}`;

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
        const parsedOutputs = JSON.parse(rawJson);

        for (const vObj of targetVars) {
          completedVars++;
          if (onProgress) onProgress(completedVars, totalVarCount, vObj.variable);

          const out = parsedOutputs[vObj.variable] || {};
          const indices = Array.isArray(out.indices) ? out.indices.map((i: any) => parseInt(i, 10)).filter((n: number) => !isNaN(n)) : [];
          const relevantSnippets = indices
            .map((idx: number) => {
              const item = items.find((it) => it.globalIndex === idx);
              return item ? `[Idx ${idx} | P.${item.pageNumber}] ${item.content}` : '';
            })
            .filter(Boolean);

          extractedVariables.push({
            filename,
            variable: vObj.variable,
            domain: vObj.domain,
            extractedValue: String(out.value || 'Not Found').trim(),
            confidence: typeof out.confidence === 'number' ? out.confidence : 0.7,
            indices,
            justification: String(out.justification || 'Extracted via primary study analysis.').trim(),
            relevantSnippets,
            status: 'pending',
          });
        }
      } catch (err) {
        console.error(`[ExtractionEngine] Error in Pass 2 domain '${domain}':`, err);
        targetVars.forEach((vObj) => {
          completedVars++;
          if (onProgress) onProgress(completedVars, totalVarCount, vObj.variable);
          extractedVariables.push({
            filename,
            variable: vObj.variable,
            domain: vObj.domain,
            extractedValue: 'Extraction Error',
            confidence: 0,
            indices: [],
            justification: `Failed to extract: ${err instanceof Error ? err.message : String(err)}`,
            relevantSnippets: [],
            status: 'flagged',
          });
        });
      }
    }

    return extractedVariables;
  }

  /**
   * Generates a Publication-Ready Excel Synthesis Workbook (.xlsx)
   */
  public static exportSynthesisToExcel(variables: Pass2ExtractedVariable[]): Blob {
    const rows = variables.map((v) => ({
      Filename: v.filename,
      Domain: v.domain,
      Variable: v.variable,
      'Extracted Value': v.extractedValue,
      Confidence: (v.confidence * 100).toFixed(1) + '%',
      'Cited Paragraph Indices': v.indices.join(', '),
      'Source Evidence Snippets': v.relevantSnippets.join('\n---\n'),
      'AI Justification': v.justification,
      'Human Verified Value': v.humanVerifiedValue || '',
      Status: v.status.toUpperCase(),
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Extracted_Data');

    const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }
}
