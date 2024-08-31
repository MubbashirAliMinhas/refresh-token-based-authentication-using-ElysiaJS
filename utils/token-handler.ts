import type { UserType } from "@prisma/client";
import { prisma } from "../db/config";
import { sign, TokenExpiredError, verify } from "jsonwebtoken";
import { errorMessage } from "./error-handler";
import type { Context } from "elysia";

type TokenRole = {
  id: string
  type: UserType
  permissions: string[]
}

export type AccessTokenPayload = {
  id: string
  role: TokenRole
  iat?: number
  exp?: number
}

type RefreshTokenPayload = {
  id: string
  iat?: number
  exp?: number
}

export type PayloadContext = Context & { userPayload: AccessTokenPayload }

const cookieOptions = {
  httpOnly: true,
  secure: true
}

export async function createTokenSet(userId: string, c: Context) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      role: {
        include: { permissions: true }
      }
    }
  })

  const role: TokenRole = {
    id: user!.role.id,
    type: user!.role.type,
    permissions: user!.role.permissions.map(x => x.name)
  }

  const payload: AccessTokenPayload = {
    id: user!.id,
    role: role,
  }

  const accessToken = sign(payload, process.env.JWT_ACCESS_TOKEN_SECRET, {
    expiresIn: '30m'
  })

  const expiry = new Date()
  expiry.setDate(expiry.getDate() + 7)

  const refreshTokenSession = await prisma.refreshTokenSession.create({
    data: {
      userId: user!.id
    }
  })

  const refreahTokenPayload: RefreshTokenPayload = { id: user!.id }

  const refreshToken = sign(refreahTokenPayload, process.env.JWT_REFRESH_TOKEN_SECRET, {
    expiresIn: '7d'
  }) 

  const userDetails = { name: user?.name, type: user?.role.type, status: user?.status }

  setCookie('access_token', accessToken, expiry, c)
  setCookie('refresh_token', refreshToken, expiry, c)
  setCookie('user_details', userDetails, expiry, c)
}

export async function newTokenSet(c: Context) {
  const refreshToken = c.cookie.refresh_token.value

  if (!refreshToken) {
    throw errorMessage(401, 'Authentication required.')
  }

  let payload: RefreshTokenPayload
  try {
    payload = verify(refreshToken, process.env.JWT_REFRESH_TOKEN_SECRET) as RefreshTokenPayload
  } catch (e) {
    if (e instanceof TokenExpiredError) {
      throw errorMessage(401, 'Session expired.')
    }
    throw errorMessage(401, 'Invalid refresh token.')
  }
   
  const refreshTokenSession = await prisma.refreshTokenSession.findUnique({
    where: { id: payload.id }
  })

  if (!refreshTokenSession) {
    throw errorMessage(401, 'Invalid refresh token.')
  }

  await prisma.refreshTokenSession.deleteMany({
    where: { id: payload.id }
  })

  await createTokenSet(refreshTokenSession.userId, c)
}

export async function checkRefreshToken(c: Context) {
  const refreshToken = c.cookie.refresh_token.value

  if (!refreshToken) {
    return false
  }

  let payload: RefreshTokenPayload
  try {
    payload = verify(refreshToken, process.env.JWT_REFRESH_TOKEN_SECRET) as RefreshTokenPayload
  } catch (e) {
    return false
  }
   
  const refreshTokenSession = await prisma.refreshTokenSession.findUnique({
    where: { id: payload.id }
  })

  if (!refreshTokenSession) {
    return false
  }

  return true
}

export async function verifyAccessToken(c: Context) {
  const accessToken = c.cookie.access_token
  if (!accessToken.value) {
    throw errorMessage(401, "Access token is required to access this resource.")
  }

  let payload: AccessTokenPayload
  try {
    payload = verify(accessToken.value, process.env.JWT_ACCESS_TOKEN_SECRET) as AccessTokenPayload
  } catch (e) {
    throw errorMessage(401, 'Invalid access token.')
  }

  return { user: payload }
}

export function setUserDetails(userDetails: any, c: Context) {
  const user_details = c.cookie.user_details
  
  const expiry = new Date()
  expiry.setDate(expiry.getDate() + 7)
  
  user_details.set({
    value: userDetails,
    expires: expiry,
    ...cookieOptions
  })
}

export function setCookie(name: string, value: any, expiry: Date, c: Context) {
  const cookie = c.cookie[name]

  cookie.set({
    value: value,
    expires: expiry,
    ...cookieOptions
  })
}

export function removeCookie(name: string, c: Context) {
  const cookie = c.cookie[name]
  cookie.remove()
  delete c.cookie[name]
}