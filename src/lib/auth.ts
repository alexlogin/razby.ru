import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { getServerSession, type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import crypto from "node:crypto";
import { checkEmailCodeVerifyLimit, consumeEmailCode, isAuthEmailAllowed, normalizeAuthEmail, upsertEmailAuthUser } from "@/lib/email-auth";
import { checkPasswordSignInLimit, normalizePasswordEmail, verifyUserPassword } from "@/lib/password-auth";
import { prisma } from "@/lib/prisma";

const hasGoogleCredentials = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
const ownerAccessCode = process.env.RAZBY_OWNER_ACCESS_CODE || process.env.RAZBY_ADMIN_TOKEN;

function hasValidOwnerCode(value: string | undefined) {
  if (!ownerAccessCode || !value) {
    return false;
  }

  const provided = Buffer.from(value);
  const configured = Buffer.from(ownerAccessCode);
  return provided.length === configured.length && crypto.timingSafeEqual(provided, configured);
}

async function upsertOwnerUser() {
  return prisma.user.upsert({
    where: { email: "owner@razby.local" },
    update: {
      name: "Razby Owner",
      role: "OWNER",
    },
    create: {
      email: "owner@razby.local",
      name: "Razby Owner",
      image: null,
      role: "OWNER",
    },
  });
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      id: "email-password",
      name: "Email password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        const email = normalizePasswordEmail(credentials?.email ?? "");
        const password = String(credentials?.password ?? "");

        if (!email || !password || !checkPasswordSignInLimit(email, request)) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user?.passwordHash) {
          return null;
        }

        const verified = await verifyUserPassword(password, user.passwordHash);

        if (!verified) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
    CredentialsProvider({
      id: "email-code",
      name: "Email code",
      credentials: {
        email: { label: "Email", type: "email" },
        code: { label: "Code", type: "text" },
      },
      async authorize(credentials, request) {
        const email = normalizeAuthEmail(credentials?.email ?? "");
        const code = String(credentials?.code ?? "").trim();
        const host = typeof request?.headers?.host === "string" ? request.headers.host : undefined;

        if (!email || !code || !isAuthEmailAllowed(email, host) || !checkEmailCodeVerifyLimit(email)) {
          return null;
        }

        const verified = await consumeEmailCode(email, code);

        if (!verified) {
          return null;
        }

        const owner = await upsertEmailAuthUser(email);
        return {
          id: owner.id,
          email: owner.email,
          name: owner.name,
          image: owner.image,
        };
      },
    }),
    CredentialsProvider({
      id: "owner-code",
      name: "Owner access code",
      credentials: {
        accessCode: { label: "Access code", type: "password" },
      },
      async authorize(credentials) {
        if (!hasValidOwnerCode(credentials?.accessCode)) {
          return null;
        }

        const owner = await upsertOwnerUser();
        return {
          id: owner.id,
          email: owner.email,
          name: owner.name,
          image: owner.image,
        };
      },
    }),
    ...(hasGoogleCredentials
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          }),
        ]
      : []),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.id ?? token.sub ?? "");
      }
      return session;
    },
  },
};

export async function getSessionUser() {
  const session = await getServerSession(authOptions);
  return session?.user ?? null;
}

export async function getCurrentUser() {
  const sessionUser = await getSessionUser();

  if (sessionUser?.id) {
    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
    });

    if (user) {
      return user;
    }
  }

  if (process.env.RAZBY_DEMO_MODE === "true") {
    return prisma.user.upsert({
      where: { email: "demo@razby.local" },
      update: {},
      create: {
        email: "demo@razby.local",
        name: "Razby Demo",
        image: null,
      },
    });
  }

  return null;
}
