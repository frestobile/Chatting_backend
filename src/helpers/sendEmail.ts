import nodemailer from 'nodemailer'

export default async function sendEmail(
  to: string,
  subject: string,
  html?: string,
  text?: string
) {
  try {
    const user = process.env.SMTP_USERNAME || 'info@roslink.net'
    const pass = process.env.SMTP_PASSWORD || 'sy5X_QE7J_x3_6_O'
    const transporter = nodemailer.createTransport({
      host: 'rostyle.sakura.ne.jp',
      port: 587,
      secure: false,
      auth: {
        user: user,
        pass: pass,
      },
    })

    await transporter.sendMail({
      from: process.env.SMTP_USERNAME || 'info@roslink.net',
      to,
      subject,
      html,
      text,
    })
  } catch (error) {
    console.log(error)
  }
}
