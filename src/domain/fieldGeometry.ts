const SVG_UNITS_PER_YARD = 10
const PLAYING_FIELD_LENGTH_YARDS = 100
const FIELD_WIDTH_YARDS = 53 + 1 / 3
const END_ZONE_DEPTH_YARDS = 10
const MARCHING_STEPS_PER_FIVE_YARDS = 8
const FIELD_BOUNDARY_INSET = 1
const HASH_MARK_HALF_LENGTH = 7
const YARD_NUMBER_TOP_Y = 70
const YARD_NUMBER_BOTTOM_Y = 463

const totalFieldLengthYards = PLAYING_FIELD_LENGTH_YARDS + END_ZONE_DEPTH_YARDS * 2
const fieldWidthSvg = FIELD_WIDTH_YARDS * SVG_UNITS_PER_YARD
const totalFieldLengthSvg = totalFieldLengthYards * SVG_UNITS_PER_YARD
const endZoneDepthSvg = END_ZONE_DEPTH_YARDS * SVG_UNITS_PER_YARD
const playingFieldLengthSvg = PLAYING_FIELD_LENGTH_YARDS * SVG_UNITS_PER_YARD
const firstGoalLineSvg = endZoneDepthSvg
const secondGoalLineSvg = firstGoalLineSvg + playingFieldLengthSvg
const highSchoolHashOffsetSvg = fieldWidthSvg / 3
const backHashSvg = highSchoolHashOffsetSvg
const frontHashSvg = fieldWidthSvg - highSchoolHashOffsetSvg

export type VerticalReferenceId = 'backSideline' | 'backHash' | 'frontHash' | 'frontSideline'

const verticalReferenceLines = [
  { id: 'backSideline', label: 'Back side line', position: 0 },
  { id: 'backHash', label: 'Back hash', position: backHashSvg },
  { id: 'frontHash', label: 'Home hash', position: frontHashSvg },
  { id: 'frontSideline', label: 'Home side line', position: fieldWidthSvg },
] as const

export const fieldGeometry = {
  svgUnitsPerYard: SVG_UNITS_PER_YARD,
  playingFieldLengthYards: PLAYING_FIELD_LENGTH_YARDS,
  fieldWidthYards: FIELD_WIDTH_YARDS,
  endZoneDepthYards: END_ZONE_DEPTH_YARDS,
  totalFieldLengthYards,
  marchingStepsPerFiveYards: MARCHING_STEPS_PER_FIVE_YARDS,
  marchingStepSizeSvg: (5 * SVG_UNITS_PER_YARD) / MARCHING_STEPS_PER_FIVE_YARDS,
  svgWidth: totalFieldLengthSvg,
  svgHeight: fieldWidthSvg,
  endZoneDepthSvg,
  playingFieldLengthSvg,
  firstGoalLineSvg,
  secondGoalLineSvg,
  fieldBoundaryInset: FIELD_BOUNDARY_INSET,
  hashMarkHalfLength: HASH_MARK_HALF_LENGTH,
  highSchoolHashPositionsSvg: [
    backHashSvg,
    frontHashSvg,
  ],
  verticalReferencePositionsSvg: {
    backSideline: 0,
    backHash: backHashSvg,
    frontHash: frontHashSvg,
    frontSideline: fieldWidthSvg,
  },
  verticalReferenceLines,
  yardNumberPositionsSvg: {
    top: YARD_NUMBER_TOP_Y,
    bottom: YARD_NUMBER_BOTTOM_Y,
  },
} as const

export const getFiveYardLinePositions = () =>
  Array.from(
    { length: fieldGeometry.playingFieldLengthYards / 5 + 1 },
    (_, index) => fieldGeometry.firstGoalLineSvg + index * 5 * fieldGeometry.svgUnitsPerYard,
  )

export const getYardLinePositions = () =>
  Array.from(
    { length: fieldGeometry.playingFieldLengthYards + 1 },
    (_, index) => fieldGeometry.firstGoalLineSvg + index * fieldGeometry.svgUnitsPerYard,
  )

export const getYardNumberPositions = () => [10, 20, 30, 40, 50, 40, 30, 20, 10].map((value, index) => ({
  value: String(value),
  x: fieldGeometry.firstGoalLineSvg + (index + 1) * 10 * fieldGeometry.svgUnitsPerYard,
}))

export const snapToMarchingStep = (svgCoordinate: number, origin = 0) =>
  origin + Math.round((svgCoordinate - origin) / fieldGeometry.marchingStepSizeSvg) * fieldGeometry.marchingStepSizeSvg

export const isOnMarchingStep = (svgCoordinate: number, origin = 0) =>
  snapToMarchingStep(svgCoordinate, origin) === svgCoordinate

export const getNearestVerticalReferenceId = (y: number): VerticalReferenceId =>
  verticalReferenceLines.reduce((nearest, candidate) =>
    Math.abs(candidate.position - y) < Math.abs(nearest.position - y) ? candidate : nearest,
  ).id

