import prisma from "@shared/prisma";
import cron from "node-cron";

cron.schedule("0 * * * *", async () => {
  try {
    const now = new Date();
    await prisma.products.deleteMany({
      where: {
        isDeleted: true,
        deletedAt: { lte: now },
      },
    });
    
  } catch (e) {
    console.log(e);
    
  }
});
