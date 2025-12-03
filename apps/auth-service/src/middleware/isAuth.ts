import type { NextFunction, Request, Response } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import type { IUser } from "../models/User.js";
import prisma from "@shared/prisma/index.js";

export interface AuthenticatedRequest extends Request {
  user?: IUser | null;
}
// In your isAuth middleware
export const isAuthenticated = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // ✅ Add return type
  try {
    const token =
      req.cookies.access_token || req.headers.authorization?.split(" ")[1];

    if (!token) {
      res.status(401).json({
        success: false,
        message: "No token provided",
      });
      return; // ✅ Add explicit return
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET as string);
    req.user = decoded;
    next();
    return; // ✅ Add explicit return after next()
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        message: "Token expired",
      });
      return; // ✅ Add explicit return
    }

    // Only log unexpected errors
    console.error("JWT verification error:", error);
    res.status(401).json({
      success: false,
      message: "Invalid token",
    });
    return; // ✅ Add explicit return
  }
};
