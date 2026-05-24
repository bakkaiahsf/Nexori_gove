import type { DefaultSession } from "next-auth";
import type { DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "admin" | "governance-owner" | "approver" | "viewer";
    } & DefaultSession["user"];
  }
  interface User {
    role: "admin" | "governance-owner" | "approver" | "viewer";
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    role: "admin" | "governance-owner" | "approver" | "viewer";
    id: string;
  }
}
