import React from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StarRatingProps {
  value: number;
  onChange?: (value: number) => void;
  size?: 'sm' | 'md' | 'lg';
  readOnly?: boolean;
}

const sizes = {
  sm: 'w-4 h-4',
  md: 'w-7 h-7',
  lg: 'w-9 h-9',
};

const StarRating: React.FC<StarRatingProps> = ({
  value,
  onChange,
  size = 'md',
  readOnly = false,
}) => {
  return (
    <div className={cn('flex gap-1', readOnly ? '' : 'cursor-pointer')}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readOnly}
          onClick={() => onChange?.(star)}
          className={cn(
            'transition-transform',
            !readOnly && 'hover:scale-110 active:scale-95',
            readOnly && 'cursor-default',
          )}
        >
          <Star
            className={cn(
              sizes[size],
              'transition-colors',
              star <= value
                ? 'fill-yellow-400 text-yellow-400'
                : 'fill-transparent text-muted-foreground/40',
            )}
          />
        </button>
      ))}
    </div>
  );
};

export default StarRating;
