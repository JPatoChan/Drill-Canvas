import {
  fieldGeometry,
  getFiveYardLinePositions,
  getSnappedPerformerPosition,
  getYardLinePositions,
  getYardNumberPositions,
  isOnMarchingStep,
  snapToMarchingStep,
} from './fieldGeometry'

describe('fieldGeometry', () => {
  it('models a regulation 120-yard field with high-school hash positions', () => {
    expect(fieldGeometry.totalFieldLengthYards).toBe(120)
    expect(fieldGeometry.fieldWidthYards).toBeCloseTo(53 + 1 / 3)
    expect(fieldGeometry.endZoneDepthYards).toBe(10)
    expect(fieldGeometry.svgHeight).toBe(fieldGeometry.fieldWidthYards * fieldGeometry.svgUnitsPerYard)

    const [topHash, bottomHash] = fieldGeometry.highSchoolHashPositionsSvg

    expect(topHash).toBe(fieldGeometry.svgHeight / 3)
    expect(bottomHash).toBe(fieldGeometry.svgHeight - fieldGeometry.svgHeight / 3)
  })

  it('maps yard and five-yard lines across the playing field', () => {
    expect(getYardLinePositions()).toHaveLength(101)
    expect(getFiveYardLinePositions()).toEqual([100, 150, 200, 250, 300, 350, 400, 450, 500, 550, 600, 650, 700, 750, 800, 850, 900, 950, 1000, 1050, 1100])
    expect(getYardNumberPositions().map(({ x }) => x)).toEqual([200, 300, 400, 500, 600, 700, 800, 900, 1000])
  })

  it('uses an 8-to-5 marching step size for future position snapping', () => {
    const eightSteps = fieldGeometry.marchingStepSizeSvg * fieldGeometry.marchingStepsPerFiveYards

    expect(fieldGeometry.marchingStepSizeSvg).toBe(6.25)
    expect(eightSteps).toBe(5 * fieldGeometry.svgUnitsPerYard)
    expect(snapToMarchingStep(107.1, fieldGeometry.firstGoalLineSvg)).toBe(106.25)
    expect(isOnMarchingStep(106.25, fieldGeometry.firstGoalLineSvg)).toBe(true)
  })

  it('snaps horizontal placement from the first goal line', () => {
    expect(getSnappedPerformerPosition({ x: 166.4, y: 100 }, 12).x).toBe(168.75)
  })

  it('snaps vertical placement to high-school hashes and their marching-step offsets', () => {
    const [frontHash, backHash] = fieldGeometry.highSchoolHashPositionsSvg

    expect(getSnappedPerformerPosition({ x: 600, y: frontHash + 1 }, 12).y).toBe(frontHash)
    expect(getSnappedPerformerPosition({ x: 600, y: backHash - 1 }, 12).y).toBe(backHash)
    expect(getSnappedPerformerPosition({ x: 600, y: frontHash - 19 }, 12).y).toBe(frontHash - 18.75)
    expect(getSnappedPerformerPosition({ x: 600, y: backHash + 12 }, 12).y).toBe(backHash + 12.5)
  })

  it('clamps performer positions inside the field marker boundary', () => {
    expect(getSnappedPerformerPosition({ x: -100, y: -100 }, 12)).toEqual({ x: 12.5, y: 12.5 })
    expect(getSnappedPerformerPosition({ x: 2000, y: 2000 }, 12)).toEqual({
      x: 1187.5,
      y: fieldGeometry.svgHeight - 12.5,
    })
  })
})