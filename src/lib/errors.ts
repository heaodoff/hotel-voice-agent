export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(
      id ? `${resource} not found: ${id}` : `${resource} not found`,
      'NOT_FOUND',
      404,
    );
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}

export class PmsError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 'PMS_ERROR', 502, details);
    this.name = 'PmsError';
  }
}

export class ToolExecutionError extends AppError {
  constructor(toolName: string, message: string, details?: unknown) {
    super(`Tool ${toolName} failed: ${message}`, 'TOOL_ERROR', 500, details);
    this.name = 'ToolExecutionError';
  }
}
