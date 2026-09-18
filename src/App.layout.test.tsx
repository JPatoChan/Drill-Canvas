import { fireEvent, render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import App from './App'

describe('editor overflow layout', () => {
  it('contains 300% field zoom within the field viewport without changing positions', () => {
    render(<App />)
    const viewport = screen.getByTestId('field-viewport')
    const svg = screen.getByTestId('field-svg')
    const circle = screen.getByTestId('performer-t1').querySelector('circle')
    const initialPosition = [circle?.getAttribute('cx'), circle?.getAttribute('cy')]

    for (let step = 0; step < 8; step += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
    }

    expect(screen.getByLabelText('Current zoom')).toHaveTextContent('300%')
    expect(svg).toHaveStyle({ width: '300%' })
    expect(circle).toHaveAttribute('cx', initialPosition[0])
    expect(circle).toHaveAttribute('cy', initialPosition[1])
    expect(viewport).toHaveClass('field-canvas__viewport')
    expect(screen.getByRole('region', { name: 'Timeline and drill sets' })).toHaveClass('timeline')
    expect(document.querySelector('.app-shell')).toBeInTheDocument()

    for (let step = 0; step < 10; step += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }))
    }
    expect(screen.getByLabelText('Current zoom')).toHaveTextContent('50%')
    expect(circle).toHaveAttribute('cx', initialPosition[0])
    expect(circle).toHaveAttribute('cy', initialPosition[1])
  })

  it('keeps placement and dragging accurate in a locally scrolled zoom viewport', () => {
    render(<App />)
    const viewport = screen.getByTestId('field-viewport')
    const svg = screen.getByTestId('field-svg')

    viewport.scrollLeft = 400
    viewport.scrollTop = 200
    Object.defineProperty(svg, 'getBoundingClientRect', {
      value: () => ({ left: -400, top: -200, width: 2400, height: 1066.6666666666667 }),
    })
    for (let step = 0; step < 4; step += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
    }

    fireEvent.click(screen.getByRole('button', { name: 'Performer' }))
    fireEvent(svg, new MouseEvent('pointerdown', { bubbles: true, clientX: 800, clientY: 200 }))
    expect(screen.getByTestId('performer-p1').querySelector('circle')).toHaveAttribute('cx', '600')

    fireEvent.click(screen.getByRole('button', { name: 'Select' }))
    const performer = screen.getByTestId('performer-t1')
    Object.defineProperty(performer, 'setPointerCapture', { value: () => undefined })
    Object.defineProperty(performer, 'hasPointerCapture', { value: () => true })
    Object.defineProperty(performer, 'releasePointerCapture', { value: () => undefined })
    fireEvent(performer, new MouseEvent('pointerdown', { bubbles: true }))
    fireEvent(performer, new MouseEvent('pointermove', { bubbles: true, clientX: 1000, clientY: 325 }))
    fireEvent(performer, new MouseEvent('pointerup', { bubbles: true }))
    expect(performer.querySelector('circle')).toHaveAttribute('cx', '700')
  })

  it('keeps 20+ fixed-width set cards in a dedicated horizontal scroller', () => {
    render(<App />)

    for (let set = 2; set <= 21; set += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'Add set' }))
    }

    const scroller = screen.getByTestId('set-track-scroller')
    expect(screen.getAllByRole('listitem')).toHaveLength(21)
    expect(screen.getByRole('button', { name: 'Set 21' })).toBeInTheDocument()
    expect(scroller).toHaveClass('set-track__scroller')
    expect(screen.getByTestId('drill-set-set-21')).toHaveClass('set-card')
  })

  it('scrolls newly added and activated off-screen set cards into view', () => {
    const scrollIntoView = vi.fn()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    })
    render(<App />)
    scrollIntoView.mockClear()

    for (let set = 2; set <= 12; set += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'Add set' }))
    }

    const set12 = screen.getByTestId('drill-set-set-12')
    expect(scrollIntoView.mock.contexts.at(-1)).toBe(set12)

    scrollIntoView.mockClear()
    fireEvent.click(screen.getByRole('button', { name: 'Set 1' }))
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest' })
    expect(scrollIntoView.mock.contexts.at(-1)).toBe(screen.getByTestId('drill-set-set-1'))

    Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView')
  })

  it('keeps a large performer inventory locally scrollable', () => {
    render(<App />)
    const svg = screen.getByTestId('field-svg')

    Object.defineProperty(svg, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 1200, height: 533.3333333333334 }),
    })
    fireEvent.click(screen.getByRole('button', { name: 'Performer' }))
    for (let index = 0; index < 24; index += 1) {
      fireEvent(svg, new MouseEvent('pointerdown', {
        bubbles: true,
        clientX: 100 + (index % 12) * 50,
        clientY: 50 + Math.floor(index / 12) * 100,
      }))
    }

    const inventory = screen.getByLabelText('Performer inventory')
    expect(screen.getAllByTestId(/^inventory-/)).toHaveLength(25)
    expect(inventory).toHaveClass('performer-inventory')
  })
})