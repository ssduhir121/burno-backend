// require('dotenv').config();
// const express = require('express');
// const cors = require('cors');
// const mysql = require('mysql2/promise');
// const emailService = require('./services/emailService');

// const app = express();

// // Middleware
// app.use(cors({
//   origin: process.env.FRONTEND_URL || 'http://localhost:5173',
//   credentials: true
// }));
// app.use(express.json());

// // Database connection
// const dbConfig = {
//   host: process.env.DB_HOST,
//   user: process.env.DB_USERNAME,
//   password: process.env.DB_PASSWORD,
//   database: process.env.DB_DATABASE,
//   port: process.env.DB_PORT || 3306,
//   waitForConnections: true,
//   connectionLimit: 10,
//   queueLimit: 0
// };

// const pool = mysql.createPool(dbConfig);

// // Test database connection
// async function testConnection() {
//   try {
//     const connection = await pool.getConnection();
//     console.log('✅ Database connected successfully');
//     connection.release();
//   } catch (error) {
//     console.error('❌ Database connection failed:', error.message);
//     process.exit(1);
//   }
// }

// // Simple routes
// app.get('/', (req, res) => {
//   res.json({ 
//     message: 'Typeform Backend API',
//     endpoints: {
//       sendVerification: 'POST /api/send-verification',
//       verifyEmail: 'GET /api/verify-email',
//       saveApplication: 'POST /api/save-application',
//       checkStatus: 'GET /api/check-status/:email'
//     }
//   });
// });

// // 1. Send email verification
// app.post('/api/send-verification', async (req, res) => {
//   try {
//     const { email, formData, responseId, formId } = req.body;
    
//     if (!email || !responseId || !formId) {
//       return res.status(400).json({ error: 'Email, responseId, and formId are required' });
//     }
    
//     // Generate verification token
//     const token = require('crypto').randomBytes(32).toString('hex');
    
//     // Save to database
//     const [result] = await pool.execute(
//       `INSERT INTO applications 
//        (email, form_type, form_id, response_id, form_data, verification_token, verification_sent_at) 
//        VALUES (?, 'email_form', ?, ?, ?, ?, NOW())`,
//       [email, formId, responseId, JSON.stringify(formData || {}), token]
//     );
    
//     // Send verification email
//     const verificationLink = `http://localhost:5000/api/verify-email?token=${token}&email=${encodeURIComponent(email)}`;
//     await emailService.sendVerificationEmail(email, verificationLink);
    
//     console.log(`📧 Verification email sent to: ${email}, Token: ${token}`);
    
//     res.json({ 
//       success: true, 
//       message: 'Verification email sent',
//       applicationId: result.insertId,
//       token // For development/testing
//     });
    
//   } catch (error) {
//     console.error('Error sending verification:', error);
//     res.status(500).json({ error: 'Failed to send verification email' });
//   }
// });

// // 2. Verify email (called when user clicks link in email)
// app.get('/api/verify-email', async (req, res) => {
//   try {
//     const { token, email } = req.query;
    
//     if (!token || !email) {
//       return res.status(400).json({ error: 'Token and email are required' });
//     }
    
//     // Find and verify token
//     const [rows] = await pool.execute(
//       `SELECT * FROM applications 
//        WHERE email = ? AND verification_token = ? 
//        AND form_type = 'email_form' 
//        AND email_verified = FALSE
//        ORDER BY created_at DESC LIMIT 1`,
//       [email, token]
//     );
    
//     if (rows.length === 0) {
//       // Redirect to frontend with error message
//       const redirectUrl = `${process.env.FRONTEND_URL}/?verified=false&error=invalid_token`;
//       return res.redirect(redirectUrl);
//     }
    
//     // Mark as verified
//     await pool.execute(
//       `UPDATE applications 
//        SET email_verified = TRUE, verified_at = NOW() 
//        WHERE id = ?`,
//       [rows[0].id]
//     );
    
//     console.log(`✅ Email verified: ${email}`);
    
