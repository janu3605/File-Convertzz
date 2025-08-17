import { useCallback, useRef, useState } from 'react';
import { saveAs } from 'file-saver';
import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import { UploadCloud, File as FileIcon, X, ChevronDown } from 'lucide-react';

import './App.css'; // Import your new CSS file
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
            if (start > end) [start, end] = [end, start]; // Swap if out of order
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
        // ... (Your handleAction logic goes here, same as the previous response) ...
    };

    // ... (Your drag and drop handlers go here, same as previous response) ...

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
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div>
                                <div className="file-queue-header">
                                    <h2 className="file-queue-title">File Queue</h2>
                                    <button onClick={() => { setFiles([]); setSelected([]); }} className="clear-all-btn">
                                        Clear All
                                    </button>
                                </div>
                                <div className="file-list">
                                    {files.map((file, idx) => (
                                        <div className="radio-input-wrapper" key={idx}>
                                            <input type="radio" id={`file-${idx}`} name="file-selection"
                                                checked={selected.includes(idx)}
                                                onChange={() => setSelected([idx])} />
                                            <label htmlFor={`file-${idx}`} className="radio-input-label">
                                                <FileIcon className="radio-file-icon" />
                                                <div className="radio-file-info">
                                                    <p title={file.name}>{file.name}</p>
                                                    <p className="file-size">{(file.size / 1024).toFixed(1)} KB</p>
                                                </div>
                                                <button
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        setFiles(files.filter((_, i) => i !== idx));
                                                        setSelected(selected.filter(i => i !== idx).map(i => i > idx ? i - 1 : i));
                                                    }}
                                                    className="remove-file-btn"
                                                >
                                                    <X size={20} />
                                                </button>
                                            </label>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="dropdown-wrapper">
                                <button
                                    onClick={() => setDropdownOpen(!isDropdownOpen)}
                                    className={`dropdown-button ${isDropdownOpen ? 'open' : ''}`}
                                >
                                    Select an Action...
                                    <ChevronDown />
                                </button>
                                {isDropdownOpen && (
                                    <div className="dropdown-menu">
                                        <h3>Image Tools</h3>
                                        <button onClick={() => handleAction('to_png')} className="dropdown-item">Convert to PNG</button>
                                        <button onClick={() => handleAction('to_jpeg')} className="dropdown-item">Convert to JPEG</button>
                                        <button onClick={() => handleAction('images_to_pdf')} className="dropdown-item">Images to PDF</button>
                                        <div className="dropdown-divider"></div>
                                        <h3>PDF Tools</h3>
                                        <button onClick={() => handleAction('pdf_to_jpeg')} className="dropdown-item">PDF to JPEGs</button>
                                        <button onClick={() => handleAction('merge_pdfs')} className="dropdown-item">Merge PDFs</button>
                                        <button onClick={() => handleAction('exclude_pages')} className="dropdown-item">Exclude Pages</button>
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