import type { NextFunction, Request, Response } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import type { IUser } from "../models/User.js";
import prisma from "@shared/prisma/index.js";

export interface AuthenticatedRequest extends Request {
  user?: IUser | null;
}

export const isAuthenticated = async (
  req: Request, // Use AuthenticatedRequest type
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    // Get token from multiple sources
    let token = req.cookies?.access_token;

    if (!token && req.headers.authorization) {
      token = req.headers.authorization.replace("Bearer ", "");
    }

    if (!token) {
      // IMPORTANT: Return after sending response
      return res.status(401).json({
        message: "Unauthorized! Token Missing",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      id: string;
      role: "user" | "seller";
      email?: string;
    };

    if (!decoded?.id) {
      // Check if ID exists
      return res.status(401).json({
        message: "Unauthorized! Invalid Token",
      });
    }

    const account = await prisma.users.findUnique({
      where: {
        id: decoded.id, // This should now work
      },
    });

    if (!account) {
      return res.status(401).json({
        message: "Unauthorized! User not found",
      });
    }

    // Remove password from user object before attaching to request
    const { password, ...userWithoutPassword } = account!;
    req.user = userWithoutPassword as any;

    next();
  } catch (error: any) {
    console.log("JWT verification error: ", error);

    // Check for specific JWT errors
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        message: "Token expired",
      });
    }

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        message: "Invalid token",
      });
    }

    return res.status(500).json({
      message: "Authentication error",
    });
  }
};
