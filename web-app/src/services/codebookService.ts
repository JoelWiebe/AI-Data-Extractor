import * as XLSX from 'xlsx';
import { CodebookVariable, CodebookDomainCluster } from '../types';

export class CodebookService {
  public static REQUIRED_COLUMNS = ['Domain', 'Variable', 'Description', 'Example', 'Notes/Questions'];

  public static DEFAULT_ECE_TEMPLATE: CodebookVariable[] = [
    {
      domain: 'study_characteristics',
      variable: 'study_design',
      description: 'The overall design and methodology of the research study (e.g., RCT, Quasi-experimental, Pre-post).',
      example: 'Randomized Controlled Trial; Quasi-experimental',
      notesQuestions: 'Extract specific trial design name.',
    },
    {
      domain: 'study_characteristics',
      variable: 'publication_year',
      description: 'The calendar year in which the article was formally published.',
      example: '2024; 2021',
      notesQuestions: 'Check title page or header metadata.',
    },
    {
      domain: 'demographic_info',
      variable: 'total_participants',
      description: 'The total number of child and/or adult research participants included in the primary study.',
      example: '240; 125 children',
      notesQuestions: 'Focus strictly on sample analyzed in primary intervention.',
    },
    {
      domain: 'demographic_info',
      variable: 'participant_age_range',
      description: 'The chronological age range or mean age of the participating children.',
      example: '4-5 years; Mean = 4.8 years',
      notesQuestions: 'Extract exact ages or school grade bands.',
    },
    {
      domain: 'ai_system',
      variable: 'ai_product_name',
      description: 'The specific name or brand of the AI application, tool, or robotic product used.',
      example: 'TouchAR; SpeechTutor Pro',
      notesQuestions: 'Extract custom prototype name if bespoke software.',
    },
    {
      domain: 'ai_system',
      variable: 'ai_modality_type',
      description: 'The core AI technologies employed (e.g., Automatic Speech Recognition, Computer Vision, Conversational Agent).',
      example: 'Speech Recognition; Augmented Reality Tracking',
      notesQuestions: 'List all multimodal components.',
    },
    {
      domain: 'outcomes',
      variable: 'primary_developmental_outcomes',
      description: 'Specific developmental or learning metrics measured in children (e.g. vocabulary, phonemic awareness).',
      example: 'Vocabulary retention; Expressive language gains',
      notesQuestions: 'Include standardized test names if reported.',
    },
    {
      domain: 'outcomes',
      variable: 'intervention_effect_size',
      description: 'Statistical effect sizes reported for the primary intervention (e.g. Cohen d, partial eta squared).',
      example: 'd = 1.73; p < .001',
      notesQuestions: 'Extract exact statistical figures.',
    },
  ];

  /**
   * Validates and parses an uploaded Excel (.xlsx) file into structured CodebookVariables
   */
  public static parseExcelFile(data: ArrayBuffer): CodebookVariable[] {
    const workbook = XLSX.read(data, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const jsonRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });

    if (!jsonRows || jsonRows.length === 0) {
      throw new Error('The uploaded codebook spreadsheet contains no rows.');
    }

    const firstRow = jsonRows[0];
    const normalizedKeys = Object.keys(firstRow).reduce((acc, k) => {
      acc[k.toLowerCase().replace(/[^a-z0-9]/g, '')] = k;
      return acc;
    }, {} as Record<string, string>);

    const domainKey = normalizedKeys['domain'] || 'Domain';
    const varKey = normalizedKeys['variable'] || 'Variable';
    const descKey = normalizedKeys['description'] || 'Description';
    const exKey = normalizedKeys['example'] || normalizedKeys['examples'] || 'Example';
    const notesKey =
      normalizedKeys['notesquestions'] ||
      normalizedKeys['notes'] ||
      normalizedKeys['chainofthought'] ||
      'Notes/Questions';

    const variables: CodebookVariable[] = [];

    jsonRows.forEach((row, idx) => {
      const variableName = String(row[varKey] || '').trim();
      const description = String(row[descKey] || '').trim();

      if (!variableName && !description) return; // Skip blank lines

      if (!variableName) {
        throw new Error(`Row ${idx + 2}: 'Variable' name is missing.`);
      }
      if (!description) {
        throw new Error(`Row ${idx + 2} ('${variableName}'): 'Description' is missing.`);
      }

      variables.push({
        domain: String(row[domainKey] || 'other').trim().toLowerCase().replace(/\s+/g, '_') || 'other',
        variable: variableName.toLowerCase().replace(/\s+/g, '_'),
        description,
        example: String(row[exKey] || '').trim(),
        notesQuestions: String(row[notesKey] || '').trim(),
      });
    });

    return variables;
  }

  /**
   * Generates a downloadable Excel workbook Blob from CodebookVariables
   */
  public static exportToExcel(variables: CodebookVariable[]): Blob {
    const rows = variables.map((v) => ({
      Domain: v.domain,
      Variable: v.variable,
      Description: v.description,
      Example: v.example,
      'Notes/Questions': v.notesQuestions,
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Codebook');

    const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  /**
   * Groups variables into Domain Clusters matching Python utils.domain_variable_mapping
   */
  public static createDomainClusters(variables: CodebookVariable[]): CodebookDomainCluster {
    const clusters: CodebookDomainCluster = {};
    for (const v of variables) {
      const d = v.domain || 'other';
      if (!clusters[d]) clusters[d] = [];
      clusters[d].push(v.variable);
    }
    return clusters;
  }
}
