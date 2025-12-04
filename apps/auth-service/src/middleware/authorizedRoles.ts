import { ValidationError } from "@shared/error-handler";
import { NextFunction, Response, Request } from "express";

export const isSeller = (
  req: Request, // ✅ Use correct type
  res: Response,
  next: NextFunction
): void => {
  if (req.role !== "seller") {
    return next(new ValidationError("Access Denied. Seller Only"));
  }
  next(); // ✅ Call next() if authorized
};

export const isUser = (
  req: Request, // ✅ Use correct type
  res: Response,
  next: NextFunction
): void => {
  if (req.role !== "user") {
    return next(new ValidationError("Access Denied. User Only"));
  }
  next(); // ✅ Call next() if authorized
};