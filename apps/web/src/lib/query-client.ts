import { QueryClient } from '@tanstack/react-query';

/**
 * Shared query defaults. Conservative on purpose: no refetch storms on mobile
 * data, one retry for transient failures, no retries for client errors.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}
