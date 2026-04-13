import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err, parseBody } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  const body = await parseBody<{
    transactionId?: number;
    category?: string;
  }>(req);

  if (!body.transactionId || !body.category) {
    return err("transactionId and category are required");
  }

  let cat = await prisma.expenseCategory.findUnique({
    where: { name: body.category },
  });

  if (!cat) {
    cat = await prisma.expenseCategory.create({
      data: { name: body.category, isSystem: false },
    });
  }

  await prisma.transaction.update({
    where: { id: body.transactionId },
    data: { categoryId: cat.id, categorizedBy: "manual" },
  });

  return ok({ category: cat.name, transactionId: body.transactionId });
}
