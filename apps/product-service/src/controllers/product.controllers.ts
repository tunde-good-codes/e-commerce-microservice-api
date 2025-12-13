import { imageKit } from "@/utils/imageKit";
import { ValidationError } from "@shared/error-handler";
import prisma from "@shared/prisma";
import { NextFunction, Request, Response } from "express";

export const getCategories = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const config = await prisma.site_config.findFirst();
    if (!config) {
      return res.status(401).json({
        success: false,
        message: "no categories found",
      });
    }
    res.status(200).json({
      success: true,
      data: {
        categories: config.categories,
        subCategories: config.subCategories,
        message: "categories fetched",
      },
    });
  } catch (e: any) {
    return res.status(500).json({
      success: false,
      message: "internal server error: " + e.message,
    });
  }
};

export const createDiscountCodes = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  try {
    const { discountType, discountValue, discountCode, public_name } = req.body;
    const discountCodeExists = await prisma.discount_codes.findUnique({
      where: { discountCode },
    });

    if (discountCodeExists) {
      return next(new ValidationError("Discount Code Already Exists"));
    }

    const discount_code = await prisma.discount_codes.create({
      data: {
        discountCode,
        discountType,
        discountValue,
        public_name,
        sellerId: req?.seller?.id!,
      },
    });

    res.status(201).json({
      success: true,
      discount_code,
    });
  } catch (e) {}
};

export const getDiscountCodes = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  try {
    const discountCodes = await prisma.discount_codes.findMany({
      where: {
        sellerId: req.seller.id,
      },
    });
    if (!discountCodes) {
      return res.status(401).json({
        success: false,
        message: "no codes found",
      });
    }
    res.status(200).json({
      success: true,
      discountCodes,
    });
  } catch (e: any) {
    return res.status(500).json({
      success: false,
      message: "internal server error: " + e.message,
    });
  }
};

export const deleteDiscountCodes = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { sellerId } = req.seller.id;
    const discountCodes = await prisma.discount_codes.findUnique({
      where: {
        id,
      },
      select: { id: true, sellerId: true },
    });
    if (!discountCodes) {
      return res.status(401).json({
        success: false,
        message: "no codes found",
      });
    }
    if (!discountCodes !== sellerId) {
      return res.status(401).json({
        success: false,
        message: "unauthorized access",
      });
    }

    await prisma.discount_codes.delete({
      where: { id },
    });
    res.status(200).json({
      success: true,
      discountCodes,
    });
  } catch (e: any) {
    return res.status(500).json({
      success: false,
      message: "internal server error: " + e.message,
    });
  }
};

export const uploadProductImage = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No image uploaded" });
    }

    const response = await imageKit.upload({
      file: req.file.buffer, // ✅ correct
      fileName: `product-${Date.now()}.jpg`,
      folder: "/product",
    });

    res.status(201).json({
      file_url: response.url,
      fileId: response.fileId,
    });
  } catch (error) {
    next(error);
  }
};
export const deleteProductImage = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { fileId } = req.body;
    const response = await imageKit.deleteFile(fileId);

    res.status(201).json({
      success: true,
      response,
    });
  } catch (error) {
    next(error);
  }
};
