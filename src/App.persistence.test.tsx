import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import App from './App'
import type { EditorSnapshot } from './domain/editorHistory'
import { parseProject, projectStorageKey, serializeProject } from './domain/projectPersistence'

const importedSnapshot: EditorSnapshot = {
  productionName: 'Imported Show',
  performerMetadata: [{ id: 'p7', label: 'S7', name: 'Riley', section: 'Saxophone' }],
  drillSets: [
    {
      id: 'set-1',
      name: 'Set 1',
      counts: 0,
      performerPositions: [{ performerId: 'p7', x: 300, y: 177.7777777777778, verticalReferenceId: 'backHash' }],
    },
    {
      id: 'set-2',
      name: 'Set 2',
      counts: 12,
      performerPositions: [{ performerId: 'p7', x: 500, y: 355.5555555555556, verticalReferenceId: 'frontHash' }],
    },
  ],
  activeSetId: 'set-2',
  music: null,
}

const importText = async (text: string) => {
  fireEvent.change(screen.getByLabelText('Import project file'), {
    target: { files: [{ text: () => Promise.resolve(text) }] },
  })
  await waitFor(() => expect(screen.queryByText('Importing project')).not.toBeInTheDocument())
}

describe('project persistence', () => {
  it('starts explicitly saved with Save disabled', () => {
    render(<App />)

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(screen.getByLabelText('Save status')).toHaveTextContent('Saved')
  })

  it('enables Save and shows unsaved status after an edit', () => {
    render(<App />)
    fireEvent.change(screen.getByLabelText('Production name'), { target: { value: 'Changed Show' } })

    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
    expect(screen.getByLabelText('Save status')).toHaveTextContent('Unsaved changes')
  })

  it('autosaves meaningful production changes', async () => {
    render(<App />)
    fireEvent.change(screen.getByLabelText('Production name'), { target: { value: 'Autosaved Show' } })
    fireEvent.change(screen.getByLabelText('Name for T1'), { target: { value: 'Casey' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add set' }))

    await waitFor(() => {
      const stored = localStorage.getItem(projectStorageKey)
      expect(stored).not.toBeNull()
      expect(parseProject(stored ?? '')).toMatchObject({
        productionName: 'Autosaved Show',
        activeSetId: 'set-2',
        performerMetadata: [expect.objectContaining({ id: 't1', name: 'Casey' })],
      })
    })
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
    expect(screen.getByLabelText('Save status')).toHaveTextContent('Unsaved changes')
  })

  it('explicit Save writes the current snapshot and resets dirty state', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    render(<App />)
    fireEvent.change(screen.getByLabelText('Production name'), { target: { value: 'Explicit Save' } })
    await waitFor(() => expect(localStorage.getItem(projectStorageKey)).toContain('Explicit Save'))
    setItem.mockClear()

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(setItem).toHaveBeenCalledWith(projectStorageKey, expect.stringContaining('Explicit Save'))
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(screen.getByLabelText('Save status')).toHaveTextContent('Saved')
    setItem.mockRestore()
  })

  it('marks the project dirty again after an explicit Save', () => {
    render(<App />)
    fireEvent.change(screen.getByLabelText('Production name'), { target: { value: 'First Edit' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Production name'), { target: { value: 'Second Edit' } })
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
    expect(screen.getByLabelText('Save status')).toHaveTextContent('Unsaved changes')
  })

  it('restores the latest valid local production on load', () => {
    localStorage.setItem(projectStorageKey, serializeProject(importedSnapshot))
    render(<App />)

    expect(screen.getByLabelText('Production name')).toHaveValue('Imported Show')
    expect(screen.getByTestId('performer-p7').querySelector('circle')).toHaveAttribute('cx', '500')
    expect(screen.getByLabelText('Counts for Set 2')).toHaveValue(12)
    expect(screen.getByLabelText('Name for S7')).toHaveValue('Riley')
  })

  it('exports a human-readable schema-v1 project file', () => {
    const createObjectURL = vi.fn(() => 'blob:project')
    const revokeObjectURL = vi.fn()
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL })
    render(<App />)
    fireEvent.change(screen.getByLabelText('Production name'), { target: { value: 'Export Test' } })

    fireEvent.click(screen.getByRole('button', { name: 'Export' }))

    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
    expect(anchorClick).toHaveBeenCalledOnce()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:project')
    anchorClick.mockRestore()
    vi.unstubAllGlobals()
  })

  it('imports a complete project and establishes a fresh history baseline', async () => {
    render(<App />)
    fireEvent.change(screen.getByLabelText('Label for T1'), { target: { value: 'Old Edit' } })

    await importText(serializeProject(importedSnapshot))

    expect(screen.getByLabelText('Production name')).toHaveValue('Imported Show')
    expect(screen.getByTestId('performer-p7').querySelector('circle')).toHaveAttribute('cx', '500')
    expect(screen.queryByTestId('performer-t1')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(screen.getByLabelText('Save status')).toHaveTextContent('Saved')

    fireEvent.change(screen.getByLabelText('Name for S7'), { target: { value: 'Jordan' } })
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(screen.getByLabelText('Name for S7')).toHaveValue('Riley')
  })

  it('shows clear errors for malformed and unsupported imports without replacing the project', async () => {
    render(<App />)
    await importText('{bad json')
    expect(screen.getByRole('alert')).toHaveTextContent('not valid JSON')
    expect(screen.getByTestId('performer-t1')).toBeInTheDocument()

    await importText(JSON.stringify({ schemaVersion: 99 }))
    expect(screen.getByRole('alert')).toHaveTextContent('Unsupported project schema version: 99')
    expect(screen.getByTestId('performer-t1')).toBeInTheDocument()
  })

  it('confirms unsaved changes before creating a fresh project and resets history', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<App />)
    fireEvent.change(screen.getByLabelText('Production name'), { target: { value: 'Work in Progress' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add set' }))

    fireEvent.click(screen.getByRole('button', { name: 'New' }))
    expect(confirm).toHaveBeenCalledOnce()
    expect(screen.getByLabelText('Production name')).toHaveValue('Work in Progress')
    expect(screen.getByRole('button', { name: 'Set 2' })).toBeInTheDocument()

    confirm.mockReturnValue(true)
    fireEvent.click(screen.getByRole('button', { name: 'New' }))
    expect(screen.getByLabelText('Production name')).toHaveValue('Untitled Production')
    expect(screen.queryByRole('button', { name: 'Set 2' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(screen.getByLabelText('Save status')).toHaveTextContent('Saved')
    confirm.mockRestore()
  })

  it('explicit Save updates the baseline used by New', () => {
    const confirm = vi.spyOn(window, 'confirm')
    render(<App />)
    fireEvent.change(screen.getByLabelText('Production name'), { target: { value: 'Saved Work' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    fireEvent.click(screen.getByRole('button', { name: 'New' }))

    expect(confirm).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Production name')).toHaveValue('Untitled Production')
    confirm.mockRestore()
  })
})