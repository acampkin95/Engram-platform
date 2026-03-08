import { ImageOff, Loader2, ZoomIn, ZoomOut, RotateCcw } from'lucide-react';
import { useState } from'react';

interface ScreenshotPreviewProps {
 screenshot: string | null;
 isLoading: boolean;
}

export default function ScreenshotPreview({ screenshot, isLoading }: ScreenshotPreviewProps) {
 const [zoom, setZoom] = useState(1);

 const handleZoomIn = () => setZoom((z) => Math.min(z + 0.25, 3));
 const handleZoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.25));
 const handleReset = () => setZoom(1);

 return (
 <div className="flex flex-col h-full">
 <div className="flex items-center justify-between px-3 py-2 border-b border-border">
 <span className="text-xs font-semibold text-text-dim uppercase tracking-wider">
 Screenshot Preview
 </span>
 {screenshot && (
 <div className="flex items-center gap-1">
 <button
 type="button"
 onClick={handleZoomOut}
 disabled={zoom <= 0.25}
 className="p-1 hover:bg-raised text-text-dim disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
 title="Zoom out"
 >
 <ZoomOut size={14} />
 </button>
 <span className="text-xs text-text-dim w-10 text-center tabular-nums">
 {Math.round(zoom * 100)}%
 </span>
 <button
 type="button"
 onClick={handleZoomIn}
 disabled={zoom >= 3}
 className="p-1 hover:bg-raised text-text-dim disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
 title="Zoom in"
 >
 <ZoomIn size={14} />
 </button>
 <button
 type="button"
 onClick={handleReset}
 className="p-1 hover:bg-raised text-text-dim transition-colors"
 title="Reset zoom"
 >
 <RotateCcw size={14} />
 </button>
 </div>
 )}
 </div>

 <div className="flex-1 overflow-auto bg-void min-h-0">
 {isLoading ? (
 <div className="flex flex-col items-center justify-center h-full gap-3 text-text-mute">
 <Loader2 className="h-8 w-8 animate-spin text-cyan" />
 <span className="text-sm">Fetching page screenshot…</span>
 </div>
 ) : screenshot ? (
 <div className="p-2 min-h-full flex items-start justify-center">
 <img
 src={`data:image/png;base64,${screenshot}`}
 alt="Page screenshot"
 className="border border-border transition-transform origin-top-left"
 style={{ transform: `scale(${zoom})`, transformOrigin:'top center' }}
 />
 </div>
 ) : (
 <div className="flex flex-col items-center justify-center h-full gap-3 text-text-mute">
 <ImageOff className="h-10 w-10 opacity-40" />
 <div className="text-center">
 <p className="text-sm font-medium">No screenshot yet</p>
 <p className="text-xs mt-1 opacity-75">Enter a URL and click Fetch Page</p>
 </div>
 </div>
 )}
 </div>
 </div>
 );
}
