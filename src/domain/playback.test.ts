import type { DrillSet, PerformerPosition } from './drillSets'
import {
  getCumulativeSetCounts,
  getMillisecondsPerCount,
  getProductionPerformerPositions,
  getProductionPlaybackPoint,
  getTotalProductionCounts,
  interpolatePerformerPositions,
} from './playback'

describe('playback', () => {
  const start: PerformerPosition[] = [
    { performerId: 'p1', x: 100, y: 200, verticalReferenceId: 'backHash' },
  ]
  const destination: PerformerPosition[] = [
    { performerId: 'p1', x: 300, y: 400, verticalReferenceId: 'frontHash' },
  ]

  it('interpolates exact start, halfway, and destination positions', () => {
    expect(interpolatePerformerPositions(start, destination, 0, 16)[0]).toMatchObject({ x: 100, y: 200 })
    expect(interpolatePerformerPositions(start, destination, 8, 16)[0]).toMatchObject({ x: 200, y: 300 })
    expect(interpolatePerformerPositions(start, destination, 16, 16)[0]).toMatchObject({
      x: 300,
      y: 400,
      verticalReferenceId: 'frontHash',
    })
  })

  it('uses the transition count length as the interpolation duration', () => {
    expect(interpolatePerformerPositions(start, destination, 6, 24)[0]).toMatchObject({ x: 150, y: 250 })
  })

  it('keeps performers missing from either adjacent set static at their available position', () => {
    const entering = { performerId: 'p2', x: 500, y: 100, verticalReferenceId: 'backSideline' } as const
    const positions = interpolatePerformerPositions(start, [...destination, entering], 8, 16)

    expect(positions.find(({ performerId }) => performerId === 'p2')).toEqual(entering)
    expect(interpolatePerformerPositions(start, [], 8, 16)[0]).toEqual(start[0])
  })

  it('calculates count timing from BPM', () => {
    expect(getMillisecondsPerCount(120)).toBe(500)
    expect(getMillisecondsPerCount(60)).toBe(1000)
    expect(getMillisecondsPerCount(240)).toBe(250)
  })

  describe('full production sequencing', () => {
    const makeSet = (index: number, counts: number, x: number): DrillSet => ({
      id: `set-${index}`,
      name: `Set ${index}`,
      counts,
      performerPositions: [{ performerId: 'p1', x, y: 200, verticalReferenceId: 'backHash' }],
    })
    const drillSets = [
      makeSet(1, 0, 100),
      makeSet(2, 16, 200),
      makeSet(3, 8, 300),
      makeSet(4, 24, 500),
    ]

    it('calculates cumulative set boundaries and total production counts', () => {
      expect(getCumulativeSetCounts(drillSets)).toEqual([0, 16, 24, 48])
      expect(getTotalProductionCounts(drillSets)).toBe(48)
    })

    it('advances continuously through transitions with varying count lengths', () => {
      expect(getProductionPlaybackPoint(drillSets, 0)).toMatchObject({ destinationSetIndex: 1, localCount: 0, transitionCounts: 16 })
      expect(getProductionPlaybackPoint(drillSets, 16)).toMatchObject({ destinationSetIndex: 1, localCount: 16 })
      const laterTransition = getProductionPlaybackPoint(drillSets, 16.1)
      expect(laterTransition).toMatchObject({ destinationSetIndex: 2, transitionCounts: 8 })
      expect(laterTransition?.localCount).toBeCloseTo(0.1)
      expect(getProductionPlaybackPoint(drillSets, 24)).toMatchObject({ destinationSetIndex: 2, localCount: 8 })
      expect(getProductionPlaybackPoint(drillSets, 48)).toMatchObject({ destinationSetIndex: 3, localCount: 24 })
    })

    it('returns exact formations at every boundary and interpolates later transitions', () => {
      expect(getProductionPerformerPositions(drillSets, 0)[0].x).toBe(100)
      expect(getProductionPerformerPositions(drillSets, 16)[0].x).toBe(200)
      expect(getProductionPerformerPositions(drillSets, 20)[0].x).toBe(250)
      expect(getProductionPerformerPositions(drillSets, 24)[0].x).toBe(300)
      expect(getProductionPerformerPositions(drillSets, 36)[0].x).toBe(400)
      expect(getProductionPerformerPositions(drillSets, 48)[0].x).toBe(500)
    })

    it('does not mutate stored formations while generating playback positions', () => {
      const snapshot = structuredClone(drillSets)

      getProductionPerformerPositions(drillSets, 36)
      expect(drillSets).toEqual(snapshot)
    })
  })
})