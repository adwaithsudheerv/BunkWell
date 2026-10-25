const nodemailer = require('nodemailer');

// Setup transporter (uses environment variables or fallback logger)
const createTransporter = () => {
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 587,
      secure: process.env.SMTP_PORT == 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return null;
};

const sendOTPEmail = async (toEmail, otp, purpose = 'reset_password') => {
  const isReset = purpose === 'reset_password';
  const subject = isReset 
    ? `${otp} is your Bunkwell account password reset code`
    : `${otp} is your Bunkwell account activation code`;

  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #000; color: #fff; padding: 32px 24px; border-radius: 12px; border: 1px solid #262626;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="font-size: 28px; font-weight: 800; background: linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin: 0;">Bunkwell</h1>
        <p style="color: #a8a8a8; font-size: 13px; margin-top: 6px;">Smart Attendance Security</p>
      </div>

      <div style="background: #121212; border: 1px solid #262626; border-radius: 10px; padding: 24px; text-align: center;">
        <p style="color: #e0e0e0; font-size: 14px; margin-top: 0;">${isReset ? 'We received a request to reset your password. Use the verification code below to proceed:' : 'Welcome to Bunkwell! Please verify your email with the code below:'}</p>
        
        <div style="letter-spacing: 8px; font-size: 36px; font-weight: 800; color: #fff; margin: 24px 0; padding: 12px; background: rgba(255,255,255,0.05); border-radius: 8px; border: 1px dashed #363636;">
          ${otp}
        </div>

        <p style="color: #737373; font-size: 12px; margin-bottom: 0;">This code is valid for <strong>10 minutes</strong>. If you did not request this code, you can safely ignore this email.</p>
      </div>

      <div style="text-align: center; margin-top: 24px; color: #525252; font-size: 11px;">
        &copy; ${new Date().getFullYear()} Bunkwell Attendance System. Security notice.
      </div>
    </div>
  `;

  const transporter = createTransporter();
  if (transporter) {
    try {
      await transporter.sendMail({
        from: `"Bunkwell Security" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
        to: toEmail,
        subject,
        html: htmlContent,
      });
      console.log(`📧 OTP email dispatched via SMTP to ${toEmail}`);
      return { sent: true };
    } catch (err) {
      console.warn(`⚠️ SMTP dispatch failed (${err.message}). Logging code locally.`);
    }
  }

  // Fallback: Log clearly on console
  console.log(`\n======================================================`);
  console.log(`🔐 BUNKWELL SECURITY OTP FOR [${toEmail}]`);
  console.log(`👉 CODE: ${otp} (Valid for 10 minutes)`);
  console.log(`======================================================\n`);
  return { sent: false, fallback: true, otp };
};

module.exports = { sendOTPEmail };
