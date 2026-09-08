import { Router } from "express";
import { hashPassword } from "better-auth/crypto";
import { createUserSchema, updateUserSchema } from "core/schemas/users.ts";
import { Role } from "core/constants/role.ts";
import { requireAuth } from "../middleware/require-auth";
import { requireAdmin } from "../middleware/require-admin";
import { validate } from "../lib/validate";
import prisma from "../db";
import { AI_AGENT_ID } from "core/constants/ai-agent.ts";

const router = Router();

router.get("/", requireAuth, requireAdmin, async (req, res) => {
  const users = await prisma.user.findMany({
    where: { deletedAt: null, id: { not: AI_AGENT_ID } },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  res.json({ users });
});

router.post("/", requireAuth, requireAdmin, async (req, res) => {
  const data = validate(createUserSchema, req.body, res);
  if (!data) return;

  const { name, email, password } = data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ error: "Email already exists" });
    return;
  }

  const hashedPassword = await hashPassword(password);
  const userId = crypto.randomUUID();
  const now = new Date();

  await prisma.$transaction([
    prisma.user.create({
      data: {
        id: userId,
        name,
        email,
        emailVerified: false,
        role: Role.agent,
        createdAt: now,
        updatedAt: now,
      },
    }),
    prisma.account.create({
      data: {
        id: crypto.randomUUID(),
        accountId: userId,
        providerId: "credential",
        userId,
        password: hashedPassword,
        createdAt: now,
        updatedAt: now,
      },
    }),
  ]);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });

  res.status(201).json({ user });
});

router.put("/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = req.params.id as string;

  const data = validate(updateUserSchema, req.body, res);
  if (!data) return;

  const { name, email, password, role } = data;

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  // An admin changing their own role would revoke their own access on the next
  // request. It also blocks every *sequential* path to zero admins: demoting the
  // final admin can only be done by that admin, and this refuses it. It is not a
  // true floor under concurrency — two admins demoting each other in the same
  // window both pass requireAdmin before either write commits. Accepted: no AC
  // asks for a floor, and enforcing one needs a serializable transaction.
  if (req.user.id === id && role !== target.role) {
    res.status(403).json({ error: "You cannot change your own role" });
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && existing.id !== id) {
    res.status(409).json({ error: "Email already exists" });
    return;
  }

  await prisma.user.update({
    where: { id: id },
    data: { name, email, role, updatedAt: new Date() },
  });

  if (password) {
    const hashedPassword = await hashPassword(password);
    await prisma.account.updateMany({
      where: { userId: id, providerId: "credential" },
      data: { password: hashedPassword, updatedAt: new Date() },
    });
  }

  // requireAdmin reads the role Better Auth joins fresh from the User row on
  // every request, so a demotion already binds the next one. Dropping the
  // sessions makes that hold even if session.cookieCache is ever enabled.
  if (target.role === Role.admin && role === Role.agent) {
    await prisma.session.deleteMany({ where: { userId: id } });
  }

  const user = await prisma.user.findUnique({
    where: { id: id },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });

  res.json({ user });
});

router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = req.params.id as string;

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (user.role === Role.admin) {
    res.status(403).json({ error: "Admin users cannot be deleted" });
    return;
  }

  await prisma.user.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  await prisma.ticket.updateMany({
    where: { assignedToId: id },
    data: { assignedToId: null },
  });

  await prisma.session.deleteMany({ where: { userId: id } });

  res.json({ message: "User deleted" });
});

export default router;
