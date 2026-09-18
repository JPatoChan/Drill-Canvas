import { unzipSync } from 'fflate'

// Normalized DrillCanvas music model, independent of MuseScore's XML structure.
// Beat 0 is the start of the score; one beat equals one quarter note.

export type MusicTempoEvent = {
  beat: number
  bpm: number
}

export type MusicTimeSignature = {
  beat: number
  numerator: number
  denominator: number
}

export type MusicMeasure = {
  index: number
  startBeat: number
  beatsInMeasure: number
}

export type MusicEventType = 'note' | 'rest'

export type MusicEvent = {
  type: MusicEventType
  startBeat: number
  durationBeats: number
  // MIDI pitch (0-127). Rests have no pitch.
  midiPitch: number | null
}

export type MusicScore = {
  title: string
  tempoMap: MusicTempoEvent[]
  timeSignatures: MusicTimeSignature[]
  measures: MusicMeasure[]
  events: MusicEvent[]
  totalBeats: number
}

const durationTypeToBeats: Record<string, number> = {
  whole: 4,
  half: 2,
  quarter: 1,
  eighth: 0.5,
  '16th': 0.25,
  '32nd': 0.125,
  '64th': 0.0625,
  '128th': 0.03125,
}

const getElementText = (element: Element, tagName: string): string | undefined =>
  element.getElementsByTagName(tagName)[0]?.textContent?.trim()

const getDurationBeats = (element: Element): number => {
  const durationType = getElementText(element, 'durationType') ?? 'quarter'
  const baseBeats = durationTypeToBeats[durationType] ?? 1
  const dots = Number(getElementText(element, 'dots') ?? 0)
  return dots > 0 ? baseBeats * (2 - 1 / 2 ** dots) : baseBeats
}

const hasTieStart = (noteElement: Element): boolean =>
  Array.from(noteElement.getElementsByTagName('Tie')).length > 0
  || Array.from(noteElement.getElementsByTagName('Spanner'))
    .some((spanner) => spanner.getAttribute('type') === 'Tie')

const extractTitle = (doc: Document): string => {
  const metaTags = Array.from(doc.getElementsByTagName('metaTag'))
  const workTitle = metaTags.find((tag) => tag.getAttribute('name') === 'workTitle')?.textContent?.trim()
  if (workTitle) {
    return workTitle
  }

  const titleText = Array.from(doc.getElementsByTagName('Text')).find((textElement) => {
    const style = getElementText(textElement, 'style')
    return style === 'Title'
  })

  return getElementText(titleText ?? doc.documentElement, 'text') ?? ''
}

export class MusicParseError extends Error {}

/**
 * Parses raw MuseScore `.mscx` XML text into the normalized DrillCanvas music model.
 * Unsupported engraving/layout data is ignored.
 */
