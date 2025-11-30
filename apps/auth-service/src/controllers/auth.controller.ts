import { Request, Response, NextFunction } from "express";
import {
  checkOtpRestrictions,
  sendOtp,
  trackOtpRequests,
  validateRegistrationData,
  verifyOtp,
} from "../utils/auth.helper";
import bcrypt from "bcryptjs";
import { NotFoundError, ValidationError } from "@shared/error-handler";
import prisma from "@shared/prisma";
import jwt from "jsonwebtoken";
import { generateTokens } from "@/utils/generateToken";
import { setCookie } from "@/utils/cookies/setCookies";

export const userRegistration = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    validateRegistrationData(req.body, "user");

    const { name, email } = req.body;

    const existingUser = await prisma.users.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw next(new ValidationError("user already exists with this email"));
    }

    await checkOtpRestrictions(email, next);
    await trackOtpRequests(email, next);
    await sendOtp(email, name, "user-activation-email");
    res.status(200).json({
      message: "otp sent to email. please verify your account",
    });
  } catch (e) {
    console.log(e);
  }
};

export const verifyUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { name, email, password, otp } = req.body;
    if (!name || !email || !password || !otp) {
      return next(new ValidationError("All fields are required"));
    }
    const existingUser = await prisma.users.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw next(new ValidationError("user already exists with this email"));
    }
    await verifyOtp(email, otp, next);

    const hashPassword = await bcrypt.hash(password, 10);
    await prisma.users.create({
      data: { name, email, password: hashPassword },
    });
    res.status(201).json({
      message: "user registered successfully",
      success: true,
    });
  } catch (e) {
    return next(e);
  }
};

export const loginUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      throw new NotFoundError("enter email and password fields");
    }

    const user = await prisma.users.findUnique({ where: { email } });
    if (!user) {
      throw new NotFoundError(" user found with this email not found");
    }
    const isPasswordCorrect = await bcrypt.compare(password, user.password!);
    if (!isPasswordCorrect) {
      throw new NotFoundError("password mismatched!");
    }

    const { accessToken, refreshToken } = await generateTokens(user, "user");
    // store refresh and access token in http only cookie

    setCookie(res, "access_token", accessToken);
    setCookie(res, "refresh_token", refreshToken);

    res.status(200).json({
      success: true,
      message: "login successfully",
      data: user,
      accessToken,
      refreshToken,
    });
  } catch (e) {}
};
