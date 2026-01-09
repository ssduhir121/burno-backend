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

console.log({
 
  db: process.env.DATABASE_URL
});

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
   (Production-safe)
========================= */
const pool = mysql.createPool({
  uri: process.env.DATABASE_URL,
  waitForConnections: true,
  connectionLimit: 10,
});


/* =========================
   Test Database Connection
========================= */
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Database connected successfully');
    connection.release();
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  }
}

/* =========================
   Health Check
========================= */
app.get('/', (req, res) => {
  res.json({ 
    message: 'Typeform Backend API',
    endpoints: {
      sendVerification: 'POST /api/send-verification',
      verifyEmail: 'GET /api/verify-email',
      saveApplication: 'POST /api/save-application',
      checkStatus: 'GET /api/check-status/:email'
    }
  });
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

    await emailService.sendVerificationEmail(email, verificationLink);

    console.log(`📧 Verification email sent to ${email}`);

    res.json({
      success: true,
      message: 'Verification email sent',
      applicationId: result.insertId,
      token
    });

  } catch (error) {
    console.error('Error sending verification:', error);
    res.status(500).json({ error: 'Failed to send verification email' });
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

        await emailService.sendVerificationEmail(email, verificationLink);
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
   Start Server
========================= */
const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
  await testConnection();
  console.log(`🚀 Server running on port ${PORT}`);
});
