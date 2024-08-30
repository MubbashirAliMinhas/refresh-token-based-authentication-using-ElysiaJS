import { newTokenSet } from "@/utils/token-handler";
import Elysia from "elysia";

export const refreshModule = new Elysia({ prefix: '/refresh' })
  .get('', async c => {
    await newTokenSet(c)
  })