import { Star } from 'lucide-react';

export default function RatingStars({
  rating = 0,
  maxStars = 5,
  size = 16,
  interactive = false,
  onChange,
}) {
  const roundedRating = Math.round(rating * 10) / 10;

  return (
    <div className="flex items-center space-x-1" role={interactive ? 'radiogroup' : 'img'} aria-label={`Rating: ${roundedRating} out of ${maxStars}`}>
      {[...Array(maxStars)].map((_, i) => {
        const starValue = i + 1;
        const isFilled = starValue <= Math.round(rating);

        if (interactive) {
          return (
            <button
              key={i}
              type="button"
              onClick={() => onChange && onChange(starValue)}
              className="p-0.5 focus:outline-none focus:ring-2 focus:ring-[#1F3A5F] rounded transition-transform hover:scale-110"
              aria-label={`${starValue} star${starValue > 1 ? 's' : ''}`}
            >
              <Star
                size={size}
                className={
                  isFilled
                    ? 'fill-[#D97706] text-[#D97706]'
                    : 'text-gray-300 hover:text-[#D97706]'
                }
              />
            </button>
          );
        }

        return (
          <Star
            key={i}
            size={size}
            className={isFilled ? 'fill-[#D97706] text-[#D97706]' : 'text-gray-300'}
          />
        );
      })}
    </div>
  );
}
