import type { Request, Response, NextFunction } from "express";
import { AppError } from ".";

export const errorMiddleware = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (err instanceof AppError) {
    console.log(`error: ${req.method} ${req.url} - ${err.message}`);

    return res.status(err.statusCode).json({
      status: "error",
      message: err.message,
      ...(err.details && { details: err.details }),
    });
  }

  console.error("unhandled error:", err);

  return res.status(500).json({
    error: "something went wrong. try again",
  });
};
