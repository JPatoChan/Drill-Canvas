import { act, fireEvent, render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import App from './App'
import { fieldGeometry } from './domain/fieldGeometry'

describe('App', () => {
  it('renders the initial drill design workspace', () => {
    render(<App />)

    expect(screen.getByLabelText('DrillCanvas')).toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: 'Editor tools' })).toBeInTheDocument()
    expect(screen.getByLabelText('Marching field canvas')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Marching football field' })).toBeInTheDocument()
    expect(screen.getByText('T1')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Timeline and drill sets' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Selected performer')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Selected performers')).not.toBeInTheDocument()
  })

  it('starts with one active opening set at zero counts', () => {
    render(<App />)

    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Set 1' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('drill-set-set-1')).toHaveTextContent('0 counts')
    expect(screen.queryByLabelText('Counts for Set 1')).not.toBeInTheDocument()
  })

  it('adds an active Set 2 with a copied formation and 16 counts', () => {
    render(<App />)
    const initialX = screen.getByTestId('performer-t1').querySelector('circle')?.getAttribute('cx')

    fireEvent.click(screen.getByRole('button', { name: 'Add set' }))

    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Set 1' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Set 2' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('Counts for Set 2')).toHaveValue(16)
    expect(screen.getByTestId('performer-t1').querySelector('circle')).toHaveAttribute('cx', initialX)
  })

  it('edits transition counts while enforcing a minimum of one', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Add set' }))

    const counts = screen.getByLabelText('Counts for Set 2')
    fireEvent.change(counts, { target: { value: '24' } })
    expect(counts).toHaveValue(24)

    fireEvent.change(counts, { target: { value: '0' } })
    expect(counts).toHaveValue(1)
    expect(screen.getByTestId('drill-set-set-1')).toHaveTextContent('0 counts')
  })

  it('restores independent performer positions when switching sets', () => {
    render(<App />)
    const svg = screen.getByTestId('field-svg')
    const performer = screen.getByTestId('performer-t1')

    Object.defineProperty(svg, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 1200, height: 533.3333333333334 }),
    })
    Object.defineProperty(performer, 'setPointerCapture', { value: () => undefined })
    Object.defineProperty(performer, 'hasPointerCapture', { value: () => true })
    fireEvent.click(screen.getByRole('button', { name: 'Add set' }))
    fireEvent(performer, new MouseEvent('pointerdown', { bubbles: true, clientX: 600, clientY: 262.5 }))
    fireEvent(performer, new MouseEvent('pointermove', { bubbles: true, clientX: 700, clientY: 262.5 }))
    expect(performer.querySelector('circle')).toHaveAttribute('cx', '700')

    fireEvent.click(screen.getByRole('button', { name: 'Set 1' }))
    expect(performer.querySelector('circle')).toHaveAttribute('cx', '600')
    fireEvent.click(screen.getByRole('button', { name: 'Set 2' }))
    expect(performer.querySelector('circle')).toHaveAttribute('cx', '700')
  })

  it('limits group movement to the active set', () => {
    render(<App />)
    const svg = screen.getByTestId('field-svg')

    Object.defineProperty(svg, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 1200, height: 533.3333333333334 }),
    })
    fireEvent.click(screen.getByRole('button', { name: 'Performer' }))
    fireEvent(svg, new MouseEvent('pointerdown', { bubbles: true, clientX: 200, clientY: 200 }))
    fireEvent.click(screen.getByRole('button', { name: 'Select' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add set' }))

    const t1 = screen.getByTestId('performer-t1')
    const p1 = screen.getByTestId('performer-p1')
    for (const performer of [t1, p1]) {
      Object.defineProperty(performer, 'setPointerCapture', { value: () => undefined })
    }
    Object.defineProperty(t1, 'hasPointerCapture', { value: () => true })
    fireEvent(t1, new MouseEvent('pointerdown', { bubbles: true }))
    fireEvent(p1, new MouseEvent('pointerdown', { bubbles: true, shiftKey: true }))
    fireEvent(t1, new MouseEvent('pointermove', { bubbles: true, clientX: 700, clientY: 362.5 }))
    expect(t1.querySelector('circle')).toHaveAttribute('cx', '700')
    expect(p1.querySelector('circle')).toHaveAttribute('cx', '300')

    fireEvent.click(screen.getByRole('button', { name: 'Set 1' }))
    expect(t1.querySelector('circle')).toHaveAttribute('cx', '600')
    expect(p1.querySelector('circle')).toHaveAttribute('cx', '200')
  })

  it('copies the edited active formation when adding another set', () => {
    render(<App />)
    const svg = screen.getByTestId('field-svg')
    const performer = screen.getByTestId('performer-t1')

    Object.defineProperty(svg, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 1200, height: 533.3333333333334 }),
    })
    Object.defineProperty(performer, 'setPointerCapture', { value: () => undefined })
    Object.defineProperty(performer, 'hasPointerCapture', { value: () => true })
    fireEvent.click(screen.getByRole('button', { name: 'Add set' }))
    fireEvent(performer, new MouseEvent('pointerdown', { bubbles: true }))
    fireEvent(performer, new MouseEvent('pointermove', { bubbles: true, clientX: 700, clientY: 262.5 }))
    fireEvent.click(screen.getByRole('button', { name: 'Add set' }))

    expect(screen.getByRole('button', { name: 'Set 3' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('performer-t1').querySelector('circle')).toHaveAttribute('cx', '700')
    expect(screen.getByLabelText('Counts for Set 3')).toHaveValue(16)
  })

  it('backfills new performers into existing sets at their creation position', () => {
    render(<App />)
    const svg = screen.getByTestId('field-svg')

    Object.defineProperty(svg, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 1200, height: 533.3333333333334 }),
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add set' }))
    fireEvent.click(screen.getByRole('button', { name: 'Performer' }))
    fireEvent(svg, new MouseEvent('pointerdown', { bubbles: true, clientX: 300, clientY: 300 }))
    expect(screen.getByTestId('performer-p1').querySelector('circle')).toHaveAttribute('cx', '300')

    fireEvent.click(screen.getByRole('button', { name: 'Set 1' }))
    expect(screen.getByTestId('performer-p1').querySelector('circle')).toHaveAttribute('cx', '300')
    expect(screen.getByTestId('inventory-p1')).toBeInTheDocument()
  })

  it('deletes performers from every set and keeps metadata shared', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Add set' }))

    fireEvent.change(screen.getByLabelText('Label for T1'), { target: { value: 'Lead' } })
    expect(screen.getByTestId('performer-t1')).toHaveTextContent('Lead')
    fireEvent.click(screen.getByRole('button', { name: 'Set 1' }))
    expect(screen.getByTestId('performer-t1')).toHaveTextContent('Lead')

    fireEvent.click(screen.getByRole('button', { name: 'Set 2' }))
    const performer = screen.getByTestId('performer-t1')
    Object.defineProperty(performer, 'setPointerCapture', { value: () => undefined })
    fireEvent(performer, new MouseEvent('pointerdown', { bubbles: true }))
    fireEvent.keyDown(window, { key: 'Delete' })
    expect(screen.queryByTestId('performer-t1')).not.toBeInTheDocument()
    expect(screen.queryByTestId('inventory-t1')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Set 1' }))
    expect(screen.queryByTestId('performer-t1')).not.toBeInTheDocument()
  })

  it('clears selection but preserves zoom when switching sets', () => {
    render(<App />)
    const performer = screen.getByTestId('performer-t1')

    Object.defineProperty(performer, 'setPointerCapture', { value: () => undefined })
    fireEvent(performer, new MouseEvent('pointerdown', { bubbles: true }))
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add set' }))

    expect(screen.queryByLabelText('Selected performer')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Current zoom')).toHaveTextContent('125%')
    fireEvent.click(screen.getByRole('button', { name: 'Set 1' }))
    expect(screen.getByLabelText('Current zoom')).toHaveTextContent('125%')
  })

  it('scrubs Set 1 to Set 2 through exact start, halfway, and destination positions', () => {
    render(<App />)
    const svg = screen.getByTestId('field-svg')
    const performer = screen.getByTestId('performer-t1')

    Object.defineProperty(svg, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 1200, height: 533.3333333333334 }),
    })
    Object.defineProperty(performer, 'setPointerCapture', { value: () => undefined })
    Object.defineProperty(performer, 'hasPointerCapture', { value: () => true })
    fireEvent.click(screen.getByRole('button', { name: 'Add set' }))
    fireEvent(performer, new MouseEvent('pointerdown', { bubbles: true }))
    fireEvent(performer, new MouseEvent('pointermove', { bubbles: true, clientX: 800, clientY: 262.5 }))

    const playhead = screen.getByLabelText('Transition count')
    fireEvent.change(playhead, { target: { value: '0' } })
    expect(performer.querySelector('circle')).toHaveAttribute('cx', '600')
    expect(screen.getByLabelText('Current count')).toHaveTextContent('0 / 16')

    fireEvent.change(playhead, { target: { value: '8' } })
    expect(performer.querySelector('circle')).toHaveAttribute('cx', '700')
    expect(screen.getByLabelText('Current count')).toHaveTextContent('8 / 16')

    fireEvent.change(playhead, { target: { value: '16' } })
    expect(performer.querySelector('circle')).toHaveAttribute('cx', '800')
    expect(screen.getByLabelText('Current count')).toHaveTextContent('16 / 16')
  })

  it('uses edited transition lengths when scrubbing', () => {
    render(<App />)
    const svg = screen.getByTestId('field-svg')
    const performer = screen.getByTestId('performer-t1')

    Object.defineProperty(svg, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 1200, height: 533.3333333333334 }),
    })
    Object.defineProperty(performer, 'setPointerCapture', { value: () => undefined })
    Object.defineProperty(performer, 'hasPointerCapture', { value: () => true })
    fireEvent.click(screen.getByRole('button', { name: 'Add set' }))
    fireEvent(performer, new MouseEvent('pointerdown', { bubbles: true }))
    fireEvent(performer, new MouseEvent('pointermove', { bubbles: true, clientX: 840, clientY: 262.5 }))
    fireEvent.change(screen.getByLabelText('Counts for Set 2'), { target: { value: '24' } })
    fireEvent.change(screen.getByLabelText('Transition count'), { target: { value: '12' } })

    expect(performer.querySelector('circle')).toHaveAttribute('cx', '718.75')
    expect(screen.getByLabelText('Current count')).toHaveTextContent('12 / 24')
  })

  it('plays, pauses, and restarts using BPM count timing', () => {
    vi.useFakeTimers()
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
      window.setTimeout(() => callback(performance.now()), 16))
    vi.stubGlobal('cancelAnimationFrame', (handle: number) => window.clearTimeout(handle))

    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Add set' }))
    fireEvent.click(screen.getByRole('button', { name: 'Play transition' }))

    expect(screen.getByRole('button', { name: 'Play transition' })).toBeDisabled()
    act(() => vi.advanceTimersByTime(1016))
    expect(Number(screen.getByLabelText('Transition count').getAttribute('value'))).toBeGreaterThanOrEqual(2)

    fireEvent.click(screen.getByRole('button', { name: 'Pause' }))
    const pausedCount = (screen.getByLabelText('Transition count') as HTMLInputElement).value
    act(() => vi.advanceTimersByTime(1000))
    expect(screen.getByLabelText('Transition count')).toHaveValue(pausedCount)

    fireEvent.click(screen.getByRole('button', { name: 'Restart' }))
    expect(screen.getByLabelText('Transition count')).toHaveValue('0')
    expect(screen.getByLabelText('Current count')).toHaveTextContent('0 / 16')

    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('keeps transient playback read-only and stored set positions unchanged', () => {
    render(<App />)
    const svg = screen.getByTestId('field-svg')
    const performer = screen.getByTestId('performer-t1')

    Object.defineProperty(svg, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 1200, height: 533.3333333333334 }),
    })
    Object.defineProperty(performer, 'setPointerCapture', { value: () => undefined })
    Object.defineProperty(performer, 'hasPointerCapture', { value: () => true })
    fireEvent.click(screen.getByRole('button', { name: 'Add set' }))
    fireEvent(performer, new MouseEvent('pointerdown', { bubbles: true }))
    fireEvent(performer, new MouseEvent('pointermove', { bubbles: true, clientX: 800, clientY: 262.5 }))
    fireEvent.change(screen.getByLabelText('Transition count'), { target: { value: '8' } })
    expect(performer.querySelector('circle')).toHaveAttribute('cx', '700')

    fireEvent(performer, new MouseEvent('pointerdown', { bubbles: true }))
    fireEvent(performer, new MouseEvent('pointermove', { bubbles: true, clientX: 900, clientY: 262.5 }))
    expect(performer.querySelector('circle')).toHaveAttribute('cx', '700')
    fireEvent.change(screen.getByLabelText('Transition count'), { target: { value: '16' } })
    expect(performer.querySelector('circle')).toHaveAttribute('cx', '800')

    fireEvent.click(screen.getByRole('button', { name: 'Set 1' }))
    expect(performer.querySelector('circle')).toHaveAttribute('cx', '600')
    fireEvent.click(screen.getByRole('button', { name: 'Set 2' }))
    expect(performer.querySelector('circle')).toHaveAttribute('cx', '800')
  })

  it('previews playback positions without changing non-default zoom', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add set' }))
    fireEvent.change(screen.getByLabelText('Transition count'), { target: { value: '8' } })

    expect(screen.getByTestId('field-svg')).toHaveAttribute('data-zoom', '1.25')
    expect(screen.getByLabelText('Current zoom')).toHaveTextContent('125%')
  })

  it('box selects multiple performers and removes the marquee on release', () => {
    render(<App />)
    const svg = screen.getByTestId('field-svg')

    Object.defineProperty(svg, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 1200, height: 533.3333333333334 }),
    })
    fireEvent.click(screen.getByRole('button', { name: 'Performer' }))
    fireEvent(svg, new MouseEvent('pointerdown', { bubbles: true, clientX: 200, clientY: 200 }))
    fireEvent(svg, new MouseEvent('pointerdown', { bubbles: true, clientX: 300, clientY: 300 }))
    fireEvent.click(screen.getByRole('button', { name: 'Select' }))

    fireEvent(svg, new MouseEvent('pointerdown', { bubbles: true, clientX: 150, clientY: 150 }))
    fireEvent(svg, new MouseEvent('pointermove', { bubbles: true, clientX: 350, clientY: 350 }))
    expect(screen.getByTestId('selection-marquee')).toBeInTheDocument()
    fireEvent(svg, new MouseEvent('pointerup', { bubbles: true, clientX: 350, clientY: 350 }))

    expect(screen.queryByTestId('selection-marquee')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Selected performers')).toHaveTextContent('2 performers selected')
    expect(screen.getByTestId('performer-p1')).toHaveClass('performer-marker--selected')
    expect(screen.getByTestId('performer-p2')).toHaveClass('performer-marker--selected')
  })

  it('box selects accurately at non-default zoom', () => {
    render(<App />)
    const svg = screen.getByTestId('field-svg')

    Object.defineProperty(svg, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 2400, height: 1066.6666666666667 }),
    })
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
    fireEvent(svg, new MouseEvent('pointerdown', { bubbles: true, clientX: 1100, clientY: 450 }))
    fireEvent(svg, new MouseEvent('pointermove', { bubbles: true, clientX: 1300, clientY: 600 }))
    fireEvent(svg, new MouseEvent('pointerup', { bubbles: true, clientX: 1300, clientY: 600 }))

    expect(screen.getByLabelText('Selected performer')).toHaveTextContent('T1')
  })

  it('shift-box toggles performers without replacing the existing selection', () => {
    render(<App />)
    const svg = screen.getByTestId('field-svg')
    const t1 = screen.getByTestId('performer-t1')

    Object.defineProperty(svg, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 1200, height: 533.3333333333334 }),
    })
    Object.defineProperty(t1, 'setPointerCapture', { value: () => undefined })
    fireEvent.click(screen.getByRole('button', { name: 'Performer' }))
    fireEvent(svg, new MouseEvent('pointerdown', { bubbles: true, clientX: 200, clientY: 200 }))
    fireEvent.click(screen.getByRole('button', { name: 'Select' }))
    fireEvent(t1, new MouseEvent('pointerdown', { bubbles: true }))

    const toggleP1 = () => {
      fireEvent(svg, new MouseEvent('pointerdown', { bubbles: true, shiftKey: true, clientX: 175, clientY: 175 }))
      fireEvent(svg, new MouseEvent('pointermove', { bubbles: true, shiftKey: true, clientX: 225, clientY: 225 }))
      fireEvent(svg, new MouseEvent('pointerup', { bubbles: true, shiftKey: true, clientX: 225, clientY: 225 }))
    }
    toggleP1()
    expect(screen.getByLabelText('Selected performers')).toHaveTextContent('2 performers selected')
    toggleP1()
    expect(screen.getByLabelText('Selected performer')).toHaveTextContent('T1')
  })

  it('clears selection when an empty-field gesture does not become a box', () => {
    render(<App />)
    const svg = screen.getByTestId('field-svg')
    const performer = screen.getByTestId('performer-t1')

    Object.defineProperty(svg, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 1200, height: 533.3333333333334 }),
    })
    Object.defineProperty(performer, 'setPointerCapture', { value: () => undefined })
    fireEvent(performer, new MouseEvent('pointerdown', { bubbles: true }))
    fireEvent(svg, new MouseEvent('pointerdown', { bubbles: true, clientX: 50, clientY: 50 }))
    fireEvent(svg, new MouseEvent('pointerup', { bubbles: true, clientX: 50, clientY: 50 }))

    expect(screen.queryByLabelText('Selected performer')).not.toBeInTheDocument()
  })

  it.each([
    ['Align horizontal', 'cy'],
    ['Align vertical', 'cx'],
  ])('%s aligns only the selected performers', (action, attribute) => {
    render(<App />)
    const svg = screen.getByTestId('field-svg')

    Object.defineProperty(svg, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 1200, height: 533.3333333333334 }),
    })
    fireEvent.click(screen.getByRole('button', { name: 'Performer' }))
    fireEvent(svg, new MouseEvent('pointerdown', { bubbles: true, clientX: 200, clientY: 200 }))
    fireEvent.click(screen.getByTestId('inventory-t1'))
    fireEvent.click(screen.getByTestId('inventory-p1'), { shiftKey: true })
    fireEvent.click(screen.getByRole('button', { name: action }))

    const first = screen.getByTestId('performer-t1').querySelector('circle')
    const second = screen.getByTestId('performer-p1').querySelector('circle')
    expect(first?.getAttribute(attribute)).toBe(second?.getAttribute(attribute))
  })

  it.each([
    ['Distribute horizontal', 'cx'],
    ['Distribute vertical', 'cy'],
  ])('%s spaces selected performers in stable order', (action, attribute) => {
    render(<App />)
    const svg = screen.getByTestId('field-svg')

    Object.defineProperty(svg, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 1200, height: 533.3333333333334 }),
    })
    fireEvent.click(screen.getByRole('button', { name: 'Performer' }))
    fireEvent(svg, new MouseEvent('pointerdown', { bubbles: true, clientX: 200, clientY: 150 }))
    fireEvent(svg, new MouseEvent('pointerdown', { bubbles: true, clientX: 300, clientY: 250 }))
    fireEvent(svg, new MouseEvent('pointerdown', { bubbles: true, clientX: 500, clientY: 400 }))
    fireEvent.click(screen.getByTestId('inventory-p1'))
    fireEvent.click(screen.getByTestId('inventory-p2'), { shiftKey: true })
    fireEvent.click(screen.getByTestId('inventory-p3'), { shiftKey: true })
    fireEvent.click(screen.getByRole('button', { name: action }))

    const coordinates = ['p1', 'p2', 'p3'].map((id) => Number(
      screen.getByTestId(`performer-${id}`).querySelector('circle')?.getAttribute(attribute),
    ))
    expect(Math.abs(
      (coordinates[1] - coordinates[0]) - (coordinates[2] - coordinates[1]),
    )).toBeLessThan(fieldGeometry.marchingStepSizeSvg)
  })

  it('makes a snapped straight line using selection-order endpoints', () => {
    render(<App />)
    const svg = screen.getByTestId('field-svg')

    Object.defineProperty(svg, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 1200, height: 533.3333333333334 }),
    })
    fireEvent.click(screen.getByRole('button', { name: 'Performer' }))
    fireEvent(svg, new MouseEvent('pointerdown', { bubbles: true, clientX: 200, clientY: 150 }))
    fireEvent(svg, new MouseEvent('pointerdown', { bubbles: true, clientX: 300, clientY: 400 }))
    fireEvent(svg, new MouseEvent('pointerdown', { bubbles: true, clientX: 500, clientY: 300 }))
    fireEvent.click(screen.getByTestId('inventory-p1'))
    fireEvent.click(screen.getByTestId('inventory-p2'), { shiftKey: true })
    fireEvent.click(screen.getByTestId('inventory-p3'), { shiftKey: true })
    fireEvent.click(screen.getByRole('button', { name: 'Make line' }))

    expect(screen.getByTestId('performer-p2').querySelector('circle')).toHaveAttribute('cx', '350')
  })

  it('duplicates selected metadata with new identity and applies formation edits only to the active set', () => {
    render(<App />)
    const svg = screen.getByTestId('field-svg')

    Object.defineProperty(svg, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 1200, height: 533.3333333333334 }),
    })
    fireEvent.change(screen.getByLabelText('Name for T1'), { target: { value: 'Taylor' } })
    fireEvent.change(screen.getByLabelText('Section for T1'), { target: { value: 'Clarinet' } })
    fireEvent.click(screen.getByTestId('inventory-t1'))
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate' }))
    expect(screen.getByTestId('performer-p1')).toHaveTextContent('P1')
    expect(screen.getByLabelText('Name for P1')).toHaveValue('Taylor')
    expect(screen.getByLabelText('Section for P1')).toHaveValue('Clarinet')

    const setOneT1X = screen.getByTestId('performer-t1').querySelector('circle')?.getAttribute('cx')
    const setOneP1X = screen.getByTestId('performer-p1').querySelector('circle')?.getAttribute('cx')
    fireEvent.click(screen.getByRole('button', { name: 'Add set' }))
    fireEvent.click(screen.getByTestId('inventory-t1'))
    fireEvent.click(screen.getByTestId('inventory-p1'), { shiftKey: true })
    fireEvent.click(screen.getByRole('button', { name: 'Align vertical' }))
    fireEvent.click(screen.getByRole('button', { name: 'Set 1' }))
    expect(screen.getByTestId('performer-t1').querySelector('circle')).toHaveAttribute('cx', setOneT1X)
    expect(screen.getByTestId('performer-p1').querySelector('circle')).toHaveAttribute('cx', setOneP1X)
  })

  it('disables formation tools and box selection during playback', () => {
    render(<App />)
    const svg = screen.getByTestId('field-svg')

    Object.defineProperty(svg, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 1200, height: 533.3333333333334 }),
    })
    fireEvent.click(screen.getByRole('button', { name: 'Performer' }))
    fireEvent(svg, new MouseEvent('pointerdown', { bubbles: true, clientX: 200, clientY: 200 }))
    fireEvent.click(screen.getByRole('button', { name: 'Add set' }))
    fireEvent.click(screen.getByRole('button', { name: 'Play transition' }))
    fireEvent.click(screen.getByTestId('inventory-t1'))
    fireEvent.click(screen.getByTestId('inventory-p1'), { shiftKey: true })

    expect(screen.getByRole('button', { name: 'Align horizontal' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Duplicate' })).toBeDisabled()
    fireEvent(svg, new MouseEvent('pointerdown', { bubbles: true, clientX: 100, clientY: 100 }))
    fireEvent(svg, new MouseEvent('pointermove', { bubbles: true, clientX: 400, clientY: 400 }))
    expect(screen.queryByTestId('selection-marquee')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }))
  })

  it('scrubs full-production playback cumulatively without changing zoom or the active editing set', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add set' }))
    fireEvent.change(screen.getByLabelText('Counts for Set 2'), { target: { value: '16' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add set' }))
    fireEvent.change(screen.getByLabelText('Counts for Set 3'), { target: { value: '8' } })
    fireEvent.click(screen.getByRole('button', { name: 'Play from start' }))
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }))
    fireEvent.change(screen.getByLabelText('Production count'), { target: { value: '20' } })

    expect(screen.getByLabelText('Current count')).toHaveTextContent('4 / 8')
    expect(screen.getByLabelText('Production progress')).toHaveTextContent('20 / 24')
    expect(screen.getByTestId('drill-set-set-3')).toHaveClass('set-card--active')
    expect(screen.getByTestId('drill-set-set-3')).toHaveClass('set-card--playback')
    expect(screen.getByLabelText('Current zoom')).toHaveTextContent('125%')

    fireEvent.click(screen.getByRole('button', { name: 'Restart' }))
    expect(screen.getByLabelText('Production count')).toHaveValue('0')
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }))
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }))
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }))
    expect(screen.getByTestId('drill-set-set-3')).toHaveClass('set-card--active')
    expect(screen.getByTestId('drill-set-set-3')).not.toHaveClass('set-card--playback')
  })

  it('edits performer metadata from the inventory and updates the field immediately', () => {
    render(<App />)

    const row = screen.getByTestId('inventory-t1')
    const labelInput = screen.getByLabelText('Label for T1')

    fireEvent.change(labelInput, { target: { value: 'S1' } })
    fireEvent.change(screen.getByLabelText('Name for S1'), { target: { value: 'Jordan Lee' } })
    fireEvent.change(screen.getByLabelText('Section for S1'), { target: { value: 'Saxophone' } })

    expect(screen.getByTestId('performer-t1')).toHaveTextContent('S1')
    expect(labelInput).toHaveValue('S1')
    expect(screen.getByLabelText('Name for S1')).toHaveValue('Jordan Lee')
    expect(screen.getByLabelText('Section for S1')).toHaveValue('Saxophone')
    expect(row).toBeInTheDocument()
  })

  it('keeps inventory additions and deletions synchronized with performers', () => {
    render(<App />)
    const svg = screen.getByTestId('field-svg')

    Object.defineProperty(svg, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 1200, height: 533.3333333333334 }),
    })
    fireEvent.click(screen.getByRole('button', { name: 'Performer' }))
    fireEvent(svg, new MouseEvent('pointerdown', { bubbles: true, clientX: 200, clientY: 200 }))

    expect(screen.getByTestId('inventory-p1')).toBeInTheDocument()
    expect(screen.getByLabelText('Performer inventory')).toHaveTextContent('2')
    fireEvent.keyDown(window, { key: 'Delete' })

    expect(screen.queryByTestId('inventory-p1')).not.toBeInTheDocument()
    expect(screen.getByTestId('inventory-t1')).toBeInTheDocument()
  })

  it('synchronizes field and shift-multiselection through inventory rows', () => {
    render(<App />)
    const svg = screen.getByTestId('field-svg')
    const t1 = screen.getByTestId('performer-t1')

    Object.defineProperty(svg, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 1200, height: 533.3333333333334 }),
    })
    Object.defineProperty(t1, 'setPointerCapture', { value: () => undefined })
    fireEvent(t1, new MouseEvent('pointerdown', { bubbles: true }))
    expect(screen.getByTestId('inventory-t1')).toHaveClass('inventory-row--selected')

    fireEvent.click(screen.getByRole('button', { name: 'Performer' }))
    fireEvent(svg, new MouseEvent('pointerdown', { bubbles: true, clientX: 200, clientY: 200 }))
    fireEvent.click(screen.getByTestId('inventory-t1'), { shiftKey: true })

    expect(screen.getByLabelText('Selected performers')).toHaveTextContent('2 performers selected')
    expect(screen.getByTestId('performer-t1')).toHaveClass('performer-marker--selected')
    expect(screen.getByTestId('performer-p1')).toHaveClass('performer-marker--selected')

    fireEvent.click(screen.getByTestId('inventory-t1'))
    expect(screen.getByLabelText('Selected performer')).toHaveTextContent('T1')
    expect(screen.getByTestId('performer-p1')).not.toHaveClass('performer-marker--selected')
  })

  it('renders compact performer markers', () => {
    render(<App />)

    const performer = screen.getByTestId('performer-t1')
    expect(performer.querySelector('circle')).toHaveAttribute('r', '6')
    expect(performer.querySelector('text')).toHaveAttribute('x', '609')
  })

  it('zooms in, out, and resets without changing performer coordinates', () => {
    render(<App />)
    const svg = screen.getByTestId('field-svg')
    const circle = screen.getByTestId('performer-t1').querySelector('circle')
    const initialPosition = { x: circle?.getAttribute('cx'), y: circle?.getAttribute('cy') }

    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
    expect(screen.getByLabelText('Current zoom')).toHaveTextContent('125%')
    expect(svg).toHaveAttribute('data-zoom', '1.25')
    expect(circle).toHaveAttribute('cx', initialPosition.x)
    expect(circle).toHaveAttribute('cy', initialPosition.y)

    fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }))
    expect(screen.getByLabelText('Current zoom')).toHaveTextContent('100%')
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reset/Fit' }))
    expect(screen.getByLabelText('Current zoom')).toHaveTextContent('100%')
  })

  it('places a performer at the correct field coordinate while zoomed', () => {
    render(<App />)
    const svg = screen.getByTestId('field-svg')

    for (let step = 0; step < 4; step += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
    }
    Object.defineProperty(svg, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 2400, height: 1066.6666666666667 }),
    })
    fireEvent.click(screen.getByRole('button', { name: 'Performer' }))
    fireEvent(svg, new MouseEvent('pointerdown', { bubbles: true, clientX: 400, clientY: 400 }))

    const circle = screen.getByTestId('performer-p1').querySelector('circle')
    expect(circle).toHaveAttribute('cx', '200')
    expect(circle).toHaveAttribute('cy', '202.7777777777778')
  })

  it('drags a performer to the correct field coordinate while zoomed', () => {
    render(<App />)
    const svg = screen.getByTestId('field-svg')
    const performer = screen.getByTestId('performer-t1')

    for (let step = 0; step < 4; step += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
    }
    Object.defineProperty(svg, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 2400, height: 1066.6666666666667 }),
    })
    Object.defineProperty(performer, 'setPointerCapture', { value: () => undefined })
    Object.defineProperty(performer, 'hasPointerCapture', { value: () => true })
    fireEvent(performer, new MouseEvent('pointerdown', { bubbles: true, clientX: 1200, clientY: 525 }))
    fireEvent(performer, new MouseEvent('pointermove', { bubbles: true, clientX: 1400, clientY: 525 }))

    expect(performer.querySelector('circle')).toHaveAttribute('cx', '700')
    expect(performer.querySelector('circle')).toHaveAttribute('cy', '265.2777777777778')
  })

  it('updates T1 after a pointer drag in responsive SVG coordinates', () => {
    const { container } = render(<App />)
    const svg = container.querySelector('svg')
    const performer = screen.getByTestId('performer-t1')

    if (!svg) {
      throw new Error('Expected marching field SVG.')
    }

    Object.defineProperty(svg, 'getBoundingClientRect', {
      value: () => ({ left: 100, top: 50, width: 600, height: 266.6666666666667 }),
    })
    Object.defineProperty(performer, 'setPointerCapture', { value: () => undefined })
    Object.defineProperty(performer, 'hasPointerCapture', { value: () => true })
    Object.defineProperty(performer, 'releasePointerCapture', { value: () => undefined })

    fireEvent(performer, new MouseEvent('pointerdown', { bubbles: true, clientX: 400, clientY: 150 }))
    fireEvent(performer, new MouseEvent('pointermove', { bubbles: true, clientX: 410, clientY: 160 }))

    expect(performer.querySelector('circle')).toHaveAttribute('cx', '618.75')
    expect(Number(performer.querySelector('circle')?.getAttribute('cy'))).toBeCloseTo(221.5277777777778)
    expect(screen.getByLabelText('Selected performer')).toHaveTextContent('T1')
    expect(screen.getByLabelText('Selected performer')).toHaveTextContent('Side 2: 3.0 steps Outside 50 yd ln')
    expect(screen.getByLabelText('Selected performer')).toHaveTextContent('7.0 steps In front of Back hash')
  })

  it('shows marching coordinates when T1 is selected', () => {
    render(<App />)
    const performer = screen.getByTestId('performer-t1')

    Object.defineProperty(performer, 'setPointerCapture', { value: () => undefined })
    fireEvent(performer, new MouseEvent('pointerdown', { bubbles: true, clientX: 0, clientY: 0 }))

    expect(performer).toHaveClass('performer-marker--selected')
    expect(screen.getByLabelText('Selected performer')).toHaveTextContent('T1')
    expect(screen.getByLabelText('Selected performer')).toHaveTextContent('On 50 yd ln')
  })

  it('places multiple performers with unique sequential labels', () => {
    render(<App />)
    const svg = screen.getByTestId('field-svg')

    Object.defineProperty(svg, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 1200, height: 533.3333333333334 }),
    })
    fireEvent.click(screen.getByRole('button', { name: 'Performer' }))
    fireEvent(svg, new MouseEvent('pointerdown', { bubbles: true, clientX: 200, clientY: 200 }))
    fireEvent(svg, new MouseEvent('pointerdown', { bubbles: true, clientX: 300, clientY: 300 }))

    expect(screen.getByTestId('performer-p1')).toHaveTextContent('P1')
    expect(screen.getByTestId('performer-p2')).toHaveTextContent('P2')
    expect(screen.getByLabelText('Selected performer')).toHaveTextContent('P2')
  })

  it('selects, drags, and deletes a newly created performer', () => {
    render(<App />)
    const svg = screen.getByTestId('field-svg')

    Object.defineProperty(svg, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 1200, height: 533.3333333333334 }),
    })
    fireEvent.click(screen.getByRole('button', { name: 'Performer' }))
    fireEvent(svg, new MouseEvent('pointerdown', { bubbles: true, clientX: 200, clientY: 200 }))

    const performer = screen.getByTestId('performer-p1')
    Object.defineProperty(performer, 'setPointerCapture', { value: () => undefined })
    Object.defineProperty(performer, 'hasPointerCapture', { value: () => true })
    fireEvent.click(screen.getByRole('button', { name: 'Select' }))
    fireEvent(performer, new MouseEvent('pointerdown', { bubbles: true, clientX: 200, clientY: 200 }))
    fireEvent(performer, new MouseEvent('pointermove', { bubbles: true, clientX: 250, clientY: 250 }))

    expect(performer.querySelector('circle')).toHaveAttribute('cx', '250')
    expect(screen.getByLabelText('Selected performer')).toHaveTextContent('P1')
    fireEvent.keyDown(window, { key: 'Delete' })

    expect(screen.queryByTestId('performer-p1')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Selected performer')).not.toBeInTheDocument()
  })

  it('supports shift-toggle selection, group dragging, clearing, and deletion', () => {
    render(<App />)
    const svg = screen.getByTestId('field-svg')

    Object.defineProperty(svg, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 1200, height: 533.3333333333334 }),
    })
    fireEvent.click(screen.getByRole('button', { name: 'Performer' }))
    fireEvent(svg, new MouseEvent('pointerdown', { bubbles: true, clientX: 200, clientY: 200 }))
    fireEvent(svg, new MouseEvent('pointerdown', { bubbles: true, clientX: 250, clientY: 250 }))
    fireEvent.click(screen.getByRole('button', { name: 'Select' }))

    const p1 = screen.getByTestId('performer-p1')
    const p2 = screen.getByTestId('performer-p2')
    for (const performer of [p1, p2]) {
      Object.defineProperty(performer, 'setPointerCapture', { value: () => undefined })
      Object.defineProperty(performer, 'hasPointerCapture', { value: () => true })
    }
    fireEvent(p1, new MouseEvent('pointerdown', { bubbles: true, clientX: 200, clientY: 200 }))
    fireEvent(p2, new MouseEvent('pointerdown', { bubbles: true, shiftKey: true, clientX: 250, clientY: 250 }))

    expect(screen.getByLabelText('Selected performers')).toHaveTextContent('2 performers selected')
    fireEvent(p1, new MouseEvent('pointermove', { bubbles: true, clientX: 300, clientY: 300 }))
    expect(Number(p2.querySelector('circle')?.getAttribute('cx')) - Number(p1.querySelector('circle')?.getAttribute('cx'))).toBe(50)

    fireEvent(p2, new MouseEvent('pointerdown', { bubbles: true, shiftKey: true, clientX: 350, clientY: 350 }))
    expect(screen.getByLabelText('Selected performer')).toHaveTextContent('P1')
    fireEvent(svg, new MouseEvent('pointerdown', { bubbles: true, clientX: 500, clientY: 100 }))
    expect(screen.queryByLabelText('Selected performer')).not.toBeInTheDocument()
    fireEvent(p1, new MouseEvent('pointerdown', { bubbles: true, clientX: 300, clientY: 300 }))
    fireEvent(p2, new MouseEvent('pointerdown', { bubbles: true, shiftKey: true, clientX: 350, clientY: 350 }))
    fireEvent.keyDown(window, { key: 'Backspace' })

    expect(screen.queryByTestId('performer-p1')).not.toBeInTheDocument()
    expect(screen.queryByTestId('performer-p2')).not.toBeInTheDocument()
  })

  it('handles single, toggle, collapse, and clear selection readouts', () => {
    render(<App />)
    const svg = screen.getByTestId('field-svg')

    Object.defineProperty(svg, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 1200, height: 533.3333333333334 }),
    })
    fireEvent.click(screen.getByRole('button', { name: 'Performer' }))
    fireEvent(svg, new MouseEvent('pointerdown', { bubbles: true, clientX: 200, clientY: 200 }))
    fireEvent(svg, new MouseEvent('pointerdown', { bubbles: true, clientX: 250, clientY: 250 }))
    fireEvent.click(screen.getByRole('button', { name: 'Select' }))

    const p1 = screen.getByTestId('performer-p1')
    const p2 = screen.getByTestId('performer-p2')
    for (const performer of [p1, p2]) {
      Object.defineProperty(performer, 'setPointerCapture', { value: () => undefined })
      Object.defineProperty(performer, 'releasePointerCapture', { value: () => undefined })
    }

    fireEvent(p1, new MouseEvent('pointerdown', { bubbles: true }))
    expect(screen.getByLabelText('Selected performer')).toHaveTextContent('P1')
    expect(p1).toHaveClass('performer-marker--selected')

    fireEvent(p2, new MouseEvent('pointerdown', { bubbles: true, shiftKey: true }))
    expect(screen.getByLabelText('Selected performers')).toHaveTextContent('2 performers selected')
    expect(p1).toHaveClass('performer-marker--selected')
    expect(p2).toHaveClass('performer-marker--selected')

    fireEvent(p2, new MouseEvent('pointerdown', { bubbles: true, shiftKey: true }))
    expect(screen.getByLabelText('Selected performer')).toHaveTextContent('P1')
    expect(p2).not.toHaveClass('performer-marker--selected')

    fireEvent(p2, new MouseEvent('pointerdown', { bubbles: true, shiftKey: true }))
    fireEvent(p2, new MouseEvent('pointerdown', { bubbles: true }))
    fireEvent(p2, new MouseEvent('pointerup', { bubbles: true }))
    expect(screen.getByLabelText('Selected performer')).toHaveTextContent('P2')
    expect(p1).not.toHaveClass('performer-marker--selected')

    fireEvent(svg, new MouseEvent('pointerdown', { bubbles: true, clientX: 500, clientY: 100 }))
    expect(screen.queryByLabelText('Selected performer')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Selected performers')).not.toBeInTheDocument()
  })

  it('preserves selected-group membership and spacing through a snapped drag', () => {
    render(<App />)
    const svg = screen.getByTestId('field-svg')

    Object.defineProperty(svg, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 1200, height: 533.3333333333334 }),
    })
    fireEvent.click(screen.getByRole('button', { name: 'Performer' }))
    fireEvent(svg, new MouseEvent('pointerdown', { bubbles: true, clientX: 200, clientY: 200 }))
    fireEvent(svg, new MouseEvent('pointerdown', { bubbles: true, clientX: 250, clientY: 250 }))
    fireEvent.click(screen.getByRole('button', { name: 'Select' }))

    const p1 = screen.getByTestId('performer-p1')
    const p2 = screen.getByTestId('performer-p2')
    Object.defineProperty(p1, 'setPointerCapture', { value: () => undefined })
    Object.defineProperty(p1, 'hasPointerCapture', { value: () => true })
    Object.defineProperty(p2, 'setPointerCapture', { value: () => undefined })
    fireEvent(p1, new MouseEvent('pointerdown', { bubbles: true }))
    fireEvent(p2, new MouseEvent('pointerdown', { bubbles: true, shiftKey: true }))
    fireEvent(p1, new MouseEvent('pointerdown', { bubbles: true, clientX: 200, clientY: 200 }))
    fireEvent(p1, new MouseEvent('pointermove', { bubbles: true, clientX: 303, clientY: 255 }))

    const p1Circle = p1.querySelector('circle')
    const p2Circle = p2.querySelector('circle')
    expect(screen.getByLabelText('Selected performers')).toHaveTextContent('2 performers selected')
    expect(p1Circle).toHaveAttribute('cx', '300')
    expect(Number(p2Circle?.getAttribute('cx')) - Number(p1Circle?.getAttribute('cx'))).toBe(50)
    expect(Number(p2Circle?.getAttribute('cy')) - Number(p1Circle?.getAttribute('cy'))).toBeCloseTo(50)
  })

  it('treats unselected and editable-target deletion as no-ops', () => {
    render(<App />)

    fireEvent.keyDown(window, { key: 'Delete' })
    expect(screen.getByTestId('performer-t1')).toBeInTheDocument()

    const performer = screen.getByTestId('performer-t1')
    Object.defineProperty(performer, 'setPointerCapture', { value: () => undefined })
    fireEvent(performer, new MouseEvent('pointerdown', { bubbles: true }))

    const input = document.createElement('input')
    document.body.append(input)
    input.focus()
    fireEvent.keyDown(input, { key: 'Backspace' })
    expect(screen.getByTestId('performer-t1')).toBeInTheDocument()
    input.remove()
  })
})