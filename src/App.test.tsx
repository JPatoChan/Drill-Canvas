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
})