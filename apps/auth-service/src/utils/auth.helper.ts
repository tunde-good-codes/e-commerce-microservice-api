import { NextFunction, Response, Request } from "express";
import crypto from "crypto";
import {
  InternalServerError,
  NotFoundError,
  ValidationError,
} from "@shared/error-handler/index.js";
import { sendEmail } from "./send-mail/index.js";
import redis from "@shared/redis/index.js";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ✅ FIXED: Remove try-catch wrapper, let errors bubble up naturally
export const validateRegistrationData = (
  data: any,
  userType: "user" | "seller"
) => {
  const { name, email, password, phone_number, country } = data;

  if (
    !name ||
    !email ||
    !password ||
    (userType === "seller" && (!phone_number || !country))
  ) {
    throw new ValidationError("Missing Required Fields");
  }

  if (!emailRegex.test(email)) {
    throw new ValidationError("Invalid Email Format");
  }
};

// ✅ FIXED: Remove next parameter, remove try-catch wrapper
export const checkOtpRestrictions = async (email: string) => {
  // Check if email is locked based on wrong OTP input
  if (await redis.get(`otp_lock:${email}`)) {
    throw new ValidationError(
      "Account locked due to multiple failed attempts. Try again after 30 minutes"
    );
  }

  // Check for OTP spam lock
  if (await redis.get(`otp_spam_lock:${email}`)) {
    throw new ValidationError(
      "Too many OTP requests. Please wait for an hour and try again"
    );
  }

  // Check cooldown
  if (await redis.get(`otp_cool_down:${email}`)) {
    throw new ValidationError(
      "Please wait one minute before requesting a new OTP"
    );
  }
};

// ✅ FIXED: Add await for redis.set, remove try-catch wrapper
export const sendOtp = async (
  email: string,
  name: string,
  template: string
) => {
  const otp = crypto.randomInt(1000, 9999).toString();
  
  // Send email first - if this fails, we don't store the OTP
  await sendEmail(email, "Verify Your Email Address", template, {
    name,
    otp,
  });
  
  // ✅ ADD AWAIT here
  await redis.set(`otp:${email}`, otp, "EX", 300);
  await redis.set(`otp_cool_down:${email}`, "true", "EX", 60);
};

// ✅ FIXED: Remove next parameter, remove try-catch wrapper, fix redis.set
export const trackOtpRequests = async (email: string) => {
  const otpRequestKey = `otp_request_count:${email}`;
  const currentCount = await redis.get(otpRequestKey);
  let otpRequests = parseInt(currentCount || "0");

  if (otpRequests >= 2) {
    await redis.set(`otp_spam_lock:${email}`, "locked", "EX", 3600);
    throw new ValidationError(
      "Too many OTP requests. Please wait 1 hour before requesting a new OTP"
    );
  }

  // ✅ Convert to string when setting
  await redis.set(otpRequestKey, (otpRequests + 1).toString(), "EX", 3600);
};

// ✅ FIXED: Remove next parameter, remove try-catch wrapper
export const verifyOtp = async (email: string, otp: string) => {
  const storedOtp = await redis.get(`otp:${email}`);

  if (!storedOtp) {
    throw new NotFoundError("OTP not found or expired!");
  }

  const failedAttemptKey = `otp_attempts:${email}`;
  const attempts = await redis.get(failedAttemptKey);
  const failedAttempts = parseInt(attempts || "0");

  if (storedOtp !== otp) {
    if (failedAttempts >= 2) {
      await redis.set(`otp_lock:${email}`, "locked", "EX", 1800);
      await redis.del(`otp:${email}`, failedAttemptKey);

      throw new ValidationError(
        "Too many failed attempts. Your account is locked for 30 minutes"
      );
    }

    await redis.set(failedAttemptKey, (failedAttempts + 1).toString(), "EX", 300);
    throw new ValidationError(
      `Incorrect OTP. ${2 - failedAttempts} attempt(s) left`
    );
  }

  // OTP is correct, clean up
  await redis.del(`otp:${email}`, failedAttemptKey);
};

// ✅ FIXED: Proper error handling
export const verifyForgotPasswordOtp = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      throw new ValidationError("Email and OTP are required");
    }

    // This will throw if verification fails
    await verifyOtp(email, otp);

    res.status(200).json({
      success: true,
      message: "OTP verified! Reset password now",
    });
  } catch (error) {
    // Pass error to Express error handler
    next(error);
  }
};