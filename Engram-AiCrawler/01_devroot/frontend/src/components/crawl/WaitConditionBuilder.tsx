import { useState } from'react';
import { ChevronDown, ChevronRight, Info } from'lucide-react';
import { useCrawlConfig } from'../../hooks/useCrawlConfig';
import FormInput from'../settings/FormInput';

function InfoTooltip({ text }: { text: string }) {
 return (
 <span className="group relative inline-flex">
 <Info size={14} className="text-text-mute cursor-help" />
 <span className="absolute left-full ml-2 top-1/2 -translate-y-1/2 z-10 hidden group-hover:block
 w-56 bg-void px-3 py-2 text-xs text-text whitespace-normal">
 {text}
 </span>
 </span>
 );
}

export default function WaitConditionBuilder() {
 const [open, setOpen] = useState(false);
 const { crawlConfig, updateConfig } = useCrawlConfig();
 const { waitConditions } = crawlConfig;

 return (
 <div className="border border-border bg-surface overflow-hidden">
 <button
 type="button"
 onClick={() => setOpen((v) => !v)}
  className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-text hover:bg-raised transition-colors"
 >
 <span>Wait Conditions &amp; JavaScript</span>
 {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
 </button>

 {open && (
 <div className="px-5 pb-5 flex flex-col gap-5 border-t border-border pt-4">
 <div className="flex flex-col gap-1.5">
 <div className="flex items-center gap-2">
 <label htmlFor="wait-css-selector" className="text-sm font-medium text-text">Wait for CSS selector</label>
 <InfoTooltip text="Wait for this element to appear in the DOM before extracting content." />
 </div>
 <input
 id="wait-css-selector"
 type="text"
 value={waitConditions.waitForSelector}
 onChange={(e) => updateConfig('waitConditions','waitForSelector', e.target.value)}
 placeholder=".content, #main-article"
  className="w-full border border-border px-3 py-2 text-xs font-mono
  bg-void text-text placeholder-text-mute
  focus:outline-none focus:ring-2 focus:ring-cyan focus:ring-opacity-50 focus:border-cyan transition-colors"
  />
  </div>

  <div className="flex flex-col gap-1.5">
  <div className="flex items-center gap-2">
   <label htmlFor="wait-js-expr" className="text-sm font-medium text-text">Wait for JavaScript expression</label>
   <InfoTooltip text="JavaScript expression that returns true when the page is ready for extraction." />
   </div>
   <input
   id="wait-js-expr"
   type="text"
   value={waitConditions.waitForJs}
  onChange={(e) => updateConfig('waitConditions','waitForJs', e.target.value)}
  placeholder="() => document.readyState ==='complete'"
  className="w-full border border-border px-3 py-2 text-xs font-mono
  bg-void text-text placeholder-text-mute
  focus:outline-none focus:ring-2 focus:ring-cyan focus:ring-opacity-50 focus:border-cyan transition-colors"
 />
 </div>

 <div className="flex flex-col gap-2">
 <div className="flex items-center justify-between">
 <label htmlFor="wait-page-timeout" className="text-sm font-medium text-text">Page timeout</label>
 <span className="text-sm font-semibold text-cyan">
 {waitConditions.pageTimeout}s
 </span>
 </div>
 <input
 id="wait-page-timeout"
 type="range"
 min={5}
 max={120}
 step={5}
 value={waitConditions.pageTimeout}
 onChange={(e) => updateConfig('waitConditions','pageTimeout', Number(e.target.value))}
  className="w-full h-2 bg-raised appearance-none cursor-pointer
 accent-cyan"
 />
 <div className="flex justify-between text-xs text-text-mute">
 <span>5s</span>
 <span>120s</span>
 </div>
 </div>

 <div className="flex flex-col gap-1.5">
 <label htmlFor="wait-custom-js" className="text-sm font-medium text-text">Custom JavaScript code</label>
 <textarea
 id="wait-custom-js"
 value={waitConditions.customJs}
 onChange={(e) => updateConfig('waitConditions','customJs', e.target.value)}
 rows={5}
 placeholder={"// Execute custom JS before extraction\nwindow.scrollTo(0, document.body.scrollHeight);"}
  className="w-full border border-border px-3 py-2 text-xs font-mono resize-y
  bg-void text-text placeholder-text-mute
 focus:outline-none focus:ring-2 focus:ring-cyan focus:ring-opacity-50 focus:border-cyan transition-colors"
 />
 </div>

 <FormInput
 label="Wait after JS (ms)"
 type="number"
 value={waitConditions.waitAfterJs}
 onChange={(e) => updateConfig('waitConditions','waitAfterJs', Number(e.target.value))}
 min={0}
 max={30000}
 step={100}
 description="Milliseconds to wait after JavaScript execution"
 />
 </div>
 )}
 </div>
 );
}
