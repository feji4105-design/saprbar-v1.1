import { useCallback, useState } from "react";
import type { Project } from "../model";

interface HistoryState {
  past: Project[];
  present: Project;
  future: Project[];
}

function stamp(project: Project): Project {
  return { ...project, metadata: { ...project.metadata, updatedAt: new Date().toISOString() } };
}

export function useProjectHistory(initial: Project) {
  const [history, setHistory] = useState<HistoryState>({ past: [], present: initial, future: [] });

  const commit = useCallback((update: (project: Project) => Project) => {
    setHistory((current) => {
      const next = stamp(update(structuredClone(current.present)));
      return { past: [...current.past, current.present].slice(-100), present: next, future: [] };
    });
  }, []);

  const replace = useCallback((project: Project) => {
    setHistory({ past: [], present: structuredClone(project), future: [] });
  }, []);

  const undo = useCallback(() => {
    setHistory((current) => {
      const previous = current.past.at(-1);
      if (!previous) return current;
      return { past: current.past.slice(0, -1), present: previous, future: [current.present, ...current.future] };
    });
  }, []);

  const redo = useCallback(() => {
    setHistory((current) => {
      const next = current.future[0];
      if (!next) return current;
      return { past: [...current.past, current.present], present: next, future: current.future.slice(1) };
    });
  }, []);

  return {
    project: history.present,
    commit,
    replace,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0
  };
}
