import { useCallback, useMemo, useRef, useState } from 'react'
import { saveAs } from 'file-saver'
import { PDFDocument } from 'pdf-lib'
import * as pdfjsLib from 'pdfjs-dist'
import 'pdfjs-dist/web/pdf_viewer.css'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

function dataURLFromImage(file, targetType) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0)
      const quality = targetType === 'image/jpeg' ? 0.92 : 1
      canvas.toBlob((blob) => {
        if (!blob) return reject(new Error('Failed to convert image'))
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = reject
        reader.readAsArrayBuffer(blob)
      }, targetType, quality)
    }
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

async function imagesToPdf(imageFiles) {
  const pdfDoc = await PDFDocument.create()
  for (const file of imageFiles) {
    const imgURL = URL.createObjectURL(file)
    const imgEl = await new Promise((res, rej) => {
      const i = new Image()
      i.onload = () => res(i)
      i.onerror = rej
      i.src = imgURL
    })
    const page = pdfDoc.addPage([imgEl.width, imgEl.height])
    const canvas = document.createElement('canvas')
    canvas.width = imgEl.width
    canvas.height = imgEl.height
    const ctx = canvas.getContext('2d')
    ctx.drawImage(imgEl, 0, 0)
    const bytes = await new Promise((resolve) => canvas.toBlob(async (b) => {
      const arrayBuf = await b.arrayBuffer()
      resolve(new Uint8Array(arrayBuf))
    }, 'image/jpeg', 0.92))
    const embedded = await pdfDoc.embedJpg(bytes)
    page.drawImage(embedded, { x: 0, y: 0, width: imgEl.width, height: imgEl.height })
  }
  return await pdfDoc.save()
}

async function pdfToImages(pdfFile) {
  const arrayBuffer = await pdfFile.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const images = []
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const viewport = page.getViewport({ scale: 2 })
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    canvas.width = viewport.width
    canvas.height = viewport.height
    await page.render({ canvasContext: ctx, viewport }).promise
    const blob = await new Promise((r) => canvas.toBlob((b) => r(b), 'image/jpeg', 0.92))
    images.push({ page: p, blob })
  }
  return images
}

async function mergePdfs(files) {
  const merged = await PDFDocument.create()
  for (const f of files) {
    const bytes = new Uint8Array(await f.arrayBuffer())
    const doc = await PDFDocument.load(bytes)
    const copiedPages = await merged.copyPages(doc, doc.getPageIndices())
    for (const pg of copiedPages) merged.addPage(pg)
  }
  return await merged.save()
}

async function excludePdfPages(file, excludeSpec) {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const doc = await PDFDocument.load(bytes)
  const total = doc.getPageCount()
  const exclude = new Set()
  const parts = excludeSpec.split(',').map((s) => s.trim()).filter(Boolean)
  for (const part of parts) {
    if (part.includes('-')) {
      const [a, b] = part.split('-').map((x) => parseInt(x, 10))
      const start = Math.min(a, b)
      const end = Math.max(a, b)
      for (let i = start; i <= end; i++) if (i >= 1 && i <= total) exclude.add(i - 1)
    } else {
      const n = parseInt(part, 10)
      if (!isNaN(n) && n >= 1 && n <= total) exclude.add(n - 1)
    }
  }
  const keep = []
  for (let i = 0; i < total; i++) if (!exclude.has(i)) keep.push(i)
  const out = await PDFDocument.create()
  const copied = await out.copyPages(doc, keep)
  for (const pg of copied) out.addPage(pg)
  return await out.save()
}

function useDragCounter() {
  const counter = useRef(0)
  const [over, setOver] = useState(false)
  const onDragEnter = useCallback((e) => {
    e.preventDefault(); e.stopPropagation(); counter.current += 1; setOver(true)
  }, [])
  const onDragLeave = useCallback((e) => {
    e.preventDefault(); e.stopPropagation(); counter.current -= 1; if (counter.current <= 0) { setOver(false); counter.current = 0 }
  }, [])
  const onDragOver = useCallback((e) => { e.preventDefault(); e.stopPropagation(); }, [])
  return { over, onDragEnter, onDragLeave, onDragOver, reset: () => { counter.current = 0; setOver(false) } }
}

function HoverDropWidget({ onFiles }) {
  const [{ x, y }, setPos] = useState({ x: 24, y: 24 })
  const draggingRef = useRef(false)
  const offsetRef = useRef({ x: 0, y: 0 })
  const { over, onDragEnter, onDragLeave, onDragOver } = useDragCounter()

  const onMouseDown = (e) => {
    draggingRef.current = true
    offsetRef.current = { x: e.clientX - x, y: e.clientY - y }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }
  const onMouseMove = (e) => {
    if (!draggingRef.current) return
    setPos({ x: e.clientX - offsetRef.current.x, y: e.clientY - offsetRef.current.y })
  }
  const onMouseUp = () => {
    draggingRef.current = false
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
  }

  const onDrop = (e) => {
    e.preventDefault(); e.stopPropagation()
    const files = Array.from(e.dataTransfer.files)
    onFiles(files)
  }

  return (
    <div
      className={`fixed z-50 rounded-xl shadow-lg border ${over ? 'border-primary-500 ring-2 ring-primary-400' : 'border-gray-300'} bg-white`}
      style={{ left: x, top: y }}
      onMouseDown={onMouseDown}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="p-3 cursor-move select-none">
        <div className="text-sm font-medium text-gray-700">Drop files here</div>
        <div className="text-xs text-gray-500">Drag me anywhere</div>
      </div>
    </div>
  )
}

