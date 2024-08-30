import Elysia from "elysia";
import { EmailVerificationDTO } from "../global-dtos/email.dto";
import { prisma } from "@/db/config";
import jwt from 'jsonwebtoken'
import { emailService } from "@/services/sendgrid";
import { TokenVerificationDTO } from "../global-dtos/token.dto";
import { errorMessage } from "@/utils/error-handler";
import { UserTypeQueryDTO } from "../global-dtos/user-type.dto";
import { v7 } from "uuid";
import type { MagicLinkPayload } from "@/utils/other-token-handler";
import { setUserDetails } from "@/utils/token-handler";

export const verifyAccountModule = new Elysia({ prefix: '/verify-account' })
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
      { id, sessionId }, process.env.JWT_VERIFY_ACCOUNT_SECRET, { expiresIn: '1d' }
    )
    const verifyAccountLink = `${process.env.DOMAIN_URL}/verify-account?token=${token}`
    const dynamicTemplateData = {
      name,
      verifyAccountLink,
    }

    await prisma.magicLinkSession.update({
      where: {
        type_userId: {
          userId: user.id,
          type: 'VERIFY_ACCOUNT'
        }
      },
      data: { sessionId }
    })

    await emailService.sendMail(
      data.email,
      'Account verification',
      process.env.SENDGRID_VERIFY_ACCOUNT_TEMPLATE,
      dynamicTemplateData
    )

    return { message: 'Account verification request sent successfully.' }
  }, {
    body: EmailVerificationDTO,
    query: UserTypeQueryDTO
  })
  .patch('/verify', async (c) => {
    const token = c.headers.authorization.split(' ')[1]

    let payload: MagicLinkPayload

    try {
      payload = jwt.verify(token, process.env.JWT_VERIFY_ACCOUNT_SECRET) as MagicLinkPayload
    } catch (err) {
      throw errorMessage(400, 'Invalid Magic Link.')
    }

    const findUser = await prisma.user.findUnique({
      where: {
        id: payload.id
      },
      include: { role: true }
    })

    if (!findUser) {
      throw errorMessage(404, 'Account does not exist')
    }

    const magicLinkSession = await prisma.magicLinkSession.findUnique({
      where: {
        type_userId: {
          userId: findUser.id,
          type: 'VERIFY_ACCOUNT'
        }
      }
    })

    if (magicLinkSession?.sessionId != payload.sessionId) {
      throw errorMessage(400, 'Invalid Magic Link.')
    }

    const user = await prisma.user.update({
      where: { id: payload.id },
      data: { status: 'VERIFIED' }
    })

    await prisma.magicLinkSession.update({
      where: { id: magicLinkSession.id },
      data: { sessionId: null }
    })

    const user_details = c.cookie.user_details.value

    if (user_details) {
      setUserDetails({ name: user.name, type: findUser.role.type, status: user.status }, c)
    }

    return { message: 'Account successfully verified!' }
  }, {
    headers: TokenVerificationDTO
  })