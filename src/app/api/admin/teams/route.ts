import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, createAuditLog } from "@/lib/auth";
import { hashSync } from "bcryptjs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const teams = await prisma.team.findMany({
    where: { isActive: true },
    include: {
      members: {
        where: { isActive: true },
        select: { id: true, name: true, email: true, birthday: true, kommoUserId: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return Response.json(teams);
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { name, color, members } = await request.json();

  if (!name) {
    return Response.json({ error: "Takım adı gerekli" }, { status: 400 });
  }

  const team = await prisma.team.create({
    data: { name, color: color || "#6c5ce7" },
  });

  if (members && Array.isArray(members)) {
    for (const m of members) {
      if (m.name && m.email) {
        const exists = await prisma.user.findUnique({ where: { email: m.email } });
        if (exists) {
          await prisma.team.delete({ where: { id: team.id } });
          return Response.json({ error: `${m.email} zaten kayıtlı` }, { status: 400 });
        }
        await prisma.user.create({
          data: {
            name: m.name,
            email: m.email,
            password: hashSync("satis123", 10),
            role: "agent",
            teamId: team.id,
          },
        });
      }
    }
  }

  await createAuditLog(user.id, "create", "team", team.id, null, { name, color, members });

  const created = await prisma.team.findUnique({
    where: { id: team.id },
    include: { members: { select: { id: true, name: true, email: true } } },
  });

  return Response.json(created, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { action } = body;

  if (action === "add-member") {
    const { teamId, name, email, role, phone, iban } = body;
    if (!teamId || !name || !email) {
      return Response.json({ error: "Takım, isim ve email gerekli" }, { status: 400 });
    }
    const normalizedEmail = email.toLowerCase().trim();
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return Response.json({ error: "Bu email zaten kayıtlı" }, { status: 400 });
    }

    // Educators cannot be created as agents — auto-detect by role or email domain
    const isEducatorRole = role === "educator" || normalizedEmail.endsWith("@egitmen.superead.com");

    const member = await prisma.user.create({
      data: {
        name,
        email: normalizedEmail,
        password: hashSync("satis123", 10),
        role: isEducatorRole ? "educator" : "agent",
        teamId: isEducatorRole ? null : teamId,
      },
    });

    if (isEducatorRole) {
      await prisma.educator.create({
        data: { name, userId: member.id, isActive: true, phone: phone || null, iban: iban || null },
      });
    }

    await createAuditLog(user.id, "create", "user", member.id, null, { name, email: normalizedEmail, teamId, role: member.role, phone, iban });
    return Response.json(member);
  }

  if (action === "remove-member") {
    const { userId } = body;
    const old = await prisma.user.findUnique({ where: { id: userId } });
    await prisma.user.update({ where: { id: userId }, data: { isActive: false } });
    await createAuditLog(user.id, "update", "user", userId, old, { isActive: false });
    return Response.json({ success: true });
  }

  if (action === "move-member") {
    const { userId, teamId } = body;
    const old = await prisma.user.findUnique({ where: { id: userId } });
    await prisma.user.update({ where: { id: userId }, data: { teamId } });
    await createAuditLog(user.id, "update", "user", userId, old, { teamId });
    return Response.json({ success: true });
  }

  if (action === "reset-password") {
    const { userId, newPassword } = body;
    if (!newPassword || newPassword.length < 6) {
      return Response.json({ error: "Şifre en az 6 karakter olmalı" }, { status: 400 });
    }
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashSync(newPassword, 10) },
    });
    await createAuditLog(user.id, "update", "user", userId, null, { action: "reset-password" });
    return Response.json({ success: true });
  }

  if (action === "set-birthday") {
    const { userId, birthday } = body;
    await prisma.user.update({
      where: { id: userId },
      data: { birthday: birthday || null },
    });
    await createAuditLog(user.id, "update", "user", userId, null, { action: "set-birthday", birthday });
    return Response.json({ success: true });
  }

  if (action === "set-kommo-user") {
    const { userId, kommoUserId } = body;
    await prisma.user.update({
      where: { id: userId },
      data: { kommoUserId: kommoUserId ? parseInt(kommoUserId) : null },
    });
    await createAuditLog(user.id, "update", "user", userId, null, { action: "set-kommo-user", kommoUserId });
    return Response.json({ success: true });
  }

  const { id, name, color } = body;
  const old = await prisma.team.findUnique({ where: { id } });
  const team = await prisma.team.update({
    where: { id },
    data: { name, color },
  });
  await createAuditLog(user.id, "update", "team", id, old, { name, color });
  return Response.json(team);
}
