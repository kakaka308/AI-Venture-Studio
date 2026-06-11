import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@ai-venture/db";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});
export async function POST(request: Request) { 
  const body = await request.json();
  const {email, password, name} = body;

  if (!email || !password) {
    return NextResponse.json({ error: "缺少邮箱或密码" }, { status: 400 });
  }
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });
  if (existingUser) {
    return NextResponse.json(
      { error: "邮箱已存在" },
      { status: 400 }
    );
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      name,
    },
  });

  return NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.name,
  });
}
