import Elysia from "elysia";
import { apiModule } from "./api/api-module";
import cors from "@elysiajs/cors";
import cron from "@elysiajs/cron";
import { prisma } from "./db/config";

const PORT = 3000

const app = new Elysia()
  .use(cors())
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
  .use(apiModule)
  .listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`)
  })