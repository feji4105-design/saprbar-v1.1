import { useState } from "react";
import { RecordReader, type NumericRecord } from "./parser";
import type { LegacyInputFile, LegacyVariant } from "./types";

type Kind = "CN" | "LD" | "MD";
interface Group { key: string; title: string; fields: string[]; rows: number[][] }

const cnGroups = [
  { key: "XR", title: "Узлы · XR", fields: ["X", "Y"] },
  { key: "XS", title: "Стержни · XS", fields: ["Узел I", "Узел J", "Тип XC"] },
  { key: "XC", title: "Сечения · XC", fields: ["K", "E", "Ro", "aT", "C1", "C2", "C3", "C4", "Sp", "Sc"] },
  { key: "SC", title: "Сдвиг · SC", fields: ["Ky", "G", "By", "Sz*", "Tau"] },
  { key: "XD", title: "Шарниры · XD", fields: ["Стержень", "Kb", "Ke"] },
  { key: "XM", title: "Массы · XM", fields: ["Узел", "Масса", "Момент инерции"] }
];
const ldGroups = [
  { key: "NB", title: "Опоры · NB", fields: ["Узел", "K1", "K2", "K3", "U", "V", "F"] },
  { key: "QR", title: "Узловые нагрузки · QR", fields: ["Узел", "F1", "F2", "M"] },
  { key: "QS", title: "Нагрузки стержней · QS", fields: ["Стержень", "qx", "qy", "mz", "T"] },
  { key: "FT", title: "Время · FT", fields: ["Время", "F(t)"] }
];
const mdGroups = [
  { key: "PZ", title: "Вещественные параметры · PZ", fields: ["EPS", "q₀", "qₖ", "dq", "w₀", "wₖ", "dw", "резерв", "g", "Ireg"] },
  { key: "IZ", title: "Целые параметры · IZ", fields: ["NP", "NL", "RI", "SD", "M₀", "Mₖ", "резерв 7", "резерв 8", "Ng", "NZ"] },
  { key: "MS", title: "Промежуточные узлы · MS", fields: ["MS"] }
];

function numericRecords(file: LegacyInputFile, kind: Kind): NumericRecord[] {
  return new RecordReader(kind, file).records;
}
function rowsFrom(records: NumericRecord[], start: number, count: number, width: number): number[][] {
  return Array.from({ length: count }, (_, row) => Array.from({ length: width }, (_, column) => records[start + row]?.values[column] ?? 0));
}
export function readGroups(file: LegacyInputFile, kind: Kind, variant: LegacyVariant, elementCount: number): Group[] {
  const records = numericRecords(file, kind);
  const header = records[0]?.values ?? [];
  let cursor = 1;
  const take = (key: string, count: number, width: number, fields: string[]): Group => {
    const rows = rowsFrom(records, cursor, count, width);
    cursor += count;
    return { key, title: "", fields, rows };
  };
  if (kind === "CN") {
    const configured = cnGroups.map((group) => ({ ...group, title: group.title }));
    const nr = Math.max(0, Math.trunc(header[0] ?? 0));
    const ns = Math.max(0, Math.trunc(header[1] ?? 0));
    const nc = Math.max(0, Math.trunc(header[2] ?? 0));
    const nd = Math.max(0, Math.trunc(header[3] ?? 0));
    const nm = Math.max(0, Math.trunc(header[4] ?? 0));
    const xr = take("XR", nr, 2, configured[0]!.fields);
    const xs = take("XS", ns, 3, configured[1]!.fields);
    const xcWidth = variant === "R" ? 11 : 10;
    const xc = take("XC", nc, xcWidth, variant === "R" ? ["K", "E", "ISC", "Ro", "aT", "C1", "C2", "C3", "C4", "Sp", "Sc"] : configured[2]!.fields);
    const hasSC = variant === "R" && xc.rows.length > 0 && xc.rows.every((row) => row[2] !== 0);
    const sc = take("SC", hasSC ? nc : 0, 5, configured[3]!.fields);
    const xd = take("XD", nd, 3, configured[4]!.fields);
    const xm = take("XM", nm, 3, configured[5]!.fields);
    return [xr, xs, xc, sc, xd, xm].map((group) => ({ ...group, title: configured.find((item) => item.key === group.key)!.title }));
  }
  if (kind === "LD") {
    return ldGroups.map((definition, index) => {
      const count = Math.max(0, Math.trunc(header[index] ?? 0));
      return { ...definition, rows: rowsFrom(records, cursor, count, definition.fields.length), title: definition.title, ...((cursor += count), {}) };
    });
  }
  const pz = rowsFrom(records, 0, records.length ? 1 : 0, 10);
  const iz = rowsFrom(records, 1, records.length > 1 ? 1 : 0, 10);
  const ireg = pz[0]?.[9] ?? 0;
  const msCount = ireg === 1 ? elementCount : ireg === 2 ? 1 : 0;
  return [
    { ...mdGroups[0]!, rows: pz },
    { ...mdGroups[1]!, rows: iz },
    { ...mdGroups[2]!, rows: rowsFrom(records, 2, msCount, 1) }
  ];
}

