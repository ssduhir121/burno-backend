const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

transporter.verify((error, success) => {
  if (error) {
    console.error('❌ Email configuration error:', error);
  } else {
    console.log('✅ Email server is ready to send messages');
  }
});

async function sendVerificationEmail(toEmail, verificationLink) {
  try {
    const mailOptions = {
      from: `"Application System" <${process.env.EMAIL_FROM}>`,
      to: toEmail,
      subject: 'Verify Your Email - Complete Your Application',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Almost There! Verify Your Email</h2>
          <p>Thank you for starting your application. To continue, please verify your email address by clicking the button below:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationLink}" 
               style="background-color: #EC4899; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 5px; font-weight: bold;">
              Verify Email Address
            </a>
          </div>
          
          <p>Or copy and paste this link in your browser:</p>
          <p style="background-color: #f4f4f4; padding: 10px; border-radius: 3px; word-break: break-all;">
            ${verificationLink}
          </p>
          
          <p>This link will expire in 24 hours.</p>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">
            If you didn't request this, please ignore this email.
          </p>
        </div>
      `,
      text: `Verify your email to complete your application: ${verificationLink}`
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`📧 Email sent to ${toEmail}: ${info.messageId}`);
    return true;
    
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}

module.exports = { sendVerificationEmail };