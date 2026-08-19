import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchCustomers, fetchCustomersByUrl } from '../api/client';
import {
  logCustomerError,
  logCustomerRequest,
  logCustomerResponse,
  logCustomerWarning,
} from '../lib/customerDebug';

function getErrorMessage(error) {
  return error?.response?.data?.detail || error?.message || 'Failed to load customers';
}

export default function useCustomerDirectory(query) {
  const [customers, setCustomers] = useState([]);
  const [count, setCount] = useState(0);
  const [nextUrl, setNextUrl] = useState(null);
  const [previousUrl, setPreviousUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const requestIdRef = useRef(0);
  const latestQueryRef = useRef(query);

  const loadFirstPage = useCallback(async (params = latestQueryRef.current) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setLoading(true);
    setError(null);
    logCustomerRequest('useCustomerDirectory.loadFirstPage', { params });

    try {
      const response = await fetchCustomers(params);

      // A newer request (or cleanup) owns the state once this ID changes.
      if (requestId !== requestIdRef.current) {
        return;
      }

      setCustomers(response.results || []);
      setCount(response.count || 0);
      setNextUrl(response.next || null);
      setPreviousUrl(response.previous || null);

      logCustomerResponse('useCustomerDirectory.loadFirstPage', {
        count: response.count || 0,
        resultCount: (response.results || []).length,
        query: params,
      });

      if ((response.results || []).length === 0) {
        logCustomerWarning('useCustomerDirectory.loadFirstPage', {
          message: 'No customers were stored in React state after the initial fetch',
          query: params,
        });
      }
    } catch (loadError) {
      if (requestId !== requestIdRef.current) {
        return;
      }

      setCustomers([]);
      setCount(0);
      setNextUrl(null);
      setPreviousUrl(null);
      logCustomerError('useCustomerDirectory.loadFirstPage', {
        message: loadError?.message,
        query: params,
      });
      setError(getErrorMessage(loadError));
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  const loadPageByUrl = useCallback(async (url) => {
    if (!url) {
      logCustomerWarning('useCustomerDirectory.loadPageByUrl', {
        message: 'Pagination requested without a URL',
      });
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setLoading(true);
    setError(null);
    logCustomerRequest('useCustomerDirectory.loadPageByUrl', { url });

    try {
      const response = await fetchCustomersByUrl(url);

      if (requestId !== requestIdRef.current) {
        return;
      }

      setCustomers(response.results || []);
      setCount(response.count || 0);
      setNextUrl(response.next || null);
      setPreviousUrl(response.previous || null);

      logCustomerResponse('useCustomerDirectory.loadPageByUrl', {
        count: response.count || 0,
        resultCount: (response.results || []).length,
        url,
      });

      if ((response.results || []).length === 0) {
        logCustomerWarning('useCustomerDirectory.loadPageByUrl', {
          message: 'No customers were stored in React state after pagination',
          url,
        });
      }
    } catch (loadError) {
      if (requestId !== requestIdRef.current) {
        return;
      }

      setCustomers([]);
      setCount(0);
      setNextUrl(null);
      setPreviousUrl(null);
      logCustomerError('useCustomerDirectory.loadPageByUrl', {
        message: loadError?.message,
        url,
      });
      setError(getErrorMessage(loadError));
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  const reload = useCallback(() => loadFirstPage(latestQueryRef.current), [loadFirstPage]);

  useEffect(() => {
    latestQueryRef.current = query;
    loadFirstPage(query);
  }, [query, loadFirstPage]);

  useEffect(() => {
    return () => {
      // Invalidating active requests prevents stale responses after unmount.
      requestIdRef.current += 1;
    };
  }, []);

  return {
    customers,
    count,
    nextUrl,
    previousUrl,
    loading,
    error,
    reload,
    loadPageByUrl,
  };
}
