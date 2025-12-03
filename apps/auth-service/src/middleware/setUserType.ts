import { NextFunction, Response, Request } from "express";

export const setUserType = (userType: "user" | "seller") => {
  return (req: Request, res: Response, next: NextFunction) => {
    (req as any).userType = userType;
    next();
  };
};