import {
  fieldGeometry,
  getNearestVerticalReferenceId,
  getSnappedPerformerPlacement,
  snapToMarchingStep,
  type VerticalReferenceId,
} from './fieldGeometry'

export type Performer = {
  id: string
  label: string
  name?: string
  section?: string
  x: number
  y: number
  verticalReferenceId: VerticalReferenceId
}

export const performerMarkerRadiusSvg = 6

type PerformerPlacement = Pick<Performer, 'x' | 'y' | 'verticalReferenceId'>

export const performers: readonly Performer[] = [
  {
    id: 't1',
    label: 'T1',
    name: '',
    section: '',
    x: 600,
    y: fieldGeometry.marchingStepSizeSvg * 42,
    verticalReferenceId: 'backSideline',
  },
]

export const createPerformer = (
  placement: PerformerPlacement,
  existingPerformers: readonly Performer[],
): Performer => {
  const existingPlacementNumbers = existingPerformers
    .flatMap(({ id, label }) => [
      /^p(\d+)$/.exec(id)?.[1],
      /^P(\d+)$/.exec(label)?.[1],
    ])
    .filter((number): number is string => number !== undefined)
    .map(Number)
  const placementNumber = Math.max(0, ...existingPlacementNumbers) + 1

  return {
    id: `p${placementNumber}`,
    label: `P${placementNumber}`,
    name: '',
    section: '',
    ...placement,
  }
}

const clampGroupDelta = (delta: number, minimum: number, maximum: number) => {
  const clampedDelta = Math.min(Math.max(delta, minimum), maximum)

  if (clampedDelta === delta) {
    return delta
  }

  return clampedDelta > 0
    ? Math.floor(clampedDelta / fieldGeometry.marchingStepSizeSvg) * fieldGeometry.marchingStepSizeSvg
    : Math.ceil(clampedDelta / fieldGeometry.marchingStepSizeSvg) * fieldGeometry.marchingStepSizeSvg
}

export const moveSelectedPerformers = (
  currentPerformers: readonly Performer[],
  selectedPerformerIds: readonly string[],
  draggedPerformerId: string,
  rawPosition: Pick<Performer, 'x' | 'y'>,
): Performer[] => {
  const selectedIds = selectedPerformerIds.includes(draggedPerformerId)
    ? selectedPerformerIds
    : [draggedPerformerId]
  const draggedPerformer = currentPerformers.find(({ id }) => id === draggedPerformerId)

  if (!draggedPerformer) {
    return [...currentPerformers]
  }

  const selectedPerformers = currentPerformers.filter(({ id }) => selectedIds.includes(id))
  const isGroupMovement = selectedPerformers.length > 1
  const targetPlacement = getSnappedPerformerPlacement(rawPosition, performerMarkerRadiusSvg)
  const rawDeltaX = isGroupMovement
    ? snapToMarchingStep(rawPosition.x - draggedPerformer.x)
    : targetPlacement.x - draggedPerformer.x
  const rawDeltaY = isGroupMovement
    ? snapToMarchingStep(rawPosition.y - draggedPerformer.y)
    : targetPlacement.y - draggedPerformer.y
  const deltaX = clampGroupDelta(
    rawDeltaX,
    Math.max(...selectedPerformers.map(({ x }) => performerMarkerRadiusSvg - x)),
    Math.min(...selectedPerformers.map(({ x }) => fieldGeometry.svgWidth - performerMarkerRadiusSvg - x)),
  )
  const deltaY = clampGroupDelta(
    rawDeltaY,
    Math.max(...selectedPerformers.map(({ y }) => performerMarkerRadiusSvg - y)),
    Math.min(...selectedPerformers.map(({ y }) => fieldGeometry.svgHeight - performerMarkerRadiusSvg - y)),
  )

  return currentPerformers.map((performer) => selectedIds.includes(performer.id)
    ? {
        ...performer,
        x: performer.x + deltaX,
        y: performer.y + deltaY,
        verticalReferenceId: isGroupMovement
          ? getNearestVerticalReferenceId(performer.y + deltaY)
          : targetPlacement.verticalReferenceId,
      }
    : performer,
  )
}