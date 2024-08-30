import Elysia from "elysia";
import { EmailVerificationDTO } from "../global-dtos/email.dto";
import { prisma } from "@/db/config";
import jwt from 'jsonwebtoken'
import { emailService } from "@/services/sendgrid";
import { PasswordDTO } from "./dtos/password.dto";
import { TokenVerificationDTO } from "../global-dtos/token.dto";
import { errorMessage } from "@/utils/error-handler";
import { UserTypeQueryDTO } from "../global-dtos/user-type.dto";
import { v7 } from "uuid";
import type { MagicLinkPayload } from "@/utils/other-token-handler";

export const forgotPasswordModule = new Elysia({ prefix: '/forgot-password' })
  .post('/email', async (c) => {
    const data = c.body
    const userType = c.query.user_type

    const role = await prisma.role.findUnique({
      where: { type: userType }
    })

    const user = await prisma.user.findUnique({
      where: {
        email_roleId: {
          email: data.email,
          roleId: role!.id
        }
      },
    })

    if (!user) {
      throw errorMessage(404, 'Account does not exist.')
    }

    const name = user.name
    const id = user.id

    const sessionId = v7()

    const token = jwt.sign(
      { id, sessionId }, process.env.JWT_FORGOT_PASSWORD_SECRET, { expiresIn: '30m' }
    )
    const resetPasswordLink = `${process.env.DOMAIN_URL}/forget-password?token=${token}`
    const dynamicTemplateData = {
      name,
      resetPasswordLink,
    }

    await prisma.magicLinkSession.update({
      where: {
        type_userId: {
          userId: user.id,
          type: 'FORGOT_PASSWORD'
        }
      },
      data: { sessionId }
    })

    await emailService.sendMail(
      data.email,
      'Reset password.',
      process.env.SENDGRID_FORGOT_PASSWORD_TEMPLATE,
      dynamicTemplateData
    )

    return { message: 'Password reset request sent successfully.' }
  }, {
    body: EmailVerificationDTO,
    query: UserTypeQueryDTO
  })
  .patch('/reset', async (c) => {
    const data = c.body
    const token = c.headers.authorization.split(' ')[1]

    let payload: MagicLinkPayload

    try {
      payload = jwt.verify(token, process.env.JWT_FORGOT_PASSWORD_SECRET) as MagicLinkPayload
    } catch (err) {
      throw errorMessage(400, 'Invalid Magic Link.')
    }

    const findUser = await prisma.user.findUnique({
      where: {
        id: payload.id
      },
    })

    if (!findUser) {
      throw errorMessage(404, 'Account does not exist.')
    }

    const magicLinkSession = await prisma.magicLinkSession.findUnique({
      where: {
        type_userId: {
          userId: findUser.id,
          type: 'FORGOT_PASSWORD'
        }
      }
    })

    if (magicLinkSession?.sessionId != payload.sessionId) {
      throw errorMessage(400, 'Invalid Magic Link.')
    }

    await prisma.user.update({
      where: { id: payload.id },
      data: { password: Bun.password.hashSync(data.password, { algorithm: 'bcrypt', cost: 10 }) }
    })

    await prisma.magicLinkSession.update({
      where: { id: magicLinkSession.id },
      data: { sessionId: null }
    })

    if (findUser.status == 'NOT_VERIFIED') {
      await prisma.user.update({
        where: { id: payload.id },
        data: { status: 'VERIFIED' }
      })

      await prisma.magicLinkSession.update({
        where: {
          type_userId: {
            userId: payload.id,
            type: 'VERIFY_ACCOUNT'
          },
        },
        data: { sessionId: null }
      })
    }

    return { message: 'Password successfully updated!' }
  }, {
    body: PasswordDTO,
    headers: TokenVerificationDTO
  })