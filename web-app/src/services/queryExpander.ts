import { CodebookVariable } from '../types';
import { BM25Indexer } from './bm25Indexer';

export class QueryExpander {
  private static SYNONYM_MAP: Record<string, string[]> = {
    // Study Characteristics & Design
    study_design: ['randomized', 'controlled', 'trial', 'quasi-experimental', 'pre-post', 'cohort', 'between-subjects', 'within-subjects', 'longitudinal', 'cross-sectional', 'intervention', 'rct', 'methodology', 'experiment'],
    publication_year: ['published', 'received', 'accepted', 'copyright', 'year', 'journal', 'doi', 'volume', 'issue'],
    setting: ['school', 'preschool', 'kindergarten', 'classroom', 'laboratory', 'clinic', 'hospital', 'community', 'center', 'home', 'environment'],
    country: ['country', 'location', 'region', 'state', 'province', 'conducted in', 'usa', 'united states', 'canada', 'uk', 'china', 'germany', 'australia'],

    // Demographic Info
    total_participants: ['participants', 'sample', 'size', 'recruited', 'enrolled', 'assigned', 'cohort', 'subjects', 'total', 'children', 'students', 'n =', 'n=', 'attrition', 'completed'],
    participant_age_range: ['age', 'years', 'old', 'mean age', 'range', 'months', 'preschoolers', 'toddlers', 'grade', 'kindergarten'],
    gender: ['gender', 'female', 'male', 'girls', 'boys', 'sex', 'distribution', 'percentage', '%'],
    ethnicity: ['ethnicity', 'race', 'demographics', 'hispanic', 'caucasian', 'black', 'asian', 'white', 'indigenous', 'background'],
    native_language: ['language', 'native', 'non-native', 'english', 'esl', 'ell', 'bilingual', 'monolingual', 'spoken', 'home language'],

    // AI & Technology
    ai_product_name: ['system', 'application', 'app', 'tool', 'software', 'platform', 'prototype', 'robot', 'named', 'called', 'touchar', 'agent'],
    ai_modality_type: ['modality', 'speech', 'voice', 'audio', 'vision', 'augmented reality', 'ar', 'vr', 'virtual reality', 'nlp', 'dialogue', 'multimodal', 'interactive', 'touch'],
    hardware_device: ['tablet', 'ipad', 'smartphone', 'phone', 'computer', 'screen', 'device', 'headset', 'wearable', 'camera'],

    // Outcomes & Statistics
    primary_developmental_outcomes: ['outcome', 'measure', 'vocabulary', 'phonemic', 'language', 'learning', 'retention', 'score', 'ppvt', 'test', 'assessment', 'gains', 'performance'],
    intervention_effect_size: ['effect size', 'cohen', 'cohen\'s d', 'eta', 'partial eta', 'f(', 't(', 'p <', 'p =', 'statistically significant', 'confidence interval', 'ci', 'sd', 'standard deviation', 'mean'],
  };

  /**
   * Generates a multi-term search query combining variable names, descriptions, examples, and synonyms
   */
  public static expandQuery(v: CodebookVariable): string[] {
    const rawTerms = new Set<string>();

    // 1. Tokenize variable name
    const varTokens = BM25Indexer.tokenize(v.variable.replace(/_/g, ' '));
    varTokens.forEach((t) => rawTerms.add(t));

    // 2. Tokenize domain name
    const domainTokens = BM25Indexer.tokenize(v.domain.replace(/_/g, ' '));
    domainTokens.forEach((t) => rawTerms.add(t));

    // 3. Tokenize description
    const descTokens = BM25Indexer.tokenize(v.description);
    descTokens.slice(0, 15).forEach((t) => rawTerms.add(t)); // Take high-priority descriptive tokens

    // 4. Tokenize examples
    if (v.example) {
      const exampleTokens = BM25Indexer.tokenize(v.example);
      exampleTokens.forEach((t) => rawTerms.add(t));
    }

    // 5. Lookup specialized domain synonyms
    const cleanVarKey = v.variable.toLowerCase().trim();
    if (QueryExpander.SYNONYM_MAP[cleanVarKey]) {
      QueryExpander.SYNONYM_MAP[cleanVarKey].forEach((syn) => {
        BM25Indexer.tokenize(syn).forEach((st) => rawTerms.add(st));
      });
    }

    // Also match substring keys in synonym map
    for (const [mapKey, syns] of Object.entries(QueryExpander.SYNONYM_MAP)) {
      if (cleanVarKey.includes(mapKey) || mapKey.includes(cleanVarKey)) {
        syns.forEach((syn) => {
          BM25Indexer.tokenize(syn).forEach((st) => rawTerms.add(st));
        });
      }
    }

    return Array.from(rawTerms);
  }
}
