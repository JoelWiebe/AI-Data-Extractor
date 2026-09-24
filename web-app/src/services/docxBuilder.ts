import { Document, Packer, Paragraph, HeadingLevel, TextRun, Table, TableRow, TableCell, BorderStyle, WidthType } from 'docx';
import { ConvertedPageResult } from '../types';

export class DocxBuilder {
  /**
   * Builds a standard .docx Blob from an array of converted page results
   */
  public static async buildDocxBlob(pages: ConvertedPageResult[]): Promise<Blob> {
    const docChildren: Array<Paragraph | Table> = [];

    for (const page of pages) {
      // Page header / boundary separator
      docChildren.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `--- PAGE ${page.pageNumber} (${page.method === 'gemini_vision' ? 'Gemini Vision Refined' : 'Spatial Extraction'}) ---`,
              bold: true,
              color: '6366F1',
              size: 18,
            }),
          ],
          spacing: { before: 200, after: 120 },
        })
      );

      for (const el of page.structuredElements) {
        if (el.type === 'heading') {
          docChildren.push(
            new Paragraph({
              heading: el.level === 1 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2,
              children: [
                new TextRun({
                  text: el.content,
                  bold: true,
                  size: el.level === 1 ? 28 : 24,
                  color: '1E293B',
                }),
              ],
              spacing: { before: 240, after: 120 },
            })
          );
        } else if (el.type === 'table_markdown') {
          const tableObj = this.markdownTableToDocxTable(el.content);
          if (tableObj) {
            docChildren.push(tableObj);
          } else {
            docChildren.push(new Paragraph({ text: el.content, spacing: { after: 120 } }));
          }
        } else {
          docChildren.push(
            new Paragraph({
              children: [new TextRun({ text: el.content, size: 22 })],
              spacing: { after: 140, line: 276 },
            })
          );
        }
      }
    }

    const doc = new Document({
      sections: [
        {
          properties: {},
          children: docChildren,
        },
      ],
    });

    return await Packer.toBlob(doc);
  }

  /**
   * Parses Markdown table strings into formatted python-docx / docx-js Table objects
   */
  private static markdownTableToDocxTable(mdTable: string): Table | null {
    const lines = mdTable.trim().split('\n').filter((l) => l.includes('|'));
    if (lines.length < 2) return null;

    const rows: TableRow[] = [];

    for (let rIdx = 0; rIdx < lines.length; rIdx++) {
      const line = lines[rIdx];
      // Skip separator lines like |---|---|
      if (/^\s*\|?\s*[-:]+[-| :]*\s*\|?\s*$/.test(line)) continue;

      const rawCells = line.split('|');
      // Trim empty leading/trailing elements from pipe split
      const cells = rawCells.slice(1, rawCells.length - (line.endsWith('|') ? 1 : rawCells.length));

      const isHeader = rIdx === 0;

      const tableCells = cells.map(
        (cellText) =>
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: cellText.trim(),
                    bold: isHeader,
                    size: 20,
                  }),
                ],
              }),
            ],
            shading: isHeader ? { fill: 'F1F5F9' } : undefined,
            margins: { top: 100, bottom: 100, left: 140, right: 140 },
          })
      );

      rows.push(new TableRow({ children: tableCells }));
    }

    if (rows.length === 0) return null;

    return new Table({
      rows,
      width: { size: 100, type: WidthType.PERCENTAGE },
    });
  }
}
