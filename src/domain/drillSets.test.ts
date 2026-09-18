import { fieldGeometry } from './fieldGeometry'
import { createNextDrillSet, getPerformerMetadata, getPerformerPosition, getPerformersForSet, type DrillSet } from './drillSets'
import { performers } from './performers'

describe('drill sets', () => {
  const initialSet: DrillSet = {
    id: 'set-1',
    name: 'Set 1',
    counts: 0,
    performerPositions: performers.map(getPerformerPosition),
  }

  it('stores performer coordinates separately from shared metadata', () => {
    const metadata = performers.map(getPerformerMetadata)
    const [position] = initialSet.performerPositions

    expect(position).toEqual({
      performerId: 't1',
      x: 600,
      y: fieldGeometry.marchingStepSizeSvg * 42,
      verticalReferenceId: 'backSideline',
    })
    expect(position).not.toHaveProperty('label')
    expect(getPerformersForSet(metadata, initialSet)).toEqual(performers)
  })

  it('copies a formation into an independent sequential set', () => {
    const nextSet = createNextDrillSet([initialSet], initialSet)

    expect(nextSet).toMatchObject({ id: 'set-2', name: 'Set 2', counts: 16 })
    expect(nextSet.performerPositions).toEqual(initialSet.performerPositions)
    expect(nextSet.performerPositions).not.toBe(initialSet.performerPositions)

    nextSet.performerPositions[0].x = 700
    expect(initialSet.performerPositions[0].x).toBe(600)
  })
})