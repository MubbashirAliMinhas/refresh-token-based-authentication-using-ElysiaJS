import { prisma } from "@/db/config";
import { createTokenSet } from "@/utils/token-handler";
import Elysia from "elysia";
import { google } from "googleapis";

const redirectUrl = process.env.DOMAIN_URL + '/api/auth/google/callback'
const googleScopes = [
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile'
]

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  redirectUrl
)

const googleTokenInfoUrl = 'https://oauth2.googleapis.com/tokeninfo'

export const googleAuthModule = new Elysia({ prefix: '/google' })
  .get('', (c) => {
    const consentScreenUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: googleScopes.join(' ')
    })

    return c.redirect(consentScreenUrl)
  })
  .get('/callback', async (c) => {
    const code = c.query.code

    const { tokens } = await oauth2Client.getToken(code!)
    
    const idTokenResponse = await fetch(`${googleTokenInfoUrl}?id_token=${tokens.id_token}`)

    const userData = await idTokenResponse.json()
    
    const userSavingData = { email: userData.email as string, name: userData.name as string }

    const userRole = await prisma.role.findUnique({
      where: { type: 'USER' }
    })

    const findUser = await prisma.user.findUnique({
      where: {
        email_roleId: {
          email: userSavingData.email,
          roleId: userRole!.id
        }
      },
    })

    if (findUser?.password) {
      userSavingData.name = findUser.name
    }

    const user = await prisma.user.upsert({
      where: {
        email_roleId: {
          email: userSavingData.email,
          roleId: userRole!.id
        }
      },
      create: {
        name: userSavingData.name,
        email: userSavingData.email,
        roleId: userRole!.id,
        status: 'NOT_VERIFIED',
        magicLinkSessions: {
          createMany: {
            data: [
              { type: 'FORGOT_PASSWORD' },
              { type: 'VERIFY_ACCOUNT' }
            ]
          }
        }
      },
      update: {
        name: userSavingData.name
      },
    })

    await createTokenSet(user.id, c)

    return c.redirect(process.env.DOMAIN_URL)
  })