import { useCallback, useMemo, useRef, useState } from 'react'
import { saveAs } from 'file-saver'
import { PDFDocument } from 'pdf-lib'
import * as pdfjsLib from 'pdfjs-dist'
import 'pdfjs-dist/web/pdf_viewer.css'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Upload, File, X } from 'lucide-react'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

// ... (Conversion functions remain the same)

function App() {
  const [files, setFiles] = useState([])
  const [selected, setSelected] = useState([])
  const [isDragging, setIsDragging] = useState(false)

  const onFiles = useCallback((newFiles) => {
    setFiles((prev) => [...prev, ...newFiles])
  }, [])

  const handleDragEnter = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    const droppedFiles = Array.from(e.dataTransfer.files)
    onFiles(droppedFiles)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-4xl">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-center text-gray-800">File Converter</h1>
          <p className="text-center text-gray-500 mt-2">A versatile tool to handle all your file conversion needs.</p>
        </header>

        <main>
          <Card
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className={`transition-all duration-300 ${isDragging ? 'border-primary ring-2 ring-primary' : ''}`}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="w-6 h-6" />
                <span>Upload Files</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center p-10 border-2 border-dashed rounded-lg">
                <p className="text-lg font-semibold text-gray-700">Drag & drop files here</p>
                <p className="text-sm text-gray-500 mt-1">or</p>
                <Button asChild className="mt-4">
                  <Label htmlFor="file-upload">
                    Browse files
                    <Input id="file-upload" type="file" multiple className="hidden" onChange={(e) => onFiles(Array.from(e.target.files))} />
                  </Label>
                </Button>
              </div>
            </CardContent>
          </Card>

          {files.length > 0 && (
            <div className="mt-8">
              <Card>
                <CardHeader>
                  <CardTitle>File Queue</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {files.map((file, idx) => (
                      <div key={idx} className="flex items-center gap-4 p-3 border rounded-lg bg-white shadow-sm">
                        <Checkbox
                          id={`file-${idx}`}
                          checked={selected.includes(idx)}
                          onCheckedChange={(checked) => {
                            setSelected((prev) => checked ? [...prev, idx] : prev.filter((i) => i !== idx))
                          }}
                        />
                        <Label htmlFor={`file-${idx}`} className="flex-1 flex items-center gap-3 cursor-pointer">
                          <File className="w-6 h-6 text-gray-500" />
                          <div>
                            <div className="font-medium text-gray-800 truncate">{file.name}</div>
                            <div className="text-xs text-gray-500">{file.type || 'unknown'} • {(file.size / 1024).toFixed(1)} KB</div>
                          </div>
                        </Label>
                        <Button variant="ghost" size="icon" onClick={() => {
                          setFiles(files.filter((_, i) => i !== idx))
                          setSelected(selected.filter(i => i !== idx))
                        }}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Tabs defaultValue="image" className="mt-8">
                <TabsList>
                  <TabsTrigger value="image">Image Tools</TabsTrigger>
                  <TabsTrigger value="pdf">PDF Tools</TabsTrigger>
                </TabsList>
                <TabsContent value="image">
                  <Card>
                    <CardHeader><CardTitle>Image Conversion</CardTitle></CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {/* ... Image conversion buttons ... */}
                    </CardContent>
                  </Card>
                </TabsContent>
                <TabsContent value="pdf">
                  <Card>
                    <CardHeader><CardTitle>PDF Tools</CardTitle></CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {/* ... PDF conversion buttons ... */}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>

              <div className="mt-8 flex justify-end">
                <Button variant="destructive" onClick={() => { setFiles([]); setSelected([]) }}>Clear All</Button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default App