export const parseMscxText = (xmlText: string): MusicScore => {
  let doc: Document

  try {
    doc = new DOMParser().parseFromString(xmlText, 'application/xml')
  } catch {
    throw new MusicParseError('Unable to parse the MuseScore XML data.')
  }

  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new MusicParseError('The MuseScore file contains malformed XML.')
  }

  const staff = doc.getElementsByTagName('Staff')[0]
  if (!staff) {
    throw new MusicParseError('No musical staff was found in the MuseScore file.')
  }

  const title = extractTitle(doc)
  const tempoMap: MusicTempoEvent[] = []
  const timeSignatures: MusicTimeSignature[] = []
  const measures: MusicMeasure[] = []
  const events: MusicEvent[] = []
  const tiedPitches = new Map<number, number>() // midiPitch -> event index awaiting tie continuation

  let currentBeat = 0
  let currentBeatsPerMeasure = 4

  for (const measureElement of Array.from(staff.getElementsByTagName('Measure'))) {
    const measureStartBeat = currentBeat
    const voice = measureElement.getElementsByTagName('voice')[0] ?? measureElement

    for (const child of Array.from(voice.children)) {
      if (child.tagName === 'TimeSig') {
        const numerator = Number(getElementText(child, 'sigN') ?? 4)
        const denominator = Number(getElementText(child, 'sigD') ?? 4)
        timeSignatures.push({ beat: currentBeat, numerator, denominator })
        currentBeatsPerMeasure = numerator * (4 / denominator)
        continue
      }

      if (child.tagName === 'Tempo') {
        const quarterNotesPerSecond = Number(getElementText(child, 'tempo') ?? 2)
        tempoMap.push({ beat: currentBeat, bpm: quarterNotesPerSecond * 60 })
        continue
      }

      if (child.tagName === 'Chord') {
        const durationBeats = getDurationBeats(child)
        const notes = Array.from(child.getElementsByTagName('Note'))

        for (const noteElement of notes) {
          const midiPitch = Number(getElementText(noteElement, 'pitch') ?? Number.NaN)
          if (!Number.isFinite(midiPitch)) {
            continue
          }

          const continuedEventIndex = tiedPitches.get(midiPitch)
          if (continuedEventIndex !== undefined) {
            events[continuedEventIndex].durationBeats += durationBeats
            tiedPitches.delete(midiPitch)
            if (hasTieStart(noteElement)) {
              tiedPitches.set(midiPitch, continuedEventIndex)
            }
            continue
          }

          events.push({ type: 'note', startBeat: currentBeat, durationBeats, midiPitch })
          if (hasTieStart(noteElement)) {
            tiedPitches.set(midiPitch, events.length - 1)
          }
        }

        currentBeat += durationBeats
        continue
      }

      if (child.tagName === 'Rest') {
        const durationBeats = getDurationBeats(child)
        events.push({ type: 'rest', startBeat: currentBeat, durationBeats, midiPitch: null })
        currentBeat += durationBeats
      }
    }

    measures.push({
      index: measures.length,
      startBeat: measureStartBeat,
      beatsInMeasure: currentBeatsPerMeasure,
    })
  }

  if (tempoMap.length === 0) {
    tempoMap.push({ beat: 0, bpm: 120 })
  }
  if (timeSignatures.length === 0) {
    timeSignatures.push({ beat: 0, numerator: 4, denominator: 4 })
  }

  return {
    title,
    tempoMap: tempoMap.sort((a, b) => a.beat - b.beat),
    timeSignatures: timeSignatures.sort((a, b) => a.beat - b.beat),
    measures,
    events,
    totalBeats: currentBeat,
  }
}

const findMscxEntry = (files: Record<string, Uint8Array>): [string, Uint8Array] | undefined =>
  Object.entries(files).find(([name]) => name.toLowerCase().endsWith('.mscx'))

/** Extracts and parses the `.mscx` score contained within a MuseScore `.mscz` archive. */
export const parseMsczArchive = (archiveBuffer: ArrayBuffer): MusicScore => {
  let files: Record<string, Uint8Array>

  try {
    files = unzipSync(new Uint8Array(archiveBuffer))
  } catch {
    throw new MusicParseError('The selected .mscz file is not a valid compressed archive.')
  }

  const entry = findMscxEntry(files)
  if (!entry) {
    throw new MusicParseError('No MuseScore score (.mscx) was found inside the .mscz file.')
  }

  const xmlText = new TextDecoder('utf-8').decode(entry[1])
  return parseMscxText(xmlText)
}

/** Parses a MuseScore file (`.mscx` or `.mscz`) selected by the user into the normalized music model. */
export const parseMuseScoreFile = async (file: File): Promise<MusicScore> => {
  const name = file.name.toLowerCase()

  if (name.endsWith('.mscx')) {
    return parseMscxText(await file.text())
  }

  if (name.endsWith('.mscz')) {
    return parseMsczArchive(await file.arrayBuffer())
  }

  throw new MusicParseError('Unsupported file type. Choose a .mscx or .mscz MuseScore file.')
}

// --- Tempo-aware clock math -------------------------------------------------

const getActiveTempo = (tempoMap: readonly MusicTempoEvent[], beat: number): MusicTempoEvent => {
  let active = tempoMap[0]
  for (const event of tempoMap) {
    if (event.beat <= beat) {
      active = event
    } else {
      break
    }
  }
  return active ?? { beat: 0, bpm: 120 }
}

export const getMillisecondsPerBeatAt = (tempoMap: readonly MusicTempoEvent[], beat: number): number =>
  60_000 / getActiveTempo(tempoMap, beat).bpm

