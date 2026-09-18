import { fireEvent, render, screen } from '@testing-library/react'
import App from './App'

const renderEditor = () => {
  render(<App />)
  const svg = screen.getByTestId('field-svg')

  Object.defineProperty(svg, 'getBoundingClientRect', {
    value: () => ({ left: 0, top: 0, width: 1200, height: 533.3333333333334 }),
  })

  return svg
}

const placePerformer = (svg: HTMLElement, x: number, y: number) => {
  fireEvent.click(screen.getByRole('button', { name: 'Performer' }))
  fireEvent(svg, new MouseEvent('pointerdown', { bubbles: true, clientX: x, clientY: y }))
}

const prepareDrag = (performer: HTMLElement) => {
  Object.defineProperty(performer, 'setPointerCapture', { value: () => undefined })
  Object.defineProperty(performer, 'hasPointerCapture', { value: () => true })
  Object.defineProperty(performer, 'releasePointerCapture', { value: () => undefined })
}

const dragPerformer = (performer: HTMLElement, x: number, y: number) => {
  fireEvent(performer, new MouseEvent('pointerdown', { bubbles: true }))
  fireEvent(performer, new MouseEvent('pointermove', { bubbles: true, clientX: x, clientY: y }))
  fireEvent(performer, new MouseEvent('pointerup', { bubbles: true }))
}

describe('editor history', () => {
  it('undoes and redoes performer placement', () => {
    const svg = renderEditor()
    placePerformer(svg, 200, 200)

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(screen.queryByTestId('performer-p1')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Redo' })).toBeEnabled()

    fireEvent.click(screen.getByRole('button', { name: 'Redo' }))
    expect(screen.getByTestId('performer-p1')).toBeInTheDocument()
  })

  it('undoes performer deletion', () => {
    renderEditor()
    const performer = screen.getByTestId('performer-t1')
    prepareDrag(performer)
    fireEvent(performer, new MouseEvent('pointerdown', { bubbles: true }))
    fireEvent.keyDown(window, { key: 'Delete' })
    expect(screen.queryByTestId('performer-t1')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(screen.getByTestId('performer-t1')).toBeInTheDocument()
  })

  it('records an individual drag as one history action', () => {
    renderEditor()
    const performer = screen.getByTestId('performer-t1')
    const originalX = performer.querySelector('circle')?.getAttribute('cx')
    prepareDrag(performer)

    fireEvent(performer, new MouseEvent('pointerdown', { bubbles: true }))
    fireEvent(performer, new MouseEvent('pointermove', { bubbles: true, clientX: 650, clientY: 262.5 }))
    fireEvent(performer, new MouseEvent('pointermove', { bubbles: true, clientX: 700, clientY: 262.5 }))
    fireEvent(performer, new MouseEvent('pointerup', { bubbles: true }))
    expect(performer.querySelector('circle')).toHaveAttribute('cx', '700')

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(performer.querySelector('circle')).toHaveAttribute('cx', originalX)
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Redo' }))
    expect(performer.querySelector('circle')).toHaveAttribute('cx', '700')
  })

  it('records a selected group drag as one history action', () => {
    const svg = renderEditor()
    placePerformer(svg, 200, 200)
    fireEvent.click(screen.getByRole('button', { name: 'Select' }))
    fireEvent.click(screen.getByTestId('inventory-t1'))
    fireEvent.click(screen.getByTestId('inventory-p1'), { shiftKey: true })

    const t1 = screen.getByTestId('performer-t1')
    const p1 = screen.getByTestId('performer-p1')
    const original = [t1, p1].map((performer) => performer.querySelector('circle')?.getAttribute('cx'))
    prepareDrag(t1)
    dragPerformer(t1, 700, 362.5)

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(t1.querySelector('circle')).toHaveAttribute('cx', original[0])
    expect(p1.querySelector('circle')).toHaveAttribute('cx', original[1])
  })

  it('undoes duplication and formation changes', () => {
    const svg = renderEditor()
    placePerformer(svg, 200, 200)
    fireEvent.click(screen.getByRole('button', { name: 'Select' }))
    fireEvent.click(screen.getByTestId('inventory-t1'))
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate' }))
    expect(screen.getByTestId('performer-p2')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(screen.queryByTestId('performer-p2')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('inventory-t1'))
    fireEvent.click(screen.getByTestId('inventory-p1'), { shiftKey: true })
    const originalP1X = screen.getByTestId('performer-p1').querySelector('circle')?.getAttribute('cx')
    fireEvent.click(screen.getByRole('button', { name: 'Align vertical' }))
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(screen.getByTestId('performer-p1').querySelector('circle')).toHaveAttribute('cx', originalP1X)
  })

  it('undoes metadata edits', () => {
    renderEditor()
    fireEvent.change(screen.getByLabelText('Label for T1'), { target: { value: 'Lead' } })
    expect(screen.getByTestId('performer-t1')).toHaveTextContent('Lead')

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(screen.getByTestId('performer-t1')).toHaveTextContent('T1')
  })

  it('undoes set creation and transition count edits', () => {
    renderEditor()
    fireEvent.click(screen.getByRole('button', { name: 'Add set' }))
    fireEvent.change(screen.getByLabelText('Counts for Set 2'), { target: { value: '24' } })

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(screen.getByLabelText('Counts for Set 2')).toHaveValue(16)
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(screen.queryByRole('button', { name: 'Set 2' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Set 1' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('clears redo after a new edit', () => {
    const svg = renderEditor()
    placePerformer(svg, 200, 200)
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(screen.getByRole('button', { name: 'Redo' })).toBeEnabled()

    placePerformer(svg, 300, 300)
    expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled()
  })

  it('supports Undo and Redo keyboard shortcuts', () => {
    const svg = renderEditor()
    placePerformer(svg, 200, 200)
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true })
    expect(screen.queryByTestId('performer-p1')).not.toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true, shiftKey: true })
    expect(screen.getByTestId('performer-p1')).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'z', metaKey: true })
    expect(screen.queryByTestId('performer-p1')).not.toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'y', ctrlKey: true })
    expect(screen.getByTestId('performer-p1')).toBeInTheDocument()
  })

  it('leaves native text history shortcuts alone in editable controls', () => {
    renderEditor()
    const input = screen.getByLabelText('Label for T1')
    fireEvent.change(input, { target: { value: 'Lead' } })
    input.focus()
    fireEvent.keyDown(input, { key: 'z', ctrlKey: true })

    expect(input).toHaveValue('Lead')
    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled()
  })

  it('disables history and records no transient playback state', () => {
    renderEditor()
    fireEvent.click(screen.getByRole('button', { name: 'Add set' }))
    fireEvent.click(screen.getByRole('button', { name: 'Play transition' }))

    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled()
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true })
    expect(screen.getByRole('button', { name: 'Set 2' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Stop' }))
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(screen.queryByRole('button', { name: 'Set 2' })).not.toBeInTheDocument()
  })
})