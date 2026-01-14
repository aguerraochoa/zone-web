import { useState, useRef } from 'react'
import type { DragEvent, ChangeEvent } from 'react'
import './App.css'

// API Configuration - Live Cloud Function URL
const API_URL = import.meta.env.VITE_API_URL || 'https://zone-etl-webapp-7ozjbw43ka-uc.a.run.app'

interface ProcessResult {
  status: 'success' | 'error'
  message?: string
  matched_count?: number
  unmatched_count?: number
  bigquery_loaded?: boolean
  misc_records?: Record<string, unknown>[]
}

function App() {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [password, setPassword] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [fileContent, setFileContent] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<ProcessResult | null>(null)
  const [error, setError] = useState('')
  const [entryMode, setEntryMode] = useState<'upload' | 'manual'>('manual')

  const [showConfirmation, setShowConfirmation] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileRead = (selectedFile: File) => {
    setFile(selectedFile)
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      setFileContent(text)
    }
    reader.readAsText(selectedFile)
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      handleFileRead(droppedFile)
    }
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = () => {
    setIsDragOver(false)
  }

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      handleFileRead(selectedFile)
    }
  }

  const handleModeChange = (mode: 'upload' | 'manual') => {
    setEntryMode(mode)
    setFileContent('')
    setFile(null)
    setError('')
  }

  const formatDateForAPI = (dateStr: string): string => {
    // Convert from YYYY-MM-DD (input) to MM/DD/YYYY (API)
    const [year, month, day] = dateStr.split('-')
    return `${month}/${day}/${year}`
  }

  const formatDateForDisplay = (dateStr: string): string => {
    if (!dateStr) return ''
    const [year, month, day] = dateStr.split('-')
    const months = [
      'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
    ]
    return `${parseInt(day)} de ${months[parseInt(month) - 1]} de ${year}`
  }

  const handleSubmitRequest = () => {
    // Validation
    if (!startDate || !endDate) {
      setError('Por favor ingresa las fechas de inicio y fin')
      return
    }
    if (!password) {
      setError('Por favor ingresa la contraseña')
      return
    }
    if (!fileContent) {
      setError('Por favor sube un archivo con los datos')
      return
    }

    setError('')
    setShowConfirmation(true)
  }

  const processAttendance = async () => {
    setShowConfirmation(false)
    setResult(null)
    setIsLoading(true)

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          password,
          start_date: formatDateForAPI(startDate),
          end_date: formatDateForAPI(endDate),
          file_content: fileContent,
          entry_mode: entryMode,
        }),
      })

      const data: ProcessResult = await response.json()

      if (!response.ok) {
        setError(data.message || 'Error al procesar los datos')
        return
      }

      setResult(data)
    } catch (err) {
      setError('Error de conexión con el servidor. Verifica que el servicio esté activo.')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  const downloadMiscCSV = () => {
    if (!result?.misc_records?.length) return

    // Build CSV content
    const headers = Object.keys(result.misc_records[0])
    const csvRows = [
      headers.join(','),
      ...result.misc_records.map(record =>
        headers.map(header => {
          const value = record[header]
          // Escape commas and quotes
          const str = String(value ?? '')
          return str.includes(',') || str.includes('"')
            ? `"${str.replace(/"/g, '""')}"`
            : str
        }).join(',')
      )
    ]
    const csvContent = csvRows.join('\n')

    // Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `misc_records_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const resetForm = () => {
    setFile(null)
    setFileContent('')
    setResult(null)
    setError('')
    setStartDate('')
    setEndDate('')
    // Only keeping password for convenience
  }

  const isFormValid = startDate && endDate && password && fileContent

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <img src="/logo.png" alt="Zone Fitness" className="logo" />
        <h1 className="app-title">Carga de Asistencia</h1>
      </header>

      {/* Main Upload Card */}
      <main className="upload-card">

        {/* VIEW 1: INPUT FORM (Show only when NOT processing and NO results) */}
        {!isLoading && !result && (
          <>
            {/* Date Inputs */}
            <div className="form-group">
              <label className="form-label">Rango de Fechas</label>
              <div className="date-row">
                <input
                  type="date"
                  className="input-field"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  placeholder="Fecha inicio"
                />
                <input
                  type="date"
                  className="input-field"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  placeholder="Fecha fin"
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="form-group">
              <label className="form-label">Contraseña</label>
              <input
                type="password"
                className="input-field"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Ingresa la contraseña de acceso"
              />
            </div>

            {/* Data Entry Mode Selection */}
            <div className="form-group">
              <label className="form-label">Método de Entrada</label>
              <div className="mode-toggle" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                <button
                  className={`btn ${entryMode === 'manual' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => handleModeChange('manual')}
                  style={{ flex: 1, padding: '0.5rem' }}
                >
                  ✍️ Pegar Texto
                </button>
                <button
                  className={`btn ${entryMode === 'upload' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => handleModeChange('upload')}
                  style={{ flex: 1, padding: '0.5rem' }}
                >
                  📁 Subir Archivo
                </button>
              </div>

              {entryMode === 'upload' ? (
                /* File Upload Zone */
                <div
                  className={`file-upload-zone ${isDragOver ? 'drag-over' : ''} ${file ? 'has-file' : ''}`}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="upload-icon">📄</div>
                  <p className="upload-text">
                    <strong>Arrastra tu archivo aquí</strong><br />
                    o haz clic para seleccionar
                  </p>
                  {file && <p className="file-name">✓ {file.name}</p>}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.csv"
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                  />
                </div>
              ) : (
                /* Manual Text Area */
                <div className="manual-input-zone">
                  <textarea
                    className="input-field"
                    value={fileContent}
                    onChange={(e) => setFileContent(e.target.value)}
                    placeholder="Pega aquí los datos de asistencia..."
                    style={{
                      minHeight: '150px',
                      fontFamily: 'monospace',
                      resize: 'none',
                      overflowY: 'auto'
                    }}
                  />
                </div>
              )}
            </div>

            {/* Submit Button */}
            <button
              className="btn btn-primary"
              onClick={handleSubmitRequest}
              disabled={!isFormValid}
            >
              Procesar Asistencia
            </button>

            {/* Confirmation Overlay */}
            {showConfirmation && (
              <div className="confirmation-overlay" style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: '#FFFFFF',
                zIndex: 10,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                padding: 'var(--space-2xl)',
                textAlign: 'center',
                borderRadius: 'var(--radius-xl)'
              }}>
                <h3 style={{ marginBottom: '1.5rem', fontSize: '1.5rem' }}>¿Estás seguro que quieres procesar esta información?</h3>
                <div style={{
                  background: 'var(--zone-light-gray)',
                  padding: '1.5rem',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: '2.5rem',
                  fontSize: '1rem',
                  color: 'var(--zone-gray-2)',
                  width: '100%'
                }}>
                  Se cargarán los datos para el rango:<br />
                  <strong style={{ color: 'var(--zone-black)', fontSize: '1.2rem', display: 'block', marginTop: '0.5rem' }}>
                    {formatDateForDisplay(startDate)} - {formatDateForDisplay(endDate)}
                  </strong>
                </div>
                <div style={{ display: 'flex', gap: '1rem', width: '100%' }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() => setShowConfirmation(false)}
                    style={{ flex: 1 }}
                  >
                    Regresar
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={processAttendance}
                    style={{ flex: 1 }}
                  >
                    Sí, Procesar
                  </button>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && <div className="error-message">{error}</div>}
          </>
        )}

        {/* VIEW 2: LOADING STATE */}
        {isLoading && (
          <div className="loading-container" style={{ textAlign: 'center', padding: '2rem' }}>
            <div className="spinner" style={{ width: '40px', height: '40px', margin: '0 auto 1rem', borderTopColor: 'var(--zone-black)', borderRightColor: 'var(--zone-black)', borderBottomColor: 'var(--zone-black)', borderLeftColor: 'transparent' }}></div>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Procesando Datos...</h3>
            <p style={{ color: 'var(--zone-gray-3)' }}>Enviando a BigQuery</p>
          </div>
        )}

        {/* VIEW 3: RESULTS (SUCCESS) */}
        {result && result.status === 'success' && (
          <div className="results-section" style={{ borderTop: 'none', marginTop: 0, paddingTop: 0 }}>
            <div className="success-header" style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <img src="/success-icon.png" alt="Success" style={{ width: '64px', height: '64px', marginBottom: '1rem' }} />
              <h2>¡Carga Exitosa!</h2>
            </div>

            <div className="result-card success">
              <div className="result-title">Registros Procesados</div>
              <div className="result-value">{result.matched_count}</div>
              <div className="result-subtitle">
                {result.bigquery_loaded ? '✓ Cargados a BigQuery' : '⚠ No se cargaron a BigQuery'}
              </div>
            </div>

            {(result.unmatched_count ?? 0) > 0 && (
              <div className="result-card warning">
                <div className="result-title">Registros No Procesados (Misc)</div>
                <div className="result-value">{result.unmatched_count}</div>
                <div className="result-subtitle">
                  Clases no reconocidas o con baja asistencia
                </div>
                <button
                  className="btn btn-secondary"
                  onClick={downloadMiscCSV}
                  style={{ marginTop: '1rem' }}
                >
                  📥 Descargar CSV
                </button>
              </div>
            )}

            <button
              className="btn btn-primary"
              onClick={resetForm}
              style={{ marginTop: '2rem' }}
            >
              Subir Otro Archivo
            </button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="app-footer">
        Zone Fitness © {new Date().getFullYear()} • Sistema de Análisis de Asistencia
      </footer>
    </div>
  )
}

export default App
