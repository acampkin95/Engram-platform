import { useCrawlConfig, parseBatchUrls } from'../../hooks/useCrawlConfig';
import ToggleSwitch from'../settings/ToggleSwitch';

export default function URLInput() {
 const { crawlConfig, errors, updateTopLevel } = useCrawlConfig();
 const { isBatchMode, singleUrl, batchUrls } = crawlConfig;

 const batchCount = isBatchMode ? parseBatchUrls(batchUrls).length : 0;

 return (
 <div className="border border-border bg-surface p-5 flex flex-col gap-4">
 <div className="flex items-center justify-between">
 <span className="text-sm font-medium text-text">Input mode</span>
 <ToggleSwitch
 checked={isBatchMode}
 onChange={(v) => updateTopLevel('isBatchMode', v)}
 label={isBatchMode ?'Batch' :'Single'}
 />
 </div>

 {!isBatchMode ? (
 <div className="flex flex-col gap-1.5">
 <label htmlFor="url-single" className="text-sm font-medium text-text">
 URL <span className="text-neon-r" aria-hidden="true">*</span>
 </label>
 <input
 id="url-single"
 type="url"
 value={singleUrl}
 onChange={(e) => updateTopLevel('singleUrl', e.target.value)}
 placeholder="https://example.com"
 aria-invalid={!!errors.singleUrl}
  className={`w-full border px-3 py-2 text-xs font-mono transition-colors
  ${errors.singleUrl
  ?'border-neon-r focus:border-neon-r focus:ring-neon-r'
  :'border-border focus:border-cyan focus:ring-cyan'
  }
  bg-void text-text
 placeholder-text-mute
 focus:outline-none focus:ring-2 focus:ring-opacity-50`}
 />
 {errors.singleUrl && (
 <p role="alert" className="text-xs text-neon-r">{errors.singleUrl}</p>
 )}
 </div>
 ) : (
 <div className="flex flex-col gap-1.5">
 <div className="flex items-center justify-between">
 <label htmlFor="url-batch" className="text-sm font-medium text-text">
 URLs <span className="text-neon-r" aria-hidden="true">*</span>
 </label>
 {batchCount > 0 && (
 <span className="text-xs text-cyan font-medium">
 {batchCount} URL{batchCount !== 1 ?'s' :''}
 </span>
 )}
 </div>
 <p className="text-xs text-text-dim">One URL per line</p>
 <textarea
 id="url-batch"
 value={batchUrls}
 onChange={(e) => updateTopLevel('batchUrls', e.target.value)}
 placeholder={"https://example.com\nhttps://example.org"}
 rows={6}
 aria-invalid={!!errors.batchUrls}
  className={`w-full border px-3 py-2 text-xs font-mono resize-y transition-colors
  ${errors.batchUrls
  ?'border-neon-r focus:border-neon-r focus:ring-neon-r'
  :'border-border focus:border-cyan focus:ring-cyan'
  }
  bg-void text-text
 placeholder-text-mute
 focus:outline-none focus:ring-2 focus:ring-opacity-50`}
 />
 {errors.batchUrls && (
 <p role="alert" className="text-xs text-neon-r">{errors.batchUrls}</p>
 )}
 </div>
 )}
 </div>
 );
}
