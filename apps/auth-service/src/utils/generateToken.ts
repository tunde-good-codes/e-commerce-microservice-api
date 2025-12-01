import jwt from "jsonwebtoken";




// In your token generation code (probably in auth service)
export const generateTokens = async (user: any, role: string) => {
  const accessToken = jwt.sign(
    { 
      id: user.id, // <-- Make sure this is included
      email: user.email,
      role: role 
    },
    process.env.JWT_SECRET!,
    { expiresIn: '15m' } // or your preferred expiry
  );

  const refreshToken = jwt.sign(
    { 
      id: user.id, // <-- Include here too
      email: user.email,
      role: role 
    },
    process.env.JWT_REFRESH_SECRET!,
    { expiresIn: '7d' }
  );

  return { accessToken, refreshToken };
};