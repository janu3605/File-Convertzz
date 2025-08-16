import { useCallback, useMemo, useRef, useState } from 'react'
import { saveAs } from 'file-saver'
import { PDFDocument } from 'pdf-lib'
import * as pdfjsLib from 'pdfjs-dist'
import 'pdfjs-dist/web/pdf_viewer.css'
import { UploadCloud, File as FileIcon, X, ChevronDown } from 'lucide-react'
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input" // <-- ADD THIS LINE

// PDF.js worker setup
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

// --- Conversion Functions (Unchanged) ---
async function dataURLFromImage(file, targetType) { /* ... */ }
async function imagesToPdf(imageFiles) { /* ... */ }
async function pdfToImages(pdfFile) { /* ... */ }
async function mergePdfs(files) { /* ... */ }
async function excludePdfPages(file, excludeSpec) { /* ... */ }

export default function App() {
  const [files, setFiles] = useState([])
  const [selected, setSelected] = useState([])
  const [isDragging, setIsDragging] = useState(false)
  const [isDropdownOpen, setDropdownOpen] = useState(false)
  const inputRef = useRef(null)

  const onFiles = useCallback((newFiles) => {
    setFiles((prev) => [...prev, ...newFiles])
  }, [])

  const handleDragEnter = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }
  const handleDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }
  const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); }
  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFiles(Array.from(e.dataTransfer.files))
      e.dataTransfer.clearData()
    }
  }

  const selFiles = useMemo(() => selected.map(i => files[i]).filter(Boolean), [files, selected])

  const handleAction = async (action) => {
    setDropdownOpen(false)
    // ... (logic for each action like convertTo, makePdf, etc.)
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8 flex flex-col items-center text-lg">
      <div className="w-full max-w-3xl space-y-8">
        <header className="text-center py-8">
          <h1 className="text-7xl font-bold text-orange-300 tracking-widest">File Convertzz</h1>
        </header>

        <main className="space-y-12">
          <div
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={cn(
              "relative block w-full rounded-lg p-12 text-center transition-all duration-300 cursor-pointer",
              "border-[3px] border-dashed",
              isDragging ? 'border-orange-400 bg-orange-400/10 scale-105' : 'border-orange-400/50'
            )}
          >
            <UploadCloud className="mx-auto h-16 w-16 text-orange-300" />
            <span className="mt-4 block font-semibold text-orange-200">
              {isDragging ? "Release to Drop" : "Drop files or Click to Upload"}
            </span>
            <Input
              ref={inputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => onFiles(Array.from(e.target.files))}
            />
          </div>

          {files.length > 0 && (
            <div className="space-y-8">
              <div className="space-y-4">
                <h2 className="text-3xl text-orange-300">File Queue</h2>
                {files.map((file, idx) => (
                  <div key={idx} className="radio-input">
                    <label>
                      <input
                        type="radio"
                        name="file-selection"
                        checked={selected.includes(idx)}
                        onChange={() => setSelected([idx])}
                      />
                      <div className="flex items-center gap-4 w-full px-4">
                        <FileIcon className="w-6 h-6 text-gray-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0 text-left">
                          <p className="font-medium truncate" title={file.name}>{file.name}</p>
                          <p className="text-xs text-gray-500">{file.type || 'unknown'} • {(file.size / 1024).toFixed(1)} KB</p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setFiles(files.filter((_, i) => i !== idx));
                            setSelected(selected.filter(i => i !== idx).map(i => i > idx ? i - 1 : i));
                          }}
                          className="p-2 rounded-full hover:bg-white/10"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </label>
                     <div className="selection"></div>
                  </div>
                ))}
              </div>

              <div className="relative">
                <button
                  onClick={() => setDropdownOpen(!isDropdownOpen)}
                  className="w-full flex items-center justify-between p-4 bg-[#222] border border-[#333] rounded-lg text-lg"
                >
                  Select an Action...
                  <ChevronDown className={cn("w-6 h-6 transition-transform", isDropdownOpen && "rotate-180")} />
                </button>
                {isDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-[#222] border border-[#333] rounded-lg z-10">
                    <h3 className="p-3 text-sm text-gray-400">Image Tools</h3>
                    <button onClick={() => handleAction('to_png')} className="block w-full text-left p-3 hover:bg-orange-400/20">Convert to PNG</button>
                    <button onClick={() => handleAction('to_jpeg')} className="block w-full text-left p-3 hover:bg-orange-400/20">Convert to JPEG</button>
                    <button onClick={() => handleAction('images_to_pdf')} className="block w-full text-left p-3 hover:bg-orange-400/20">Images to PDF</button>
                    <div className="border-t border-[#333] my-1"></div>
                    <h3 className="p-3 text-sm text-gray-400">PDF Tools</h3>
                    <button onClick={() => handleAction('pdf_to_jpeg')} className="block w-full text-left p-3 hover:bg-orange-400/20">PDF to JPEGs</button>
                    <button onClick={() => handleAction('merge_pdfs')} className="block w-full text-left p-3 hover:bg-orange-400/20">Merge PDFs</button>
                    <button onClick={() => handleAction('exclude_pages')} className="block w-full text-left p-3 hover:bg-orange-400/20">Exclude Pages</button>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}