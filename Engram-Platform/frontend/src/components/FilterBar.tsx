'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { CalendarIcon, ChevronDown, Filter, Search, SlidersHorizontal, X } from 'lucide-react';
import { useCallback, useState } from 'react';
import type { DateRange } from 'react-day-picker';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { Calendar } from '@/src/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/src/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/src/components/ui/select';
import { Separator } from '@/src/components/ui/separator';
import { Skeleton } from '@/src/components/ui/skeleton';
import { Slider } from '@/src/components/ui/slider';
import { cn } from '@/src/lib/utils';

// ─── Schema ───────────────────────────────────────────────────────────────────

const filterSchema = z.object({
  search: z.string().optional(),
  status: z.string().optional(),
  section: z.string().optional(),
  dateFrom: z.date().optional(),
  dateTo: z.date().optional(),
  scoreRange: z.tuple([z.number().min(0).max(100), z.number().min(0).max(100)]).optional(),
});

export type FilterValues = z.infer<typeof filterSchema>;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StatusOption {
  value: string;
  label: string;
}

export interface FilterConfig {
  showSearch?: boolean;
  showDateRange?: boolean;
  showStatus?: boolean;
  showScoreRange?: boolean;
  showSection?: boolean;
  statusOptions?: StatusOption[];
  sectionOptions?: StatusOption[];
  sectionLabel?: string;
  placeholder?: string;
  onFiltersChange: (filters: FilterValues) => void;
  className?: string;
}

// ─── Shared input class ───────────────────────────────────────────────────────

const inputBase =
  'h-9 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-[#f0eef8] ' +
  'placeholder-[#8580a0] focus:outline-none focus:border-[rgba(242,169,59,0.4)] ' +
  'focus:ring-1 focus:ring-[rgba(242,169,59,0.2)] transition-all duration-150 font-mono';

// ─── FilterBar ────────────────────────────────────────────────────────────────

