import { useState, useRef, useCallback } from 'react';
import { UploadCloud, FileText, GripVertical } from 'lucide-react';

// This is a custom hook to manage the dragging state of the widget itself
const useDraggable = () => {
  const [position, setPosition] = useState({ x: 50, y: 50 });
  const elementRef = useRef(null);
  const offsetRef = useRef({ x: 0, y: 0 });

  const onMouseDown = (e) => {
    const el = elementRef.current;
    if (!el || !e.target.classList.contains('drag-handle')) return;

    const initialX = e.clientX;
    const initialY = e.clientY;
    const rect = el.getBoundingClientRect();
    offsetRef.current = {
      x: initialX - rect.left,
      y: initialY - rect.top,
    };

    const onMouseMove = (moveEvent) => {
      setPosition({
        x: moveEvent.clientX - offsetRef.current.x,
        y: moveEvent.clientY - offsetRef.current.y,
      });
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  return {
    ref: elementRef,
    style: {
      position: 'fixed',
      left: `${position.x}px`,
      top: `${position.y}px`,
    },
    onMouseDown,
  };
};


export const HoverDropWidget = ({ onFiles, onClose }) => {
  const [droppedFiles, setDroppedFiles] = useState([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const { ref, style, onMouseDown } = useDraggable();

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    if (e.dataTransfer.files?.length) {
      const newFiles = Array.from(e.dataTransfer.files);
      setDroppedFiles(prev => [...prev, ...newFiles]);
      onFiles(newFiles); // Pass files up to the main app
    }
  }, [onFiles]);

  const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); };
  const handleDragEnter = (e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingOver(true); };
  const handleDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingOver(false); };

  return (
    <div
      ref={ref}
      style={style}
      className={`widget-container ${isDraggingOver ? 'dragging-over' : ''}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
    >
      <div className="widget-header drag-handle" onMouseDown={onMouseDown}>
        <GripVertical size={20} className="drag-handle-icon" />
        <span className="drag-handle">Drop Zone</span>
        <button onClick={onClose} className="widget-close-btn">X</button>
      </div>
      <div className="widget-content">
        {droppedFiles.length === 0 ? (
          <div className="widget-placeholder">
            <UploadCloud size={32} />
            <span>Drop files here</span>
          </div>
        ) : (
          <div className="widget-file-grid">
            {droppedFiles.map((file, i) => (
              <div key={i} className="widget-file-icon" title={file.name}>
                <FileText size={24} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