//     // Redirect to frontend with success message
//     const redirectUrl = `${process.env.FRONTEND_URL}/?verified=true&email=${encodeURIComponent(email)}`;
//     res.redirect(redirectUrl);
    
//   } catch (error) {
//     console.error('Error verifying email:', error);
//     const redirectUrl = `${process.env.FRONTEND_URL}/?verified=false&error=server_error`;
//     res.redirect(redirectUrl);
//   }
// });

// // 3. Save final application details (Typeform #2)
// app.post('/api/save-application', async (req, res) => {
//   try {
//     const { email, formData, responseId, formId } = req.body;
    
//     if (!email || !responseId || !formId) {
//       return res.status(400).json({ error: 'Email, responseId, and formId are required' });
//     }
    
//     // Check if email is verified
//     const [verifiedRows] = await pool.execute(
//       `SELECT id FROM applications 
//        WHERE email = ? AND form_type = 'email_form' AND email_verified = TRUE
//        ORDER BY created_at DESC LIMIT 1`,
//       [email]
//     );
    
//     if (verifiedRows.length === 0) {
//       return res.status(403).json({ 
//         error: 'Email not verified. Please verify your email first.',
//         needsVerification: true 
//       });
//     }
    
//     // Save details form
//     const [result] = await pool.execute(
//       `INSERT INTO applications 
//        (email, form_type, form_id, response_id, form_data, email_verified) 
//        VALUES (?, 'details_form', ?, ?, ?, TRUE)`,
//       [email, formId, responseId, JSON.stringify(formData || {})]
//     );
    
//     console.log(`📝 Details form saved for: ${email}, Response ID: ${responseId}`);
    
//     // You can add additional processing here (send notifications, etc.)
    
//     res.json({ 
//       success: true, 
//       message: 'Application saved successfully',
//       applicationId: result.insertId
//     });
    
//   } catch (error) {
//     console.error('Error saving application:', error);
//     res.status(500).json({ error: 'Failed to save application' });
//   }
// });

// // 4. Check application status
// app.get('/api/check-status/:email', async (req, res) => {
//   try {
//     const { email } = req.params;
    
//     const [rows] = await pool.execute(
//       `SELECT 
//         email,
//         MAX(CASE WHEN form_type = 'email_form' AND email_verified = TRUE THEN 1 ELSE 0 END) as email_verified,
//         MAX(CASE WHEN form_type = 'details_form' THEN 1 ELSE 0 END) as details_submitted,
//         MAX(created_at) as last_activity
//        FROM applications 
//        WHERE email = ?
//        GROUP BY email`,
//       [email]
//     );
    
//     if (rows.length === 0) {
//       return res.json({ 
//         email,
//         email_verified: false,
//         details_submitted: false,
//         status: 'not_started'
//       });
//     }
    
//     const status = rows[0].details_submitted ? 'completed' : 
//                   rows[0].email_verified ? 'ready_for_details' : 
//                   'pending_verification';
    
//     res.json({
//       ...rows[0],
//       status
//     });
    
//   } catch (error) {
//     console.error('Error checking status:', error);
//     res.status(500).json({ error: 'Failed to check status' });
//   }
// });

// // Update the webhook endpoint in server.js
// app.post('/api/typeform-webhook', async (req, res) => {
//   try {
//     const event = req.body;
//     console.log('📥 Typeform webhook received:', JSON.stringify(event, null, 2));
    
//     // Extract form ID from different possible locations
//     let formId = event.form_id || 
//                  event.form_response?.form_id || 
//                  event.form_response?.definition?.id;
    
//     console.log('📋 Extracted form_id:', formId);
    
//     if (!formId) {
//       console.error('❌ No form_id found in webhook payload');
//       return res.status(400).send('No form_id found');
//     }
    
//     // Extract email from the form response
//     let email = null;
//     let responseId = event.form_response?.token || 
//                     event.form_response?.response_id ||
//                     `webhook_${Date.now()}`;
    
//     console.log('🔑 Response ID:', responseId);
    
