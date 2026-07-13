import { strToU8, zipSync } from "fflate";
import { BATCH_CONTAINER_COLUMN, BATCH_MANUAL_COLUMN, BATCH_SIZE_COLUMN, type BatchPackingItem } from "./batchImport";

const RESULT_HEADERS = [
  BATCH_MANUAL_COLUMN,
  BATCH_SIZE_COLUMN,
  BATCH_CONTAINER_COLUMN,
  "最大装载量",
  "差值",
  "余量（长）",
  "余量（宽）",
  "余量（高）",
];

type CellValue = string | number | null;

export interface BatchResultWorkbookOptions {
  title?: string;
  includeStatus?: boolean;
  includeErrorDetails?: boolean;
}

function escapeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function columnName(index: number) {
  let value = index + 1;
  let name = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - 1) / 26);
  }
  return name;
}

function cellRef(columnIndex: number, rowIndex: number) {
  return `${columnName(columnIndex)}${rowIndex}`;
}

function numberOrBlank(value: number | null) {
  return value === null ? null : value;
}

function resultHeaders(options: BatchResultWorkbookOptions) {
  if (options.includeErrorDetails) return [...RESULT_HEADERS, "状态", "失败原因"];
  if (options.includeStatus) return [...RESULT_HEADERS, "状态"];
  return RESULT_HEADERS;
}

function resultRows(results: BatchPackingItem[], options: Required<BatchResultWorkbookOptions>): CellValue[][] {
  const headers = resultHeaders(options);
  return [
    [options.title],
    headers,
    ...results.map((item) => {
      const row: CellValue[] = [
        numberOrBlank(item.manualCount),
        item.sizeText || "",
        item.containerType || "",
        numberOrBlank(item.totalBoxes),
        numberOrBlank(item.difference),
        numberOrBlank(item.remainingLength),
        numberOrBlank(item.remainingWidth),
        numberOrBlank(item.remainingHeight),
      ];

      if (options.includeStatus || options.includeErrorDetails) row.push(item.status);
      if (options.includeErrorDetails) row.push(item.error || "");

      return row;
    }),
  ];
}

function cellXml(value: CellValue, columnIndex: number, rowIndex: number) {
  const reference = cellRef(columnIndex, rowIndex);
  if (value === null || value === "") {
    return `<c r="${reference}"/>`;
  }

  if (typeof value === "number") {
    return `<c r="${reference}"><v>${value}</v></c>`;
  }

  return `<c r="${reference}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`;
}

function sheetXml(rows: CellValue[][], headers: string[]) {
  const rowXml = rows
    .map((row, rowIndex) => {
      const rowNumber = rowIndex + 1;
      const cells = row.map((value, columnIndex) => cellXml(value, columnIndex, rowNumber)).join("");
      return `<row r="${rowNumber}">${cells}</row>`;
    })
    .join("");
  const lastRow = Math.max(1, rows.length);
  const lastColumn = columnName(headers.length - 1);
  const detailColumnXml = [
    headers.includes("状态") ? `\n    <col min="9" max="9" width="12" customWidth="1"/>` : "",
    headers.includes("失败原因") ? `\n    <col min="10" max="10" width="34" customWidth="1"/>` : "",
  ].join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <dimension ref="A1:${lastColumn}${lastRow}"/>
  <sheetViews>
    <sheetView workbookViewId="0">
      <pane ySplit="2" topLeftCell="A3" activePane="bottomLeft" state="frozen"/>
    </sheetView>
  </sheetViews>
  <cols>
    <col min="1" max="1" width="22" customWidth="1"/>
    <col min="2" max="2" width="18" customWidth="1"/>
    <col min="3" max="3" width="10" customWidth="1"/>
    <col min="4" max="8" width="14" customWidth="1"/>${detailColumnXml}
  </cols>
  <sheetData>${rowXml}</sheetData>
  <mergeCells count="1"><mergeCell ref="A1:${lastColumn}1"/></mergeCells>
</worksheet>`;
}

function workbookXml(title: string) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="${escapeXml(title)}" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;
}

function workbookRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
}

function rootRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;
}

function contentTypesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`;
}

function stylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="1"><font><sz val="11"/><name val="Arial"/></font></fonts>
  <fills count="1"><fill><patternFill patternType="none"/></fill></fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
}

function coreXml(title: string) {
  const now = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${escapeXml(title)}</dc:title>
  <dc:creator>Stacking SKU</dc:creator>
  <cp:lastModifiedBy>Stacking SKU</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>
</cp:coreProperties>`;
}

function appXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Stacking SKU</Application>
</Properties>`;
}

export function createBatchResultWorkbook(results: BatchPackingItem[], options: BatchResultWorkbookOptions = {}): Uint8Array {
  const resolvedOptions = {
    title: options.title || "批量导入结果",
    includeStatus: options.includeStatus ?? false,
    includeErrorDetails: options.includeErrorDetails ?? false,
  };
  const headers = resultHeaders(resolvedOptions);
  const rows = resultRows(results, resolvedOptions);
  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(contentTypesXml()),
    "_rels/.rels": strToU8(rootRelsXml()),
    "docProps/app.xml": strToU8(appXml()),
    "docProps/core.xml": strToU8(coreXml(resolvedOptions.title)),
    "xl/workbook.xml": strToU8(workbookXml(resolvedOptions.title)),
    "xl/_rels/workbook.xml.rels": strToU8(workbookRelsXml()),
    "xl/styles.xml": strToU8(stylesXml()),
    "xl/worksheets/sheet1.xml": strToU8(sheetXml(rows, headers)),
  };

  return zipSync(files, { level: 6 });
}
