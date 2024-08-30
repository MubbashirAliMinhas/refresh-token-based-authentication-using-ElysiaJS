import type { Role, UserStatus } from "@prisma/client";
import { errorMessage } from "./error-handler";
import type { PayloadContext } from "./token-handler";
import { prisma } from "../db/config";

export function checkPermissions(permissions: string | string[], status: UserStatus = 'VERIFIED') {
  return async (context: any) => {
    const c = context as PayloadContext

    const userStatus = await prisma.user.findUnique({
      where: { id: c.userPayload.id },
      select: { status: true }
    })

    if (status == 'VERIFIED' && status != userStatus?.status) {
      throw errorMessage(401, "Please verify your account.")
    }

    const role = c.userPayload.role
    if (typeof permissions == 'string') {
      permissions = [ permissions ]
    }
  
    const compareResult = permissions.some(permission => role.permissions.includes(permission))
  
    if (!compareResult) {
      throw errorMessage(401, 'Insufficient permission to access this resource.')
    } 
  }
}