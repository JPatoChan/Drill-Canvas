import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent } from 'react'
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

type FieldCanvasProps = {
  mode: 'select' | 'performer'
  performerPositions: readonly Performer[]
  selectedPerformerIds: readonly string[]
  onPerformerPositionsChange: (performers: Performer[]) => void
  onPerformerSelect: (performerId: string, shouldToggle: boolean) => void
  onSelectionClear: () => void
}

function FieldCanvas({
  mode,
  performerPositions,
  selectedPerformerIds,
  onPerformerPositionsChange,
  onPerformerSelect,
  onSelectionClear,
}: FieldCanvasProps) {
  const [zoom, setZoom] = useState(1)
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
    ))
  }

  const handlePerformerPointerDown = (event: PointerEvent<SVGGElement>, performer: Performer) => {
    event.stopPropagation()
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
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePerformerPointerUp = (event: PointerEvent<SVGGElement>) => {
    if (dragState.current?.collapseSelectionOnRelease && !dragState.current.moved) {
      onPerformerSelect(dragState.current.performerId, false)
    }

    dragState.current = null
    event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const handleFieldPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (mode === 'select') {
      onSelectionClear()
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
            onPointerDown={handleFieldPointerDown}
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
        {performerPositions.map((performer) => (
          <g
            key={performer.id}
            className={`performer-marker${selectedPerformerIds.includes(performer.id) ? ' performer-marker--selected' : ''}`}
            aria-label={`Performer ${performer.label}`}
            data-testid={`performer-${performer.id}`}
            onPointerDown={(event) => handlePerformerPointerDown(event, performer)}
            onPointerMove={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                if (dragState.current) {
                  dragState.current.moved = true
                }
                updatePerformerPosition(event, performer.id)
              }
            }}
            onPointerUp={handlePerformerPointerUp}
            onPointerCancel={() => {
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
  performerPositions: readonly Performer[]
  selectedPerformerIds: readonly string[]
  onPerformerSelect: (performerId: string, shouldToggle: boolean) => void
  onPerformerChange: (performerId: string, changes: Pick<Performer, 'label' | 'name' | 'section'>) => void
}

function PerformerInventory({
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
  const [performerMetadata, setPerformerMetadata] = useState(() => performers.map(getPerformerMetadata))
  const [drillSets, setDrillSets] = useState<DrillSet[]>([initialDrillSet])
  const [activeSetId, setActiveSetId] = useState(initialDrillSet.id)
  const [selectedPerformerIds, setSelectedPerformerIds] = useState<string[]>([])
  const [mode, setMode] = useState<'select' | 'performer'>('select')
  const activeSet = drillSets.find(({ id }) => id === activeSetId) ?? drillSets[0]
  const performerPositions = getPerformersForSet(performerMetadata, activeSet)
  const selectedPerformer = selectedPerformerIds.length === 1
    ? performerPositions.find((performer) => performer.id === selectedPerformerIds[0])
    : undefined

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target
      const isEditableTarget = target instanceof Element && (
        target.matches('input, textarea, select') || target.closest('[contenteditable="true"]') !== null
      )

      if (
        (event.key !== 'Backspace' && event.key !== 'Delete')
        || selectedPerformerIds.length === 0
        || isEditableTarget
      ) {
        return
      }

      setPerformerMetadata((currentMetadata) =>
        currentMetadata.filter((performer) => !selectedPerformerIds.includes(performer.id)),
      )
      setDrillSets((currentSets) => currentSets.map((drillSet) => ({
        ...drillSet,
        performerPositions: drillSet.performerPositions.filter(
          ({ performerId }) => !selectedPerformerIds.includes(performerId),
        ),
      })))
      setSelectedPerformerIds([])
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedPerformerIds])

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

  const updatePerformerMetadata = (
    performerId: string,
    changes: Pick<Performer, 'label' | 'name' | 'section'>,
  ) => {
    setPerformerMetadata((currentPerformers) => currentPerformers.map((performer) =>
      performer.id === performerId ? { ...performer, ...changes } : performer,
    ))
  }

  const updateActivePerformerPositions = (nextPerformers: Performer[]) => {
    setDrillSets((currentSets) => {
      const existingIds = new Set(currentSets.flatMap((drillSet) =>
        drillSet.performerPositions.map(({ performerId }) => performerId),
      ))
      const newPerformers = nextPerformers.filter(({ id }) => !existingIds.has(id))

      // A new production performer starts at the creation position in every existing set.
      return currentSets.map((drillSet) => ({
        ...drillSet,
        performerPositions: drillSet.id === activeSetId
          ? nextPerformers.map(getPerformerPosition)
          : [...drillSet.performerPositions, ...newPerformers.map(getPerformerPosition)],
      }))
    })
    setPerformerMetadata((currentMetadata) => {
      const existingIds = new Set(currentMetadata.map(({ id }) => id))
      const additions = nextPerformers.filter(({ id }) => !existingIds.has(id)).map(getPerformerMetadata)

      return additions.length > 0 ? [...currentMetadata, ...additions] : currentMetadata
    })
  }

  const addDrillSet = () => {
    const newSet = createNextDrillSet(drillSets, activeSet)

    setDrillSets((currentSets) => [...currentSets, newSet])
    setActiveSetId(newSet.id)
    setSelectedPerformerIds([])
  }

  const activateDrillSet = (drillSetId: string) => {
    setActiveSetId(drillSetId)
    setSelectedPerformerIds([])
  }

  const updateDrillSetCounts = (drillSetId: string, counts: number) => {
    if (!Number.isFinite(counts)) {
      return
    }

    setDrillSets((currentSets) => currentSets.map((drillSet, index) =>
      drillSet.id === drillSetId && index > 0
        ? { ...drillSet, counts: Math.max(1, Math.floor(counts)) }
        : drillSet,
    ))
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand" aria-label="DrillCanvas">
          <span className="brand__mark" aria-hidden="true"><i /><i /><i /></span>
          <span>DrillCanvas</span>
        </div>
        <div className="show-name">Untitled Production</div>
        <button className="header-action" type="button">Share</button>
      </header>

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
        </aside>

        <div className="workspace">
          <FieldCanvas
            mode={mode}
            performerPositions={performerPositions}
            selectedPerformerIds={selectedPerformerIds}
            onPerformerPositionsChange={updateActivePerformerPositions}
            onPerformerSelect={selectPerformer}
            onSelectionClear={() => setSelectedPerformerIds([])}
          />

          <section className="timeline" aria-label="Timeline and drill sets">
            <div className="timeline__header">
              <div>
                <span className="timeline__eyebrow">Production</span>
                <h1>Drill sets</h1>
              </div>
              <button className="add-set" type="button" onClick={addDrillSet}>Add set</button>
            </div>
            <div className="set-track" role="list" aria-label="Drill sets">
              {drillSets.map((drillSet, index) => (
                <div
                  className={`set-card${drillSet.id === activeSetId ? ' set-card--active' : ''}`}
                  role="listitem"
                  key={drillSet.id}
                  data-testid={`drill-set-${drillSet.id}`}
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
                        onChange={(event) => updateDrillSetCounts(drillSet.id, event.target.valueAsNumber)}
                      />
                      <span>counts</span>
                    </label>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>

        <PerformerInventory
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