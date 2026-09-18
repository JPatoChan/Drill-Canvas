import {
  fieldGeometry,
  getFiveYardLinePositions,
  getYardLinePositions,
  getYardNumberPositions,
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
  })
})