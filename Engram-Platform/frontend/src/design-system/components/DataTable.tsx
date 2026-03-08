'use client';
import { ChevronDown, ChevronsUpDown, ChevronUp } from 'lucide-react';
import { memo, useState } from 'react';
import { cn } from '@/src/lib/utils';

export interface Column<T> {
  key: keyof T | string;
  header: string;
  sortable?: boolean;
  render?: (row: T) => React.ReactNode;
}

/** Look for common *_id fields on a row object and return the first truthy value. */
function extractIdKey(row: Record<string, unknown>): string | undefined {
  for (const key of Object.keys(row)) {
    if (key.endsWith('_id') && row[key]) return String(row[key]);
  }
  return undefined;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  /** Extract a stable, unique key for each row. Falls back to common _id fields or index. */
  getRowKey?: (row: T, index: number) => string;
  pageSize?: number;
  className?: string;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
}

function DataTableComponent<T extends Record<string, unknown>>({
  columns,
  data,
  getRowKey,
  pageSize = 20,
  className,
  emptyMessage = 'No data',
  onRowClick,
}: DataTableProps<T>) {
  const [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const sorted = sortKey
    ? [...data].sort((a, b) => {
        const av = a[sortKey];
        const bv = b[sortKey];
        const cmp = String(av).localeCompare(String(bv));
        return sortDir === 'asc' ? cmp : -cmp;
      })
    : data;

  const paged = sorted.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(data.length / pageSize);

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  return (
    <div
      className={cn(
        'w-full border border-[#1e1e3a] rounded-xl overflow-hidden bg-[#0d0d1a]',
        className,
      )}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-black/10 border-b border-[#1e1e3a]">
            <tr>
              {columns.map((col) => (
                <th
                  key={String(col.key)}
                  className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-[#5c5878]"
                >
                  {col.sortable ? (
                    <button
                      type="button"
                      onClick={() => handleSort(String(col.key))}
                      className="flex items-center gap-1 hover:text-[#f0eef8] transition-colors"
                    >
                      {col.header}
                      {sortKey === col.key ? (
                        sortDir === 'asc' ? (
                          <ChevronUp className="w-3 h-3 text-[#F2A93B]" />
                        ) : (
                          <ChevronDown className="w-3 h-3 text-[#F2A93B]" />
                        )
                      ) : (
                        <ChevronsUpDown className="w-3 h-3 opacity-40" />
                      )}
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e1e3a]/50">
            {paged.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center justify-center text-[#5c5878]">
                    <div className="w-12 h-12 rounded-full bg-[#1e1e3a]/30 flex items-center justify-center mb-3">
                      <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        className="opacity-40"
                        role="img"
                        aria-label="No data"
                      >
                        <title>No data</title>
                        <path
                          d="M21 21L15 15M17 10C17 13.866 13.866 17 10 17C6.13401 17 3 13.866 3 10C3 6.13401 6.13401 3 10 3C13.866 3 17 6.13401 17 10Z"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                    <p className="text-sm font-medium">{emptyMessage}</p>
                  </div>
                </td>
              </tr>
            ) : (
              paged.map((row, i) => {
                const globalIndex = page * pageSize + i;
                const rowKey = getRowKey
                  ? getRowKey(row, globalIndex)
                  : row.id
                    ? String(row.id)
                    : (extractIdKey(row) ?? `row-${globalIndex}`);
                return (
                  <tr
                    key={rowKey}
                    onClick={() => onRowClick?.(row)}
                    className={cn(
                      'transition-all duration-200 border-b border-[#1e1e3a]/30 last:border-0',
                      onRowClick
                        ? 'hover:bg-[#2EC4C4]/5 cursor-pointer hover:border-[#2EC4C4]/20 relative group'
                        : 'hover:bg-[#1e1e3a]/30',
                    )}
                  >
                    {columns.map((col) => (
                      <td key={String(col.key)} className="px-4 py-3 text-[#a09bb8]">
                        {col.render ? col.render(row) : String(row[String(col.key)] ?? '')}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-[#1e1e3a] bg-black/10">
          <span className="text-xs text-[#5c5878]">
            Page {page + 1} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1 text-xs rounded bg-[#1e1e3a]/50 text-[#a09bb8] disabled:opacity-40 hover:bg-[#1e1e3a] hover:text-[#f0eef8] transition-colors"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              className="px-3 py-1 text-xs rounded bg-[#1e1e3a]/50 text-[#a09bb8] disabled:opacity-40 hover:bg-[#1e1e3a] hover:text-[#f0eef8] transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export const DataTable = memo(DataTableComponent) as typeof DataTableComponent;
