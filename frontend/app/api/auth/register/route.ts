import { NextResponse } from "next/server";

import { createUser, findUserByEmail } from "@/lib/auth-store";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
      name?: string;
    };

    const email = body.email?.trim() ?? "";
    const password = body.password ?? "";
    const name = body.name?.trim() ?? "";

    if (!emailPattern.test(email)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }

    const existing = await findUserByEmail(email);
    if (existing) {
      return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
    }

    const user = await createUser({ email, password, name });
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Registration failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
