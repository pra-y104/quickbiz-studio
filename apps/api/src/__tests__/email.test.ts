import { describe, expect, it } from 'vitest';
import { createResendProvider } from '../email/resend';
import { EmailProviderError } from '../email/provider';
import { buildAccountNotification, buildPaymentNotification } from '../email/templates';

interface FakeCall {
  url: string;
  init: RequestInit;
}

function fakeFetch(handler: () => unknown, ok = true) {
  const calls: FakeCall[] = [];
  const impl = async (input: string, init?: RequestInit): Promise<Response> => {
    calls.push({ url: input, init: init ?? {} });
    return new Response(JSON.stringify(handler()), {
      status: ok ? 200 : 422,
      headers: { 'content-type': 'application/json' },
    });
  };
  return { impl, calls };
}

const message = {
  to: 'ada@example.com',
  subject: 'Hello',
  html: '<p>Hello</p>',
  text: 'Hello',
  idempotencyKey: 'key-1',
};

describe('Resend adapter (no real network)', () => {
  it('is configured only with a key and a sender', () => {
    expect(createResendProvider({ apiKey: null, from: null }).isConfigured()).toBe(false);
    expect(createResendProvider({ apiKey: 're_x', from: null }).isConfigured()).toBe(false);
    expect(createResendProvider({ apiKey: 're_x', from: 'QB <n@x.com>' }).isConfigured()).toBe(
      true,
    );
  });

  it('refuses to send when unconfigured', async () => {
    const provider = createResendProvider({ apiKey: null, from: null });
    await expect(provider.send(message)).rejects.toBeInstanceOf(EmailProviderError);
  });

  it('posts the message with bearer auth and idempotency key', async () => {
    const { impl, calls } = fakeFetch(() => ({ id: 'msg_1' }));
    const provider = createResendProvider(
      { apiKey: 're_secret', from: 'QB <n@x.com>', baseUrl: 'https://resend.test' },
      impl,
    );

    const result = await provider.send(message);

    expect(result.status).toBe('sent');
    expect(result.id).toBe('msg_1');
    expect(calls[0]!.url).toBe('https://resend.test/emails');
    expect(calls[0]!.init.headers).toMatchObject({
      Authorization: 'Bearer re_secret',
      'Idempotency-Key': 'key-1',
    });
    const body = JSON.parse(String(calls[0]!.init.body)) as Record<string, unknown>;
    expect(body.from).toBe('QB <n@x.com>');
    expect(body.to).toEqual(['ada@example.com']);
  });

  it('rejects an invalid recipient without calling the network', async () => {
    const { impl, calls } = fakeFetch(() => ({ id: 'x' }));
    const provider = createResendProvider({ apiKey: 're_x', from: 'n@x.com' }, impl);
    await expect(provider.send({ ...message, to: 'not-an-email' })).rejects.toMatchObject({
      code: 'invalid-recipient',
    });
    expect(calls).toHaveLength(0);
  });

  it('surfaces a provider error without the raw body or key', async () => {
    const { impl } = fakeFetch(() => ({ message: 'Invalid API key' }), false);
    const provider = createResendProvider({ apiKey: 're_secret', from: 'n@x.com' }, impl);
    const error = await provider.send(message).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(EmailProviderError);
    expect(JSON.stringify(error)).not.toContain('re_secret');
  });
});

describe('email templates', () => {
  it('builds a payment notification with escaped values', () => {
    const email = buildPaymentNotification({
      to: 'ada@example.com',
      reference: 'qb_<1>',
      amountFormatted: '2,500',
      currency: 'NGN',
    });
    expect(email.to).toBe('ada@example.com');
    expect(email.subject).toContain('qb_<1>');
    expect(email.html).toContain('&lt;1&gt;');
    expect(email.text).toContain('2,500');
  });

  it('builds an account notification', () => {
    const email = buildAccountNotification({
      to: 'ada@example.com',
      subject: 'Security notice',
      heading: 'New sign-in',
      body: 'A new sign-in occurred.',
    });
    expect(email.subject).toBe('Security notice');
    expect(email.text).toContain('New sign-in');
    expect(email.html).toContain('A new sign-in occurred.');
  });
});