export function serialize(kind: Kind, groups: Group[], variant: LegacyVariant): string {
  const get = (key: string) => groups.find((group) => group.key === key)?.rows ?? [];
  const lines: string[] = [];
  if (kind === "CN") {
    const xc = get("XC");
    const sc = get("SC");
    lines.push([get("XR").length, get("XS").length, xc.length, get("XD").length, get("XM").length].join(" "));
    const hasSC = variant === "R" && xc.length > 0 && xc.every((row) => row[2] !== 0);
    for (const key of ["XR", "XS", "XC", ...(hasSC ? ["SC"] : []), "XD", "XM"]) {
      for (const row of get(key)) lines.push(row.join(" "));
    }
  } else if (kind === "LD") {
    lines.push(["NB", "QR", "QS", "FT"].map((key) => get(key).length).join(" "));
    for (const key of ["NB", "QR", "QS", "FT"]) for (const row of get(key)) lines.push(row.join(" "));
  } else {
    lines.push((get("PZ")[0] ?? Array(10).fill(0)).join(" "));
    lines.push((get("IZ")[0] ?? Array(10).fill(0)).join(" "));
    for (const row of get("MS")) lines.push(row.join(" "));
  }
  return `${lines.join("\n")}\n`;
}

export function convertCNVariant(file: LegacyInputFile, from: LegacyVariant, to: LegacyVariant): string {
  if (from === to) return file.text;
  const groups = readGroups(file, "CN", from, 0);
  groups[2]!.rows = groups[2]!.rows.map((row) => from === "B"
    ? [row[0]!, row[1]!, 0, ...row.slice(2)]
    : [row[0]!, row[1]!, ...row.slice(3)]);
  groups[2]!.fields = to === "R"
    ? ["K", "E", "ISC", "Ro", "aT", "C1", "C2", "C3", "C4", "Sp", "Sc"]
    : cnGroups[2]!.fields;
  groups[3]!.rows = [];
  return serialize("CN", groups, to);
}

