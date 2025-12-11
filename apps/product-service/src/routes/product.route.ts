import { isAuthenticated } from './../../../auth-service/src/middleware/isAuth';
import { createDiscountCodes, deleteDiscountCodes, getCategories, getDiscountCodes } from "@/controllers/product.controllers";
import express, { Router } from "express"

const router:Router = express.Router();

router.get("/get-categories", getCategories)
router.post("/create-discount_codes", isAuthenticated, createDiscountCodes)
router.get("/get-discount-codes", isAuthenticated,getDiscountCodes)
router.delete("/delete-discount-codes/:id", isAuthenticated,deleteDiscountCodes)



export default router;
