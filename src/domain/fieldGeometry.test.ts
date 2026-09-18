import {
  fieldGeometry,
  formatHorizontalCoordinate,
  formatVerticalCoordinate,
  getFiveYardLinePositions,
  getSnappedPerformerPlacement,
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

    const { backHash, frontHash } = fieldGeometry.verticalReferencePositionsSvg

    expect(backHash).toBe(fieldGeometry.svgHeight / 3)
    expect(frontHash).toBe(fieldGeometry.svgHeight - fieldGeometry.svgHeight / 3)
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
    const { backHash, frontHash } = fieldGeometry.verticalReferencePositionsSvg

    expect(getSnappedPerformerPosition({ x: 600, y: frontHash }, 12).y).toBe(frontHash)
    expect(getSnappedPerformerPosition({ x: 600, y: backHash }, 12).y).toBe(backHash)
    expect(getSnappedPerformerPosition({ x: 600, y: frontHash - 19 }, 12).y).toBe(frontHash - 18.75)
    expect(getSnappedPerformerPosition({ x: 600, y: backHash + 12.5 }, 12).y).toBe(backHash + 12.5)
  })

  it('clamps performer positions inside the field marker boundary', () => {
    expect(getSnappedPerformerPosition({ x: -100, y: -100 }, 12)).toEqual({ x: 12.5, y: 12.5 })
    expect(getSnappedPerformerPosition({ x: 2000, y: 2000 }, 12)).toEqual({
      x: 1187.5,
      y: fieldGeometry.svgHeight - 12.5,
    })
  })

  it('formats horizontal marching coordinates from snapped positions', () => {
    expect(formatHorizontalCoordinate(600)).toBe('On 50 yd ln')
    expect(formatHorizontalCoordinate(500)).toBe('Side 1: On 40 yd ln')
    expect(formatHorizontalCoordinate(512.5)).toBe('Side 1: 2.0 steps Inside 40 yd ln')
    expect(formatHorizontalCoordinate(487.5)).toBe('Side 1: 2.0 steps Outside 40 yd ln')
    expect(formatHorizontalCoordinate(437.5)).toBe('Side 1: 2.0 steps Outside 35 yd ln')
    expect(formatHorizontalCoordinate(687.5)).toBe('Side 2: 2.0 steps Inside 40 yd ln')
    expect(formatHorizontalCoordinate(712.5)).toBe('Side 2: 2.0 steps Outside 40 yd ln')
    expect(formatHorizontalCoordinate(596.875)).toBe('Side 1: 0.5 steps Outside 50 yd ln')
    expect(formatHorizontalCoordinate(646.875)).toBe('Side 2: 0.5 steps Inside 45 yd ln')
    expect(formatHorizontalCoordinate(514.0625)).toBe('Side 1: 2.25 steps Inside 40 yd ln')
    expect(formatHorizontalCoordinate(537.5)).toBe('Side 1: 2.0 steps Outside 45 yd ln')
    expect(formatHorizontalCoordinate(550)).toBe('Side 1: On 45 yd ln')
    expect(formatHorizontalCoordinate(525)).toBe('Side 1: 4.0 steps Inside 40 yd ln')
  })

  it('never formats a playing-field position more than four steps from its nearest five-yard line', () => {
    const horizontalPositions = Array.from(
      { length: 161 },
      (_, index) => fieldGeometry.firstGoalLineSvg + index * fieldGeometry.marchingStepSizeSvg,
    )

    horizontalPositions.forEach((position) => {
      const coordinate = formatHorizontalCoordinate(position)
      const stepCount = Number.parseFloat(coordinate.split(': ')[1])

      if (!Number.isNaN(stepCount)) {
        expect(stepCount).toBeLessThanOrEqual(4)
      }
    })
  })

  it('formats vertical marching coordinates from reference lines', () => {
    const { backHash, frontHash } = fieldGeometry.verticalReferencePositionsSvg

    expect(formatVerticalCoordinate(frontHash)).toBe('On Home hash')
    expect(formatVerticalCoordinate(backHash)).toBe('On Back hash')
    expect(formatVerticalCoordinate(fieldGeometry.svgHeight)).toBe('On Home side line')
    expect(formatVerticalCoordinate(0)).toBe('On Back side line')
    expect(formatVerticalCoordinate(fieldGeometry.svgHeight + 43.75)).toBe('7.0 steps In front of Home side line')
    expect(formatVerticalCoordinate(frontHash - 12.5)).toBe('2.0 steps Behind Home hash')
    expect(formatVerticalCoordinate(backHash + 28.125)).toBe('4.5 steps In front of Back hash')
    expect(formatVerticalCoordinate(frontHash + 14.0625)).toBe('2.25 steps In front of Home hash')
  })

  it('formats snapped vertical positions with whole marching-step offsets', () => {
    const snappedPosition = getSnappedPerformerPlacement({ x: 600, y: 220 }, 12)

    expect(snappedPosition.verticalReferenceId).toBe('backHash')
    expect(formatVerticalCoordinate(snappedPosition.y, snappedPosition.verticalReferenceId)).toBe('7.0 steps In front of Back hash')
  })

  it('preserves the nearest hash reference selected during vertical snapping', () => {
    const { backHash, frontHash } = fieldGeometry.verticalReferencePositionsSvg
    const nearHomeHash = getSnappedPerformerPlacement({ x: 600, y: frontHash - 19 }, 12)
    const nearBackHash = getSnappedPerformerPlacement({ x: 600, y: backHash + 12 }, 12)

    expect(nearHomeHash.verticalReferenceId).toBe('frontHash')
    expect(formatVerticalCoordinate(nearHomeHash.y, nearHomeHash.verticalReferenceId)).toBe('3.0 steps Behind Home hash')
    expect(nearBackHash.verticalReferenceId).toBe('backHash')
    expect(formatVerticalCoordinate(nearBackHash.y, nearBackHash.verticalReferenceId)).toBe('2.0 steps In front of Back hash')
  })
})