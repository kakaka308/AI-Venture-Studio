import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaClient } from "@ai-venture/db";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

// 导出 NextAuth 的核心方法
// JWT 策略下不需要数据库 adapter —— Session 数据存于 JWT cookie，
// 用户验证由 CredentialsProvider.authorize() 直接处理
export const {handlers, auth, signIn, signOut} = NextAuth({
  session: { strategy: "jwt" },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "邮箱", type: "email" },
        password: { label: "密码", type: "password" },
      },
      // 验证用户凭据
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null; // 非空校验
        // 用户
        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });
        if (!user || !user.password) return null;
        // 密码验证
        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.password,
        );
        if (!isValid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
  // 
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  // 自定义页面
  pages: {
    signIn: "/login",
  },
})