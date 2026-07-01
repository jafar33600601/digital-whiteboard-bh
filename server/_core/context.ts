import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { jwtVerify } from "jose";
import { getLocalUserById } from "../db";
import { parse as parseCookies } from "cookie";

const LOCAL_AUTH_COOKIE = "local_session";
const getJwtSecret = () => new TextEncoder().encode(process.env.JWT_SECRET || "local-secret-key-change-in-production");

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

async function getLocalUserFromRequest(req: CreateExpressContextOptions["req"]): Promise<User | null> {
  try {
    // قراءة الـ token من Authorization header أو من الكوكي
    let token: string | undefined;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.slice(7);
    } else {
      const cookieHeader = req.headers.cookie;
      const cookies = cookieHeader ? parseCookies(cookieHeader) : {};
      token = cookies[LOCAL_AUTH_COOKIE];
    }
    if (!token) return null;

    const { payload } = await jwtVerify(token, getJwtSecret());
    // تحقق أن الـ token من نوع local
    if (payload.type !== "local") return null;

    const userId = Number(payload.sub);
    const localUser = await getLocalUserById(userId);
    if (!localUser) return null;

    // تحويل LocalUser إلى User type المتوافق مع protectedProcedure
    const user: User = {
      id: localUser.id,
      openId: `local_${localUser.id}`,
      name: localUser.name,
      email: localUser.email,
      loginMethod: "local",
      role: localUser.role,
      createdAt: localUser.createdAt,
      updatedAt: localUser.createdAt,
      lastSignedIn: localUser.createdAt,
    };
    return user;
  } catch {
    return null;
  }
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  // أولاً: حاول Manus OAuth
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch {
    user = null;
  }

  // ثانياً: إذا فشل Manus OAuth، حاول Local JWT
  if (!user) {
    user = await getLocalUserFromRequest(opts.req);
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