//     if (event.form_response && event.form_response.answers) {
//       // Loop through answers to find email
//       for (const answer of event.form_response.answers) {
//         console.log('🔍 Answer:', JSON.stringify(answer, null, 2));
        
//         // Check by field type
//         if (answer.type === 'email' && answer.email) {
//           email = answer.email;
//           break;
//         }
        
//         // Check by field reference
//         if (answer.field && answer.field.ref === 'email') {
//           if (answer.email) {
//             email = answer.email;
//           } else if (answer.text) {
//             email = answer.text;
//           }
//           break;
//         }
        
//         // Check for text field with email value
//         if (answer.type === 'text' && answer.text) {
//           // Simple email validation
//           const emailRegex = /\S+@\S+\.\S+/;
//           if (emailRegex.test(answer.text)) {
//             email = answer.text;
//             break;
//           }
//         }
//       }
//     }
    
//     if (email) {
//       console.log(`📧 Email extracted from webhook: ${email}`);
      
//       // Generate verification token
//       const token = require('crypto').randomBytes(32).toString('hex');
      
//       // Check if this entry already exists
//       const [existing] = await pool.execute(
//         `SELECT id FROM applications WHERE email = ? AND form_id = ? AND response_id = ?`,
//         [email, formId, responseId]
//       );
      
//       if (existing.length === 0) {
//         // Save to database with all required fields
//         await pool.execute(
//           `INSERT INTO applications 
//            (email, form_type, form_id, response_id, form_data, verification_token, verification_sent_at) 
//            VALUES (?, 'email_form', ?, ?, ?, ?, NOW())`,
//           [
//             email, 
//             formId, 
//             responseId, 
//             JSON.stringify(event.form_response || {}), 
//             token
//           ]
//         );
        
//         console.log(`✅ Email saved to database: ${email}`);
        
//         // Send verification email
//         const verificationLink = `http://localhost:5000/api/verify-email?token=${token}&email=${encodeURIComponent(email)}`;
//         try {
//           await emailService.sendVerificationEmail(email, verificationLink);
//           console.log(`📨 Verification email sent to: ${email}`);
//         } catch (emailError) {
//           console.error('Failed to send email:', emailError);
//         }
//       } else {
//         console.log(`⚠️ Entry already exists for email: ${email}`);
//       }
//     } else {
//       console.log('⚠️ No email found in webhook response');
//       console.log('📋 Full answers array:', JSON.stringify(event.form_response?.answers, null, 2));
//     }
    
//     // Always return 200 to Typeform
//     res.status(200).send('OK');
    
//   } catch (error) {
//     console.error('❌ Webhook error:', error.message);
//     console.error('❌ Full error:', error);
//     res.status(500).send('Error');
//   }
// });

// app.get('/api/webhook-status/:email', async (req, res) => {
//   try {
//     const { email } = req.params;
    
//     const [rows] = await pool.execute(
//       `SELECT * FROM applications 
//        WHERE email = ? AND form_type = 'email_form'
//        ORDER BY created_at DESC LIMIT 1`,
//       [email]
//     );
    
//     if (rows.length > 0) {
//       res.json({
//         exists: true,
//         email: rows[0].email,
//         submitted_at: rows[0].created_at,
//         verified: rows[0].email_verified,
//         verification_token: rows[0].verification_token
//       });
//     } else {
//       res.json({ exists: false });
//     }
    
//   } catch (error) {
//     console.error('Error checking webhook status:', error);
//     res.status(500).json({ error: 'Database error' });
//   }
// });


// const PORT = process.env.PORT || 5000;

// // Start server
// app.listen(PORT, async () => {
//   await testConnection();
//   console.log(`🚀 Server running on http://localhost:${PORT}`);
// });



require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const crypto = require('crypto');
const emailService = require('./services/emailService');

const app = express();

/* =========================
   Global Error Handlers
   (Prevent server crashes)
========================= */
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
});

