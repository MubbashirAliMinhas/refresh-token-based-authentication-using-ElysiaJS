import { checkPermissions } from "@/utils/check-permissions";
import { Permission } from "@/utils/permission";
import { verifyAccessToken } from "@/utils/token-handler";
import Elysia from "elysia";

export const testModule = new Elysia({ prefix: '/test' })
  .derive(verifyAccessToken)
  .get('/admin', async () => {

  }, {
    beforeHandle: checkPermissions(Permission.ADMIN_PERMISSION)
  })
  .get('/user', async () => {

  }, {
    beforeHandle: checkPermissions(Permission.USER_PERMISSION)
  })