function FileUpload({ onFiles }) {
  const inputRef = useRef(null)
  const { over, onDragEnter, onDragLeave, onDragOver, reset } = useDragCounter()

  const onDrop = (e) => {
    e.preventDefault(); e.stopPropagation();
    const files = Array.from(e.dataTransfer.files)
    onFiles(files)
    reset()
  }

  return (
    <div className="w-full">
      <div
        className={`mt-6 flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-10 transition-colors ${over ? 'border-primary-500 bg-primary-50' : 'border-gray-300 bg-white'}`}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        <p className="text-lg font-semibold text-gray-700">Drag & drop files here</p>
        <p className="text-sm text-gray-500 mt-1">or</p>
        <button
          onClick={() => inputRef.current?.click()}
          className="mt-3 px-4 py-2 rounded-md bg-primary-600 text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-400"
        >
          Browse files
        </button>
        <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => onFiles(Array.from(e.target.files))} />
      </div>
    </div>
  )
}

function FilePreview({ files, selected, setSelected }) {
  const items = files.map((f, idx) => ({
    idx,
    name: f.name,
    type: f.type,
    size: f.size,
  }))

  return (
    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
      {items.map((it) => (
        <label key={it.idx} className="flex items-center gap-3 p-3 border rounded-lg bg-white shadow-sm">
          <input
            type="checkbox"
            checked={selected.includes(it.idx)}
            onChange={(e) => {
              setSelected((prev) => e.target.checked ? [...prev, it.idx] : prev.filter((i) => i !== it.idx))
            }}
          />
          <div className="flex-1">
            <div className="font-medium text-gray-800 truncate">{it.name}</div>
            <div className="text-xs text-gray-500">{it.type || 'unknown'} • {(it.size / 1024).toFixed(1)} KB</div>
          </div>
        </label>
      ))}
    </div>
  )
}

function ConversionOptions({ files, selected }) {
  const selFiles = useMemo(() => selected.map((i) => files[i]).filter(Boolean), [files, selected])

  const convertTo = async (target) => {
    const images = selFiles.filter(f => ['image/png', 'image/jpeg'].includes(f.type))
    if (images.length === 0) return alert('Select PNG or JPEG images to convert')
    for (const img of images) {
      const arrBuf = await dataURLFromImage(img, target)
      const blob = new Blob([arrBuf], { type: target })
      const name = img.name.replace(/\.(png|jpg|jpeg)$/i, target === 'image/png' ? '.png' : '.jpg')
      saveAs(blob, name)
    }
  }

  const makePdf = async () => {
    const images = selFiles.filter(f => ['image/png', 'image/jpeg'].includes(f.type))
    if (images.length === 0) return alert('Select images to convert to PDF')
    const pdfBytes = await imagesToPdf(images)
    saveAs(new Blob([pdfBytes], { type: 'application/pdf' }), 'images.pdf')
  }

  const pdfToJpegs = async () => {
    const pdfs = selFiles.filter(f => f.type === 'application/pdf')
    if (pdfs.length !== 1) return alert('Select exactly one PDF to convert to images')
    const images = await pdfToImages(pdfs[0])
    images.forEach(({ page, blob }) => saveAs(blob, `page-${page}.jpg`))
  }

  const merge = async () => {
    const pdfs = selFiles.filter(f => f.type === 'application/pdf')
    if (pdfs.length < 2) return alert('Select at least two PDFs to merge')
    const bytes = await mergePdfs(pdfs)
    saveAs(new Blob([bytes], { type: 'application/pdf' }), 'merged.pdf')
  }

  const excludePages = async () => {
    const pdfs = selFiles.filter(f => f.type === 'application/pdf')
    if (pdfs.length !== 1) return alert('Select exactly one PDF to split/exclude pages')
    const spec = window.prompt('Enter pages or ranges to exclude (e.g., "1,4-6")')
    if (!spec) return
    const bytes = await excludePdfPages(pdfs[0], spec)
    saveAs(new Blob([bytes], { type: 'application/pdf' }), 'excluded.pdf')
  }

  return (
    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      <button className="btn" onClick={() => convertTo('image/png')}>Convert to PNG</button>
      <button className="btn" onClick={() => convertTo('image/jpeg')}>Convert to JPEG</button>
      <button className="btn" onClick={makePdf}>Images to single PDF</button>
      <button className="btn" onClick={pdfToJpegs}>PDF to JPEG images</button>
      <button className="btn" onClick={merge}>Merge PDFs</button>
      <button className="btn" onClick={excludePages}>Split/Exclude pages</button>
    </div>
  )
}

export default function App() {
  const [files, setFiles] = useState([])
  const [selected, setSelected] = useState([])

  const onFiles = useCallback((newFiles) => {
    setFiles((prev) => [...prev, ...newFiles])
  }, [])

  return (
    <div className="min-h-screen">
      <HoverDropWidget onFiles={onFiles} />
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-800">File Converter</h1>
          <div className="flex items-center gap-2">
            <button className="btn" onClick={() => { setFiles([]); setSelected([]) }}>Clear</button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4">
        <FileUpload onFiles={onFiles} />
        {files.length > 0 && (
          <>
            <FilePreview files={files} selected={selected} setSelected={setSelected} />
            <ConversionOptions files={files} selected={selected} />
          </>
        )}
      </main>

      <style>{`
        .btn { @apply px-4 py-2 rounded-md bg-primary-600 text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-400 disabled:opacity-50 disabled:cursor-not-allowed; }
      `}</style>
    </div>
  )
}
