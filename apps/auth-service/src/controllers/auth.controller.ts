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
import Stripe from "stripe";
import { date } from "joi";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-11-17.clover",
});
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

    await checkOtpRestrictions(email);
    await trackOtpRequests(email);
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
    await verifyOtp(email, otp);

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
    // ✅ Check for both user and seller refresh tokens
    const refreshToken = 
      req.cookies.refresh_token || 
      req.cookies.seller_refresh_token;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized! No refresh token provided",
      });
    }

    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET as string
    ) as { id: string; role: "user" | "seller" };

    if (!decoded || !decoded.id || !decoded.role) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Invalid refresh token",
      });
    }

    // ✅ Look up the correct account type based on role
    let account;
    if (decoded.role === "user") {
      account = await prisma.users.findUnique({
        where: { id: decoded.id },
      });
    } else if (decoded.role === "seller") {
      account = await prisma.sellers.findUnique({
        where: { id: decoded.id },
      });
    }

    if (!account) {
      return res.status(401).json({
        success: false,
        message: `${decoded.role} not found`,
      });
    }

    // Generate new access token
    const newAccessToken = jwt.sign(
      { id: decoded.id, role: decoded.role },
      process.env.JWT_SECRET as string,
      { expiresIn: "15m" }
    );

    // ✅ Set the correct cookie based on role
    if (decoded.role === "user") {
      setCookie(res, "access_token", newAccessToken);
    } else {
      setCookie(res, "seller_access_token", newAccessToken);
    }

    return res.status(200).json({
      success: true,
      accessToken: newAccessToken,
      role: decoded.role, // ✅ Return role so frontend knows which token to store
    });
  } catch (error: any) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired refresh token",
      });
    }
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        success: false,
        message: "Refresh token expired",
      });
    }
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
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

    await checkOtpRestrictions(email);
    await trackOtpRequests(email);
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

    await checkOtpRestrictions(email);
    await trackOtpRequests(email);
    await sendOtp(email, name, "seller-activation-email");
    res.status(200).json({
      message: "otp sent to email. please verify your account",
    });
  } catch (e: any) {
    throw new InternalServerError("Bad request internal error: " + e + " bad");
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
    await verifyOtp(email, otp);

    const hashPassword = await bcrypt.hash(password, 10);
    const seller = await prisma.sellers.create({
      data: { name, email, password: hashPassword, phone_number, country },
    });
    res.status(201).json({
      message: "seller registered successfully",
      success: true,
      sellerId: seller.id,
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
    const { name, bio, address, category, website, opening_hour, sellerId } =
      req.body;

    // Validate required fields
    if (!name || !address || !category || !opening_hour || !bio || !sellerId) {
      return next(new ValidationError("All fields are required"));
    }

    // ✅ Verify seller exists
    const seller = await prisma.sellers.findUnique({
      where: { id: sellerId },
    });

    if (!seller) {
      return next(new ValidationError("Seller not found"));
    }

    // ✅ Check if seller already has a shop
    const existingShop = await prisma.shops.findUnique({
      where: { sellerId },
    });

    if (existingShop) {
      return next(new ValidationError("Shop already exists for this seller"));
    }

    // Prepare shop data
    const shopData: any = {
      name,
      bio,
      address,
      category,
      opening_hour,
      sellerId,
    };

    // Only add website if it has a value
    if (website && website.trim() !== "") {
      shopData.website = website.trim();
    }

    // Create the shop
    const shop = await prisma.shops.create({
      data: shopData,
    });

    res.status(201).json({
      success: true,
      message: "Shop created successfully",
      shop,
    });
  } catch (error: any) {
    console.error("Create shop error:", error);
    next(error);
  }
};
// export const createStripeConnectLink = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ) => {
//   try {
//     const { sellerId } = req.body;

//     // Validate sellerId
//     if (!sellerId) {
//       return next(new ValidationError("sellerId is required"));
//     }

//     // Check if seller exists
//     const seller = await prisma.sellers.findUnique({
//       where: { id: sellerId },
//     });

//     if (!seller) {
//       return next(new ValidationError("Seller not found"));
//     }

//     // Create Stripe Express account
//     const account = await stripe.accounts.create({
//       type: "express",
//       email: seller.email,
//       country: "UK", // Nigeria
//       capabilities: {
//         card_payments: { requested: true },
//         transfers: { requested: true },
//       },
//       business_type: "individual", // Add business type
//       metadata: {
//         sellerId: seller.id,
//       },
//     });

//     // Update seller with Stripe account ID
//     await prisma.sellers.update({
//       where: { id: sellerId },
//       data: { stripeId: account.id },
//     });

//     // Create account link for onboarding
//     const accountLink = await stripe.accountLinks.create({
//       account: account.id,
//       refresh_url: `http://localhost:3000/success`,
//       return_url: `http://localhost:3000/success`,
//       type: "account_onboarding",

//     });

//     // Return the onboarding URL
//     res.status(200).json({
//       success: true,
//       url: accountLink.url,
//       stripeAccountId: account.id,
//     });
//   } catch (error: any) {
//     console.error("Stripe Connect Error:", error);

//     // Handle Stripe-specific errors
//     if (error.type === "StripeInvalidRequestError") {
//       return next(
//         new ValidationError("Invalid Stripe request: " + error.message)
//       );
//     }

//     return next(new Error("Failed to create Stripe Connect link"));
//   }
// };
export const createStripeConnectLink = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { sellerId } = req.body;

    if (!sellerId) {
      return next(new ValidationError("sellerId is required"));
    }

    const seller = await prisma.sellers.findUnique({
      where: { id: sellerId },
    });

    if (!seller) {
      return next(new ValidationError("Seller not found"));
    }

    // Check if seller already has Stripe account
    if (seller.stripeId) {
      return res.status(200).json({
        success: true,
        message: "Stripe account already connected",
        stripeAccountId: seller.stripeId,
      });
    }

    // ✅ FOR DEVELOPMENT: Mock Stripe account creation
    if (process.env.NODE_ENV === "development" && !process.env.STRIPE_CONNECT_ENABLED) {
      const mockAccountId = `acct_mock_${Date.now()}`;
      
      await prisma.sellers.update({
        where: { id: sellerId },
        data: { stripeId: mockAccountId },
      });

      return res.status(200).json({
        success: true,
        url: `${process.env.FRONTEND_URL}/success`,
        stripeAccountId: mockAccountId,
        message: "Mock Stripe account created for development",
      });
    }

    // Real Stripe Connect account creation
    const account = await stripe.accounts.create({
      type: "express",
      email: seller.email,
      country: "GB",
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_type: "individual",
      metadata: {
        sellerId: seller.id,
      },
    });

    await prisma.sellers.update({
      where: { id: sellerId },
      data: { stripeId: account.id },
    });

    // ✅ FIX: Missing // in refresh_url
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `http://localhost:3000/success`, // Fixed typo
      return_url: `http://localhost:3000/success`,
      type: "account_onboarding",
    });

    res.status(200).json({
      success: true,
      url: accountLink.url,
      stripeAccountId: account.id,
    });
  } catch (error: any) {
    console.error("Stripe Connect Error:", error);

    if (error.type === "StripeInvalidRequestError") {
      return next(
        new ValidationError("Invalid Stripe request: " + error.message)
      );
    }

    return next(
      new InternalServerError("Failed to create Stripe Connect link")
    );
  }
};
export const loginSeller = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      throw new NotFoundError("enter email and password fields");
    }

    const seller = await prisma.sellers.findUnique({ where: { email } });
    if (!seller) {
      throw new NotFoundError("no seller found with this email not found");
    }
    
    const isPasswordCorrect = await bcrypt.compare(password, seller.password!);
    if (!isPasswordCorrect) {
      throw new NotFoundError("password mismatched!");
    }

    const { accessToken, refreshToken } = await generateTokens(
      seller,
      "seller"
    );

    setCookie(res, "seller_access_token", accessToken);
    setCookie(res, "seller_refresh_token", refreshToken);

    // ✅ ADD: Return accessToken in response for localStorage
    res.status(200).json({
      success: true,
      message: "login successfully",
      accessToken, // ✅ Add this
      data: {
        id: seller.id,
        name: seller.name,
        email: seller.email,
      },
    });
  } catch (e: any) {
    next(e); // ✅ Use next() instead of throw
  }
};
export const getSellerInfo = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const seller = req.seller;
  try {
    res.status(200).json({
      success: true,
      seller,
    });
  } catch (error: any) {
    throw new InternalServerError("Bad request: " + error.message);

    next(error);
  }
};
