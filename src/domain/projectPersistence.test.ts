import type { EditorSnapshot } from './editorHistory'
import {
  parseProject,
  projectStorageKey,
  restoreLocalProject,
  saveProjectLocally,
  serializeProject,
} from './projectPersistence'

describe('project persistence', () => {
  const snapshot: EditorSnapshot = {
    productionName: 'Friday Night',
    performerMetadata: [{ id: 'p1', label: 'P1', name: 'Avery', section: 'Trumpet' }],
    drillSets: [{
      id: 'set-1',
      name: 'Set 1',
      counts: 0,
      performerPositions: [{ performerId: 'p1', x: 200, y: 177.7777777777778, verticalReferenceId: 'backHash' }],
    }],
    activeSetId: 'set-1',
  }

  beforeEach(() => localStorage.clear())

  it('round-trips a human-readable schema-v1 project', () => {
    const serialized = serializeProject(snapshot)

    expect(serialized).toContain('\n  "schemaVersion": 1')
    expect(parseProject(serialized)).toEqual(snapshot)
  })

  it('autosaves and restores the latest project locally', () => {
    saveProjectLocally(snapshot)

    expect(localStorage.getItem(projectStorageKey)).toBe(serializeProject(snapshot))
    expect(restoreLocalProject()).toEqual(snapshot)
  })

  it('rejects malformed and unsupported projects clearly', () => {
    expect(() => parseProject('{nope')).toThrow('not valid JSON')
    expect(() => parseProject(JSON.stringify({ schemaVersion: 2 }))).toThrow('Unsupported project schema version: 2')
    expect(() => parseProject(JSON.stringify({ ...JSON.parse(serializeProject(snapshot)), drillSets: [] })))
      .toThrow('invalid drill set data')
  })
})