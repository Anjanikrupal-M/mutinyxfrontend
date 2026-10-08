import { useState, useEffect } from 'react';

/**
 * Debounces a value by the specified delay.
 * Returns the debounced value that only updates after quiet period.
 */
export function useDebounce<T>(value: T, delay = 300): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(timer);
    }, [value, delay]);

    return debouncedValue;
}
