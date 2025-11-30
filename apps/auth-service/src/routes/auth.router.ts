import { loginUser, userRegistration, verifyUser } from "@/controllers/auth.controller";
import express, { Router } from "express";

const router: Router = express.Router();

router.post("/user-registration", userRegistration);
router.post("/verify-user", verifyUser);
router.post("/login", loginUser);

export default router;
