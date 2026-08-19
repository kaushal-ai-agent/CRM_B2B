import { useEffect, useState } from 'react';
import { logFrontendEvent } from '../lib/customerDebug';

export default function useDebouncedValue(value, delay = 250) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      setDebouncedValue(value);
      logFrontendEvent('Debounced value applied', {
        delay,
        valueLength: String(value).length,
      });
    }, delay);

    return () => window.clearTimeout(timerId);
  }, [value, delay]);

  return debouncedValue;
}
