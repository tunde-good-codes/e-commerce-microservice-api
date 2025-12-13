import dotenv from "dotenv";
dotenv.config();
import ImageKit from "imagekit";

export const imageKit = new ImageKit({
  publicKey: process.env.IMAGE_KIT_PUBLIC_KEY!,
  privateKey: process.env.IMAGE_KIT_SECRET_KEY!,
  urlEndpoint: "https://ik.imagekit.io/tundefadipe",
});
