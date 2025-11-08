import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { logger } from '../config/logger';

// Create reusable transporter
let transporter: nodemailer.Transporter | null = null;

/**
 * Initialize email transporter
 */
export function initEmailService(): void {
  // Only initialize if email credentials are configured
  if (!env.EMAIL_USER || !env.EMAIL_PASSWORD) {
    logger.warn('Email not configured - emails will not be sent. Set EMAIL_USER and EMAIL_PASSWORD to enable email functionality.');
    return;
  }

  // Gmail SMTP configuration
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: env.EMAIL_USER,
      pass: env.EMAIL_PASSWORD,
    },
  });

  logger.info('Email service initialized with Gmail SMTP');
}

/**
 * Verify email transporter connection
 */
export async function verifyEmailConnection(): Promise<boolean> {
  if (!transporter) {
    logger.warn('Email transporter not initialized');
    return false;
  }

  try {
    await transporter.verify();
    logger.info('Email service connection verified');
    return true;
  } catch (error) {
    logger.error({ error }, 'Email service connection failed');
    return false;
  }
}

/**
 * Send user credentials email
 */
export async function sendUserCredentialsEmail(
  to: string,
  name: string,
  loginId: string,
  tempPassword: string,
  role: string,
  companyName?: string
): Promise<void> {
  if (!transporter) {
    logger.warn({ to, loginId }, 'Email transporter not initialized - skipping email send');
    return;
  }

  const appName = env.APP_NAME;
  const appUrl = env.APP_URL || 'http://localhost:5173';
  const fromEmail = env.EMAIL_USER || 'noreply@workzen.com';

  const roleDisplay = {
    admin: 'Administrator',
    hr: 'HR Officer',
    payroll: 'Payroll Officer',
    employee: 'Employee',
  }[role] || role;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          background-color: #4F46E5;
          color: white;
          padding: 20px;
          text-align: center;
          border-radius: 8px 8px 0 0;
        }
        .content {
          background-color: #f9fafb;
          padding: 30px;
          border: 1px solid #e5e7eb;
          border-top: none;
        }
        .credentials {
          background-color: white;
          padding: 20px;
          border-radius: 8px;
          margin: 20px 0;
          border: 2px solid #e5e7eb;
        }
        .credential-item {
          margin: 10px 0;
          padding: 10px;
          background-color: #f3f4f6;
          border-radius: 4px;
        }
        .label {
          font-weight: bold;
          color: #6b7280;
          font-size: 14px;
        }
        .value {
          font-size: 18px;
          color: #111827;
          font-family: 'Courier New', monospace;
          margin-top: 5px;
        }
        .warning {
          background-color: #fef3c7;
          border-left: 4px solid #f59e0b;
          padding: 15px;
          margin: 20px 0;
          border-radius: 4px;
        }
        .footer {
          text-align: center;
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          color: #6b7280;
          font-size: 12px;
        }
        .button {
          display: inline-block;
          padding: 12px 24px;
          background-color: #4F46E5;
          color: white;
          text-decoration: none;
          border-radius: 6px;
          margin: 20px 0;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Welcome to ${appName}${companyName ? ` - ${companyName}` : ''}</h1>
      </div>
      <div class="content">
        <p>Hello ${name},</p>
        
        <p>Your account has been created as a <strong>${roleDisplay}</strong>. Below are your login credentials:</p>
        
        <div class="credentials">
          <div class="credential-item">
            <div class="label">Login ID:</div>
            <div class="value">${loginId}</div>
          </div>
          <div class="credential-item">
            <div class="label">Temporary Password:</div>
            <div class="value">${tempPassword}</div>
          </div>
        </div>
        
        <div class="warning">
          <strong>⚠️ Important:</strong> Please change your password after your first login for security purposes.
        </div>
        
        <p>You can log in using either your Login ID or email address (${to}).</p>
        
        <div style="text-align: center;">
          <a href="${appUrl}/login" class="button">Login to ${appName}</a>
        </div>
        
        <p>If you have any questions, please contact your administrator.</p>
      </div>
      
      <div class="footer">
        <p>This is an automated email. Please do not reply to this message.</p>
        <p>&copy; ${new Date().getFullYear()} ${appName}. All rights reserved.</p>
      </div>
    </body>
    </html>
  `;

  const text = `
Welcome to ${appName}${companyName ? ` - ${companyName}` : ''}

Hello ${name},

Your account has been created as a ${roleDisplay}. Below are your login credentials:

Login ID: ${loginId}
Temporary Password: ${tempPassword}

⚠️ Important: Please change your password after your first login for security purposes.

You can log in using either your Login ID or email address (${to}).

Login URL: ${appUrl}/login

If you have any questions, please contact your administrator.

---
This is an automated email. Please do not reply to this message.
© ${new Date().getFullYear()} ${appName}. All rights reserved.
  `;

  try {
    await transporter.sendMail({
      from: `"${appName}" <${fromEmail}>`,
      to,
      subject: `Welcome to ${appName} - Your Account Credentials`,
      text,
      html,
    });

    logger.info({ to, loginId, role }, 'User credentials email sent successfully');
  } catch (error) {
    logger.error({ error, to, loginId }, 'Failed to send user credentials email');
    // Don't throw - we don't want email failures to break user creation
    // Just log the error
  }
}

/**
 * Send test email
 */
export async function sendTestEmail(to: string): Promise<boolean> {
  if (!transporter) {
    logger.warn('Email transporter not initialized');
    return false;
  }

  try {
    const fromEmail = env.EMAIL_USER || 'noreply@workzen.com';
    await transporter.sendMail({
      from: `"${env.APP_NAME}" <${fromEmail}>`,
      to,
      subject: 'Test Email from WorkZen',
      text: 'This is a test email from WorkZen.',
      html: '<p>This is a test email from WorkZen.</p>',
    });

    logger.info({ to }, 'Test email sent successfully');
    return true;
  } catch (error) {
    logger.error({ error, to }, 'Failed to send test email');
    return false;
  }
}

