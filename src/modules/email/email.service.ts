import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

export interface EmailOptions {
  to: string;
  subject: string;
  html?: string;
  text?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter;

  constructor(private readonly configService: ConfigService) {
    this.createTransporter();
  }

  private createTransporter() {
    const mailConfig = {
      host: this.configService.get<string>('MAIL_HOST'),
      port: this.configService.get<number>('MAIL_PORT'),
      secure: this.configService.get<number>('MAIL_PORT') === 465, // true for 465, false for other ports
      auth: {
        user: this.configService.get<string>('MAIL_USER'),
        pass: this.configService.get<string>('MAIL_PASS'),
      },
    };

    this.transporter = nodemailer.createTransport(mailConfig);

    // Verify connection configuration
    this.transporter.verify((error) => {
      if (error) {
        this.logger.error('Email service configuration error:', error);
      } else {
        this.logger.log('Email service is ready to send messages');
      }
    });
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      const mailOptions = {
        from: this.configService.get<string>('MAIL_FROM'),
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      };

      const result = await this.transporter.sendMail(mailOptions);
      this.logger.log(`Email sent successfully to ${options.to}: ${result.messageId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send email to ${options.to}:`, error);
      return false;
    }
  }

  async sendVerificationEmail(email: string, name: string, token: string): Promise<boolean> {
    const clientUrl = this.configService.get<string>('CLIENT_URL');
    const verificationUrl = `${clientUrl}/auth/verify-email?token=${token}`;

    const html = this.getVerificationEmailTemplate(name, verificationUrl);

    return this.sendEmail({
      to: email,
      subject: 'Verify your Stack App account',
      html,
    });
  }

  async sendPasswordResetEmail(email: string, name: string, token: string): Promise<boolean> {
    const clientUrl = this.configService.get<string>('CLIENT_URL');
    const resetUrl = `${clientUrl}/auth/reset-password?token=${token}`;

    const html = this.getPasswordResetEmailTemplate(name, resetUrl);

    return this.sendEmail({
      to: email,
      subject: 'Reset your Stack App password',
      html,
    });
  }

  async sendWelcomeEmail(email: string, name: string): Promise<boolean> {
    const html = this.getWelcomeEmailTemplate(name);

    return this.sendEmail({
      to: email,
      subject: 'Welcome to Stack App',
      html,
    });
  }

  async sendWorkspaceInviteEmail(
    email: string,
    inviterName: string,
    workspaceName: string,
    roleName: string,
    token: string
  ): Promise<boolean> {
    const clientUrl = this.configService.get<string>('CLIENT_URL');
    const acceptUrl = `${clientUrl}/workspaces/invite/accept?token=${token}`;

    const html = this.getWorkspaceInviteEmailTemplate(inviterName, workspaceName, roleName, acceptUrl);

    return this.sendEmail({
      to: email,
      subject: `Invitation to join workspace ${workspaceName} on Stack App`,
      html,
    });
  }

  private getVerificationEmailTemplate(name: string, verificationUrl: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify your email</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #B8A7FF; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: white; color: #B8A7FF; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; border: 2px solid #B8A7FF; font-weight: bold; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Stack App</h1>
          </div>
          <div class="content">
            <h2>Hello ${name}!</h2>
            <p>Thank you for signing up for Stack App. To complete your registration, please verify your email address.</p>
            <div style="text-align: center;">
              <a href="${verificationUrl}" class="button">Verify email</a>
            </div>
            <p>Or copy and paste the following link into your browser:</p>
            <p style="word-break: break-all; background: #f0f0f0; padding: 10px; border-radius: 5px;">${verificationUrl}</p>
            <p><strong>Note:</strong> This verification link will expire in 24 hours.</p>
            <p>If you did not sign up for this account, you can safely ignore this email.</p>
          </div>
          <div class="footer">
            <p>&copy; 2026 Stack App. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private getPasswordResetEmailTemplate(name: string, resetUrl: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset your password</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #B8A7FF; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #B8A7FF; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Stack App</h1>
          </div>
          <div class="content">
            <h2>Hello ${name}!</h2>
            <p>We received a request to reset the password for your account.</p>
            <div style="text-align: center;">
              <a href="${resetUrl}" class="button">Reset password</a>
            </div>
            <p>Or copy and paste the following link into your browser:</p>
            <p style="word-break: break-all; background: #f0f0f0; padding: 10px; border-radius: 5px;">${resetUrl}</p>
            <p><strong>Note:</strong> This link will expire in 1 hour.</p>
            <p>If you did not request a password reset, you can safely ignore this email.</p>
          </div>
          <div class="footer">
            <p>&copy; 2026 Stack App. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private getWelcomeEmailTemplate(name: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #B8A7FF; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Welcome to Stack App!</h1>
          </div>
          <div class="content">
            <h2>Hello ${name}!</h2>
            <p>Congratulations, your email has been verified and your Stack App account is ready!</p>
            <p>You can now:</p>
            <ul>
              <li>✅ Create and manage your tasks</li>
              <li>📊 Track progress on your work</li>
              <li>🎯 Set goals and deadlines</li>
              <li>📱 Access from any device</li>
            </ul>
            <p>Thank you for choosing Stack App!</p>
          </div>
          <div class="footer">
            <p>&copy; 2026 Stack App. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private getWorkspaceInviteEmailTemplate(
    inviterName: string,
    workspaceName: string,
    roleName: string,
    acceptUrl: string
  ): string {
    const roleDisplayName = roleName === 'owner' ? 'Owner' : roleName === 'admin' ? 'Admin' : 'Member';
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Workspace invitation</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #B8A7FF; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #B8A7FF; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
          .workspace-info { background: white; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #B8A7FF; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Stack App</h1>
          </div>
          <div class="content">
            <h2>Workspace invitation</h2>
            <p><strong>${inviterName}</strong> has invited you to join a workspace on Stack App.</p>
            <div class="workspace-info">
              <p><strong>Workspace:</strong> ${workspaceName}</p>
              <p><strong>Role:</strong> ${roleDisplayName}</p>
            </div>
            <p>Click the button below to accept the invitation and join the workspace:</p>
            <div style="text-align: center;">
              <a href="${acceptUrl}" class="button">Accept invitation</a>
            </div>
            <p>Or copy and paste the following link into your browser:</p>
            <p style="word-break: break-all; background: #f0f0f0; padding: 10px; border-radius: 5px;">${acceptUrl}</p>
            <p><strong>Note:</strong> This link will expire in 7 days.</p>
            <p>If you do not want to join this workspace, you can safely ignore this email.</p>
          </div>
          <div class="footer">
            <p>&copy; 2026 Stack App. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}