export function FilterBar({
  showSearch = true,
  showDateRange = false,
  showStatus = false,
  showScoreRange = false,
  showSection = false,
  statusOptions = [],
  sectionOptions = [],
  sectionLabel = 'Section',
  placeholder = 'Search…',
  onFiltersChange,
  className,
}: FilterConfig) {
  const [dateOpen, setDateOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [scoreRange, setScoreRange] = useState<[number, number]>([0, 100]);

  const { control, register, handleSubmit, reset, watch } = useForm<FilterValues>({
    resolver: zodResolver(filterSchema),
    defaultValues: {
      search: '',
      status: '',
      section: '',
      scoreRange: [0, 100],
    },
  });

  const currentSearch = watch('search');
  const currentStatus = watch('status');
  const currentSection = watch('section');

  const hasActiveFilters =
    !!currentSearch ||
    !!currentStatus ||
    !!currentSection ||
    !!dateRange?.from ||
    scoreRange[0] !== 0 ||
    scoreRange[1] !== 100;

  const emitChange = useCallback(
    (values: FilterValues) => {
      onFiltersChange({
        ...values,
        dateFrom: dateRange?.from,
        dateTo: dateRange?.to,
        scoreRange: showScoreRange ? scoreRange : undefined,
      });
    },
    [onFiltersChange, dateRange, scoreRange, showScoreRange],
  );

  const handleClear = useCallback(() => {
    reset({
      search: '',
      status: '',
      section: '',
      scoreRange: [0, 100],
    });
    setDateRange(undefined);
    setScoreRange([0, 100]);
    onFiltersChange({});
  }, [reset, onFiltersChange]);

  // Emit on every field change
  const onSubmit = handleSubmit(emitChange);

  return (
    <form
      onSubmit={onSubmit}
      aria-label="Filter and search"
      className={cn(
        'flex flex-wrap items-center gap-2.5 p-3.5 rounded-xl',
        'bg-[#090818] border border-white/[0.06]',
        className,
      )}
    >
      {/* Filter icon label */}
      <div className="flex items-center gap-1.5 text-[#8580a0] shrink-0">
        <Filter className="w-3.5 h-3.5" aria-hidden="true" />
        <span className="text-[10px] font-mono uppercase tracking-widest">Filters</span>
      </div>

      <Separator orientation="vertical" className="h-5 bg-white/[0.06]" />

      {/* ── Search ── */}
      {showSearch && (
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8580a0]"
            aria-hidden="true"
          />
          <input
            {...register('search')}
            placeholder={placeholder}
            onChange={(e) => {
              void register('search').onChange(e);
              void handleSubmit(emitChange)();
            }}
            className={cn(inputBase, 'pl-8 pr-3 w-full')}
            aria-label="Search"
            aria-describedby="search-help"
          />
          <span id="search-help" className="sr-only">
            Enter keywords to search
          </span>
        </div>
      )}

      {/* ── Status Select ── */}
      {showStatus && statusOptions.length > 0 && (
        <Controller
          name="status"
          control={control}
          render={({ field }) => (
            <Select
              value={field.value ?? ''}
              onValueChange={(v) => {
                field.onChange(v);
                void handleSubmit(emitChange)();
              }}
            >
              <SelectTrigger
                className={cn(inputBase, 'w-[140px] px-3 [&>svg]:text-[#8580a0]')}
                aria-label="Status filter"
              >
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-[#0c0b1c] border-white/[0.08] text-[#f0eef8]">
                <SelectItem value="" className="text-[#8580a0] focus:bg-white/[0.06]">
                  All statuses
                </SelectItem>
                {statusOptions.map((opt) => (
                  <SelectItem
                    key={opt.value}
                    value={opt.value}
                    className="focus:bg-white/[0.06] focus:text-[#f0eef8]"
                  >
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      )}

      {/* ── Section Select ── */}
      {showSection && sectionOptions.length > 0 && (
        <Controller
          name="section"
          control={control}
          render={({ field }) => (
            <Select
              value={field.value ?? ''}
              onValueChange={(v) => {
                field.onChange(v);
                void handleSubmit(emitChange)();
              }}
            >
              <SelectTrigger
                className={cn(inputBase, 'w-[140px] px-3 [&>svg]:text-[#8580a0]')}
                aria-label={`${sectionLabel} filter`}
              >
                <SelectValue placeholder={sectionLabel} />
              </SelectTrigger>
              <SelectContent className="bg-[#0c0b1c] border-white/[0.08] text-[#f0eef8]">
                <SelectItem value="" className="text-[#8580a0] focus:bg-white/[0.06]">
                  All {sectionLabel.toLowerCase()}s
                </SelectItem>
                {sectionOptions.map((opt) => (
                  <SelectItem
                    key={opt.value}
                    value={opt.value}
                    className="focus:bg-white/[0.06] focus:text-[#f0eef8]"
                  >
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      )}

      {/* ── Date Range Picker ── */}
      {showDateRange && (
        <Popover open={dateOpen} onOpenChange={setDateOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                inputBase,
                'flex items-center gap-2 px-3 w-[200px] cursor-pointer',
                dateRange?.from && 'border-[rgba(242,169,59,0.3)] text-[#F2A93B]',
              )}
              aria-label="Select date range"
              aria-expanded={dateOpen}
            >
              <CalendarIcon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate text-xs">
                {dateRange?.from
                  ? dateRange.to
                    ? `${format(dateRange.from, 'MMM d')} – ${format(dateRange.to, 'MMM d, yy')}`
                    : format(dateRange.from, 'MMM d, yyyy')
                  : 'Date range'}
              </span>
              <ChevronDown className="w-3 h-3 ml-auto text-[#8580a0]" aria-hidden="true" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 bg-[#0c0b1c] border-white/[0.08]" align="start">
            <Calendar
              mode="range"
              selected={dateRange}
              onSelect={(range) => {
                setDateRange(range);
                if (range?.from && range?.to) {
                  setDateOpen(false);
                  void handleSubmit(emitChange)();
                }
              }}
              numberOfMonths={2}
              className="text-[#f0eef8]"
            />
          </PopoverContent>
        </Popover>
      )}

      {/* ── Score Range Slider ── */}
      {showScoreRange && (
        <fieldset
          className="flex items-center gap-3 min-w-[200px] border-0 p-0 m-0"
          aria-label="Score range filter"
        >
          <div className="flex items-center gap-1.5 shrink-0">
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#8580a0]" aria-hidden="true" />
            <span className="text-[10px] font-mono text-[#8580a0] uppercase tracking-wider whitespace-nowrap">
              Score {scoreRange[0]}–{scoreRange[1]}%
            </span>
          </div>
          <Slider
            min={0}
            max={100}
            step={5}
            value={scoreRange}
            onValueChange={(v) => {
              const range = v as [number, number];
              setScoreRange(range);
              void handleSubmit((vals) => emitChange({ ...vals, scoreRange: range }))();
            }}
            className="w-32"
            aria-label="Score range slider"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={scoreRange[0]}
          />
        </fieldset>
      )}

      {/* ── Clear button ── */}
      {hasActiveFilters && (
        <button
          type="button"
          onClick={handleClear}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono',
            'text-[#8580a0] hover:text-[#FF6B6B] hover:bg-[rgba(255,107,107,0.08)]',
            'border border-transparent hover:border-[rgba(255,107,107,0.2)]',
            'transition-all duration-150',
          )}
          aria-label="Clear all filters"
        >
          <X className="w-3 h-3" />
          Clear
        </button>
      )}
    </form>
  );
}

// ─── FilterBar Skeleton ───────────────────────────────────────────────────────

export function FilterBarSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex items-center gap-2.5 p-3.5 rounded-xl bg-[#090818] border border-white/[0.06]',
        className,
      )}
    >
      <Skeleton className="h-4 w-4 rounded bg-white/[0.04]" />
      <Skeleton className="h-5 w-px bg-white/[0.06]" />
      <Skeleton className="h-9 w-48 rounded-lg bg-white/[0.04]" />
      <Skeleton className="h-9 w-32 rounded-lg bg-white/[0.04]" />
      <Skeleton className="h-9 w-40 rounded-lg bg-white/[0.04]" />
    </div>
  );
}
