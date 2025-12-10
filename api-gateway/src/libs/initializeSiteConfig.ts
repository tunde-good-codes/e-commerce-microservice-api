import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const initializedConfig = async () => {
  try {
    const existingConfigs = await prisma.site_config.findFirst();

    if (!existingConfigs) {
      await prisma.site_config.create({
        data: {
          categories: [
            "Electronics",
            "Fashion",
            "Home & Kitchen",
            "Sports & Fitness",
          ],
          subCategories: {
            Electronics: ["mobiles", "laptops", "gaming", "Accessories"],
            Fashion: ["men", "women", "kids", "Footwear"],
            "Home & Kitchen": [
              "furniture",
              "appliance",
              "decor",
              "Accessories",
            ],
            "Sport & Fitness": ["gym equipment", "outdoor sports", "wearables"],
          },
        },
      });
    }
  } catch (e) {
    console.log("error initializing site config: " + e);
  }
};


export default initializedConfig