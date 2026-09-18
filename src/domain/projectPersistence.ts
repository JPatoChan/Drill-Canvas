import { fieldGeometry } from './fieldGeometry'
import type { DrillSet, PerformerMetadata, PerformerPosition } from './drillSets'
import type { EditorSnapshot } from './editorHistory'

export const projectSchemaVersion = 1 as const
export const projectStorageKey = 'drillcanvas.project.v1'

export type DrillCanvasProject = {
  schemaVersion: typeof projectSchemaVersion
  productionName: string
  performers: PerformerMetadata[]
  drillSets: DrillSet[]
  activeSetId: string
}

const verticalReferenceIds = new Set<string>([
  'backSideline',
  'backHash',
  'frontHash',
  'frontSideline',
])

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isOptionalString = (value: unknown) => value === undefined || typeof value === 'string'

const isPerformerMetadata = (value: unknown): value is PerformerMetadata => isRecord(value)
  && typeof value.id === 'string'
  && value.id.length > 0
  && typeof value.label === 'string'
  && isOptionalString(value.name)
  && isOptionalString(value.section)

const isPerformerPosition = (value: unknown, performerIds: Set<string>): value is PerformerPosition => isRecord(value)
  && typeof value.performerId === 'string'
  && performerIds.has(value.performerId)
  && typeof value.x === 'number'
  && Number.isFinite(value.x)
  && value.x >= 0
  && value.x <= fieldGeometry.svgWidth
  && typeof value.y === 'number'
  && Number.isFinite(value.y)
  && value.y >= 0
  && value.y <= fieldGeometry.svgHeight
  && typeof value.verticalReferenceId === 'string'
  && verticalReferenceIds.has(value.verticalReferenceId)

const isDrillSet = (value: unknown, index: number, performerIds: Set<string>): value is DrillSet => {
  if (!isRecord(value)
    || typeof value.id !== 'string'
    || value.id.length === 0
    || typeof value.name !== 'string'
    || !Number.isInteger(value.counts)
    || (index === 0 ? value.counts !== 0 : (value.counts as number) < 1)
    || !Array.isArray(value.performerPositions)
    || !value.performerPositions.every((position) => isPerformerPosition(position, performerIds))) {
    return false
  }

  const positionIds = value.performerPositions.map((position) => position.performerId)
  return new Set(positionIds).size === positionIds.length
}

export const projectFromSnapshot = (snapshot: EditorSnapshot): DrillCanvasProject => ({
  schemaVersion: projectSchemaVersion,
  productionName: snapshot.productionName,
  performers: snapshot.performerMetadata,
  drillSets: snapshot.drillSets,
  activeSetId: snapshot.activeSetId,
})

export const snapshotFromProject = (project: DrillCanvasProject): EditorSnapshot => ({
  productionName: project.productionName,
  performerMetadata: project.performers,
  drillSets: project.drillSets,
  activeSetId: project.activeSetId,
})

export const serializeProject = (snapshot: EditorSnapshot) =>
  JSON.stringify(projectFromSnapshot(snapshot), null, 2)

export const parseProject = (projectText: string): EditorSnapshot => {
  let value: unknown

  try {
    value = JSON.parse(projectText)
  } catch {
    throw new Error('The selected file is not valid JSON.')
  }

  if (!isRecord(value)) {
    throw new Error('The selected file is not a DrillCanvas project.')
  }

  if (value.schemaVersion !== projectSchemaVersion) {
    throw new Error(`Unsupported project schema version: ${String(value.schemaVersion)}.`)
  }

  if (typeof value.productionName !== 'string'
    || !Array.isArray(value.performers)
    || !value.performers.every(isPerformerMetadata)) {
    throw new Error('The project contains invalid production or performer data.')
  }

  const performerIds = new Set(value.performers.map((performer) => performer.id))
  if (performerIds.size !== value.performers.length
    || !Array.isArray(value.drillSets)
    || value.drillSets.length === 0
    || !value.drillSets.every((drillSet, index) => isDrillSet(drillSet, index, performerIds))) {
    throw new Error('The project contains invalid drill set data.')
  }

  const setIds = value.drillSets.map((drillSet) => drillSet.id)
  if (new Set(setIds).size !== setIds.length
    || typeof value.activeSetId !== 'string'
    || !setIds.includes(value.activeSetId)) {
    throw new Error('The project contains invalid set identifiers.')
  }

  return snapshotFromProject(value as DrillCanvasProject)
}

export const saveProjectLocally = (snapshot: EditorSnapshot) => {
  localStorage.setItem(projectStorageKey, serializeProject(snapshot))
}

export const restoreLocalProject = (): EditorSnapshot | undefined => {
  const projectText = localStorage.getItem(projectStorageKey)
  return projectText ? parseProject(projectText) : undefined
}