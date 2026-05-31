const nodemailer = require('nodemailer');

let transporter = null;

function isSmtpConfigured() {
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    return user && pass && user !== 'your_email@gmail.com' && pass !== 'your_app_password';
}

function getTransporter() {
    if (!transporter) {
        transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.SMTP_PORT, 10) || 587,
            secure: process.env.SMTP_PORT === '465',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });
    }
    return transporter;
}

async function sendVerificationEmail(email, username, token) {
    if (!isSmtpConfigured()) {
        console.log('[Email Service] SMTP not configured, skipping verification email to', email);
        return false;
    }

    const verificationUrl = `${process.env.APP_URL || 'http://localhost:3000'}/pages/verify-email.html?token=${token}`;

    const mailOptions = {
        from: `"ChatWorld" <${process.env.EMAIL_FROM || 'noreply@chatworld.com'}>`,
        to: email,
        subject: 'Verify your email address',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background-color: #F5F2EB; padding: 30px; text-align: center;">
                    <h1 style="color: #1C1C1C; margin: 0;">ChatWorld</h1>
                </div>
                <div style="padding: 30px; background-color: #FAF7F0;">
                    <h2 style="color: #2F2F2F;">Welcome, ${username}!</h2>
                    <p style="color: #2F2F2F; line-height: 1.6;">Please verify your email address by clicking the button below:</p>
                    <a href="${verificationUrl}"
                       style="display: inline-block; background-color: #2F2F2F; color: #FAF7F0; text-decoration: none;
                              padding: 12px 30px; border-radius: 4px; margin: 20px 0;">
                        Verify Email
                    </a>
                    <p style="color: #B5B5B5; font-size: 12px; margin-top: 20px;">
                        If you did not create an account, please ignore this email.
                    </p>
                </div>
                <div style="background-color: #F5F2EB; padding: 20px; text-align: center; font-size: 12px; color: #B5B5B5;">
                    &copy; 2026 ChatWorld. All rights reserved.
                </div>
            </div>
        `
    };

    try {
        const t = getTransporter();
        await t.sendMail(mailOptions);
        return true;
    } catch (error) {
        console.error('[Email Service] Failed to send verification email:', error);
        return false;
    }
}

async function sendPasswordResetEmail(email, username, token) {
    if (!isSmtpConfigured()) {
        console.log('[Email Service] SMTP not configured, skipping password reset email to', email);
        return false;
    }

    const resetUrl = `${process.env.APP_URL || 'http://localhost:3000'}/pages/reset-password.html?token=${token}`;

    const mailOptions = {
        from: `"ChatWorld" <${process.env.EMAIL_FROM || 'noreply@chatworld.com'}>`,
        to: email,
        subject: 'Reset your password',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background-color: #F5F2EB; padding: 30px; text-align: center;">
                    <h1 style="color: #1C1C1C; margin: 0;">ChatWorld</h1>
                </div>
                <div style="padding: 30px; background-color: #FAF7F0;">
                    <h2 style="color: #2F2F2F;">Password Reset</h2>
                    <p style="color: #2F2F2F; line-height: 1.6;">Hello ${username},</p>
                    <p style="color: #2F2F2F; line-height: 1.6;">We received a request to reset your password. Click the button below to create a new password:</p>
                    <a href="${resetUrl}"
                       style="display: inline-block; background-color: #2F2F2F; color: #FAF7F0; text-decoration: none;
                              padding: 12px 30px; border-radius: 4px; margin: 20px 0;">
                        Reset Password
                    </a>
                    <p style="color: #B5B5B5; font-size: 12px; margin-top: 20px;">
                        This link expires in 1 hour. If you did not request this, please ignore this email.
                    </p>
                </div>
                <div style="background-color: #F5F2EB; padding: 20px; text-align: center; font-size: 12px; color: #B5B5B5;">
                    &copy; 2026 ChatWorld. All rights reserved.
                </div>
            </div>
        `
    };

    try {
        const t = getTransporter();
        await t.sendMail(mailOptions);
        return true;
    } catch (error) {
        console.error('[Email Service] Failed to send password reset email:', error);
        return false;
    }
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail };
