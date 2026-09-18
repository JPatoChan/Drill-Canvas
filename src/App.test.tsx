import { fireEvent, render, screen } from '@testing-library/react'
import App from './App'

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