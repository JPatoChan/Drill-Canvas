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
    highSchoolHashOffsetSvg,
    fieldWidthSvg - highSchoolHashOffsetSvg,
  ],
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