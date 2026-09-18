import { useEffect, useReducer, useRef, useState, type ChangeEvent, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent } from 'react'
import './App.css'
import {
  fieldGeometry,
  formatHorizontalCoordinate,
  formatVerticalCoordinate,
  getSnappedPerformerPlacement,
  getFiveYardLinePositions,
  getYardLinePositions,
  getYardNumberPositions,
} from './domain/fieldGeometry'
import {
  createPerformer,
  moveSelectedPerformers,
  performerMarkerRadiusSvg,
  performers,
  type Performer,
} from './domain/performers'
import {
  createNextDrillSet,
  getPerformerMetadata,
  getPerformerPosition,
  getPerformersForSet,
  type DrillSet,
} from './domain/drillSets'
import {
  getProductionPerformerPositions,
  getProductionPlaybackPoint,
  getTotalProductionCounts,
  interpolatePerformerPositions,
} from './domain/playback'
import { applyFormationOperation, duplicateSelectedPerformers, type FormationOperation } from './domain/formations'
import { createEditorHistory, reduceEditorHistory, type EditorSnapshot } from './domain/editorHistory'
import {
  parseProject,
  restoreLocalProject,
  saveProjectLocally,
  serializeProject,
} from './domain/projectPersistence'
import {
  getActiveTempoBpm,
  getCountForElapsedMilliseconds,
  getMeasurePositionForBeat,
  getMillisecondsPerBeatAt,
  parseMuseScoreFile,
} from './domain/music'
import { MusicSynthesizer } from './domain/musicSynth'

const toolbarItems = ['Select', 'Performer', 'Path', 'Measure']
const fiveYardLinePositions = getFiveYardLinePositions()
const yardLinePositions = getYardLinePositions()
const yardNumbers = getYardNumberPositions()
const minimumZoom = 0.5
const maximumZoom = 3
const zoomStep = 0.25
const initialDrillSet: DrillSet = {
  id: 'set-1',
  name: 'Set 1',
  counts: 0,
  performerPositions: performers.map(getPerformerPosition),
}

const createFreshProject = (): EditorSnapshot => ({
  productionName: 'Untitled Production',
  performerMetadata: performers.map(getPerformerMetadata),
  drillSets: [{
    ...initialDrillSet,
    performerPositions: initialDrillSet.performerPositions.map((position) => ({ ...position })),
  }],
  activeSetId: initialDrillSet.id,
  music: null,
})

type PlaybackMode = 'transition' | 'production' | null

type FieldCanvasProps = {
  mode: 'select' | 'performer'
  editingDisabled: boolean
  performerPositions: readonly Performer[]
  selectedPerformerIds: readonly string[]
  onPerformerPositionsChange: (performers: Performer[], shouldCommit?: boolean) => void
  onPerformerDragStart: () => void
  onPerformerDragEnd: (moved: boolean) => void
  onPerformerSelect: (performerId: string, shouldToggle: boolean) => void
  onBoxSelect: (performerIds: string[], shouldToggle: boolean) => void
  onSelectionClear: () => void
}

