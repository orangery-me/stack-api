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
    const verificationUrl = `${this.configService.get<string>('APP_URL')}/auth/verify-email?token=${token}`;

    const html = this.getVerificationEmailTemplate(name, verificationUrl);

    return this.sendEmail({
      to: email,
      subject: 'Xác thực tài khoản Stack App',
      html,
    });
  }

  async sendPasswordResetEmail(email: string, name: string, token: string): Promise<boolean> {
    const resetUrl = `${this.configService.get<string>('APP_URL')}/auth/reset-password?token=${token}`;

    const html = this.getPasswordResetEmailTemplate(name, resetUrl);

    return this.sendEmail({
      to: email,
      subject: 'Đặt lại mật khẩu Stack App',
      html,
    });
  }

  async sendWelcomeEmail(email: string, name: string): Promise<boolean> {
    const html = this.getWelcomeEmailTemplate(name);

    return this.sendEmail({
      to: email,
      subject: 'Chào mừng bạn đến với Stack App',
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
        <title>Xác thực email</title>
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
            <h2>Xin chào ${name}!</h2>
            <p>Cảm ơn bạn đã đăng ký tài khoản Stack App. Để hoàn tất quá trình đăng ký, vui lòng xác thực địa chỉ email của bạn.</p>
            <div style="text-align: center;">
              <a href="${verificationUrl}" class="button">Xác thực email</a>
            </div>
            <p>Hoặc copy và paste đường link sau vào trình duyệt:</p>
            <p style="word-break: break-all; background: #f0f0f0; padding: 10px; border-radius: 5px;">${verificationUrl}</p>
            <p><strong>Lưu ý:</strong> Link xác thực này sẽ hết hạn sau 24 giờ.</p>
            <p>Nếu bạn không đăng ký tài khoản này, vui lòng bỏ qua email này.</p>
          </div>
          <div class="footer">
            <p>&copy; 2024 Stack App. All rights reserved.</p>
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
        <title>Đặt lại mật khẩu</title>
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
            <h2>Xin chào ${name}!</h2>
            <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.</p>
            <div style="text-align: center;">
              <a href="${resetUrl}" class="button">Đặt lại mật khẩu</a>
            </div>
            <p>Hoặc copy và paste đường link sau vào trình duyệt:</p>
            <p style="word-break: break-all; background: #f0f0f0; padding: 10px; border-radius: 5px;">${resetUrl}</p>
            <p><strong>Lưu ý:</strong> Link này sẽ hết hạn sau 1 giờ.</p>
            <p>Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.</p>
          </div>
          <div class="footer">
            <p>&copy; 2024 Stack App. All rights reserved.</p>
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
        <title>Chào mừng bạn</title>
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
            <h1>🎉 Chào mừng đến với Stack App!</h1>
          </div>
          <div class="content">
            <h2>Xin chào ${name}!</h2>
            <p>Chúc mừng bạn đã xác thực email thành công và trở thành thành viên của Stack App!</p>
            <p>Bây giờ bạn có thể:</p>
            <ul>
              <li>✅ Tạo và quản lý các task của mình</li>
              <li>📊 Theo dõi tiến độ công việc</li>
              <li>🎯 Đặt mục tiêu và deadline</li>
              <li>📱 Truy cập từ mọi thiết bị</li>
            </ul>
            <p>Cảm ơn bạn đã tin tưởng và sử dụng Stack App!</p>
          </div>
          <div class="footer">
            <p>&copy; 2024 Stack App. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}
