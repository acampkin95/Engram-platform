import { useState, useCallback } from'react';
import { Download, ZoomIn, ZoomOut, RotateCcw, ChevronLeft, ChevronRight } from'lucide-react';

interface ScreenshotViewerProps {
 screenshots: string[];
 crawlId: string;
}

export default function ScreenshotViewer({ screenshots, crawlId }: ScreenshotViewerProps) {
 const [activeIndex, setActiveIndex] = useState(0);
 const [zoom, setZoom] = useState(1);
 const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
 const [isDragging, setIsDragging] = useState(false);
 const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

 const activeShot = screenshots[activeIndex];

 const handleZoomIn = () => setZoom((z) => Math.min(z + 0.25, 3));
 const handleZoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.25));
 const handleReset = () => {
 setZoom(1);
 setPanOffset({ x: 0, y: 0 });
 };

 const handleMouseDown = useCallback((e: React.MouseEvent) => {
 if (zoom <= 1) return;
 setIsDragging(true);
 setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
 }, [zoom, panOffset]);

 const handleMouseMove = useCallback((e: React.MouseEvent) => {
 if (!isDragging) return;
 setPanOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
 }, [isDragging, dragStart]);

 const handleMouseUp = useCallback(() => setIsDragging(false), []);

 const handleDownload = () => {
 const link = document.createElement('a');
 link.href = activeShot.startsWith('data:') ? activeShot : `/api/crawl/${crawlId}/screenshot/${activeIndex}`;
 link.download = `screenshot-${crawlId}-${activeIndex + 1}.png`;
 link.click();
 };

 const navigatePrev = () => {
 setActiveIndex((i) => Math.max(i - 1, 0));
 handleReset();
 };

 const navigateNext = () => {
 setActiveIndex((i) => Math.min(i + 1, screenshots.length - 1));
 handleReset();
 };

 const imageSrc = activeShot.startsWith('data:')
 ? activeShot
 : `data:image/png;base64,${activeShot}`;

 return (
 <div className="h-full flex flex-col gap-3">
 <div className="flex items-center justify-between flex-shrink-0">
 <div className="flex items-center gap-2">
 <button
 type="button"
 onClick={handleZoomOut}
 disabled={zoom <= 0.25}
 className="p-2 bg-abyss hover:bg-border disabled:opacity-40 transition-colors"
 title="Zoom out"
 >
 <ZoomOut size={16} />
 </button>
 <span className="text-sm text-text-dim w-14 text-center font-mono">
 {Math.round(zoom * 100)}%
 </span>
 <button
 type="button"
 onClick={handleZoomIn}
 disabled={zoom >= 3}
 className="p-2 bg-abyss hover:bg-border disabled:opacity-40 transition-colors"
 title="Zoom in"
 >
 <ZoomIn size={16} />
 </button>
 <button
 type="button"
 onClick={handleReset}
 className="p-2 bg-abyss hover:bg-border transition-colors"
 title="Reset view"
 >
 <RotateCcw size={16} />
 </button>
 </div>

 <div className="flex items-center gap-2">
 {screenshots.length > 1 && (
 <span className="text-sm text-text-dim">
 {activeIndex + 1} / {screenshots.length}
 </span>
 )}
 <button
 type="button"
 onClick={handleDownload}
  className="flex items-center gap-1.5 px-3 py-2 text-sm bg-cyan hover:bg-cyan-dim text-void transition-colors"
 >
 <Download size={14} />
 Download
 </button>
 </div>
 </div>

 <div
 className="flex-1 overflow-hidden bg-abyss relative"
 style={{ cursor: zoom > 1 ? (isDragging ?'grabbing' :'grab') :'default' }}
 onMouseDown={handleMouseDown}
 onMouseMove={handleMouseMove}
 onMouseUp={handleMouseUp}
 onMouseLeave={handleMouseUp}
 >
 <div
 className="absolute inset-0 flex items-center justify-center"
 style={{
 transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
 transformOrigin:'center',
 transition: isDragging ?'none' :'transform 0.2s ease',
 }}
 >
 <img
 src={imageSrc}
 alt={`Screenshot ${activeIndex + 1}`}
 className="max-w-full max-h-full object-contain select-none"
 draggable={false}
 />
 </div>

 {screenshots.length > 1 && (
 <>
 <button
 type="button"
 onClick={navigatePrev}
 disabled={activeIndex === 0}
 className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/70 text-text rounded-full disabled:opacity-30 transition-colors z-10"
 >
 <ChevronLeft size={20} />
 </button>
 <button
 type="button"
 onClick={navigateNext}
 disabled={activeIndex === screenshots.length - 1}
 className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/70 text-text rounded-full disabled:opacity-30 transition-colors z-10"
 >
 <ChevronRight size={20} />
 </button>
 </>
 )}
 </div>

 {screenshots.length > 1 && (
 <div className="flex gap-2 overflow-x-auto flex-shrink-0 pb-1">
 {screenshots.map((shot, i) => {
 const thumbSrc = shot.startsWith('data:') ? shot : `data:image/png;base64,${shot}`;
 return (
 <button
 key={i}
 type="button"
 onClick={() => { setActiveIndex(i); handleReset(); }}
 className={`flex-shrink-0 w-16 h-12 border-2 overflow-hidden transition-colors ${
 i === activeIndex
 ?'border-cyan'
 :'border-transparent hover:border-border-hi'
 }`}
 >
 <img
 src={thumbSrc}
 alt={`Thumbnail ${i + 1}`}
 className="w-full h-full object-cover"
 />
 </button>
 );
 })}
 </div>
 )}
 </div>
 );
}
