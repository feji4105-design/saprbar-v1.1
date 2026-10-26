import type { LegacyVariant } from "./types";

export interface LegacyEditableFile {
  name: string;
  text: string;
}

export type LegacyEditableSet = Record<"CN" | "LD" | "MD", LegacyEditableFile>;

const B_CN = `2 1 1 0 0
0 0
1000 0
1 2 1
1 210000 0 0 10000 8333333.333333 50 50 0 0
`;

const R_CN = `2 1 1 0 0
0 0
1000 0
1 2 1
1 210000 0 0 0 10000 8333333.333333 50 50 0 0
`;

const LD = `1 1 0 0
1 1 1 1 0 0 0
2 0 -1 0
`;

const MD = `0 1 1 1 0 0 0 0 0 0
1 0 0 0 0 0 0 0 0 1
`;

export function createLegacyTemplate(variant: LegacyVariant): LegacyEditableSet {
  return {
    CN: { name: "model.CN", text: variant === "B" ? B_CN : R_CN },
    LD: { name: "load.LD", text: LD },
    MD: { name: "method.MD", text: MD }
  };
}

export function createBlankLegacySet(): LegacyEditableSet {
  return {
    CN: { name: "model.CN", text: "" },
    LD: { name: "load.LD", text: "" },
    MD: { name: "method.MD", text: "" }
  };
}

