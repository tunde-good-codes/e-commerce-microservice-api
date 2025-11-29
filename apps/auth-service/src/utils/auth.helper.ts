import { NextFunction } from "express";
import crypto from "crypto";
import {
  InternalServerError,
  NotFoundError,
  ValidationError,
} from "@shared/error-handler/index.js";
import { sendEmail } from "./send-mail/index.js";
import redis from "@shared/redis/index.js";

import type { Redis } from "ioredis";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const validateRegistrationData = (
  data: any,
  userType: "user" | "seller"
) => {
  try {
    const { name, email, password, phone_number, country } = data;

    if (
      !name ||
      !email ||
      !password ||
      (userType === "seller" && (!phone_number || !country))
    ) {
      throw new ValidationError("Missing Require Fields");
    }

    if (!emailRegex.test(email)) {
      throw new ValidationError("Invalid Email Format");
    }
  } catch (e) {
    throw new InternalServerError("Bad Request");
  }
};

export const checkOtpRestrictions = async (
  email: string,
  next: NextFunction
) => {
  try {
    //check if email is locked based on wrong otp input for more than 3 times... i.e you're are entering the wrong otp
    if (await redis.get(`otp_lock:${email}`)) {
      return next(
        new ValidationError(
          "Account locked due to multiple failed attempts. try again after 30 minutes"
        )
      );
    }

    // if you're trying to spam the database with many otp requests... like 3 requests in 1 minute. your account will be locked for a hour
    if (await redis.get(`otp_spam_lock:${email}`)) {
      return next(
        new ValidationError(
          "too many otp requests. please wait for an hour and try again"
        )
      );
    }

    if (await redis.get(`otp_cool_down:${email}`)) {
      return next(
        new ValidationError(
          "Please wait one minute before requesting a new email"
        )
      );
    }
  } catch (e) {
    throw new InternalServerError("Bad Request");
  }
};

export const sendOtp = async (
  email: string,
  name: string,
  template: string
) => {
  try {
    const otp = crypto.randomInt(1000, 9999).toString(); // to generate random 4 digits otp
    await sendEmail(email, "Verify Your Email Address", template, {
      name,
      otp,
    });
    redis.set(`otp:${email}`, otp, "EX", 300); // set otp to expire in 5 minutes
    redis.set(`otp_cool_down:${email}`, "true", "EX", 60); // if you are sending an otp, you can't send another otp within the next 1 min
  } catch (e) {
    throw new InternalServerError("Bad Request");
  }
};

export const trackOtpRequests = async (email: string, next: NextFunction) => {
  try {
    const otpRequestKey = `otp_request_count:${email}`;
    let otpRequests = parseInt((await redis.get(otpRequestKey)) || "0");

    if (otpRequests >= 2) {
      await redis.set(`otp_spam_lock:${email}`, "locked", "EX", 3600); // lock otp request for 1 hour if more than 3

      return next(
        new ValidationError(
          "Too many otp requests. please wait 1 hour before requesting a new otp "
        )
      );
    }

    await redis.set(otpRequestKey, otpRequests + 1, "EX", 3600); // tracking request for an hour
  } catch (e) {
    throw new InternalServerError("Bad Request");
  }
};

export const verifyOtp = async (
  email: string,
  otp: string,
  next: NextFunction
) => {
  try {
    const storedOtp = await redis.get(`otp:${email}`);

    if (!storedOtp) {
      throw new NotFoundError("otp not found or expired!");
    }

    const failedAttemptKey = `otp_attempts:${email}`;
    const failedAttempts = parseInt((await redis.get(failedAttemptKey)) || "0");

    if (storedOtp !== otp) {
      if (failedAttempts >= 2) {
        await redis.set(`otp_lock:${email}`, "locked", "EX", 1800);
        await redis.del(`otp:${email}`, failedAttemptKey);

        throw new ValidationError(
          "Too many failed attempts, your account is locked for 30 minutes"
        );
      }

      await redis.set(failedAttemptKey, failedAttempts + 1, "EX", 300);
      throw new ValidationError(
        `incorrect OTP. ${2 - failedAttempts} attempts left`
      );
    }
    await redis.del(`otp:${email}`, failedAttemptKey);
  } catch (e) {
    throw new InternalServerError("Bad Request")
  }
};
