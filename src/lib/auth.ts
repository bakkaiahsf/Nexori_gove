import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

// Demo accounts for Phase 2 — Phase 3 will use Supabase Auth + SSO
const DEMO_USERS = [
  {
    id: "u_admin",
    email: "bakkaiahsf@gmail.com",
    name: "Governance Lead",
    role: "admin" as const,
  },
  {
    id: "u_approver",
    email: "approver@nexori.ai",
    name: "Senior Approver",
    role: "approver" as const,
  },
  {
    id: "u_viewer",
    email: "viewer@nexori.ai",
    name: "Board Observer",
    role: "viewer" as const,
  },
] satisfies Array<{
  id: string;
  email: string;
  name: string;
  role: "admin" | "governance-owner" | "approver" | "viewer";
}>;

const DEMO_PASSWORD = "nexori2025";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "NexoriOS",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "you@org.com" },
        password: { label: "Access Code", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = DEMO_USERS.find(
          (u) => u.email === credentials.email && credentials.password === DEMO_PASSWORD
        );
        return user ?? null;
      },
    }),
  ],
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 }, // 8-hour governance session
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = (user as (typeof DEMO_USERS)[number]).role;
        token.id = user.id ?? token.sub ?? "";
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.role = token.role;
        session.user.id = token.id;
      }
      return session;
    },
  },
  pages: {
    signIn: "/sign-in",
    error: "/sign-in",
  },
};

// Role capability matrix
export function canApprove(role: string) {
  return ["admin", "governance-owner", "approver"].includes(role);
}
export function canChangeAIMode(role: string) {
  return ["admin", "governance-owner"].includes(role);
}
export function canEmergencyLock(role: string) {
  return ["admin", "governance-owner"].includes(role);
}
