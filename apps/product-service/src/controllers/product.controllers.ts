import { sellers } from "@prisma/client";
import { discount_codes } from "./../../../../node_modules/.prisma/client/index.d";
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

export const createProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.seller?.id) {
      return next(new ValidationError("Only sellers can create products"));
    }

    const {
      title,
      short_description,
      detailed_description,
      warranty,
      customer_specification,
      tags,
      slug,
      brand,
      cash_on_delivery,
      category,
      video_url,
      colors = [],
      sizes = [],
      discountCodes = [],
      stock,
      sale_price,
      regular_price,
      subCategory,
      customProperties = {},
      images = [],
    } = req.body;

    if (
      !title ||
      !short_description ||
      !detailed_description ||
      !slug ||
      !category ||
      !subCategory ||
      images.length === 0 ||
      stock === undefined ||
      sale_price === undefined ||
      regular_price === undefined
    ) {
      return next(new ValidationError("Required fields missing"));
    }

    const slugChecking = await prisma.products.findUnique({
      where: { slug },
    });

    if (slugChecking) {
      return next(new ValidationError("Use a different slug"));
    }

    const newProduct = await prisma.products.create({
      data: {
        title,
        short_description,
        detailed_description,
        warranty,
        cash_on_delivery,
        slug,
        shopId: req.seller.id,

        tags: Array.isArray(tags)
          ? tags
          : tags.split(",").map((t: string) => t.trim()),
        brand,
        video_url,
        category,
        subCategory,

        colors,
        sizes,

        stock: Number(stock),
        sale_price: Number(sale_price),
        regular_price: Number(regular_price),

        discountCodes,
        customProperties,
        customer_specification,
        images: {
          create: images
            .filter((img: any) => img && img.fileId && img.url)
            .map((img: any) => ({
              file_id: img.fileId,
              url: img.url,
            })),
        },
      },
      include: {
        images: true,
      },
    });

    res.status(201).json({
      message: "Product created successfully",
      product: newProduct,
    });
  } catch (e) {
    next(e);
  }
};

export const getShopProducts = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  try {
    const products = await prisma.products.findMany({
      where: {
        shopId: req.seller.shop.id,
      },
      include: {
        images: true,
      },
    });
    if (!products) {
      return res.status(401).json({
        success: false,
        message: "no codes found",
      });
    }
    res.status(200).json({
      success: true,
      products,
    });
  } catch (e: any) {
    return res.status(500).json({
      success: false,
      message: "internal server error: " + e.message,
    });
  }
};
export const deleteProduct = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  try {
    const { productId } = req.params;
    const sellerId = req.seller.shop.id;
    const products = await prisma.products.findUnique({
      where: {
        id: productId,
      },
      select: {
        id: true,
        shopId: true,
        isDeleted: true,
      },
    });
    if (!products) {
      return res.status(401).json({
        success: false,
        message: "unauthorized",
      });
    }
    if (products?.shopId !== sellerId ) {
      return res.status(401).json({
        success: false,
        message: "unauthorized",
      });
    }
    if (products.isDeleted) {
      return res.status(401).json({
        success: false,
        message: "product already deleted",
      });
    }



    const deletedProduct = await prisma.products.update({
      where:{
        id:productId
      }, data:{
        isDeleted:true, deletedAt: new Date(Date.now() + 24 * 60 *60 *1000 )
      }
    })



    res.status(200).json({
      success: true,
      products,
    });
  } catch (e: any) {
    return res.status(500).json({
      success: false,
      message: "internal server error: " + e.message,
    });
  }
};
export const restoreProduct = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  try {
    const { productId } = req.params;
    const sellerId = req.seller.shop.id;
    const products = await prisma.products.findUnique({
      where: {
        id: productId,
      },
      select: {
        id: true,
        shopId: true,
        isDeleted: true,
      },
    });
    if (!products) {
      return res.status(401).json({
        success: false,
        message: "unauthorized",
      });
    }
    if (products?.shopId !== sellerId ) {
      return res.status(401).json({
        success: false,
        message: "unauthorized",
      });
    }
    if (!products.isDeleted) {
      return res.status(401).json({
        success: false,
        message: "product already deleted",
      });
    }



    await prisma.products.update({
      where:{
        id:productId
      }, data:{
        isDeleted:false, deletedAt: null
      }
    })



    res.status(200).json({
      success: true,
      products,
    });
  } catch (e: any) {
    return res.status(500).json({
      success: false,
      message: "internal server error: " + e.message,
    });
  }
};
