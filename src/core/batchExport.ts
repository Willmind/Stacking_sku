import { strToU8, zipSync } from "fflate";
import { BATCH_CONTAINER_COLUMN, BATCH_MANUAL_COLUMN, BATCH_SIZE_COLUMN, type BatchPackingItem } from "./batchImport";

const RESULT_HEADERS = [BATCH_MANUAL_COLUMN, BATCH_SIZE_COLUMN, BATCH_CONTAINER_COLUMN, "最大装载量", "差值"];

type CellValue = string | number | null;

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

function resultRows(results: BatchPackingItem[]): CellValue[][] {
  return [
    ["批量导入结果"],
    RESULT_HEADERS,
    ...results.map((item) => [
      numberOrBlank(item.manualCount),
      item.sizeText || "",
      item.containerType || "",
      numberOrBlank(item.totalBoxes),
      numberOrBlank(item.difference),
    ]),
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

function sheetXml(rows: CellValue[][]) {
  const rowXml = rows
    .map((row, rowIndex) => {
      const rowNumber = rowIndex + 1;
      const cells = row.map((value, columnIndex) => cellXml(value, columnIndex, rowNumber)).join("");
      return `<row r="${rowNumber}">${cells}</row>`;
    })
    .join("");
  const lastRow = Math.max(1, rows.length);
  const lastColumn = columnName(RESULT_HEADERS.length - 1);

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
    <col min="4" max="5" width="14" customWidth="1"/>
  </cols>
  <sheetData>${rowXml}</sheetData>
  <mergeCells count="1"><mergeCell ref="A1:${lastColumn}1"/></mergeCells>
</worksheet>`;
}

function workbookXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="批量导入结果" sheetId="1" r:id="rId1"/>
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

function coreXml() {
  const now = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>批量导入结果</dc:title>
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

export function createBatchResultWorkbook(results: BatchPackingItem[]): Uint8Array {
  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(contentTypesXml()),
    "_rels/.rels": strToU8(rootRelsXml()),
    "docProps/app.xml": strToU8(appXml()),
    "docProps/core.xml": strToU8(coreXml()),
    "xl/workbook.xml": strToU8(workbookXml()),
    "xl/_rels/workbook.xml.rels": strToU8(workbookRelsXml()),
    "xl/styles.xml": strToU8(stylesXml()),
    "xl/worksheets/sheet1.xml": strToU8(sheetXml(resultRows(results))),
  };

  return zipSync(files, { level: 6 });
}