/** Integrates the tempo map to find the real elapsed time (ms) between two beat positions. */
export const getElapsedMillisecondsForBeatRange = (
  tempoMap: readonly MusicTempoEvent[],
  fromBeat: number,
  toBeat: number,
): number => {
  if (toBeat <= fromBeat) {
    return 0
  }

  const sortedTempoMap = [...tempoMap].sort((a, b) => a.beat - b.beat)
  const boundaries = [...new Set([
    fromBeat,
    toBeat,
    ...sortedTempoMap.map(({ beat }) => beat).filter((beat) => beat > fromBeat && beat < toBeat),
  ])].sort((a, b) => a - b)

  let elapsedMilliseconds = 0
  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const segmentStart = boundaries[index]
    const segmentEnd = boundaries[index + 1]
    elapsedMilliseconds += (segmentEnd - segmentStart) * getMillisecondsPerBeatAt(sortedTempoMap, segmentStart)
  }

  return elapsedMilliseconds
}

/** Inverts the tempo map to find the beat position reached after elapsing a given time (ms). */
export const getBeatForElapsedMilliseconds = (
  tempoMap: readonly MusicTempoEvent[],
  fromBeat: number,
  elapsedMilliseconds: number,
): number => {
  if (elapsedMilliseconds <= 0) {
    return fromBeat
  }

  const sortedTempoMap = [...tempoMap].sort((a, b) => a.beat - b.beat)
  const changePoints = sortedTempoMap.map(({ beat }) => beat).filter((beat) => beat > fromBeat)

  let currentBeat = fromBeat
  let remainingMilliseconds = elapsedMilliseconds

  for (const changeBeat of [...changePoints, Number.POSITIVE_INFINITY]) {
    const millisecondsPerBeat = getMillisecondsPerBeatAt(sortedTempoMap, currentBeat)
    const segmentBeats = changeBeat - currentBeat
    const segmentMilliseconds = segmentBeats * millisecondsPerBeat

    if (!Number.isFinite(segmentMilliseconds) || segmentMilliseconds >= remainingMilliseconds) {
      return currentBeat + remainingMilliseconds / millisecondsPerBeat
    }

    remainingMilliseconds -= segmentMilliseconds
    currentBeat = changeBeat
  }

  return currentBeat
}

export type MusicMeasurePosition = {
  measureNumber: number
  beatInMeasure: number
}

/** Finds the 1-based measure number and 1-based beat-in-measure for a beat position. */
export const getMeasurePositionForBeat = (
  measures: readonly MusicMeasure[],
  beat: number,
): MusicMeasurePosition => {
  let activeMeasure = measures[0]
  for (const measure of measures) {
    if (measure.startBeat <= beat) {
      activeMeasure = measure
    } else {
      break
    }
  }

  if (!activeMeasure) {
    return { measureNumber: 1, beatInMeasure: 1 }
  }

  return {
    measureNumber: activeMeasure.index + 1,
    beatInMeasure: beat - activeMeasure.startBeat + 1,
  }
}

/**
 * Converts a count/beat range into elapsed real time (ms). Falls back to a constant tempo
 * when no score is attached, preserving existing manual-BPM behavior.
 */
export const getElapsedMillisecondsForCounts = (
  music: MusicScore | null,
  fallbackBpm: number,
  fromCount: number,
  toCount: number,
): number => music
  ? getElapsedMillisecondsForBeatRange(music.tempoMap, fromCount, toCount)
  : Math.max(0, toCount - fromCount) * (60_000 / fallbackBpm)

/**
 * Converts elapsed real time (ms) since `fromCount` into a count/beat position. Falls back to a
 * constant tempo when no score is attached, preserving existing manual-BPM behavior.
 */
export const getCountForElapsedMilliseconds = (
  music: MusicScore | null,
  fallbackBpm: number,
  fromCount: number,
  elapsedMilliseconds: number,
): number => music
  ? getBeatForElapsedMilliseconds(music.tempoMap, fromCount, elapsedMilliseconds)
  : fromCount + elapsedMilliseconds / (60_000 / fallbackBpm)

/** Current tempo (BPM) active at a given count/beat position, from the score or the manual tempo. */
export const getActiveTempoBpm = (music: MusicScore | null, fallbackBpm: number, count: number): number =>
  music ? getActiveTempo(music.tempoMap, count).bpm : fallbackBpm
