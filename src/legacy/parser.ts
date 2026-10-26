import type { LegacyInputFile, LegacyIssue } from "./types";

type NumericValues = number[] & { [index: number]: number };
export interface NumericRecord { line: number; values: NumericValues }

export class RecordReader {
  private cursor = 0;
  readonly records: NumericRecord[] = [];
  readonly issues: LegacyIssue[] = [];

  constructor(readonly kind: "CN" | "LD" | "MD", readonly file: LegacyInputFile) {
    file.text.replaceAll("\r\n", "\n").replaceAll("\r", "\n").split("\n").forEach((source, index) => {
      let trimmed = source.trim();
      if (!trimmed) return;
      // Настоящий редактор SAPR-BAR 3.0 сохраняет оформленные файлы: путь в
      // первой строке, рамки/подсказки со '*', метки записей =01 и пустые
      // резервные строки. Числовая часть после =NN соответствует таблицам
      // HELP_30B/R. Этот профиль подтверждён комплектом GOLOBORO.
      if (trimmed.startsWith("*") || new RegExp(`^${kind}:`, "i").test(trimmed)) return;
      const numbered = trimmed.match(/^=\d+\s*(.*)$/);
      if (numbered) {
        trimmed = numbered[1]!.trim();
        if (!trimmed) return;
      }
      const tokens = trimmed.split(/\s+/);
      const values = tokens.map((token, field) => {
        const normalized = token.replace(/[dD]/g, "E");
        const value = Number(normalized);
        if (!Number.isFinite(value)) this.error(index + 1, `поле ${field + 1}`, `«${token}» не является конечным числом.`);
        return value;
      }) as NumericValues;
      this.records.push({ line: index + 1, values });
    });
  }

  error(line: number, field: string, message: string): void { this.issues.push({ severity: "error", file: this.kind, line, field, message }); }

  take(count: number, label: string, integerFields: number[] = []): NumericRecord {
    const record = this.records[this.cursor++];
    if (!record) { this.error(this.file.text.split(/\r?\n/).length, label, `Ожидалась запись из ${count} полей, но файл закончился.`); return { line: 0, values: Array(Math.max(1,count)).fill(Number.NaN) as NumericValues }; }
    if (record.values.length !== count) this.error(record.line, label, `Ожидалось ${count} полей, получено ${record.values.length}.`);
    integerFields.forEach((field) => { const value=record.values[field]!; if (Number.isFinite(value) && !Number.isInteger(value)) this.error(record.line, `${label}.${field + 1}`, "Ожидалось целое число."); });
    return record;
  }

  finish(): void {
    const extra=this.records[this.cursor];
    if (extra) this.error(extra.line, "запись", `Лишняя запись после ожидаемых ${this.cursor} записей.`);
  }
}

export function positiveCount(reader: RecordReader, record: NumericRecord, index: number, name: string, allowZero=true): number {
  const value=record.values[index]!;
  if (!Number.isInteger(value) || value < (allowZero?0:1)) reader.error(record.line, name, `Ожидалось ${allowZero?"неотрицательное":"положительное"} целое число.`);
  return Number.isInteger(value)&&value>=0?value:0;
}

export function indexInRange(reader:RecordReader,record:NumericRecord,index:number,name:string,max:number):number {
  const value=record.values[index]!;
  if (!Number.isInteger(value)||value<1||value>max) reader.error(record.line,name,`Индекс должен быть целым в диапазоне 1…${max}.`);
  return value;
}
