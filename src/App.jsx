import { useCallback, useMemo, useRef, useState } from 'react';
import { saveAs } from 'file-saver';
import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import { UploadCloud, File as FileIcon, X, ChevronDown } from 'lucide-react';
import { cn } from "@/lib/utils";

// Setup PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

// --- FULLY FUNCTIONAL CONVERSION LOGIC ---
async function dataURLFromImage(file, targetType) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const quality = targetType === 'image/jpeg' ? 0.92 : 1.0;
      canvas.toBlob((blob) => {
        if (!blob) return reject(new Error('Canvas to Blob conversion failed'));
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsArrayBuffer(blob);
      }, targetType, quality);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

async function imagesToPdf(imageFiles) {
  const pdfDoc = await PDFDocument.create();
  for (const file of imageFiles) {
    const arrayBuffer = await file.arrayBuffer();
    let embeddedImage;
    if (file.type === 'image/png') {
      embeddedImage = await pdfDoc.embedPng(arrayBuffer);
    } else {
      embeddedImage = await pdfDoc.embedJpg(arrayBuffer);
    }
    const page = pdfDoc.addPage([embeddedImage.width, embeddedImage.height]);
    page.drawImage(embeddedImage, { x: 0, y: 0, width: embeddedImage.width, height: embeddedImage.height });
  }
  return await pdfDoc.save();
}

async function pdfToImages(pdfFile) {
  const arrayBuffer = await pdfFile.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const images = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    await page.render({ canvasContext: context, viewport }).promise;
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.92));
    images.push({ page: i, blob });
  }
  return images;
}

async function mergePdfs(files) {
  const mergedPdf = await PDFDocument.create();
  for (const file of files) {
    const pdfBytes = await file.arrayBuffer();
    const pdf = await PDFDocument.load(pdfBytes);
    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    copiedPages.forEach((page) => mergedPdf.addPage(page));
  }
  return await mergedPdf.save();
}

async function excludePdfPages(file, excludeSpec) {
  const pdfBytes = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const totalPages = pdfDoc.getPageCount();
  const pagesToExclude = new Set();
  
  excludeSpec.split(',').forEach(part => {
    part = part.trim();
    if (part.includes('-')) {
      const [start, end] = part.split('-').map(num => parseInt(num, 10));
      for (let i = start; i <= end; i++) {
        if (i > 0 && i <= totalPages) pagesToExclude.add(i - 1);
      }
    } else {
      const pageNum = parseInt(part, 10);
      if (pageNum > 0 && pageNum <= totalPages) pagesToExclude.add(pageNum - 1);
    }
  });

  const newPdfDoc = await PDFDocument.create();
  const pageIndices = pdfDoc.getPageIndices();
  for (const pageIndex of pageIndices) {
    if (!pagesToExclude.has(pageIndex)) {
      const [copiedPage] = await newPdfDoc.copyPages(pdfDoc, [pageIndex]);
      newPdfDoc.addPage(copiedPage);
    }
  }
  return await newPdfDoc.save();
}


