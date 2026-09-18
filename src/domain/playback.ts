import type { DrillSet, PerformerPosition } from './drillSets'

export const getMillisecondsPerCount = (bpm: number) => 60_000 / bpm

export const interpolatePerformerPositions = (
  startPositions: readonly PerformerPosition[],
  destinationPositions: readonly PerformerPosition[],
  currentCount: number,
  totalCounts: number,
): PerformerPosition[] => {
  const progress = totalCounts > 0
    ? Math.min(1, Math.max(0, currentCount / totalCounts))
    : 1
  const performerIds = [...new Set([
    ...startPositions.map(({ performerId }) => performerId),
    ...destinationPositions.map(({ performerId }) => performerId),
  ])]

  return performerIds.flatMap((performerId) => {
    const start = startPositions.find((position) => position.performerId === performerId)
    const destination = destinationPositions.find((position) => position.performerId === performerId)
    const availablePosition = destination ?? start

    if (!availablePosition) {
      return []
    }

    if (!start || !destination) {
      return [{ ...availablePosition }]
    }

    return [{
      performerId,
      x: start.x + (destination.x - start.x) * progress,
      y: start.y + (destination.y - start.y) * progress,
      verticalReferenceId: progress === 1
        ? destination.verticalReferenceId
        : start.verticalReferenceId,
    }]
  })
}

export const getCumulativeSetCounts = (drillSets: readonly DrillSet[]): number[] => {
  let cumulativeCount = 0

  return drillSets.map((drillSet, index) => {
    if (index > 0) {
      cumulativeCount += drillSet.counts
    }

    return cumulativeCount
  })
}

export const getTotalProductionCounts = (drillSets: readonly DrillSet[]) =>
  getCumulativeSetCounts(drillSets).at(-1) ?? 0

export type ProductionPlaybackPoint = {
  startSetIndex: number
  destinationSetIndex: number
  localCount: number
  transitionCounts: number
  overallCount: number
}

export const getProductionPlaybackPoint = (
  drillSets: readonly DrillSet[],
  overallCount: number,
): ProductionPlaybackPoint | undefined => {
  if (drillSets.length < 2) {
    return undefined
  }

  const cumulativeCounts = getCumulativeSetCounts(drillSets)
  const clampedCount = Math.min(
    cumulativeCounts[cumulativeCounts.length - 1],
    Math.max(0, overallCount),
  )
  const destinationSetIndex = cumulativeCounts.findIndex((count, index) => index > 0 && clampedCount <= count)
  const resolvedDestinationIndex = destinationSetIndex === -1 ? drillSets.length - 1 : destinationSetIndex

  return {
    startSetIndex: resolvedDestinationIndex - 1,
    destinationSetIndex: resolvedDestinationIndex,
    localCount: clampedCount - cumulativeCounts[resolvedDestinationIndex - 1],
    transitionCounts: drillSets[resolvedDestinationIndex].counts,
    overallCount: clampedCount,
  }
}

export const getProductionPerformerPositions = (
  drillSets: readonly DrillSet[],
  overallCount: number,
): PerformerPosition[] => {
  const point = getProductionPlaybackPoint(drillSets, overallCount)

  if (!point) {
    return drillSets[0]?.performerPositions.map((position) => ({ ...position })) ?? []
  }

  return interpolatePerformerPositions(
    drillSets[point.startSetIndex].performerPositions,
    drillSets[point.destinationSetIndex].performerPositions,
    point.localCount,
    point.transitionCounts,
  )
}