/* =========================
   Test Email Configuration
========================= */
async function testEmailConfig() {
  try {
    console.log('🔍 Testing email configuration...');
    console.log('- Host:', process.env.EMAIL_HOST);
    console.log('- Port:', process.env.EMAIL_PORT);
    console.log('- User:', process.env.EMAIL_USER);
    
    const nodemailer = require('nodemailer');
    const testTransporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT),
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      },
      connectionTimeout: 10000
    });
    
    await testTransporter.verify();
    console.log('✅ Email configuration is valid');
    return true;
  } catch (error) {
    console.error('❌ Email configuration test failed:', error.message);
    console.log('⚠️ Email functionality will be disabled');
    return false;
  }
}

/* =========================
   Middleware
========================= */
app.use(cors({
  origin: [
    process.env.FRONTEND_URL,
    'http://localhost:5173'
  ],
  credentials: true
}));

app.use(express.json());

/* =========================
   Database Connection
========================= */
const pool = mysql.createPool({
  uri: process.env.DATABASE_URL,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

/* =========================
   Test Database Connection
========================= */
async function testDBConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Database connected successfully');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}

/* =========================
   Health Check
========================= */
app.get('/', (req, res) => {
  res.json({ 
    message: 'Typeform Backend API',
    status: 'running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

/* =========================
   System Status
========================= */
app.get('/api/status', async (req, res) => {
  try {
    const dbStatus = await testDBConnection();
    const emailStatus = await testEmailConfig();
    
    res.json({
      status: 'online',
      database: dbStatus ? 'connected' : 'disconnected',
      email: emailStatus ? 'configured' : 'misconfigured',
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* =========================
   Email Debug Endpoint
========================= */
app.get('/api/debug-email', async (req, res) => {
  try {
    const nodemailer = require('nodemailer');
    
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT),
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      },
      debug: true,
      logger: true
    });
    
    // Try to verify connection
    await transporter.verify();
    
    // Try to send test email
    const testEmail = process.env.EMAIL_USER;
    const info = await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: testEmail,
      subject: 'Debug Test Email',
      text: 'This is a debug test email from your server.'
    });
    
    res.json({
      success: true,
      message: 'Email test completed',
      messageId: info.messageId,
      config: {
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        user: process.env.EMAIL_USER,
        passwordLength: process.env.EMAIL_PASSWORD?.length || 0
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      code: error.code,
      command: error.command,
      config: {
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        user: process.env.EMAIL_USER,
        passwordLength: process.env.EMAIL_PASSWORD?.length || 0
      }
    });
  }
});

/* =========================
   1. Send Email Verification
========================= */
app.post('/api/send-verification', async (req, res) => {
  try {
    const { email, formData, responseId, formId } = req.body;

    if (!email || !responseId || !formId) {
      return res.status(400).json({
        error: 'Email, responseId, and formId are required'
      });
    }

    const token = crypto.randomBytes(32).toString('hex');

    const [result] = await pool.execute(
      `INSERT INTO applications 
       (email, form_type, form_id, response_id, form_data, verification_token, verification_sent_at) 
       VALUES (?, 'email_form', ?, ?, ?, ?, NOW())`,
      [email, formId, responseId, JSON.stringify(formData || {}), token]
    );

    const verificationLink =
      `${process.env.BACKEND_URL}/api/verify-email?token=${token}&email=${encodeURIComponent(email)}`;

    let emailSent = false;
    let emailError = null;
    
    try {
      await emailService.sendVerificationEmail(email, verificationLink);
      emailSent = true;
      console.log(`📧 Verification email sent to ${email}`);
    } catch (error) {
      emailError = error.message;
      console.warn(`⚠️ Email sending failed for ${email}:`, error.message);
      // Continue without crashing
    }

    res.json({
      success: true,
      message: 'Application saved successfully',
      applicationId: result.insertId,
      token,
      emailSent,
      emailError: emailError,
      verificationLink: verificationLink // For debugging
    });

  } catch (error) {
    console.error('Error in send-verification:', error);
    res.status(500).json({ 
      error: 'Failed to save application',
      details: error.message 
    });
  }
});

/* =========================
   2. Verify Email
========================= */
app.get('/api/verify-email', async (req, res) => {
  try {
    const { token, email } = req.query;

    if (!token || !email) {
      return res.status(400).json({
        error: 'Token and email are required'
      });
    }

    const [rows] = await pool.execute(
      `SELECT * FROM applications 
       WHERE email = ? AND verification_token = ? 
       AND form_type = 'email_form'
       AND email_verified = FALSE
       ORDER BY created_at DESC
       LIMIT 1`,
      [email, token]
    );

    if (rows.length === 0) {
      return res.redirect(
        `${process.env.FRONTEND_URL}/?verified=false&error=invalid_token`
      );
    }

    await pool.execute(
      `UPDATE applications 
       SET email_verified = TRUE, verified_at = NOW()
       WHERE id = ?`,
      [rows[0].id]
    );

    console.log(`✅ Email verified: ${email}`);

    res.redirect(
      `${process.env.FRONTEND_URL}/?verified=true&email=${encodeURIComponent(email)}`
    );

  } catch (error) {
    console.error('Error verifying email:', error);
    res.redirect(
      `${process.env.FRONTEND_URL}/?verified=false&error=server_error`
    );
  }
});

/* =========================
   3. Save Application (Form 2)
========================= */
app.post('/api/save-application', async (req, res) => {
  try {
    const { email, formData, responseId, formId } = req.body;

    if (!email || !responseId || !formId) {
      return res.status(400).json({
        error: 'Email, responseId, and formId are required'
      });
    }

    const [verifiedRows] = await pool.execute(
      `SELECT id FROM applications 
       WHERE email = ?
       AND form_type = 'email_form'
       AND email_verified = TRUE
       ORDER BY created_at DESC
       LIMIT 1`,
      [email]
    );

    if (verifiedRows.length === 0) {
      return res.status(403).json({
        error: 'Email not verified',
        needsVerification: true
      });
    }

    const [result] = await pool.execute(
      `INSERT INTO applications
       (email, form_type, form_id, response_id, form_data, email_verified)
       VALUES (?, 'details_form', ?, ?, ?, TRUE)`,
      [email, formId, responseId, JSON.stringify(formData || {})]
    );

    console.log(`📝 Application saved for ${email}`);

    res.json({
      success: true,
      message: 'Application saved successfully',
      applicationId: result.insertId
    });

  } catch (error) {
    console.error('Error saving application:', error);
    res.status(500).json({ error: 'Failed to save application' });
  }
});

/* =========================
   4. Check Status
========================= */
app.get('/api/check-status/:email', async (req, res) => {
  try {
    const { email } = req.params;

    const [rows] = await pool.execute(
      `SELECT
        email,
        MAX(CASE WHEN form_type = 'email_form' AND email_verified = TRUE THEN 1 ELSE 0 END) AS email_verified,
        MAX(CASE WHEN form_type = 'details_form' THEN 1 ELSE 0 END) AS details_submitted,
        MAX(created_at) AS last_activity
       FROM applications
       WHERE email = ?
       GROUP BY email`,
      [email]
    );

    if (rows.length === 0) {
      return res.json({
        email,
        email_verified: false,
        details_submitted: false,
        status: 'not_started'
      });
    }

    const status =
      rows[0].details_submitted ? 'completed' :
      rows[0].email_verified ? 'ready_for_details' :
      'pending_verification';

    res.json({ ...rows[0], status });

  } catch (error) {
    console.error('Error checking status:', error);
    res.status(500).json({ error: 'Failed to check status' });
  }
});

/* =========================
   Typeform Webhook
========================= */
app.post('/api/typeform-webhook', async (req, res) => {
  try {
    const event = req.body;

    let formId =
      event.form_id ||
      event.form_response?.form_id ||
      event.form_response?.definition?.id;

    if (!formId) return res.status(400).send('No form_id found');

    let email = null;
    let responseId =
      event.form_response?.token ||
      event.form_response?.response_id ||
      `webhook_${Date.now()}`;

    if (event.form_response?.answers) {
      for (const answer of event.form_response.answers) {
        if (answer.type === 'email' && answer.email) {
          email = answer.email;
          break;
        }
        if (answer.field?.ref === 'email') {
          email = answer.email || answer.text;
          break;
        }
      }
    }

    if (email) {
      const token = crypto.randomBytes(32).toString('hex');

      const [existing] = await pool.execute(
        `SELECT id FROM applications WHERE email = ? AND form_id = ? AND response_id = ?`,
        [email, formId, responseId]
      );

      if (existing.length === 0) {
        await pool.execute(
          `INSERT INTO applications
           (email, form_type, form_id, response_id, form_data, verification_token, verification_sent_at)
           VALUES (?, 'email_form', ?, ?, ?, ?, NOW())`,
          [email, formId, responseId, JSON.stringify(event.form_response || {}), token]
        );

        const verificationLink =
          `${process.env.BACKEND_URL}/api/verify-email?token=${token}&email=${encodeURIComponent(email)}`;

        try {
          await emailService.sendVerificationEmail(email, verificationLink);
          console.log(`📧 Webhook: Verification email sent to ${email}`);
        } catch (emailError) {
          console.warn(`⚠️ Webhook: Email sending failed for ${email}`);
        }
      }
    }

    res.status(200).send('OK');

  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).send('Error');
  }
});

/* =========================
   Webhook Status
========================= */
app.get('/api/webhook-status/:email', async (req, res) => {
  try {
    const { email } = req.params;

    const [rows] = await pool.execute(
      `SELECT * FROM applications
       WHERE email = ?
       AND form_type = 'email_form'
       ORDER BY created_at DESC
       LIMIT 1`,
      [email]
    );

    res.json(rows.length ? {
      exists: true,
      email: rows[0].email,
      submitted_at: rows[0].created_at,
      verified: rows[0].email_verified,
      verification_token: rows[0].verification_token
    } : { exists: false });

  } catch (error) {
    console.error('Webhook status error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

/* =========================
   Test Database Schema
========================= */
app.get('/api/test-db', async (req, res) => {
  try {
    const [tables] = await pool.execute('SHOW TABLES');
    const [applications] = await pool.execute('DESCRIBE applications');
    
    res.json({
      success: true,
      tables: tables.map(t => Object.values(t)[0]),
      applications_schema: applications
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      sqlMessage: error.sqlMessage
    });
  }
});

/* =========================
   Application List (Admin)
========================= */
app.get('/api/applications', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT id, email, form_type, email_verified, 
              created_at, verified_at, response_id
       FROM applications
       ORDER BY created_at DESC
       LIMIT 100`
    );
    
    res.json({
      success: true,
      count: rows.length,
      applications: rows
    });
  } catch (error) {
    console.error('Error fetching applications:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

/* =========================
   Graceful Shutdown Handler
========================= */
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received. Closing server gracefully...');
  pool.end();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received. Closing server gracefully...');
  pool.end();
  process.exit(0);
});

/* =========================
   Start Server
========================= */
const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
  console.log(`🚀 Server starting on port ${PORT}...`);
  console.log(`📁 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 Backend URL: ${process.env.BACKEND_URL || 'Not set'}`);
  console.log(`🔗 Frontend URL: ${process.env.FRONTEND_URL || 'Not set'}`);
  
  // Test connections
  await testDBConnection();
  await testEmailConfig();
  
  console.log(`✅ Server is running on port ${PORT}`);
  console.log(`📋 Available endpoints:`);
  console.log(`   GET  /                 - Health check`);
  console.log(`   GET  /api/status       - System status`);
  console.log(`   GET  /api/debug-email  - Debug email config`);
  console.log(`   POST /api/send-verification - Send verification email`);
  console.log(`   GET  /api/verify-email - Verify email`);
  console.log(`   POST /api/save-application - Save application`);
  console.log(`   GET  /api/check-status/:email - Check status`);
  console.log(`   POST /api/typeform-webhook - Typeform webhook`);
});