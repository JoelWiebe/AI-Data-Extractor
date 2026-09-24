import * as pdfjsLib from 'pdfjs-dist';
import { ConvertedPageResult, LayoutHealthReport } from '../types';

// Set worker source for PDF.js in Vite
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

export interface SpatialTextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontName: string;
}

export class PdfExtractor {
  /**
   * Loads a PDF Document from an ArrayBuffer
   */
  public static async loadPdfDocument(data: ArrayBuffer): Promise<pdfjsLib.PDFDocumentProxy> {
    const loadingTask = pdfjsLib.getDocument({ data });
    return await loadingTask.promise;
  }

  /**
   * Fast Tier 1 Spatial Extraction: Reads tokens, sorts by columns, and builds structured elements
   */
  public static async extractPageSpatial(
    pdfDoc: pdfjsLib.PDFDocumentProxy,
    pageNumber: number
  ): Promise<ConvertedPageResult> {
    const page = await pdfDoc.getPage(pageNumber);
    const rotation = page.rotate; // 0, 90, 180, 270
    const viewport = page.getViewport({ scale: 1.0 });
    const textContent = await page.getTextContent();

    const items: SpatialTextItem[] = [];

    for (const item of textContent.items as any[]) {
      if (!item.str || !item.str.trim()) continue;
      // Transform matrix: [scaleX, skewY, skewX, scaleY, tx, ty]
      const tx = item.transform[4];
      const ty = viewport.height - item.transform[5]; // Convert from PDF bottom-up to top-down
      const width = item.width || 0;
      const height = item.height || Math.abs(item.transform[3]) || 12;
      const fontSize = Math.hypot(item.transform[0], item.transform[1]);

      items.push({
        str: item.str,
        x: tx,
        y: ty,
        width,
        height,
        fontSize,
        fontName: item.fontName || '',
      });
    }

    // Determine layout: Detect if page has 2 columns
    const pageWidth = viewport.width;
    const midX = pageWidth / 2;
    const gutterWidth = 30; // 30pt gutter margin

    let col1Items = items.filter((it) => it.x + it.width <= midX + gutterWidth / 2);
    let col2Items = items.filter((it) => it.x >= midX - gutterWidth / 2);

    // Heuristic: If both columns have significant content (>15% each), treat as 2-column
    const isTwoColumn =
      items.length > 20 &&
      col1Items.length > items.length * 0.15 &&
      col2Items.length > items.length * 0.15;

    let orderedItems: SpatialTextItem[] = [];
    if (isTwoColumn) {
      // Sort Col 1 Top-to-Bottom, then Col 2 Top-to-Bottom
      col1Items.sort((a, b) => a.y - b.y || a.x - b.x);
      col2Items.sort((a, b) => a.y - b.y || a.x - b.x);
      orderedItems = [...col1Items, ...col2Items];
    } else {
      // Single column: Natural Top-to-Bottom flow
      orderedItems = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
    }

    // Cluster text into paragraphs and headings based on line breaks & font sizes
    const structuredElements: Array<{
      type: 'heading' | 'paragraph' | 'table_markdown';
      level?: number;
      content: string;
    }> = [];

    let currentParagraphLines: string[] = [];
    let lastY = -1;
    let avgFontSize = items.reduce((acc, it) => acc + it.fontSize, 0) / (items.length || 1);

    for (const it of orderedItems) {
      const isNewLine = lastY !== -1 && Math.abs(it.y - lastY) > it.height * 1.3;
      const isHeading = it.fontSize > avgFontSize * 1.25 && it.str.length < 120;

      if (isHeading) {
        if (currentParagraphLines.length > 0) {
          structuredElements.push({
            type: 'paragraph',
            content: currentParagraphLines.join(' ').replace(/\s+/g, ' ').trim(),
          });
          currentParagraphLines = [];
        }
        structuredElements.push({
          type: 'heading',
          level: it.fontSize > avgFontSize * 1.5 ? 1 : 2,
          content: it.str.trim(),
        });
      } else if (isNewLine) {
        if (currentParagraphLines.length > 0) {
          const combined = currentParagraphLines.join(' ').replace(/\s+/g, ' ').trim();
          if (combined) {
            structuredElements.push({ type: 'paragraph', content: combined });
          }
          currentParagraphLines = [];
        }
        currentParagraphLines.push(it.str);
      } else {
        currentParagraphLines.push(it.str);
      }
      lastY = it.y;
    }

    if (currentParagraphLines.length > 0) {
      const combined = currentParagraphLines.join(' ').replace(/\s+/g, ' ').trim();
      if (combined) {
        structuredElements.push({ type: 'paragraph', content: combined });
      }
    }

    // Run Layout Health Score
    const healthReport = this.assessLayoutHealth(pageNumber, items, rotation, isTwoColumn, structuredElements);

    const rawText = structuredElements.map((el) => el.content).join('\n\n');

    return {
      pageNumber,
      method: 'spatial_client',
      rawText,
      structuredElements,
      healthReport,
    };
  }

