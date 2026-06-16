import assert from "node:assert/strict";
import { strFromU8, unzipSync } from "fflate";
import { describe, it } from "vitest";
import { calculateBatchPacking } from "../src/core/batchImport";
import { createBatchResultWorkbook } from "../src/core/batchExport";

describe("batch import", () => {
  it("calculates packing totals from the current Excel row format", () => {
    const results = calculateBatchPacking([
      { "人工码垛数量（原始）": 1740, "尺寸（长宽高 mm）": "465*360*291", 柜型: "40HQ" },
      { "人工码垛数量（原始）": 1403, "尺寸（长宽高 mm）": "488*360*291", 柜型: "40HQ" },
      { "人工码垛数量（原始）": 1198, "尺寸（长宽高 mm）": "465*395*290", 柜型: "40GP" },
      { "人工码垛数量（原始）": 1340, "尺寸（长宽高 mm）": "488*380*291", 柜型: "40HQ" },
    ]);

    assert.deepEqual(
      results.map((result) => result.totalBoxes),
      [1493, 1403, 1200, 1340],
    );
    assert.deepEqual(
      results.map((result) => result.rowNumber),
      [2, 3, 4, 5],
    );
    assert.deepEqual(
      results.map((result) => result.status),
      ["成功", "成功", "成功", "成功"],
    );
    assert.deepEqual(
      results.map((result) => result.sizeText),
      ["465*360*291", "488*360*291", "465*395*290", "488*380*291"],
    );
    assert.deepEqual(
      results.map((result) => result.manualCount),
      [1740, 1403, 1198, 1340],
    );
    assert.deepEqual(
      results.map((result) => result.difference),
      [-247, 0, 2, 0],
    );
  });

  it("skips blank rows and reports row-level parse errors", () => {
    const results = calculateBatchPacking([
      { "人工码垛数量（原始）": "", "尺寸（长宽高 mm）": "", 柜型: "" },
      { "人工码垛数量（原始）": 1740, "尺寸（长宽高 mm）": "465-360-291", 柜型: "40HQ" },
      { "人工码垛数量（原始）": 1403, "尺寸（长宽高 mm）": "465x360x291", 柜型: "45HQ" },
      { "人工码垛数量（原始）": "", "尺寸（长宽高 mm）": "465x360x291", 柜型: "40HQ" },
    ]);

    assert.equal(results.length, 3);
    assert.equal(results[0].rowNumber, 3);
    assert.equal(results[0].status, "解析失败");
    assert.match(results[0].error || "", /尺寸/);
    assert.equal(results[1].rowNumber, 4);
    assert.equal(results[1].status, "解析失败");
    assert.match(results[1].error || "", /柜型/);
    assert.equal(results[2].rowNumber, 5);
    assert.equal(results[2].status, "解析失败");
    assert.match(results[2].error || "", /人工码垛数量/);
  });

  it("calculates small-carton batch rows without building full visual positions", () => {
    const startedAt = performance.now();
    const results = calculateBatchPacking([
      { "人工码垛数量（原始）": 5200, "尺寸（长宽高 mm）": "255*230*225", 柜型: "40HQ" },
      { "人工码垛数量（原始）": 4600, "尺寸（长宽高 mm）": "310*225*210", 柜型: "40HQ" },
      { "人工码垛数量（原始）": 4100, "尺寸（长宽高 mm）": "305*240*230", 柜型: "40HQ" },
    ]);
    const elapsed = performance.now() - startedAt;

    assert.deepEqual(
      results.map((result) => result.totalBoxes),
      [5280, 4812, 4158],
    );
    assert.deepEqual(
      results.map((result) => result.difference),
      [80, 212, 58],
    );
    assert.ok(elapsed < 1000, `small-carton batch calculation took ${elapsed.toFixed(1)}ms`);
  });

  it("reuses maximum-load calculations for repeated carton specs", () => {
    const repeatedRows = Array.from({ length: 40 }, (_, index) => ({
      "人工码垛数量（原始）": 5200 + index,
      "尺寸（长宽高 mm）": "255*230*225",
      柜型: "40HQ",
    }));

    const startedAt = performance.now();
    const results = calculateBatchPacking(repeatedRows);
    const elapsed = performance.now() - startedAt;

    assert.equal(results.length, 40);
    assert.ok(results.every((result) => result.totalBoxes === 5280));
    assert.equal(results[0].difference, 80);
    assert.equal(results[39].difference, 41);
    assert.ok(elapsed < 800, `repeated carton batch calculation took ${elapsed.toFixed(1)}ms`);
  });

  it("exports batch results as a readable xlsx workbook", () => {
    const results = calculateBatchPacking([
      { "人工码垛数量（原始）": 1740, "尺寸（长宽高 mm）": "465*360*291", 柜型: "40HQ" },
      { "人工码垛数量（原始）": 1403, "尺寸（长宽高 mm）": "465-360-291", 柜型: "40HQ" },
    ]);

    const workbook = createBatchResultWorkbook(results);
    const entries = unzipSync(workbook);
    const sheetXml = strFromU8(entries["xl/worksheets/sheet1.xml"]);
    const contentTypes = strFromU8(entries["[Content_Types].xml"]);

    assert.ok(entries["xl/workbook.xml"], "workbook should include xl/workbook.xml");
    assert.ok(entries["xl/worksheets/sheet1.xml"], "workbook should include sheet1 XML");
    assert.match(contentTypes, /spreadsheetml\.sheet\.main\+xml/);
    assert.match(sheetXml, /批量导入结果/);
    assert.match(sheetXml, /最大装载量/);
    assert.match(sheetXml, /差值/);
    assert.doesNotMatch(sheetXml, /每层数量/);
    assert.doesNotMatch(sheetXml, /占用高度/);
    assert.match(sheetXml, /465\*360\*291/);
    assert.match(sheetXml, /1493/);
    assert.match(sheetXml, /-247/);
  });
});
