import { useState, type PointerEvent } from 'react'
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
import { performerMarkerRadiusSvg, performers, type Performer } from './domain/performers'

const toolbarItems = ['Select', 'Performer', 'Path', 'Measure']
const timelineSets = ['Set 1', 'Set 2', 'Set 3', 'Set 4']
const fiveYardLinePositions = getFiveYardLinePositions()
const yardLinePositions = getYardLinePositions()
const yardNumbers = getYardNumberPositions()

type FieldCanvasProps = {
  performerPositions: readonly Performer[]
  selectedPerformerId: string | null
  onPerformerPositionsChange: (performers: Performer[]) => void
  onPerformerSelect: (performerId: string) => void
}

function FieldCanvas({
  performerPositions,
  selectedPerformerId,
  onPerformerPositionsChange,
  onPerformerSelect,
}: FieldCanvasProps) {

  const updatePerformerPosition = (event: PointerEvent<SVGGElement>, performerId: string) => {
    const svg = event.currentTarget.ownerSVGElement

    if (!svg) {
      return
    }

    const bounds = svg.getBoundingClientRect()
    const position = getSnappedPerformerPlacement({
      x: ((event.clientX - bounds.left) / bounds.width) * fieldGeometry.svgWidth,
      y: ((event.clientY - bounds.top) / bounds.height) * fieldGeometry.svgHeight,
    }, performerMarkerRadiusSvg)

    onPerformerPositionsChange(performerPositions.map((performer) =>
      performer.id === performerId ? { ...performer, ...position } : performer,
    ))
  }

  const handlePerformerPointerDown = (event: PointerEvent<SVGGElement>, performer: Performer) => {
    onPerformerSelect(performer.id)
    event.currentTarget.setPointerCapture(event.pointerId)
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
            className={`performer-marker${selectedPerformerId === performer.id ? ' performer-marker--selected' : ''}`}
            aria-label={`Performer ${performer.label}`}
            data-testid={`performer-${performer.id}`}
            onPointerDown={(event) => handlePerformerPointerDown(event, performer)}
            onPointerMove={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                updatePerformerPosition(event, performer.id)
              }
            }}
            onPointerUp={(event) => event.currentTarget.releasePointerCapture(event.pointerId)}
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
  const [selectedPerformerId, setSelectedPerformerId] = useState<string | null>(null)
  const selectedPerformer = performerPositions.find((performer) => performer.id === selectedPerformerId)

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
            <button className={`tool-button${index === 0 ? ' tool-button--active' : ''}`} type="button" key={item}>
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
        </aside>

        <div className="workspace">
          <FieldCanvas
            performerPositions={performerPositions}
            selectedPerformerId={selectedPerformerId}
            onPerformerPositionsChange={setPerformerPositions}
            onPerformerSelect={setSelectedPerformerId}
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