type Point = {
  x: number
  y: number
}

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(Math.max(value, minimum), maximum)

const getClosestAnchoredStep = (
  coordinate: number,
  anchors: readonly number[],
  minimum: number,
  maximum: number,
) => anchors
  .map((anchor) => {
    const minimumStep = Math.ceil((minimum - anchor) / fieldGeometry.marchingStepSizeSvg)
    const maximumStep = Math.floor((maximum - anchor) / fieldGeometry.marchingStepSizeSvg)
    const step = clamp(
      Math.round((coordinate - anchor) / fieldGeometry.marchingStepSizeSvg),
      minimumStep,
      maximumStep,
    )

    return anchor + step * fieldGeometry.marchingStepSizeSvg
  })
  .reduce((closest, candidate) =>
    Math.abs(candidate - coordinate) < Math.abs(closest - coordinate) ? candidate : closest,
  )

export const getSnappedPerformerPosition = (position: Point, markerRadius: number): Point => {
  const { x, y } = getSnappedPerformerPlacement(position, markerRadius)

  return { x, y }
}

export const getSnappedPerformerPlacement = (position: Point, markerRadius: number) => {
  const verticalReferenceId = getNearestVerticalReferenceId(position.y)
  const verticalReference = verticalReferenceLines.find(({ id }) => id === verticalReferenceId) ?? verticalReferenceLines[0]

  return {
    x: getClosestAnchoredStep(
    position.x,
    [fieldGeometry.firstGoalLineSvg],
    markerRadius,
    fieldGeometry.svgWidth - markerRadius,
    ),
    y: getClosestAnchoredStep(
    position.y,
    [verticalReference.position],
    markerRadius,
    fieldGeometry.svgHeight - markerRadius,
    ),
    verticalReferenceId,
  }
}

const formatHorizontalStepCount = (steps: number) => {
  const roundedSteps = Number(steps.toFixed(2))

  return Number.isInteger(roundedSteps) ? roundedSteps.toFixed(1) : String(roundedSteps)
}

const formatVerticalStepCount = (steps: number) => {
  const roundedSteps = Number(steps.toFixed(2))

  return Number.isInteger(roundedSteps) ? roundedSteps.toFixed(1) : String(roundedSteps)
}

const getHorizontalReferences = (isLeftSide: boolean) =>
  Array.from({ length: 11 }, (_, index) => {
    const yard = index * 5

    return {
      yard,
      x: isLeftSide
        ? fieldGeometry.firstGoalLineSvg + yard * fieldGeometry.svgUnitsPerYard
        : fieldGeometry.secondGoalLineSvg - yard * fieldGeometry.svgUnitsPerYard,
    }
  })

export const formatHorizontalCoordinate = (x: number) => {
  const midfield = fieldGeometry.svgWidth / 2

  if (x === midfield) {
    return 'On 50 yd ln'
  }

  const isLeftSide = x < midfield
  const reference = getHorizontalReferences(isLeftSide).reduce((nearest, candidate) =>
    Math.abs(candidate.x - x) < Math.abs(nearest.x - x) ? candidate : nearest,
  )
  const steps = Math.abs(x - reference.x) / fieldGeometry.marchingStepSizeSvg
  const isInside = isLeftSide ? x > reference.x : x < reference.x
  const side = isLeftSide ? '1' : '2'

  return steps === 0
    ? `Side ${side}: On ${reference.yard} yd ln`
    : `Side ${side}: ${formatHorizontalStepCount(steps)} steps ${isInside ? 'Inside' : 'Outside'} ${reference.yard} yd ln`
}

const getVerticalReferenceForCoordinate = (y: number) => {
  const alignedReferences = fieldGeometry.verticalReferenceLines.filter(({ position }) => {
    const steps = (y - position) / fieldGeometry.marchingStepSizeSvg

    return Math.abs(steps - Math.round(steps)) < Number.EPSILON
  })
  const references = alignedReferences.length > 0
    ? alignedReferences
    : fieldGeometry.verticalReferenceLines

  return references.reduce((nearest, candidate) =>
    Math.abs(candidate.position - y) < Math.abs(nearest.position - y) ? candidate : nearest,
  )
}

export const formatVerticalCoordinate = (y: number, verticalReferenceId?: VerticalReferenceId) => {
  const reference = verticalReferenceId
    ? verticalReferenceLines.find(({ id }) => id === verticalReferenceId) ?? getVerticalReferenceForCoordinate(y)
    : getVerticalReferenceForCoordinate(y)
  const steps = Math.abs(y - reference.position) / fieldGeometry.marchingStepSizeSvg

  if (steps === 0) {
    return `On ${reference.label}`
  }

  const isInFront = y > reference.position
  return `${formatVerticalStepCount(steps)} steps ${isInFront ? 'In front of' : 'Behind'} ${reference.label}`
}