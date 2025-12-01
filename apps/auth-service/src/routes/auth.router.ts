import {
  getUserInfo,
  loginUser,
  refreshTokenHandler,
  resetUserPassword,
  userForgotPassword,
  userRegistration,
  verifyForgotPasswordOtpHandler,
  verifyUser,
} from "@/controllers/auth.controller";
import { isAuthenticated } from "@/middleware/isAuth";
import express, { Router } from "express";

const router: Router = express.Router();

router.post("/user-registration", userRegistration);
router.post("/verify-user", verifyUser);
router.post("/login", loginUser);
router.post("/forgot-password", userForgotPassword);
router.post("/refresh-token", refreshTokenHandler);
router.get("/auth-user", isAuthenticated, getUserInfo);
router.post("/reset-password", resetUserPassword);
router.post("/verify-forgot-password-otp", verifyForgotPasswordOtpHandler);

export default router;
