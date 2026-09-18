import type { DrillSet, PerformerMetadata } from './drillSets'

export type EditorSnapshot = {
  productionName: string
  performerMetadata: PerformerMetadata[]
  drillSets: DrillSet[]
  activeSetId: string
}

export type EditorHistory = {
  past: EditorSnapshot[]
  present: EditorSnapshot
  future: EditorSnapshot[]
}

export type EditorHistoryAction =
  | { type: 'commit', snapshot: EditorSnapshot }
  | { type: 'replace', snapshot: EditorSnapshot }
  | { type: 'checkpoint', snapshot: EditorSnapshot }
  | { type: 'reset', snapshot: EditorSnapshot }
  | { type: 'undo' }
  | { type: 'redo' }

export const createEditorHistory = (snapshot: EditorSnapshot): EditorHistory => ({
  past: [],
  present: snapshot,
  future: [],
})

export const reduceEditorHistory = (
  history: EditorHistory,
  action: EditorHistoryAction,
): EditorHistory => {
  if (action.type === 'commit') {
    return {
      past: [...history.past, history.present],
      present: action.snapshot,
      future: [],
    }
  }

  if (action.type === 'replace') {
    return { ...history, present: action.snapshot }
  }

  if (action.type === 'checkpoint') {
    return {
      past: [...history.past, action.snapshot],
      present: history.present,
      future: [],
    }
  }

  if (action.type === 'reset') {
    return createEditorHistory(action.snapshot)
  }

  if (action.type === 'undo') {
    const previous = history.past.at(-1)

    return previous ? {
      past: history.past.slice(0, -1),
      present: previous,
      future: [history.present, ...history.future],
    } : history
  }

  const next = history.future[0]
  return next ? {
    past: [...history.past, history.present],
    present: next,
    future: history.future.slice(1),
  } : history
}