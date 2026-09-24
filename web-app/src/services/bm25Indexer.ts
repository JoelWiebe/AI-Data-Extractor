import { ExtractedParagraphItem } from '../types';

export interface BM25Doc {
  id: number;
  globalIndex: number;
  tokens: string[];
  length: number;
  rawText: string;
  heading: string;
  pageNumber: number;
}

export class BM25Indexer {
  private docs: BM25Doc[] = [];
  private avgDocLength: number = 0;
  private docFreq: Map<string, number> = new Map(); // term -> count of docs containing term
  private invertedIndex: Map<string, Array<{ docId: number; tf: number }>> = new Map();

  // BM25 standard hyperparameters
  private k1: number = 1.2;
  private b: number = 0.75;

  private static STOPWORDS = new Set([
    'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren\'t', 'as',
    'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'can', 'can\'t',
    'cannot', 'could', 'couldn\'t', 'did', 'didn\'t', 'do', 'does', 'doesn\'t', 'doing', 'don\'t', 'down',
    'during', 'each', 'few', 'for', 'from', 'further', 'had', 'hadn\'t', 'has', 'hasn\'t', 'have', 'haven\'t',
    'having', 'he', 'he\'d', 'he\'ll', 'he\'s', 'her', 'here', 'here\'s', 'hers', 'herself', 'him', 'himself',
    'his', 'how', 'how\'s', 'i', 'i\'d', 'i\'ll', 'i\'m', 'i\'ve', 'if', 'in', 'into', 'is', 'isn\'t', 'it',
    'it\'s', 'its', 'itself', 'let\'s', 'me', 'more', 'most', 'mustn\'t', 'my', 'myself', 'no', 'nor', 'not',
    'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought', 'our', 'ours', 'ourselves', 'out', 'over', 'own',
    'same', 'shan\'t', 'she', 'she\'d', 'she\'ll', 'she\'s', 'should', 'shouldn\'t', 'so', 'some', 'such',
    'than', 'that', 'that\'s', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'there\'s',
    'these', 'they', 'they\'d', 'they\'ll', 'they\'re', 'they\'ve', 'this', 'those', 'through', 'to', 'too',
    'under', 'until', 'up', 'very', 'was', 'wasn\'t', 'we', 'we\'d', 'we\'ll', 'we\'re', 'we\'ve', 'were',
    'weren\'t', 'what', 'what\'s', 'when', 'when\'s', 'where', 'where\'s', 'which', 'while', 'who', 'who\'s',
    'whom', 'why', 'why\'s', 'with', 'won\'t', 'would', 'wouldn\'t', 'you', 'you\'d', 'you\'ll', 'you\'re',
    'you\'ve', 'your', 'yours', 'yourself', 'yourselves'
  ]);

  public static tokenize(text: string): string[] {
    if (!text) return [];
    // Lowercase and match alphabetic tokens, alphanumeric terms, and common academic symbols (like N=, p<)
    const rawTokens = text.toLowerCase().match(/[a-z0-9]+(?:[-_][a-z0-9]+)*|[=><~±]/g) || [];
    return rawTokens.filter((t) => t.length > 1 && !BM25Indexer.STOPWORDS.has(t));
  }

  /**
   * Builds an inverted index across all paragraph and table items in the document
   */
  public buildIndex(items: ExtractedParagraphItem[]): void {
    this.docs = [];
    this.docFreq.clear();
    this.invertedIndex.clear();

    let totalLength = 0;

    items.forEach((item, id) => {
      const fullText = `${item.heading} ${item.content}`;
      const tokens = BM25Indexer.tokenize(fullText);
      const doc: BM25Doc = {
        id,
        globalIndex: item.globalIndex,
        tokens,
        length: tokens.length,
        rawText: item.content,
        heading: item.heading,
        pageNumber: item.pageNumber,
      };

      this.docs.push(doc);
      totalLength += tokens.length;

      // Compute term frequencies for this doc
      const tfMap = new Map<string, number>();
      for (const t of tokens) {
        tfMap.set(t, (tfMap.get(t) || 0) + 1);
      }

      for (const [term, tf] of tfMap.entries()) {
        this.docFreq.set(term, (this.docFreq.get(term) || 0) + 1);

        if (!this.invertedIndex.has(term)) {
          this.invertedIndex.set(term, []);
        }
        this.invertedIndex.get(term)!.push({ docId: id, tf });
      }
    });

    this.avgDocLength = this.docs.length > 0 ? totalLength / this.docs.length : 1;
  }

  /**
   * Computes BM25 score for a query against all indexed documents
   */
  public search(queryTerms: string[], topK: number = 5): Array<{ doc: BM25Doc; score: number }> {
    const scores = new Map<number, number>();
    const N = this.docs.length;

    for (const term of queryTerms) {
      const cleanTerm = term.toLowerCase().trim();
      const postings = this.invertedIndex.get(cleanTerm);
      if (!postings) continue;

      const df = this.docFreq.get(cleanTerm) || 0;
      // Robertson-Spärck Jones IDF
      const idf = Math.log((N - df + 0.5) / (df + 0.5) + 1);

      for (const posting of postings) {
        const doc = this.docs[posting.docId];
        const tf = posting.tf;
        const numerator = tf * (this.k1 + 1);
        const denominator = tf + this.k1 * (1 - this.b + this.b * (doc.length / (this.avgDocLength || 1)));
        const termScore = idf * (numerator / denominator);

        scores.set(posting.docId, (scores.get(posting.docId) || 0) + termScore);
      }
    }

    const sortedResults = Array.from(scores.entries())
      .map(([docId, score]) => ({ doc: this.docs[docId], score }))
      .sort((a, b) => b.score - a.score);

    return sortedResults.slice(0, topK);
  }

  /**
   * Retrieves context windows by including preceding & succeeding paragraphs
   */
  public getExpandedContext(topDocs: BM25Doc[]): BM25Doc[] {
    const docIdSet = new Set<number>();

    topDocs.forEach((d) => {
      // Include target doc
      docIdSet.add(d.id);
      // Include previous doc for context
      if (d.id > 0) docIdSet.add(d.id - 1);
      // Include next doc for context
      if (d.id < this.docs.length - 1) docIdSet.add(d.id + 1);
    });

    const sortedIds = Array.from(docIdSet).sort((a, b) => a - b);
    return sortedIds.map((id) => this.docs[id]);
  }
}
