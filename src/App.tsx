import { useEffect, useRef, useState, type PointerEvent } from 'react'
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

const toolbarItems = ['Select', 'Performer', 'Path', 'Measure']
const timelineSets = ['Set 1', 'Set 2', 'Set 3', 'Set 4']
const fiveYardLinePositions = getFiveYardLinePositions()
const yardLinePositions = getYardLinePositions()
const yardNumbers = getYardNumberPositions()

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

  return (
    <section className="field-canvas" aria-label="Marching field canvas">
      <div className="field-canvas__header">
        <span>Field view</span>
        <span className="field-canvas__status">120 × 53⅓ yd</span>
      </div>
      <svg
        className="field-canvas__svg"
        viewBox={`0 0 ${fieldGeometry.svgWidth} ${fieldGeometry.svgHeight}`}
        role="img"
        aria-label="Marching football field"
        data-testid="field-svg"
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
            <text x={performer.x} y={performer.y} textAnchor="middle" dominantBaseline="central">{performer.label}</text>
          </g>
        ))}
      </svg>
    </section>
  )
}

function App() {
  const [performerPositions, setPerformerPositions] = useState(performers)
  const [selectedPerformerIds, setSelectedPerformerIds] = useState<string[]>([])
  const [mode, setMode] = useState<'select' | 'performer'>('select')
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

      setPerformerPositions((currentPerformers) =>
        currentPerformers.filter((performer) => !selectedPerformerIds.includes(performer.id)),
      )
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
            onPerformerPositionsChange={setPerformerPositions}
            onPerformerSelect={selectPerformer}
            onSelectionClear={() => setSelectedPerformerIds([])}
          />

          <section className="timeline" aria-label="Timeline and drill sets">
            <div className="timeline__header">
              <div>
                <span className="timeline__eyebrow">Production</span>
                <h1>Drill sets</h1>
              </div>
              <button className="add-set" type="button">Add set</button>
            </div>
            <div className="set-track" role="list" aria-label="Placeholder drill sets">
              {timelineSets.map((set, index) => (
                <div className={`set-card${index === 0 ? ' set-card--active' : ''}`} role="listitem" key={set}>
                  <span>{set}</span>
                  <small>{index === 0 ? '0 counts' : '+16 counts'}</small>
                </div>
              ))}
              <div className="set-track__empty">Timeline ready for your first chart</div>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}

export default App