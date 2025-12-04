import type { NextFunction, Request, Response } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import type { IUser } from "../models/User.js";
import prisma from "@shared/prisma/index.js";
import { sellers, users } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      user?: users | null;
      seller?: (sellers & { shop?: any }) | null;
      role?: "user" | "seller";
      userType?: "user" | "seller";
    }
  }
}

// JWT Payload interface
interface DecodedToken {
  id: string;
  role: "user" | "seller";
}

export const isAuthenticated = async (
  req: Request, // ✅ Use AuthenticatedRequest
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token =
      req.cookies["access_token"] ||
      req.cookies["seller_access_token"] ||
      req.headers.authorization?.split(" ")[1];

    if (!token) {
      res.status(401).json({
        success: false,
        message: "No token provided",
      });
      return;
    }

    // ✅ Fix: jwt.verify returns the decoded payload, not takes it as argument
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET as string
    ) as DecodedToken;

    let account;

    if (decoded.role === "user") {
      account = await prisma.users.findUnique({
        where: {
          id: decoded.id,
        },
      });
      req.user = account; // ✅ Store the actual account data
    } else if (decoded.role === "seller") {
      account = await prisma.sellers.findUnique({
        where: {
          id: decoded.id,
        },
        include: {
          shop: true,
        },
      });
      req.seller = account; // ✅ Store the actual account data
    }

    if (!account) {
      res.status(401).json({
        success: false,
        message: "Account not found!",
      });
      return;
    }

    req.role = decoded.role; // ✅ Store role
    next(); // ✅ Call next() correctly (not "return next")
    return;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        message: "Token expired",
      });
      return;
    }

    // Only log unexpected errors
    console.error("JWT verification error:", error);
    res.status(401).json({
      success: false,
      message: "Invalid token",
    });
    return;
  }
};