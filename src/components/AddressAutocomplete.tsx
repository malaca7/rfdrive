import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { MapPin, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Suggestion {
  display_name: string;
  short: string;
  lat: string;
  lon: string;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (coords: { lat: number; lon: number }) => void;
  placeholder?: string;
  className?: string;
}

const DEBOUNCE_MS = 600;

function shortenAddress(display: string): string {
  // Keep first 2-3 meaningful parts, drop country/state/region noise
  const parts = display.split(',').map((p) => p.trim());
  const meaningful = parts.slice(0, 3).join(', ');
  return meaningful.length > 60 ? meaningful.slice(0, 57) + '...' : meaningful;
}

const AddressAutocomplete: React.FC<AddressAutocompleteProps> = ({
  value,
  onChange,
  onSelect,
  placeholder,
  className,
}) => {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const skipNextFetch = useRef(false);

  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.length < 3) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    const hasFull = /cabo de santo agostinho/i.test(query);
    const q = hasFull ? query : `${query}, Cabo de Santo Agostinho, Pernambuco`;

    setIsLoading(true);
    try {
      const url =
        `https://nominatim.openstreetmap.org/search?` +
        new URLSearchParams({
          q,
          format: 'json',
          limit: '5',
          countrycodes: 'br',
          addressdetails: '1',
        });

      const res = await fetch(url, {
        headers: { 'User-Agent': 'LocaliZZou/1.0 (ride-app)' },
      });

      if (!res.ok) return;

      const data = await res.json();
      const items: Suggestion[] = (data || []).map((item: any) => ({
        display_name: item.display_name,
        short: shortenAddress(item.display_name),
        lat: item.lat,
        lon: item.lon,
      }));

      setSuggestions(items);
      setIsOpen(items.length > 0);
      setActiveIdx(-1);
    } catch (_e) {
      // silent fail
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val);

    if (skipNextFetch.current) {
      skipNextFetch.current = false;
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => fetchSuggestions(val), DEBOUNCE_MS);
  };

  const selectSuggestion = (s: Suggestion) => {
    skipNextFetch.current = true;
    onChange(s.short);
    onSelect?.({ lat: parseFloat(s.lat), lon: parseFloat(s.lon) });
    setSuggestions([]);
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault();
      selectSuggestion(suggestions[activeIdx]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Cleanup timer
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Input
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setIsOpen(true)}
          placeholder={placeholder}
          className={cn('h-12 text-base pr-9', className)}
          autoComplete="off"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
          {suggestions.map((s, i) => (
            <button
              key={`${s.lat}-${s.lon}`}
              type="button"
              className={cn(
                'w-full text-left px-3 py-2.5 flex items-start gap-2 text-sm transition-colors',
                i === activeIdx
                  ? 'bg-accent/10 text-accent-foreground'
                  : 'hover:bg-muted/50',
              )}
              onMouseEnter={() => setActiveIdx(i)}
              onClick={() => selectSuggestion(s)}
            >
              <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
              <span className="line-clamp-2">{s.short}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default AddressAutocomplete;
