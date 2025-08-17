import { useCallback, useRef, useState } from 'react';
import { saveAs } from 'file-saver';
import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import { UploadCloud, X, ChevronDown } from 'lucide-react';
import './App.css';

// Setup PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

// --- FULLY FUNCTIONAL CONVERSION LOGIC ---
// ... (All the conversion functions like imagesToPdf, pdfToImages, etc.)
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
    const embeddedImage = file.type === 'image/png'
      ? await pdfDoc.embedPng(arrayBuffer)
      : await pdfDoc.embedJpg(arrayBuffer);
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
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    const context = canvas.getContext('2d');
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
            let [start, end] = part.split('-').map(num => parseInt(num, 10));
            if (start > end) [start, end] = [end, start];
            for (let i = start; i <= end; i++) {
                if (i > 0 && i <= totalPages) pagesToExclude.add(i - 1);
            }
        } else {
            const pageNum = parseInt(part, 10);
            if (pageNum > 0 && pageNum <= totalPages) pagesToExclude.add(pageNum - 1);
        }
    });

    if (pagesToExclude.size === totalPages) {
        throw new Error("Cannot exclude all pages from the document.");
    }

    const newPdfDoc = await PDFDocument.create();
    const pageIndices = pdfDoc.getPageIndices().filter(i => !pagesToExclude.has(i));
    const copiedPages = await newPdfDoc.copyPages(pdfDoc, pageIndices);
    copiedPages.forEach(page => newPdfDoc.addPage(page));
    
    return await newPdfDoc.save();
}


// --- UI COMPONENTS ---

const FileQueue = ({ files, selected, setSelected, setFiles }) => {
  const handleSelection = (idx) => {
    setSelected(prevSelected => {
      if (prevSelected.includes(idx)) {
        return prevSelected.filter(i => i !== idx); // Unselect
      } else {
        return [...prevSelected, idx]; // Select
      }
    });
  };

  return (
    <div className="flex flex-col min-h-0">
      <div className="file-queue-header">
        <h2 className="file-queue-title">File Queue</h2>
        <button onClick={() => { setFiles([]); setSelected([]); }} className="clear-all-btn">
          Clear All
        </button>
      </div>
      <div className="file-list-container">
        <div className="uiverse-pixel-checkbox-group">
          {files.map((file, idx) => (
            <label className="uiverse-pixel-checkbox" key={idx}>
              <input
                type="checkbox"
                name="file-selection"
                checked={selected.includes(idx)}
                onChange={() => handleSelection(idx)}
              />
              <div className="file-details">
                <div className="file-info">
                  <p title={file.name}>{file.name}</p>
                  <p className="file-size">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
                <span className="file-format">{file.name.split('.').pop()}</span>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    setFiles(files.filter((_, i) => i !== idx));
                    // Adjust selected indices after removing a file
                    setSelected(prev => prev
                        .map(i => {
                            if (i === idx) return -1; // Mark for removal
                            if (i > idx) return i - 1; // Decrement
                            return i;
                        })
                        .filter(i => i !== -1)
                    );
                  }}
                  className="remove-file-btn"
                >
                  <X size={20} />
                </button>
              </div>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
};

const ActionDropdown = ({ onAction }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (action) => {
    onAction(action);
    setIsOpen(false);
  };

  return (
    <div className="dropdown-wrapper">
      <button onClick={() => setIsOpen(!isOpen)} className={`dropdown-button ${isOpen ? 'open' : ''}`}>
        Select an Action...
        <ChevronDown />
      </button>
      {isOpen && (
        <div className="dropdown-menu">
          <h3>Image Tools</h3>
          <button onClick={() => handleSelect('to_png')} className="dropdown-item">Convert to PNG</button>
          <button onClick={() => handleSelect('to_jpeg')} className="dropdown-item">Convert to JPEG</button>
          <button onClick={() => handleSelect('images_to_pdf')} className="dropdown-item">Images to PDF</button>
          <div className="dropdown-divider"></div>
          <h3>PDF Tools</h3>
          <button onClick={() => handleSelect('pdf_to_jpeg')} className="dropdown-item">PDF to JPEGs</button>
          <button onClick={() => handleSelect('merge_pdfs')} className="dropdown-item">Merge PDFs</button>
          <button onClick={() => handleSelect('exclude_pages')} className="dropdown-item">Exclude Pages</button>
        </div>
      )}
    </div>
  );
};


export default function App() {
    const [files, setFiles] = useState([]);
    const [selected, setSelected] = useState([]);
    const [isDragging, setIsDragging] = useState(false);
    const inputRef = useRef(null);

    const onFiles = useCallback((newFiles) => {
        setFiles((prev) => [...prev, ...newFiles]);
    }, []);

    const handleAction = async (action) => {
        const selFiles = selected.map(i => files[i]).filter(Boolean);
        if (selFiles.length === 0) {
            alert("Please select a file first!");
            return;
        }

        try {
            const file = selFiles[0]; // For single-file actions
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
                    } else { alert("Please select image files for this action."); }
                    break;
                case 'pdf_to_jpeg':
                    if (file.type === 'application/pdf') {
                        const images = await pdfToImages(file);
                        images.forEach(({ page, blob }) => saveAs(blob, `${file.name.replace('.pdf', '')}-page-${page}.jpg`));
                    } else { alert("Please select a PDF file for this action."); }
                    break;
                case 'merge_pdfs':
                    const pdfFiles = files.filter(f => f.type === 'application/pdf');
                     if (pdfFiles.length > 1) {
                        const mergedBytes = await mergePdfs(pdfFiles);
                        saveAs(new Blob([mergedBytes], { type: 'application/pdf' }), 'merged.pdf');
                    } else { alert("Please add at least two PDF files to the queue for merging."); }
                    break;
                case 'exclude_pages':
                    if (file.type === 'application/pdf') {
                        const spec = prompt('Enter pages or ranges to exclude (e.g., "1, 4-6")');
                        if (spec) {
                            const resultBytes = await excludePdfPages(file, spec);
                            saveAs(new Blob([resultBytes], { type: 'application/pdf' }), `${file.name.replace('.pdf', '')}-split.pdf`);
                        }
                    } else { alert("Please select a PDF file for this action."); }
                    break;
                default: break;
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
        <div className="app-container">
            <div className="content-wrapper">
                <header className="header">
                    <h1 className="header-title">File Convertzz</h1>
                </header>

                <main className="main-content">
                    <div
                        onClick={() => inputRef.current?.click()}
                        onDragEnter={handleDragEnter} onDragLeave={handleDragLeave}
                        onDragOver={handleDragOver} onDrop={handleDrop}
                        className={`drop-zone ${isDragging ? 'dragging' : ''}`}
                    >
                        <div className="drop-zone-content">
                            <UploadCloud />
                            <span>{isDragging ? "Release to process..." : "Drop Files or Click to Browse"}</span>
                        </div>
                        <input ref={inputRef} type="file" multiple hidden onChange={(e) => onFiles(Array.from(e.target.files))} />
                    </div>

                    {files.length > 0 && (
                        <div className="queue-and-actions">
                            <FileQueue
                                files={files}
                                selected={selected}
                                setSelected={setSelected}
                                setFiles={setFiles}
                            />
                            <ActionDropdown onAction={handleAction} />
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}
