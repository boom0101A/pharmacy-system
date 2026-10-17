import { describe, expect, it, vi } from 'vitest';
import type { Response } from 'express';
import { z } from 'zod';
import { errorHandler } from './errors.js';

function fakeRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res as unknown as Response;
}

describe('errorHandler validation errors', () => {
  it('says which rule failed when the schema gave an Arabic message', () => {
    const res = fakeRes();
    const parse = () => z.object({ password: z.string().min(4, 'كلمة المرور قصيرة جداً') }).parse({ password: 'a' });

    try {
      parse();
    } catch (err) {
      errorHandler(err, {} as never, res, vi.fn());
    }

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'بيانات غير صالحة — كلمة المرور قصيرة جداً' }));
  });

  it('keeps the generic Arabic message instead of leaking zod\'s English one', () => {
    const res = fakeRes();
    try {
      z.object({ n: z.number() }).parse({ n: 'x' });
    } catch (err) {
      errorHandler(err, {} as never, res, vi.fn());
    }

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'بيانات غير صالحة' }));
  });
});

describe('errorHandler body-parser errors', () => {
  it('reports malformed JSON as a 400 with an Arabic message, not the generic 500', () => {
    // body-parser (via http-errors) throws a SyntaxError carrying its own
    // `status`/`statusCode` for a body express.json() could not parse.
    const err = Object.assign(new SyntaxError('Unexpected token z in JSON at position 0'), {
      status: 400,
      statusCode: 400,
      type: 'entity.parse.failed',
    });
    const res = fakeRes();

    errorHandler(err, {} as never, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: expect.stringContaining('غير صالح') });
  });

  it('reports an oversized body as a 413 with an Arabic message, not the generic 500', () => {
    const err = Object.assign(new Error('request entity too large'), {
      status: 413,
      statusCode: 413,
      type: 'entity.too.large',
    });
    const res = fakeRes();

    errorHandler(err, {} as never, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(413);
    expect(res.json).toHaveBeenCalledWith({ error: expect.stringContaining('كبير') });
  });
});
