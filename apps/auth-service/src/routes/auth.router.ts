import {
  createShop,
  getUserInfo,
  loginUser,
  refreshTokenHandler,
  registerSeller,
  resetUserPassword,
  userForgotPassword,
  userRegistration,
  verifyForgotPasswordOtpHandler,
  verifySeller,
  verifyUser,
} from "@/controllers/auth.controller";
import { isAuthenticated } from "@/middleware/isAuth";
import { setUserType } from "@/middleware/setUserType";
import express, { Router } from "express";

const router: Router = express.Router();

router.post("/user-registration", userRegistration);
router.post("/verify-user", verifyUser);
router.post("/login", loginUser);

// In routes
router.post("/forgot-password", setUserType("user"), userForgotPassword);
router.post(
  "/seller/forgot-password",
  setUserType("seller"),
  userForgotPassword
);
router.post("/refresh-token", refreshTokenHandler);
router.get("/auth-user", isAuthenticated, getUserInfo);
router.post("/reset-password", resetUserPassword);
router.post("/verify-forgot-password-otp", verifyForgotPasswordOtpHandler);


router.post("/seller-registration", registerSeller);
router.post("/verify-seller", verifySeller);
router.post("/create-shop", createShop);


export default router;
