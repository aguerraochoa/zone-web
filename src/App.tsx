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

  const formatDateForAPI = (dateStr: string): string => {
    // Convert from YYYY-MM-DD (input) to MM/DD/YYYY (API)
    const [year, month, day] = dateStr.split('-')
    return `${month}/${day}/${year}`
  }

  const handleSubmit = async () => {
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

            {/* File Upload Zone */}
            <div className="form-group">
              <label className="form-label">Archivo de Datos</label>
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
            </div>

            {/* Submit Button */}
            <button
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={!isFormValid}
            >
              Procesar Asistencia
            </button>

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
