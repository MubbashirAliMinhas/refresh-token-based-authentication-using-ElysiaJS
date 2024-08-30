import Elysia from "elysia";
import { googleAuthModule } from "./google/module";
import { LoginUserDTO, UserDTO } from "./dtos/user.dto";
import { prisma } from "@/db/config";
import jwt from 'jsonwebtoken'
import { successResponse } from "@/utils/success-response";
import { prismaUniqueHandler } from "@/utils/prisma-unique-handler";
import { errorMessage } from "@/utils/error-handler";
import { createTokenSet, removeCookie, verifyAccessToken } from "@/utils/token-handler";

export const authModule = new Elysia({ prefix: '/auth' })
  .use(googleAuthModule)
  .post('/login', async (c) => {
    const data = c.body

    const userRole = await prisma.role.findUnique({
      where: { type: 'USER' }
    })

    const user = await prisma.user.findUnique({
      where: {
        email_roleId: {
          email: data.email,
          roleId: userRole!.id
        }
      },
    })

    if (!user) {
      throw errorMessage(404, 'User does not exist.')
    }

    if (!user.password || !Bun.password.verifySync(data.password, user.password)) {
      throw errorMessage(400, 'Incorrect password.')
    }

    await createTokenSet(user.id, c)

    return successResponse
  }, {
    body: LoginUserDTO
  })
  .post('/login-admin', async (c) => {
    const data = c.body

    const adminRole = await prisma.role.findUnique({
      where: { type: 'ADMIN' }
    })

    const user = await prisma.user.findUnique({
      where: {
        email_roleId: {
          email: data.email,
          roleId: adminRole!.id
        }
      },
    })

    if (!user) {
      throw errorMessage(404, 'User does not exist.')
    }

    if (!user.password || !Bun.password.verifySync(data.password, user.password)) {
      throw errorMessage(400, 'Incorrect password.')
    }

    await createTokenSet(user.id, c)

    return successResponse
  }, {
    body: LoginUserDTO
  })
  .post('/signup', async (c) => {
    const data = c.body
    data.password = await Bun.password.hash(data.password, { algorithm: 'bcrypt', cost: 10 })

    const userRole = await prisma.role.findUnique({
      where: { type: 'USER' }
    })
    
    const user = await prismaUniqueHandler(async () => await prisma.user.create({
      data: {
        name: data.name,
        password: data.password,
        email: data.email,
        roleId: userRole!.id,
        status: 'NOT_VERIFIED',
        magicLinkSessions: {
          createMany: {
            data: [
              { type: 'VERIFY_ACCOUNT' },
              { type: 'FORGOT_PASSWORD' }
            ]
          }
        }
      },
    }), 'User already exists with this email address.')
    
    await createTokenSet(user.id, c)

    return successResponse
  }, {
    body: UserDTO
  })

authModule
  .derive(verifyAccessToken)
  .delete('/logout', async (c) => {
    removeCookie('access_token', c)
    removeCookie('refresh_token', c)
    removeCookie('user_details', c)

    return { message: "Logged out user from server" }
  })