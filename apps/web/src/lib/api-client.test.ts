import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestError, createApiClient } from './api-client';

const client = createApiClient({ baseUrl: 'https://api.example.test' });

function mockFetch(response: Partial<Response> & { jsonBody?: unknown; textBody?: string }) {
  const body =
    response.textBody ?? (response.jsonBody === undefined ? '' : JSON.stringify(response.jsonBody));
  const fetchMock = vi.fn().mockResolvedValue({
    ok: response.ok ?? true,
    status: response.status ?? 200,
    text: async () => body,
    headers: new Headers(response.headers as HeadersInit | undefined),
  } as Response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('api client', () => {
  it('unwraps the success envelope', async () => {
    const fetchMock = mockFetch({
      jsonBody: { data: { status: 'ok' }, requestId: 'req_1' },
    });

    await expect(client.get('/health')).resolves.toEqual({ status: 'ok' });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/health',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('sends JSON bodies and auth headers', async () => {
    const fetchMock = mockFetch({ jsonBody: { data: { id: '1' }, requestId: 'req_2' } });
    const authed = createApiClient({ baseUrl: 'https://api.example.test', getToken: () => 'jwt' });

    await authed.post('/api/v1/thing', { a: 1 });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ a: 1 }));
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer jwt');
  });

  it('surfaces structured API errors', async () => {
    mockFetch({
      ok: false,
      status: 422,
      jsonBody: {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Some fields need attention.',
          requestId: 'r3',
        },
      },
    });

    await expect(client.get('/api/v1/tools?kind=robot')).rejects.toMatchObject({
      name: 'ApiRequestError',
      code: 'VALIDATION_ERROR',
      status: 422,
      requestId: 'r3',
    });
  });

  it('maps transport failures to a network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    const error = await client.get('/health').catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiRequestError);
    expect((error as ApiRequestError).code).toBe('NETWORK_ERROR');
  });

  it('rejects malformed payloads instead of returning undefined', async () => {
    mockFetch({ textBody: '<html>not json</html>' });

    await expect(client.get('/health')).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
});
