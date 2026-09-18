import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import App from './App'

const fixtureMscx = `<museScore><Score>
  <metaTag name="workTitle">Camptown Races</metaTag>
  <Staff id="1">
    <Measure>
      <voice>
        <TimeSig><sigN>4</sigN><sigD>4</sigD></TimeSig>
        <Tempo><tempo>2</tempo></Tempo>
        <Chord><durationType>quarter</durationType><Note><pitch>60</pitch></Note></Chord>
        <Chord><durationType>quarter</durationType><Note><pitch>62</pitch></Note></Chord>
        <Chord><durationType>quarter</durationType><Note><pitch>64</pitch></Note></Chord>
        <Rest><durationType>quarter</durationType></Rest>
      </voice>
    </Measure>
  </Staff>
</Score></museScore>`

// jsdom's File does not implement Blob.text()/arrayBuffer(), so tests use duck-typed mocks
// (matching the existing convention for project-file import tests in this repo).
const mockMscxFile = (name: string, text: string) => ({ name, text: () => Promise.resolve(text) }) as unknown as File

const importMusicFile = async (file: File) => {
  fireEvent.change(screen.getByLabelText('Import music file'), { target: { files: [file] } })
  await waitFor(() => expect(screen.queryByTestId('music-title')).toBeInTheDocument())
}

describe('MuseScore music import', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('imports a .mscx file and shows the score title and tempo', async () => {
    render(<App />)
    await importMusicFile(mockMscxFile('camptown.mscx', fixtureMscx))

    expect(screen.getByTestId('music-title')).toHaveTextContent('Camptown Races')
    expect(screen.getByLabelText('Music tempo')).toHaveTextContent('120 BPM')
    expect(screen.getByRole('button', { name: 'Remove Music' })).toBeInTheDocument()
    expect(screen.queryByText('No music imported')).not.toBeInTheDocument()
  })

  it('disables the manual tempo control once a score is loaded', async () => {
    render(<App />)
    expect(screen.getByLabelText('Playback tempo')).toBeEnabled()

    await importMusicFile(mockMscxFile('camptown.mscx', fixtureMscx))
    expect(screen.getByLabelText('Playback tempo')).toBeDisabled()
  })

  it('creates an undo boundary for importing music', async () => {
    render(<App />)
    await importMusicFile(mockMscxFile('camptown.mscx', fixtureMscx))

    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(screen.queryByTestId('music-title')).not.toBeInTheDocument()
    expect(screen.getByText('No music imported')).toBeInTheDocument()
  })

  it('removes imported music and creates an undo boundary', async () => {
    render(<App />)
    await importMusicFile(mockMscxFile('camptown.mscx', fixtureMscx))

    fireEvent.click(screen.getByRole('button', { name: 'Remove Music' }))
    expect(screen.getByText('No music imported')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(screen.getByTestId('music-title')).toHaveTextContent('Camptown Races')
  })

  it('shows a clear error for an invalid .mscx file without crashing', async () => {
    render(<App />)
    fireEvent.change(screen.getByLabelText('Import music file'), {
      target: { files: [mockMscxFile('bad.mscx', '<museScore><Score></Score></museScore>')] },
    })

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('No musical staff was found'))
    expect(screen.getByText('No music imported')).toBeInTheDocument()
    expect(screen.getByTestId('performer-t1')).toBeInTheDocument()
  })

  it('shows a clear error for an invalid .mscz file without crashing', async () => {
    render(<App />)
    const badArchive = { name: 'bad.mscz', arrayBuffer: () => Promise.resolve(new Uint8Array([1, 2, 3]).buffer) } as unknown as File
    fireEvent.change(screen.getByLabelText('Import music file'), { target: { files: [badArchive] } })

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.getByText('No music imported')).toBeInTheDocument()
  })

  it('drives production playback tempo and measure/beat position from the imported score', async () => {
    render(<App />)
    await importMusicFile(mockMscxFile('camptown.mscx', fixtureMscx))
    fireEvent.click(screen.getByRole('button', { name: 'Add set' }))

    vi.useFakeTimers()
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
      window.setTimeout(() => callback(performance.now()), 16))
    vi.stubGlobal('cancelAnimationFrame', (handle: number) => window.clearTimeout(handle))

    fireEvent.click(screen.getByRole('button', { name: 'Play from start' }))
    act(() => vi.advanceTimersByTime(1016))
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }))
    expect(Number(screen.getByLabelText('Production count').getAttribute('value'))).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: 'Restart' }))
    expect(screen.getByLabelText('Production count')).toHaveValue('0')
    expect(screen.getByLabelText('Music position')).toHaveTextContent('Measure 1, beat 1.0')

    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('updates the music position display when scrubbing the production timeline', async () => {
    render(<App />)
    await importMusicFile(mockMscxFile('camptown.mscx', fixtureMscx))
    fireEvent.click(screen.getByRole('button', { name: 'Add set' }))
    fireEvent.change(screen.getByLabelText('Counts for Set 2'), { target: { value: '16' } })
    fireEvent.click(screen.getByRole('button', { name: 'Play from start' }))
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }))

    fireEvent.change(screen.getByLabelText('Production count'), { target: { value: '2' } })
    expect(screen.getByLabelText('Music position')).toHaveTextContent('Measure 1, beat 3.0')
  })

  it('persists imported music in local autosave and restores it on reload', async () => {
    const { unmount } = render(<App />)
    await importMusicFile(mockMscxFile('camptown.mscx', fixtureMscx))
    await waitFor(() => expect(localStorage.getItem('drillcanvas.project.v1')).toContain('Camptown Races'))
    unmount()

    render(<App />)
    expect(screen.getByTestId('music-title')).toHaveTextContent('Camptown Races')
  })
})
