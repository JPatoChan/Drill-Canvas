import { fieldGeometry, isOnMarchingStep } from './fieldGeometry'
import { applyFormationOperation, duplicateSelectedPerformers, makeArcFormation, makeCircleFormation } from './formations'
import { createPerformer, performerMarkerRadiusSvg, type Performer } from './performers'

describe('formation editing', () => {
  const makePerformer = (id: string, x: number, y: number): Performer => ({
    ...createPerformer({ x, y, verticalReferenceId: 'backHash' }, []),
    id,
    label: id.toUpperCase(),
  })
  const performers = [
    makePerformer('p1', 200, 177.7777777777778),
    makePerformer('p2', 300, 240.2777777777778),
    makePerformer('p3', 500, 302.7777777777778),
    makePerformer('other', 900, 100),
  ]
  const selectedIds = ['p1', 'p2', 'p3']

  it('aligns selected performers horizontally and vertically', () => {
    const horizontal = applyFormationOperation(performers, selectedIds, 'alignHorizontal')
    const vertical = applyFormationOperation(performers, selectedIds, 'alignVertical')

    expect(new Set(horizontal.slice(0, 3).map(({ y }) => y)).size).toBe(1)
    expect(new Set(vertical.slice(0, 3).map(({ x }) => x)).size).toBe(1)
    expect(horizontal[3]).toEqual(performers[3])
    expect(vertical[3]).toEqual(performers[3])
  })

  it('distributes selected performers evenly with stable ordering', () => {
    const horizontal = applyFormationOperation(performers, selectedIds, 'distributeHorizontal')
    const vertical = applyFormationOperation(performers, selectedIds, 'distributeVertical')

    expect(horizontal.slice(0, 3).map(({ x }) => x)).toEqual([200, 350, 500])
    expect(vertical[1].y - vertical[0].y).toBeCloseTo(vertical[2].y - vertical[1].y)
  })

  it('uses first and last selection entries as snapped line endpoints', () => {
    const line = applyFormationOperation(performers, ['p3', 'p2', 'p1'], 'makeLine')

    expect(line.find(({ id }) => id === 'p3')).toMatchObject({ x: 500, y: performers[2].y })
    expect(line.find(({ id }) => id === 'p2')?.x).toBe(350)
    expect(line.find(({ id }) => id === 'p1')).toMatchObject({ x: 200, y: performers[0].y })
  })

  it('keeps generated positions snapped and within marker boundaries', () => {
    const nearEdges = [makePerformer('p1', 6.25, 6.25), makePerformer('p2', 1193.75, 527.0833333333334)]
    const results = [
      applyFormationOperation(nearEdges, ['p1', 'p2'], 'makeLine'),
      makeArcFormation(nearEdges, ['p1', 'p2'], { x: 0, y: 0 }, 100, Math.PI, Math.PI * 2),
      makeCircleFormation(nearEdges, ['p1', 'p2'], { x: 1200, y: 533 }, 100),
    ]

    results.flat().forEach(({ x, y }) => {
      expect(isOnMarchingStep(x, fieldGeometry.firstGoalLineSvg)).toBe(true)
      expect(x).toBeGreaterThanOrEqual(performerMarkerRadiusSvg)
      expect(x).toBeLessThanOrEqual(fieldGeometry.svgWidth - performerMarkerRadiusSvg)
      expect(y).toBeGreaterThanOrEqual(performerMarkerRadiusSvg)
      expect(y).toBeLessThanOrEqual(fieldGeometry.svgHeight - performerMarkerRadiusSvg)
    })
  })

  it('duplicates selection with unique sequential identity and copied metadata', () => {
    const source = { ...performers[0], name: 'Morgan', section: 'Trumpet' }
    const duplicated = duplicateSelectedPerformers([source], [source.id])

    expect(duplicated).toHaveLength(2)
    expect(duplicated[1]).toMatchObject({ id: 'p2', label: 'P2', name: 'Morgan', section: 'Trumpet' })
    expect(duplicated[1].x).not.toBe(source.x)
    expect(duplicated[1].y).not.toBe(source.y)
  })
})