interface Props { kind: Kind; file: LegacyInputFile; variant: LegacyVariant; elementCount: number; onChange: (text: string) => void }
export function StructuredLegacyEditor({ kind, file, variant, elementCount, onChange }: Props) {
  const definitions = kind === "CN" ? cnGroups : kind === "LD" ? ldGroups : mdGroups;
  const [active, setActive] = useState(definitions[0]!.key);
  const groups = readGroups(file, kind, variant, elementCount);
  const group = groups.find((item) => item.key === active) ?? groups[0]!;
  const fixedSingleRecord = kind === "MD" && ["PZ", "IZ"].includes(group.key);
  const fixedMSCount = kind === "MD" && group.key === "MS";
  const changeCell = (rowIndex: number, columnIndex: number, value: string) => {
    const next = groups.map((item) => ({ ...item, rows: item.rows.map((row) => [...row]) }));
    const selected = next.find((item) => item.key === group.key)!;
    const parsed = value.trim() === "" ? 0 : Number(value.replace(/[dD]/g, "E"));
    selected.rows[rowIndex]![columnIndex] = Number.isFinite(parsed) ? parsed : Number.NaN;
    if (kind === "CN" && selected.key === "XC" && variant === "R") {
      const sc = next.find((item) => item.key === "SC")!;
      const hasSC = selected.rows.length > 0 && selected.rows.every((row) => row[2] !== 0);
      sc.rows = hasSC ? Array.from({ length: selected.rows.length }, (_, index) => sc.rows[index] ?? Array(5).fill(0)) : [];
    }
    onChange(serialize(kind, next, variant));
  };
  const addRow = () => {
    if (kind === "CN" && group.key === "SC" && variant === "R") {
      const next = groups.map((item) => ({ ...item, rows: item.rows.map((row) => [...row]) }));
      const xc = next.find((item) => item.key === "XC")!;
      if (!xc.rows.length) return;
      xc.rows.forEach((row, index) => { row[2] = index + 1; });
      next.find((item) => item.key === "SC")!.rows = Array.from({ length: xc.rows.length }, (_, index) => group.rows[index] ?? Array(5).fill(0));
      onChange(serialize(kind, next, variant));
      return;
    }
    const next = groups.map((item) => item.key === group.key ? { ...item, rows: [...item.rows, Array(item.fields.length).fill(0)] } : item);
    if (kind === "CN" && group.key === "XC" && variant === "R") {
      next.find((item) => item.key === "SC")!.rows = [];
    }
    onChange(serialize(kind, next, variant));
  };
  const removeRow = (rowIndex: number) => {
    if (kind === "CN" && group.key === "SC" && variant === "R") {
      const next = groups.map((item) => ({ ...item, rows: item.rows.map((row) => [...row]) }));
      next.find((item) => item.key === "XC")!.rows.forEach((row) => { row[2] = 0; });
      next.find((item) => item.key === "SC")!.rows = [];
      onChange(serialize(kind, next, variant));
      return;
    }
    const next = groups.map((item) => item.key === group.key ? { ...item, rows: fixedSingleRecord ? [] : item.rows.filter((_, index) => index !== rowIndex) } : item);
    onChange(serialize(kind, next, variant));
  };
  return <div className="structured-editor">
    <nav className="structured-tabs" aria-label={`Разделы ${kind}`}>
      {definitions.map((item) => <button key={item.key} className={active === item.key ? "active" : ""} onClick={() => setActive(item.key)}>{item.title}</button>)}
    </nav>
    <div className="structured-table-wrap">
      <table className="structured-table"><thead><tr><th>№</th>{group.fields.map((field, index) => <th key={`${field}-${index}`}>{field}</th>)}<th aria-label="Удаление"/></tr></thead><tbody>
        {group.rows.map((row, rowIndex) => <tr key={`${group.key}-${rowIndex}`}><th>{rowIndex + 1}</th>{group.fields.map((field, columnIndex) => <td key={`${field}-${columnIndex}`}><input aria-label={`${group.key} ${rowIndex + 1}: ${field}`} type="number" step="any" value={Number.isFinite(row[columnIndex]) ? row[columnIndex] : ""} onChange={(event) => changeCell(rowIndex, columnIndex, event.target.value)}/></td>)}<td>{!fixedSingleRecord&&!fixedMSCount&&<button className="icon-button" title="Удалить запись" aria-label={`Удалить запись ${rowIndex + 1}`} onClick={() => removeRow(rowIndex)}>×</button>}</td></tr>)}
        {group.rows.length === 0 && <tr><td colSpan={group.fields.length + 2} className="empty-table">Записей нет</td></tr>}
      </tbody></table>
    </div>
    {!fixedMSCount&&(!fixedSingleRecord||group.rows.length===0)?<button className="add-record" onClick={addRow}>＋ Добавить запись</button>:null}
  </div>;
}
