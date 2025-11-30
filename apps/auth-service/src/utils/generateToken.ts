import jwt from "jsonwebtoken";
import crypto from "crypto";
import RefreshToken from "../models/RefreshToken";
export const generateTokens = async (user: any, role:string) => {
  const accessToken = jwt.sign(
    {
      userId: user._id,
      role
    },
    process.env.JWT_SECRET as string,
    { expiresIn: "15m" }
  );

//   const refreshToken = crypto.randomBytes(40).toString("hex");
//   const expiresAt = new Date();
//   expiresAt.setDate(expiresAt.getDate() + 7); // expires in 7days

//   await RefreshToken.create({
//     refreshToken,
//     user: user._id,
//     expiresAt,
//   });

const refreshToken = jwt.sign(
    {
      userId: user._id,
      role
    },
    process.env.JWT_REFRESH_SECRET as string,
    { expiresIn: "7d" }
  );

  return { accessToken, refreshToken };
};
