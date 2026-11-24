import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { registerServiceWorker, getServiceWorkerRegistration, isOnline } from './sw-registration';

function setNavigatorServiceWorker(value: ServiceWorkerContainer | undefined): void {
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value,
  });
}

const originalServiceWorker = navigator.serviceWorker;

beforeEach(() => {
  vi.restoreAllMocks();
  setNavigatorServiceWorker(originalServiceWorker);
});

afterEach(() => {
  vi.restoreAllMocks();
  setNavigatorServiceWorker(originalServiceWorker);
});

describe('sw-registration', () => {
  it('isOnline returns navigator.onLine when available', () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    expect(isOnline()).toBe(true);

    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    expect(isOnline()).toBe(false);
  });

  it('registerServiceWorker returns without error when serviceWorker is unavailable', async () => {
    setNavigatorServiceWorker(undefined);
    await expect(registerServiceWorker()).resolves.toBeUndefined();
    expect(getServiceWorkerRegistration()).toBeNull();
  });

  it('registerServiceWorker registers the service worker', async () => {
    const mockRegister = vi.fn().mockResolvedValue({ scope: '/' });
    setNavigatorServiceWorker({ register: mockRegister } as unknown as ServiceWorkerContainer);

    await registerServiceWorker();
    expect(mockRegister).toHaveBeenCalledWith('/sw.js', { scope: '/' });
    expect(getServiceWorkerRegistration()?.scope).toBe('/');
  });

  it('registerServiceWorker swallows registration errors', async () => {
    const mockRegister = vi.fn().mockRejectedValue(new Error('failed'));
    setNavigatorServiceWorker({ register: mockRegister } as unknown as ServiceWorkerContainer);

    await expect(registerServiceWorker()).resolves.toBeUndefined();
    expect(getServiceWorkerRegistration()).toBeNull();
  });
});
