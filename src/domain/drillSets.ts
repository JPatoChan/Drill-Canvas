import type { Performer } from './performers'

export type PerformerMetadata = Pick<Performer, 'id' | 'label' | 'name' | 'section'>
export type PerformerPosition = Pick<Performer, 'x' | 'y' | 'verticalReferenceId'> & {
  performerId: string
}

export type DrillSet = {
  id: string
  name: string
  counts: number
  performerPositions: PerformerPosition[]
}

export const getPerformerMetadata = (performer: Performer): PerformerMetadata => ({
  id: performer.id,
  label: performer.label,
  name: performer.name,
  section: performer.section,
})

export const getPerformerPosition = (performer: Performer): PerformerPosition => ({
  performerId: performer.id,
  x: performer.x,
  y: performer.y,
  verticalReferenceId: performer.verticalReferenceId,
})

export const getPerformersForSet = (
  performerMetadata: readonly PerformerMetadata[],
  drillSet: DrillSet,
): Performer[] => drillSet.performerPositions.flatMap(({ performerId, ...position }) => {
  const metadata = performerMetadata.find(({ id }) => id === performerId)

  return metadata ? [{ ...metadata, ...position }] : []
})

export const createNextDrillSet = (
  drillSets: readonly DrillSet[],
  sourceSet: DrillSet,
): DrillSet => {
  const setNumber = Math.max(0, ...drillSets.map(({ name }) => /^Set (\d+)$/.exec(name)?.[1])
    .filter((number): number is string => number !== undefined)
    .map(Number)) + 1

  return {
    id: `set-${setNumber}`,
    name: `Set ${setNumber}`,
    counts: 16,
    performerPositions: sourceSet.performerPositions.map((position) => ({ ...position })),
  }
}