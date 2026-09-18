import { fieldGeometry, type VerticalReferenceId } from './fieldGeometry'

export type Performer = {
  id: string
  label: string
  x: number
  y: number
  verticalReferenceId: VerticalReferenceId
}

export const performerMarkerRadiusSvg = 12

export const performers: readonly Performer[] = [
  {
    id: 't1',
    label: 'T1',
    x: 600,
    y: fieldGeometry.marchingStepSizeSvg * 42,
    verticalReferenceId: 'backSideline',
  },
]