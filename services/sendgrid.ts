import sendgrid from '@sendgrid/mail'

class EmailService {
  constructor() {
    sendgrid.setApiKey(process.env.SENDGRID_API_KEY)
  }

  async sendMail(to: string, subject: string, templateId: string, dynamicTemplateData: Object) {
    const body: sendgrid.MailDataRequired = {
      from: process.env.SENDGRID_SENDER,
      to: to,
      subject: subject,
      templateId: templateId,
      dynamicTemplateData: dynamicTemplateData
    };
    return await sendgrid.send(body)
  }
}

export const emailService = new EmailService()