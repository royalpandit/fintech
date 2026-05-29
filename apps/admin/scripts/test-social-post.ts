import { prisma } from "../lib/prisma";

async function main() {
  try {
    const rows = await prisma.communityPost.findMany({
      take: 1,
      include: {
        user: { select: { id: true, fullName: true, uuid: true } },
        images: { orderBy: { sortOrder: "asc" } },
        videos: { orderBy: { sortOrder: "asc" } },
        symbols: { orderBy: { sortOrder: "asc" } },
        _count: { select: { comments: true, reactions: true, saves: true } },
      },
    });
    console.log("GET OK", rows.length);
  } catch (e) {
    console.error("GET ERR", e);
  }

  const user = await prisma.user.findFirst({ select: { id: true } });
  if (!user) {
    console.log("No user");
    return;
  }

  try {
    const post = await prisma.communityPost.create({
      data: {
        userId: user.id,
        content: "test post",
        postType: "chart",
        sentiment: "bullish",
        symbols: {
          create: [{ symbol: "NIFTY", exchange: "NSE", token: "99926000", sortOrder: 0 }],
        },
        images: { create: [{ url: "/uploads/test.jpg", sortOrder: 0 }] },
      },
      include: {
        user: { select: { id: true, fullName: true, uuid: true } },
        images: true,
        videos: true,
        symbols: true,
        _count: { select: { comments: true, reactions: true, saves: true } },
      },
    });
    console.log("CREATE OK", post.id);
    await prisma.communityPost.delete({ where: { id: post.id } });
  } catch (e) {
    console.error("CREATE ERR", e);
  }
}

main()
  .finally(() => prisma.$disconnect());
