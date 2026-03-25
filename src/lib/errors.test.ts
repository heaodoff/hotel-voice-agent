import { describe, it, expect } from 'vitest';
import { AppError, NotFoundError, ValidationError, PmsError, ToolExecutionError } from './errors.js';

describe('AppError', () => {
  it('sets message, code, statusCode, and details', () => {
    const err = new AppError('something broke', 'BROKEN', 503, { key: 'val' });
    expect(err.message).toBe('something broke');
    expect(err.code).toBe('BROKEN');
    expect(err.statusCode).toBe(503);
    expect(err.details).toEqual({ key: 'val' });
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('AppError');
  });

  it('defaults statusCode to 500', () => {
    const err = new AppError('fail', 'FAIL');
    expect(err.statusCode).toBe(500);
  });
});

describe('NotFoundError', () => {
  it('formats message with resource and id', () => {
    const err = new NotFoundError('Reservation', 'res_123');
    expect(err.message).toBe('Reservation not found: res_123');
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
  });

  it('formats message without id', () => {
    const err = new NotFoundError('Guest');
    expect(err.message).toBe('Guest not found');
  });
});

describe('ValidationError', () => {
  it('has statusCode 400 and stores details', () => {
    const details = { field: 'email', issue: 'invalid' };
    const err = new ValidationError('Bad input', details);
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.details).toEqual(details);
  });
});

describe('PmsError', () => {
  it('has statusCode 502', () => {
    const err = new PmsError('PMS unreachable');
    expect(err.statusCode).toBe(502);
    expect(err.code).toBe('PMS_ERROR');
  });
});

describe('ToolExecutionError', () => {
  it('prefixes tool name in message', () => {
    const err = new ToolExecutionError('check_availability', 'timeout');
    expect(err.message).toBe('Tool check_availability failed: timeout');
    expect(err.statusCode).toBe(500);
    expect(err.code).toBe('TOOL_ERROR');
  });
});
