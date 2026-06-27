import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import AzureADProvider from "next-auth/providers/azure-ad";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db/connection";
import User from "@/lib/db/models/User";
import Organization from "@/lib/db/models/Organization";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        await connectDB();

        // Phase 1: single org
        const org = await Organization.findOne({}).lean();
        if (!org || !org.settings.localAuthEnabled) return null;

        const user = await User.findOne({
          organizationId: org._id,
          email: credentials.email,
          authProvider: "local",
          isActive: true,
        }).lean();

        if (!user || !user.passwordHash) return null;

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;

        await User.updateOne({ _id: user._id }, { lastLoginAt: new Date() });

        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          // Carried into jwt callback via (user as any)
          role: user.role,
          organizationId: org._id.toString(),
        };
      },
    }),

    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      tenantId: process.env.AZURE_AD_TENANT_ID!,
    }),
  ],

  callbacks: {
    async signIn({ account, profile }) {
      // Azure AD: upsert user on first login
      if (account?.provider === "azure-ad") {
        const azureOid = account.providerAccountId;
        if (!azureOid) return false;

        await connectDB();

        const org = await Organization.findOne({}).lean();
        if (!org) return false;

        const existing = await User.findOne({ organizationId: org._id, azureOid });
        if (!existing) {
          await User.create({
            organizationId: org._id,
            name: profile?.name ?? "Unknown",
            email: (profile as { email?: string })?.email ?? "",
            // Default role — Admin must promote via user management
            role: "product_manager",
            authProvider: "azure_ad",
            azureOid,
            isActive: true,
            lastLoginAt: new Date(),
          });
        } else {
          await User.updateOne({ _id: existing._id }, { lastLoginAt: new Date() });
        }
      }
      return true;
    },

    async jwt({ token, user, account }) {
      // Credentials: user returned from authorize() carries role + organizationId
      if (user && account?.provider === "credentials") {
        token.userId = user.id;
        token.role = (user as unknown as { role: string }).role as import("@/lib/db/models/User").UserRole;
        token.organizationId = (user as unknown as { organizationId: string }).organizationId;
      }

      // Azure AD: look up DB user by azureOid to get role + organizationId
      if (account?.provider === "azure-ad") {
        const azureOid = account.providerAccountId;
        if (azureOid) {
          await connectDB();
          const org = await Organization.findOne({}).lean();
          if (org) {
            const dbUser = await User.findOne({
              organizationId: org._id,
              azureOid,
            }).lean();
            if (dbUser) {
              token.userId = dbUser._id.toString();
              token.role = dbUser.role;
              token.organizationId = org._id.toString();
            }
          }
        }
      }

      return token;
    },

    async session({ session, token }) {
      session.user.userId = token.userId!;
      session.user.role = token.role!;
      session.user.organizationId = token.organizationId!;
      return session;
    },
  },

  pages: {
    signIn: "/login",
  },

  session: {
    strategy: "jwt",
  },
};