export default function App() {
    const [files, setFiles] = useState([]);
    const [selected, setSelected] = useState([]);
    const [isDragging, setIsDragging] = useState(false);
    const [isDropdownOpen, setDropdownOpen] = useState(false);
    const inputRef = useRef(null);

    const onFiles = useCallback((newFiles) => {
        setFiles((prev) => {
            const updatedFiles = [...prev, ...newFiles];
            if (prev.length === 0 && updatedFiles.length > 0) {
                setSelected([0]);
            }
            return updatedFiles;
        });
    }, []);

    const handleAction = async (action) => {
        setDropdownOpen(false);
        const selFiles = selected.map(i => files[i]).filter(Boolean);
        if (selFiles.length === 0) {
            alert("Please select a file first!");
            return;
        }

        try {
            const file = selFiles[0];
            switch (action) {
                case 'to_png':
                case 'to_jpeg':
                    const targetType = action === 'to_png' ? 'image/png' : 'image/jpeg';
                    const newExtension = action === 'to_png' ? '.png' : '.jpg';
                    for (const f of selFiles.filter(f => f.type.startsWith('image/'))) {
                        const arrayBuffer = await dataURLFromImage(f, targetType);
                        const blob = new Blob([arrayBuffer]);
                        const newName = f.name.replace(/\.[^/.]+$/, "") + newExtension;
                        saveAs(blob, newName);
                    }
                    break;
                case 'images_to_pdf':
                    const imageFiles = selFiles.filter(f => f.type.startsWith('image/'));
                    if (imageFiles.length > 0) {
                        const pdfBytes = await imagesToPdf(imageFiles);
                        saveAs(new Blob([pdfBytes], { type: 'application/pdf' }), 'converted.pdf');
                    } else {
                        alert("Please select image files for this action.");
                    }
                    break;
                case 'pdf_to_jpeg':
                    if (file.type === 'application/pdf') {
                        const images = await pdfToImages(file);
                        images.forEach(({ page, blob }) => saveAs(blob, `${file.name.replace('.pdf', '')}-page-${page}.jpg`));
                    } else {
                        alert("Please select a PDF file for this action.");
                    }
                    break;
                case 'merge_pdfs':
                    const pdfFiles = files.filter(f => f.type === 'application/pdf');
                     if (pdfFiles.length > 1) {
                        const mergedBytes = await mergePdfs(pdfFiles);
                        saveAs(new Blob([mergedBytes], { type: 'application/pdf' }), 'merged.pdf');
                    } else {
                        alert("Please add at least two PDF files to the queue for merging.");
                    }
                    break;
                case 'exclude_pages':
                    if (file.type === 'application/pdf') {
                        const spec = prompt('Enter pages or ranges to exclude (e.g., "1, 4-6")');
                        if (spec) {
                            const resultBytes = await excludePdfPages(file, spec);
                            saveAs(new Blob([resultBytes], { type: 'application/pdf' }), `${file.name.replace('.pdf', '')}-split.pdf`);
                        }
                    } else {
                        alert("Please select a PDF file for this action.");
                    }
                    break;
                default:
                    break;
            }
        } catch (error) {
            console.error("Conversion failed:", error);
            alert(`An error occurred: ${error.message}`);
        }
    };

    const handleDragEnter = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
    const handleDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
    const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); };
    const handleDrop = (e) => {
        e.preventDefault(); e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files?.length) {
            onFiles(Array.from(e.dataTransfer.files));
            e.dataTransfer.clearData();
        }
    };

    return (
        <div className="min-h-screen p-4 sm:p-6 lg:p-12 flex flex-col items-center text-xl font-pixel">
            <div className="w-full max-w-3xl space-y-10">
                <header className="text-center py-4">
                    <h1 className="text-7xl font-bold text-orange-400 tracking-widest animate-pulse">
                        File Convertzz
                    </h1>
                </header>

                <main className="space-y-12">
                    <div
                        onDragEnter={handleDragEnter} onDragLeave={handleDragLeave}
                        onDragOver={handleDragOver} onDrop={handleDrop}
                        onClick={() => inputRef.current?.click()}
                        className={cn(
                            "relative block w-full p-12 text-center transition-all duration-300 cursor-pointer",
                            "border-[3px] border-dashed bg-black/50 backdrop-blur-sm",
                            isDragging ? 'border-orange-400 scale-105' : 'border-orange-400/50'
                        )}
                    >
                        <div className="flex flex-col items-center justify-center space-y-4">
                            <UploadCloud className="h-16 w-16 text-orange-400" />
                            <span className="font-semibold text-neutral-100">
                                {isDragging ? "Release to process..." : "Drop Files or Click to Browse"}
                            </span>
                        </div>
                        <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => onFiles(Array.from(e.target.files))} />
                    </div>

                    {files.length > 0 && (
                        <div className="space-y-6">
                            <div className="flex justify-between items-center">
                                <h2 className="text-4xl text-orange-400">File Queue</h2>
                                <button
                                    onClick={() => { setFiles([]); setSelected([]); }}
                                    className="px-4 py-1 text-base border border-[#333] hover:bg-orange-400 hover:text-black transition-colors"
                                >
                                    Clear All
                                </button>
                            </div>
                            <div className="space-y-2 max-h-[30vh] overflow-y-auto pr-2">
                                {files.map((file, idx) => (
                                    <div className="relative flex items-center w-full overflow-hidden" key={idx}>
                                        <input type="radio" id={`file-${idx}`} name="file-selection"
                                            className="hidden peer"
                                            checked={selected.includes(idx)}
                                            onChange={() => setSelected([idx])} />
                                        <label htmlFor={`file-${idx}`} className="w-full p-2 cursor-pointer flex items-center z-10 text-neutral-100 text-lg border border-[#333] bg-black/50 backdrop-blur-sm peer-checked:text-orange-400 transition-colors">
                                            <div className="flex items-center gap-4 w-full px-4">
                                                <FileIcon className="w-6 h-6 text-orange-400 flex-shrink-0" />
                                                <div className="flex-1 min-w-0 text-left">
                                                    <p className="font-medium truncate" title={file.name}>{file.name}</p>
                                                    <p className="text-sm text-gray-400">{(file.size / 1024).toFixed(1)} KB</p>
                                                </div>
                                                <button
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        setFiles(files.filter((_, i) => i !== idx));
                                                        setSelected(selected.filter(i => i !== idx).map(i => i > idx ? i - 1 : i));
                                                    }}
                                                    className="p-1 rounded-full hover:bg-white/10 transition-colors"
                                                >
                                                    <X className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </label>
                                        <div className="absolute top-0 left-0 h-full w-full block z-0 opacity-0 peer-checked:opacity-100 transition-opacity duration-200" style={{
                                            '--b': '2px', '--c': '#fb923c', '--g': '#0000 90deg, var(--c) 0',
                                            background: 'conic-gradient(from 90deg at var(--b) var(--b),var(--g)) 0 0/calc(100% - var(--b)) calc(100% - var(--b)) border-box'
                                        }}></div>
                                    </div>
                                ))}
                            </div>

                            <div className="relative">
                                <button
                                    onClick={() => setDropdownOpen(!isDropdownOpen)}
                                    className="w-full flex items-center justify-between p-4 bg-black/50 border border-[#333] text-lg"
                                >
                                    Select an Action...
                                    <ChevronDown className={cn("w-6 h-6 transition-transform", isDropdownOpen && "rotate-180")} />
                                </button>
                                {isDropdownOpen && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-[#1a1a1a] border border-[#333] z-10">
                                        <h3 className="p-3 text-sm text-gray-400">Image Tools</h3>
                                        <button onClick={() => handleAction('to_png')} className="block w-full text-left p-3 hover:bg-orange-400 hover:text-black transition-colors">Convert to PNG</button>
                                        <button onClick={() => handleAction('to_jpeg')} className="block w-full text-left p-3 hover:bg-orange-400 hover:text-black transition-colors">Convert to JPEG</button>
                                        <button onClick={() => handleAction('images_to_pdf')} className="block w-full text-left p-3 hover:bg-orange-400 hover:text-black transition-colors">Images to PDF</button>
                                        <div className="border-t border-[#333] my-1"></div>
                                        <h3 className="p-3 text-sm text-gray-400">PDF Tools</h3>
                                        <button onClick={() => handleAction('pdf_to_jpeg')} className="block w-full text-left p-3 hover:bg-orange-400 hover:text-black transition-colors">PDF to JPEGs</button>
                                        <button onClick={() => handleAction('merge_pdfs')} className="block w-full text-left p-3 hover:bg-orange-400 hover:text-black transition-colors">Merge PDFs</button>
                                        <button onClick={() => handleAction('exclude_pages')} className="block w-full text-left p-3 hover:bg-orange-400 hover:text-black transition-colors">Exclude Pages</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}
