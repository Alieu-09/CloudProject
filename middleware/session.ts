import session from "express-session";
import "dotenv/config";

declare module "express-session" {
  interface SessionData {
    user?: {
      _id: string;
      username: string;
      role: "ADMIN" | "USER";
    };
  }
}

export default session({
  secret: process.env.SESSION_SECRET ?? "secret",
  resave: false,
  saveUninitialized: false,

  cookie: {
    maxAge: 1000 * 60 * 60 * 24, 
  },
});