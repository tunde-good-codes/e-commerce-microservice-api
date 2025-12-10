import { getCategories } from "@/controllers/product.controllers";
import express, { Router } from "express"

const router:Router = express.Router();

router.get("/get-categories", getCategories)

export default router;
