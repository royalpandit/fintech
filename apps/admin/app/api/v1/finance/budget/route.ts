import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  const userId = Number(req.headers.get("x-user-id"));
  if (!userId) return err("Unauthorized", 401);

  const body = await parseBody<{
    category?: string;
    monthlyLimit?: number;
    month?: string;
  }>(req);

  if (!body.monthlyLimit || !body.month) {
    return err("monthlyLimit and month (YYYY-MM) are required");
  }

  let categoryId: number | null = null;
  if (body.category) {
    let cat = await prisma.expenseCategory.findUnique({
      where: { name: body.category },
    });
    if (!cat) {
      cat = await prisma.expenseCategory.create({
        data: { name: body.category, isSystem: false },
      });
    }
    categoryId = cat.id;
  }

  const budget = await prisma.budget.upsert({
    where: {
      userId_categoryId_monthKey: {
        userId,
        categoryId: categoryId ?? 0,
        monthKey: body.month,
      },
    },
    update: { monthlyLimit: body.monthlyLimit },
    create: {
      userId,
      categoryId,
      monthKey: body.month,
      monthlyLimit: body.monthlyLimit,
    },
  });

  return ok({ budget });
}
