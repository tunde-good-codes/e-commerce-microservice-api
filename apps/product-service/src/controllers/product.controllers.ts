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
