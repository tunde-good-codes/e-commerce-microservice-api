import { loginUser, resetUserPassword, userForgotPassword, userRegistration, verifyForgotPasswordOtp, verifyUser } from "@/controllers/auth.controller";
import express, { Router } from "express";

const router: Router = express.Router();

router.post("/user-registration", userRegistration);
router.post("/verify-user", verifyUser);
router.post("/login", loginUser);
router.post("/forgot-password", userForgotPassword);
router.post("/reset-password", resetUserPassword);
router.post("/verify-forgot-password-otp", verifyForgotPasswordOtp);

export default router;
