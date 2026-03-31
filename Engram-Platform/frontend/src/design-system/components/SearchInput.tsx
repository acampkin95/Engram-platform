'use client';
import { Search, X } from 'lucide-react';
import { memo, useEffect, useRef, useState } from 'react';
import { Input } from './Input';

interface SearchInputProps {
  value?: string;
  onChange?: (value: string) => void;
  onSearch?: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
  className?: string;
}

export const SearchInput = memo(function SearchInput({
  value: controlled,
  onChange,
  onSearch,
  placeholder = 'Search...',
  debounceMs = 300,
  className,
}: Readonly<SearchInputProps>) {
  const [internal, setInternal] = useState(controlled ?? '');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (controlled !== undefined) setInternal(controlled);
  }, [controlled]);

  const handleChange = (v: string) => {
    setInternal(v);
    onChange?.(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onSearch?.(v), debounceMs);
  };

  return (
    <div className="relative">
      <Input
        type="text"
        value={internal}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onSearch?.(internal)}
        placeholder={placeholder}
        prefixIcon={<Search className="w-4 h-4" />}
        className={className}
        mono
      />
      {internal && (
        <button
          type="button"
          onClick={() => handleChange('')}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8580a0] hover:text-[#f0eef8] transition-colors p-1 rounded-md hover:bg-[#1e1e3a]/50"
          aria-label="Clear search"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
});