function FieldCanvas({
  mode,
  editingDisabled,
  performerPositions,
  selectedPerformerIds,
  onPerformerPositionsChange,
  onPerformerDragStart,
  onPerformerDragEnd,
  onPerformerSelect,
  onBoxSelect,
  onSelectionClear,
}: FieldCanvasProps) {
  const [zoom, setZoom] = useState(1)
  const [marquee, setMarquee] = useState<{
    startX: number
    startY: number
    currentX: number
    currentY: number
    pointerId: number
    shouldToggle: boolean
    moved: boolean
  } | null>(null)
  const dragState = useRef<{
    performerId: string
    moved: boolean
    collapseSelectionOnRelease: boolean
  } | null>(null)

  const updatePerformerPosition = (event: PointerEvent<SVGGElement>, performerId: string) => {
    const svg = event.currentTarget.ownerSVGElement

    if (!svg) {
      return
    }

    const bounds = svg.getBoundingClientRect()
    const rawPosition = {
      x: ((event.clientX - bounds.left) / bounds.width) * fieldGeometry.svgWidth,
      y: ((event.clientY - bounds.top) / bounds.height) * fieldGeometry.svgHeight,
    }

    onPerformerPositionsChange(moveSelectedPerformers(
      performerPositions,
      selectedPerformerIds,
      performerId,
      rawPosition,
    ), false)
  }

  const getSvgPoint = (event: Pick<PointerEvent<SVGSVGElement>, 'clientX' | 'clientY' | 'currentTarget'>) => {
    const bounds = event.currentTarget.getBoundingClientRect()

    return {
      x: ((event.clientX - bounds.left) / bounds.width) * fieldGeometry.svgWidth,
      y: ((event.clientY - bounds.top) / bounds.height) * fieldGeometry.svgHeight,
    }
  }

  const handlePerformerPointerDown = (event: PointerEvent<SVGGElement>, performer: Performer) => {
    event.stopPropagation()

    if (editingDisabled) {
      return
    }

    const isSelected = selectedPerformerIds.includes(performer.id)

    if (event.shiftKey) {
      onPerformerSelect(performer.id, true)
    } else if (!isSelected) {
      onPerformerSelect(performer.id, false)
    }

    dragState.current = {
      performerId: performer.id,
      moved: false,
      collapseSelectionOnRelease: !event.shiftKey && isSelected && selectedPerformerIds.length > 1,
    }
    onPerformerDragStart()
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePerformerPointerUp = (event: PointerEvent<SVGGElement>) => {
    const moved = dragState.current?.moved ?? false
    if (dragState.current?.collapseSelectionOnRelease && !dragState.current.moved) {
      onPerformerSelect(dragState.current.performerId, false)
    }

    dragState.current = null
    onPerformerDragEnd(moved)
    event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const handleFieldPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (editingDisabled) {
      return
    }

    if (mode === 'select') {
      const point = getSvgPoint(event)
      if (!event.shiftKey) {
        onSelectionClear()
      }
      setMarquee({
        startX: point.x,
        startY: point.y,
        currentX: point.x,
        currentY: point.y,
        pointerId: event.pointerId,
        shouldToggle: event.shiftKey,
        moved: false,
      })
      event.currentTarget.setPointerCapture?.(event.pointerId)
      return
    }

    if (mode !== 'performer') {
      return
    }

    const bounds = event.currentTarget.getBoundingClientRect()
    const placement = getSnappedPerformerPlacement({
      x: ((event.clientX - bounds.left) / bounds.width) * fieldGeometry.svgWidth,
      y: ((event.clientY - bounds.top) / bounds.height) * fieldGeometry.svgHeight,
    }, performerMarkerRadiusSvg)
    const performer = createPerformer(placement, performerPositions)

    onPerformerPositionsChange([...performerPositions, performer])
    onPerformerSelect(performer.id, false)
  }

  const handleFieldPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (!marquee || marquee.pointerId !== event.pointerId) {
      return
    }

    const point = getSvgPoint(event)
    setMarquee((current) => current ? {
      ...current,
      currentX: point.x,
      currentY: point.y,
      moved: current.moved || Math.hypot(point.x - current.startX, point.y - current.startY) >= 4,
    } : null)
  }

  const finishBoxSelection = (event: PointerEvent<SVGSVGElement>) => {
    if (!marquee || marquee.pointerId !== event.pointerId) {
      return
    }

    if (!marquee.moved) {
      onSelectionClear()
    } else {
      const minimumX = Math.min(marquee.startX, marquee.currentX)
      const maximumX = Math.max(marquee.startX, marquee.currentX)
      const minimumY = Math.min(marquee.startY, marquee.currentY)
      const maximumY = Math.max(marquee.startY, marquee.currentY)
      onBoxSelect(
        performerPositions
          .filter(({ x, y }) => x >= minimumX && x <= maximumX && y >= minimumY && y <= maximumY)
          .map(({ id }) => id),
        marquee.shouldToggle,
      )
    }

    setMarquee(null)
    event.currentTarget.releasePointerCapture?.(event.pointerId)
  }

  const updateZoom = (change: number) => {
    setZoom((currentZoom) => Math.min(maximumZoom, Math.max(minimumZoom, currentZoom + change)))
  }

  return (
    <section className="field-canvas" aria-label="Marching field canvas">
      <div className="field-canvas__header">
        <span>Field view</span>
        <div className="zoom-controls" aria-label="Field zoom controls">
          <button type="button" onClick={() => updateZoom(-zoomStep)} disabled={zoom === minimumZoom} aria-label="Zoom out" title="Zoom out">−</button>
          <output aria-label="Current zoom">{Math.round(zoom * 100)}%</output>
          <button type="button" onClick={() => updateZoom(zoomStep)} disabled={zoom === maximumZoom} aria-label="Zoom in" title="Zoom in">+</button>
          <button type="button" onClick={() => setZoom(1)}>Reset/Fit</button>
        </div>
        <span className="field-canvas__status">120 × 53⅓ yd</span>
      </div>
      <div className="field-canvas__viewport" data-testid="field-viewport">
        <div className="field-canvas__fit">
          <svg
            className="field-canvas__svg"
            style={{ width: `${zoom * 100}%` }}
            viewBox={`0 0 ${fieldGeometry.svgWidth} ${fieldGeometry.svgHeight}`}
            role="img"
            aria-label="Marching football field"
            data-testid="field-svg"
            data-zoom={zoom}
            data-playback-active={editingDisabled}
            onPointerDown={handleFieldPointerDown}
            onPointerMove={handleFieldPointerMove}
            onPointerUp={finishBoxSelection}
            onPointerCancel={() => setMarquee(null)}
          >
        <title>120-yard marching band football field</title>
        <rect className="field" width={fieldGeometry.svgWidth} height={fieldGeometry.svgHeight} />
        <rect className="field-end-zone" x="0" width={fieldGeometry.endZoneDepthSvg} height={fieldGeometry.svgHeight} />
        <rect className="field-end-zone" x={fieldGeometry.secondGoalLineSvg} width={fieldGeometry.endZoneDepthSvg} height={fieldGeometry.svgHeight} />
        <rect
          className="field-boundary"
          x={fieldGeometry.fieldBoundaryInset}
          y={fieldGeometry.fieldBoundaryInset}
          width={fieldGeometry.svgWidth - fieldGeometry.fieldBoundaryInset * 2}
          height={fieldGeometry.svgHeight - fieldGeometry.fieldBoundaryInset * 2}
        />
        {fiveYardLinePositions.map((position) => (
          <line
            key={`yard-${position}`}
            className={position === fieldGeometry.svgWidth / 2 ? 'midfield-line' : 'yard-line'}
            x1={position}
            x2={position}
            y1={fieldGeometry.fieldBoundaryInset * 2}
            y2={fieldGeometry.svgHeight - fieldGeometry.fieldBoundaryInset * 2}
          />
        ))}
        {yardLinePositions.map((position) => (
          <g key={`hash-${position}`}>
            {fieldGeometry.highSchoolHashPositionsSvg.map((hashPosition) => (
              <line
                key={hashPosition}
                className="hash-mark"
                x1={position - fieldGeometry.hashMarkHalfLength}
                x2={position + fieldGeometry.hashMarkHalfLength}
                y1={hashPosition}
                y2={hashPosition}
              />
            ))}
          </g>
        ))}
        {yardNumbers.map(({ value, x }, index) => (
          <g key={`number-${index}`} className="yard-number">
            <text x={x} y={fieldGeometry.yardNumberPositionsSvg.top} textAnchor="middle">{value}</text>
            <text x={x} y={fieldGeometry.yardNumberPositionsSvg.bottom} textAnchor="middle" transform={`rotate(180 ${x} ${fieldGeometry.yardNumberPositionsSvg.bottom})`}>{value}</text>
          </g>
        ))}
        {marquee?.moved && (
          <rect
            className="selection-marquee"
            data-testid="selection-marquee"
            x={Math.min(marquee.startX, marquee.currentX)}
            y={Math.min(marquee.startY, marquee.currentY)}
            width={Math.abs(marquee.currentX - marquee.startX)}
            height={Math.abs(marquee.currentY - marquee.startY)}
          />
        )}
        {performerPositions.map((performer) => (
          <g
            key={performer.id}
            className={`performer-marker${selectedPerformerIds.includes(performer.id) ? ' performer-marker--selected' : ''}`}
            aria-label={`Performer ${performer.label}`}
            data-testid={`performer-${performer.id}`}
            onPointerDown={(event) => handlePerformerPointerDown(event, performer)}
            onPointerMove={(event) => {
              if (!editingDisabled && event.currentTarget.hasPointerCapture(event.pointerId)) {
                if (dragState.current) {
                  dragState.current.moved = true
                }
                updatePerformerPosition(event, performer.id)
              }
            }}
            onPointerUp={handlePerformerPointerUp}
            onPointerCancel={() => {
              onPerformerDragEnd(dragState.current?.moved ?? false)
              dragState.current = null
            }}
          >
            <circle cx={performer.x} cy={performer.y} r={performerMarkerRadiusSvg} />
            <text x={performer.x + 9} y={performer.y} dominantBaseline="central">{performer.label}</text>
          </g>
        ))}
          </svg>
        </div>
      </div>
    </section>
  )
}

