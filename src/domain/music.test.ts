import { zipSync, strToU8 } from 'fflate'
import {
  getActiveTempoBpm,
  getBeatForElapsedMilliseconds,
  getCountForElapsedMilliseconds,
  getElapsedMillisecondsForBeatRange,
  getElapsedMillisecondsForCounts,
  getMeasurePositionForBeat,
  parseMsczArchive,
  parseMscxText,
  parseMuseScoreFile,
} from './music'

const fixtureMscx = `<?xml version="1.0" encoding="UTF-8"?>
<museScore version="4.20">
  <Score>
    <metaTag name="workTitle">Test Fanfare</metaTag>
    <Staff id="1">
      <Measure>
        <voice>
          <TimeSig>
            <sigN>4</sigN>
            <sigD>4</sigD>
          </TimeSig>
          <Tempo>
            <tempo>2</tempo>
          </Tempo>
          <Chord>
            <durationType>quarter</durationType>
            <Note>
              <pitch>60</pitch>
            </Note>
          </Chord>
          <Rest>
            <durationType>quarter</durationType>
          </Rest>
          <Chord>
            <durationType>half</durationType>
            <Note>
              <pitch>62</pitch>
            </Note>
          </Chord>
        </voice>
      </Measure>
      <Measure>
        <voice>
          <Tempo>
            <tempo>3</tempo>
          </Tempo>
          <Chord>
            <durationType>quarter</durationType>
            <Note>
              <pitch>64</pitch>
              <Tie/>
            </Note>
          </Chord>
          <Chord>
            <durationType>quarter</durationType>
            <Note>
              <pitch>64</pitch>
            </Note>
          </Chord>
          <Rest>
            <durationType>half</durationType>
          </Rest>
        </voice>
      </Measure>
    </Staff>
  </Score>
</museScore>`

describe('parseMscxText', () => {
  it('parses title, time signatures, tempo map, measures, notes, and rests', () => {
    const score = parseMscxText(fixtureMscx)

    expect(score.title).toBe('Test Fanfare')
    expect(score.timeSignatures).toEqual([{ beat: 0, numerator: 4, denominator: 4 }])
    expect(score.tempoMap).toEqual([
      { beat: 0, bpm: 120 },
      { beat: 4, bpm: 180 },
    ])
    expect(score.measures).toEqual([
      { index: 0, startBeat: 0, beatsInMeasure: 4 },
      { index: 1, startBeat: 4, beatsInMeasure: 4 },
    ])
    expect(score.totalBeats).toBe(8)
  })

  it('merges tied notes of the same pitch into a single sustained event', () => {
    const score = parseMscxText(fixtureMscx)
    const notes = score.events.filter((event) => event.type === 'note')

    expect(notes).toEqual([
      { type: 'note', startBeat: 0, durationBeats: 1, midiPitch: 60 },
      { type: 'note', startBeat: 2, durationBeats: 2, midiPitch: 62 },
      { type: 'note', startBeat: 4, durationBeats: 2, midiPitch: 64 },
    ])
  })

  it('parses rests with correct start and duration', () => {
    const score = parseMscxText(fixtureMscx)
    const rests = score.events.filter((event) => event.type === 'rest')

    expect(rests).toEqual([
      { type: 'rest', startBeat: 1, durationBeats: 1, midiPitch: null },
      { type: 'rest', startBeat: 6, durationBeats: 2, midiPitch: null },
    ])
  })

  it('throws a clear error for malformed MuseScore XML', () => {
    expect(() => parseMscxText('<museScore><Score>')).toThrow()
  })

  it('throws a clear error when no staff data is present', () => {
    expect(() => parseMscxText('<museScore><Score></Score></museScore>'))
      .toThrow('No musical staff was found')
  })

  it('falls back to sensible defaults when tempo/time signature are absent', () => {
    const score = parseMscxText(`<museScore><Score><Staff id="1"><Measure><voice>
      <Chord><durationType>quarter</durationType><Note><pitch>60</pitch></Note></Chord>
    </voice></Measure></Staff></Score></museScore>`)

    expect(score.tempoMap).toEqual([{ beat: 0, bpm: 120 }])
    expect(score.timeSignatures).toEqual([{ beat: 0, numerator: 4, denominator: 4 }])
  })
})

