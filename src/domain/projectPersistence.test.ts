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
    music: null,
  }

  beforeEach(() => localStorage.clear())

  it('round-trips a human-readable schema-v2 project', () => {
    const serialized = serializeProject(snapshot)

    expect(serialized).toContain('\n  "schemaVersion": 2')
    expect(parseProject(serialized)).toEqual(snapshot)
  })

  it('autosaves and restores the latest project locally', () => {
    saveProjectLocally(snapshot)

    expect(localStorage.getItem(projectStorageKey)).toBe(serializeProject(snapshot))
    expect(restoreLocalProject()).toEqual(snapshot)
  })

  it('reads legacy schema-v1 projects without a music field', () => {
    const legacyProject = JSON.parse(serializeProject(snapshot))
    legacyProject.schemaVersion = 1
    delete legacyProject.music

    expect(parseProject(JSON.stringify(legacyProject))).toEqual(snapshot)
  })

  it('rejects malformed and unsupported projects clearly', () => {
    expect(() => parseProject('{nope')).toThrow('not valid JSON')
    expect(() => parseProject(JSON.stringify({ schemaVersion: 99 }))).toThrow('Unsupported project schema version: 99')
    expect(() => parseProject(JSON.stringify({ ...JSON.parse(serializeProject(snapshot)), drillSets: [] })))
      .toThrow('invalid drill set data')
    expect(() => parseProject(JSON.stringify({ ...JSON.parse(serializeProject(snapshot)), music: { title: 'x' } })))
      .toThrow('invalid music data')
  })
})