type PerformerInventoryProps = {
  editingDisabled: boolean
  performerPositions: readonly Performer[]
  selectedPerformerIds: readonly string[]
  onPerformerSelect: (performerId: string, shouldToggle: boolean) => void
  onPerformerChange: (performerId: string, changes: Pick<Performer, 'label' | 'name' | 'section'>) => void
}

function PerformerInventory({
  editingDisabled,
  performerPositions,
  selectedPerformerIds,
  onPerformerSelect,
  onPerformerChange,
}: PerformerInventoryProps) {
  const selectFromKeyboard = (event: ReactKeyboardEvent, performerId: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onPerformerSelect(performerId, event.shiftKey)
    }
  }

  return (
    <aside className="performer-inventory" aria-label="Performer inventory">
      <div className="performer-inventory__header">
        <h2>Performers</h2>
        <span>{performerPositions.length}</span>
      </div>
      <div className="performer-inventory__list">
        {performerPositions.map((performer) => (
          <div
            className={`inventory-row${selectedPerformerIds.includes(performer.id) ? ' inventory-row--selected' : ''}`}
            key={performer.id}
            data-testid={`inventory-${performer.id}`}
            role="button"
            tabIndex={0}
            aria-pressed={selectedPerformerIds.includes(performer.id)}
            onClick={(event) => onPerformerSelect(performer.id, event.shiftKey)}
            onKeyDown={(event) => selectFromKeyboard(event, performer.id)}
          >
            <label>
              <span>Label</span>
              <input
                className="inventory-row__label"
                aria-label={`Label for ${performer.label}`}
                disabled={editingDisabled}
                value={performer.label}
                onChange={(event) => onPerformerChange(performer.id, {
                  label: event.target.value,
                  name: performer.name,
                  section: performer.section,
                })}
              />
            </label>
            <label>
              <span>Name</span>
              <input
                aria-label={`Name for ${performer.label}`}
                disabled={editingDisabled}
                value={performer.name ?? ''}
                placeholder="Name"
                onChange={(event) => onPerformerChange(performer.id, {
                  label: performer.label,
                  name: event.target.value,
                  section: performer.section,
                })}
              />
            </label>
            <label>
              <span>Section</span>
              <input
                aria-label={`Section for ${performer.label}`}
                disabled={editingDisabled}
                value={performer.section ?? ''}
                placeholder="Section"
                onChange={(event) => onPerformerChange(performer.id, {
                  label: performer.label,
                  name: performer.name,
                  section: event.target.value,
                })}
              />
            </label>
          </div>
        ))}
      </div>
    </aside>
  )
}

