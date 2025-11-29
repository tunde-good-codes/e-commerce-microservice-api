import { Request, Response, NextFunction } from "express";
import { JWTPayload, logError, ServiceError } from "../types";
import { createErrorResponse } from "../utils";
import jwt from "jsonwebtoken";


// extends express request interface to include custom properties
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

export function authenticateToken(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer token

  if (!token) {
    res.status(401).json(createErrorResponse("Access token required"));
    return;
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    logError(new Error("JWT_SECRET is not defined"));
    res.status(500).json(createErrorResponse("Internal Server Error"));
    return;
  }

  jwt.verify(token, jwtSecret, (err: jwt.VerifyErrors | null, decoded: any) => {
    if (err) {
      res.status(403).json(createErrorResponse("Invalid token"));
      return;
    }

    req.user = decoded as JWTPayload; // Attach user info to request
    next();
  });
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function validateRequest(schema: any) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error } = schema.validate(req.body, { 
      abortEarly: false,
      stripUnknown: true 
    });

    if (error) {
      const errors: Record<string, string[]> = {};
      
      error.details.forEach((detail: any) => {
        const field = detail.path.join(".");
        if (!errors[field]) {
          errors[field] = [];
        }
        errors[field].push(detail.message);
      });

      res.status(400).json({
        success: false,
        message: "Validation error",
        errors,
      });
      return;
    }

    next();
  };
}

export function errorHandler(
  error: ServiceError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  logError(error, {
    method: req.method,
    url: req.url,
    body: req.body,
    params: req.params,
    query: req.query,
    user: req.user?.userId || 'unknown'
  });

  const statusCode = error.statusCode || 500;
  const message = statusCode === 500 ? "Internal Server Error" : error.message;

  // Don't expose internal errors in production
  const responseMessage = process.env.NODE_ENV === 'production' && statusCode === 500 
    ? "Internal Server Error" 
    : message;

  res.status(statusCode).json(createErrorResponse(responseMessage));
}

export function corsOptions() {
  const origins = process.env.CORS_ORIGIN 
    ? process.env.CORS_ORIGIN.split(',') 
    : ["http://localhost:3000"];

  return {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      if (origins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: process.env.CORS_CREDENTIALS === "true",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    exposedHeaders: ["Authorization"],
    maxAge: 86400 // 24 hours
  };
}

export function rateLimitMiddleware() {
  const rateLimitMap = new Map();

  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || req.socket.remoteAddress;
    const windowMs = 15 * 60 * 1000; // 15 minutes
    const maxRequests = 100;

    if (!ip) {
      next();
      return;
    }

    const now = Date.now();
    const windowStart = rateLimitMap.get(ip)?.windowStart || now;
    const requestCount = rateLimitMap.get(ip)?.count || 0;

    if (now - windowStart > windowMs) {
      // Reset window
      rateLimitMap.set(ip, { count: 1, windowStart: now });
      next();
      return;
    }

    if (requestCount >= maxRequests) {
      res.status(429).json(createErrorResponse("Too many requests"));
      return;
    }

    rateLimitMap.set(ip, { count: requestCount + 1, windowStart });
    next();
  };
}

export function healthCheck(req: Request, res: Response): void {
  const health = {
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version || "1.0.0"
  };

  res.json(health);
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json(createErrorResponse("Route not found"));
}

// Optional: Request logging middleware
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
  });

  next();
}