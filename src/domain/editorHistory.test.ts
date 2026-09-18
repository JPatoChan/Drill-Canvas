import { createEditorHistory, reduceEditorHistory, type EditorSnapshot } from './editorHistory'

describe('editor history', () => {
  const snapshot = (activeSetId: string): EditorSnapshot => ({
    performerMetadata: [],
    drillSets: [],
    activeSetId,
  })

  it('undoes and redoes committed snapshots', () => {
    const initial = createEditorHistory(snapshot('set-1'))
    const committed = reduceEditorHistory(initial, { type: 'commit', snapshot: snapshot('set-2') })
    const undone = reduceEditorHistory(committed, { type: 'undo' })

    expect(undone.present.activeSetId).toBe('set-1')
    expect(reduceEditorHistory(undone, { type: 'redo' }).present.activeSetId).toBe('set-2')
  })

  it('clears redo when a new edit is committed', () => {
    const committed = reduceEditorHistory(createEditorHistory(snapshot('set-1')), {
      type: 'commit', snapshot: snapshot('set-2'),
    })
    const undone = reduceEditorHistory(committed, { type: 'undo' })
    const branched = reduceEditorHistory(undone, { type: 'commit', snapshot: snapshot('set-3') })

    expect(branched.future).toEqual([])
    expect(reduceEditorHistory(branched, { type: 'redo' })).toBe(branched)
  })

  it('records one pre-gesture checkpoint after live replacements', () => {
    const initial = createEditorHistory(snapshot('start'))
    const movedOnce = reduceEditorHistory(initial, { type: 'replace', snapshot: snapshot('move-1') })
    const movedTwice = reduceEditorHistory(movedOnce, { type: 'replace', snapshot: snapshot('move-2') })
    const checkpointed = reduceEditorHistory(movedTwice, { type: 'checkpoint', snapshot: initial.present })

    expect(checkpointed.past).toHaveLength(1)
    expect(reduceEditorHistory(checkpointed, { type: 'undo' }).present.activeSetId).toBe('start')
  })
})