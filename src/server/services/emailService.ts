import nodemailer from 'nodemailer'
import crypto from 'crypto'

const EMAIL_HOST = process.env.EMAIL_HOST
const EMAIL_PORT = parseInt(process.env.EMAIL_PORT || '587')
const EMAIL_USER = process.env.EMAIL_USER
const EMAIL_PASS = process.env.EMAIL_PASS
const EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME || 'NEXUS'
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000'

const transporter = nodemailer.createTransport({
    host: EMAIL_HOST,
    port: EMAIL_PORT,
    secure: EMAIL_PORT === 465,
    auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS,
    },
})

export const generateResetToken = (): string => {
    return crypto.randomBytes(32).toString('hex')
}

export const sendVerificationEmail = async (
    email: string,
    verificationToken: string,
    userName: string
): Promise<void> => {
    const verifyUrl = `${FRONTEND_URL}/verify-email?token=${verificationToken}`

    const mailOptions = {
        from: `"${EMAIL_FROM_NAME}" <${EMAIL_USER}>`,
        to: email,
        subject: 'Confirme seu e-mail - NEXUS',
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
                    .container { background-color: #f9f9f9; border-radius: 10px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                    .header { background: linear-gradient(135deg, #3B82F6 0%, #00D4AA 100%); color: white; padding: 20px; border-radius: 10px 10px 0 0; text-align: center; margin: -30px -30px 20px -30px; }
                    .header h1 { margin: 0; font-size: 28px; }
                    .button { display: inline-block; padding: 12px 30px; background: linear-gradient(135deg, #3B82F6 0%, #00D4AA 100%); color: white; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0; }
                    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; text-align: center; }
                    .warning { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 10px; margin: 20px 0; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header"><h1>NEXUS</h1></div>
                    <div class="content">
                        <p>Olá, <strong>${userName}</strong>!</p>
                        <p>Bem-vindo ao NEXUS. Para ativar sua conta, confirme seu e-mail clicando no botão abaixo:</p>
                        <div style="text-align: center;"><a href="${verifyUrl}" class="button">Confirmar e-mail</a></div>
                        <p>Ou copie e cole o link abaixo no seu navegador:</p>
                        <p style="word-break: break-all; color: #3B82F6;">${verifyUrl}</p>
                        <div class="warning"><strong>Importante:</strong> Este link expira em 24 horas.</div>
                        <p>Se você não criou esta conta, ignore este e-mail.</p>
                    </div>
                    <div class="footer">
                        <p>© ${new Date().getFullYear()} NEXUS - Sistema de Gestão Financeira</p>
                        <p>Este é um e-mail automático, por favor não responda.</p>
                    </div>
                </div>
            </body>
            </html>
        `,
        text: `Olá, ${userName}!\n\nConfirme seu e-mail para ativar sua conta NEXUS:\n${verifyUrl}\n\nEste link expira em 24 horas.\n\n© ${new Date().getFullYear()} NEXUS`,
    }

    try {
        await transporter.sendMail(mailOptions)
    } catch {
        throw new Error('Erro ao enviar e-mail de confirmação')
    }
}

export const sendPasswordResetEmail = async (
    email: string,
    resetToken: string,
    userName: string
): Promise<void> => {
    const resetUrl = `${FRONTEND_URL}/reset-password?token=${resetToken}`

    const mailOptions = {
        from: `"${EMAIL_FROM_NAME}" <${EMAIL_USER}>`,
        to: email,
        subject: 'Recuperação de Senha - NEXUS',
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
                    .container { background-color: #f9f9f9; border-radius: 10px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                    .header { background: linear-gradient(135deg, #3B82F6 0%, #00D4AA 100%); color: white; padding: 20px; border-radius: 10px 10px 0 0; text-align: center; margin: -30px -30px 20px -30px; }
                    .header h1 { margin: 0; font-size: 28px; }
                    .button { display: inline-block; padding: 12px 30px; background: linear-gradient(135deg, #3B82F6 0%, #00D4AA 100%); color: white; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0; }
                    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; text-align: center; }
                    .warning { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 10px; margin: 20px 0; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header"><h1>NEXUS</h1></div>
                    <div class="content">
                        <p>Olá, <strong>${userName}</strong>!</p>
                        <p>Você solicitou a recuperação de senha da sua conta NEXUS.</p>
                        <p>Para redefinir sua senha, clique no botão abaixo:</p>
                        <div style="text-align: center;"><a href="${resetUrl}" class="button">Redefinir Senha</a></div>
                        <p>Ou copie e cole o link abaixo no seu navegador:</p>
                        <p style="word-break: break-all; color: #3B82F6;">${resetUrl}</p>
                        <div class="warning"><strong>Importante:</strong> Este link expira em 1 hora por segurança.</div>
                        <p>Se você não solicitou esta recuperação de senha, ignore este email.</p>
                    </div>
                    <div class="footer">
                        <p>© ${new Date().getFullYear()} NEXUS - Sistema de Gestão Financeira</p>
                        <p>Este é um email automático, por favor não responda.</p>
                    </div>
                </div>
            </body>
            </html>
        `,
        text: `Olá, ${userName}!\n\nVocê solicitou a recuperação de senha da sua conta NEXUS.\n\nAcesse o link: ${resetUrl}\n\nEste link expira em 1 hora.\n\n© ${new Date().getFullYear()} NEXUS`,
    }

    try {
        await transporter.sendMail(mailOptions)
    } catch {
        throw new Error('Erro ao enviar email de recuperação de senha')
    }
}
