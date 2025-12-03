import { Request, Response, NextFunction } from "express";
import {
  checkOtpRestrictions,
  sendOtp,
  trackOtpRequests,
  validateRegistrationData,
  verifyForgotPasswordOtp,
  verifyOtp,
} from "../utils/auth.helper";
import bcrypt from "bcryptjs";
import {
  InternalServerError,
  NotFoundError,
  ValidationError,
} from "@shared/error-handler";
import prisma from "@shared/prisma";
import jwt, { JsonWebTokenError } from "jsonwebtoken";
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
  } catch (e: any) {
    throw new InternalServerError("Bad request: " + e.message);
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
  } catch (e: any) {
    throw new InternalServerError("Bad request: " + e.message);
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
      throw new NotFoundError("no  user found with this email not found");
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
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (e: any) {
    throw new InternalServerError("Bad request: " + e.message);
  }
};

export const getUserInfo = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const user = req.user;
  try {
    res.status(200).json({
      success: true,
      user,
    });
  } catch (error: any) {
    throw new InternalServerError("Bad request: " + error.message);

    next(error);
  }
};

export const refreshTokenHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized! No refresh token provided",
      });
    }

    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET as string
    ) as { id: string; role: string };

    if (!decoded || !decoded.id || !decoded.role) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Invalid refresh token",
      });
    }

    const user = await prisma.users.findUnique({
      where: { id: decoded.id },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    const newAccessToken = jwt.sign(
      { id: decoded.id, role: decoded.role },
      process.env.JWT_SECRET as string,
      { expiresIn: "15m" }
    );

    // Set cookie (for SSR/future use)
    setCookie(res, "access_token", newAccessToken);

    // ✅ RETURN TOKEN IN RESPONSE
    return res.status(200).json({
      success: true,
      accessToken: newAccessToken, // Add this!
    });
  } catch (error: any) {
    if (error instanceof jwt.JsonWebTokenError) {
      return next(new JsonWebTokenError("Invalid or expired refresh token"));
    }
    if (error instanceof jwt.TokenExpiredError) {
      return next(new JsonWebTokenError("Refresh token expired"));
    }
    return next(error);
  }
};

export const userForgotPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email } = req.body;
    if (!email) {
      throw new NotFoundError("kindly enter email to continue");
    }

    const userType = (req as any).userType; // Get from request

    const user =
      userType === "user"
        ? await prisma.users.findUnique({
            where: { email },
          })
        : await prisma.sellers.findUnique({
            where: { email },
          });

    if (!user) {
      throw new NotFoundError("No user found with this email");
    }

    // check otp restrictions

    await checkOtpRestrictions(email, next);
    await trackOtpRequests(email, next);
    // generate otp and send email
    await sendOtp(
      email,
      user.name,
      userType === "user"
        ? "forgot-password-email"
        : "seller-forgot-password-email"
    );

    res.status(200).json({
      success: true,
      message: "message sent successfully to: " + email,
    });
  } catch (e: any) {
    throw new InternalServerError("Bad request: " + e.message);
  }
};
// export const userForgotPassword = async (
//   req: Request,
//   res: Response,
//   next: NextFunction,
//   userType: "user" | "seller"
// ) => {
//   try {
//     const { email } = req.body;
//     if (!email) {
//       throw new NotFoundError("kindly enter email to continue");
//     }
//     const user =
//       userType === "user" &&
//       (await prisma.users.findUnique({
//         where: { email },
//       }));

//     if (!user) {
//       throw new NotFoundError("No user found with this email");
//     }

//     // check otp restrictions

//     await checkOtpRestrictions(email, next);
//     await trackOtpRequests(email, next);
//     // generate otp and send email
//     await sendOtp(email, user.name, "forgot-password-email");

//     res.status(200).json({
//       success: true,
//       message: "message sent successfully to: " + email,
//     });
//   } catch (e) {
//     throw new InternalServerError("Bad request");
//   }
// };
export const resetUserPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, newPassword } = req.body;
    if (!email || !newPassword) {
      throw new NotFoundError("kindly enter email and password to continue");
    }
    const user = await prisma.users.findUnique({
      where: { email },
    });

    if (!user) {
      throw new NotFoundError("No user found with this email");
    }

    const isPasswordMatch = await bcrypt.compare(newPassword, user.password!);
    if (!isPasswordMatch) {
      throw new ValidationError(
        "new password should not be the same as old password"
      );
    }

    // hash new password

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.users.update({
      where: { email },
      data: {
        password: hashedPassword,
      },
    });

    res.status(200).json({
      success: true,
      message: "password updated successfully for this email: " + email,
    });
  } catch (e) {
    throw new InternalServerError("Bad request");
  }
};
export const verifyForgotPasswordOtpHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  await verifyForgotPasswordOtp(req, res, next);
};

export const registerSeller = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    validateRegistrationData(req.body, "seller");

    const { name, email } = req.body;

    const existingSeller = await prisma.sellers.findUnique({
      where: { email },
    });

    if (existingSeller) {
      throw new NotFoundError("A seller already  found with this email");
    }

    await checkOtpRestrictions(email, next);
    await trackOtpRequests(email, next);
    await sendOtp(email, name, "seller-activation-email");
    res.status(200).json({
      message: "otp sent to email. please verify your account",
    });
  } catch (e: any) {
    throw new InternalServerError("Bad request: " + e.message);
  }
};

export const verifySeller = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { name, email, password, otp, phone_number, country } = req.body;

    if (!name || !email || !password || !otp || !phone_number || !country) {
      return next(new ValidationError("All fields are required"));
    }
    const existingSeller = await prisma.sellers.findUnique({
      where: { email },
    });

    if (existingSeller) {
      throw next(new ValidationError("seller already exists with this email"));
    }
    await verifyOtp(email, otp, next);

    const hashPassword = await bcrypt.hash(password, 10);
    await prisma.sellers.create({
      data: { name, email, password: hashPassword, phone_number, country },
    });
    res.status(201).json({
      message: "seller registered successfully",
      success: true,
    });
  } catch (e: any) {
    throw new InternalServerError("Bad request: " + e.message);
  }
};

export const createShop = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { name, bio, address, category, website, opening_hours, sellerId } =
      req.body;

    if (!name || !address || !category || !opening_hours || !bio || !sellerId) {
      return next(new ValidationError("All fields are required"));
    }

    const shopData: any = {
      name,
      bio,
      address,
      category,
      opening_hours,
      sellerId,
    };

    if (website && website.trim() === "") {
      shopData.website = website;
    }

    const shop = await prisma.shops.create({
      data: shopData,
    });

    res.status(201).json({
      message: "shop registered successfully",
      success: true,
      shop,
    });
  } catch (e: any) {
    throw new InternalServerError("Bad request: " + e.message);
  }
};
