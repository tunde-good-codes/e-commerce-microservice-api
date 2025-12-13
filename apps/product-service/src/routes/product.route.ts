import { isAuthenticated } from "./../../../auth-service/src/middleware/isAuth";
import {
  createDiscountCodes,
  deleteDiscountCodes,
  deleteProductImage,
  getCategories,
  getDiscountCodes,
  uploadProductImage,
} from "@/controllers/product.controllers";
import { upload } from "@/utils/multer";
import express, { Router } from "express";

const router: Router = express.Router();

router.get("/get-categories", getCategories);
router.post("/create-discount_codes", isAuthenticated, createDiscountCodes);
router.get("/get-discount-codes", isAuthenticated, getDiscountCodes);
router.delete(
  "/delete-discount-codes/:id",
  isAuthenticated,
  deleteDiscountCodes
);
router.delete(
  "/delete-product-image",
  isAuthenticated,
  deleteProductImage
);
router.post(
  "/upload-product-image",
  isAuthenticated,
  upload.single("image"),
  uploadProductImage
);

export default router;
