import { useState } from'react';
import { ChevronDown, ChevronRight, X } from'lucide-react';
import { useCrawlConfig } from'../../hooks/useCrawlConfig';
import type { CacheMode } from'../../hooks/useCrawlConfig';
import ToggleSwitch from'../settings/ToggleSwitch';
import FormInput, { FormSelect } from'../settings/FormInput';

const AVAILABLE_TAGS = ['script','style','nav','footer','aside','header'];

export default function CrawlOptionsPanel() {
 const [open, setOpen] = useState(false);
 const { crawlConfig, updateConfig } = useCrawlConfig();
 const { options } = crawlConfig;

 function toggleTag(tag: string) {
 const next = options.excludedTags.includes(tag)
 ? options.excludedTags.filter((t) => t !== tag)
 : [...options.excludedTags, tag];
 updateConfig('options','excludedTags', next);
 }

 return (
 <div className="border border-border bg-surface overflow-hidden">
 <button
 type="button"
 onClick={() => setOpen((v) => !v)}
  className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-text hover:bg-raised transition-colors"
 >
 <span>Additional Options</span>
 {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
 </button>

 {open && (
 <div className="px-5 pb-5 flex flex-col gap-5 border-t border-border pt-4">
 <ToggleSwitch
 checked={options.screenshot}
 onChange={(v) => updateConfig('options','screenshot', v)}
 label="Screenshot"
 description="Capture a screenshot of the page"
 />

 <ToggleSwitch
 checked={options.pdf}
 onChange={(v) => updateConfig('options','pdf', v)}
 label="PDF generation"
 description="Generate a PDF of the crawled page"
 />

 <FormSelect
 label="Cache mode"
 value={options.cacheMode}
 onChange={(e) => updateConfig('options','cacheMode', e.target.value as CacheMode)}
 >
 <option value="enabled">Enabled</option>
 <option value="bypass">Bypass</option>
 <option value="write_only">Write-Only</option>
 </FormSelect>

 <FormInput
 label="Word count threshold"
 type="number"
 value={options.wordCountThreshold}
 onChange={(e) => updateConfig('options','wordCountThreshold', Math.max(1, Number(e.target.value)))}
 min={1}
 description="Minimum words required per content block"
 />

 <div className="flex flex-col gap-2">
 <label id="excluded-tags-label" className="text-sm font-medium text-text">Excluded tags</label>
 <p className="text-xs text-text-dim">Tags to strip from the extracted content</p>
 <div className="flex flex-wrap gap-2" role="group" aria-labelledby="excluded-tags-label">
 {AVAILABLE_TAGS.map((tag) => {
 const active = options.excludedTags.includes(tag);
 return (
 <button
 key={tag}
 type="button"
 onClick={() => toggleTag(tag)}
 className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan
 ${active
 ?'bg-cyan text-void'
  :'bg-abyss text-text-dim hover:bg-raised'
 }`}
 >
 {`<${tag}>`}
 {active && <X size={11} />}
 </button>
 );
 })}
 </div>
 </div>

 <ToggleSwitch
 checked={options.excludeExternalLinks}
 onChange={(v) => updateConfig('options','excludeExternalLinks', v)}
 label="Exclude external links"
 description="Strip links pointing to other domains"
 />

 <ToggleSwitch
 checked={options.excludeImages}
 onChange={(v) => updateConfig('options','excludeImages', v)}
 label="Exclude images"
 description="Remove image references from extracted content"
 />
 </div>
 )}
 </div>
 );
}
