import { fieldGeometry, isOnMarchingStep } from './fieldGeometry'
import { performers } from './performers'

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
})