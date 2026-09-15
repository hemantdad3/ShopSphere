const nodemailer = require('nodemailer');

/**
 * Send email using Nodemailer with dev-logging fallback
 */
const sendEmail = async (options) => {
  // Check if real SMTP credentials are provided
  const hasRealCredentials =
    process.env.EMAIL_HOST &&
    process.env.EMAIL_USER &&
    process.env.EMAIL_USER !== 'your_smtp_user' &&
    process.env.EMAIL_PASS &&
    process.env.EMAIL_PASS !== 'your_smtp_password';

  if (!hasRealCredentials || process.env.NODE_ENV === 'development') {
    // Development fallback: Log email content to console for instant developer feedback
    console.log('\n================== [DEVELOPMENT EMAIL DISPATCH] ==================');
    console.log(`To:      ${options.email}`);
    console.log(`Subject: ${options.subject}`);
    console.log(`Message: \n${options.message}`);
    console.log('==================================================================\n');
    return;
  }

  // Production SMTP Transporter
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT || 587,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: process.env.EMAIL_FROM || 'ShopSphere <noreply@shopsphere.com>',
    to: options.email,
    subject: options.subject,
    text: options.message,
    html: options.html,
  };

  await transporter.sendMail(mailOptions);
};

/**
 * Send password reset email
 */
const sendPasswordResetEmail = async (email, resetUrl) => {
  const message = `You requested a password reset for your ShopSphere account.\n\nPlease reset your password within 15 minutes by clicking the link below:\n\n${resetUrl}\n\nIf you did not request this, please ignore this email.`;

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #E5E7EB; border-radius: 8px;">
      <h2 style="color: #1F3A5F; margin-bottom: 16px;">ShopSphere Password Reset</h2>
      <p style="color: #17202A; font-size: 15px; line-height: 1.5;">You requested a password reset for your ShopSphere account.</p>
      <p style="color: #17202A; font-size: 15px; line-height: 1.5;">Click the button below to reset your password. This link is valid for <strong>15 minutes</strong>.</p>
      <div style="margin: 24px 0;">
        <a href="${resetUrl}" style="background-color: #1F3A5F; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">Reset Password</a>
      </div>
      <p style="color: #667085; font-size: 13px;">Or copy and paste this URL into your browser: <br/><a href="${resetUrl}" style="color: #1F3A5F;">${resetUrl}</a></p>
      <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 20px 0;" />
      <p style="color: #667085; font-size: 12px;">If you did not request this password reset, no further action is required. Your password remains secure.</p>
    </div>
  `;

  await sendEmail({
    email,
    subject: 'ShopSphere Password Reset Request (Valid for 15 mins)',
    message,
    html,
  });
};

module.exports = {
  sendEmail,
  sendPasswordResetEmail,
};
