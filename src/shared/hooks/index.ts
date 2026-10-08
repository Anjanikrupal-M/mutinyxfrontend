import { useMediaQuery } from './useMobile';
export { useDebounce } from './useDebounce';

export { useMediaQuery };

export function useMobile() {
    return useMediaQuery('(max-width: 768px)');
}
