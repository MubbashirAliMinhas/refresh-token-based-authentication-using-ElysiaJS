import { prisma } from "@/db/config";
import cron from "@elysiajs/cron";
import Elysia from "elysia";

export const cronPlugin = new Elysia()
  .use(cron({
    name: "removeRefreshSessions",
    pattern: "0 0 * * *",
    run: async () => {
      const previousDate = new Date()
      previousDate.setDate(previousDate.getDate() - 10)

      await prisma.refreshTokenSession.deleteMany({
        where: {
          createdAt: { lt: previousDate }
        }
      })
    }
  }))
  .use(cron({
    name: "removeUsers",
    pattern: "0 0 * * *",
    run: async () => {
      const previousDate = new Date()
      previousDate.setDate(previousDate.getDate() - 15)

      await prisma.user.deleteMany({
        where: {
          createdAt: { lt: previousDate }
        }
      })
    }
  }))