  /**
   * Layout Quality Assessor: Evaluates whether the fast spatial extraction is clean or scrambled
   */
  public static assessLayoutHealth(
    pageNumber: number,
    items: SpatialTextItem[],
    rotation: number,
    isTwoColumn: boolean,
    elements: Array<{ type: string; content: string }>
  ): LayoutHealthReport {
    const reasons: string[] = [];

    // 1. Rotation anomaly check
    const isRotated = rotation !== 0;
    if (isRotated) {
      reasons.push(`Page metadata reports rotation of ${rotation}°.`);
    }

    // 2. Word Count / Density check
    const totalWords = elements.reduce((acc, el) => acc + el.content.split(/\s+/).filter(Boolean).length, 0);
    if (totalWords < 40 && items.length > 10) {
      reasons.push(`Low word count (${totalWords} words) detected on dense visual content.`);
    }

    // 3. Dictionary & Garbage token ratio check
    const sampleWords = elements
      .map((e) => e.content)
      .join(' ')
      .split(/\s+/)
      .slice(0, 100);

    const nonAlphaNumeric = sampleWords.filter((w) => /^[^a-zA-Z0-9]+$/.test(w) || (w.match(/[\ufffd\?]/g) || []).length > 0);
    const dictionaryEntropyScore = sampleWords.length > 0 ? nonAlphaNumeric.length / sampleWords.length : 0;
    if (dictionaryEntropyScore > 0.15) {
      reasons.push(`High non-alphanumeric token ratio (${Math.round(dictionaryEntropyScore * 100)}% corrupted chars).`);
    }

    // 4. Line discontinuity / Severe hyphenation fractures
    const hyphenatedBreaks = elements.filter((el) => /-\s+[a-z]/.test(el.content)).length;
    const lineDiscontinuityScore = elements.length > 0 ? hyphenatedBreaks / elements.length : 0;

    // 5. Table chaos detection: High concentration of short number fragments
    const numbersCount = items.filter((it) => /^\d+(\.\d+)?%?$/.test(it.str.trim())).length;
    const tableChaosScore = items.length > 0 ? numbersCount / items.length : 0;
    if (tableChaosScore > 0.35 && elements.filter((e) => e.type === 'table_markdown').length === 0) {
      reasons.push('High concentration of loose tabular numbers without Markdown table structure.');
    }

    const needsGeminiFallback = isRotated || dictionaryEntropyScore > 0.2 || tableChaosScore > 0.4 || totalWords < 20;

    return {
      pageNumber,
      detectedColumns: isTwoColumn ? 2 : 1,
      isRotated,
      rotationAngle: rotation,
      tableChaosScore,
      dictionaryEntropyScore,
      lineDiscontinuityScore,
      needsGeminiFallback,
      reasons,
    };
  }

  /**
   * Renders a specific PDF page to an HTML Canvas element (for viewing or Gemini Vision snapshot)
   */
  public static async renderPageToCanvas(
    pdfDoc: pdfjsLib.PDFDocumentProxy,
    pageNumber: number,
    canvas: HTMLCanvasElement,
    scale: number = 1.5,
    customRotation: number = 0
  ): Promise<void> {
    const page = await pdfDoc.getPage(pageNumber);
    const rotation = (page.rotate + customRotation) % 360;
    const viewport = page.getViewport({ scale, rotation });

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    await page.render({
      canvasContext: ctx,
      viewport,
    }).promise;
  }

  /**
   * Converts a rendered PDF page canvas to a Base64 PNG string for Gemini Multimodal Vision API
   */
  public static canvasToBase64Image(canvas: HTMLCanvasElement): string {
    const dataUrl = canvas.toDataURL('image/png');
    return dataUrl.split(',')[1];
  }
}
