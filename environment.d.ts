declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: 'development' | 'production';
      DATABASE_URL: string

      SENDGRID_API_KEY: string
      SENDGRID_SENDER: string
      SENDGRID_FORGOT_PASSWORD_TEMPLATE: string
      SENDGRID_VERIFY_ACCOUNT_TEMPLATE: string

      JWT_FORGOT_PASSWORD_SECRET: string
      JWT_VERIFY_ACCOUNT_SECRET: string
      JWT_ACCESS_TOKEN_SECRET: string
      JWT_REFRESH_TOKEN_SECRET: string

      DOMAIN_URL: string

      GOOGLE_CLIENT_ID: string
      GOOGLE_CLIENT_SECRET: string
    }
  }
}

export {}