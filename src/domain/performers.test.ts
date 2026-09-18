import { fieldGeometry, formatVerticalCoordinate, isOnMarchingStep } from './fieldGeometry'
import {
  createPerformer,
  moveSelectedPerformers,
  performerMarkerRadiusSvg,
  performers,
} from './performers'

describe('performers', () => {
  it('provides T1 at a valid 8-to-5 marching-step position', () => {
    expect(performers).toEqual([
      expect.objectContaining({ id: 't1', label: 'T1' }),
    ])

    const [performer] = performers

    expect(isOnMarchingStep(performer.x)).toBe(true)
    expect(isOnMarchingStep(performer.y)).toBe(true)
    expect(performer.x).toBeGreaterThanOrEqual(fieldGeometry.firstGoalLineSvg)
    expect(performer.x).toBeLessThanOrEqual(fieldGeometry.secondGoalLineSvg)
    expect(performer.y).toBeGreaterThan(0)
    expect(performer.y).toBeLessThan(fieldGeometry.svgHeight)
  })

  it('assigns sequential labels and unique IDs to new performers', () => {
    const p1 = createPerformer({ x: 200, y: 200, verticalReferenceId: 'backHash' }, performers)
    const p2 = createPerformer({ x: 300, y: 300, verticalReferenceId: 'frontHash' }, [...performers, p1])

    expect(p1).toMatchObject({ id: 'p1', label: 'P1' })
    expect(p2).toMatchObject({ id: 'p2', label: 'P2' })
  })

  it('moves a selected group together without crossing field boundaries', () => {
    const p1 = createPerformer({ x: 200, y: 200, verticalReferenceId: 'backHash' }, performers)
    const p2 = createPerformer({ x: 250, y: 250, verticalReferenceId: 'backHash' }, [...performers, p1])
    const movedPerformers = moveSelectedPerformers([p1, p2], [p1.id, p2.id], p1.id, { x: 300, y: 300 })

    expect(movedPerformers[1].x - movedPerformers[0].x).toBe(50)
    expect(movedPerformers[1].y - movedPerformers[0].y).toBe(50)
    expect(movedPerformers.every(({ x, y }) => x >= 12 && x <= 1188 && y >= 12 && y <= fieldGeometry.svgHeight - 12)).toBe(true)
  })

  it('snaps a group delta without distorting its formation', () => {
    const { backHash } = fieldGeometry.verticalReferencePositionsSvg
    const p1 = createPerformer({ x: 200, y: backHash + 12.5, verticalReferenceId: 'backHash' }, performers)
    const p2 = createPerformer({ x: 250, y: backHash + 62.5, verticalReferenceId: 'backHash' }, [...performers, p1])
    const movedPerformers = moveSelectedPerformers([p1, p2], [p1.id, p2.id], p1.id, { x: 302, y: p1.y + 53 })

    expect(movedPerformers[0]).toMatchObject({ x: 300, y: p1.y + 50 })
    expect(movedPerformers[1]).toMatchObject({ x: 350, y: p2.y + 50 })
    expect(movedPerformers[1].x - movedPerformers[0].x).toBe(p2.x - p1.x)
    expect(movedPerformers[1].y - movedPerformers[0].y).toBeCloseTo(p2.y - p1.y)
  })

  it('clamps a group with one shared snapped delta at the field boundary', () => {
    const p1 = createPerformer({ x: 1100, y: 200, verticalReferenceId: 'backHash' }, performers)
    const p2 = createPerformer({ x: 1150, y: 250, verticalReferenceId: 'backHash' }, [...performers, p1])
    const movedPerformers = moveSelectedPerformers([p1, p2], [p1.id, p2.id], p1.id, { x: 1300, y: 700 })

    expect(movedPerformers[1].x).toBe(1187.5)
    expect(movedPerformers[1].y).toBeLessThanOrEqual(fieldGeometry.svgHeight - performerMarkerRadiusSvg)
    expect(movedPerformers[1].x - movedPerformers[0].x).toBe(50)
    expect(movedPerformers[1].y - movedPerformers[0].y).toBe(50)
  })

  it('updates group member references when movement crosses to a nearer hash', () => {
    const { backHash } = fieldGeometry.verticalReferencePositionsSvg
    const p1 = createPerformer({ x: 200, y: backHash + 12.5, verticalReferenceId: 'backHash' }, performers)
    const p2 = createPerformer({ x: 250, y: backHash + 62.5, verticalReferenceId: 'backHash' }, [...performers, p1])
    const movedPerformers = moveSelectedPerformers(
      [p1, p2],
      [p1.id, p2.id],
      p1.id,
      { x: p1.x, y: p1.y + 150 },
    )

    expect(movedPerformers[0].y).toBe(p1.y + 150)
    expect(movedPerformers[1].y).toBe(p2.y + 150)
    expect(movedPerformers[1].y - movedPerformers[0].y).toBeCloseTo(50)
    expect(movedPerformers.map(({ verticalReferenceId }) => verticalReferenceId)).toEqual(['frontHash', 'frontHash'])
    expect(formatVerticalCoordinate(movedPerformers[0].y, movedPerformers[0].verticalReferenceId)).toContain('Home hash')
    expect(formatVerticalCoordinate(movedPerformers[1].y, movedPerformers[1].verticalReferenceId)).toContain('Home hash')
  })
})