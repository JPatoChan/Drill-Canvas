import { fieldGeometry, getSnappedPerformerPlacement, snapToMarchingStep, type VerticalReferenceId } from './fieldGeometry'
import { createPerformer, performerMarkerRadiusSvg, type Performer } from './performers'

export type FormationOperation = 'alignHorizontal' | 'alignVertical' | 'distributeHorizontal' | 'distributeVertical' | 'makeLine'

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(Math.max(value, minimum), maximum)

const snapHorizontal = (x: number) => clamp(
  snapToMarchingStep(x, fieldGeometry.firstGoalLineSvg),
  performerMarkerRadiusSvg,
  fieldGeometry.svgWidth - performerMarkerRadiusSvg,
)

const snapPoint = (x: number, y: number) =>
  getSnappedPerformerPlacement({ x, y }, performerMarkerRadiusSvg)

const snapPointToReference = (x: number, y: number, verticalReferenceId: VerticalReferenceId) => {
  const origin = fieldGeometry.verticalReferencePositionsSvg[verticalReferenceId]
  const minimumStep = Math.ceil((performerMarkerRadiusSvg - origin) / fieldGeometry.marchingStepSizeSvg)
  const maximumStep = Math.floor(
    (fieldGeometry.svgHeight - performerMarkerRadiusSvg - origin) / fieldGeometry.marchingStepSizeSvg,
  )
  const step = clamp(
    Math.round((y - origin) / fieldGeometry.marchingStepSizeSvg),
    minimumStep,
    maximumStep,
  )

  return {
    x: snapHorizontal(x),
    y: origin + step * fieldGeometry.marchingStepSizeSvg,
    verticalReferenceId,
  }
}

const getSelected = (performers: readonly Performer[], selectedIds: readonly string[]) =>
  selectedIds.flatMap((id) => {
    const performer = performers.find((candidate) => candidate.id === id)
    return performer ? [performer] : []
  })

export const applyFormationOperation = (
  performers: readonly Performer[],
  selectedIds: readonly string[],
  operation: FormationOperation,
): Performer[] => {
  const selected = getSelected(performers, selectedIds)

  if (selected.length < 2) {
    return [...performers]
  }

  const updates = new Map<string, Pick<Performer, 'x' | 'y' | 'verticalReferenceId'>>()

  if (operation === 'alignHorizontal') {
    const averageY = selected.reduce((sum, performer) => sum + performer.y, 0) / selected.length
    const target = snapPointToReference(selected[0].x, averageY, selected[0].verticalReferenceId)
    selected.forEach((performer) => updates.set(performer.id, {
      x: performer.x,
      y: target.y,
      verticalReferenceId: target.verticalReferenceId,
    }))
  }

  if (operation === 'alignVertical') {
    const targetX = snapHorizontal(selected.reduce((sum, performer) => sum + performer.x, 0) / selected.length)
    selected.forEach((performer) => updates.set(performer.id, {
      x: targetX,
      y: performer.y,
      verticalReferenceId: performer.verticalReferenceId,
    }))
  }

  if (operation === 'distributeHorizontal' || operation === 'distributeVertical') {
    const axis = operation === 'distributeHorizontal' ? 'x' : 'y'
    const ordered = selected.map((performer, index) => ({ performer, index }))
      .sort((first, second) => first.performer[axis] - second.performer[axis] || first.index - second.index)
    const first = ordered[0].performer[axis]
    const last = ordered[ordered.length - 1].performer[axis]

    ordered.forEach(({ performer }, index) => {
      const coordinate = first + ((last - first) * index) / (ordered.length - 1)
      const target = axis === 'x'
        ? { ...performer, x: snapHorizontal(coordinate) }
        : index === 0 || index === ordered.length - 1
          ? performer
          : { ...performer, ...snapPointToReference(performer.x, coordinate, ordered[0].performer.verticalReferenceId) }
      updates.set(performer.id, target)
    })
  }

  if (operation === 'makeLine') {
    const first = selected[0]
    const last = selected[selected.length - 1]

    selected.forEach((performer, index) => {
      const progress = index / (selected.length - 1)
      const target = index === 0 || index === selected.length - 1
        ? performer
        : snapPointToReference(
          first.x + (last.x - first.x) * progress,
          first.y + (last.y - first.y) * progress,
          first.verticalReferenceId,
        )
      updates.set(performer.id, target)
    })
  }

  return performers.map((performer) => {
    const update = updates.get(performer.id)
    return update ? { ...performer, ...update } : performer
  })
}

export const duplicateSelectedPerformers = (
  performers: readonly Performer[],
  selectedIds: readonly string[],
): Performer[] => {
  let performersWithDuplicates = [...performers]

  getSelected(performers, selectedIds).forEach((performer) => {
    let placement = snapPointToReference(
      performer.x + fieldGeometry.marchingStepSizeSvg,
      performer.y + fieldGeometry.marchingStepSizeSvg,
      performer.verticalReferenceId,
    )

    if (placement.x === performer.x && placement.y === performer.y) {
      placement = snapPointToReference(
        performer.x - fieldGeometry.marchingStepSizeSvg,
        performer.y - fieldGeometry.marchingStepSizeSvg,
        performer.verticalReferenceId,
      )
    }

    performersWithDuplicates.push({
      ...createPerformer(placement, performersWithDuplicates),
      name: performer.name,
      section: performer.section,
    })
  })

  return performersWithDuplicates
}

export const makeArcFormation = (
  performers: readonly Performer[],
  selectedIds: readonly string[],
  center: Pick<Performer, 'x' | 'y'>,
  radius: number,
  startAngle: number,
  endAngle: number,
) => applyPolarFormation(performers, selectedIds, center, radius, startAngle, endAngle, false)

export const makeCircleFormation = (
  performers: readonly Performer[],
  selectedIds: readonly string[],
  center: Pick<Performer, 'x' | 'y'>,
  radius: number,
) => applyPolarFormation(performers, selectedIds, center, radius, 0, Math.PI * 2, true)

const applyPolarFormation = (
  performers: readonly Performer[],
  selectedIds: readonly string[],
  center: Pick<Performer, 'x' | 'y'>,
  radius: number,
  startAngle: number,
  endAngle: number,
  isCircle: boolean,
): Performer[] => {
  const selected = getSelected(performers, selectedIds)

  if (selected.length < 2) {
    return [...performers]
  }

  const updates = new Map(selected.map((performer, index) => {
    const divisor = isCircle ? selected.length : selected.length - 1
    const angle = startAngle + ((endAngle - startAngle) * index) / divisor
    const target = snapPoint(center.x + Math.cos(angle) * radius, center.y + Math.sin(angle) * radius)
    return [performer.id, target] as const
  }))

  return performers.map((performer) => {
    const update = updates.get(performer.id)
    return update ? { ...performer, ...update } : performer
  })
}