function App() {
  const [initialProject] = useState(() => {
    try {
      return { snapshot: restoreLocalProject() ?? createFreshProject(), error: '' }
    } catch (error) {
      return {
        snapshot: createFreshProject(),
        error: error instanceof Error ? `Unable to restore the saved project: ${error.message}` : 'Unable to restore the saved project.',
      }
    }
  })
  const [history, dispatchHistory] = useReducer(
    reduceEditorHistory,
    initialProject.snapshot,
    createEditorHistory,
  )
  const dragStartSnapshot = useRef<EditorSnapshot | null>(null)
  const setTrackScroller = useRef<HTMLDivElement>(null)
  const importInput = useRef<HTMLInputElement>(null)
  const importMusicInput = useRef<HTMLInputElement>(null)
  const musicSynth = useRef<MusicSynthesizer>(new MusicSynthesizer())
  const [explicitlySavedProject, setExplicitlySavedProject] = useState(
    serializeProject(initialProject.snapshot),
  )
  const [projectError, setProjectError] = useState(initialProject.error)
  const [musicError, setMusicError] = useState('')
  const { productionName, performerMetadata, drillSets, activeSetId, music } = history.present
  const serializedProject = serializeProject(history.present)
  const hasUnsavedChanges = serializedProject !== explicitlySavedProject
  const [selectedPerformerIds, setSelectedPerformerIds] = useState<string[]>([])
  const [mode, setMode] = useState<'select' | 'performer'>('select')
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentCount, setCurrentCount] = useState(0)
  const [productionCount, setProductionCount] = useState(0)
  const [tempo, setTempo] = useState(120)
  const activeSet = drillSets.find(({ id }) => id === activeSetId) ?? drillSets[0]
  const activeSetIndex = drillSets.findIndex(({ id }) => id === activeSet.id)
  const transitionStartSet = activeSetIndex > 0 ? drillSets[activeSetIndex - 1] : undefined
  const performerPositions = getPerformersForSet(performerMetadata, activeSet)
  const totalProductionCounts = getTotalProductionCounts(drillSets)
  const productionPlaybackPoint = getProductionPlaybackPoint(drillSets, productionCount)
  const isPreviewing = playbackMode !== null
  const playbackSetIndex = playbackMode === 'production' && productionPlaybackPoint
    ? productionPlaybackPoint.localCount === 0
      ? productionPlaybackPoint.startSetIndex
      : productionPlaybackPoint.destinationSetIndex
    : activeSetIndex
  const playbackPositions = playbackMode === 'production'
    ? getPerformersForSet(performerMetadata, {
        ...activeSet,
        performerPositions: getProductionPerformerPositions(drillSets, productionCount),
      })
    : playbackMode === 'transition' && transitionStartSet
      ? getPerformersForSet(performerMetadata, {
        ...activeSet,
        performerPositions: interpolatePerformerPositions(
          transitionStartSet.performerPositions,
          activeSet.performerPositions,
          currentCount,
          activeSet.counts,
        ),
      })
      : performerPositions
  const displayedLocalCount = playbackMode === 'production'
    ? productionPlaybackPoint?.localCount ?? 0
    : currentCount
  const displayedTransitionCounts = playbackMode === 'production'
    ? productionPlaybackPoint?.transitionCounts ?? 0
    : activeSet.counts
  const selectedPerformer = selectedPerformerIds.length === 1
    ? performerPositions.find((performer) => performer.id === selectedPerformerIds[0])
    : undefined

  useEffect(() => {
    try {
      saveProjectLocally(history.present)
    } catch {
      setProjectError('Unable to save the project in local browser storage.')
    }
  }, [history.present])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target
      const isEditableTarget = target instanceof Element && (
        target.matches('input, textarea, select') || target.closest('[contenteditable="true"]') !== null
      )

      if (
        (event.key !== 'Backspace' && event.key !== 'Delete')
        || selectedPerformerIds.length === 0
        || isPreviewing
        || isEditableTarget
      ) {
        return
      }

      dispatchHistory({
        type: 'commit',
        snapshot: {
          ...history.present,
          performerMetadata: performerMetadata.filter(
            (performer) => !selectedPerformerIds.includes(performer.id),
          ),
          drillSets: drillSets.map((drillSet) => ({
            ...drillSet,
            performerPositions: drillSet.performerPositions.filter(
              ({ performerId }) => !selectedPerformerIds.includes(performerId),
            ),
          })),
        },
      })
      setSelectedPerformerIds([])
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [drillSets, history.present, isPreviewing, performerMetadata, selectedPerformerIds])

  useEffect(() => {
    const handleHistoryShortcut = (event: KeyboardEvent) => {
      const target = event.target
      const isEditableTarget = target instanceof Element && (
        target.matches('input, textarea, select') || target.closest('[contenteditable="true"]') !== null
      )
      const isUndo = (event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 'z'
      const isRedo = (event.ctrlKey || event.metaKey) && (
        (event.shiftKey && event.key.toLowerCase() === 'z') || event.key.toLowerCase() === 'y'
      )

      if (isEditableTarget || isPreviewing || (!isUndo && !isRedo)) {
        return
      }

      event.preventDefault()
      dispatchHistory({ type: isUndo ? 'undo' : 'redo' })
      setSelectedPerformerIds([])
    }

    window.addEventListener('keydown', handleHistoryShortcut)
    return () => window.removeEventListener('keydown', handleHistoryShortcut)
  }, [isPreviewing])

  useEffect(() => {
    if (!isPlaying || !playbackMode) {
      return
    }

    // Production playback is the authoritative clock for both drill animation and music: elapsed
    // real time is derived once per frame and used to drive both, so they cannot drift apart.
    const startedAt = performance.now()
    const startingCount = playbackMode === 'production' ? productionCount : currentCount
    const finalCount = playbackMode === 'production' ? totalProductionCounts : activeSet.counts
    const activeMusic = playbackMode === 'production' ? music : null
    let animationFrame = 0

    const updatePlayback = (timestamp: number) => {
      const elapsedMilliseconds = timestamp - startedAt
      const nextCount = Math.min(
        finalCount,
        getCountForElapsedMilliseconds(activeMusic, tempo, startingCount, elapsedMilliseconds),
      )

      if (playbackMode === 'production') {
        setProductionCount(nextCount)
        musicSynth.current.sync(activeMusic, nextCount, getMillisecondsPerBeatAt(
          activeMusic?.tempoMap ?? [{ beat: 0, bpm: tempo }],
          nextCount,
        ))
      } else {
        setCurrentCount(nextCount)
      }
      if (nextCount >= finalCount) {
        setIsPlaying(false)
        return
      }

      animationFrame = requestAnimationFrame(updatePlayback)
    }

    animationFrame = requestAnimationFrame(updatePlayback)
    return () => cancelAnimationFrame(animationFrame)
  }, [activeSet.counts, activeSet.id, isPlaying, music, playbackMode, tempo, totalProductionCounts])

  useEffect(() => {
    if (playbackMode !== 'production') {
      setCurrentCount((count) => Math.min(count, activeSet.counts))
    }
  }, [activeSet.counts, activeSet.id, playbackMode])

  useEffect(() => {
    const activeCard = setTrackScroller.current?.querySelector<HTMLElement>(
      `[data-set-id="${activeSetId}"]`,
    )

    activeCard?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  }, [activeSetId, drillSets.length])

  const selectPerformer = (performerId: string, shouldToggle: boolean) => {
    setSelectedPerformerIds((currentIds) => {
      if (!shouldToggle) {
        return [performerId]
      }

      return currentIds.includes(performerId)
        ? currentIds.filter((id) => id !== performerId)
        : [...currentIds, performerId]
    })
  }

  const selectPerformersInBox = (performerIds: string[], shouldToggle: boolean) => {
    setSelectedPerformerIds((currentIds) => {
      if (!shouldToggle) {
        return performerIds
      }

      return performerIds.reduce((nextIds, performerId) => nextIds.includes(performerId)
        ? nextIds.filter((id) => id !== performerId)
        : [...nextIds, performerId], [...currentIds])
    })
  }

  const updatePerformerMetadata = (
    performerId: string,
    changes: Pick<Performer, 'label' | 'name' | 'section'>,
  ) => {
    dispatchHistory({
      type: 'commit',
      snapshot: {
        ...history.present,
        performerMetadata: performerMetadata.map((performer) =>
          performer.id === performerId ? { ...performer, ...changes } : performer,
        ),
      },
    })
  }

  const updateActivePerformerPositions = (nextPerformers: Performer[], shouldCommit = true) => {
    const existingIds = new Set(drillSets.flatMap((drillSet) =>
      drillSet.performerPositions.map(({ performerId }) => performerId),
    ))
    const newPerformers = nextPerformers.filter(({ id }) => !existingIds.has(id))
    const metadataIds = new Set(performerMetadata.map(({ id }) => id))
    const additions = nextPerformers.filter(({ id }) => !metadataIds.has(id)).map(getPerformerMetadata)

    dispatchHistory({
      type: shouldCommit ? 'commit' : 'replace',
      snapshot: {
        ...history.present,
        performerMetadata: additions.length > 0 ? [...performerMetadata, ...additions] : performerMetadata,
        // A new production performer starts at the creation position in every existing set.
        drillSets: drillSets.map((drillSet) => ({
          ...drillSet,
          performerPositions: drillSet.id === activeSetId
            ? nextPerformers.map(getPerformerPosition)
            : [...drillSet.performerPositions, ...newPerformers.map(getPerformerPosition)],
        })),
      },
    })
  }

  const addDrillSet = () => {
    const newSet = createNextDrillSet(drillSets, activeSet)

    dispatchHistory({
      type: 'commit',
      snapshot: { ...history.present, drillSets: [...drillSets, newSet], activeSetId: newSet.id },
    })
    setSelectedPerformerIds([])
    setIsPlaying(false)
    setPlaybackMode(null)
    setCurrentCount(newSet.counts)
  }

  const activateDrillSet = (drillSetId: string) => {
    const nextSet = drillSets.find(({ id }) => id === drillSetId)

    dispatchHistory({ type: 'replace', snapshot: { ...history.present, activeSetId: drillSetId } })
    setSelectedPerformerIds([])
    setIsPlaying(false)
    setPlaybackMode(null)
    setCurrentCount(nextSet?.counts ?? 0)
  }

  const updateDrillSetCounts = (drillSetId: string, counts: number) => {
    if (!Number.isFinite(counts)) {
      return
    }

    const nextCounts = Math.max(1, Math.floor(counts))

    dispatchHistory({
      type: 'commit',
      snapshot: {
        ...history.present,
        drillSets: drillSets.map((drillSet, index) => drillSet.id === drillSetId && index > 0
          ? { ...drillSet, counts: nextCounts }
          : drillSet),
      },
    })
    if (drillSetId === activeSetId) {
      setCurrentCount((count) => count >= activeSet.counts ? nextCounts : Math.min(count, nextCounts))
    }
  }

  const playTransition = () => {
    if (!transitionStartSet) {
      return
    }

    setSelectedPerformerIds([])
    setCurrentCount((count) => count >= activeSet.counts ? 0 : count)
    setPlaybackMode('transition')
    setIsPlaying(true)
  }

  const playProduction = () => {
    if (drillSets.length < 2) {
      return
    }

    musicSynth.current.silence()
    musicSynth.current.resumeContext()
    setSelectedPerformerIds([])
    setProductionCount(0)
    setPlaybackMode('production')
    setIsPlaying(true)
  }

  const resumePlayback = () => {
    if (!playbackMode) {
      return
    }

    const playbackCount = playbackMode === 'production' ? productionCount : currentCount
    const finalCount = playbackMode === 'production' ? totalProductionCounts : activeSet.counts

    if (playbackCount < finalCount) {
      musicSynth.current.resumeContext()
      setIsPlaying(true)
    }
  }

  const restartPlayback = () => {
    if (!playbackMode) {
      return
    }

    musicSynth.current.silence()
    setIsPlaying(false)
    if (playbackMode === 'production') {
      setProductionCount(0)
    } else {
      setCurrentCount(0)
    }
  }

  const stopPlayback = () => {
    musicSynth.current.silence()
    setIsPlaying(false)
    setPlaybackMode(null)
    setCurrentCount(activeSet.counts)
  }

  const navigateHistory = (type: 'undo' | 'redo') => {
    if (isPreviewing) {
      return
    }

    dispatchHistory({ type })
    setSelectedPerformerIds([])
  }

  const applyFormation = (operation: FormationOperation) => {
    if (isPreviewing || selectedPerformerIds.length < 2) {
      return
    }

    updateActivePerformerPositions(applyFormationOperation(performerPositions, selectedPerformerIds, operation))
  }

  const duplicateSelection = () => {
    if (isPreviewing || selectedPerformerIds.length === 0) {
      return
    }

    const nextPerformers = duplicateSelectedPerformers(performerPositions, selectedPerformerIds)
    const duplicateIds = nextPerformers.slice(performerPositions.length).map(({ id }) => id)
    updateActivePerformerPositions(nextPerformers)
    setSelectedPerformerIds(duplicateIds)
  }

  const resetTransientState = (snapshot: EditorSnapshot) => {
    musicSynth.current.silence()
    setSelectedPerformerIds([])
    setPlaybackMode(null)
    setIsPlaying(false)
    setCurrentCount(snapshot.drillSets.find(({ id }) => id === snapshot.activeSetId)?.counts ?? 0)
    setProductionCount(0)
  }

  const saveProject = () => {
    try {
      saveProjectLocally(history.present)
      setExplicitlySavedProject(serializedProject)
      setProjectError('')
    } catch {
      setProjectError('Unable to save the project in local browser storage.')
    }
  }

  const newProject = () => {
    if (hasUnsavedChanges && !window.confirm('Create a new project? Unsaved changes will be lost.')) {
      return
    }

    const snapshot = createFreshProject()
    dispatchHistory({ type: 'reset', snapshot })
    setExplicitlySavedProject(serializeProject(snapshot))
    resetTransientState(snapshot)
    setProjectError('')
  }

  const exportProject = () => {
    const blob = new Blob([serializeProject(history.present)], { type: 'application/json' })
    const downloadUrl = URL.createObjectURL(blob)
    const download = document.createElement('a')
    const safeName = productionName.trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()

    download.href = downloadUrl
    download.download = `${safeName || 'drillcanvas-project'}.drillcanvas.json`
    download.click()
    URL.revokeObjectURL(downloadUrl)
  }

  const importProject = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    try {
      const snapshot = parseProject(await file.text())
      dispatchHistory({ type: 'reset', snapshot })
      setExplicitlySavedProject(serializeProject(snapshot))
      resetTransientState(snapshot)
      setProjectError('')
    } catch (error) {
      setProjectError(error instanceof Error ? error.message : 'Unable to import the selected project.')
    } finally {
      event.target.value = ''
    }
  }

  const importMusic = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    try {
      const score = await parseMuseScoreFile(file)
      const titledScore = score.title ? score : { ...score, title: file.name }
      dispatchHistory({ type: 'commit', snapshot: { ...history.present, music: titledScore } })
      setMusicError('')
    } catch (error) {
      setMusicError(error instanceof Error ? error.message : 'Unable to import the selected music file.')
    } finally {
      event.target.value = ''
    }
  }

  const removeMusic = () => {
    if (!music) {
      return
    }

    musicSynth.current.silence()
    dispatchHistory({ type: 'commit', snapshot: { ...history.present, music: null } })
    setMusicError('')
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand" aria-label="DrillCanvas">
          <span className="brand__mark" aria-hidden="true"><i /><i /><i /></span>
          <span>DrillCanvas</span>
        </div>
        <input
          className="show-name"
          aria-label="Production name"
          value={productionName}
          disabled={isPreviewing}
          onChange={(event) => dispatchHistory({
            type: 'commit',
            snapshot: { ...history.present, productionName: event.target.value },
          })}
        />
        <div className="header-actions">
          <button type="button" onClick={() => navigateHistory('undo')} disabled={history.past.length === 0 || isPreviewing}>Undo</button>
          <button type="button" onClick={() => navigateHistory('redo')} disabled={history.future.length === 0 || isPreviewing}>Redo</button>
          <button type="button" onClick={saveProject} disabled={!hasUnsavedChanges || isPreviewing}>Save</button>
          <output
            className={`save-status${hasUnsavedChanges ? ' save-status--dirty' : ''}`}
            aria-label="Save status"
            aria-live="polite"
          >
            {hasUnsavedChanges ? 'Unsaved changes' : 'Saved'}
          </output>
          <button type="button" onClick={newProject} disabled={isPreviewing}>New</button>
          <button type="button" onClick={exportProject} disabled={isPreviewing}>Export</button>
          <button type="button" onClick={() => importInput.current?.click()} disabled={isPreviewing}>Import</button>
          <input
            className="project-import"
            ref={importInput}
            type="file"
            accept="application/json,.json,.drillcanvas.json"
            aria-label="Import project file"
            onChange={importProject}
          />
          <button className="header-action" type="button">Share</button>
        </div>
      </header>

      {projectError && <div className="project-error" role="alert">{projectError}</div>}

      <div className="editor-layout">
        <aside className="toolbar" aria-label="Editor tools">
          <div className="toolbar__heading">Tools</div>
          {toolbarItems.map((item, index) => (
            <button
              className={`tool-button${(item === 'Select' && mode === 'select') || (item === 'Performer' && mode === 'performer') ? ' tool-button--active' : ''}`}
              type="button"
              key={item}
              onClick={() => {
                if (item === 'Select') {
                  setMode('select')
                }
                if (item === 'Performer') {
                  setMode('performer')
                }
              }}
            >
              <span className="tool-button__glyph" aria-hidden="true">{index + 1}</span>
              <span>{item}</span>
            </button>
          ))}
          {selectedPerformer && (
            <section className="selected-performer" aria-label="Selected performer">
              <span className="selected-performer__label">{selectedPerformer.label}</span>
              <span>{formatHorizontalCoordinate(selectedPerformer.x)}</span>
              <span>{formatVerticalCoordinate(selectedPerformer.y, selectedPerformer.verticalReferenceId)}</span>
            </section>
          )}
          {selectedPerformerIds.length > 1 && (
            <div className="selected-performer" aria-label="Selected performers">
              <span className="selected-performer__label">{selectedPerformerIds.length} performers selected</span>
            </div>
          )}
          {selectedPerformerIds.length > 0 && (
            <section className="formation-tools" aria-label="Formation tools">
              <div className="formation-tools__heading">Formation</div>
              <button type="button" disabled={selectedPerformerIds.length < 2 || isPreviewing} onClick={() => applyFormation('alignHorizontal')}>Align horizontal</button>
              <button type="button" disabled={selectedPerformerIds.length < 2 || isPreviewing} onClick={() => applyFormation('alignVertical')}>Align vertical</button>
              <button type="button" disabled={selectedPerformerIds.length < 2 || isPreviewing} onClick={() => applyFormation('distributeHorizontal')}>Distribute horizontal</button>
              <button type="button" disabled={selectedPerformerIds.length < 2 || isPreviewing} onClick={() => applyFormation('distributeVertical')}>Distribute vertical</button>
              <button type="button" disabled={selectedPerformerIds.length < 2 || isPreviewing} onClick={() => applyFormation('makeLine')}>Make line</button>
              <button type="button" disabled={isPreviewing} onClick={duplicateSelection}>Duplicate</button>
            </section>
          )}
        </aside>

        <div className="workspace">
          <FieldCanvas
            mode={mode}
            editingDisabled={isPreviewing}
            performerPositions={playbackPositions}
            selectedPerformerIds={selectedPerformerIds}
            onPerformerPositionsChange={updateActivePerformerPositions}
            onPerformerDragStart={() => {
              dragStartSnapshot.current = history.present
            }}
            onPerformerDragEnd={(moved) => {
              if (moved && dragStartSnapshot.current) {
                dispatchHistory({ type: 'checkpoint', snapshot: dragStartSnapshot.current })
              }
              dragStartSnapshot.current = null
            }}
            onPerformerSelect={selectPerformer}
            onBoxSelect={selectPerformersInBox}
            onSelectionClear={() => setSelectedPerformerIds([])}
          />

          <section className="timeline" aria-label="Timeline and drill sets">
            <div className="timeline__header">
              <div>
                <span className="timeline__eyebrow">Production</span>
                <h1>Drill sets</h1>
              </div>
              <div className="playback-controls" aria-label="Transition playback controls">
                <button type="button" onClick={playTransition} disabled={!transitionStartSet || isPlaying}>Play transition</button>
                <button type="button" onClick={playProduction} disabled={drillSets.length < 2 || isPlaying}>Play from start</button>
                <button type="button" onClick={() => { musicSynth.current.silence(); setIsPlaying(false) }} disabled={!isPlaying}>Pause</button>
                <button type="button" onClick={resumePlayback} disabled={!playbackMode || isPlaying}>Resume</button>
                <button type="button" onClick={restartPlayback} disabled={!playbackMode}>Restart</button>
                <button type="button" onClick={stopPlayback} disabled={!playbackMode}>Stop</button>
                <label className="tempo-control">
                  <span>Tempo</span>
                  <input
                    type="number"
                    min="40"
                    max="240"
                    value={tempo}
                    disabled={Boolean(music)}
                    aria-label="Playback tempo"
                    onChange={(event) => setTempo(Math.min(240, Math.max(40, event.target.valueAsNumber || 40)))}
                  />
                  <span>BPM</span>
                </label>
                <div className="playback-progress">
                  <output aria-label="Current count">{Math.floor(displayedLocalCount)} / {displayedTransitionCounts}</output>
                  <output aria-label="Production progress">{Math.floor(playbackMode === 'production' ? productionCount : 0)} / {totalProductionCounts}</output>
                </div>
              </div>
              <button className="add-set" type="button" onClick={addDrillSet}>Add set</button>
            </div>
            <input
              className="transition-playhead"
              type="range"
              min="0"
              max={playbackMode === 'production' ? totalProductionCounts : activeSet.counts}
              step="0.1"
              value={playbackMode === 'production' ? productionCount : currentCount}
              disabled={playbackMode === 'production' ? drillSets.length < 2 : !transitionStartSet}
              aria-label={playbackMode === 'production' ? 'Production count' : 'Transition count'}
              onChange={(event) => {
                musicSynth.current.silence()
                setIsPlaying(false)
                if (playbackMode === 'production') {
                  setProductionCount(event.target.valueAsNumber)
                } else {
                  setPlaybackMode('transition')
                  setCurrentCount(event.target.valueAsNumber)
                }
              }}
            />
            <section className="music-panel" aria-label="Music">
              <div className="music-panel__heading">Music</div>
              {music ? (
                <div className="music-panel__details">
                  <span className="music-panel__title" data-testid="music-title">{music.title}</span>
                  <output aria-label="Music position">
                    {(() => {
                      const position = getMeasurePositionForBeat(music.measures, playbackMode === 'production' ? productionCount : 0)
                      return `Measure ${position.measureNumber}, beat ${position.beatInMeasure.toFixed(1)}`
                    })()}
                  </output>
                  <output aria-label="Music tempo">
                    {Math.round(getActiveTempoBpm(music, tempo, playbackMode === 'production' ? productionCount : 0))} BPM
                  </output>
                  <button type="button" onClick={removeMusic} disabled={isPreviewing}>Remove Music</button>
                </div>
              ) : (
                <span className="music-panel__empty">No music imported</span>
              )}
              <button type="button" onClick={() => importMusicInput.current?.click()} disabled={isPreviewing}>Import Music</button>
              <input
                className="music-import"
                ref={importMusicInput}
                type="file"
                accept=".mscx,.mscz"
                aria-label="Import music file"
                onChange={importMusic}
              />
              {musicError && <div className="music-panel__error" role="alert">{musicError}</div>}
            </section>
            <div className="set-track__scroller" data-testid="set-track-scroller" ref={setTrackScroller}>
              <div className="set-track" role="list" aria-label="Drill sets">
                {drillSets.map((drillSet, index) => (
                  <div
                    className={`set-card${drillSet.id === activeSetId ? ' set-card--active' : ''}${playbackMode === 'production' && index === playbackSetIndex ? ' set-card--playback' : ''}`}
                    role="listitem"
                    key={drillSet.id}
                    data-testid={`drill-set-${drillSet.id}`}
                    data-set-id={drillSet.id}
                  >
                    <button
                      className="set-card__select"
                      type="button"
                      aria-pressed={drillSet.id === activeSetId}
                      onClick={() => activateDrillSet(drillSet.id)}
                    >
                      <span>{drillSet.name}</span>
                    </button>
                    {index === 0 ? (
                      <small>0 counts</small>
                    ) : (
                      <label className="set-card__counts">
                        <input
                          type="number"
                          min="1"
                          value={drillSet.counts}
                          aria-label={`Counts for ${drillSet.name}`}
                          disabled={isPreviewing}
                          onChange={(event) => updateDrillSetCounts(drillSet.id, event.target.valueAsNumber)}
                        />
                        <span>counts</span>
                      </label>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        <PerformerInventory
          editingDisabled={isPreviewing}
          performerPositions={performerPositions}
          selectedPerformerIds={selectedPerformerIds}
          onPerformerSelect={selectPerformer}
          onPerformerChange={updatePerformerMetadata}
        />
      </div>
    </main>
  )
}

export default App