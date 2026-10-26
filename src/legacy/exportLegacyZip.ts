import {strToU8,zipSync} from "fflate";
import type {Project} from "../model";
import {exportLegacySI,type LegacyExportProperties} from "./exportLegacy";

/** Always generate afresh from the model, never archive previously edited/stale text buffers. */
export function exportLegacyZip(project:Project,basename?:string,density?:number,properties?:LegacyExportProperties) {
  const files=exportLegacySI(project,basename,density,properties);
  return {files,bytes:zipSync(Object.fromEntries(Object.values(files).map(f=>[f.name,strToU8(f.text)])),{level:0}),name:files.CN.name.replace(/\.CN$/,".zip")};
}