describe('parseMsczArchive', () => {
  it('extracts and parses the mscx score contained within the archive', () => {
    const archive = zipSync({ 'Test Fanfare.mscx': strToU8(fixtureMscx) })
    const score = parseMsczArchive(archive.buffer as ArrayBuffer)

    expect(score.title).toBe('Test Fanfare')
    expect(score.totalBeats).toBe(8)
  })

  it('throws a clear error when the archive contains no mscx score', () => {
    const archive = zipSync({ 'readme.txt': strToU8('not a score') })

    expect(() => parseMsczArchive(archive.buffer as ArrayBuffer))
      .toThrow('No MuseScore score (.mscx) was found')
  })

  it('throws a clear error for a corrupt/invalid zip archive', () => {
    const garbage = new Uint8Array([1, 2, 3, 4, 5])

    expect(() => parseMsczArchive(garbage.buffer as ArrayBuffer))
      .toThrow('not a valid compressed archive')
  })
})

describe('parseMuseScoreFile', () => {
  it('parses a .mscx file', async () => {
    const file = { name: 'song.mscx', text: () => Promise.resolve(fixtureMscx) } as unknown as File
    const score = await parseMuseScoreFile(file)
    expect(score.title).toBe('Test Fanfare')
  })

  it('parses a .mscz file', async () => {
    const archive = zipSync({ 'song.mscx': strToU8(fixtureMscx) })
    const file = {
      name: 'song.mscz',
      arrayBuffer: () => Promise.resolve(archive.buffer as ArrayBuffer),
    } as unknown as File
    const score = await parseMuseScoreFile(file)
    expect(score.title).toBe('Test Fanfare')
  })

  it('rejects unsupported file types', async () => {
    const file = { name: 'song.txt', text: () => Promise.resolve('hello') } as unknown as File
    await expect(parseMuseScoreFile(file)).rejects.toThrow('Unsupported file type')
  })
})

describe('tempo-aware clock math', () => {
  const score = parseMscxText(fixtureMscx)

  it('integrates the tempo map across a tempo change', () => {
    expect(getElapsedMillisecondsForBeatRange(score.tempoMap, 0, 4)).toBeCloseTo(2000)
    expect(getElapsedMillisecondsForBeatRange(score.tempoMap, 4, 8)).toBeCloseTo(1333.33, 1)
    expect(getElapsedMillisecondsForBeatRange(score.tempoMap, 0, 8)).toBeCloseTo(3333.33, 1)
  })

  it('inverts elapsed time back into a beat position across a tempo change', () => {
    expect(getBeatForElapsedMilliseconds(score.tempoMap, 0, 2000)).toBeCloseTo(4)
    expect(getBeatForElapsedMilliseconds(score.tempoMap, 0, 2000 + 666.67)).toBeCloseTo(6, 1)
  })

  it('locates the measure/beat position for a given beat', () => {
    expect(getMeasurePositionForBeat(score.measures, 0)).toEqual({ measureNumber: 1, beatInMeasure: 1 })
    expect(getMeasurePositionForBeat(score.measures, 5)).toEqual({ measureNumber: 2, beatInMeasure: 2 })
  })

  it('falls back to a constant manual tempo when no score is attached', () => {
    expect(getElapsedMillisecondsForCounts(null, 120, 0, 4)).toBeCloseTo(2000)
    expect(getCountForElapsedMilliseconds(null, 120, 0, 2000)).toBeCloseTo(4)
    expect(getActiveTempoBpm(null, 150, 0)).toBe(150)
  })

  it('derives elapsed time and tempo from the score when attached', () => {
    expect(getElapsedMillisecondsForCounts(score, 120, 0, 4)).toBeCloseTo(2000)
    expect(getActiveTempoBpm(score, 120, 5)).toBe(180)
  })
})
