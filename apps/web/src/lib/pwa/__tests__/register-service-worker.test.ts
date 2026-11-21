import { describe, expect, it, vi } from 'vitest';
import {
  canUseServiceWorker,
  registerServiceWorker,
  type ServiceWorkerRegistrar,
} from '../register-service-worker';

function fakeRegistrar(overrides: Partial<ServiceWorkerRegistrar> = {}) {
  const register = vi.fn(async () => ({ scope: '/' }));
  return { registrar: { register, ...overrides } as ServiceWorkerRegistrar, register };
}

describe('service worker registration', () => {
  it('registers in a secure context with support', async () => {
    const { registrar, register } = fakeRegistrar();
    await expect(registerServiceWorker(registrar, true)).resolves.toBe(true);
    expect(register).toHaveBeenCalledWith('/sw.js');
  });

  it('does nothing when the API is missing', async () => {
    await expect(registerServiceWorker(undefined, true)).resolves.toBe(false);
  });

  it('does nothing in an insecure context', async () => {
    const { registrar, register } = fakeRegistrar();
    await expect(registerServiceWorker(registrar, false)).resolves.toBe(false);
    expect(register).not.toHaveBeenCalled();
  });

  it('never throws when registration fails', async () => {
    const { registrar } = fakeRegistrar({
      register: vi.fn(async () => {
        throw new Error('blocked by policy');
      }),
    });

    await expect(registerServiceWorker(registrar, true)).resolves.toBe(false);
  });

  it('reports capability the same way', () => {
    const { registrar } = fakeRegistrar();
    expect(canUseServiceWorker(registrar, true)).toBe(true);
    expect(canUseServiceWorker(registrar, false)).toBe(false);
    expect(canUseServiceWorker(undefined, true)).toBe(false);
  });
});
