import { describe, expect, it } from "vitest";
import { importLegacyFiles } from "./importLegacy";
import { readGroups, serialize } from "./StructuredLegacyEditor";
import { createLegacyTemplate } from "./templates";
import { StructuredLegacyEditor } from "./StructuredLegacyEditor";

describe("табличный редактор legacy-файлов", () => {
  it("сериализует значения и фактические количества строк CN", () => {
    const files = createLegacyTemplate("B");
    const groups = readGroups(files.CN, "CN", "B", 1);
    groups[0]!.rows[0]![0] = 25;
    groups[5]!.rows.push([1, 2, 3]);
    const text = serialize("CN", groups, "B");
    expect(text).toMatch(/^2 1 1 0 1\n25 0\n/);
    expect(importLegacyFiles({ ...files.CN, text }, files.LD, files.MD, { variant: "B", unitSystem: "mm-kN-MPa" }).ok).toBe(true);
  });

  it("показывает MS по Ireg и сохраняет заданные значения", () => {
    const files = createLegacyTemplate("B");
    files.MD.text = files.MD.text.replace("0 1 1 1 0 0 0 0 0 0", "0 1 1 1 0 0 0 0 0 1");
    const records = readGroups(files.MD, "MD", "B", 2);
    records[2]!.rows[0]![0] = 3;
    records[2]!.rows[1]![0] = 4;
    const text = serialize("MD", records, "B");
    expect(text).toMatch(/\n3\n4\n$/);
    expect(readGroups({ name: "model.MD", text }, "MD", "B", 2)[2]!.rows).toEqual([[3], [4]]);
  });
});
