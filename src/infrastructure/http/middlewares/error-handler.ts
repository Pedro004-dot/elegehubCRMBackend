import type { Request, Response, NextFunction } from 'express'
import { AppError } from '../../../shared/errors/AppError.js'

export function errorHandler(
  error: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      success: false,
      error: {
        code: error.name,
        message: error.message
      }
    })
    return
  }

  console.error('[ERROR]', error)

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error'
    }
  })
}
