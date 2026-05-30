import { Request, Response, NextFunction } from "express";
import "express-session";

declare module "express-session" {
  interface SessionData {
    user?: {
      _id: string;
      username: string;
      role: "ADMIN" | "USER";
    };
  }
}
export function requireLogin(req:Request, res:Response, next:NextFunction) {
  if (!req.session.user) return res.redirect("/login");
  next();
}

export function requireAdmin(req:Request, res:Response, next:NextFunction) {
  if (!req.session.user || req.session.user.role !== "ADMIN") {
    return res.status(403).send("Geen toegang");
  }
  next();
}