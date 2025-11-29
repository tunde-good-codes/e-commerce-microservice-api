import dotenv from "dotenv";
dotenv.config();

import { AuthTokens, JWTPayload, ServiceError } from "../../../shared/types";
import bcrypt from "bcryptjs";
import jwt, { SignOptions } from "jsonwebtoken";
import { StringValue } from "ms";
import User from "./models/User";
import RefreshToken from "./models/RefreshToken";
import { Types } from "mongoose";
import { createServiceError } from "../../../shared/utils";

// Helper function for service errors
// function createServiceError(
//   message: string,
//   statusCode: number,
//   originalError?: any
// ): ServiceError {
//   console.error("Service Error:", message, originalError);
//   return {
//     message,
//     statusCode,
//     ...(originalError && { originalError }),
//   };
// }

export class AuthService {
  private readonly jwtSecret: string;
  private readonly jwtRefreshSecret: string;
  private readonly jwtExpiresIn: string;
  private readonly jwtRefreshExpiresIn: string;
  private readonly bcryptRounds: number;

  constructor() {
    this.jwtSecret = process.env.JWT_SECRET!;
    this.jwtRefreshSecret = process.env.JWT_REFRESH_SECRET!;
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || "15m";
    this.jwtRefreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || "7d";
    this.bcryptRounds = parseInt(process.env.BCRYPT_ROUNDS || "10", 10);

    if (!this.jwtSecret || !this.jwtRefreshSecret) {
      throw new Error("JWT secrets are not defined in environment variables");
    }
  }

  async register(email: string, password: string): Promise<AuthTokens> {
    try {
      // Check if user already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        throw createServiceError("User already exists", 409);
      }

      // Hash the password
      const hashedPassword = await bcrypt.hash(password, this.bcryptRounds);

      // Create the user (Mongoose doesn't use 'data' property)
      const user = await User.create({
        email,
        password: hashedPassword,
      });

      // Generate tokens
      return this.generateTokens(
        (user._id as Types.ObjectId).toString(),
        user.email
      );
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("User already exists")
      ) {
        throw error;
      }
      throw createServiceError("Registration failed", 500, error as string);
    }
  }

  private async generateTokens(
    userId: string,
    email: string
  ): Promise<AuthTokens> {
    const payload = { userId, email };

    // Generate access token
    const accessTokenOptions: SignOptions = {
      expiresIn: this.jwtExpiresIn as StringValue,
    };
    const accessToken = jwt.sign(payload, this.jwtSecret, accessTokenOptions);

    // Generate refresh token
    const refreshTokenOptions: SignOptions = {
      expiresIn: this.jwtRefreshExpiresIn as StringValue,
    };
    const refreshToken = jwt.sign(
      payload,
      this.jwtRefreshSecret,
      refreshTokenOptions
    );

    // Store refresh token in the database (Mongoose doesn't use 'data' property)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

    await RefreshToken.create({
      userId: new Types.ObjectId(userId),
      token: refreshToken,
      expiresAt,
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  async login(email: string, password: string): Promise<AuthTokens> {
    try {
      // Find user with password (since it's select: false by default)
      const user = await User.findOne({ email }).select("+password");
      if (!user) {
        throw createServiceError("Invalid email or password", 401);
      }

      // Verify the password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        throw createServiceError("Invalid email or password", 401);
      }

      // Generate tokens
      return this.generateTokens(
        (user._id as Types.ObjectId).toString(),
        user.email
      );
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("Invalid email or password")
      ) {
        throw error;
      }
      throw createServiceError("Login failed", 500, error as string as string);
    }
  }

  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    try {
      // Verify the refresh token
      const decoded = jwt.verify(
        refreshToken,
        this.jwtRefreshSecret
      ) as JWTPayload;

      // Check if the refresh token exists in the database
      const storedToken = await RefreshToken.findOne({
        token: refreshToken,
      }).populate("userId");

      if (!storedToken || storedToken.expiresAt < new Date()) {
        throw createServiceError("Invalid or expired refresh token", 401);
      }

      // Generate new tokens
      const tokens = await this.generateTokens(
        (storedToken.userId as any)._id.toString(),
        (storedToken.userId as any).email
      );

      // Delete the old refresh token
      await RefreshToken.findByIdAndDelete(storedToken._id);

      return tokens;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw createServiceError("Invalid refresh token", 401);
      }
      if (
        error instanceof Error &&
        error.message.includes("Invalid or expired refresh token")
      ) {
        throw error;
      }
      throw createServiceError("Token refresh failed", 500, error as string);
    }
  }

  async logout(refreshToken: string): Promise<void> {
    try {
      // Delete the refresh token from the database
      await RefreshToken.findOneAndDelete({ token: refreshToken });
    } catch (error) {
      throw createServiceError("Logout failed", 500, error as string);
    }
  }

  async logoutAll(userId: string): Promise<void> {
    try {
      // Delete all refresh tokens for the user
      await RefreshToken.deleteMany({ userId: new Types.ObjectId(userId) });
    } catch (error) {
      throw createServiceError("Logout all failed", 500, error as string);
    }
  }

  async validateToken(token: string): Promise<JWTPayload> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as JWTPayload;

      // Check if the user exists
      const user = await User.findById(decoded.userId);
      if (!user) {
        throw createServiceError("User not found", 404);
      }

      return decoded;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw createServiceError("Invalid token", 401);
      }
      if (error instanceof Error && error.message.includes("User not found")) {
        throw error;
      }
      throw createServiceError("Token validation failed", 500, error as string);
    }
  }

  async getUserById(userId: string) {
    try {
      const user = await User.findById(userId).select("-password"); // Exclude password
      if (!user) {
        throw createServiceError("User not found", 404);
      }
      return user;
    } catch (error) {
      if (error instanceof Error && error.message.includes("User not found")) {
        throw error;
      }
      throw createServiceError("Failed to get user", 500, error as string);
    }
  }

  async deleteUser(userId: string): Promise<void> {
    try {
      // Delete user and all their refresh tokens
      await Promise.all([
        User.findByIdAndDelete(userId),
        RefreshToken.deleteMany({ userId: new Types.ObjectId(userId) }),
      ]);
    } catch (error) {
      throw createServiceError("Failed to delete user", 500, error as string);
    }
  }

  // Additional utility method
  async cleanupExpiredTokens(): Promise<void> {
    try {
      // MongoDB TTL index should handle this automatically, but manual cleanup as backup
      await RefreshToken.deleteMany({ expiresAt: { $lt: new Date() } });
    } catch (error) {
      console.error("Cleanup expired tokens failed:", error as string);
    }
  }
}
