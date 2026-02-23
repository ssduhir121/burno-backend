
// // server.js
// require('dotenv').config();
// const express = require('express');
// const cors = require('cors');
// const mysql = require('mysql2/promise');
// const crypto = require('crypto');
// const nodemailer = require('nodemailer');
// const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// const app = express();

// /* =========================
//    Global Error Handlers
// ========================= */
// process.on('unhandledRejection', (reason, promise) => {
//   console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
// });

// process.on('uncaughtException', (error) => {
//   console.error('❌ Uncaught Exception:', error);
// });

// /* =========================
//    Environment Variables Validation
// ========================= */
// const requiredEnvVars = [
//   'DB_HOST',
//   'DB_USERNAME',
//   'DB_PASSWORD',
//   'DB_DATABASE',
//   'FRONTEND_URL',
//   'STRIPE_SECRET_KEY',
//   'STRIPE_CONSULTANT_PRICE_ID',
//   'EMAIL_USER',
//   'EMAIL_PASSWORD'
// ];

// const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

// if (missingEnvVars.length > 0) {
//   console.error('❌ Missing required environment variables:');
//   missingEnvVars.forEach(envVar => console.error(`   - ${envVar}`));
//   console.error('Please check your .env file');
  
//   if (process.env.NODE_ENV === 'production') {
//     process.exit(1);
//   } else {
//     console.warn('⚠️ Continuing in development mode with missing env vars');
//   }
// }

// /* =========================
//    Middleware
// ========================= */
// app.use(cors({
//   origin: [
//     process.env.FRONTEND_URL,
//     'http://localhost:5173',
//     'http://localhost:3000',
//     'http://localhost:5000',
//     'http://192.168.1.88:5173'
//   ],
//   credentials: true
// }));

// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));

// /* =========================
//    Database Connection with Database Creation
// ========================= */
// async function createDatabaseIfNotExists() {
//   let connection;
//   try {
//     // Connect without database selected
//     connection = await mysql.createConnection({
//       host: process.env.DB_HOST || 'localhost',
//       port: process.env.DB_PORT || 3306,
//       user: process.env.DB_USERNAME || 'root',
//       password: process.env.DB_PASSWORD || '',
//     });

//     console.log('✅ Connected to MySQL server');

//     // Create database if it doesn't exist
//     await connection.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_DATABASE || 'bruno'}\``);
//     console.log(`✅ Database '${process.env.DB_DATABASE || 'bruno'}' created or already exists`);

//   } catch (error) {
//     console.error('❌ Error creating database:', error.message);
//     throw error;
//   } finally {
//     if (connection) {
//       await connection.end();
//     }
//   }
// }

// // Main connection pool (now with database selected)
// const pool = mysql.createPool({
//   host: process.env.DB_HOST || 'localhost',
//   port: process.env.DB_PORT || 3306,
//   user: process.env.DB_USERNAME || 'root',
//   password: process.env.DB_PASSWORD || '',
//   database: process.env.DB_DATABASE || 'bruno',
//   waitForConnections: true,
//   connectionLimit: 10,
//   queueLimit: 0
// });

// /* =========================
//    Email Service with Nodemailer
// ========================= */
// const transporter = nodemailer.createTransport({
//   host: process.env.EMAIL_HOST || 'smtp.gmail.com',
//   port: process.env.EMAIL_PORT || 587,
//   secure: false,
//   auth: {
//     user: process.env.EMAIL_USER || 'nullvoid149@gmail.com',
//     pass: process.env.EMAIL_PASSWORD || 'ycop pcza nmru ywpa',
//   },
//   tls: {
//     rejectUnauthorized: false
//   }
// });

// // Verify email connection
// transporter.verify((error, success) => {
//   if (error) {
//     console.error('❌ Email service connection failed:', error);
//   } else {
//     console.log('✅ Email service is ready to send messages');
//   }
// });

// const emailService = {
//   sendMagicLinkEmail: async (email, magicLink, userType) => {
//     try {
//       const roleText = userType === 'consultant' ? 'Consultant' : 'Client';
      
//       const mailOptions = {
//         from: `"Web Consultant Hub" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
//         to: email,
//         subject: `Your Magic Link for Web Consultant Hub`,
//         html: `
//           <!DOCTYPE html>
//           <html>
//           <head>
//             <meta charset="utf-8">
//             <meta name="viewport" content="width=device-width, initial-scale=1.0">
//             <title>Magic Link Login</title>
//           </head>
//           <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
//             <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
//               <h1 style="color: white; margin: 0; font-size: 28px;">Web Consultant Hub</h1>
//               <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0;">${roleText} Login</p>
//             </div>
            
//             <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #ddd; border-top: none;">
//               <h2 style="color: #444; margin-top: 0;">Your Magic Login Link</h2>
              
//               <p>Hello,</p>
              
//               <p>You requested a magic link to sign in to your Web Consultant Hub ${roleText} account.</p>
              
//               <div style="text-align: center; margin: 30px 0;">
//                 <a href="${magicLink}" style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Sign In to Your Account</a>
//               </div>
              
//               <p style="color: #666; font-size: 14px;">This link will expire in 15 minutes and can only be used once.</p>
              
//               <p style="color: #666; font-size: 14px;">If you didn't request this, you can safely ignore this email.</p>
              
//               <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
              
//               <p style="color: #999; font-size: 12px; text-align: center;">
//                 &copy; ${new Date().getFullYear()} Web Consultant Hub. All rights reserved.<br>
//                 This is an automated message, please do not reply.
//               </p>
//             </div>
//           </body>
//           </html>
//         `,
//         text: `
//           Your Magic Link for Web Consultant Hub (${roleText})
          
//           Click the link below to sign in:
//           ${magicLink}
          
//           This link will expire in 15 minutes.
          
//           If you didn't request this, please ignore this email.
//         `
//       };

//       const info = await transporter.sendMail(mailOptions);
//       console.log(`📧 Email sent to ${email}:`, info.messageId);
//       return { success: true, messageId: info.messageId };
      
//     } catch (error) {
//       console.error('❌ Failed to send email:', error);
//       throw error;
//     }
//   }
// };

// /* =========================
//    Test Database Connection
// ========================= */
// async function testDatabaseConnection() {
//   try {
//     const connection = await pool.getConnection();
//     console.log('✅ Database connected successfully');
//     console.log(`   Host: ${process.env.DB_HOST || 'localhost'}`);
//     console.log(`   Database: ${process.env.DB_DATABASE || 'bruno'}`);
//     connection.release();
//     return true;
//   } catch (error) {
//     console.error('❌ Database connection failed:', error.message);
//     console.error('   Please check your database configuration:');
//     console.error(`   Host: ${process.env.DB_HOST || 'localhost'}`);
//     console.error(`   Database: ${process.env.DB_DATABASE || 'bruno'}`);
//     console.error(`   User: ${process.env.DB_USERNAME || 'root'}`);
//     return false;
//   }
// }

// /* =========================
//    Health Check
// ========================= */
// app.get('/', (req, res) => {
//   res.json({ 
//     message: 'Web Consultant Hub API',
//     status: 'running',
//     timestamp: new Date().toISOString(),
//     version: '1.1.0',
//     features: ['consultant-auth', 'client-auth', 'magic-links', 'stripe', 'email']
//   });
// });

// /* =========================
//    Initialize Database Tables
// ========================= */
// async function initializeDatabase() {
//   try {
//     console.log('🔄 Initializing database tables...');

//     // Users table
//     await pool.execute(`
//       CREATE TABLE IF NOT EXISTS users (
//         id INT PRIMARY KEY AUTO_INCREMENT,
//         email VARCHAR(255) UNIQUE NOT NULL,
//         role ENUM('consultant', 'client', 'admin') NOT NULL,
//         is_verified BOOLEAN DEFAULT FALSE,
//         verification_token VARCHAR(255),
//         verification_token_expires_at DATETIME,
//         magic_link_token VARCHAR(255),
//         magic_link_expires_at DATETIME,
//         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//         updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
//         INDEX idx_email (email),
//         INDEX idx_verified (is_verified),
//         INDEX idx_magic_token (magic_link_token)
//       )
//     `);
//     console.log('✅ Users table created/verified');

//     // Consultant Profiles
//     await pool.execute(`
//       CREATE TABLE IF NOT EXISTS consultant_profiles (
//         id INT PRIMARY KEY AUTO_INCREMENT,
//         user_id INT NOT NULL,
//         full_name VARCHAR(255),
//         phone VARCHAR(50),
//         base_country VARCHAR(100),
//         base_city VARCHAR(100),
//         work_mode_preference ENUM('remote', 'on-site', 'hybrid') DEFAULT 'remote',
//         travel_willingness BOOLEAN DEFAULT FALSE,
//         travel_radius_km INT,
//         years_experience VARCHAR(50),
//         cv_url TEXT,
//         linkedin_url VARCHAR(255),
//         github_url VARCHAR(255),
//         subscription_status ENUM('active', 'inactive', 'canceled', 'past_due') DEFAULT 'inactive',
//         stripe_customer_id VARCHAR(255),
//         stripe_subscription_id VARCHAR(255),
//         subscription_end_date DATE,
//         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//         updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
//         FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
//         INDEX idx_user_id (user_id),
//         INDEX idx_subscription_status (subscription_status)
//       )
//     `);
//     console.log('✅ Consultant profiles table created/verified');

//     // Consultant Positions (Many-to-Many)
//     await pool.execute(`
//       CREATE TABLE IF NOT EXISTS consultant_positions (
//         consultant_profile_id INT NOT NULL,
//         position_id INT NOT NULL,
//         PRIMARY KEY (consultant_profile_id, position_id),
//         FOREIGN KEY (consultant_profile_id) REFERENCES consultant_profiles(id) ON DELETE CASCADE
//       )
//     `);
//     console.log('✅ Consultant positions table created/verified');

//     // Positions Taxonomy (Admin managed)
//     await pool.execute(`
//       CREATE TABLE IF NOT EXISTS positions (
//         id INT PRIMARY KEY AUTO_INCREMENT,
//         name VARCHAR(255) NOT NULL,
//         category VARCHAR(100),
//         is_active BOOLEAN DEFAULT TRUE,
//         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
//       )
//     `);
//     console.log('✅ Positions table created/verified');

//     // Consultant Certificates
//     await pool.execute(`
//       CREATE TABLE IF NOT EXISTS consultant_certificates (
//         id INT PRIMARY KEY AUTO_INCREMENT,
//         consultant_profile_id INT NOT NULL,
//         name VARCHAR(255) NOT NULL,
//         organization VARCHAR(255),
//         issue_date DATE,
//         expiry_date DATE,
//         certificate_url TEXT,
//         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//         FOREIGN KEY (consultant_profile_id) REFERENCES consultant_profiles(id) ON DELETE CASCADE
//       )
//     `);
//     console.log('✅ Consultant certificates table created/verified');

//     // Consultant Availability
//     await pool.execute(`
//       CREATE TABLE IF NOT EXISTS consultant_availability (
//         id INT PRIMARY KEY AUTO_INCREMENT,
//         consultant_profile_id INT NOT NULL,
//         start_date DATE NOT NULL,
//         end_date DATE NOT NULL,
//         start_time TIME,
//         end_time TIME,
//         timezone VARCHAR(50),
//         is_recurring BOOLEAN DEFAULT FALSE,
//         recurrence_pattern VARCHAR(50),
//         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//         FOREIGN KEY (consultant_profile_id) REFERENCES consultant_profiles(id) ON DELETE CASCADE,
//         INDEX idx_dates (start_date, end_date)
//       )
//     `);
//     console.log('✅ Consultant availability table created/verified');

//     // Client Profiles
//     await pool.execute(`
//       CREATE TABLE IF NOT EXISTS client_profiles (
//         id INT PRIMARY KEY AUTO_INCREMENT,
//         user_id INT NOT NULL,
//         company_name VARCHAR(255) NOT NULL,
//         contact_name VARCHAR(255),
//         contact_title VARCHAR(255),
//         phone VARCHAR(50),
//         website VARCHAR(255),
//         company_size VARCHAR(50),
//         industry VARCHAR(100),
//         location VARCHAR(255),
//         company_description TEXT,
//         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//         updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
//         FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
//         INDEX idx_company (company_name)
//       )
//     `);
//     console.log('✅ Client profiles table created/verified');

//     // Client Requests
//     await pool.execute(`
//       CREATE TABLE IF NOT EXISTS client_requests (
//         id INT PRIMARY KEY AUTO_INCREMENT,
//         client_profile_id INT NOT NULL,
//         position_id INT,
//         title VARCHAR(255) NOT NULL,
//         description TEXT,
//         start_date DATE,
//         end_date DATE,
//         budget_type ENUM('daily', 'hourly', 'fixed') DEFAULT 'daily',
//         budget_amount DECIMAL(10, 2),
//         currency VARCHAR(3) DEFAULT 'EUR',
//         work_country VARCHAR(100),
//         work_city VARCHAR(100),
//         work_mode ENUM('remote', 'on-site', 'hybrid') DEFAULT 'remote',
//         status ENUM('submitted', 'under_review', 'contacting', 'shortlist_ready', 'closed') DEFAULT 'submitted',
//         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//         updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
//         FOREIGN KEY (client_profile_id) REFERENCES client_profiles(id) ON DELETE CASCADE,
//         FOREIGN KEY (position_id) REFERENCES positions(id),
//         INDEX idx_status (status),
//         INDEX idx_dates (start_date, end_date)
//       )
//     `);
//     console.log('✅ Client requests table created/verified');

//     // Match Suggestions
//     await pool.execute(`
//       CREATE TABLE IF NOT EXISTS match_suggestions (
//         id INT PRIMARY KEY AUTO_INCREMENT,
//         request_id INT NOT NULL,
//         consultant_profile_id INT NOT NULL,
//         match_score DECIMAL(5, 2),
//         match_reasons TEXT,
//         admin_review_status ENUM('suggested', 'contacted', 'interested', 'unavailable', 'shortlisted', 'rejected') DEFAULT 'suggested',
//         admin_notes TEXT,
//         reviewed_by_admin_id INT,
//         reviewed_at DATETIME,
//         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//         FOREIGN KEY (request_id) REFERENCES client_requests(id) ON DELETE CASCADE,
//         FOREIGN KEY (consultant_profile_id) REFERENCES consultant_profiles(id) ON DELETE CASCADE,
//         INDEX idx_request (request_id),
//         INDEX idx_status (admin_review_status)
//       )
//     `);
//     console.log('✅ Match suggestions table created/verified');

//     // Email Communications Log
//     await pool.execute(`
//       CREATE TABLE IF NOT EXISTS email_logs (
//         id INT PRIMARY KEY AUTO_INCREMENT,
//         recipient_email VARCHAR(255) NOT NULL,
//         email_type VARCHAR(100),
//         template_id VARCHAR(100),
//         request_id INT,
//         consultant_profile_id INT,
//         sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
//         status ENUM('sent', 'failed', 'delivered', 'opened') DEFAULT 'sent',
//         error_message TEXT,
//         initiated_by_admin_id INT,
//         FOREIGN KEY (request_id) REFERENCES client_requests(id),
//         FOREIGN KEY (consultant_profile_id) REFERENCES consultant_profiles(id),
//         INDEX idx_recipient (recipient_email),
//         INDEX idx_sent_at (sent_at)
//       )
//     `);
//     console.log('✅ Email logs table created/verified');

//     // Insert default positions if none exist
//     const [existingPositions] = await pool.execute('SELECT COUNT(*) as count FROM positions');
//     if (existingPositions[0].count === 0) {
//       const defaultPositions = [
//         'Web Developer', 'Frontend Developer', 'Backend Developer',
//         'Full Stack Developer', 'DevOps Engineer', 'UX/UI Designer',
//         'Product Manager', 'Project Manager', 'Scrum Master',
//         'Data Analyst', 'Data Scientist', 'Machine Learning Engineer',
//         'Cloud Architect', 'Security Engineer', 'Mobile Developer',
//         'QA Engineer', 'Technical Lead', 'IT Consultant',
//         'Business Analyst', 'Change Manager', 'Digital Transformation Consultant',
//         'AI Strategy Consultant', 'ERP Consultant', 'CRM Consultant'
//       ];
      
//       for (const position of defaultPositions) {
//         await pool.execute('INSERT INTO positions (name, category) VALUES (?, ?)', 
//           [position, getPositionCategory(position)]);
//       }
//       console.log(`✅ Added ${defaultPositions.length} default positions`);
//     }
    
//     // Create default admin user if none exists
//     const [adminCount] = await pool.execute("SELECT COUNT(*) as count FROM users WHERE role = 'admin'");
//     if (adminCount[0].count === 0) {
//       const adminEmail = 'admin@webconsultanthub.com';
//       const [existingAdmin] = await pool.execute('SELECT id FROM users WHERE email = ?', [adminEmail]);
      
//       if (existingAdmin.length === 0) {
//         await pool.execute(
//           'INSERT INTO users (email, role, is_verified) VALUES (?, ?, ?)',
//           [adminEmail, 'admin', true]
//         );
//         console.log('✅ Default admin user created: admin@webconsultanthub.com');
//       }
//     }
    
//     console.log('✅ All database tables initialized successfully');
    
//   } catch (error) {
//     console.error('❌ Database initialization failed:', error.message);
//     throw error;
//   }
// }

// function getPositionCategory(position) {
//   if (position.includes('Developer') || position.includes('Engineer')) return 'Development';
//   if (position.includes('Designer')) return 'Design';
//   if (position.includes('Manager')) return 'Management';
//   if (position.includes('Analyst') || position.includes('Scientist')) return 'Data';
//   if (position.includes('Consultant')) return 'Consulting';
//   if (position.includes('Architect')) return 'Architecture';
//   return 'Other';
// }

// /* =========================
//    1. Send Magic Link (Consultant/Client)
// ========================= */
// app.post('/api/send-magic-link', async (req, res) => {
//   try {
//     const { email, userType } = req.body;

//     if (!email || !userType) {
//       return res.status(400).json({
//         success: false,
//         error: 'Email and userType are required'
//       });
//     }

//     if (!['consultant', 'client','admin'].includes(userType)) {
//       return res.status(400).json({
//         success: false,
//         error: 'userType must be either "consultant" or "client"'
//       });
//     }

//     // Generate magic link token
//     const token = crypto.randomBytes(32).toString('hex');
//     const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

//     // Check if user exists
//     const [existingUsers] = await pool.execute(
//       'SELECT id, role FROM users WHERE email = ?',
//       [email]
//     );

//     let userId;
//     let isNewUser = false;

//     if (existingUsers.length === 0) {
//       // Create new user
//       const [result] = await pool.execute(
//         'INSERT INTO users (email, role, magic_link_token, magic_link_expires_at) VALUES (?, ?, ?, ?)',
//         [email, userType, token, expiresAt]
//       );
//       userId = result.insertId;
//       isNewUser = true;
//       console.log(`✅ New ${userType} user created: ${email}`);
//     } else {
//       // Update existing user
//       const user = existingUsers[0];
//       userId = user.id;
      
//       // Check if user is trying to sign in with wrong role
//       if (user.role !== userType) {
//         return res.status(400).json({
//           success: false,
//           error: `This email is registered as a ${user.role}. Please use the correct login.`
//         });
//       }
      
//       await pool.execute(
//         'UPDATE users SET magic_link_token = ?, magic_link_expires_at = ? WHERE id = ?',
//         [token, expiresAt, userId]
//       );
//       console.log(`✅ Existing ${userType} user updated: ${email}`);
//     }

//     // Create magic link
//     const magicLink = `${process.env.FRONTEND_URL}/auth/verify?token=${token}&email=${encodeURIComponent(email)}&type=${userType}`;

//     // Send email
//     let emailSent = false;
//     let emailError = null;
    
//     try {
//       await emailService.sendMagicLinkEmail(email, magicLink, userType);
//       emailSent = true;
//       console.log(`📧 Magic link sent to ${email} (${userType})`);
//     } catch (error) {
//       emailError = error.message;
//       console.warn(`⚠️ Email sending failed for ${email}:`, error.message);
//     }

//     // Log email attempt
//     await pool.execute(
//       'INSERT INTO email_logs (recipient_email, email_type, status, error_message) VALUES (?, ?, ?, ?)',
//       [email, 'magic_link', emailSent ? 'sent' : 'failed', emailError]
//     );

//     res.json({
//       success: true,
//       message: 'Magic link sent successfully',
//       isNewUser,
//       emailSent,
//       expiresIn: '15 minutes'
//     });

//   } catch (error) {
//     console.error('Error sending magic link:', error);
//     res.status(500).json({ 
//       success: false,
//       error: 'Failed to send magic link',
//       details: error.message 
//     });
//   }
// });

// /* =========================
//    2. Verify Magic Link
// ========================= */
// app.post('/api/verify-magic-link', async (req, res) => {
//   try {
//     const { token, email, userType } = req.body;

//     console.log('🔍 Verifying magic link:', { token: token?.substring(0, 10) + '...', email, userType });

//     if (!token) {
//       console.log('❌ No token provided');
//       return res.status(400).json({
//         success: false,
//         error: 'Token is required'
//       });
//     }

//     // Check token validity
//     const [users] = await pool.execute(
//       'SELECT id, email, role, magic_link_expires_at, is_verified FROM users WHERE magic_link_token = ?',
//       [token]
//     );

//     if (users.length === 0) {
//       console.log('❌ Invalid token - no user found with this token');
//       return res.status(400).json({
//         success: false,
//         error: 'Invalid or expired token'
//       });
//     }

//     const user = users[0];
//     console.log('✅ User found:', { id: user.id, email: user.email, role: user.role });
    
//     // Check if token expired
//     if (new Date(user.magic_link_expires_at) < new Date()) {
//       console.log('❌ Token expired at:', user.magic_link_expires_at);
//       return res.status(400).json({
//         success: false,
//         error: 'Token has expired'
//       });
//     }

//     // Verify email matches if provided
//     if (email && user.email !== email) {
//       console.log('❌ Email mismatch:', { provided: email, stored: user.email });
//       return res.status(400).json({
//         success: false,
//         error: 'Token does not match this email'
//       });
//     }

//     // Verify role matches if provided
//     if (userType && user.role !== userType) {
//       console.log('❌ Role mismatch:', { provided: userType, stored: user.role });
//       return res.status(400).json({
//         success: false,
//         error: `This token is for ${user.role} accounts`
//       });
//     }

//     // Mark user as verified
//     await pool.execute(
//       'UPDATE users SET is_verified = TRUE, magic_link_token = NULL, magic_link_expires_at = NULL WHERE id = ?',
//       [user.id]
//     );
//     console.log('✅ User marked as verified');

//     // Generate session token (in production, use JWT)
//     const sessionToken = crypto.randomBytes(32).toString('hex');

//     // Get profile info
//     let profile = null;
//     let hasProfile = false;
//     let redirectPath = '/';

//     if (user.role === 'consultant') {
//       const [consultantProfiles] = await pool.execute(
//         'SELECT id FROM consultant_profiles WHERE user_id = ?',
//         [user.id]
//       );
//       hasProfile = consultantProfiles.length > 0;
//       profile = consultantProfiles[0] || null;
//       redirectPath = hasProfile ? '/consultant/dashboard' : '/consultant/profile-setup';
//     } else if (user.role === 'client') {
//       const [clientProfiles] = await pool.execute(
//         'SELECT id FROM client_profiles WHERE user_id = ?',
//         [user.id]
//       );
//       hasProfile = clientProfiles.length > 0;
//       profile = clientProfiles[0] || null;
//       redirectPath = hasProfile ? '/client/dashboard' : '/client/profile-setup';
//     } else if (user.role === 'admin') {
//       hasProfile = true;
//       redirectPath = '/admin/dashboard';
//     }

//     res.json({
//       success: true,
//       user: {
//         id: user.id,
//         email: user.email,
//         role: user.role,
//         isVerified: true,
//         hasProfile
//       },
//       token: sessionToken,
//       profile,
//       redirectTo: redirectPath
//     });

//   } catch (error) {
//     console.error('Error verifying magic link:', error);
//     res.status(500).json({ 
//       success: false,
//       error: 'Verification failed',
//       details: error.message 
//     });
//   }
// });

// /* =========================
//    3. Verify Token (for session validation)
// ========================= */
// app.get('/api/verify-token', async (req, res) => {
//   try {
//     const authHeader = req.headers.authorization;
    
//     if (!authHeader || !authHeader.startsWith('Bearer ')) {
//       return res.status(401).json({ 
//         success: false, 
//         error: 'No token provided' 
//       });
//     }

//     const token = authHeader.split(' ')[1];
    
//     // In production, verify JWT
//     // For now, just check if token exists in session storage
    
//     res.json({ 
//       success: true, 
//       message: 'Token is valid' 
//     });

//   } catch (error) {
//     console.error('Token verification error:', error);
//     res.status(401).json({ 
//       success: false, 
//       error: 'Invalid token' 
//     });
//   }
// });

// /* =========================
//    4. Save Consultant Signup Data
// ========================= */
// app.post('/api/save-consultant-signup-data', async (req, res) => {
//   try {
//     const { email, fullName, expertise, yearsOfExperience, linkedin, github } = req.body;

//     if (!email || !fullName) {
//       return res.status(400).json({
//         success: false,
//         error: 'Email and full name are required'
//       });
//     }

//     console.log('💾 Saving consultant signup data for:', email);

//     // Get user
//     const [users] = await pool.execute(
//       'SELECT id FROM users WHERE email = ? AND role = "consultant"',
//       [email]
//     );

//     if (users.length === 0) {
//       return res.status(400).json({
//         success: false,
//         error: 'Consultant not found'
//       });
//     }

//     const userId = users[0].id;

//     // Check if profile exists
//     const [existingProfile] = await pool.execute(
//       'SELECT id FROM consultant_profiles WHERE user_id = ?',
//       [userId]
//     );

//     if (existingProfile.length === 0) {
//       // Create profile with signup data
//       await pool.execute(
//         `INSERT INTO consultant_profiles 
//          (user_id, full_name, years_experience, linkedin_url, github_url)
//          VALUES (?, ?, ?, ?, ?)`,
//         [userId, fullName, yearsOfExperience, linkedin || null, github || null]
//       );
//     } else {
//       // Update existing profile
//       await pool.execute(
//         `UPDATE consultant_profiles 
//          SET full_name = ?, years_experience = ?, linkedin_url = ?, github_url = ?
//          WHERE user_id = ?`,
//         [fullName, yearsOfExperience, linkedin || null, github || null, userId]
//       );
//     }

//     // If expertise is provided, we might want to save it as a position
//     if (expertise) {
//       const [profile] = await pool.execute(
//         'SELECT id FROM consultant_profiles WHERE user_id = ?',
//         [userId]
//       );

//       if (profile.length > 0) {
//         const profileId = profile[0].id;
        
//         // Get position id
//         const [position] = await pool.execute(
//           'SELECT id FROM positions WHERE name = ?',
//           [expertise]
//         );

//         if (position.length > 0) {
//           // Clear existing positions
//           await pool.execute('DELETE FROM consultant_positions WHERE consultant_profile_id = ?', [profileId]);
          
//           // Add new position
//           await pool.execute(
//             'INSERT INTO consultant_positions (consultant_profile_id, position_id) VALUES (?, ?)',
//             [profileId, position[0].id]
//           );
//         }
//       }
//     }

//     console.log('✅ Consultant signup data saved for:', email);

//     res.json({
//       success: true,
//       message: 'Signup data saved successfully'
//     });

//   } catch (error) {
//     console.error('Error saving consultant signup data:', error);
//     res.status(500).json({ 
//       success: false,
//       error: 'Failed to save signup data',
//       details: error.message 
//     });
//   }
// });

// /* =========================
//    5. Get Consultant Signup Data
// ========================= */
// app.get('/api/get-consultant-signup-data', async (req, res) => {
//   try {
//     const { email } = req.query;

//     if (!email) {
//       return res.status(400).json({
//         success: false,
//         error: 'Email is required'
//       });
//     }

//     console.log('🔍 Fetching signup data for email:', email);

//     // Get user and any existing profile data
//     const [users] = await pool.execute(
//       `SELECT u.id, u.email, u.role, u.is_verified,
//               cp.full_name, cp.years_experience, cp.linkedin_url, cp.github_url
//        FROM users u
//        LEFT JOIN consultant_profiles cp ON u.id = cp.user_id
//        WHERE u.email = ? AND u.role = 'consultant'`,
//       [email]
//     );

//     if (users.length === 0) {
//       console.log('❌ Consultant not found for email:', email);
//       return res.status(404).json({
//         success: false,
//         error: 'Consultant not found'
//       });
//     }

//     const user = users[0];
//     console.log('✅ User found:', { id: user.id, email: user.email });

//     // Get expertise/positions if any
//     let expertise = '';
//     if (user.id) {
//       const [consultantProfiles] = await pool.execute(
//         'SELECT id FROM consultant_profiles WHERE user_id = ?',
//         [user.id]
//       );

//       if (consultantProfiles.length > 0) {
//         const profileId = consultantProfiles[0].id;
//         const [positionRows] = await pool.execute(
//           `SELECT p.name 
//            FROM consultant_positions cp
//            JOIN positions p ON cp.position_id = p.id
//            WHERE cp.consultant_profile_id = ?`,
//           [profileId]
//         );
//         if (positionRows.length > 0) {
//           expertise = positionRows[0].name;
//         }
//       }
//     }

//     // Return signup data
//     const responseData = {
//       success: true,
//       data: {
//         fullName: user.full_name || '',
//         email: user.email,
//         expertise: expertise,
//         yearsOfExperience: user.years_experience || '',
//         linkedin: user.linkedin_url || '',
//         github: user.github_url || ''
//       }
//     };

//     console.log('📤 Returning signup data:', responseData);
//     res.json(responseData);

//   } catch (error) {
//     console.error('Error fetching consultant signup data:', error);
//     res.status(500).json({ 
//       success: false,
//       error: 'Failed to fetch signup data',
//       details: error.message 
//     });
//   }
// });

// /* =========================
//    6. Save Consultant Profile
// ========================= */
// app.post('/api/save-consultant-profile', async (req, res) => {
//   try {
//     const { email, step, formData } = req.body;

//     if (!email || !step) {
//       return res.status(400).json({
//         success: false,
//         error: 'Email and step are required'
//       });
//     }

//     console.log(`💾 Saving consultant profile (step: ${step}) for:`, email);

//     // Get user
//     const [users] = await pool.execute(
//       'SELECT id FROM users WHERE email = ? AND role = "consultant" AND is_verified = TRUE',
//       [email]
//     );

//     if (users.length === 0) {
//       return res.status(400).json({
//         success: false,
//         error: 'Consultant not found or not verified'
//       });
//     }

//     const userId = users[0].id;

//     if (step === 'profile') {
//       // Save basic profile info
//       const { 
//         full_name, phone, base_country, base_city, 
//         work_mode, travel_willingness, travel_radius,
//         years_experience, linkedin, github, positions
//       } = formData;
      
//       const [existingProfile] = await pool.execute(
//         'SELECT id FROM consultant_profiles WHERE user_id = ?',
//         [userId]
//       );

//       let profileId;

//       if (existingProfile.length === 0) {
//         const [result] = await pool.execute(
//           `INSERT INTO consultant_profiles 
//            (user_id, full_name, phone, base_country, base_city, 
//             work_mode_preference, travel_willingness, travel_radius_km,
//             years_experience, linkedin_url, github_url)
//            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
//           [userId, full_name, phone, base_country, base_city, 
//            work_mode, travel_willingness || false, travel_radius || null,
//            years_experience, linkedin || null, github || null]
//         );
//         profileId = result.insertId;
//       } else {
//         profileId = existingProfile[0].id;
//         await pool.execute(
//           `UPDATE consultant_profiles 
//            SET full_name = ?, phone = ?, base_country = ?, base_city = ?, 
//                work_mode_preference = ?, travel_willingness = ?, travel_radius_km = ?,
//                years_experience = ?, linkedin_url = ?, github_url = ?,
//                updated_at = CURRENT_TIMESTAMP
//            WHERE user_id = ?`,
//           [full_name, phone, base_country, base_city, work_mode, 
//            travel_willingness || false, travel_radius || null,
//            years_experience, linkedin || null, github || null, userId]
//         );
//       }

//       // Save positions if provided
//       if (positions && Array.isArray(positions) && positions.length > 0) {
//         // Clear existing positions
//         await pool.execute('DELETE FROM consultant_positions WHERE consultant_profile_id = ?', [profileId]);
        
//         // Add new positions
//         for (const positionName of positions) {
//           const [position] = await pool.execute('SELECT id FROM positions WHERE name = ?', [positionName]);
//           if (position.length > 0) {
//             await pool.execute(
//               'INSERT INTO consultant_positions (consultant_profile_id, position_id) VALUES (?, ?)',
//               [profileId, position[0].id]
//             );
//           }
//         }
//       }

//     } else if (step === 'availability') {
//       // Save availability
//       const { availability_blocks } = formData;
      
//       if (availability_blocks && Array.isArray(availability_blocks)) {
//         const [profile] = await pool.execute(
//           'SELECT id FROM consultant_profiles WHERE user_id = ?',
//           [userId]
//         );

//         if (profile.length > 0) {
//           const profileId = profile[0].id;
          
//           // Clear existing availability
//           await pool.execute('DELETE FROM consultant_availability WHERE consultant_profile_id = ?', [profileId]);
          
//           // Add new availability blocks
//           for (const block of availability_blocks) {
//             await pool.execute(
//               `INSERT INTO consultant_availability 
//                (consultant_profile_id, start_date, end_date, start_time, end_time, timezone)
//                VALUES (?, ?, ?, ?, ?, ?)`,
//               [profileId, block.start_date, block.end_date, block.start_time, block.end_time, block.timezone || 'UTC']
//             );
//           }
//         }
//       }
//     }

//     console.log(`✅ Profile ${step} saved successfully for:`, email);

//     res.json({
//       success: true,
//       message: `Profile ${step} saved successfully`
//     });

//   } catch (error) {
//     console.error('Error saving consultant profile:', error);
//     res.status(500).json({ 
//       success: false,
//       error: 'Failed to save profile',
//       details: error.message 
//     });
//   }
// });

// /* =========================
//    7. Create Stripe Subscription for Consultant
// ========================= */
// app.post('/api/create-subscription', async (req, res) => {
//   try {
//     const { email, paymentMethodId } = req.body;

//     if (!email || !paymentMethodId) {
//       return res.status(400).json({
//         success: false,
//         error: 'Email and payment method are required'
//       });
//     }

//     console.log('💳 Creating subscription for:', email);

//     // Get user and profile
//     const [users] = await pool.execute(
//       `SELECT u.id, u.email, cp.id as profile_id, cp.full_name, cp.stripe_customer_id
//        FROM users u
//        LEFT JOIN consultant_profiles cp ON u.id = cp.user_id
//        WHERE u.email = ? AND u.role = 'consultant' AND u.is_verified = TRUE`,
//       [email]
//     );

//     if (users.length === 0) {
//       return res.status(400).json({
//         success: false,
//         error: 'Consultant not found or not verified'
//       });
//     }

//     const user = users[0];
//     const CONSULTANT_PRICE_ID = process.env.STRIPE_CONSULTANT_PRICE_ID;

//     if (!CONSULTANT_PRICE_ID) {
//       return res.status(500).json({
//         success: false,
//         error: 'Stripe price ID not configured'
//       });
//     }

//     let customerId = user.stripe_customer_id;
    
//     // Create or update Stripe customer
//     if (!customerId) {
//       const customer = await stripe.customers.create({
//         email: user.email,
//         name: user.full_name || user.email,
//         payment_method: paymentMethodId,
//         invoice_settings: {
//           default_payment_method: paymentMethodId,
//         },
//       });
//       customerId = customer.id;
//     } else {
//       // Attach payment method to existing customer
//       await stripe.paymentMethods.attach(paymentMethodId, {
//         customer: customerId,
//       });
//       await stripe.customers.update(customerId, {
//         invoice_settings: {
//           default_payment_method: paymentMethodId,
//         },
//       });
//     }

//     // Create subscription
//     const subscription = await stripe.subscriptions.create({
//       customer: customerId,
//       items: [{ price: CONSULTANT_PRICE_ID }],
//       payment_behavior: 'default_incomplete',
//       expand: ['latest_invoice.payment_intent'],
//     });

//     // Calculate subscription end date
//     const subscriptionEndDate = new Date();
//     subscriptionEndDate.setFullYear(subscriptionEndDate.getFullYear() + 1);

//     // Update database
//     await pool.execute(
//       `UPDATE consultant_profiles 
//        SET stripe_customer_id = ?, stripe_subscription_id = ?, 
//            subscription_status = 'active', subscription_end_date = ?
//        WHERE id = ?`,
//       [customerId, subscription.id, subscriptionEndDate, user.profile_id]
//     );

//     console.log('✅ Subscription created successfully for:', email);

//     res.json({
//       success: true,
//       subscriptionId: subscription.id,
//       clientSecret: subscription.latest_invoice.payment_intent.client_secret,
//       subscriptionStatus: subscription.status,
//       subscriptionEndDate: subscriptionEndDate.toISOString().split('T')[0]
//     });

//   } catch (error) {
//     console.error('Error creating subscription:', error);
//     res.status(500).json({ 
//       success: false,
//       error: 'Failed to create subscription',
//       details: error.message 
//     });
//   }
// });

// /* =========================
//    8. Save Client Signup Data
// ========================= */
// app.post('/api/save-client-signup-data', async (req, res) => {
//   try {
//     const { 
//       companyName, 
//       contactName, 
//       email, 
//       phone, 
//       companySize, 
//       industry, 
//       location, 
//       website 
//     } = req.body;

//     if (!email || !companyName || !contactName) {
//       return res.status(400).json({
//         success: false,
//         error: 'Email, company name, and contact name are required'
//       });
//     }

//     console.log('💾 Saving client signup data for:', email);

//     // Get user
//     const [users] = await pool.execute(
//       'SELECT id FROM users WHERE email = ? AND role = "client"',
//       [email]
//     );

//     if (users.length === 0) {
//       return res.status(400).json({
//         success: false,
//         error: 'Client not found'
//       });
//     }

//     const userId = users[0].id;

//     // Check if profile exists
//     const [existingProfile] = await pool.execute(
//       'SELECT id FROM client_profiles WHERE user_id = ?',
//       [userId]
//     );

//     if (existingProfile.length === 0) {
//       // Create profile with signup data
//       await pool.execute(
//         `INSERT INTO client_profiles 
//          (user_id, company_name, contact_name, phone, company_size, industry, location, website)
//          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
//         [userId, companyName, contactName, phone || null, companySize, industry, location, website || null]
//       );
//     } else {
//       // Update existing profile
//       await pool.execute(
//         `UPDATE client_profiles 
//          SET company_name = ?, contact_name = ?, phone = ?, 
//              company_size = ?, industry = ?, location = ?, website = ?
//          WHERE user_id = ?`,
//         [companyName, contactName, phone || null, companySize, industry, location, website || null, userId]
//       );
//     }

//     console.log('✅ Client signup data saved for:', email);

//     res.json({
//       success: true,
//       message: 'Client signup data saved successfully'
//     });

//   } catch (error) {
//     console.error('Error saving client signup data:', error);
//     res.status(500).json({ 
//       success: false,
//       error: 'Failed to save signup data',
//       details: error.message 
//     });
//   }
// });

// /* =========================
//    9. Get Client Signup Data
// ========================= */
// app.get('/api/get-client-signup-data', async (req, res) => {
//   try {
//     const { email } = req.query;

//     if (!email) {
//       return res.status(400).json({
//         success: false,
//         error: 'Email is required'
//       });
//     }

//     console.log('🔍 Fetching client signup data for email:', email);

//     // Get user and profile data
//     const [users] = await pool.execute(
//       `SELECT u.id, u.email, u.role, u.is_verified,
//               cp.company_name, cp.contact_name, cp.phone, 
//               cp.company_size, cp.industry, cp.location, cp.website
//        FROM users u
//        LEFT JOIN client_profiles cp ON u.id = cp.user_id
//        WHERE u.email = ? AND u.role = 'client'`,
//       [email]
//     );

//     if (users.length === 0) {
//       console.log('❌ Client not found for email:', email);
//       return res.status(404).json({
//         success: false,
//         error: 'Client not found'
//       });
//     }

//     const user = users[0];
//     console.log('✅ Client found:', { id: user.id, email: user.email });

//     // Return signup data
//     const responseData = {
//       success: true,
//       data: {
//         companyName: user.company_name || '',
//         contactName: user.contact_name || '',
//         email: user.email,
//         phone: user.phone || '',
//         companySize: user.company_size || '',
//         industry: user.industry || '',
//         location: user.location || '',
//         website: user.website || ''
//       }
//     };

//     console.log('📤 Returning client signup data:', responseData);
//     res.json(responseData);

//   } catch (error) {
//     console.error('Error fetching client signup data:', error);
//     res.status(500).json({ 
//       success: false,
//       error: 'Failed to fetch signup data',
//       details: error.message 
//     });
//   }
// });

// /* =========================
//    10. Save Client Profile
// ========================= */
// app.post('/api/save-client-profile', async (req, res) => {
//   try {
//     const { 
//       email, company_name, contact_name, contact_title, 
//       phone, website, company_size, industry, location, 
//       company_description 
//     } = req.body;

//     if (!email || !company_name) {
//       return res.status(400).json({
//         success: false,
//         error: 'Email and company name are required'
//       });
//     }

//     console.log('💾 Saving client profile for:', email);

//     // Get user
//     const [users] = await pool.execute(
//       'SELECT id FROM users WHERE email = ? AND role = "client" AND is_verified = TRUE',
//       [email]
//     );

//     if (users.length === 0) {
//       return res.status(400).json({
//         success: false,
//         error: 'Client not found or not verified'
//       });
//     }

//     const userId = users[0].id;

//     // Check if profile exists
//     const [existingProfile] = await pool.execute(
//       'SELECT id FROM client_profiles WHERE user_id = ?',
//       [userId]
//     );

//     if (existingProfile.length === 0) {
//       await pool.execute(
//         `INSERT INTO client_profiles 
//          (user_id, company_name, contact_name, contact_title, phone, 
//           website, company_size, industry, location, company_description)
//          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
//         [userId, company_name, contact_name || null, contact_title || null, 
//          phone || null, website || null, company_size || null, 
//          industry || null, location || null, company_description || null]
//       );
//     } else {
//       await pool.execute(
//         `UPDATE client_profiles 
//          SET company_name = ?, contact_name = ?, contact_title = ?, 
//              phone = ?, website = ?, company_size = ?, industry = ?, 
//              location = ?, company_description = ?, updated_at = CURRENT_TIMESTAMP
//          WHERE user_id = ?`,
//         [company_name, contact_name || null, contact_title || null, 
//          phone || null, website || null, company_size || null, 
//          industry || null, location || null, company_description || null, userId]
//       );
//     }

//     console.log('✅ Client profile saved successfully for:', email);

//     res.json({
//       success: true,
//       message: 'Client profile saved successfully'
//     });

//   } catch (error) {
//     console.error('Error saving client profile:', error);
//     res.status(500).json({ 
//       success: false,
//       error: 'Failed to save profile',
//       details: error.message 
//     });
//   }
// });

// /* =========================
//    11. Create Client Request
// ========================= */
// app.post('/api/create-client-request', async (req, res) => {
//   try {
//     const { 
//       email, 
//       position_id, 
//       title, 
//       description, 
//       start_date, 
//       end_date, 
//       budget_type, 
//       budget_amount, 
//       currency,
//       work_country,
//       work_city,
//       work_mode 
//     } = req.body;

//     if (!email || !position_id || !title) {
//       return res.status(400).json({
//         success: false,
//         error: 'Email, position, and title are required'
//       });
//     }

//     console.log('📝 Creating client request for:', email);

//     // Get client profile
//     const [clientProfiles] = await pool.execute(
//       `SELECT cp.id 
//        FROM client_profiles cp
//        JOIN users u ON cp.user_id = u.id
//        WHERE u.email = ? AND u.role = 'client' AND u.is_verified = TRUE`,
//       [email]
//     );

//     if (clientProfiles.length === 0) {
//       return res.status(400).json({
//         success: false,
//         error: 'Client profile not found'
//       });
//     }

//     const clientProfileId = clientProfiles[0].id;

//     // Create request
//     const [result] = await pool.execute(
//       `INSERT INTO client_requests 
//        (client_profile_id, position_id, title, description, start_date, end_date, 
//         budget_type, budget_amount, currency, work_country, work_city, work_mode, status)
//        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
//       [
//         clientProfileId, position_id, title, description || null, 
//         start_date || null, end_date || null, budget_type || 'daily', 
//         budget_amount || null, currency || 'EUR', work_country || null, 
//         work_city || null, work_mode || 'remote', 'submitted'
//       ]
//     );

//     console.log('✅ Client request created with ID:', result.insertId);

//     // Trigger matching algorithm (async)
//     setTimeout(async () => {
//       try {
//         await generateMatchSuggestions(result.insertId);
//       } catch (matchError) {
//         console.error('Error generating matches:', matchError);
//       }
//     }, 1000);

//     res.json({
//       success: true,
//       requestId: result.insertId,
//       message: 'Request created successfully'
//     });

//   } catch (error) {
//     console.error('Error creating client request:', error);
//     res.status(500).json({ 
//       success: false,
//       error: 'Failed to create request',
//       details: error.message 
//     });
//   }
// });

// /* =========================
//    12. Generate Match Suggestions
// ========================= */
// async function generateMatchSuggestions(requestId) {
//   try {
//     // Get request details
//     const [requests] = await pool.execute(
//       `SELECT cr.*, p.name as position_name, 
//         cp.id as client_profile_id, cp.company_name
//        FROM client_requests cr
//        LEFT JOIN positions p ON cr.position_id = p.id
//        LEFT JOIN client_profiles cp ON cr.client_profile_id = cp.id
//        WHERE cr.id = ?`,
//       [requestId]
//     );

//     if (requests.length === 0) return;
//     const request = requests[0];

//     // Find matching consultants
//     const query = `
//       SELECT cp.*, u.email,
//         GROUP_CONCAT(DISTINCT pos.name) as consultant_positions
//       FROM consultant_profiles cp
//       JOIN users u ON cp.user_id = u.id
//       LEFT JOIN consultant_positions cp_pos ON cp.id = cp_pos.consultant_profile_id
//       LEFT JOIN positions pos ON cp_pos.position_id = pos.id
//       WHERE cp.subscription_status = 'active'
//         AND u.is_verified = TRUE
//         AND (cp.work_mode_preference = ? OR cp.work_mode_preference = 'hybrid' OR ? = 'remote')
//         AND cp_pos.position_id = ?
//       GROUP BY cp.id
//     `;

//     const [consultants] = await pool.execute(query, [
//       request.work_mode,
//       request.work_mode,
//       request.position_id
//     ]);

//     console.log(`Found ${consultants.length} potential consultants for request ${requestId}`);

//     // Check availability for each consultant
//     for (const consultant of consultants) {
//       // Simple availability check
//       let isAvailable = true;
      
//       if (request.start_date && request.end_date) {
//         const [availability] = await pool.execute(
//           `SELECT COUNT(*) as available 
//            FROM consultant_availability 
//            WHERE consultant_profile_id = ? 
//              AND start_date <= ? 
//              AND end_date >= ?`,
//           [consultant.id, request.end_date, request.start_date]
//         );
//         isAvailable = availability[0].available > 0;
//       }

//       if (isAvailable) {
//         // Calculate match score
//         let matchScore = 70; // Base score
        
//         // Work mode match
//         if (consultant.work_mode_preference === request.work_mode) {
//           matchScore += 15;
//         } else if (consultant.work_mode_preference === 'hybrid') {
//           matchScore += 10;
//         }
        
//         // Location match bonus (if on-site)
//         if (request.work_mode === 'on-site' && 
//             consultant.base_country === request.work_country) {
//           matchScore += 15;
//           if (consultant.base_city === request.work_city) {
//             matchScore += 10;
//           }
//         }

//         // Travel willingness bonus
//         if (request.work_mode === 'on-site' && consultant.travel_willingness) {
//           matchScore += 5;
//         }

//         // Create match suggestion
//         await pool.execute(
//           `INSERT INTO match_suggestions 
//            (request_id, consultant_profile_id, match_score, match_reasons)
//            VALUES (?, ?, ?, ?)`,
//           [
//             requestId,
//             consultant.id,
//             matchScore,
//             JSON.stringify({
//               position_match: true,
//               availability_match: true,
//               subscription_active: true,
//               work_mode_compatible: true,
//               location_match: request.work_mode === 'on-site' && consultant.base_country === request.work_country,
//               score_factors: {
//                 base_score: 70,
//                 work_mode_bonus: consultant.work_mode_preference === request.work_mode ? 15 : 
//                                 (consultant.work_mode_preference === 'hybrid' ? 10 : 0),
//                 location_bonus: request.work_mode === 'on-site' && consultant.base_country === request.work_country ? 15 : 0,
//                 city_bonus: request.work_mode === 'on-site' && consultant.base_city === request.work_city ? 10 : 0,
//                 travel_bonus: request.work_mode === 'on-site' && consultant.travel_willingness ? 5 : 0
//               }
//             })
//           ]
//         );
//       }
//     }

//     console.log(`✅ Generated match suggestions for request ${requestId}`);

//     // Send notification to admin
//     console.log(`📧 Admin notification: New request "${request.title}" from ${request.company_name} needs review`);

//   } catch (error) {
//     console.error('Error generating matches:', error);
//   }
// }

// /* =========================
//    13. Admin Endpoints
// ========================= */
// app.get('/api/admin/match-suggestions', async (req, res) => {
//   try {
//     const { request_id, status } = req.query;
    
//     let query = `
//       SELECT ms.*, 
//              cr.title as request_title, cr.work_mode, cr.work_city, cr.work_country,
//              cp.id as consultant_id, cp.full_name as consultant_name, 
//              u.email as consultant_email,
//              cl.company_name as client_company
//       FROM match_suggestions ms
//       JOIN client_requests cr ON ms.request_id = cr.id
//       JOIN client_profiles cl ON cr.client_profile_id = cl.id
//       JOIN consultant_profiles cp ON ms.consultant_profile_id = cp.id
//       JOIN users u ON cp.user_id = u.id
//       WHERE 1=1
//     `;
    
//     const params = [];
    
//     if (request_id) {
//       query += ' AND ms.request_id = ?';
//       params.push(request_id);
//     }
    
//     if (status) {
//       query += ' AND ms.admin_review_status = ?';
//       params.push(status);
//     }
    
//     query += ' ORDER BY ms.match_score DESC, ms.created_at DESC';
    
//     const [suggestions] = await pool.execute(query, params);
    
//     // Parse match_reasons JSON
//     suggestions.forEach(s => {
//       if (s.match_reasons) {
//         try {
//           s.match_reasons = JSON.parse(s.match_reasons);
//         } catch (e) {
//           // Keep as string
//         }
//       }
//     });
    
//     res.json({
//       success: true,
//       count: suggestions.length,
//       suggestions
//     });
    
//   } catch (error) {
//     console.error('Error fetching match suggestions:', error);
//     res.status(500).json({ 
//       success: false, 
//       error: 'Database error' 
//     });
//   }
// });

// app.put('/api/admin/update-match-status', async (req, res) => {
//   try {
//     const { match_id, status, admin_notes } = req.body;
    
//     if (!match_id || !status) {
//       return res.status(400).json({ 
//         success: false, 
//         error: 'Match ID and status are required' 
//       });
//     }
    
//     // Get admin ID from session/token (mock for now)
//     const admin_id = 1; // In production, get from auth
    
//     await pool.execute(
//       `UPDATE match_suggestions 
//        SET admin_review_status = ?, admin_notes = ?, reviewed_by_admin_id = ?, reviewed_at = NOW()
//        WHERE id = ?`,
//       [status, admin_notes || null, admin_id, match_id]
//     );
    
//     // If status is 'interested' or 'shortlisted', maybe send email notifications
//     if (status === 'interested' || status === 'shortlisted') {
//       const [matches] = await pool.execute(
//         `SELECT ms.*, 
//                 cp.full_name as consultant_name, cp.user_id as consultant_user_id,
//                 cl.company_name, cl.contact_name,
//                 cr.title as request_title
//          FROM match_suggestions ms
//          JOIN consultant_profiles cp ON ms.consultant_profile_id = cp.id
//          JOIN client_requests cr ON ms.request_id = cr.id
//          JOIN client_profiles cl ON cr.client_profile_id = cl.id
//          WHERE ms.id = ?`,
//         [match_id]
//       );
      
//       if (matches.length > 0) {
//         const match = matches[0];
//         console.log(`📧 Notification: ${match.consultant_name} is ${status} for ${match.request_title}`);
//         // Send actual emails here
//       }
//     }
    
//     res.json({ 
//       success: true, 
//       message: 'Status updated successfully' 
//     });
    
//   } catch (error) {
//     console.error('Error updating match status:', error);
//     res.status(500).json({ 
//       success: false, 
//       error: 'Database error' 
//     });
//   }
// });

// app.get('/api/admin/requests', async (req, res) => {
//   try {
//     const { status } = req.query;
    
//     let query = `
//       SELECT cr.*, 
//              p.name as position_name,
//              cl.company_name, cl.contact_name, cl.phone,
//              (SELECT COUNT(*) FROM match_suggestions WHERE request_id = cr.id) as match_count
//       FROM client_requests cr
//       LEFT JOIN positions p ON cr.position_id = p.id
//       JOIN client_profiles cl ON cr.client_profile_id = cl.id
//       WHERE 1=1
//     `;
    
//     const params = [];
    
//     if (status) {
//       query += ' AND cr.status = ?';
//       params.push(status);
//     }
    
//     query += ' ORDER BY cr.created_at DESC';
    
//     const [requests] = await pool.execute(query, params);
    
//     res.json({
//       success: true,
//       count: requests.length,
//       requests
//     });
    
//   } catch (error) {
//     console.error('Error fetching requests:', error);
//     res.status(500).json({ 
//       success: false, 
//       error: 'Database error' 
//     });
//   }
// });

// app.get('/api/admin/consultants', async (req, res) => {
//   try {
//     const { status } = req.query;
    
//     let query = `
//       SELECT cp.*, 
//              u.email, u.created_at as user_created,
//              GROUP_CONCAT(DISTINCT p.name) as positions,
//              (SELECT COUNT(*) FROM match_suggestions WHERE consultant_profile_id = cp.id) as match_count
//       FROM consultant_profiles cp
//       JOIN users u ON cp.user_id = u.id
//       LEFT JOIN consultant_positions cp_pos ON cp.id = cp_pos.consultant_profile_id
//       LEFT JOIN positions p ON cp_pos.position_id = p.id
//       WHERE u.role = 'consultant'
//     `;
    
//     const params = [];
    
//     if (status) {
//       query += ' AND cp.subscription_status = ?';
//       params.push(status);
//     }
    
//     query += ' GROUP BY cp.id ORDER BY cp.created_at DESC';
    
//     const [consultants] = await pool.execute(query, params);
    
//     res.json({
//       success: true,
//       count: consultants.length,
//       consultants
//     });
    
//   } catch (error) {
//     console.error('Error fetching consultants:', error);
//     res.status(500).json({ 
//       success: false, 
//       error: 'Database error' 
//     });
//   }
// });

// app.get('/api/admin/clients', async (req, res) => {
//   try {
//     const { status } = req.query;
    
//     let query = `
//       SELECT cp.*, 
//              u.email, u.created_at as user_created, u.is_verified,
//              (SELECT COUNT(*) FROM client_requests WHERE client_profile_id = cp.id) as request_count
//       FROM client_profiles cp
//       JOIN users u ON cp.user_id = u.id
//       WHERE u.role = 'client'
//     `;
    
//     const params = [];
    
//     if (status) {
//       query += ' AND cp.status = ?';
//       params.push(status);
//     }
    
//     query += ' ORDER BY cp.created_at DESC';
    
//     const [clients] = await pool.execute(query, params);
    
//     res.json({
//       success: true,
//       count: clients.length,
//       clients
//     });
    
//   } catch (error) {
//     console.error('Error fetching clients:', error);
//     res.status(500).json({ 
//       success: false, 
//       error: 'Database error' 
//     });
//   }
// });

// app.post('/api/admin/verify-consultant', async (req, res) => {
//   try {
//     const { consultantId } = req.body;
    
//     if (!consultantId) {
//       return res.status(400).json({ 
//         success: false, 
//         error: 'Consultant ID is required' 
//       });
//     }
    
//     // Get user_id from consultant profile
//     const [consultantProfiles] = await pool.execute(
//       'SELECT user_id FROM consultant_profiles WHERE id = ?',
//       [consultantId]
//     );
    
//     if (consultantProfiles.length === 0) {
//       return res.status(404).json({ 
//         success: false, 
//         error: 'Consultant not found' 
//       });
//     }
    
//     const userId = consultantProfiles[0].user_id;
    
//     // Update user verification
//     await pool.execute(
//       'UPDATE users SET is_verified = TRUE WHERE id = ?',
//       [userId]
//     );
    
//     // Log the action
//     console.log(`✅ Admin verified consultant ID: ${consultantId}`);
    
//     res.json({ 
//       success: true, 
//       message: 'Consultant verified successfully' 
//     });
    
//   } catch (error) {
//     console.error('Error verifying consultant:', error);
//     res.status(500).json({ 
//       success: false, 
//       error: 'Database error' 
//     });
//   }
// });

// app.put('/api/admin/update-request-status', async (req, res) => {
//   try {
//     const { request_id, status } = req.body;
    
//     if (!request_id || !status) {
//       return res.status(400).json({ 
//         success: false, 
//         error: 'Request ID and status are required' 
//       });
//     }
    
//     // Validate status
//     const validStatuses = ['submitted', 'under_review', 'contacting', 'shortlist_ready', 'closed'];
//     if (!validStatuses.includes(status)) {
//       return res.status(400).json({ 
//         success: false, 
//         error: 'Invalid status value' 
//       });
//     }
    
//     await pool.execute(
//       'UPDATE client_requests SET status = ? WHERE id = ?',
//       [status, request_id]
//     );
    
//     // If status is 'under_review', trigger match generation if not already done
//     if (status === 'under_review') {
//       const [matches] = await pool.execute(
//         'SELECT COUNT(*) as count FROM match_suggestions WHERE request_id = ?',
//         [request_id]
//       );
      
//       if (matches[0].count === 0) {
//         // Trigger match generation asynchronously
//         setTimeout(() => {
//           generateMatchSuggestions(request_id).catch(console.error);
//         }, 100);
//       }
//     }
    
//     res.json({ 
//       success: true, 
//       message: 'Request status updated successfully' 
//     });
    
//   } catch (error) {
//     console.error('Error updating request status:', error);
//     res.status(500).json({ 
//       success: false, 
//       error: 'Database error' 
//     });
//   }
// });

// app.get('/api/admin/stats', async (req, res) => {
//   try {
//     // Get consultant stats
//     const [consultantStats] = await pool.execute(`
//       SELECT 
//         COUNT(*) as total,
//         SUM(CASE WHEN is_verified = TRUE THEN 1 ELSE 0 END) as verified,
//         SUM(CASE WHEN subscription_status = 'active' THEN 1 ELSE 0 END) as active_subscriptions
//       FROM consultant_profiles cp
//       JOIN users u ON cp.user_id = u.id
//       WHERE u.role = 'consultant'
//     `);
    
//     // Get client stats
//     const [clientStats] = await pool.execute(`
//       SELECT COUNT(*) as total
//       FROM client_profiles cp
//       JOIN users u ON cp.user_id = u.id
//       WHERE u.role = 'client'
//     `);
    
//     // Get request stats
//     const [requestStats] = await pool.execute(`
//       SELECT 
//         COUNT(*) as total,
//         SUM(CASE WHEN status IN ('submitted', 'under_review') THEN 1 ELSE 0 END) as pending
//       FROM client_requests
//     `);
    
//     // Get match stats
//     const [matchStats] = await pool.execute(`
//       SELECT 
//         COUNT(*) as total,
//         SUM(CASE WHEN admin_review_status IN ('shortlisted', 'contacted') THEN 1 ELSE 0 END) as active
//       FROM match_suggestions
//     `);
    
//     // Calculate revenue
//     const activeConsultants = consultantStats[0].active_subscriptions || 0;
//     const revenue = activeConsultants * 99;
    
//     res.json({
//       success: true,
//       stats: {
//         consultants: {
//           total: consultantStats[0].total || 0,
//           verified: consultantStats[0].verified || 0,
//           pending: (consultantStats[0].total || 0) - (consultantStats[0].verified || 0),
//           activeSubscriptions: activeConsultants
//         },
//         clients: {
//           total: clientStats[0].total || 0
//         },
//         requests: {
//           total: requestStats[0].total || 0,
//           pending: requestStats[0].pending || 0
//         },
//         matches: {
//           total: matchStats[0].total || 0,
//           active: matchStats[0].active || 0
//         },
//         revenue: revenue,
//         monthlyGrowth: 15 // You can calculate this from historical data
//       }
//     });
    
//   } catch (error) {
//     console.error('Error fetching admin stats:', error);
//     res.status(500).json({ 
//       success: false, 
//       error: 'Database error' 
//     });
//   }
// });

// app.get('/api/admin/consultant/:id', async (req, res) => {
//   try {
//     const { id } = req.params;
    
//     const [consultants] = await pool.execute(`
//       SELECT cp.*, 
//              u.email, u.created_at as user_created, u.is_verified,
//              GROUP_CONCAT(DISTINCT p.name) as positions,
//              (SELECT COUNT(*) FROM match_suggestions WHERE consultant_profile_id = cp.id) as match_count,
//              (SELECT COUNT(*) FROM consultant_availability WHERE consultant_profile_id = cp.id) as availability_count
//       FROM consultant_profiles cp
//       JOIN users u ON cp.user_id = u.id
//       LEFT JOIN consultant_positions cp_pos ON cp.id = cp_pos.consultant_profile_id
//       LEFT JOIN positions p ON cp_pos.position_id = p.id
//       WHERE cp.id = ?
//       GROUP BY cp.id
//     `, [id]);
    
//     if (consultants.length === 0) {
//       return res.status(404).json({ 
//         success: false, 
//         error: 'Consultant not found' 
//       });
//     }
    
//     // Get certificates
//     const [certificates] = await pool.execute(
//       'SELECT * FROM consultant_certificates WHERE consultant_profile_id = ?',
//       [id]
//     );
    
//     // Get availability
//     const [availability] = await pool.execute(
//       'SELECT * FROM consultant_availability WHERE consultant_profile_id = ? ORDER BY start_date',
//       [id]
//     );
    
//     const consultant = consultants[0];
//     consultant.certificates = certificates;
//     consultant.availability = availability;
    
//     res.json({
//       success: true,
//       consultant
//     });
    
//   } catch (error) {
//     console.error('Error fetching consultant details:', error);
//     res.status(500).json({ 
//       success: false, 
//       error: 'Database error' 
//     });
//   }
// });

// app.get('/api/admin/request/:id', async (req, res) => {
//   try {
//     const { id } = req.params;
    
//     const [requests] = await pool.execute(`
//       SELECT cr.*, 
//              p.name as position_name,
//              cl.company_name, cl.contact_name, cl.phone, cl.location as client_location,
//              (SELECT COUNT(*) FROM match_suggestions WHERE request_id = cr.id) as match_count
//       FROM client_requests cr
//       LEFT JOIN positions p ON cr.position_id = p.id
//       JOIN client_profiles cl ON cr.client_profile_id = cl.id
//       WHERE cr.id = ?
//     `, [id]);
    
//     if (requests.length === 0) {
//       return res.status(404).json({ 
//         success: false, 
//         error: 'Request not found' 
//       });
//     }
    
//     // Get matches for this request
//     const [matches] = await pool.execute(`
//       SELECT ms.*, 
//              cp.full_name as consultant_name, cp.base_city, cp.base_country,
//              u.email as consultant_email
//       FROM match_suggestions ms
//       JOIN consultant_profiles cp ON ms.consultant_profile_id = cp.id
//       JOIN users u ON cp.user_id = u.id
//       WHERE ms.request_id = ?
//       ORDER BY ms.match_score DESC
//     `, [id]);
    
//     const request = requests[0];
//     request.matches = matches;
    
//     res.json({
//       success: true,
//       request
//     });
    
//   } catch (error) {
//     console.error('Error fetching request details:', error);
//     res.status(500).json({ 
//       success: false, 
//       error: 'Database error' 
//     });
//   }
// });

// /* =========================
//    14. User Dashboard Data
// ========================= */
// app.get('/api/user/dashboard/:email', async (req, res) => {
//   try {
//     const { email } = req.params;
    
//     // Get user
//     const [users] = await pool.execute(
//       'SELECT id, email, role FROM users WHERE email = ? AND is_verified = TRUE',
//       [email]
//     );
    
//     if (users.length === 0) {
//       return res.status(404).json({ 
//         success: false, 
//         error: 'User not found' 
//       });
//     }
    
//     const user = users[0];
//     let data = { user: { email: user.email, role: user.role } };
    
//     if (user.role === 'consultant') {
//       // Consultant dashboard data
//       const [profile] = await pool.execute(
//         `SELECT cp.*, 
//           (SELECT GROUP_CONCAT(DISTINCT p.name) 
//            FROM consultant_positions cp2 
//            JOIN positions p ON cp2.position_id = p.id 
//            WHERE cp2.consultant_profile_id = cp.id) as positions
//          FROM consultant_profiles cp
//          WHERE cp.user_id = ?`,
//         [user.id]
//       );
      
//       const [matches] = await pool.execute(
//         `SELECT ms.*, cr.title as request_title, cr.work_mode, cr.work_city, cr.work_country,
//                 cl.company_name
//          FROM match_suggestions ms
//          JOIN client_requests cr ON ms.request_id = cr.id
//          JOIN client_profiles cl ON cr.client_profile_id = cl.id
//          WHERE ms.consultant_profile_id = (SELECT id FROM consultant_profiles WHERE user_id = ?)
//          ORDER BY ms.created_at DESC
//          LIMIT 10`,
//         [user.id]
//       );
      
//       data.profile = profile[0] || null;
//       data.matches = matches;
//       data.matchCount = matches.length;
      
//     } else if (user.role === 'client') {
//       // Client dashboard data
//       const [profile] = await pool.execute(
//         'SELECT * FROM client_profiles WHERE user_id = ?',
//         [user.id]
//       );
      
//       const [requests] = await pool.execute(
//         `SELECT cr.*, p.name as position_name,
//           (SELECT COUNT(*) FROM match_suggestions WHERE request_id = cr.id) as match_count
//          FROM client_requests cr
//          LEFT JOIN positions p ON cr.position_id = p.id
//          WHERE cr.client_profile_id = (SELECT id FROM client_profiles WHERE user_id = ?)
//          ORDER BY cr.created_at DESC`,
//         [user.id]
//       );
      
//       data.profile = profile[0] || null;
//       data.requests = requests;
//       data.requestCount = requests.length;
//     }
    
//     res.json({ 
//       success: true, 
//       data 
//     });
    
//   } catch (error) {
//     console.error('Error fetching dashboard data:', error);
//     res.status(500).json({ 
//       success: false, 
//       error: 'Database error' 
//     });
//   }
// });

// /* =========================
//    15. Check Email Status
// ========================= */
// app.get('/api/check-email-status/:email', async (req, res) => {
//   try {
//     const { email } = req.params;

//     const [users] = await pool.execute(
//       `SELECT email, role, is_verified,
//         CASE 
//           WHEN role = 'consultant' THEN 
//             (SELECT subscription_status FROM consultant_profiles WHERE user_id = users.id)
//           ELSE NULL 
//         END as subscription_status
//        FROM users
//        WHERE email = ?`,
//       [email]
//     );

//     if (users.length === 0) {
//       return res.json({
//         email,
//         exists: false,
//         is_verified: false
//       });
//     }

//     const user = users[0];
//     const response = {
//       email: user.email,
//       exists: true,
//       is_verified: user.is_verified,
//       role: user.role,
//       subscription_status: user.subscription_status
//     };

//     res.json(response);

//   } catch (error) {
//     console.error('Error checking email status:', error);
//     res.status(500).json({ 
//       success: false,
//       error: 'Failed to check status' 
//     });
//   }
// });

// /* =========================
//    16. Get Positions List
// ========================= */
// app.get('/api/positions', async (req, res) => {
//   try {
//     const [positions] = await pool.execute(
//       'SELECT id, name, category FROM positions WHERE is_active = TRUE ORDER BY name'
//     );
    
//     res.json({
//       success: true,
//       count: positions.length,
//       positions
//     });
    
//   } catch (error) {
//     console.error('Error fetching positions:', error);
//     res.status(500).json({ 
//       success: false, 
//       error: 'Database error' 
//     });
//   }
// });

// /* =========================
//    17. Stripe Webhook
// ========================= */
// app.post('/api/stripe-webhook', express.raw({type: 'application/json'}), async (req, res) => {
//   const sig = req.headers['stripe-signature'];
//   let event;

//   try {
//     event = stripe.webhooks.constructEvent(
//       req.body,
//       sig,
//       process.env.STRIPE_WEBHOOK_SECRET
//     );
//   } catch (err) {
//     console.error('❌ Webhook signature verification failed:', err.message);
//     return res.status(400).send(`Webhook Error: ${err.message}`);
//   }

//   try {
//     switch (event.type) {
//       case 'customer.subscription.created':
//       case 'customer.subscription.updated':
//         const subscription = event.data.object;
//         await pool.execute(
//           `UPDATE consultant_profiles 
//            SET subscription_status = ?, subscription_end_date = ?
//            WHERE stripe_subscription_id = ?`,
//           [
//             subscription.status,
//             new Date(subscription.current_period_end * 1000).toISOString().split('T')[0],
//             subscription.id
//           ]
//         );
//         console.log(`✅ Updated subscription ${subscription.id} to ${subscription.status}`);
//         break;

//       case 'customer.subscription.deleted':
//         const deletedSubscription = event.data.object;
//         await pool.execute(
//           `UPDATE consultant_profiles 
//            SET subscription_status = 'canceled'
//            WHERE stripe_subscription_id = ?`,
//           [deletedSubscription.id]
//         );
//         console.log(`✅ Marked subscription ${deletedSubscription.id} as canceled`);
//         break;

//       case 'invoice.payment_succeeded':
//         const invoice = event.data.object;
//         console.log(`✅ Payment succeeded for invoice ${invoice.id}`);
//         break;

//       case 'invoice.payment_failed':
//         const failedInvoice = event.data.object;
//         console.log(`❌ Payment failed for invoice ${failedInvoice.id}`);
//         // Update subscription status
//         if (failedInvoice.subscription) {
//           await pool.execute(
//             `UPDATE consultant_profiles 
//              SET subscription_status = 'past_due'
//              WHERE stripe_subscription_id = ?`,
//             [failedInvoice.subscription]
//           );
//         }
//         break;
//     }

//     res.json({ received: true });
//   } catch (error) {
//     console.error('Error processing webhook:', error);
//     res.status(500).json({ error: 'Webhook processing failed' });
//   }
// });

// /* =========================
//    404 Handler
// ========================= */
// app.use((req, res) => {
//   res.status(404).json({ 
//     success: false, 
//     error: 'Endpoint not found' 
//   });
// });

// /* =========================
//    Error Handler
// ========================= */
// app.use((err, req, res, next) => {
//   console.error('❌ Unhandled error:', err);
  
//   const statusCode = err.statusCode || 500;
//   const message = process.env.NODE_ENV === 'production' 
//     ? 'Internal server error' 
//     : err.message;
  
//   res.status(statusCode).json({ 
//     success: false, 
//     error: message,
//     stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
//   });
// });

// /* =========================
//    Graceful Shutdown
// ========================= */
// let server;

// process.on('SIGTERM', gracefulShutdown);
// process.on('SIGINT', gracefulShutdown);

// async function gracefulShutdown(signal) {
//   console.log(`\n⚠️ Received ${signal}, starting graceful shutdown...`);
  
//   try {
//     // Close database pool
//     await pool.end();
//     console.log('✅ Database connections closed');
    
//     // Close server
//     if (server) {
//       server.close(() => {
//         console.log('✅ HTTP server closed');
//         process.exit(0);
//       });
//     } else {
//       process.exit(0);
//     }
//   } catch (error) {
//     console.error('❌ Error during graceful shutdown:', error);
//     process.exit(1);
//   }
// }

// /* =========================
//    Start Server
// ========================= */
// const PORT = process.env.PORT || 5000;

// server = app.listen(PORT, async () => {
//   console.log('\n🚀 ==================================');
//   console.log(`🚀 Web Consultant Hub API starting on port ${PORT}...`);
//   console.log(`📁 Environment: ${process.env.NODE_ENV || 'development'}`);
//   console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
//   console.log('=====================================\n');
  
//   // First, ensure database exists
//   try {
//     await createDatabaseIfNotExists();
//   } catch (error) {
//     console.warn('⚠️ Could not create database automatically');
//   }
  
//   // Test database connection
//   const dbConnected = await testDatabaseConnection();
  
//   if (dbConnected) {
//     // Initialize database tables
//     await initializeDatabase();
//     console.log('✅ Database fully initialized');
//   } else {
//     console.warn('⚠️ Continuing without database connection - some features will not work');
//   }
  
//   console.log('\n✅ Server is running');
//   console.log('📋 Available endpoints:');
//   console.log('   🔐 AUTH ENDPOINTS:');
//   console.log('   POST   /api/send-magic-link           - Send magic link for login/signup');
//   console.log('   POST   /api/verify-magic-link         - Verify magic link');
//   console.log('   GET    /api/verify-token              - Verify session token');
//   console.log('   GET    /api/check-email-status/:email - Check email registration status');
//   console.log('');
//   console.log('   👤 CONSULTANT ENDPOINTS:');
//   console.log('   POST   /api/save-consultant-signup-data - Save consultant signup data');
//   console.log('   GET    /api/get-consultant-signup-data  - Get consultant signup data');
//   console.log('   POST   /api/save-consultant-profile     - Save consultant profile');
//   console.log('   POST   /api/create-subscription         - Create Stripe subscription');
//   console.log('');
//   console.log('   🏢 CLIENT ENDPOINTS:');
//   console.log('   POST   /api/save-client-signup-data    - Save client signup data');
//   console.log('   GET    /api/get-client-signup-data     - Get client signup data');
//   console.log('   POST   /api/save-client-profile        - Save client profile');
//   console.log('   POST   /api/create-client-request      - Create client request');
//   console.log('');
//   console.log('   📊 DASHBOARD ENDPOINTS:');
//   console.log('   GET    /api/user/dashboard/:email      - Get user dashboard data');
//   console.log('   GET    /api/positions                  - Get available positions');
//   console.log('');
//   console.log('   👑 ADMIN ENDPOINTS:');
//   console.log('   GET    /api/admin/match-suggestions    - View match suggestions');
//   console.log('   PUT    /api/admin/update-match-status  - Update match status');
//   console.log('   GET    /api/admin/requests             - View all client requests');
//   console.log('   GET    /api/admin/consultants          - View all consultants');
//   console.log('   GET    /api/admin/clients              - View all clients');
//   console.log('   GET    /api/admin/stats                - View admin statistics');
//   console.log('   GET    /api/admin/consultant/:id       - Get consultant details');
//   console.log('   GET    /api/admin/request/:id          - Get request details');
//   console.log('   POST   /api/admin/verify-consultant    - Verify consultant');
//   console.log('   PUT    /api/admin/update-request-status - Update request status');
//   console.log('');
//   console.log('   💳 PAYMENT ENDPOINTS:');
//   console.log('   POST   /api/stripe-webhook             - Stripe webhook handler');
//   console.log('=====================================\n');
// });




// require('dotenv').config();
// const express = require('express');
// const cors = require('cors');
// const mongoose = require('mongoose');
// const crypto = require('crypto');
// const nodemailer = require('nodemailer');
// const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// const app = express();

// /* =========================
//    Global Error Handlers
// ========================= */
// process.on('unhandledRejection', (reason, promise) => {
//   console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
// });

// process.on('uncaughtException', (error) => {
//   console.error('❌ Uncaught Exception:', error);
// });

// /* =========================
//    Environment Variables Validation
// ========================= */
// const requiredEnvVars = [
//   'MONGODB_URI',
//   'FRONTEND_URL',
//   'STRIPE_SECRET_KEY',
//   'STRIPE_CONSULTANT_PRICE_ID',
//   'EMAIL_USER',
//   'EMAIL_PASSWORD'
// ];

// const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

// if (missingEnvVars.length > 0) {
//   console.error('❌ Missing required environment variables:');
//   missingEnvVars.forEach(envVar => console.error(`   - ${envVar}`));
//   console.error('Please check your .env file');
  
//   if (process.env.NODE_ENV === 'production') {
//     process.exit(1);
//   } else {
//     console.warn('⚠️ Continuing in development mode with missing env vars');
//   }
// }

// /* =========================
//    Middleware
// ========================= */
// app.use(cors({
//   origin: [
//     process.env.FRONTEND_URL,
//     'http://localhost:5173',
//     'http://localhost:3000',
//     'http://localhost:5000',
//     'http://192.168.1.88:5173'
//   ],
//   credentials: true
// }));

// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));

// /* =========================
//    MongoDB Connection
// ========================= */
// const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://ssudhir405:ss74542@auth.oaiynju.mongodb.net/burno?retryWrites=true&w=majority';

// async function connectToMongoDB() {
//   try {
//     await mongoose.connect(MONGODB_URI);
//     console.log('✅ MongoDB connected successfully');
//     console.log(`   Database: ${mongoose.connection.name}`);
//     console.log(`   Host: ${mongoose.connection.host}`);
//     return true;
//   } catch (error) {
//     console.error('❌ MongoDB connection failed:', error.message);
    
//     if (error.message.includes('bad auth')) {
//       console.error('   🔐 Authentication failed - check your username and password');
//     } else if (error.message.includes('getaddrinfo')) {
//       console.error('   🌐 Network error - check your internet connection and MongoDB Atlas host');
//     } else if (error.message.includes('timed out')) {
//       console.error('   ⏱️ Connection timeout - check your network and MongoDB Atlas IP whitelist');
//     }
    
//     return false;
//   }
// }

// // Handle MongoDB connection events
// mongoose.connection.on('error', (err) => {
//   console.error('❌ MongoDB connection error:', err);
// });

// mongoose.connection.on('disconnected', () => {
//   console.log('⚠️ MongoDB disconnected');
// });

// mongoose.connection.on('reconnected', () => {
//   console.log('✅ MongoDB reconnected');
// });

// /* =========================
//    MongoDB Schemas (No middleware)
// ========================= */

// // User Schema
// const userSchema = new mongoose.Schema({
//   email: { type: String, required: true, unique: true },
//   role: { type: String, enum: ['consultant', 'client', 'admin'], required: true },
//   isVerified: { type: Boolean, default: false },
//   verificationToken: { type: String, default: null },
//   verificationTokenExpiresAt: { type: Date, default: null },
//   magicLinkToken: { type: String, default: null },
//   magicLinkExpiresAt: { type: Date, default: null },
//   createdAt: { type: Date, default: Date.now },
//   updatedAt: { type: Date, default: Date.now }
// });

// // Position Schema
// const positionSchema = new mongoose.Schema({
//   name: { type: String, required: true },
//   category: { type: String, default: 'Other' },
//   isActive: { type: Boolean, default: true },
//   createdAt: { type: Date, default: Date.now }
// });

// // Certificate Sub-schema
// const certificateSchema = new mongoose.Schema({
//   name: { type: String, default: '' },
//   organization: { type: String, default: '' },
//   issueDate: { type: Date, default: null },
//   expiryDate: { type: Date, default: null },
//   certificateUrl: { type: String, default: '' }
// });

// // Availability Sub-schema
// const availabilitySchema = new mongoose.Schema({
//   startDate: { type: Date, default: null },
//   endDate: { type: Date, default: null },
//   startTime: { type: String, default: '' },
//   endTime: { type: String, default: '' },
//   timezone: { type: String, default: 'UTC' },
//   isRecurring: { type: Boolean, default: false },
//   recurrencePattern: { type: String, default: '' }
// });

// // Consultant Profile Schema
// const consultantProfileSchema = new mongoose.Schema({
//   userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
//   fullName: { type: String, default: '' },
//   phone: { type: String, default: '' },
//   baseCountry: { type: String, default: '' },
//   baseCity: { type: String, default: '' },
//   workModePreference: { type: String, enum: ['remote', 'on-site', 'hybrid'], default: 'remote' },
//   travelWillingness: { type: Boolean, default: false },
//   travelRadiusKm: { type: Number, default: null },
//   yearsExperience: { type: String, default: '' },
//   cvUrl: { type: String, default: '' },
//   linkedinUrl: { type: String, default: '' },
//   githubUrl: { type: String, default: '' },
//   subscriptionStatus: { type: String, enum: ['active', 'inactive', 'canceled', 'past_due'], default: 'inactive' },
//   stripeCustomerId: { type: String, default: '' },
//   stripeSubscriptionId: { type: String, default: '' },
//   subscriptionEndDate: { type: Date, default: null },
//   positions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Position' }],
//   certificates: [certificateSchema],
//   availability: [availabilitySchema],
//   createdAt: { type: Date, default: Date.now },
//   updatedAt: { type: Date, default: Date.now }
// });

// // Client Profile Schema
// const clientProfileSchema = new mongoose.Schema({
//   userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
//   companyName: { type: String, required: true },
//   contactName: { type: String, default: '' },
//   contactTitle: { type: String, default: '' },
//   phone: { type: String, default: '' },
//   website: { type: String, default: '' },
//   companySize: { type: String, default: '' },
//   industry: { type: String, default: '' },
//   location: { type: String, default: '' },
//   companyDescription: { type: String, default: '' },
//   createdAt: { type: Date, default: Date.now },
//   updatedAt: { type: Date, default: Date.now }
// });

// // Client Request Schema
// const clientRequestSchema = new mongoose.Schema({
//   clientProfileId: { type: mongoose.Schema.Types.ObjectId, ref: 'ClientProfile', required: true },
//   positionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Position' },
//   title: { type: String, required: true },
//   description: { type: String, default: '' },
//   startDate: { type: Date, default: null },
//   endDate: { type: Date, default: null },
//   budgetType: { type: String, enum: ['daily', 'hourly', 'fixed'], default: 'daily' },
//   budgetAmount: { type: Number, default: null },
//   currency: { type: String, default: 'EUR' },
//   workCountry: { type: String, default: '' },
//   workCity: { type: String, default: '' },
//   workMode: { type: String, enum: ['remote', 'on-site', 'hybrid'], default: 'remote' },
//   status: { type: String, enum: ['submitted', 'under_review', 'contacting', 'shortlist_ready', 'closed'], default: 'submitted' },
//   createdAt: { type: Date, default: Date.now },
//   updatedAt: { type: Date, default: Date.now }
// });

// // Match Suggestion Schema
// const matchSuggestionSchema = new mongoose.Schema({
//   requestId: { type: mongoose.Schema.Types.ObjectId, ref: 'ClientRequest', required: true },
//   consultantProfileId: { type: mongoose.Schema.Types.ObjectId, ref: 'ConsultantProfile', required: true },
//   matchScore: { type: Number, default: 0 },
//   matchReasons: { type: mongoose.Schema.Types.Mixed, default: {} },
//   adminReviewStatus: { 
//     type: String, 
//     enum: ['suggested', 'contacted', 'interested', 'unavailable', 'shortlisted', 'rejected'],
//     default: 'suggested'
//   },
//   adminNotes: { type: String, default: '' },
//   reviewedByAdminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
//   reviewedAt: { type: Date, default: null },
//   createdAt: { type: Date, default: Date.now }
// });

// // Email Log Schema
// const emailLogSchema = new mongoose.Schema({
//   recipientEmail: { type: String, required: true },
//   emailType: { type: String, default: '' },
//   templateId: { type: String, default: '' },
//   requestId: { type: mongoose.Schema.Types.ObjectId, ref: 'ClientRequest', default: null },
//   consultantProfileId: { type: mongoose.Schema.Types.ObjectId, ref: 'ConsultantProfile', default: null },
//   sentAt: { type: Date, default: Date.now },
//   status: { type: String, enum: ['sent', 'failed', 'delivered', 'opened'], default: 'sent' },
//   errorMessage: { type: String, default: '' },
//   initiatedByAdminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
// });

// // Create Models
// const User = mongoose.model('User', userSchema);
// const Position = mongoose.model('Position', positionSchema);
// const ConsultantProfile = mongoose.model('ConsultantProfile', consultantProfileSchema);
// const ClientProfile = mongoose.model('ClientProfile', clientProfileSchema);
// const ClientRequest = mongoose.model('ClientRequest', clientRequestSchema);
// const MatchSuggestion = mongoose.model('MatchSuggestion', matchSuggestionSchema);
// const EmailLog = mongoose.model('EmailLog', emailLogSchema);

// /* =========================
//    Email Service with Nodemailer
// ========================= */
// const transporter = nodemailer.createTransport({
//   host: process.env.EMAIL_HOST || 'smtp.gmail.com',
//   port: process.env.EMAIL_PORT || 587,
//   secure: false,
//   auth: {
//     user: process.env.EMAIL_USER || 'nullvoid149@gmail.com',
//     pass: process.env.EMAIL_PASSWORD || 'ycop pcza nmru ywpa',
//   },
//   tls: {
//     rejectUnauthorized: false
//   }
// });

// // Verify email connection
// transporter.verify((error, success) => {
//   if (error) {
//     console.error('❌ Email service connection failed:', error);
//   } else {
//     console.log('✅ Email service is ready to send messages');
//   }
// });

// const emailService = {
//   sendMagicLinkEmail: async (email, magicLink, userType) => {
//     try {
//       const roleText = userType === 'consultant' ? 'Consultant' : (userType === 'admin' ? 'Admin' : 'Client');
      
//       const mailOptions = {
//         from: `"Web Consultant Hub" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
//         to: email,
//         subject: `Your Magic Link for Web Consultant Hub`,
//         html: `
//           <!DOCTYPE html>
//           <html>
//           <head>
//             <meta charset="utf-8">
//             <meta name="viewport" content="width=device-width, initial-scale=1.0">
//             <title>Magic Link Login</title>
//           </head>
//           <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
//             <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
//               <h1 style="color: white; margin: 0; font-size: 28px;">Web Consultant Hub</h1>
//               <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0;">${roleText} Login</p>
//             </div>
            
//             <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #ddd; border-top: none;">
//               <h2 style="color: #444; margin-top: 0;">Your Magic Login Link</h2>
              
//               <p>Hello,</p>
              
//               <p>You requested a magic link to sign in to your Web Consultant Hub ${roleText} account.</p>
              
//               <div style="text-align: center; margin: 30px 0;">
//                 <a href="${magicLink}" style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Sign In to Your Account</a>
//               </div>
              
//               <p style="color: #666; font-size: 14px;">This link will expire in 15 minutes and can only be used once.</p>
              
//               <p style="color: #666; font-size: 14px;">If you didn't request this, you can safely ignore this email.</p>
              
//               <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
              
//               <p style="color: #999; font-size: 12px; text-align: center;">
//                 &copy; ${new Date().getFullYear()} Web Consultant Hub. All rights reserved.<br>
//                 This is an automated message, please do not reply.
//               </p>
//             </div>
//           </body>
//           </html>
//         `,
//         text: `
//           Your Magic Link for Web Consultant Hub (${roleText})
          
//           Click the link below to sign in:
//           ${magicLink}
          
//           This link will expire in 15 minutes.
          
//           If you didn't request this, please ignore this email.
//         `
//       };

//       const info = await transporter.sendMail(mailOptions);
//       console.log(`📧 Email sent to ${email}:`, info.messageId);
//       return { success: true, messageId: info.messageId };
      
//     } catch (error) {
//       console.error('❌ Failed to send email:', error);
//       throw error;
//     }
//   }
// };

// /* =========================
//    Initialize Database with Default Data
// ========================= */
// function getPositionCategory(position) {
//   if (position.includes('Developer') || position.includes('Engineer')) return 'Development';
//   if (position.includes('Designer')) return 'Design';
//   if (position.includes('Manager')) return 'Management';
//   if (position.includes('Analyst') || position.includes('Scientist')) return 'Data';
//   if (position.includes('Consultant')) return 'Consulting';
//   if (position.includes('Architect')) return 'Architecture';
//   return 'Other';
// }

// async function initializeDatabase() {
//   try {
//     console.log('🔄 Initializing database with default data...');

//     // Create default admin user if none exists
//     const adminEmail = 'admin@webconsultanthub.com';
//     const adminExists = await User.findOne({ email: adminEmail });
    
//     if (!adminExists) {
//       await User.create({
//         email: adminEmail,
//         role: 'admin',
//         isVerified: true,
//         createdAt: new Date(),
//         updatedAt: new Date()
//       });
//       console.log('✅ Default admin user created: admin@webconsultanthub.com');
//     }

//     // Insert default positions if none exist
//     const positionCount = await Position.countDocuments();
//     if (positionCount === 0) {
//       const defaultPositions = [
//         'Web Developer', 'Frontend Developer', 'Backend Developer',
//         'Full Stack Developer', 'DevOps Engineer', 'UX/UI Designer',
//         'Product Manager', 'Project Manager', 'Scrum Master',
//         'Data Analyst', 'Data Scientist', 'Machine Learning Engineer',
//         'Cloud Architect', 'Security Engineer', 'Mobile Developer',
//         'QA Engineer', 'Technical Lead', 'IT Consultant',
//         'Business Analyst', 'Change Manager', 'Digital Transformation Consultant',
//         'AI Strategy Consultant', 'ERP Consultant', 'CRM Consultant'
//       ];
      
//       const positions = defaultPositions.map(name => ({
//         name,
//         category: getPositionCategory(name),
//         isActive: true,
//         createdAt: new Date()
//       }));
      
//       await Position.insertMany(positions);
//       console.log(`✅ Added ${defaultPositions.length} default positions`);
//     }
    
//     console.log('✅ Database initialization completed');
    
//   } catch (error) {
//     console.error('❌ Database initialization failed:', error.message);
//     console.error('Error details:', error);
//   }
// }

// /* =========================
//    Health Check
// ========================= */
// app.get('/', (req, res) => {
//   res.json({ 
//     message: 'Web Consultant Hub API',
//     status: 'running',
//     timestamp: new Date().toISOString(),
//     version: '1.1.0',
//     features: ['consultant-auth', 'client-auth', 'magic-links', 'stripe', 'email']
//   });
// });

// /* =========================
//    1. Send Magic Link (Consultant/Client)
// ========================= */
// app.post('/api/send-magic-link', async (req, res) => {
//   try {
//     const { email, userType } = req.body;

//     if (!email || !userType) {
//       return res.status(400).json({
//         success: false,
//         error: 'Email and userType are required'
//       });
//     }

//     if (!['consultant', 'client', 'admin'].includes(userType)) {
//       return res.status(400).json({
//         success: false,
//         error: 'userType must be either "consultant" or "client" or "admin"'
//       });
//     }

//     // Generate magic link token
//     const token = crypto.randomBytes(32).toString('hex');
//     const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

//     // Check if user exists
//     let user = await User.findOne({ email });
//     let isNewUser = false;

//     if (!user) {
//       // Create new user
//       user = await User.create({
//         email,
//         role: userType,
//         magicLinkToken: token,
//         magicLinkExpiresAt: expiresAt,
//         createdAt: new Date(),
//         updatedAt: new Date()
//       });
//       isNewUser = true;
//       console.log(`✅ New ${userType} user created: ${email}`);
//     } else {
//       // Check if user is trying to sign in with wrong role
//       if (user.role !== userType) {
//         return res.status(400).json({
//           success: false,
//           error: `This email is registered as a ${user.role}. Please use the correct login.`
//         });
//       }
      
//       // Update existing user
//       await User.updateOne(
//         { _id: user._id },
//         { 
//           $set: { 
//             magicLinkToken: token, 
//             magicLinkExpiresAt: expiresAt,
//             updatedAt: new Date()
//           } 
//         }
//       );
      
//       console.log(`✅ Existing ${userType} user updated: ${email}`);
//     }

//     // Create magic link
//     const magicLink = `${process.env.FRONTEND_URL}/auth/verify?token=${token}&email=${encodeURIComponent(email)}&type=${userType}`;

//     // Send email
//     let emailSent = false;
//     let emailError = null;
    
//     try {
//       await emailService.sendMagicLinkEmail(email, magicLink, userType);
//       emailSent = true;
//       console.log(`📧 Magic link sent to ${email} (${userType})`);
//     } catch (error) {
//       emailError = error.message;
//       console.warn(`⚠️ Email sending failed for ${email}:`, error.message);
//     }

//     // Log email attempt
//     try {
//       await EmailLog.create({
//         recipientEmail: email,
//         emailType: 'magic_link',
//         status: emailSent ? 'sent' : 'failed',
//         errorMessage: emailError,
//         sentAt: new Date()
//       });
//     } catch (logError) {
//       console.error('Error logging email:', logError);
//     }

//     res.json({
//       success: true,
//       message: 'Magic link sent successfully',
//       isNewUser,
//       emailSent,
//       expiresIn: '15 minutes'
//     });

//   } catch (error) {
//     console.error('Error sending magic link:', error);
//     res.status(500).json({ 
//       success: false,
//       error: 'Failed to send magic link',
//       details: error.message 
//     });
//   }
// });

// /* =========================
//    2. Verify Magic Link
// ========================= */
// app.post('/api/verify-magic-link', async (req, res) => {
//   try {
//     const { token, email, userType } = req.body;

//     console.log('🔍 Verifying magic link:', { token: token?.substring(0, 10) + '...', email, userType });

//     if (!token) {
//       console.log('❌ No token provided');
//       return res.status(400).json({
//         success: false,
//         error: 'Token is required'
//       });
//     }

//     // Find user by token
//     const user = await User.findOne({ magicLinkToken: token });

//     if (!user) {
//       console.log('❌ Invalid token - no user found with this token');
//       return res.status(400).json({
//         success: false,
//         error: 'Invalid or expired token'
//       });
//     }

//     console.log('✅ User found:', { id: user._id, email: user.email, role: user.role });
    
//     // Check if token expired
//     if (user.magicLinkExpiresAt < new Date()) {
//       console.log('❌ Token expired at:', user.magicLinkExpiresAt);
//       return res.status(400).json({
//         success: false,
//         error: 'Token has expired'
//       });
//     }

//     // Verify email matches if provided
//     if (email && user.email !== email) {
//       console.log('❌ Email mismatch:', { provided: email, stored: user.email });
//       return res.status(400).json({
//         success: false,
//         error: 'Token does not match this email'
//       });
//     }

//     // Verify role matches if provided
//     if (userType && user.role !== userType) {
//       console.log('❌ Role mismatch:', { provided: userType, stored: user.role });
//       return res.status(400).json({
//         success: false,
//         error: `This token is for ${user.role} accounts`
//       });
//     }

//     // Mark user as verified
//     await User.updateOne(
//       { _id: user._id },
//       { 
//         $set: { 
//           isVerified: true,
//           magicLinkToken: null,
//           magicLinkExpiresAt: null,
//           updatedAt: new Date()
//         } 
//       }
//     );
//     console.log('✅ User marked as verified');

//     // Generate session token (in production, use JWT)
//     const sessionToken = crypto.randomBytes(32).toString('hex');

//     // Get profile info
//     let profile = null;
//     let hasProfile = false;
//     let redirectPath = '/';

//     if (user.role === 'consultant') {
//       const consultantProfile = await ConsultantProfile.findOne({ userId: user._id });
//       hasProfile = !!consultantProfile;
//       profile = consultantProfile;
//       redirectPath = hasProfile ? '/consultant/dashboard' : '/consultant/profile-setup';
//     } else if (user.role === 'client') {
//       const clientProfile = await ClientProfile.findOne({ userId: user._id });
//       hasProfile = !!clientProfile;
//       profile = clientProfile;
//       redirectPath = hasProfile ? '/client/dashboard' : '/client/profile-setup';
//     } else if (user.role === 'admin') {
//       hasProfile = true;
//       redirectPath = '/admin/dashboard';
//     }

//     res.json({
//       success: true,
//       user: {
//         id: user._id,
//         email: user.email,
//         role: user.role,
//         isVerified: true,
//         hasProfile
//       },
//       token: sessionToken,
//       profile,
//       redirectTo: redirectPath
//     });

//   } catch (error) {
//     console.error('Error verifying magic link:', error);
//     res.status(500).json({ 
//       success: false,
//       error: 'Verification failed',
//       details: error.message 
//     });
//   }
// });

// /* =========================
//    3. Verify Token (for session validation)
// ========================= */
// app.get('/api/verify-token', async (req, res) => {
//   try {
//     const authHeader = req.headers.authorization;
    
//     if (!authHeader || !authHeader.startsWith('Bearer ')) {
//       return res.status(401).json({ 
//         success: false, 
//         error: 'No token provided' 
//       });
//     }

//     const token = authHeader.split(' ')[1];
    
//     res.json({ 
//       success: true, 
//       message: 'Token is valid' 
//     });

//   } catch (error) {
//     console.error('Token verification error:', error);
//     res.status(401).json({ 
//       success: false, 
//       error: 'Invalid token' 
//     });
//   }
// });

// /* =========================
//    4. Save Consultant Signup Data
// ========================= */
// app.post('/api/save-consultant-signup-data', async (req, res) => {
//   try {
//     const { email, fullName, expertise, yearsOfExperience, linkedin, github } = req.body;

//     if (!email || !fullName) {
//       return res.status(400).json({
//         success: false,
//         error: 'Email and full name are required'
//       });
//     }

//     console.log('💾 Saving consultant signup data for:', email);

//     // Get user
//     const user = await User.findOne({ email, role: 'consultant' });

//     if (!user) {
//       return res.status(400).json({
//         success: false,
//         error: 'Consultant not found'
//       });
//     }

//     // Check if profile exists
//     let consultantProfile = await ConsultantProfile.findOne({ userId: user._id });

//     if (!consultantProfile) {
//       // Create profile with signup data
//       consultantProfile = await ConsultantProfile.create({
//         userId: user._id,
//         fullName,
//         yearsExperience: yearsOfExperience,
//         linkedinUrl: linkedin || null,
//         githubUrl: github || null,
//         createdAt: new Date(),
//         updatedAt: new Date()
//       });
//     } else {
//       // Update existing profile
//       await ConsultantProfile.updateOne(
//         { _id: consultantProfile._id },
//         {
//           $set: {
//             fullName,
//             yearsExperience: yearsOfExperience,
//             linkedinUrl: linkedin || null,
//             githubUrl: github || null,
//             updatedAt: new Date()
//           }
//         }
//       );
//     }

//     // If expertise is provided, save it as a position
//     if (expertise) {
//       const position = await Position.findOne({ name: expertise });
      
//       if (position) {
//         await ConsultantProfile.updateOne(
//           { userId: user._id },
//           { $set: { positions: [position._id] } }
//         );
//       }
//     }

//     console.log('✅ Consultant signup data saved for:', email);

//     res.json({
//       success: true,
//       message: 'Signup data saved successfully'
//     });

//   } catch (error) {
//     console.error('Error saving consultant signup data:', error);
//     res.status(500).json({ 
//       success: false,
//       error: 'Failed to save signup data',
//       details: error.message 
//     });
//   }
// });

// /* =========================
//    5. Get Consultant Signup Data
// ========================= */
// app.get('/api/get-consultant-signup-data', async (req, res) => {
//   try {
//     const { email } = req.query;

//     if (!email) {
//       return res.status(400).json({
//         success: false,
//         error: 'Email is required'
//       });
//     }

//     console.log('🔍 Fetching signup data for email:', email);

//     // Get user and any existing profile data
//     const user = await User.findOne({ email, role: 'consultant' });

//     if (!user) {
//       console.log('❌ Consultant not found for email:', email);
//       return res.status(404).json({
//         success: false,
//         error: 'Consultant not found'
//       });
//     }

//     console.log('✅ User found:', { id: user._id, email: user.email });

//     // Get profile data
//     const consultantProfile = await ConsultantProfile.findOne({ userId: user._id }).populate('positions');

//     // Get expertise/positions if any
//     let expertise = '';
//     if (consultantProfile && consultantProfile.positions && consultantProfile.positions.length > 0) {
//       const position = await Position.findById(consultantProfile.positions[0]);
//       expertise = position ? position.name : '';
//     }

//     // Return signup data
//     const responseData = {
//       success: true,
//       data: {
//         fullName: consultantProfile?.fullName || '',
//         email: user.email,
//         expertise: expertise,
//         yearsOfExperience: consultantProfile?.yearsExperience || '',
//         linkedin: consultantProfile?.linkedinUrl || '',
//         github: consultantProfile?.githubUrl || ''
//       }
//     };

//     console.log('📤 Returning signup data:', responseData);
//     res.json(responseData);

//   } catch (error) {
//     console.error('Error fetching consultant signup data:', error);
//     res.status(500).json({ 
//       success: false,
//       error: 'Failed to fetch signup data',
//       details: error.message 
//     });
//   }
// });

// /* =========================
//    6. Save Consultant Profile
// ========================= */
// app.post('/api/save-consultant-profile', async (req, res) => {
//   try {
//     const { email, step, formData } = req.body;

//     if (!email || !step) {
//       return res.status(400).json({
//         success: false,
//         error: 'Email and step are required'
//       });
//     }

//     console.log(`💾 Saving consultant profile (step: ${step}) for:`, email);

//     // Get user
//     const user = await User.findOne({ email, role: 'consultant', isVerified: true });

//     if (!user) {
//       return res.status(400).json({
//         success: false,
//         error: 'Consultant not found or not verified'
//       });
//     }

//     if (step === 'profile') {
//       // Save basic profile info
//       const { 
//         full_name, phone, base_country, base_city, 
//         work_mode, travel_willingness, travel_radius,
//         years_experience, linkedin, github, positions
//       } = formData;
      
//       let consultantProfile = await ConsultantProfile.findOne({ userId: user._id });

//       if (!consultantProfile) {
//         consultantProfile = await ConsultantProfile.create({
//           userId: user._id,
//           fullName: full_name,
//           phone: phone,
//           baseCountry: base_country,
//           baseCity: base_city,
//           workModePreference: work_mode,
//           travelWillingness: travel_willingness || false,
//           travelRadiusKm: travel_radius || null,
//           yearsExperience: years_experience,
//           linkedinUrl: linkedin || null,
//           githubUrl: github || null,
//           createdAt: new Date(),
//           updatedAt: new Date()
//         });
//       } else {
//         // Update fields
//         await ConsultantProfile.updateOne(
//           { _id: consultantProfile._id },
//           {
//             $set: {
//               fullName: full_name,
//               phone: phone,
//               baseCountry: base_country,
//               baseCity: base_city,
//               workModePreference: work_mode,
//               travelWillingness: travel_willingness || false,
//               travelRadiusKm: travel_radius || null,
//               yearsExperience: years_experience,
//               linkedinUrl: linkedin || null,
//               githubUrl: github || null,
//               updatedAt: new Date()
//             }
//           }
//         );
//       }

//       // Save positions if provided
//       if (positions && Array.isArray(positions) && positions.length > 0) {
//         const positionIds = [];
//         for (const positionName of positions) {
//           const position = await Position.findOne({ name: positionName });
//           if (position) {
//             positionIds.push(position._id);
//           }
//         }
//         await ConsultantProfile.updateOne(
//           { userId: user._id },
//           { $set: { positions: positionIds } }
//         );
//       }

//     } else if (step === 'availability') {
//       // Save availability
//       const { availability_blocks } = formData;
      
//       if (availability_blocks && Array.isArray(availability_blocks)) {
//         const consultantProfile = await ConsultantProfile.findOne({ userId: user._id });

//         if (consultantProfile) {
//           // Create availability array
//           const availability = availability_blocks.map(block => ({
//             startDate: new Date(block.start_date),
//             endDate: new Date(block.end_date),
//             startTime: block.start_time,
//             endTime: block.end_time,
//             timezone: block.timezone || 'UTC'
//           }));
          
//           await ConsultantProfile.updateOne(
//             { _id: consultantProfile._id },
//             { $set: { availability: availability } }
//           );
//         }
//       }
//     }

//     console.log(`✅ Profile ${step} saved successfully for:`, email);

//     res.json({
//       success: true,
//       message: `Profile ${step} saved successfully`
//     });

//   } catch (error) {
//     console.error('Error saving consultant profile:', error);
//     res.status(500).json({ 
//       success: false,
//       error: 'Failed to save profile',
//       details: error.message 
//     });
//   }
// });

// /* =========================
//    7. Create Stripe Subscription for Consultant
// ========================= */
// app.post('/api/create-subscription', async (req, res) => {
//   try {
//     const { email, paymentMethodId } = req.body;

//     if (!email || !paymentMethodId) {
//       return res.status(400).json({
//         success: false,
//         error: 'Email and payment method are required'
//       });
//     }

//     console.log('💳 Creating subscription for:', email);

//     // Get user and profile
//     const user = await User.findOne({ email, role: 'consultant', isVerified: true });
    
//     if (!user) {
//       return res.status(400).json({
//         success: false,
//         error: 'Consultant not found or not verified'
//       });
//     }

//     let consultantProfile = await ConsultantProfile.findOne({ userId: user._id });

//     if (!consultantProfile) {
//       consultantProfile = await ConsultantProfile.create({
//         userId: user._id,
//         createdAt: new Date(),
//         updatedAt: new Date()
//       });
//     }

//     const CONSULTANT_PRICE_ID = process.env.STRIPE_CONSULTANT_PRICE_ID;

//     if (!CONSULTANT_PRICE_ID) {
//       return res.status(500).json({
//         success: false,
//         error: 'Stripe price ID not configured'
//       });
//     }

//     let customerId = consultantProfile.stripeCustomerId;
    
//     // Create or update Stripe customer
//     if (!customerId) {
//       const customer = await stripe.customers.create({
//         email: user.email,
//         name: consultantProfile.fullName || user.email,
//         payment_method: paymentMethodId,
//         invoice_settings: {
//           default_payment_method: paymentMethodId,
//         },
//       });
//       customerId = customer.id;
//     } else {
//       // Attach payment method to existing customer
//       await stripe.paymentMethods.attach(paymentMethodId, {
//         customer: customerId,
//       });
//       await stripe.customers.update(customerId, {
//         invoice_settings: {
//           default_payment_method: paymentMethodId,
//         },
//       });
//     }

//     // Create subscription
//     const subscription = await stripe.subscriptions.create({
//       customer: customerId,
//       items: [{ price: CONSULTANT_PRICE_ID }],
//       payment_behavior: 'default_incomplete',
//       expand: ['latest_invoice.payment_intent'],
//     });

//     // Calculate subscription end date
//     const subscriptionEndDate = new Date();
//     subscriptionEndDate.setFullYear(subscriptionEndDate.getFullYear() + 1);

//     // Update database
//     await ConsultantProfile.updateOne(
//       { _id: consultantProfile._id },
//       {
//         $set: {
//           stripeCustomerId: customerId,
//           stripeSubscriptionId: subscription.id,
//           subscriptionStatus: 'active',
//           subscriptionEndDate: subscriptionEndDate,
//           updatedAt: new Date()
//         }
//       }
//     );

//     console.log('✅ Subscription created successfully for:', email);

//     res.json({
//       success: true,
//       subscriptionId: subscription.id,
//       clientSecret: subscription.latest_invoice.payment_intent.client_secret,
//       subscriptionStatus: subscription.status,
//       subscriptionEndDate: subscriptionEndDate.toISOString().split('T')[0]
//     });

//   } catch (error) {
//     console.error('Error creating subscription:', error);
//     res.status(500).json({ 
//       success: false,
//       error: 'Failed to create subscription',
//       details: error.message 
//     });
//   }
// });

// /* =========================
//    8. Save Client Signup Data
// ========================= */
// app.post('/api/save-client-signup-data', async (req, res) => {
//   try {
//     const { 
//       companyName, 
//       contactName, 
//       email, 
//       phone, 
//       companySize, 
//       industry, 
//       location, 
//       website 
//     } = req.body;

//     if (!email || !companyName || !contactName) {
//       return res.status(400).json({
//         success: false,
//         error: 'Email, company name, and contact name are required'
//       });
//     }

//     console.log('💾 Saving client signup data for:', email);

//     // Get user
//     const user = await User.findOne({ email, role: 'client' });

//     if (!user) {
//       return res.status(400).json({
//         success: false,
//         error: 'Client not found'
//       });
//     }

//     // Check if profile exists
//     let clientProfile = await ClientProfile.findOne({ userId: user._id });

//     if (!clientProfile) {
//       // Create profile with signup data
//       await ClientProfile.create({
//         userId: user._id,
//         companyName,
//         contactName,
//         phone: phone || null,
//         companySize,
//         industry,
//         location,
//         website: website || null,
//         createdAt: new Date(),
//         updatedAt: new Date()
//       });
//     } else {
//       // Update existing profile
//       await ClientProfile.updateOne(
//         { _id: clientProfile._id },
//         {
//           $set: {
//             companyName,
//             contactName,
//             phone: phone || null,
//             companySize,
//             industry,
//             location,
//             website: website || null,
//             updatedAt: new Date()
//           }
//         }
//       );
//     }

//     console.log('✅ Client signup data saved for:', email);

//     res.json({
//       success: true,
//       message: 'Client signup data saved successfully'
//     });

//   } catch (error) {
//     console.error('Error saving client signup data:', error);
//     res.status(500).json({ 
//       success: false,
//       error: 'Failed to save signup data',
//       details: error.message 
//     });
//   }
// });

// /* =========================
//    9. Get Client Signup Data
// ========================= */
// app.get('/api/get-client-signup-data', async (req, res) => {
//   try {
//     const { email } = req.query;

//     if (!email) {
//       return res.status(400).json({
//         success: false,
//         error: 'Email is required'
//       });
//     }

//     console.log('🔍 Fetching client signup data for email:', email);

//     // Get user and profile data
//     const user = await User.findOne({ email, role: 'client' });

//     if (!user) {
//       console.log('❌ Client not found for email:', email);
//       return res.status(404).json({
//         success: false,
//         error: 'Client not found'
//       });
//     }

//     console.log('✅ Client found:', { id: user._id, email: user.email });

//     // Get profile
//     const clientProfile = await ClientProfile.findOne({ userId: user._id });

//     // Return signup data
//     const responseData = {
//       success: true,
//       data: {
//         companyName: clientProfile?.companyName || '',
//         contactName: clientProfile?.contactName || '',
//         email: user.email,
//         phone: clientProfile?.phone || '',
//         companySize: clientProfile?.companySize || '',
//         industry: clientProfile?.industry || '',
//         location: clientProfile?.location || '',
//         website: clientProfile?.website || ''
//       }
//     };

//     console.log('📤 Returning client signup data:', responseData);
//     res.json(responseData);

//   } catch (error) {
//     console.error('Error fetching client signup data:', error);
//     res.status(500).json({ 
//       success: false,
//       error: 'Failed to fetch signup data',
//       details: error.message 
//     });
//   }
// });

// /* =========================
//    10. Save Client Profile
// ========================= */
// app.post('/api/save-client-profile', async (req, res) => {
//   try {
//     const { 
//       email, company_name, contact_name, contact_title, 
//       phone, website, company_size, industry, location, 
//       company_description 
//     } = req.body;

//     if (!email || !company_name) {
//       return res.status(400).json({
//         success: false,
//         error: 'Email and company name are required'
//       });
//     }

//     console.log('💾 Saving client profile for:', email);

//     // Get user
//     const user = await User.findOne({ email, role: 'client', isVerified: true });

//     if (!user) {
//       return res.status(400).json({
//         success: false,
//         error: 'Client not found or not verified'
//       });
//     }

//     // Check if profile exists
//     let clientProfile = await ClientProfile.findOne({ userId: user._id });

//     if (!clientProfile) {
//       await ClientProfile.create({
//         userId: user._id,
//         companyName: company_name,
//         contactName: contact_name || null,
//         contactTitle: contact_title || null,
//         phone: phone || null,
//         website: website || null,
//         companySize: company_size || null,
//         industry: industry || null,
//         location: location || null,
//         companyDescription: company_description || null,
//         createdAt: new Date(),
//         updatedAt: new Date()
//       });
//     } else {
//       await ClientProfile.updateOne(
//         { _id: clientProfile._id },
//         {
//           $set: {
//             companyName: company_name,
//             contactName: contact_name || null,
//             contactTitle: contact_title || null,
//             phone: phone || null,
//             website: website || null,
//             companySize: company_size || null,
//             industry: industry || null,
//             location: location || null,
//             companyDescription: company_description || null,
//             updatedAt: new Date()
//           }
//         }
//       );
//     }

//     console.log('✅ Client profile saved successfully for:', email);

//     res.json({
//       success: true,
//       message: 'Client profile saved successfully'
//     });

//   } catch (error) {
//     console.error('Error saving client profile:', error);
//     res.status(500).json({ 
//       success: false,
//       error: 'Failed to save profile',
//       details: error.message 
//     });
//   }
// });

// /* =========================
//    11. Create Client Request
// ========================= */
// app.post('/api/create-client-request', async (req, res) => {
//   try {
//     const { 
//       email, 
//       position_id, 
//       title, 
//       description, 
//       start_date, 
//       end_date, 
//       budget_type, 
//       budget_amount, 
//       currency,
//       work_country,
//       work_city,
//       work_mode 
//     } = req.body;

//     if (!email || !position_id || !title) {
//       return res.status(400).json({
//         success: false,
//         error: 'Email, position, and title are required'
//       });
//     }

//     console.log('📝 Creating client request for:', email);

//     // Get client profile
//     const user = await User.findOne({ email, role: 'client', isVerified: true });
    
//     if (!user) {
//       return res.status(400).json({
//         success: false,
//         error: 'Client not found'
//       });
//     }

//     const clientProfile = await ClientProfile.findOne({ userId: user._id });

//     if (!clientProfile) {
//       return res.status(400).json({
//         success: false,
//         error: 'Client profile not found'
//       });
//     }

//     // Create request
//     const clientRequest = await ClientRequest.create({
//       clientProfileId: clientProfile._id,
//       positionId: position_id,
//       title,
//       description: description || null,
//       startDate: start_date ? new Date(start_date) : null,
//       endDate: end_date ? new Date(end_date) : null,
//       budgetType: budget_type || 'daily',
//       budgetAmount: budget_amount || null,
//       currency: currency || 'EUR',
//       workCountry: work_country || null,
//       workCity: work_city || null,
//       workMode: work_mode || 'remote',
//       status: 'submitted',
//       createdAt: new Date(),
//       updatedAt: new Date()
//     });

//     console.log('✅ Client request created with ID:', clientRequest._id);

//     // Trigger matching algorithm (async)
//     setTimeout(async () => {
//       try {
//         await generateMatchSuggestions(clientRequest._id);
//       } catch (matchError) {
//         console.error('Error generating matches:', matchError);
//       }
//     }, 1000);

//     res.json({
//       success: true,
//       requestId: clientRequest._id,
//       message: 'Request created successfully'
//     });

//   } catch (error) {
//     console.error('Error creating client request:', error);
//     res.status(500).json({ 
//       success: false,
//       error: 'Failed to create request',
//       details: error.message 
//     });
//   }
// });

// /* =========================
//    12. Generate Match Suggestions
// ========================= */
// async function generateMatchSuggestions(requestId) {
//   try {
//     // Get request details
//     const request = await ClientRequest.findById(requestId)
//       .populate('positionId')
//       .populate({
//         path: 'clientProfileId',
//         populate: { path: 'userId' }
//       });

//     if (!request) return;

//     // Find matching consultants
//     const consultants = await ConsultantProfile.find({
//       subscriptionStatus: 'active',
//       positions: request.positionId?._id,
//       $or: [
//         { workModePreference: request.workMode },
//         { workModePreference: 'hybrid' }
//       ]
//     }).populate('userId');

//     console.log(`Found ${consultants.length} potential consultants for request ${requestId}`);

//     // Check availability for each consultant
//     for (const consultant of consultants) {
//       // Simple availability check
//       let isAvailable = true;
      
//       if (request.startDate && request.endDate) {
//         const hasAvailability = consultant.availability.some(a => 
//           a.startDate && a.endDate &&
//           a.startDate <= request.endDate && 
//           a.endDate >= request.startDate
//         );
//         isAvailable = hasAvailability;
//       }

//       if (isAvailable) {
//         // Calculate match score
//         let matchScore = 70; // Base score
        
//         // Work mode match
//         if (consultant.workModePreference === request.workMode) {
//           matchScore += 15;
//         } else if (consultant.workModePreference === 'hybrid') {
//           matchScore += 10;
//         }
        
//         // Location match bonus (if on-site)
//         if (request.workMode === 'on-site' && 
//             consultant.baseCountry === request.workCountry) {
//           matchScore += 15;
//           if (consultant.baseCity === request.workCity) {
//             matchScore += 10;
//           }
//         }

//         // Travel willingness bonus
//         if (request.workMode === 'on-site' && consultant.travelWillingness) {
//           matchScore += 5;
//         }

//         // Create match suggestion
//         await MatchSuggestion.create({
//           requestId: request._id,
//           consultantProfileId: consultant._id,
//           matchScore,
//           matchReasons: {
//             position_match: true,
//             availability_match: true,
//             subscription_active: true,
//             work_mode_compatible: true,
//             location_match: request.workMode === 'on-site' && consultant.baseCountry === request.workCountry,
//             score_factors: {
//               base_score: 70,
//               work_mode_bonus: consultant.workModePreference === request.workMode ? 15 : 
//                               (consultant.workModePreference === 'hybrid' ? 10 : 0),
//               location_bonus: request.workMode === 'on-site' && consultant.baseCountry === request.workCountry ? 15 : 0,
//               city_bonus: request.workMode === 'on-site' && consultant.baseCity === request.workCity ? 10 : 0,
//               travel_bonus: request.workMode === 'on-site' && consultant.travelWillingness ? 5 : 0
//             }
//           },
//           createdAt: new Date()
//         });
//       }
//     }

//     console.log(`✅ Generated match suggestions for request ${requestId}`);

//   } catch (error) {
//     console.error('Error generating matches:', error);
//   }
// }

// /* =========================
//    13. Admin Endpoints
// ========================= */
// app.get('/api/admin/match-suggestions', async (req, res) => {
//   try {
//     const { request_id, status } = req.query;
    
//     const query = {};
    
//     if (request_id) {
//       query.requestId = request_id;
//     }
    
//     if (status) {
//       query.adminReviewStatus = status;
//     }
    
//     const suggestions = await MatchSuggestion.find(query)
//       .populate({
//         path: 'requestId',
//         populate: {
//           path: 'clientProfileId'
//         }
//       })
//       .populate({
//         path: 'consultantProfileId',
//         populate: { path: 'userId' }
//       })
//       .sort({ matchScore: -1, createdAt: -1 });
    
//     // Format the response
//     const formattedSuggestions = suggestions.map(s => {
//       const suggestionObj = s.toObject();
//       return {
//         ...suggestionObj,
//         request_title: s.requestId?.title,
//         work_mode: s.requestId?.workMode,
//         work_city: s.requestId?.workCity,
//         work_country: s.requestId?.workCountry,
//         consultant_id: s.consultantProfileId?._id,
//         consultant_name: s.consultantProfileId?.fullName,
//         consultant_email: s.consultantProfileId?.userId?.email,
//         client_company: s.requestId?.clientProfileId?.companyName
//       };
//     });
    
//     res.json({
//       success: true,
//       count: formattedSuggestions.length,
//       suggestions: formattedSuggestions
//     });
    
//   } catch (error) {
//     console.error('Error fetching match suggestions:', error);
//     res.status(500).json({ 
//       success: false, 
//       error: 'Database error' 
//     });
//   }
// });

// app.put('/api/admin/update-match-status', async (req, res) => {
//   try {
//     const { match_id, status, admin_notes } = req.body;
    
//     if (!match_id || !status) {
//       return res.status(400).json({ 
//         success: false, 
//         error: 'Match ID and status are required' 
//       });
//     }
    
//     // Get admin ID
//     const admin = await User.findOne({ role: 'admin' });
    
//     if (!admin) {
//       return res.status(400).json({ 
//         success: false, 
//         error: 'Admin not found' 
//       });
//     }
    
//     const match = await MatchSuggestion.findById(match_id);
    
//     if (!match) {
//       return res.status(404).json({ 
//         success: false, 
//         error: 'Match not found' 
//       });
//     }
    
//     await MatchSuggestion.updateOne(
//       { _id: match_id },
//       {
//         $set: {
//           adminReviewStatus: status,
//           adminNotes: admin_notes || null,
//           reviewedByAdminId: admin._id,
//           reviewedAt: new Date()
//         }
//       }
//     );
    
//     res.json({ 
//       success: true, 
//       message: 'Status updated successfully' 
//     });
    
//   } catch (error) {
//     console.error('Error updating match status:', error);
//     res.status(500).json({ 
//       success: false, 
//       error: 'Database error' 
//     });
//   }
// });

// app.get('/api/admin/requests', async (req, res) => {
//   try {
//     const { status } = req.query;
    
//     const query = {};
    
//     if (status) {
//       query.status = status;
//     }
    
//     const requests = await ClientRequest.find(query)
//       .populate('positionId')
//       .populate('clientProfileId')
//       .sort({ createdAt: -1 });
    
//     // Get match counts for each request
//     const requestsWithCounts = await Promise.all(requests.map(async (request) => {
//       const matchCount = await MatchSuggestion.countDocuments({ requestId: request._id });
//       const requestObj = request.toObject();
//       return {
//         ...requestObj,
//         position_name: request.positionId?.name,
//         company_name: request.clientProfileId?.companyName,
//         contact_name: request.clientProfileId?.contactName,
//         phone: request.clientProfileId?.phone,
//         match_count: matchCount
//       };
//     }));
    
//     res.json({
//       success: true,
//       count: requestsWithCounts.length,
//       requests: requestsWithCounts
//     });
    
//   } catch (error) {
//     console.error('Error fetching requests:', error);
//     res.status(500).json({ 
//       success: false, 
//       error: 'Database error' 
//     });
//   }
// });

// app.get('/api/admin/consultants', async (req, res) => {
//   try {
//     const { status } = req.query;
    
//     const query = {};
    
//     if (status) {
//       query.subscriptionStatus = status;
//     }
    
//     const consultants = await ConsultantProfile.find(query)
//       .populate('userId')
//       .populate('positions')
//       .sort({ createdAt: -1 });
    
//     // Get match counts for each consultant
//     const consultantsWithCounts = await Promise.all(consultants.map(async (consultant) => {
//       const matchCount = await MatchSuggestion.countDocuments({ consultantProfileId: consultant._id });
//       const consultantObj = consultant.toObject();
//       return {
//         ...consultantObj,
//         email: consultant.userId?.email,
//         user_created: consultant.userId?.createdAt,
//         positions: consultant.positions?.map(p => p.name).join(', '),
//         match_count: matchCount
//       };
//     }));
    
//     res.json({
//       success: true,
//       count: consultantsWithCounts.length,
//       consultants: consultantsWithCounts
//     });
    
//   } catch (error) {
//     console.error('Error fetching consultants:', error);
//     res.status(500).json({ 
//       success: false, 
//       error: 'Database error' 
//     });
//   }
// });

// app.get('/api/admin/clients', async (req, res) => {
//   try {
//     const query = {};
    
//     const clients = await ClientProfile.find(query)
//       .populate('userId')
//       .sort({ createdAt: -1 });
    
//     // Get request counts for each client
//     const clientsWithCounts = await Promise.all(clients.map(async (client) => {
//       const requestCount = await ClientRequest.countDocuments({ clientProfileId: client._id });
//       const clientObj = client.toObject();
//       return {
//         ...clientObj,
//         email: client.userId?.email,
//         user_created: client.userId?.createdAt,
//         is_verified: client.userId?.isVerified,
//         request_count: requestCount
//       };
//     }));
    
//     res.json({
//       success: true,
//       count: clientsWithCounts.length,
//       clients: clientsWithCounts
//     });
    
//   } catch (error) {
//     console.error('Error fetching clients:', error);
//     res.status(500).json({ 
//       success: false, 
//       error: 'Database error' 
//     });
//   }
// });

// app.post('/api/admin/verify-consultant', async (req, res) => {
//   try {
//     const { consultantId } = req.body;
    
//     if (!consultantId) {
//       return res.status(400).json({ 
//         success: false, 
//         error: 'Consultant ID is required' 
//       });
//     }
    
//     // Get consultant profile
//     const consultantProfile = await ConsultantProfile.findById(consultantId);
    
//     if (!consultantProfile) {
//       return res.status(404).json({ 
//         success: false, 
//         error: 'Consultant not found' 
//       });
//     }
    
//     // Update user verification
//     await User.updateOne(
//       { _id: consultantProfile.userId },
//       { $set: { isVerified: true } }
//     );
    
//     console.log(`✅ Admin verified consultant ID: ${consultantId}`);
    
//     res.json({ 
//       success: true, 
//       message: 'Consultant verified successfully' 
//     });
    
//   } catch (error) {
//     console.error('Error verifying consultant:', error);
//     res.status(500).json({ 
//       success: false, 
//       error: 'Database error' 
//     });
//   }
// });

// app.put('/api/admin/update-request-status', async (req, res) => {
//   try {
//     const { request_id, status } = req.body;
    
//     if (!request_id || !status) {
//       return res.status(400).json({ 
//         success: false, 
//         error: 'Request ID and status are required' 
//       });
//     }
    
//     // Validate status
//     const validStatuses = ['submitted', 'under_review', 'contacting', 'shortlist_ready', 'closed'];
//     if (!validStatuses.includes(status)) {
//       return res.status(400).json({ 
//         success: false, 
//         error: 'Invalid status value' 
//       });
//     }
    
//     await ClientRequest.updateOne(
//       { _id: request_id },
//       { $set: { status: status } }
//     );
    
//     // If status is 'under_review', trigger match generation if not already done
//     if (status === 'under_review') {
//       const matchCount = await MatchSuggestion.countDocuments({ requestId: request_id });
      
//       if (matchCount === 0) {
//         setTimeout(() => {
//           generateMatchSuggestions(request_id).catch(console.error);
//         }, 100);
//       }
//     }
    
//     res.json({ 
//       success: true, 
//       message: 'Request status updated successfully' 
//     });
    
//   } catch (error) {
//     console.error('Error updating request status:', error);
//     res.status(500).json({ 
//       success: false, 
//       error: 'Database error' 
//     });
//   }
// });

// app.get('/api/admin/stats', async (req, res) => {
//   try {
//     // Get consultant stats
//     const consultantTotal = await ConsultantProfile.countDocuments();
    
//     // Get verified consultants count
//     const verifiedConsultants = await ConsultantProfile.aggregate([
//       {
//         $lookup: {
//           from: 'users',
//           localField: 'userId',
//           foreignField: '_id',
//           as: 'user'
//         }
//       },
//       {
//         $match: {
//           'user.isVerified': true
//         }
//       },
//       {
//         $count: 'count'
//       }
//     ]);
    
//     const activeSubscriptions = await ConsultantProfile.countDocuments({
//       subscriptionStatus: 'active'
//     });
    
//     // Get client stats
//     const clientTotal = await ClientProfile.countDocuments();
    
//     // Get request stats
//     const requestTotal = await ClientRequest.countDocuments();
//     const pendingRequests = await ClientRequest.countDocuments({
//       status: { $in: ['submitted', 'under_review'] }
//     });
    
//     // Get match stats
//     const matchTotal = await MatchSuggestion.countDocuments();
//     const activeMatches = await MatchSuggestion.countDocuments({
//       adminReviewStatus: { $in: ['shortlisted', 'contacted'] }
//     });
    
//     // Calculate revenue
//     const revenue = activeSubscriptions * 99;
    
//     res.json({
//       success: true,
//       stats: {
//         consultants: {
//           total: consultantTotal,
//           verified: verifiedConsultants[0]?.count || 0,
//           pending: consultantTotal - (verifiedConsultants[0]?.count || 0),
//           activeSubscriptions
//         },
//         clients: {
//           total: clientTotal
//         },
//         requests: {
//           total: requestTotal,
//           pending: pendingRequests
//         },
//         matches: {
//           total: matchTotal,
//           active: activeMatches
//         },
//         revenue: revenue,
//         monthlyGrowth: 15
//       }
//     });
    
//   } catch (error) {
//     console.error('Error fetching admin stats:', error);
//     res.status(500).json({ 
//       success: false, 
//       error: 'Database error' 
//     });
//   }
// });

// app.get('/api/admin/consultant/:id', async (req, res) => {
//   try {
//     const { id } = req.params;
    
//     const consultant = await ConsultantProfile.findById(id)
//       .populate('userId')
//       .populate('positions');
    
//     if (!consultant) {
//       return res.status(404).json({ 
//         success: false, 
//         error: 'Consultant not found' 
//       });
//     }
    
//     // Get match count
//     const matchCount = await MatchSuggestion.countDocuments({ consultantProfileId: id });
    
//     const consultantData = {
//       ...consultant.toObject(),
//       email: consultant.userId?.email,
//       user_created: consultant.userId?.createdAt,
//       is_verified: consultant.userId?.isVerified,
//       positions: consultant.positions?.map(p => p.name).join(', '),
//       match_count: matchCount,
//       availability_count: consultant.availability?.length || 0
//     };
    
//     res.json({
//       success: true,
//       consultant: consultantData
//     });
    
//   } catch (error) {
//     console.error('Error fetching consultant details:', error);
//     res.status(500).json({ 
//       success: false, 
//       error: 'Database error' 
//     });
//   }
// });

// app.get('/api/admin/request/:id', async (req, res) => {
//   try {
//     const { id } = req.params;
    
//     const request = await ClientRequest.findById(id)
//       .populate('positionId')
//       .populate('clientProfileId');
    
//     if (!request) {
//       return res.status(404).json({ 
//         success: false, 
//         error: 'Request not found' 
//       });
//     }
    
//     // Get matches for this request
//     const matches = await MatchSuggestion.find({ requestId: id })
//       .populate({
//         path: 'consultantProfileId',
//         populate: { path: 'userId' }
//       })
//       .sort({ matchScore: -1 });
    
//     const matchesData = matches.map(m => {
//       const matchObj = m.toObject();
//       return {
//         ...matchObj,
//         consultant_name: m.consultantProfileId?.fullName,
//         consultant_city: m.consultantProfileId?.baseCity,
//         consultant_country: m.consultantProfileId?.baseCountry,
//         consultant_email: m.consultantProfileId?.userId?.email
//       };
//     });
    
//     const requestData = {
//       ...request.toObject(),
//       position_name: request.positionId?.name,
//       company_name: request.clientProfileId?.companyName,
//       contact_name: request.clientProfileId?.contactName,
//       phone: request.clientProfileId?.phone,
//       client_location: request.clientProfileId?.location,
//       match_count: matchesData.length,
//       matches: matchesData
//     };
    
//     res.json({
//       success: true,
//       request: requestData
//     });
    
//   } catch (error) {
//     console.error('Error fetching request details:', error);
//     res.status(500).json({ 
//       success: false, 
//       error: 'Database error' 
//     });
//   }
// });

// /* =========================
//    14. User Dashboard Data
// ========================= */
// app.get('/api/user/dashboard/:email', async (req, res) => {
//   try {
//     const { email } = req.params;
    
//     // Get user
//     const user = await User.findOne({ email, isVerified: true });
    
//     if (!user) {
//       return res.status(404).json({ 
//         success: false, 
//         error: 'User not found' 
//       });
//     }
    
//     let data = { user: { email: user.email, role: user.role } };
    
//     if (user.role === 'consultant') {
//       // Consultant dashboard data
//       const consultantProfile = await ConsultantProfile.findOne({ userId: user._id })
//         .populate('positions');
      
//       const matches = await MatchSuggestion.find({ consultantProfileId: consultantProfile?._id })
//         .populate({
//           path: 'requestId',
//           populate: { path: 'clientProfileId' }
//         })
//         .sort({ createdAt: -1 })
//         .limit(10);
      
//       const matchesData = matches.map(m => {
//         const matchObj = m.toObject();
//         return {
//           ...matchObj,
//           request_title: m.requestId?.title,
//           work_mode: m.requestId?.workMode,
//           work_city: m.requestId?.workCity,
//           work_country: m.requestId?.workCountry,
//           company_name: m.requestId?.clientProfileId?.companyName
//         };
//       });
      
//       data.profile = consultantProfile || null;
//       data.matches = matchesData;
//       data.matchCount = matchesData.length;
      
//     } else if (user.role === 'client') {
//       // Client dashboard data
//       const clientProfile = await ClientProfile.findOne({ userId: user._id });
      
//       const requests = await ClientRequest.find({ clientProfileId: clientProfile?._id })
//         .populate('positionId')
//         .sort({ createdAt: -1 });
      
//       const requestsData = await Promise.all(requests.map(async (request) => {
//         const matchCount = await MatchSuggestion.countDocuments({ requestId: request._id });
//         const requestObj = request.toObject();
//         return {
//           ...requestObj,
//           position_name: request.positionId?.name,
//           match_count: matchCount
//         };
//       }));
      
//       data.profile = clientProfile || null;
//       data.requests = requestsData;
//       data.requestCount = requestsData.length;
//     }
    
//     res.json({ 
//       success: true, 
//       data 
//     });
    
//   } catch (error) {
//     console.error('Error fetching dashboard data:', error);
//     res.status(500).json({ 
//       success: false, 
//       error: 'Database error' 
//     });
//   }
// });

// /* =========================
//    15. Check Email Status
// ========================= */
// app.get('/api/check-email-status/:email', async (req, res) => {
//   try {
//     const { email } = req.params;

//     const user = await User.findOne({ email });

//     if (!user) {
//       return res.json({
//         email,
//         exists: false,
//         is_verified: false
//       });
//     }

//     let subscription_status = null;
//     if (user.role === 'consultant') {
//       const consultantProfile = await ConsultantProfile.findOne({ userId: user._id });
//       subscription_status = consultantProfile?.subscriptionStatus;
//     }

//     const response = {
//       email: user.email,
//       exists: true,
//       is_verified: user.isVerified,
//       role: user.role,
//       subscription_status
//     };

//     res.json(response);

//   } catch (error) {
//     console.error('Error checking email status:', error);
//     res.status(500).json({ 
//       success: false,
//       error: 'Failed to check status' 
//     });
//   }
// });

// /* =========================
//    16. Get Positions List
// ========================= */
// app.get('/api/positions', async (req, res) => {
//   try {
//     const positions = await Position.find({ isActive: true }).sort({ name: 1 });
    
//     res.json({
//       success: true,
//       count: positions.length,
//       positions
//     });
    
//   } catch (error) {
//     console.error('Error fetching positions:', error);
//     res.status(500).json({ 
//       success: false, 
//       error: 'Database error' 
//     });
//   }
// });

// /* =========================
//    17. Stripe Webhook
// ========================= */
// app.post('/api/stripe-webhook', express.raw({type: 'application/json'}), async (req, res) => {
//   const sig = req.headers['stripe-signature'];
//   let event;

//   try {
//     event = stripe.webhooks.constructEvent(
//       req.body,
//       sig,
//       process.env.STRIPE_WEBHOOK_SECRET
//     );
//   } catch (err) {
//     console.error('❌ Webhook signature verification failed:', err.message);
//     return res.status(400).send(`Webhook Error: ${err.message}`);
//   }

//   try {
//     switch (event.type) {
//       case 'customer.subscription.created':
//       case 'customer.subscription.updated':
//         const subscription = event.data.object;
//         await ConsultantProfile.updateOne(
//           { stripeSubscriptionId: subscription.id },
//           {
//             $set: {
//               subscriptionStatus: subscription.status,
//               subscriptionEndDate: new Date(subscription.current_period_end * 1000)
//             }
//           }
//         );
//         console.log(`✅ Updated subscription ${subscription.id} to ${subscription.status}`);
//         break;

//       case 'customer.subscription.deleted':
//         const deletedSubscription = event.data.object;
//         await ConsultantProfile.updateOne(
//           { stripeSubscriptionId: deletedSubscription.id },
//           { $set: { subscriptionStatus: 'canceled' } }
//         );
//         console.log(`✅ Marked subscription ${deletedSubscription.id} as canceled`);
//         break;

//       case 'invoice.payment_succeeded':
//         const invoice = event.data.object;
//         console.log(`✅ Payment succeeded for invoice ${invoice.id}`);
//         break;

//       case 'invoice.payment_failed':
//         const failedInvoice = event.data.object;
//         console.log(`❌ Payment failed for invoice ${failedInvoice.id}`);
//         if (failedInvoice.subscription) {
//           await ConsultantProfile.updateOne(
//             { stripeSubscriptionId: failedInvoice.subscription },
//             { $set: { subscriptionStatus: 'past_due' } }
//           );
//         }
//         break;
//     }

//     res.json({ received: true });
//   } catch (error) {
//     console.error('Error processing webhook:', error);
//     res.status(500).json({ error: 'Webhook processing failed' });
//   }
// });

// /* =========================
//    404 Handler
// ========================= */
// app.use((req, res) => {
//   res.status(404).json({ 
//     success: false, 
//     error: 'Endpoint not found' 
//   });
// });

// /* =========================
//    Error Handler
// ========================= */
// app.use((err, req, res, next) => {
//   console.error('❌ Unhandled error:', err);
  
//   const statusCode = err.statusCode || 500;
//   const message = process.env.NODE_ENV === 'production' 
//     ? 'Internal server error' 
//     : err.message;
  
//   res.status(statusCode).json({ 
//     success: false, 
//     error: message,
//     stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
//   });
// });

// /* =========================
//    Graceful Shutdown
// ========================= */
// let server;

// process.on('SIGTERM', gracefulShutdown);
// process.on('SIGINT', gracefulShutdown);

// async function gracefulShutdown(signal) {
//   console.log(`\n⚠️ Received ${signal}, starting graceful shutdown...`);
  
//   try {
//     await mongoose.connection.close();
//     console.log('✅ MongoDB connection closed');
    
//     if (server) {
//       server.close(() => {
//         console.log('✅ HTTP server closed');
//         process.exit(0);
//       });
//     } else {
//       process.exit(0);
//     }
//   } catch (error) {
//     console.error('❌ Error during graceful shutdown:', error);
//     process.exit(1);
//   }
// }

// /* =========================
//    Start Server
// ========================= */
// const PORT = process.env.PORT || 5000;

// server = app.listen(PORT, async () => {
//   console.log('\n🚀 ==================================');
//   console.log(`🚀 Web Consultant Hub API starting on port ${PORT}...`);
//   console.log(`📁 Environment: ${process.env.NODE_ENV || 'development'}`);
//   console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
//   console.log('=====================================\n');
  
//   const dbConnected = await connectToMongoDB();
  
//   if (dbConnected) {
//     await initializeDatabase();
//     console.log('\n✅ Server is fully initialized and ready');
//   } else {
//     console.warn('\n⚠️ Server started but database connection failed');
//   }
  
//   console.log('\n✅ Server is running');
//   console.log('📋 Available endpoints:');
//   console.log('   🔐 AUTH ENDPOINTS:');
//   console.log('   POST   /api/send-magic-link           - Send magic link for login/signup');
//   console.log('   POST   /api/verify-magic-link         - Verify magic link');
//   console.log('   GET    /api/verify-token              - Verify session token');
//   console.log('   GET    /api/check-email-status/:email - Check email registration status');
//   console.log('');
//   console.log('   👤 CONSULTANT ENDPOINTS:');
//   console.log('   POST   /api/save-consultant-signup-data - Save consultant signup data');
//   console.log('   GET    /api/get-consultant-signup-data  - Get consultant signup data');
//   console.log('   POST   /api/save-consultant-profile     - Save consultant profile');
//   console.log('   POST   /api/create-subscription         - Create Stripe subscription');
//   console.log('');
//   console.log('   🏢 CLIENT ENDPOINTS:');
//   console.log('   POST   /api/save-client-signup-data    - Save client signup data');
//   console.log('   GET    /api/get-client-signup-data     - Get client signup data');
//   console.log('   POST   /api/save-client-profile        - Save client profile');
//   console.log('   POST   /api/create-client-request      - Create client request');
//   console.log('');
//   console.log('   📊 DASHBOARD ENDPOINTS:');
//   console.log('   GET    /api/user/dashboard/:email      - Get user dashboard data');
//   console.log('   GET    /api/positions                  - Get available positions');
//   console.log('');
//   console.log('   👑 ADMIN ENDPOINTS:');
//   console.log('   GET    /api/admin/match-suggestions    - View match suggestions');
//   console.log('   PUT    /api/admin/update-match-status  - Update match status');
//   console.log('   GET    /api/admin/requests             - View all client requests');
//   console.log('   GET    /api/admin/consultants          - View all consultants');
//   console.log('   GET    /api/admin/clients              - View all clients');
//   console.log('   GET    /api/admin/stats                - View admin statistics');
//   console.log('   GET    /api/admin/consultant/:id       - Get consultant details');
//   console.log('   GET    /api/admin/request/:id          - Get request details');
//   console.log('   POST   /api/admin/verify-consultant    - Verify consultant');
//   console.log('   PUT    /api/admin/update-request-status - Update request status');
//   console.log('');
//   console.log('   💳 PAYMENT ENDPOINTS:');
//   console.log('   POST   /api/stripe-webhook             - Stripe webhook handler');
//   console.log('=====================================\n');
// });





// require('dotenv').config();
// const express = require('express');
// const cors = require('cors');
// const mongoose = require('mongoose');
// const crypto = require('crypto');
// const nodemailer = require('nodemailer');
// const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// const app = express();

// /* =========================
//    Global Error Handlers
// ========================= */
// process.on('unhandledRejection', (reason, promise) => {
//   console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
// });

// process.on('uncaughtException', (error) => {
//   console.error('❌ Uncaught Exception:', error);
// });

// /* =========================
//    Environment Variables Validation
// ========================= */
// const requiredEnvVars = [
//   'MONGODB_URI',
//   'FRONTEND_URL',
//   'STRIPE_SECRET_KEY',
//   'STRIPE_CONSULTANT_PRICE_ID',
//   'EMAIL_USER',
//   'EMAIL_PASSWORD'
// ];

// const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

// if (missingEnvVars.length > 0) {
//   console.error('❌ Missing required environment variables:');
//   missingEnvVars.forEach(envVar => console.error(`   - ${envVar}`));
//   console.error('Please check your .env file');
  
//   if (process.env.NODE_ENV === 'production') {
//     process.exit(1);
//   } else {
//     console.warn('⚠️ Continuing in development mode with missing env vars');
//   }
// }

// /* =========================
//    Middleware
// ========================= */
// app.use(cors({
//   origin: [
//     process.env.FRONTEND_URL,
//     'http://localhost:5173',
//     'http://localhost:3000',
//     'http://localhost:5000',
//     'http://192.168.1.88:5173'
//   ],
//   credentials: true
// }));

// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));

// /* =========================
//    MongoDB Connection
// ========================= */
// const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://ssudhir405:ss74542@auth.oaiynju.mongodb.net/burno?retryWrites=true&w=majority';

// async function connectToMongoDB() {
//   try {
//     await mongoose.connect(MONGODB_URI);
//     console.log('✅ MongoDB connected successfully');
//     console.log(`   Database: ${mongoose.connection.name}`);
//     console.log(`   Host: ${mongoose.connection.host}`);
//     return true;
//   } catch (error) {
//     console.error('❌ MongoDB connection failed:', error.message);
    
//     if (error.message.includes('bad auth')) {
//       console.error('   🔐 Authentication failed - check your username and password');
//     } else if (error.message.includes('getaddrinfo')) {
//       console.error('   🌐 Network error - check your internet connection and MongoDB Atlas host');
//     } else if (error.message.includes('timed out')) {
//       console.error('   ⏱️ Connection timeout - check your network and MongoDB Atlas IP whitelist');
//     }
    
//     return false;
//   }
// }

// // Handle MongoDB connection events
// mongoose.connection.on('error', (err) => {
//   console.error('❌ MongoDB connection error:', err);
// });

// mongoose.connection.on('disconnected', () => {
//   console.log('⚠️ MongoDB disconnected');
// });

// mongoose.connection.on('reconnected', () => {
//   console.log('✅ MongoDB reconnected');
// });

// /* =========================
//    MongoDB Schemas (No middleware)
// ========================= */

// // User Schema
// const userSchema = new mongoose.Schema({
//   email: { type: String, required: true, unique: true },
//   role: { type: String, enum: ['consultant', 'client', 'admin'], required: true },
//   isVerified: { type: Boolean, default: false },
//   verificationToken: { type: String, default: null },
//   verificationTokenExpiresAt: { type: Date, default: null },
//   magicLinkToken: { type: String, default: null },
//   magicLinkExpiresAt: { type: Date, default: null },
//   createdAt: { type: Date, default: Date.now },
//   updatedAt: { type: Date, default: Date.now }
// });

// // Position Schema
// const positionSchema = new mongoose.Schema({
//   name: { type: String, required: true },
//   category: { type: String, default: 'Other' },
//   isActive: { type: Boolean, default: true },
//   createdAt: { type: Date, default: Date.now }
// });

// // Certificate Sub-schema
// const certificateSchema = new mongoose.Schema({
//   name: { type: String, default: '' },
//   organization: { type: String, default: '' },
//   issueDate: { type: Date, default: null },
//   expiryDate: { type: Date, default: null },
//   certificateUrl: { type: String, default: '' }
// });

// // Availability Sub-schema
// const availabilitySchema = new mongoose.Schema({
//   startDate: { type: Date, default: null },
//   endDate: { type: Date, default: null },
//   startTime: { type: String, default: '' },
//   endTime: { type: String, default: '' },
//   timezone: { type: String, default: 'UTC' },
//   isRecurring: { type: Boolean, default: false },
//   recurrencePattern: { type: String, default: '' }
// });

// // Consultant Profile Schema
// const consultantProfileSchema = new mongoose.Schema({
//   userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
//   fullName: { type: String, default: '' },
//   phone: { type: String, default: '' },
//   baseCountry: { type: String, default: '' },
//   baseCity: { type: String, default: '' },
//   workModePreference: { type: String, enum: ['remote', 'on-site', 'hybrid'], default: 'remote' },
//   travelWillingness: { type: Boolean, default: false },
//   travelRadiusKm: { type: Number, default: null },
//   yearsExperience: { type: String, default: '' },
//   cvUrl: { type: String, default: '' },
//   linkedinUrl: { type: String, default: '' },
//   githubUrl: { type: String, default: '' },
//   subscriptionStatus: { type: String, enum: ['active', 'inactive', 'canceled', 'past_due'], default: 'inactive' },
//   stripeCustomerId: { type: String, default: '' },
//   stripeSubscriptionId: { type: String, default: '' },
//   subscriptionEndDate: { type: Date, default: null },
//   positions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Position' }],
//   certificates: [certificateSchema],
//   availability: [availabilitySchema],
//   createdAt: { type: Date, default: Date.now },
//   updatedAt: { type: Date, default: Date.now }
// });

// // Client Profile Schema
// const clientProfileSchema = new mongoose.Schema({
//   userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
//   companyName: { type: String, required: true },
//   contactName: { type: String, default: '' },
//   contactTitle: { type: String, default: '' },
//   phone: { type: String, default: '' },
//   website: { type: String, default: '' },
//   companySize: { type: String, default: '' },
//   industry: { type: String, default: '' },
//   location: { type: String, default: '' },
//   companyDescription: { type: String, default: '' },
//   createdAt: { type: Date, default: Date.now },
//   updatedAt: { type: Date, default: Date.now }
// });

// // Client Request Schema
// const clientRequestSchema = new mongoose.Schema({
//   clientProfileId: { type: mongoose.Schema.Types.ObjectId, ref: 'ClientProfile', required: true },
//   positionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Position' },
//   title: { type: String, required: true },
//   description: { type: String, default: '' },
//   startDate: { type: Date, default: null },
//   endDate: { type: Date, default: null },
//   budgetType: { type: String, enum: ['daily', 'hourly', 'fixed'], default: 'daily' },
//   budgetAmount: { type: Number, default: null },
//   currency: { type: String, default: 'EUR' },
//   workCountry: { type: String, default: '' },
//   workCity: { type: String, default: '' },
//   workMode: { type: String, enum: ['remote', 'on-site', 'hybrid'], default: 'remote' },
//   status: { type: String, enum: ['submitted', 'under_review', 'contacting', 'shortlist_ready', 'closed'], default: 'submitted' },
//   createdAt: { type: Date, default: Date.now },
//   updatedAt: { type: Date, default: Date.now }
// });

// // Match Suggestion Schema
// const matchSuggestionSchema = new mongoose.Schema({
//   requestId: { type: mongoose.Schema.Types.ObjectId, ref: 'ClientRequest', required: true },
//   consultantProfileId: { type: mongoose.Schema.Types.ObjectId, ref: 'ConsultantProfile', required: true },
//   matchScore: { type: Number, default: 0 },
//   matchReasons: { type: mongoose.Schema.Types.Mixed, default: {} },
//   adminReviewStatus: { 
//     type: String, 
//     enum: ['suggested', 'contacted', 'interested', 'unavailable', 'shortlisted', 'rejected'],
//     default: 'suggested'
//   },
//   adminNotes: { type: String, default: '' },
//   reviewedByAdminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
//   reviewedAt: { type: Date, default: null },
//   createdAt: { type: Date, default: Date.now }
// });

// // Email Log Schema
// const emailLogSchema = new mongoose.Schema({
//   recipientEmail: { type: String, required: true },
//   emailType: { type: String, default: '' },
//   templateId: { type: String, default: '' },
//   requestId: { type: mongoose.Schema.Types.ObjectId, ref: 'ClientRequest', default: null },
//   consultantProfileId: { type: mongoose.Schema.Types.ObjectId, ref: 'ConsultantProfile', default: null },
//   sentAt: { type: Date, default: Date.now },
//   status: { type: String, enum: ['sent', 'failed', 'delivered', 'opened'], default: 'sent' },
//   errorMessage: { type: String, default: '' },
//   initiatedByAdminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
// });

// // Create Models
// const User = mongoose.model('User', userSchema);
// const Position = mongoose.model('Position', positionSchema);
// const ConsultantProfile = mongoose.model('ConsultantProfile', consultantProfileSchema);
// const ClientProfile = mongoose.model('ClientProfile', clientProfileSchema);
// const ClientRequest = mongoose.model('ClientRequest', clientRequestSchema);
// const MatchSuggestion = mongoose.model('MatchSuggestion', matchSuggestionSchema);
// const EmailLog = mongoose.model('EmailLog', emailLogSchema);

// /* =========================
//    Email Service with Nodemailer
// ========================= */
// const transporter = nodemailer.createTransport({
//   host: process.env.EMAIL_HOST || 'smtp.gmail.com',
//   port: process.env.EMAIL_PORT || 587,
//   secure: false,
//   auth: {
//     user: process.env.EMAIL_USER || 'nullvoid149@gmail.com',
//     pass: process.env.EMAIL_PASSWORD || 'ycop pcza nmru ywpa',
//   },
//   tls: {
//     rejectUnauthorized: false
//   }
// });

// // Verify email connection
// transporter.verify((error, success) => {
//   if (error) {
//     console.error('❌ Email service connection failed:', error);
//   } else {
//     console.log('✅ Email service is ready to send messages');
//   }
// });

// const emailService = {
//   sendMagicLinkEmail: async (email, magicLink, userType) => {
//     try {
//       const roleText = userType === 'consultant' ? 'Consultant' : (userType === 'admin' ? 'Admin' : 'Client');
      
//       const mailOptions = {
//         from: `"Web Consultant Hub" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
//         to: email,
//         subject: `Your Magic Link for Web Consultant Hub`,
//         html: `
//           <!DOCTYPE html>
//           <html>
//           <head>
//             <meta charset="utf-8">
//             <meta name="viewport" content="width=device-width, initial-scale=1.0">
//             <title>Magic Link Login</title>
//           </head>
//           <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
//             <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
//               <h1 style="color: white; margin: 0; font-size: 28px;">Web Consultant Hub</h1>
//               <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0;">${roleText} Login</p>
//             </div>
            
//             <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #ddd; border-top: none;">
//               <h2 style="color: #444; margin-top: 0;">Your Magic Login Link</h2>
              
//               <p>Hello,</p>
              
//               <p>You requested a magic link to sign in to your Web Consultant Hub ${roleText} account.</p>
              
//               <div style="text-align: center; margin: 30px 0;">
//                 <a href="${magicLink}" style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Sign In to Your Account</a>
//               </div>
              
//               <p style="color: #666; font-size: 14px;">This link will expire in 15 minutes and can only be used once.</p>
              
//               <p style="color: #666; font-size: 14px;">If you didn't request this, you can safely ignore this email.</p>
              
//               <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
              
//               <p style="color: #999; font-size: 12px; text-align: center;">
//                 &copy; ${new Date().getFullYear()} Web Consultant Hub. All rights reserved.<br>
//                 This is an automated message, please do not reply.
//               </p>
//             </div>
//           </body>
//           </html>
//         `,
//         text: `
//           Your Magic Link for Web Consultant Hub (${roleText})
          
//           Click the link below to sign in:
//           ${magicLink}
          
//           This link will expire in 15 minutes.
          
//           If you didn't request this, please ignore this email.
//         `
//       };

//       const info = await transporter.sendMail(mailOptions);
//       console.log(`📧 Email sent to ${email}:`, info.messageId);
//       return { success: true, messageId: info.messageId };
      
//     } catch (error) {
//       console.error('❌ Failed to send email:', error);
//       throw error;
//     }
//   }
// };

// /* =========================
//    Initialize Database with Default Data
// ========================= */
// function getPositionCategory(position) {
//   if (position.includes('Developer') || position.includes('Engineer')) return 'Development';
//   if (position.includes('Designer')) return 'Design';
//   if (position.includes('Manager')) return 'Management';
//   if (position.includes('Analyst') || position.includes('Scientist')) return 'Data';
//   if (position.includes('Consultant')) return 'Consulting';
//   if (position.includes('Architect')) return 'Architecture';
//   return 'Other';
// }

// async function initializeDatabase() {
//   try {
//     console.log('🔄 Initializing database with default data...');

//     // Create default admin user if none exists
//     const adminEmail = 'admin@webconsultanthub.com';
//     const adminExists = await User.findOne({ email: adminEmail });
    
//     if (!adminExists) {
//       await User.create({
//         email: adminEmail,
//         role: 'admin',
//         isVerified: true,
//         createdAt: new Date(),
//         updatedAt: new Date()
//       });
//       console.log('✅ Default admin user created: admin@webconsultanthub.com');
//     }

//     // Insert default positions if none exist
//     const positionCount = await Position.countDocuments();
//     if (positionCount === 0) {
//       const defaultPositions = [
//         'Web Developer', 'Frontend Developer', 'Backend Developer',
//         'Full Stack Developer', 'DevOps Engineer', 'UX/UI Designer',
//         'Product Manager', 'Project Manager', 'Scrum Master',
//         'Data Analyst', 'Data Scientist', 'Machine Learning Engineer',
//         'Cloud Architect', 'Security Engineer', 'Mobile Developer',
//         'QA Engineer', 'Technical Lead', 'IT Consultant',
//         'Business Analyst', 'Change Manager', 'Digital Transformation Consultant',
//         'AI Strategy Consultant', 'ERP Consultant', 'CRM Consultant'
//       ];
      
//       const positions = defaultPositions.map(name => ({
//         name,
//         category: getPositionCategory(name),
//         isActive: true,
//         createdAt: new Date()
//       }));
      
//       await Position.insertMany(positions);
//       console.log(`✅ Added ${defaultPositions.length} default positions`);
//     }
    
//     console.log('✅ Database initialization completed');
    
//   } catch (error) {
//     console.error('❌ Database initialization failed:', error.message);
//     console.error('Error details:', error);
//   }
// }

// /* =========================
//    Health Check
// ========================= */
// app.get('/', (req, res) => {
//   res.json({ 
//     message: 'Web Consultant Hub API',
//     status: 'running',
//     timestamp: new Date().toISOString(),
//     version: '1.1.0',
//     features: ['consultant-auth', 'client-auth', 'magic-links', 'stripe', 'email']
//   });
// });

// /* =========================
//    1. Check Registration Status First
//    This should be called before showing login/signup form
// ========================= */
// app.post('/api/check-registration', async (req, res) => {
//   try {
//     const { email } = req.body;

//     if (!email) {
//       return res.status(400).json({
//         success: false,
//         error: 'Email is required'
//       });
//     }

//     console.log('🔍 Checking registration for email:', email);

//     // Check if user exists in database
//     const user = await User.findOne({ email });

//     if (!user) {
//       // User not registered
//       return res.json({
//         success: true,
//         isRegistered: false,
//         message: 'Email not registered. Please sign up.'
//       });
//     }

//     // User exists - check profile completion
//     let hasProfile = false;
//     let profileStatus = 'incomplete';
    
//     if (user.role === 'consultant') {
//       const consultantProfile = await ConsultantProfile.findOne({ userId: user._id });
//       hasProfile = !!consultantProfile;
      
//       if (consultantProfile) {
//         const basicInfoComplete = !!(consultantProfile.fullName && consultantProfile.phone && consultantProfile.baseCountry);
//         const availabilityComplete = consultantProfile.availability && consultantProfile.availability.length > 0;
//         const paymentComplete = consultantProfile.subscriptionStatus === 'active';
        
//         if (basicInfoComplete && availabilityComplete && paymentComplete) {
//           profileStatus = 'complete';
//         } else if (basicInfoComplete) {
//           profileStatus = 'partial';
//         }
//       }
//     } else if (user.role === 'client') {
//       const clientProfile = await ClientProfile.findOne({ userId: user._id });
//       hasProfile = !!clientProfile;
      
//       if (clientProfile) {
//         const basicInfoComplete = !!(clientProfile.companyName && clientProfile.contactName);
//         profileStatus = basicInfoComplete ? 'complete' : 'partial';
//       }
//     } else if (user.role === 'admin') {
//       hasProfile = true;
//       profileStatus = 'complete';
//     }

//     // User is registered
//     res.json({
//       success: true,
//       isRegistered: true,
//       role: user.role,
//       isVerified: user.isVerified,
//       hasProfile: hasProfile,
//       profileStatus: profileStatus,
//       message: 'Email is registered'
//     });

//   } catch (error) {
//     console.error('Error checking registration:', error);
//     res.status(500).json({ 
//       success: false,
//       error: 'Failed to check registration status',
//       details: error.message 
//     });
//   }
// });

// /* =========================
//    2. Send Magic Link (Only for registered users)
// ========================= */
// app.post('/api/send-magic-link', async (req, res) => {
//   try {
//     const { email, userType } = req.body;

//     if (!email || !userType) {
//       return res.status(400).json({
//         success: false,
//         error: 'Email and userType are required'
//       });
//     }

//     if (!['consultant', 'client', 'admin'].includes(userType)) {
//       return res.status(400).json({
//         success: false,
//         error: 'userType must be either "consultant", "client", or "admin"'
//       });
//     }

//     console.log('🔐 Attempting to send magic link for:', email);

//     // FIRST CHECK: Verify user exists and is registered
//     const existingUser = await User.findOne({ email });

//     if (!existingUser) {
//       console.log('❌ User not found - registration required:', email);
//       return res.status(400).json({
//         success: false,
//         error: 'Email not registered. Please sign up first.',
//         requiresSignup: true
//       });
//     }

//     // Check if user is trying to sign in with correct role
//     if (existingUser.role !== userType) {
//       console.log('❌ Role mismatch:', { provided: userType, stored: existingUser.role });
//       return res.status(400).json({
//         success: false,
//         error: `This email is registered as a ${existingUser.role}. Please use the correct login type.`,
//         registeredRole: existingUser.role
//       });
//     }

//     // User exists and role matches - proceed with magic link
//     console.log('✅ Registered user found - sending magic link:', email);

//     // Generate magic link token
//     const token = crypto.randomBytes(32).toString('hex');
//     const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

//     // Update existing user with magic link token
//     await User.updateOne(
//       { _id: existingUser._id },
//       { 
//         $set: { 
//           magicLinkToken: token, 
//           magicLinkExpiresAt: expiresAt,
//           updatedAt: new Date()
//         } 
//       }
//     );

//     // Create magic link
//     const magicLink = `${process.env.FRONTEND_URL}/auth/verify?token=${token}&email=${encodeURIComponent(email)}&type=${userType}`;

//     // Send email
//     let emailSent = false;
//     let emailError = null;
    
//     try {
//       await emailService.sendMagicLinkEmail(email, magicLink, userType);
//       emailSent = true;
//       console.log(`📧 Magic link sent to ${email} (${userType})`);
//     } catch (error) {
//       emailError = error.message;
//       console.warn(`⚠️ Email sending failed for ${email}:`, error.message);
//     }

//     // Log email attempt
//     try {
//       await EmailLog.create({
//         recipientEmail: email,
//         emailType: 'magic_link',
//         status: emailSent ? 'sent' : 'failed',
//         errorMessage: emailError,
//         sentAt: new Date()
//       });
//     } catch (logError) {
//       console.error('Error logging email:', logError);
//     }

//     // Check if user has completed profile
//     let hasProfile = false;
//     let profileStatus = null;
//     let profileCompletion = {
//       basicInfo: false,
//       availability: false,
//       payment: false
//     };

//     if (userType === 'consultant') {
//       const consultantProfile = await ConsultantProfile.findOne({ userId: existingUser._id });
//       hasProfile = !!consultantProfile;
      
//       if (consultantProfile) {
//         profileCompletion.basicInfo = !!(consultantProfile.fullName && consultantProfile.phone && consultantProfile.baseCountry);
//         profileCompletion.availability = consultantProfile.availability && consultantProfile.availability.length > 0;
//         profileCompletion.payment = consultantProfile.subscriptionStatus === 'active';
        
//         if (profileCompletion.basicInfo && profileCompletion.availability && profileCompletion.payment) {
//           profileStatus = 'complete';
//         } else if (profileCompletion.basicInfo) {
//           profileStatus = 'partial';
//         } else {
//           profileStatus = 'incomplete';
//         }
//       } else {
//         profileStatus = 'incomplete';
//       }
//     } else if (userType === 'client') {
//       const clientProfile = await ClientProfile.findOne({ userId: existingUser._id });
//       hasProfile = !!clientProfile;
      
//       if (clientProfile) {
//         profileCompletion.basicInfo = !!(clientProfile.companyName && clientProfile.contactName);
//         profileStatus = profileCompletion.basicInfo ? 'complete' : 'partial';
//       } else {
//         profileStatus = 'incomplete';
//       }
//     } else if (userType === 'admin') {
//       hasProfile = true;
//       profileStatus = 'complete';
//       profileCompletion = { basicInfo: true, availability: true, payment: true };
//     }

//     res.json({
//       success: true,
//       message: 'Magic link sent successfully',
//       email: email,
//       userType: userType,
//       isRegistered: true,
//       isVerified: existingUser.isVerified,
//       hasProfile: hasProfile,
//       profileStatus: profileStatus,
//       profileCompletion: profileCompletion,
//       emailSent: emailSent,
//       expiresIn: '15 minutes'
//     });

//   } catch (error) {
//     console.error('Error sending magic link:', error);
//     res.status(500).json({ 
//       success: false,
//       error: 'Failed to send magic link',
//       details: error.message 
//     });
//   }
// });

// /* =========================
//    3. Verify Magic Link
// ========================= */
// app.post('/api/verify-magic-link', async (req, res) => {
//   try {
//     const { token, email, userType } = req.body;

//     console.log('🔍 Verifying magic link:', { token: token?.substring(0, 10) + '...', email, userType });

//     if (!token) {
//       console.log('❌ No token provided');
//       return res.status(400).json({
//         success: false,
//         error: 'Token is required'
//       });
//     }

//     // First check if user exists
//     const user = await User.findOne({ email });

//     if (!user) {
//       console.log('❌ User not found for email:', email);
//       return res.status(400).json({
//         success: false,
//         error: 'User not found. Please sign up first.',
//         requiresSignup: true
//       });
//     }

//     // Verify the magic link token
//     if (user.magicLinkToken !== token) {
//       console.log('❌ Invalid token for user:', email);
//       return res.status(400).json({
//         success: false,
//         error: 'Invalid or expired token'
//       });
//     }

//     // Check if token expired
//     if (user.magicLinkExpiresAt < new Date()) {
//       console.log('❌ Token expired at:', user.magicLinkExpiresAt);
//       return res.status(400).json({
//         success: false,
//         error: 'Token has expired'
//       });
//     }

//     // Verify role matches
//     if (user.role !== userType) {
//       console.log('❌ Role mismatch:', { provided: userType, stored: user.role });
//       return res.status(400).json({
//         success: false,
//         error: `This account is registered as a ${user.role}. Please use the correct login type.`
//       });
//     }

//     console.log('✅ User verified:', { id: user._id, email: user.email, role: user.role });

//     // Mark user as verified if not already
//     if (!user.isVerified) {
//       await User.updateOne(
//         { _id: user._id },
//         { 
//           $set: { 
//             isVerified: true,
//             updatedAt: new Date()
//           } 
//         }
//       );
//       console.log('✅ User marked as verified');
//     }

//     // Clear the magic link token
//     await User.updateOne(
//       { _id: user._id },
//       { 
//         $set: { 
//           magicLinkToken: null,
//           magicLinkExpiresAt: null
//         } 
//       }
//     );

//     // Generate session token (in production, use JWT)
//     const sessionToken = crypto.randomBytes(32).toString('hex');

//     // Get profile info
//     let profile = null;
//     let hasProfile = false;
//     let redirectPath = '/';
//     let profileCompletion = {
//       basicInfo: false,
//       availability: false,
//       payment: false
//     };

//     if (user.role === 'consultant') {
//       const consultantProfile = await ConsultantProfile.findOne({ userId: user._id });
//       hasProfile = !!consultantProfile;
//       profile = consultantProfile;
      
//       if (consultantProfile) {
//         // Check profile completion
//         profileCompletion.basicInfo = !!(consultantProfile.fullName && consultantProfile.phone && consultantProfile.baseCountry);
//         profileCompletion.availability = consultantProfile.availability && consultantProfile.availability.length > 0;
//         profileCompletion.payment = consultantProfile.subscriptionStatus === 'active';
        
//         // Determine redirect based on completion
//         if (!profileCompletion.basicInfo) {
//           redirectPath = '/consultant/profile-setup?step=basic';
//         } else if (!profileCompletion.availability) {
//           redirectPath = '/consultant/profile-setup?step=availability';
//         } else if (!profileCompletion.payment) {
//           redirectPath = '/consultant/subscription';
//         } else {
//           redirectPath = '/consultant/dashboard';
//         }
//       } else {
//         redirectPath = '/consultant/profile-setup?step=basic';
//       }
//     } else if (user.role === 'client') {
//       const clientProfile = await ClientProfile.findOne({ userId: user._id });
//       hasProfile = !!clientProfile;
//       profile = clientProfile;
      
//       if (clientProfile) {
//         // Check profile completion
//         profileCompletion.basicInfo = !!(clientProfile.companyName && clientProfile.contactName);
//         redirectPath = '/client/dashboard';
//       } else {
//         redirectPath = '/client/profile-setup';
//       }
//     } else if (user.role === 'admin') {
//       hasProfile = true;
//       redirectPath = '/admin/dashboard';
//       profileCompletion = { basicInfo: true, availability: true, payment: true };
//     }

//     res.json({
//       success: true,
//       user: {
//         id: user._id,
//         email: user.email,
//         role: user.role,
//         isVerified: true,
//         hasProfile,
//         profileCompletion
//       },
//       token: sessionToken,
//       profile,
//       redirectTo: redirectPath,
//       requiresSignup: false
//     });

//   } catch (error) {
//     console.error('Error verifying magic link:', error);
//     res.status(500).json({ 
//       success: false,
//       error: 'Verification failed',
//       details: error.message 
//     });
//   }
// });

// /* =========================
//    4. Verify Token (for session validation)
// ========================= */
// app.get('/api/verify-token', async (req, res) => {
//   try {
//     const authHeader = req.headers.authorization;
    
//     if (!authHeader || !authHeader.startsWith('Bearer ')) {
//       return res.status(401).json({ 
//         success: false, 
//         error: 'No token provided' 
//       });
//     }

//     const token = authHeader.split(' ')[1];
    
//     res.json({ 
//       success: true, 
//       message: 'Token is valid' 
//     });

//   } catch (error) {
//     console.error('Token verification error:', error);
//     res.status(401).json({ 
//       success: false, 
//       error: 'Invalid token' 
//     });
//   }
// });

// /* =========================
//    5. Save Consultant Signup Data
// ========================= */
// app.post('/api/save-consultant-signup-data', async (req, res) => {
//   try {
//     const { email, fullName, expertise, yearsOfExperience, linkedin, github } = req.body;

//     if (!email || !fullName) {
//       return res.status(400).json({
//         success: false,
//         error: 'Email and full name are required'
//       });
//     }

//     console.log('💾 Saving consultant signup data for:', email);

//     // Get user
//     const user = await User.findOne({ email, role: 'consultant' });

//     if (!user) {
//       return res.status(400).json({
//         success: false,
//         error: 'Consultant not found'
//       });
//     }

//     // Check if profile exists
//     let consultantProfile = await ConsultantProfile.findOne({ userId: user._id });

//     if (!consultantProfile) {
//       // Create profile with signup data
//       consultantProfile = await ConsultantProfile.create({
//         userId: user._id,
//         fullName,
//         yearsExperience: yearsOfExperience,
//         linkedinUrl: linkedin || null,
//         githubUrl: github || null,
//         createdAt: new Date(),
//         updatedAt: new Date()
//       });
//     } else {
//       // Update existing profile
//       await ConsultantProfile.updateOne(
//         { _id: consultantProfile._id },
//         {
//           $set: {
//             fullName,
//             yearsExperience: yearsOfExperience,
//             linkedinUrl: linkedin || null,
//             githubUrl: github || null,
//             updatedAt: new Date()
//           }
//         }
//       );
//     }

//     // If expertise is provided, save it as a position
//     if (expertise) {
//       const position = await Position.findOne({ name: expertise });
      
//       if (position) {
//         await ConsultantProfile.updateOne(
//           { userId: user._id },
//           { $set: { positions: [position._id] } }
//         );
//       }
//     }

//     console.log('✅ Consultant signup data saved for:', email);

//     res.json({
//       success: true,
//       message: 'Signup data saved successfully'
//     });

//   } catch (error) {
//     console.error('Error saving consultant signup data:', error);
//     res.status(500).json({ 
//       success: false,
//       error: 'Failed to save signup data',
//       details: error.message 
//     });
//   }
// });

// /* =========================
//    6. Get Consultant Signup Data
// ========================= */
// app.get('/api/get-consultant-signup-data', async (req, res) => {
//   try {
//     const { email } = req.query;

//     if (!email) {
//       return res.status(400).json({
//         success: false,
//         error: 'Email is required'
//       });
//     }

//     console.log('🔍 Fetching signup data for email:', email);

//     // Get user and any existing profile data
//     const user = await User.findOne({ email, role: 'consultant' });

//     if (!user) {
//       console.log('❌ Consultant not found for email:', email);
//       return res.status(404).json({
//         success: false,
//         error: 'Consultant not found'
//       });
//     }

//     console.log('✅ User found:', { id: user._id, email: user.email });

//     // Get profile data
//     const consultantProfile = await ConsultantProfile.findOne({ userId: user._id }).populate('positions');

//     // Get expertise/positions if any
//     let expertise = '';
//     if (consultantProfile && consultantProfile.positions && consultantProfile.positions.length > 0) {
//       const position = await Position.findById(consultantProfile.positions[0]);
//       expertise = position ? position.name : '';
//     }

//     // Return signup data
//     const responseData = {
//       success: true,
//       data: {
//         fullName: consultantProfile?.fullName || '',
//         email: user.email,
//         expertise: expertise,
//         yearsOfExperience: consultantProfile?.yearsExperience || '',
//         linkedin: consultantProfile?.linkedinUrl || '',
//         github: consultantProfile?.githubUrl || ''
//       }
//     };

//     console.log('📤 Returning signup data:', responseData);
//     res.json(responseData);

//   } catch (error) {
//     console.error('Error fetching consultant signup data:', error);
//     res.status(500).json({ 
//       success: false,
//       error: 'Failed to fetch signup data',
//       details: error.message 
//     });
//   }
// });

// /* =========================
//    7. Save Consultant Profile
// ========================= */
// app.post('/api/save-consultant-profile', async (req, res) => {
//   try {
//     const { email, step, formData } = req.body;

//     if (!email || !step) {
//       return res.status(400).json({
//         success: false,
//         error: 'Email and step are required'
//       });
//     }

//     console.log(`💾 Saving consultant profile (step: ${step}) for:`, email);

//     // Get user
//     const user = await User.findOne({ email, role: 'consultant', isVerified: true });

//     if (!user) {
//       return res.status(400).json({
//         success: false,
//         error: 'Consultant not found or not verified'
//       });
//     }

//     if (step === 'profile') {
//       // Save basic profile info
//       const { 
//         full_name, phone, base_country, base_city, 
//         work_mode, travel_willingness, travel_radius,
//         years_experience, linkedin, github, positions
//       } = formData;
      
//       let consultantProfile = await ConsultantProfile.findOne({ userId: user._id });

//       if (!consultantProfile) {
//         consultantProfile = await ConsultantProfile.create({
//           userId: user._id,
//           fullName: full_name,
//           phone: phone,
//           baseCountry: base_country,
//           baseCity: base_city,
//           workModePreference: work_mode,
//           travelWillingness: travel_willingness || false,
//           travelRadiusKm: travel_radius || null,
//           yearsExperience: years_experience,
//           linkedinUrl: linkedin || null,
//           githubUrl: github || null,
//           createdAt: new Date(),
//           updatedAt: new Date()
//         });
//       } else {
//         // Update fields
//         await ConsultantProfile.updateOne(
//           { _id: consultantProfile._id },
//           {
//             $set: {
//               fullName: full_name,
//               phone: phone,
//               baseCountry: base_country,
//               baseCity: base_city,
//               workModePreference: work_mode,
//               travelWillingness: travel_willingness || false,
//               travelRadiusKm: travel_radius || null,
//               yearsExperience: years_experience,
//               linkedinUrl: linkedin || null,
//               githubUrl: github || null,
//               updatedAt: new Date()
//             }
//           }
//         );
//       }

//       // Save positions if provided
//       if (positions && Array.isArray(positions) && positions.length > 0) {
//         const positionIds = [];
//         for (const positionName of positions) {
//           const position = await Position.findOne({ name: positionName });
//           if (position) {
//             positionIds.push(position._id);
//           }
//         }
//         await ConsultantProfile.updateOne(
//           { userId: user._id },
//           { $set: { positions: positionIds } }
//         );
//       }

//     } else if (step === 'availability') {
//       // Save availability
//       const { availability_blocks } = formData;
      
//       if (availability_blocks && Array.isArray(availability_blocks)) {
//         const consultantProfile = await ConsultantProfile.findOne({ userId: user._id });

//         if (consultantProfile) {
//           // Create availability array
//           const availability = availability_blocks.map(block => ({
//             startDate: new Date(block.start_date),
//             endDate: new Date(block.end_date),
//             startTime: block.start_time,
//             endTime: block.end_time,
//             timezone: block.timezone || 'UTC'
//           }));
          
//           await ConsultantProfile.updateOne(
//             { _id: consultantProfile._id },
//             { $set: { availability: availability } }
//           );
//         }
//       }
//     }

//     console.log(`✅ Profile ${step} saved successfully for:`, email);

//     res.json({
//       success: true,
//       message: `Profile ${step} saved successfully`
//     });

//   } catch (error) {
//     console.error('Error saving consultant profile:', error);
//     res.status(500).json({ 
//       success: false,
//       error: 'Failed to save profile',
//       details: error.message 
//     });
//   }
// });

// /* =========================
//    8. Create Stripe Subscription for Consultant
// ========================= */
// app.post('/api/create-subscription', async (req, res) => {
//   try {
//     const { email, paymentMethodId } = req.body;

//     if (!email || !paymentMethodId) {
//       return res.status(400).json({
//         success: false,
//         error: 'Email and payment method are required'
//       });
//     }

//     console.log('💳 Creating subscription for:', email);

//     // Get user and profile
//     const user = await User.findOne({ email, role: 'consultant', isVerified: true });
    
//     if (!user) {
//       return res.status(400).json({
//         success: false,
//         error: 'Consultant not found or not verified'
//       });
//     }

//     let consultantProfile = await ConsultantProfile.findOne({ userId: user._id });

//     if (!consultantProfile) {
//       consultantProfile = await ConsultantProfile.create({
//         userId: user._id,
//         createdAt: new Date(),
//         updatedAt: new Date()
//       });
//     }

//     const CONSULTANT_PRICE_ID = process.env.STRIPE_CONSULTANT_PRICE_ID;

//     if (!CONSULTANT_PRICE_ID) {
//       return res.status(500).json({
//         success: false,
//         error: 'Stripe price ID not configured'
//       });
//     }

//     let customerId = consultantProfile.stripeCustomerId;
    
//     // Create or update Stripe customer
//     if (!customerId) {
//       const customer = await stripe.customers.create({
//         email: user.email,
//         name: consultantProfile.fullName || user.email,
//         payment_method: paymentMethodId,
//         invoice_settings: {
//           default_payment_method: paymentMethodId,
//         },
//       });
//       customerId = customer.id;
//     } else {
//       // Attach payment method to existing customer
//       await stripe.paymentMethods.attach(paymentMethodId, {
//         customer: customerId,
//       });
//       await stripe.customers.update(customerId, {
//         invoice_settings: {
//           default_payment_method: paymentMethodId,
//         },
//       });
//     }

//     // Create subscription
//     const subscription = await stripe.subscriptions.create({
//       customer: customerId,
//       items: [{ price: CONSULTANT_PRICE_ID }],
//       payment_behavior: 'default_incomplete',
//       expand: ['latest_invoice.payment_intent'],
//     });

//     // Calculate subscription end date
//     const subscriptionEndDate = new Date();
//     subscriptionEndDate.setFullYear(subscriptionEndDate.getFullYear() + 1);

//     // Update database
//     await ConsultantProfile.updateOne(
//       { _id: consultantProfile._id },
//       {
//         $set: {
//           stripeCustomerId: customerId,
//           stripeSubscriptionId: subscription.id,
//           subscriptionStatus: 'active',
//           subscriptionEndDate: subscriptionEndDate,
//           updatedAt: new Date()
//         }
//       }
//     );

//     console.log('✅ Subscription created successfully for:', email);

//     res.json({
//       success: true,
//       subscriptionId: subscription.id,
//       clientSecret: subscription.latest_invoice.payment_intent.client_secret,
//       subscriptionStatus: subscription.status,
//       subscriptionEndDate: subscriptionEndDate.toISOString().split('T')[0]
//     });

//   } catch (error) {
//     console.error('Error creating subscription:', error);
//     res.status(500).json({ 
//       success: false,
//       error: 'Failed to create subscription',
//       details: error.message 
//     });
//   }
// });

// /* =========================
//    9. Save Client Signup Data
// ========================= */
// app.post('/api/save-client-signup-data', async (req, res) => {
//   try {
//     const { 
//       companyName, 
//       contactName, 
//       email, 
//       phone, 
//       companySize, 
//       industry, 
//       location, 
//       website 
//     } = req.body;

//     if (!email || !companyName || !contactName) {
//       return res.status(400).json({
//         success: false,
//         error: 'Email, company name, and contact name are required'
//       });
//     }

//     console.log('💾 Saving client signup data for:', email);

//     // Get user
//     const user = await User.findOne({ email, role: 'client' });

//     if (!user) {
//       return res.status(400).json({
//         success: false,
//         error: 'Client not found'
//       });
//     }

//     // Check if profile exists
//     let clientProfile = await ClientProfile.findOne({ userId: user._id });

//     if (!clientProfile) {
//       // Create profile with signup data
//       await ClientProfile.create({
//         userId: user._id,
//         companyName,
//         contactName,
//         phone: phone || null,
//         companySize,
//         industry,
//         location,
//         website: website || null,
//         createdAt: new Date(),
//         updatedAt: new Date()
//       });
//     } else {
//       // Update existing profile
//       await ClientProfile.updateOne(
//         { _id: clientProfile._id },
//         {
//           $set: {
//             companyName,
//             contactName,
//             phone: phone || null,
//             companySize,
//             industry,
//             location,
//             website: website || null,
//             updatedAt: new Date()
//           }
//         }
//       );
//     }

//     console.log('✅ Client signup data saved for:', email);

//     res.json({
//       success: true,
//       message: 'Client signup data saved successfully'
//     });

//   } catch (error) {
//     console.error('Error saving client signup data:', error);
//     res.status(500).json({ 
//       success: false,
//       error: 'Failed to save signup data',
//       details: error.message 
//     });
//   }
// });

// /* =========================
//    10. Get Client Signup Data
// ========================= */
// app.get('/api/get-client-signup-data', async (req, res) => {
//   try {
//     const { email } = req.query;

//     if (!email) {
//       return res.status(400).json({
//         success: false,
//         error: 'Email is required'
//       });
//     }

//     console.log('🔍 Fetching client signup data for email:', email);

//     // Get user and profile data
//     const user = await User.findOne({ email, role: 'client' });

//     if (!user) {
//       console.log('❌ Client not found for email:', email);
//       return res.status(404).json({
//         success: false,
//         error: 'Client not found'
//       });
//     }

//     console.log('✅ Client found:', { id: user._id, email: user.email });

//     // Get profile
//     const clientProfile = await ClientProfile.findOne({ userId: user._id });

//     // Return signup data
//     const responseData = {
//       success: true,
//       data: {
//         companyName: clientProfile?.companyName || '',
//         contactName: clientProfile?.contactName || '',
//         email: user.email,
//         phone: clientProfile?.phone || '',
//         companySize: clientProfile?.companySize || '',
//         industry: clientProfile?.industry || '',
//         location: clientProfile?.location || '',
//         website: clientProfile?.website || ''
//       }
//     };

//     console.log('📤 Returning client signup data:', responseData);
//     res.json(responseData);

//   } catch (error) {
//     console.error('Error fetching client signup data:', error);
//     res.status(500).json({ 
//       success: false,
//       error: 'Failed to fetch signup data',
//       details: error.message 
//     });
//   }
// });

// /* =========================
//    11. Save Client Profile
// ========================= */
// app.post('/api/save-client-profile', async (req, res) => {
//   try {
//     const { 
//       email, company_name, contact_name, contact_title, 
//       phone, website, company_size, industry, location, 
//       company_description 
//     } = req.body;

//     if (!email || !company_name) {
//       return res.status(400).json({
//         success: false,
//         error: 'Email and company name are required'
//       });
//     }

//     console.log('💾 Saving client profile for:', email);

//     // Get user
//     const user = await User.findOne({ email, role: 'client', isVerified: true });

//     if (!user) {
//       return res.status(400).json({
//         success: false,
//         error: 'Client not found or not verified'
//       });
//     }

//     // Check if profile exists
//     let clientProfile = await ClientProfile.findOne({ userId: user._id });

//     if (!clientProfile) {
//       await ClientProfile.create({
//         userId: user._id,
//         companyName: company_name,
//         contactName: contact_name || null,
//         contactTitle: contact_title || null,
//         phone: phone || null,
//         website: website || null,
//         companySize: company_size || null,
//         industry: industry || null,
//         location: location || null,
//         companyDescription: company_description || null,
//         createdAt: new Date(),
//         updatedAt: new Date()
//       });
//     } else {
//       await ClientProfile.updateOne(
//         { _id: clientProfile._id },
//         {
//           $set: {
//             companyName: company_name,
//             contactName: contact_name || null,
//             contactTitle: contact_title || null,
//             phone: phone || null,
//             website: website || null,
//             companySize: company_size || null,
//             industry: industry || null,
//             location: location || null,
//             companyDescription: company_description || null,
//             updatedAt: new Date()
//           }
//         }
//       );
//     }

//     console.log('✅ Client profile saved successfully for:', email);

//     res.json({
//       success: true,
//       message: 'Client profile saved successfully'
//     });

//   } catch (error) {
//     console.error('Error saving client profile:', error);
//     res.status(500).json({ 
//       success: false,
//       error: 'Failed to save profile',
//       details: error.message 
//     });
//   }
// });

// /* =========================
//    12. Create Client Request
// ========================= */
// app.post('/api/create-client-request', async (req, res) => {
//   try {
//     const { 
//       email, 
//       position_id, 
//       title, 
//       description, 
//       start_date, 
//       end_date, 
//       budget_type, 
//       budget_amount, 
//       currency,
//       work_country,
//       work_city,
//       work_mode 
//     } = req.body;

//     if (!email || !position_id || !title) {
//       return res.status(400).json({
//         success: false,
//         error: 'Email, position, and title are required'
//       });
//     }

//     console.log('📝 Creating client request for:', email);

//     // Get client profile
//     const user = await User.findOne({ email, role: 'client', isVerified: true });
    
//     if (!user) {
//       return res.status(400).json({
//         success: false,
//         error: 'Client not found'
//       });
//     }

//     const clientProfile = await ClientProfile.findOne({ userId: user._id });

//     if (!clientProfile) {
//       return res.status(400).json({
//         success: false,
//         error: 'Client profile not found'
//       });
//     }

//     // Create request
//     const clientRequest = await ClientRequest.create({
//       clientProfileId: clientProfile._id,
//       positionId: position_id,
//       title,
//       description: description || null,
//       startDate: start_date ? new Date(start_date) : null,
//       endDate: end_date ? new Date(end_date) : null,
//       budgetType: budget_type || 'daily',
//       budgetAmount: budget_amount || null,
//       currency: currency || 'EUR',
//       workCountry: work_country || null,
//       workCity: work_city || null,
//       workMode: work_mode || 'remote',
//       status: 'submitted',
//       createdAt: new Date(),
//       updatedAt: new Date()
//     });

//     console.log('✅ Client request created with ID:', clientRequest._id);

//     // Trigger matching algorithm (async)
//     setTimeout(async () => {
//       try {
//         await generateMatchSuggestions(clientRequest._id);
//       } catch (matchError) {
//         console.error('Error generating matches:', matchError);
//       }
//     }, 1000);

//     res.json({
//       success: true,
//       requestId: clientRequest._id,
//       message: 'Request created successfully'
//     });

//   } catch (error) {
//     console.error('Error creating client request:', error);
//     res.status(500).json({ 
//       success: false,
//       error: 'Failed to create request',
//       details: error.message 
//     });
//   }
// });

// /* =========================
//    13. Generate Match Suggestions
// ========================= */
// async function generateMatchSuggestions(requestId) {
//   try {
//     // Get request details
//     const request = await ClientRequest.findById(requestId)
//       .populate('positionId')
//       .populate({
//         path: 'clientProfileId',
//         populate: { path: 'userId' }
//       });

//     if (!request) return;

//     // Find matching consultants
//     const consultants = await ConsultantProfile.find({
//       subscriptionStatus: 'active',
//       positions: request.positionId?._id,
//       $or: [
//         { workModePreference: request.workMode },
//         { workModePreference: 'hybrid' }
//       ]
//     }).populate('userId');

//     console.log(`Found ${consultants.length} potential consultants for request ${requestId}`);

//     // Check availability for each consultant
//     for (const consultant of consultants) {
//       // Simple availability check
//       let isAvailable = true;
      
//       if (request.startDate && request.endDate) {
//         const hasAvailability = consultant.availability.some(a => 
//           a.startDate && a.endDate &&
//           a.startDate <= request.endDate && 
//           a.endDate >= request.startDate
//         );
//         isAvailable = hasAvailability;
//       }

//       if (isAvailable) {
//         // Calculate match score
//         let matchScore = 70; // Base score
        
//         // Work mode match
//         if (consultant.workModePreference === request.workMode) {
//           matchScore += 15;
//         } else if (consultant.workModePreference === 'hybrid') {
//           matchScore += 10;
//         }
        
//         // Location match bonus (if on-site)
//         if (request.workMode === 'on-site' && 
//             consultant.baseCountry === request.workCountry) {
//           matchScore += 15;
//           if (consultant.baseCity === request.workCity) {
//             matchScore += 10;
//           }
//         }

//         // Travel willingness bonus
//         if (request.workMode === 'on-site' && consultant.travelWillingness) {
//           matchScore += 5;
//         }

//         // Create match suggestion
//         await MatchSuggestion.create({
//           requestId: request._id,
//           consultantProfileId: consultant._id,
//           matchScore,
//           matchReasons: {
//             position_match: true,
//             availability_match: true,
//             subscription_active: true,
//             work_mode_compatible: true,
//             location_match: request.workMode === 'on-site' && consultant.baseCountry === request.workCountry,
//             score_factors: {
//               base_score: 70,
//               work_mode_bonus: consultant.workModePreference === request.workMode ? 15 : 
//                               (consultant.workModePreference === 'hybrid' ? 10 : 0),
//               location_bonus: request.workMode === 'on-site' && consultant.baseCountry === request.workCountry ? 15 : 0,
//               city_bonus: request.workMode === 'on-site' && consultant.baseCity === request.workCity ? 10 : 0,
//               travel_bonus: request.workMode === 'on-site' && consultant.travelWillingness ? 5 : 0
//             }
//           },
//           createdAt: new Date()
//         });
//       }
//     }

//     console.log(`✅ Generated match suggestions for request ${requestId}`);

//   } catch (error) {
//     console.error('Error generating matches:', error);
//   }
// }

// /* =========================
//    14. Admin Endpoints
// ========================= */
// app.get('/api/admin/match-suggestions', async (req, res) => {
//   try {
//     const { request_id, status } = req.query;
    
//     const query = {};
    
//     if (request_id) {
//       query.requestId = request_id;
//     }
    
//     if (status) {
//       query.adminReviewStatus = status;
//     }
    
//     const suggestions = await MatchSuggestion.find(query)
//       .populate({
//         path: 'requestId',
//         populate: {
//           path: 'clientProfileId'
//         }
//       })
//       .populate({
//         path: 'consultantProfileId',
//         populate: { path: 'userId' }
//       })
//       .sort({ matchScore: -1, createdAt: -1 });
    
//     // Format the response
//     const formattedSuggestions = suggestions.map(s => {
//       const suggestionObj = s.toObject();
//       return {
//         ...suggestionObj,
//         request_title: s.requestId?.title,
//         work_mode: s.requestId?.workMode,
//         work_city: s.requestId?.workCity,
//         work_country: s.requestId?.workCountry,
//         consultant_id: s.consultantProfileId?._id,
//         consultant_name: s.consultantProfileId?.fullName,
//         consultant_email: s.consultantProfileId?.userId?.email,
//         client_company: s.requestId?.clientProfileId?.companyName
//       };
//     });
    
//     res.json({
//       success: true,
//       count: formattedSuggestions.length,
//       suggestions: formattedSuggestions
//     });
    
//   } catch (error) {
//     console.error('Error fetching match suggestions:', error);
//     res.status(500).json({ 
//       success: false, 
//       error: 'Database error' 
//     });
//   }
// });

// app.put('/api/admin/update-match-status', async (req, res) => {
//   try {
//     const { match_id, status, admin_notes } = req.body;
    
//     if (!match_id || !status) {
//       return res.status(400).json({ 
//         success: false, 
//         error: 'Match ID and status are required' 
//       });
//     }
    
//     // Get admin ID
//     const admin = await User.findOne({ role: 'admin' });
    
//     if (!admin) {
//       return res.status(400).json({ 
//         success: false, 
//         error: 'Admin not found' 
//       });
//     }
    
//     const match = await MatchSuggestion.findById(match_id);
    
//     if (!match) {
//       return res.status(404).json({ 
//         success: false, 
//         error: 'Match not found' 
//       });
//     }
    
//     await MatchSuggestion.updateOne(
//       { _id: match_id },
//       {
//         $set: {
//           adminReviewStatus: status,
//           adminNotes: admin_notes || null,
//           reviewedByAdminId: admin._id,
//           reviewedAt: new Date()
//         }
//       }
//     );
    
//     res.json({ 
//       success: true, 
//       message: 'Status updated successfully' 
//     });
    
//   } catch (error) {
//     console.error('Error updating match status:', error);
//     res.status(500).json({ 
//       success: false, 
//       error: 'Database error' 
//     });
//   }
// });

// app.get('/api/admin/requests', async (req, res) => {
//   try {
//     const { status } = req.query;
    
//     const query = {};
    
//     if (status) {
//       query.status = status;
//     }
    
//     const requests = await ClientRequest.find(query)
//       .populate('positionId')
//       .populate('clientProfileId')
//       .sort({ createdAt: -1 });
    
//     // Get match counts for each request
//     const requestsWithCounts = await Promise.all(requests.map(async (request) => {
//       const matchCount = await MatchSuggestion.countDocuments({ requestId: request._id });
//       const requestObj = request.toObject();
//       return {
//         ...requestObj,
//         position_name: request.positionId?.name,
//         company_name: request.clientProfileId?.companyName,
//         contact_name: request.clientProfileId?.contactName,
//         phone: request.clientProfileId?.phone,
//         match_count: matchCount
//       };
//     }));
    
//     res.json({
//       success: true,
//       count: requestsWithCounts.length,
//       requests: requestsWithCounts
//     });
    
//   } catch (error) {
//     console.error('Error fetching requests:', error);
//     res.status(500).json({ 
//       success: false, 
//       error: 'Database error' 
//     });
//   }
// });

// app.get('/api/admin/consultants', async (req, res) => {
//   try {
//     const { status } = req.query;
    
//     const query = {};
    
//     if (status) {
//       query.subscriptionStatus = status;
//     }
    
//     const consultants = await ConsultantProfile.find(query)
//       .populate('userId')
//       .populate('positions')
//       .sort({ createdAt: -1 });
    
//     // Get match counts for each consultant
//     const consultantsWithCounts = await Promise.all(consultants.map(async (consultant) => {
//       const matchCount = await MatchSuggestion.countDocuments({ consultantProfileId: consultant._id });
//       const consultantObj = consultant.toObject();
//       return {
//         ...consultantObj,
//         email: consultant.userId?.email,
//         user_created: consultant.userId?.createdAt,
//         positions: consultant.positions?.map(p => p.name).join(', '),
//         match_count: matchCount
//       };
//     }));
    
//     res.json({
//       success: true,
//       count: consultantsWithCounts.length,
//       consultants: consultantsWithCounts
//     });
    
//   } catch (error) {
//     console.error('Error fetching consultants:', error);
//     res.status(500).json({ 
//       success: false, 
//       error: 'Database error' 
//     });
//   }
// });

// app.get('/api/admin/clients', async (req, res) => {
//   try {
//     const query = {};
    
//     const clients = await ClientProfile.find(query)
//       .populate('userId')
//       .sort({ createdAt: -1 });
    
//     // Get request counts for each client
//     const clientsWithCounts = await Promise.all(clients.map(async (client) => {
//       const requestCount = await ClientRequest.countDocuments({ clientProfileId: client._id });
//       const clientObj = client.toObject();
//       return {
//         ...clientObj,
//         email: client.userId?.email,
//         user_created: client.userId?.createdAt,
//         is_verified: client.userId?.isVerified,
//         request_count: requestCount
//       };
//     }));
    
//     res.json({
//       success: true,
//       count: clientsWithCounts.length,
//       clients: clientsWithCounts
//     });
    
//   } catch (error) {
//     console.error('Error fetching clients:', error);
//     res.status(500).json({ 
//       success: false, 
//       error: 'Database error' 
//     });
//   }
// });

// app.post('/api/admin/verify-consultant', async (req, res) => {
//   try {
//     const { consultantId } = req.body;
    
//     if (!consultantId) {
//       return res.status(400).json({ 
//         success: false, 
//         error: 'Consultant ID is required' 
//       });
//     }
    
//     // Get consultant profile
//     const consultantProfile = await ConsultantProfile.findById(consultantId);
    
//     if (!consultantProfile) {
//       return res.status(404).json({ 
//         success: false, 
//         error: 'Consultant not found' 
//       });
//     }
    
//     // Update user verification
//     await User.updateOne(
//       { _id: consultantProfile.userId },
//       { $set: { isVerified: true } }
//     );
    
//     console.log(`✅ Admin verified consultant ID: ${consultantId}`);
    
//     res.json({ 
//       success: true, 
//       message: 'Consultant verified successfully' 
//     });
    
//   } catch (error) {
//     console.error('Error verifying consultant:', error);
//     res.status(500).json({ 
//       success: false, 
//       error: 'Database error' 
//     });
//   }
// });

// app.put('/api/admin/update-request-status', async (req, res) => {
//   try {
//     const { request_id, status } = req.body;
    
//     if (!request_id || !status) {
//       return res.status(400).json({ 
//         success: false, 
//         error: 'Request ID and status are required' 
//       });
//     }
    
//     // Validate status
//     const validStatuses = ['submitted', 'under_review', 'contacting', 'shortlist_ready', 'closed'];
//     if (!validStatuses.includes(status)) {
//       return res.status(400).json({ 
//         success: false, 
//         error: 'Invalid status value' 
//       });
//     }
    
//     await ClientRequest.updateOne(
//       { _id: request_id },
//       { $set: { status: status } }
//     );
    
//     // If status is 'under_review', trigger match generation if not already done
//     if (status === 'under_review') {
//       const matchCount = await MatchSuggestion.countDocuments({ requestId: request_id });
      
//       if (matchCount === 0) {
//         setTimeout(() => {
//           generateMatchSuggestions(request_id).catch(console.error);
//         }, 100);
//       }
//     }
    
//     res.json({ 
//       success: true, 
//       message: 'Request status updated successfully' 
//     });
    
//   } catch (error) {
//     console.error('Error updating request status:', error);
//     res.status(500).json({ 
//       success: false, 
//       error: 'Database error' 
//     });
//   }
// });

// app.get('/api/admin/stats', async (req, res) => {
//   try {
//     // Get consultant stats
//     const consultantTotal = await ConsultantProfile.countDocuments();
    
//     // Get verified consultants count
//     const verifiedConsultants = await ConsultantProfile.aggregate([
//       {
//         $lookup: {
//           from: 'users',
//           localField: 'userId',
//           foreignField: '_id',
//           as: 'user'
//         }
//       },
//       {
//         $match: {
//           'user.isVerified': true
//         }
//       },
//       {
//         $count: 'count'
//       }
//     ]);
    
//     const activeSubscriptions = await ConsultantProfile.countDocuments({
//       subscriptionStatus: 'active'
//     });
    
//     // Get client stats
//     const clientTotal = await ClientProfile.countDocuments();
    
//     // Get request stats
//     const requestTotal = await ClientRequest.countDocuments();
//     const pendingRequests = await ClientRequest.countDocuments({
//       status: { $in: ['submitted', 'under_review'] }
//     });
    
//     // Get match stats
//     const matchTotal = await MatchSuggestion.countDocuments();
//     const activeMatches = await MatchSuggestion.countDocuments({
//       adminReviewStatus: { $in: ['shortlisted', 'contacted'] }
//     });
    
//     // Calculate revenue
//     const revenue = activeSubscriptions * 99;
    
//     res.json({
//       success: true,
//       stats: {
//         consultants: {
//           total: consultantTotal,
//           verified: verifiedConsultants[0]?.count || 0,
//           pending: consultantTotal - (verifiedConsultants[0]?.count || 0),
//           activeSubscriptions
//         },
//         clients: {
//           total: clientTotal
//         },
//         requests: {
//           total: requestTotal,
//           pending: pendingRequests
//         },
//         matches: {
//           total: matchTotal,
//           active: activeMatches
//         },
//         revenue: revenue,
//         monthlyGrowth: 15
//       }
//     });
    
//   } catch (error) {
//     console.error('Error fetching admin stats:', error);
//     res.status(500).json({ 
//       success: false, 
//       error: 'Database error' 
//     });
//   }
// });

// app.get('/api/admin/consultant/:id', async (req, res) => {
//   try {
//     const { id } = req.params;
    
//     const consultant = await ConsultantProfile.findById(id)
//       .populate('userId')
//       .populate('positions');
    
//     if (!consultant) {
//       return res.status(404).json({ 
//         success: false, 
//         error: 'Consultant not found' 
//       });
//     }
    
//     // Get match count
//     const matchCount = await MatchSuggestion.countDocuments({ consultantProfileId: id });
    
//     const consultantData = {
//       ...consultant.toObject(),
//       email: consultant.userId?.email,
//       user_created: consultant.userId?.createdAt,
//       is_verified: consultant.userId?.isVerified,
//       positions: consultant.positions?.map(p => p.name).join(', '),
//       match_count: matchCount,
//       availability_count: consultant.availability?.length || 0
//     };
    
//     res.json({
//       success: true,
//       consultant: consultantData
//     });
    
//   } catch (error) {
//     console.error('Error fetching consultant details:', error);
//     res.status(500).json({ 
//       success: false, 
//       error: 'Database error' 
//     });
//   }
// });

// app.get('/api/admin/request/:id', async (req, res) => {
//   try {
//     const { id } = req.params;
    
//     const request = await ClientRequest.findById(id)
//       .populate('positionId')
//       .populate('clientProfileId');
    
//     if (!request) {
//       return res.status(404).json({ 
//         success: false, 
//         error: 'Request not found' 
//       });
//     }
    
//     // Get matches for this request
//     const matches = await MatchSuggestion.find({ requestId: id })
//       .populate({
//         path: 'consultantProfileId',
//         populate: { path: 'userId' }
//       })
//       .sort({ matchScore: -1 });
    
//     const matchesData = matches.map(m => {
//       const matchObj = m.toObject();
//       return {
//         ...matchObj,
//         consultant_name: m.consultantProfileId?.fullName,
//         consultant_city: m.consultantProfileId?.baseCity,
//         consultant_country: m.consultantProfileId?.baseCountry,
//         consultant_email: m.consultantProfileId?.userId?.email
//       };
//     });
    
//     const requestData = {
//       ...request.toObject(),
//       position_name: request.positionId?.name,
//       company_name: request.clientProfileId?.companyName,
//       contact_name: request.clientProfileId?.contactName,
//       phone: request.clientProfileId?.phone,
//       client_location: request.clientProfileId?.location,
//       match_count: matchesData.length,
//       matches: matchesData
//     };
    
//     res.json({
//       success: true,
//       request: requestData
//     });
    
//   } catch (error) {
//     console.error('Error fetching request details:', error);
//     res.status(500).json({ 
//       success: false, 
//       error: 'Database error' 
//     });
//   }
// });

// /* =========================
//    15. User Dashboard Data
// ========================= */
// app.get('/api/user/dashboard/:email', async (req, res) => {
//   try {
//     const { email } = req.params;
    
//     // Get user
//     const user = await User.findOne({ email, isVerified: true });
    
//     if (!user) {
//       return res.status(404).json({ 
//         success: false, 
//         error: 'User not found' 
//       });
//     }
    
//     let data = { user: { email: user.email, role: user.role } };
    
//     if (user.role === 'consultant') {
//       // Consultant dashboard data
//       const consultantProfile = await ConsultantProfile.findOne({ userId: user._id })
//         .populate('positions');
      
//       const matches = await MatchSuggestion.find({ consultantProfileId: consultantProfile?._id })
//         .populate({
//           path: 'requestId',
//           populate: { path: 'clientProfileId' }
//         })
//         .sort({ createdAt: -1 })
//         .limit(10);
      
//       const matchesData = matches.map(m => {
//         const matchObj = m.toObject();
//         return {
//           ...matchObj,
//           request_title: m.requestId?.title,
//           work_mode: m.requestId?.workMode,
//           work_city: m.requestId?.workCity,
//           work_country: m.requestId?.workCountry,
//           company_name: m.requestId?.clientProfileId?.companyName
//         };
//       });
      
//       data.profile = consultantProfile || null;
//       data.matches = matchesData;
//       data.matchCount = matchesData.length;
      
//     } else if (user.role === 'client') {
//       // Client dashboard data
//       const clientProfile = await ClientProfile.findOne({ userId: user._id });
      
//       const requests = await ClientRequest.find({ clientProfileId: clientProfile?._id })
//         .populate('positionId')
//         .sort({ createdAt: -1 });
      
//       const requestsData = await Promise.all(requests.map(async (request) => {
//         const matchCount = await MatchSuggestion.countDocuments({ requestId: request._id });
//         const requestObj = request.toObject();
//         return {
//           ...requestObj,
//           position_name: request.positionId?.name,
//           match_count: matchCount
//         };
//       }));
      
//       data.profile = clientProfile || null;
//       data.requests = requestsData;
//       data.requestCount = requestsData.length;
//     }
    
//     res.json({ 
//       success: true, 
//       data 
//     });
    
//   } catch (error) {
//     console.error('Error fetching dashboard data:', error);
//     res.status(500).json({ 
//       success: false, 
//       error: 'Database error' 
//     });
//   }
// });

// /* =========================
//    16. Check Email Status
// ========================= */
// app.get('/api/check-email-status/:email', async (req, res) => {
//   try {
//     const { email } = req.params;

//     const user = await User.findOne({ email });

//     if (!user) {
//       return res.json({
//         email,
//         exists: false,
//         is_verified: false
//       });
//     }

//     let subscription_status = null;
//     if (user.role === 'consultant') {
//       const consultantProfile = await ConsultantProfile.findOne({ userId: user._id });
//       subscription_status = consultantProfile?.subscriptionStatus;
//     }

//     const response = {
//       email: user.email,
//       exists: true,
//       is_verified: user.isVerified,
//       role: user.role,
//       subscription_status
//     };

//     res.json(response);

//   } catch (error) {
//     console.error('Error checking email status:', error);
//     res.status(500).json({ 
//       success: false,
//       error: 'Failed to check status' 
//     });
//   }
// });

// /* =========================
//    17. Get Positions List
// ========================= */
// app.get('/api/positions', async (req, res) => {
//   try {
//     const positions = await Position.find({ isActive: true }).sort({ name: 1 });
    
//     res.json({
//       success: true,
//       count: positions.length,
//       positions
//     });
    
//   } catch (error) {
//     console.error('Error fetching positions:', error);
//     res.status(500).json({ 
//       success: false, 
//       error: 'Database error' 
//     });
//   }
// });

// /* =========================
//    18. Stripe Webhook
// ========================= */
// app.post('/api/stripe-webhook', express.raw({type: 'application/json'}), async (req, res) => {
//   const sig = req.headers['stripe-signature'];
//   let event;

//   try {
//     event = stripe.webhooks.constructEvent(
//       req.body,
//       sig,
//       process.env.STRIPE_WEBHOOK_SECRET
//     );
//   } catch (err) {
//     console.error('❌ Webhook signature verification failed:', err.message);
//     return res.status(400).send(`Webhook Error: ${err.message}`);
//   }

//   try {
//     switch (event.type) {
//       case 'customer.subscription.created':
//       case 'customer.subscription.updated':
//         const subscription = event.data.object;
//         await ConsultantProfile.updateOne(
//           { stripeSubscriptionId: subscription.id },
//           {
//             $set: {
//               subscriptionStatus: subscription.status,
//               subscriptionEndDate: new Date(subscription.current_period_end * 1000)
//             }
//           }
//         );
//         console.log(`✅ Updated subscription ${subscription.id} to ${subscription.status}`);
//         break;

//       case 'customer.subscription.deleted':
//         const deletedSubscription = event.data.object;
//         await ConsultantProfile.updateOne(
//           { stripeSubscriptionId: deletedSubscription.id },
//           { $set: { subscriptionStatus: 'canceled' } }
//         );
//         console.log(`✅ Marked subscription ${deletedSubscription.id} as canceled`);
//         break;

//       case 'invoice.payment_succeeded':
//         const invoice = event.data.object;
//         console.log(`✅ Payment succeeded for invoice ${invoice.id}`);
//         break;

//       case 'invoice.payment_failed':
//         const failedInvoice = event.data.object;
//         console.log(`❌ Payment failed for invoice ${failedInvoice.id}`);
//         if (failedInvoice.subscription) {
//           await ConsultantProfile.updateOne(
//             { stripeSubscriptionId: failedInvoice.subscription },
//             { $set: { subscriptionStatus: 'past_due' } }
//           );
//         }
//         break;
//     }

//     res.json({ received: true });
//   } catch (error) {
//     console.error('Error processing webhook:', error);
//     res.status(500).json({ error: 'Webhook processing failed' });
//   }
// });

// /* =========================
//    404 Handler
// ========================= */
// app.use((req, res) => {
//   res.status(404).json({ 
//     success: false, 
//     error: 'Endpoint not found' 
//   });
// });

// /* =========================
//    Error Handler
// ========================= */
// app.use((err, req, res, next) => {
//   console.error('❌ Unhandled error:', err);
  
//   const statusCode = err.statusCode || 500;
//   const message = process.env.NODE_ENV === 'production' 
//     ? 'Internal server error' 
//     : err.message;
  
//   res.status(statusCode).json({ 
//     success: false, 
//     error: message,
//     stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
//   });
// });

// /* =========================
//    Graceful Shutdown
// ========================= */
// let server;

// process.on('SIGTERM', gracefulShutdown);
// process.on('SIGINT', gracefulShutdown);

// async function gracefulShutdown(signal) {
//   console.log(`\n⚠️ Received ${signal}, starting graceful shutdown...`);
  
//   try {
//     await mongoose.connection.close();
//     console.log('✅ MongoDB connection closed');
    
//     if (server) {
//       server.close(() => {
//         console.log('✅ HTTP server closed');
//         process.exit(0);
//       });
//     } else {
//       process.exit(0);
//     }
//   } catch (error) {
//     console.error('❌ Error during graceful shutdown:', error);
//     process.exit(1);
//   }
// }

// /* =========================
//    Start Server
// ========================= */
// const PORT = process.env.PORT || 5000;

// server = app.listen(PORT, async () => {
//   console.log('\n🚀 ==================================');
//   console.log(`🚀 Web Consultant Hub API starting on port ${PORT}...`);
//   console.log(`📁 Environment: ${process.env.NODE_ENV || 'development'}`);
//   console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
//   console.log('=====================================\n');
  
//   const dbConnected = await connectToMongoDB();
  
//   if (dbConnected) {
//     await initializeDatabase();
//     console.log('\n✅ Server is fully initialized and ready');
//   } else {
//     console.warn('\n⚠️ Server started but database connection failed');
//   }
  
//   console.log('\n✅ Server is running');
//   console.log('📋 Available endpoints:');
//   console.log('   🔐 AUTH ENDPOINTS:');
//   console.log('   POST   /api/check-registration          - Check if email is registered');
//   console.log('   POST   /api/send-magic-link              - Send magic link (registered users only)');
//   console.log('   POST   /api/verify-magic-link            - Verify magic link');
//   console.log('   GET    /api/verify-token                 - Verify session token');
//   console.log('   GET    /api/check-email-status/:email    - Check email status');
//   console.log('');
//   console.log('   👤 CONSULTANT ENDPOINTS:');
//   console.log('   POST   /api/save-consultant-signup-data  - Save consultant signup data');
//   console.log('   GET    /api/get-consultant-signup-data   - Get consultant signup data');
//   console.log('   POST   /api/save-consultant-profile      - Save consultant profile');
//   console.log('   POST   /api/create-subscription          - Create Stripe subscription');
//   console.log('');
//   console.log('   🏢 CLIENT ENDPOINTS:');
//   console.log('   POST   /api/save-client-signup-data      - Save client signup data');
//   console.log('   GET    /api/get-client-signup-data       - Get client signup data');
//   console.log('   POST   /api/save-client-profile          - Save client profile');
//   console.log('   POST   /api/create-client-request        - Create client request');
//   console.log('');
//   console.log('   📊 DASHBOARD ENDPOINTS:');
//   console.log('   GET    /api/user/dashboard/:email        - Get user dashboard data');
//   console.log('   GET    /api/positions                    - Get available positions');
//   console.log('');
//   console.log('   👑 ADMIN ENDPOINTS:');
//   console.log('   GET    /api/admin/match-suggestions      - View match suggestions');
//   console.log('   PUT    /api/admin/update-match-status    - Update match status');
//   console.log('   GET    /api/admin/requests               - View all client requests');
//   console.log('   GET    /api/admin/consultants            - View all consultants');
//   console.log('   GET    /api/admin/clients                - View all clients');
//   console.log('   GET    /api/admin/stats                  - View admin statistics');
//   console.log('   GET    /api/admin/consultant/:id         - Get consultant details');
//   console.log('   GET    /api/admin/request/:id            - Get request details');
//   console.log('   POST   /api/admin/verify-consultant      - Verify consultant');
//   console.log('   PUT    /api/admin/update-request-status  - Update request status');
//   console.log('');
//   console.log('   💳 PAYMENT ENDPOINTS:');
//   console.log('   POST   /api/stripe-webhook               - Stripe webhook handler');
//   console.log('=====================================\n');
// });





require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const crypto = require('crypto');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const SibApiV3Sdk = require('sib-api-v3-sdk');

const app = express();

/* =========================
   Global Error Handlers
========================= */
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
});

/* =========================
   Environment Variables Validation
========================= */
const requiredEnvVars = [
  'MONGODB_URI',
  'FRONTEND_URL',
  'STRIPE_SECRET_KEY',
  'STRIPE_CONSULTANT_PRICE_ID',
  'BREVO_API_KEY',
  'BREVO_SMTP_LOGIN'
];

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingEnvVars.forEach(envVar => console.error(`   - ${envVar}`));
  console.error('Please check your .env file');
  
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  } else {
    console.warn('⚠️ Continuing in development mode with missing env vars');
  }
}

/* =========================
   Middleware
========================= */
app.use(cors({
  origin: [
    process.env.FRONTEND_URL,
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:5000'
  ],
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* =========================
   MongoDB Connection
========================= */
const MONGODB_URI = process.env.MONGODB_URI;

async function connectToMongoDB() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ MongoDB connected successfully');
    console.log(`   Database: ${mongoose.connection.name}`);
    console.log(`   Host: ${mongoose.connection.host}`);
    return true;
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    
    if (error.message.includes('bad auth')) {
      console.error('   🔐 Authentication failed - check your username and password');
    } else if (error.message.includes('getaddrinfo')) {
      console.error('   🌐 Network error - check your internet connection and MongoDB Atlas host');
    } else if (error.message.includes('timed out')) {
      console.error('   ⏱️ Connection timeout - check your network and MongoDB Atlas IP whitelist');
    }
    
    return false;
  }
}

// Handle MongoDB connection events
mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('⚠️ MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
  console.log('✅ MongoDB reconnected');
});

/* =========================
   MongoDB Schemas
========================= */

// User Schema
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  role: { type: String, enum: ['consultant', 'client', 'admin'], required: true },
  isVerified: { type: Boolean, default: false },
  verificationToken: { type: String, default: null },
  verificationTokenExpiresAt: { type: Date, default: null },
  magicLinkToken: { type: String, default: null },
  magicLinkExpiresAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Position Schema
const positionSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String, default: 'Other' },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

// Certificate Sub-schema
const certificateSchema = new mongoose.Schema({
  name: { type: String, default: '' },
  organization: { type: String, default: '' },
  issueDate: { type: Date, default: null },
  expiryDate: { type: Date, default: null },
  certificateUrl: { type: String, default: '' }
});

// Availability Sub-schema
const availabilitySchema = new mongoose.Schema({
  startDate: { type: Date, default: null },
  endDate: { type: Date, default: null },
  startTime: { type: String, default: '' },
  endTime: { type: String, default: '' },
  timezone: { type: String, default: 'UTC' },
  isRecurring: { type: Boolean, default: false },
  recurrencePattern: { type: String, default: '' }
});

// Consultant Profile Schema
const consultantProfileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  fullName: { type: String, default: '' },
  phone: { type: String, default: '' },
  baseCountry: { type: String, default: '' },
  baseCity: { type: String, default: '' },
  workModePreference: { type: String, enum: ['remote', 'on-site', 'hybrid'], default: 'remote' },
  travelWillingness: { type: Boolean, default: false },
  travelRadiusKm: { type: Number, default: null },
  yearsExperience: { type: String, default: '' },
  cvUrl: { type: String, default: '' },
  linkedinUrl: { type: String, default: '' },
  githubUrl: { type: String, default: '' },
  subscriptionStatus: { type: String, enum: ['active', 'inactive', 'canceled', 'past_due'], default: 'inactive' },
  stripeCustomerId: { type: String, default: '' },
  stripeSubscriptionId: { type: String, default: '' },
  subscriptionEndDate: { type: Date, default: null },
  positions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Position' }],
  certificates: [certificateSchema],
  availability: [availabilitySchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Client Profile Schema
const clientProfileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  companyName: { type: String, required: true },
  contactName: { type: String, default: '' },
  contactTitle: { type: String, default: '' },
  phone: { type: String, default: '' },
  website: { type: String, default: '' },
  companySize: { type: String, default: '' },
  industry: { type: String, default: '' },
  location: { type: String, default: '' },
  companyDescription: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Client Request Schema
const clientRequestSchema = new mongoose.Schema({
  clientProfileId: { type: mongoose.Schema.Types.ObjectId, ref: 'ClientProfile', required: true },
  positionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Position' },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  startDate: { type: Date, default: null },
  endDate: { type: Date, default: null },
  budgetType: { type: String, enum: ['daily', 'hourly', 'fixed'], default: 'daily' },
  budgetAmount: { type: Number, default: null },
  currency: { type: String, default: 'EUR' },
  workCountry: { type: String, default: '' },
  workCity: { type: String, default: '' },
  workMode: { type: String, enum: ['remote', 'on-site', 'hybrid'], default: 'remote' },
  status: { type: String, enum: ['submitted', 'under_review', 'contacting', 'shortlist_ready', 'closed'], default: 'submitted' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Match Suggestion Schema
const matchSuggestionSchema = new mongoose.Schema({
  requestId: { type: mongoose.Schema.Types.ObjectId, ref: 'ClientRequest', required: true },
  consultantProfileId: { type: mongoose.Schema.Types.ObjectId, ref: 'ConsultantProfile', required: true },
  matchScore: { type: Number, default: 0 },
  matchReasons: { type: mongoose.Schema.Types.Mixed, default: {} },
  adminReviewStatus: { 
    type: String, 
    enum: ['suggested', 'contacted', 'interested', 'unavailable', 'shortlisted', 'rejected'],
    default: 'suggested'
  },
  adminNotes: { type: String, default: '' },
  reviewedByAdminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
});

// Email Log Schema
const emailLogSchema = new mongoose.Schema({
  recipientEmail: { type: String, required: true },
  emailType: { type: String, default: '' },
  templateId: { type: String, default: '' },
  requestId: { type: mongoose.Schema.Types.ObjectId, ref: 'ClientRequest', default: null },
  consultantProfileId: { type: mongoose.Schema.Types.ObjectId, ref: 'ConsultantProfile', default: null },
  sentAt: { type: Date, default: Date.now },
  status: { type: String, enum: ['sent', 'failed', 'delivered', 'opened'], default: 'sent' },
  errorMessage: { type: String, default: '' },
  initiatedByAdminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
});

// Create Models
const User = mongoose.model('User', userSchema);
const Position = mongoose.model('Position', positionSchema);
const ConsultantProfile = mongoose.model('ConsultantProfile', consultantProfileSchema);
const ClientProfile = mongoose.model('ClientProfile', clientProfileSchema);
const ClientRequest = mongoose.model('ClientRequest', clientRequestSchema);
const MatchSuggestion = mongoose.model('MatchSuggestion', matchSuggestionSchema);
const EmailLog = mongoose.model('EmailLog', emailLogSchema);

/* =========================
   Email Service with Brevo API
========================= */

// Initialize Brevo API client
let defaultClient = SibApiV3Sdk.ApiClient.instance;
let apiKey = defaultClient.authentications['api-key'];
apiKey.apiKey = process.env.BREVO_API_KEY;

let apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

// Test Brevo connection
async function testBrevoConnection() {
  try {
    const accountApi = new SibApiV3Sdk.AccountApi();
    const account = await accountApi.getAccount();
    console.log('✅ Brevo API connection successful');
    console.log(`   Account email: ${account.email}`);
    return true;
  } catch (error) {
    console.error('❌ Brevo API connection failed:', error.message);
    return false;
  }
}

const emailService = {
  sendMagicLinkEmail: async (email, magicLink, userType) => {
    try {
      const roleText = userType === 'consultant' ? 'Consultant' : (userType === 'admin' ? 'Admin' : 'Client');
      
      let sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
      
      sendSmtpEmail.sender = {
        name: "Web Consultant Hub",
        email: process.env.BREVO_SMTP_LOGIN
      };
      
      sendSmtpEmail.to = [{ 
        email: email,
        name: roleText
      }];
      
      sendSmtpEmail.subject = `Your Magic Link for Web Consultant Hub`;
      
      sendSmtpEmail.htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Magic Link Login</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Web Consultant Hub</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0;">${roleText} Login</p>
          </div>
          
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #ddd; border-top: none;">
            <h2 style="color: #444; margin-top: 0;">Your Magic Login Link</h2>
            
            <p>Hello,</p>
            
            <p>You requested a magic link to sign in to your Web Consultant Hub ${roleText} account.</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${magicLink}" style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Sign In to Your Account</a>
            </div>
            
            <p style="color: #666; font-size: 14px;">This link will expire in 15 minutes and can only be used once.</p>
            
            <p style="color: #666; font-size: 14px;">If you didn't request this, you can safely ignore this email.</p>
            
            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
            
            <p style="color: #999; font-size: 12px; text-align: center;">
              &copy; ${new Date().getFullYear()} Web Consultant Hub. All rights reserved.<br>
              This is an automated message, please do not reply.
            </p>
          </div>
        </body>
        </html>
      `;
      
      sendSmtpEmail.textContent = `
        Your Magic Link for Web Consultant Hub (${roleText})
        
        Click the link below to sign in:
        ${magicLink}
        
        This link will expire in 15 minutes.
        
        If you didn't request this, please ignore this email.
      `;
      
      const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
      
      console.log(`📧 Email sent via Brevo API to ${email}:`, data.messageId);
      
      return { 
        success: true, 
        messageId: data.messageId 
      };
      
    } catch (error) {
      console.error('❌ Failed to send email via Brevo API:', error);
      if (error.response && error.response.text) {
        console.error('   Error details:', error.response.text);
      }
      throw error;
    }
  }
};

/* =========================
   Initialize Database with Default Data
========================= */
function getPositionCategory(position) {
  if (position.includes('Developer') || position.includes('Engineer')) return 'Development';
  if (position.includes('Designer')) return 'Design';
  if (position.includes('Manager')) return 'Management';
  if (position.includes('Analyst') || position.includes('Scientist')) return 'Data';
  if (position.includes('Consultant')) return 'Consulting';
  if (position.includes('Architect')) return 'Architecture';
  return 'Other';
}

async function initializeDatabase() {
  try {
    console.log('🔄 Initializing database with default data...');

    // Create default admin user if none exists
    const adminEmail = 'admin@webconsultanthub.com';
    const adminExists = await User.findOne({ email: adminEmail });
    
    if (!adminExists) {
      await User.create({
        email: adminEmail,
        role: 'admin',
        isVerified: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log('✅ Default admin user created: admin@webconsultanthub.com');
    }

    // Insert default positions if none exist
    const positionCount = await Position.countDocuments();
    if (positionCount === 0) {
      const defaultPositions = [
        'Web Developer', 'Frontend Developer', 'Backend Developer',
        'Full Stack Developer', 'DevOps Engineer', 'UX/UI Designer',
        'Product Manager', 'Project Manager', 'Scrum Master',
        'Data Analyst', 'Data Scientist', 'Machine Learning Engineer',
        'Cloud Architect', 'Security Engineer', 'Mobile Developer',
        'QA Engineer', 'Technical Lead', 'IT Consultant',
        'Business Analyst', 'Change Manager', 'Digital Transformation Consultant',
        'AI Strategy Consultant', 'ERP Consultant', 'CRM Consultant'
      ];
      
      const positions = defaultPositions.map(name => ({
        name,
        category: getPositionCategory(name),
        isActive: true,
        createdAt: new Date()
      }));
      
      await Position.insertMany(positions);
      console.log(`✅ Added ${defaultPositions.length} default positions`);
    }
    
    console.log('✅ Database initialization completed');
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
  }
}

/* =========================
   Health Check
========================= */
app.get('/', (req, res) => {
  res.json({ 
    message: 'Web Consultant Hub API',
    status: 'running',
    timestamp: new Date().toISOString(),
    version: '1.1.0',
    features: ['consultant-auth', 'client-auth', 'magic-links', 'stripe', 'email']
  });
});

/* =========================
   1. Check Registration Status
========================= */
app.post('/api/check-registration', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    console.log('🔍 Checking registration for email:', email);

    const user = await User.findOne({ email });

    if (!user) {
      return res.json({
        success: true,
        isRegistered: false,
        message: 'Email not registered. Please sign up.'
      });
    }

    let hasProfile = false;
    let profileStatus = 'incomplete';
    
    if (user.role === 'consultant') {
      const consultantProfile = await ConsultantProfile.findOne({ userId: user._id });
      hasProfile = !!consultantProfile;
      
      if (consultantProfile) {
        const basicInfoComplete = !!(consultantProfile.fullName && consultantProfile.phone && consultantProfile.baseCountry);
        const availabilityComplete = consultantProfile.availability && consultantProfile.availability.length > 0;
        const paymentComplete = consultantProfile.subscriptionStatus === 'active';
        
        if (basicInfoComplete && availabilityComplete && paymentComplete) {
          profileStatus = 'complete';
        } else if (basicInfoComplete) {
          profileStatus = 'partial';
        }
      }
    } else if (user.role === 'client') {
      const clientProfile = await ClientProfile.findOne({ userId: user._id });
      hasProfile = !!clientProfile;
      
      if (clientProfile) {
        const basicInfoComplete = !!(clientProfile.companyName && clientProfile.contactName);
        profileStatus = basicInfoComplete ? 'complete' : 'partial';
      }
    } else if (user.role === 'admin') {
      hasProfile = true;
      profileStatus = 'complete';
    }

    res.json({
      success: true,
      isRegistered: true,
      role: user.role,
      isVerified: user.isVerified,
      hasProfile: hasProfile,
      profileStatus: profileStatus,
      message: 'Email is registered'
    });

  } catch (error) {
    console.error('Error checking registration:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to check registration status',
      details: error.message 
    });
  }
});

/* =========================
   2. Send Magic Link
========================= */
app.post('/api/send-magic-link', async (req, res) => {
  try {
    const { email, userType } = req.body;

    if (!email || !userType) {
      return res.status(400).json({
        success: false,
        error: 'Email and userType are required'
      });
    }

    if (!['consultant', 'client', 'admin'].includes(userType)) {
      return res.status(400).json({
        success: false,
        error: 'userType must be either "consultant", "client", or "admin"'
      });
    }

    console.log('🔐 Attempting to send magic link for:', email);

    const existingUser = await User.findOne({ email });

    if (!existingUser) {
      console.log('❌ User not found - registration required:', email);
      return res.status(400).json({
        success: false,
        error: 'Email not registered. Please sign up first.',
        requiresSignup: true
      });
    }

    if (existingUser.role !== userType) {
      console.log('❌ Role mismatch:', { provided: userType, stored: existingUser.role });
      return res.status(400).json({
        success: false,
        error: `This email is registered as a ${existingUser.role}. Please use the correct login type.`,
        registeredRole: existingUser.role
      });
    }

    console.log('✅ Registered user found - sending magic link:', email);

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await User.updateOne(
      { _id: existingUser._id },
      { 
        $set: { 
          magicLinkToken: token, 
          magicLinkExpiresAt: expiresAt,
          updatedAt: new Date()
        } 
      }
    );

    const magicLink = `${process.env.FRONTEND_URL}/auth/verify?token=${token}&email=${encodeURIComponent(email)}&type=${userType}`;

    let emailSent = false;
    let emailError = null;
    
    try {
      await emailService.sendMagicLinkEmail(email, magicLink, userType);
      emailSent = true;
      console.log(`📧 Magic link sent to ${email} (${userType})`);
    } catch (error) {
      emailError = error.message;
      console.warn(`⚠️ Email sending failed for ${email}:`, error.message);
    }

    try {
      await EmailLog.create({
        recipientEmail: email,
        emailType: 'magic_link',
        status: emailSent ? 'sent' : 'failed',
        errorMessage: emailError,
        sentAt: new Date()
      });
    } catch (logError) {
      console.error('Error logging email:', logError);
    }

    let hasProfile = false;
    let profileStatus = null;
    let profileCompletion = {
      basicInfo: false,
      availability: false,
      payment: false
    };

    if (userType === 'consultant') {
      const consultantProfile = await ConsultantProfile.findOne({ userId: existingUser._id });
      hasProfile = !!consultantProfile;
      
      if (consultantProfile) {
        profileCompletion.basicInfo = !!(consultantProfile.fullName && consultantProfile.phone && consultantProfile.baseCountry);
        profileCompletion.availability = consultantProfile.availability && consultantProfile.availability.length > 0;
        profileCompletion.payment = consultantProfile.subscriptionStatus === 'active';
        
        if (profileCompletion.basicInfo && profileCompletion.availability && profileCompletion.payment) {
          profileStatus = 'complete';
        } else if (profileCompletion.basicInfo) {
          profileStatus = 'partial';
        } else {
          profileStatus = 'incomplete';
        }
      } else {
        profileStatus = 'incomplete';
      }
    } else if (userType === 'client') {
      const clientProfile = await ClientProfile.findOne({ userId: existingUser._id });
      hasProfile = !!clientProfile;
      
      if (clientProfile) {
        profileCompletion.basicInfo = !!(clientProfile.companyName && clientProfile.contactName);
        profileStatus = profileCompletion.basicInfo ? 'complete' : 'partial';
      } else {
        profileStatus = 'incomplete';
      }
    } else if (userType === 'admin') {
      hasProfile = true;
      profileStatus = 'complete';
      profileCompletion = { basicInfo: true, availability: true, payment: true };
    }

    res.json({
      success: true,
      message: 'Magic link sent successfully',
      email: email,
      userType: userType,
      isRegistered: true,
      isVerified: existingUser.isVerified,
      hasProfile: hasProfile,
      profileStatus: profileStatus,
      profileCompletion: profileCompletion,
      emailSent: emailSent,
      expiresIn: '15 minutes'
    });

  } catch (error) {
    console.error('Error sending magic link:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to send magic link',
      details: error.message 
    });
  }
});

/* =========================
   3. Verify Magic Link
========================= */
app.post('/api/verify-magic-link', async (req, res) => {
  try {
    const { token, email, userType } = req.body;

    console.log('🔍 Verifying magic link:', { token: token?.substring(0, 10) + '...', email, userType });

    if (!token) {
      console.log('❌ No token provided');
      return res.status(400).json({
        success: false,
        error: 'Token is required'
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      console.log('❌ User not found for email:', email);
      return res.status(400).json({
        success: false,
        error: 'User not found. Please sign up first.',
        requiresSignup: true
      });
    }

    if (user.magicLinkToken !== token) {
      console.log('❌ Invalid token for user:', email);
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }

    if (user.magicLinkExpiresAt < new Date()) {
      console.log('❌ Token expired at:', user.magicLinkExpiresAt);
      return res.status(400).json({
        success: false,
        error: 'Token has expired'
      });
    }

    if (user.role !== userType) {
      console.log('❌ Role mismatch:', { provided: userType, stored: user.role });
      return res.status(400).json({
        success: false,
        error: `This account is registered as a ${user.role}. Please use the correct login type.`
      });
    }

    console.log('✅ User verified:', { id: user._id, email: user.email, role: user.role });

    if (!user.isVerified) {
      await User.updateOne(
        { _id: user._id },
        { 
          $set: { 
            isVerified: true,
            updatedAt: new Date()
          } 
        }
      );
      console.log('✅ User marked as verified');
    }

    await User.updateOne(
      { _id: user._id },
      { 
        $set: { 
          magicLinkToken: null,
          magicLinkExpiresAt: null
        } 
      }
    );

    const sessionToken = crypto.randomBytes(32).toString('hex');

    let profile = null;
    let hasProfile = false;
    let redirectPath = '/';
    let profileCompletion = {
      basicInfo: false,
      availability: false,
      payment: false
    };

    if (user.role === 'consultant') {
      const consultantProfile = await ConsultantProfile.findOne({ userId: user._id });
      hasProfile = !!consultantProfile;
      profile = consultantProfile;
      
      if (consultantProfile) {
        profileCompletion.basicInfo = !!(consultantProfile.fullName && consultantProfile.phone && consultantProfile.baseCountry);
        profileCompletion.availability = consultantProfile.availability && consultantProfile.availability.length > 0;
        profileCompletion.payment = consultantProfile.subscriptionStatus === 'active';
        
        if (!profileCompletion.basicInfo) {
          redirectPath = '/consultant/profile-setup?step=basic';
        } else if (!profileCompletion.availability) {
          redirectPath = '/consultant/profile-setup?step=availability';
        } else if (!profileCompletion.payment) {
          redirectPath = '/consultant/subscription';
        } else {
          redirectPath = '/consultant/dashboard';
        }
      } else {
        redirectPath = '/consultant/profile-setup?step=basic';
      }
    } else if (user.role === 'client') {
      const clientProfile = await ClientProfile.findOne({ userId: user._id });
      hasProfile = !!clientProfile;
      profile = clientProfile;
      
      if (clientProfile) {
        profileCompletion.basicInfo = !!(clientProfile.companyName && clientProfile.contactName);
        redirectPath = '/client/dashboard';
      } else {
        redirectPath = '/client/profile-setup';
      }
    } else if (user.role === 'admin') {
      hasProfile = true;
      redirectPath = '/admin/dashboard';
      profileCompletion = { basicInfo: true, availability: true, payment: true };
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        isVerified: true,
        hasProfile,
        profileCompletion
      },
      token: sessionToken,
      profile,
      redirectTo: redirectPath,
      requiresSignup: false
    });

  } catch (error) {
    console.error('Error verifying magic link:', error);
    res.status(500).json({ 
      success: false,
      error: 'Verification failed',
      details: error.message 
    });
  }
});

/* =========================
   4. Verify Token
========================= */
app.get('/api/verify-token', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        error: 'No token provided' 
      });
    }

    const token = authHeader.split(' ')[1];
    
    res.json({ 
      success: true, 
      message: 'Token is valid' 
    });

  } catch (error) {
    console.error('Token verification error:', error);
    res.status(401).json({ 
      success: false, 
      error: 'Invalid token' 
    });
  }
});

/* =========================
   5. Save Consultant Signup Data
========================= */
app.post('/api/save-consultant-signup-data', async (req, res) => {
  try {
    const { email, fullName, expertise, yearsOfExperience, linkedin, github } = req.body;

    if (!email || !fullName) {
      return res.status(400).json({
        success: false,
        error: 'Email and full name are required'
      });
    }

    console.log('💾 Saving consultant signup data for:', email);

    const user = await User.findOne({ email, role: 'consultant' });

    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'Consultant not found'
      });
    }

    let consultantProfile = await ConsultantProfile.findOne({ userId: user._id });

    if (!consultantProfile) {
      consultantProfile = await ConsultantProfile.create({
        userId: user._id,
        fullName,
        yearsExperience: yearsOfExperience,
        linkedinUrl: linkedin || null,
        githubUrl: github || null,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    } else {
      await ConsultantProfile.updateOne(
        { _id: consultantProfile._id },
        {
          $set: {
            fullName,
            yearsExperience: yearsOfExperience,
            linkedinUrl: linkedin || null,
            githubUrl: github || null,
            updatedAt: new Date()
          }
        }
      );
    }

    if (expertise) {
      const position = await Position.findOne({ name: expertise });
      
      if (position) {
        await ConsultantProfile.updateOne(
          { userId: user._id },
          { $set: { positions: [position._id] } }
        );
      }
    }

    console.log('✅ Consultant signup data saved for:', email);

    res.json({
      success: true,
      message: 'Signup data saved successfully'
    });

  } catch (error) {
    console.error('Error saving consultant signup data:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to save signup data',
      details: error.message 
    });
  }
});

/* =========================
   6. Get Consultant Signup Data
========================= */
app.get('/api/get-consultant-signup-data', async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    console.log('🔍 Fetching signup data for email:', email);

    const user = await User.findOne({ email, role: 'consultant' });

    if (!user) {
      console.log('❌ Consultant not found for email:', email);
      return res.status(404).json({
        success: false,
        error: 'Consultant not found'
      });
    }

    console.log('✅ User found:', { id: user._id, email: user.email });

    const consultantProfile = await ConsultantProfile.findOne({ userId: user._id }).populate('positions');

    let expertise = '';
    if (consultantProfile && consultantProfile.positions && consultantProfile.positions.length > 0) {
      const position = await Position.findById(consultantProfile.positions[0]);
      expertise = position ? position.name : '';
    }

    const responseData = {
      success: true,
      data: {
        fullName: consultantProfile?.fullName || '',
        email: user.email,
        expertise: expertise,
        yearsOfExperience: consultantProfile?.yearsExperience || '',
        linkedin: consultantProfile?.linkedinUrl || '',
        github: consultantProfile?.githubUrl || ''
      }
    };

    console.log('📤 Returning signup data:', responseData);
    res.json(responseData);

  } catch (error) {
    console.error('Error fetching consultant signup data:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch signup data',
      details: error.message 
    });
  }
});

/* =========================
   7. Save Consultant Profile
========================= */
app.post('/api/save-consultant-profile', async (req, res) => {
  try {
    const { email, step, formData } = req.body;

    if (!email || !step) {
      return res.status(400).json({
        success: false,
        error: 'Email and step are required'
      });
    }

    console.log(`💾 Saving consultant profile (step: ${step}) for:`, email);

    const user = await User.findOne({ email, role: 'consultant', isVerified: true });

    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'Consultant not found or not verified'
      });
    }

    if (step === 'profile') {
      const { 
        full_name, phone, base_country, base_city, 
        work_mode, travel_willingness, travel_radius,
        years_experience, linkedin, github, positions
      } = formData;
      
      let consultantProfile = await ConsultantProfile.findOne({ userId: user._id });

      if (!consultantProfile) {
        consultantProfile = await ConsultantProfile.create({
          userId: user._id,
          fullName: full_name,
          phone: phone,
          baseCountry: base_country,
          baseCity: base_city,
          workModePreference: work_mode,
          travelWillingness: travel_willingness || false,
          travelRadiusKm: travel_radius || null,
          yearsExperience: years_experience,
          linkedinUrl: linkedin || null,
          githubUrl: github || null,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      } else {
        await ConsultantProfile.updateOne(
          { _id: consultantProfile._id },
          {
            $set: {
              fullName: full_name,
              phone: phone,
              baseCountry: base_country,
              baseCity: base_city,
              workModePreference: work_mode,
              travelWillingness: travel_willingness || false,
              travelRadiusKm: travel_radius || null,
              yearsExperience: years_experience,
              linkedinUrl: linkedin || null,
              githubUrl: github || null,
              updatedAt: new Date()
            }
          }
        );
      }

      if (positions && Array.isArray(positions) && positions.length > 0) {
        const positionIds = [];
        for (const positionName of positions) {
          const position = await Position.findOne({ name: positionName });
          if (position) {
            positionIds.push(position._id);
          }
        }
        await ConsultantProfile.updateOne(
          { userId: user._id },
          { $set: { positions: positionIds } }
        );
      }

    } else if (step === 'availability') {
      const { availability_blocks } = formData;
      
      if (availability_blocks && Array.isArray(availability_blocks)) {
        const consultantProfile = await ConsultantProfile.findOne({ userId: user._id });

        if (consultantProfile) {
          const availability = availability_blocks.map(block => ({
            startDate: new Date(block.start_date),
            endDate: new Date(block.end_date),
            startTime: block.start_time,
            endTime: block.end_time,
            timezone: block.timezone || 'UTC'
          }));
          
          await ConsultantProfile.updateOne(
            { _id: consultantProfile._id },
            { $set: { availability: availability } }
          );
        }
      }
    }

    console.log(`✅ Profile ${step} saved successfully for:`, email);

    res.json({
      success: true,
      message: `Profile ${step} saved successfully`
    });

  } catch (error) {
    console.error('Error saving consultant profile:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to save profile',
      details: error.message 
    });
  }
});

/* =========================
   8. Create Stripe Subscription
========================= */
app.post('/api/create-subscription', async (req, res) => {
  try {
    const { email, paymentMethodId } = req.body;

    if (!email || !paymentMethodId) {
      return res.status(400).json({
        success: false,
        error: 'Email and payment method are required'
      });
    }

    console.log('💳 Creating subscription for:', email);

    const user = await User.findOne({ email, role: 'consultant', isVerified: true });
    
    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'Consultant not found or not verified'
      });
    }

    let consultantProfile = await ConsultantProfile.findOne({ userId: user._id });

    if (!consultantProfile) {
      consultantProfile = await ConsultantProfile.create({
        userId: user._id,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    const CONSULTANT_PRICE_ID = process.env.STRIPE_CONSULTANT_PRICE_ID;

    if (!CONSULTANT_PRICE_ID) {
      return res.status(500).json({
        success: false,
        error: 'Stripe price ID not configured'
      });
    }

    let customerId = consultantProfile.stripeCustomerId;
    
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: consultantProfile.fullName || user.email,
        payment_method: paymentMethodId,
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });
      customerId = customer.id;
    } else {
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId,
      });
      await stripe.customers.update(customerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });
    }

    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: CONSULTANT_PRICE_ID }],
      payment_behavior: 'default_incomplete',
      expand: ['latest_invoice.payment_intent'],
    });

    const subscriptionEndDate = new Date();
    subscriptionEndDate.setFullYear(subscriptionEndDate.getFullYear() + 1);

    await ConsultantProfile.updateOne(
      { _id: consultantProfile._id },
      {
        $set: {
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscription.id,
          subscriptionStatus: 'active',
          subscriptionEndDate: subscriptionEndDate,
          updatedAt: new Date()
        }
      }
    );

    console.log('✅ Subscription created successfully for:', email);

    res.json({
      success: true,
      subscriptionId: subscription.id,
      clientSecret: subscription.latest_invoice.payment_intent.client_secret,
      subscriptionStatus: subscription.status,
      subscriptionEndDate: subscriptionEndDate.toISOString().split('T')[0]
    });

  } catch (error) {
    console.error('Error creating subscription:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to create subscription',
      details: error.message 
    });
  }
});

/* =========================
   9. Save Client Signup Data
========================= */
app.post('/api/save-client-signup-data', async (req, res) => {
  try {
    const { 
      companyName, 
      contactName, 
      email, 
      phone, 
      companySize, 
      industry, 
      location, 
      website 
    } = req.body;

    if (!email || !companyName || !contactName) {
      return res.status(400).json({
        success: false,
        error: 'Email, company name, and contact name are required'
      });
    }

    console.log('💾 Saving client signup data for:', email);

    const user = await User.findOne({ email, role: 'client' });

    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'Client not found'
      });
    }

    let clientProfile = await ClientProfile.findOne({ userId: user._id });

    if (!clientProfile) {
      await ClientProfile.create({
        userId: user._id,
        companyName,
        contactName,
        phone: phone || null,
        companySize,
        industry,
        location,
        website: website || null,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    } else {
      await ClientProfile.updateOne(
        { _id: clientProfile._id },
        {
          $set: {
            companyName,
            contactName,
            phone: phone || null,
            companySize,
            industry,
            location,
            website: website || null,
            updatedAt: new Date()
          }
        }
      );
    }

    console.log('✅ Client signup data saved for:', email);

    res.json({
      success: true,
      message: 'Client signup data saved successfully'
    });

  } catch (error) {
    console.error('Error saving client signup data:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to save signup data',
      details: error.message 
    });
  }
});

/* =========================
   10. Get Client Signup Data
========================= */
app.get('/api/get-client-signup-data', async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    console.log('🔍 Fetching client signup data for email:', email);

    const user = await User.findOne({ email, role: 'client' });

    if (!user) {
      console.log('❌ Client not found for email:', email);
      return res.status(404).json({
        success: false,
        error: 'Client not found'
      });
    }

    console.log('✅ Client found:', { id: user._id, email: user.email });

    const clientProfile = await ClientProfile.findOne({ userId: user._id });

    const responseData = {
      success: true,
      data: {
        companyName: clientProfile?.companyName || '',
        contactName: clientProfile?.contactName || '',
        email: user.email,
        phone: clientProfile?.phone || '',
        companySize: clientProfile?.companySize || '',
        industry: clientProfile?.industry || '',
        location: clientProfile?.location || '',
        website: clientProfile?.website || ''
      }
    };

    console.log('📤 Returning client signup data:', responseData);
    res.json(responseData);

  } catch (error) {
    console.error('Error fetching client signup data:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch signup data',
      details: error.message 
    });
  }
});

/* =========================
   11. Save Client Profile
========================= */
app.post('/api/save-client-profile', async (req, res) => {
  try {
    const { 
      email, company_name, contact_name, contact_title, 
      phone, website, company_size, industry, location, 
      company_description 
    } = req.body;

    if (!email || !company_name) {
      return res.status(400).json({
        success: false,
        error: 'Email and company name are required'
      });
    }

    console.log('💾 Saving client profile for:', email);

    const user = await User.findOne({ email, role: 'client', isVerified: true });

    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'Client not found or not verified'
      });
    }

    let clientProfile = await ClientProfile.findOne({ userId: user._id });

    if (!clientProfile) {
      await ClientProfile.create({
        userId: user._id,
        companyName: company_name,
        contactName: contact_name || null,
        contactTitle: contact_title || null,
        phone: phone || null,
        website: website || null,
        companySize: company_size || null,
        industry: industry || null,
        location: location || null,
        companyDescription: company_description || null,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    } else {
      await ClientProfile.updateOne(
        { _id: clientProfile._id },
        {
          $set: {
            companyName: company_name,
            contactName: contact_name || null,
            contactTitle: contact_title || null,
            phone: phone || null,
            website: website || null,
            companySize: company_size || null,
            industry: industry || null,
            location: location || null,
            companyDescription: company_description || null,
            updatedAt: new Date()
          }
        }
      );
    }

    console.log('✅ Client profile saved successfully for:', email);

    res.json({
      success: true,
      message: 'Client profile saved successfully'
    });

  } catch (error) {
    console.error('Error saving client profile:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to save profile',
      details: error.message 
    });
  }
});

/* =========================
   12. Create Client Request
========================= */
app.post('/api/create-client-request', async (req, res) => {
  try {
    const { 
      email, 
      position_id, 
      title, 
      description, 
      start_date, 
      end_date, 
      budget_type, 
      budget_amount, 
      currency,
      work_country,
      work_city,
      work_mode 
    } = req.body;

    if (!email || !position_id || !title) {
      return res.status(400).json({
        success: false,
        error: 'Email, position, and title are required'
      });
    }

    console.log('📝 Creating client request for:', email);

    const user = await User.findOne({ email, role: 'client', isVerified: true });
    
    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'Client not found'
      });
    }

    const clientProfile = await ClientProfile.findOne({ userId: user._id });

    if (!clientProfile) {
      return res.status(400).json({
        success: false,
        error: 'Client profile not found'
      });
    }

    const clientRequest = await ClientRequest.create({
      clientProfileId: clientProfile._id,
      positionId: position_id,
      title,
      description: description || null,
      startDate: start_date ? new Date(start_date) : null,
      endDate: end_date ? new Date(end_date) : null,
      budgetType: budget_type || 'daily',
      budgetAmount: budget_amount || null,
      currency: currency || 'EUR',
      workCountry: work_country || null,
      workCity: work_city || null,
      workMode: work_mode || 'remote',
      status: 'submitted',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    console.log('✅ Client request created with ID:', clientRequest._id);

    setTimeout(async () => {
      try {
        await generateMatchSuggestions(clientRequest._id);
      } catch (matchError) {
        console.error('Error generating matches:', matchError);
      }
    }, 1000);

    res.json({
      success: true,
      requestId: clientRequest._id,
      message: 'Request created successfully'
    });

  } catch (error) {
    console.error('Error creating client request:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to create request',
      details: error.message 
    });
  }
});

/* =========================
   13. Generate Match Suggestions
========================= */
async function generateMatchSuggestions(requestId) {
  try {
    const request = await ClientRequest.findById(requestId)
      .populate('positionId')
      .populate({
        path: 'clientProfileId',
        populate: { path: 'userId' }
      });

    if (!request) return;

    const consultants = await ConsultantProfile.find({
      subscriptionStatus: 'active',
      positions: request.positionId?._id,
      $or: [
        { workModePreference: request.workMode },
        { workModePreference: 'hybrid' }
      ]
    }).populate('userId');

    console.log(`Found ${consultants.length} potential consultants for request ${requestId}`);

    for (const consultant of consultants) {
      let isAvailable = true;
      
      if (request.startDate && request.endDate) {
        const hasAvailability = consultant.availability.some(a => 
          a.startDate && a.endDate &&
          a.startDate <= request.endDate && 
          a.endDate >= request.startDate
        );
        isAvailable = hasAvailability;
      }

      if (isAvailable) {
        let matchScore = 70;
        
        if (consultant.workModePreference === request.workMode) {
          matchScore += 15;
        } else if (consultant.workModePreference === 'hybrid') {
          matchScore += 10;
        }
        
        if (request.workMode === 'on-site' && 
            consultant.baseCountry === request.workCountry) {
          matchScore += 15;
          if (consultant.baseCity === request.workCity) {
            matchScore += 10;
          }
        }

        if (request.workMode === 'on-site' && consultant.travelWillingness) {
          matchScore += 5;
        }

        await MatchSuggestion.create({
          requestId: request._id,
          consultantProfileId: consultant._id,
          matchScore,
          matchReasons: {
            position_match: true,
            availability_match: true,
            subscription_active: true,
            work_mode_compatible: true,
            location_match: request.workMode === 'on-site' && consultant.baseCountry === request.workCountry,
            score_factors: {
              base_score: 70,
              work_mode_bonus: consultant.workModePreference === request.workMode ? 15 : 
                              (consultant.workModePreference === 'hybrid' ? 10 : 0),
              location_bonus: request.workMode === 'on-site' && consultant.baseCountry === request.workCountry ? 15 : 0,
              city_bonus: request.workMode === 'on-site' && consultant.baseCity === request.workCity ? 10 : 0,
              travel_bonus: request.workMode === 'on-site' && consultant.travelWillingness ? 5 : 0
            }
          },
          createdAt: new Date()
        });
      }
    }

    console.log(`✅ Generated match suggestions for request ${requestId}`);

  } catch (error) {
    console.error('Error generating matches:', error);
  }
}

/* =========================
   14. Admin Endpoints
========================= */
app.get('/api/admin/match-suggestions', async (req, res) => {
  try {
    const { request_id, status } = req.query;
    
    const query = {};
    
    if (request_id) {
      query.requestId = request_id;
    }
    
    if (status) {
      query.adminReviewStatus = status;
    }
    
    const suggestions = await MatchSuggestion.find(query)
      .populate({
        path: 'requestId',
        populate: {
          path: 'clientProfileId'
        }
      })
      .populate({
        path: 'consultantProfileId',
        populate: { path: 'userId' }
      })
      .sort({ matchScore: -1, createdAt: -1 });
    
    const formattedSuggestions = suggestions.map(s => {
      const suggestionObj = s.toObject();
      return {
        ...suggestionObj,
        request_title: s.requestId?.title,
        work_mode: s.requestId?.workMode,
        work_city: s.requestId?.workCity,
        work_country: s.requestId?.workCountry,
        consultant_id: s.consultantProfileId?._id,
        consultant_name: s.consultantProfileId?.fullName,
        consultant_email: s.consultantProfileId?.userId?.email,
        client_company: s.requestId?.clientProfileId?.companyName
      };
    });
    
    res.json({
      success: true,
      count: formattedSuggestions.length,
      suggestions: formattedSuggestions
    });
    
  } catch (error) {
    console.error('Error fetching match suggestions:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Database error' 
    });
  }
});

app.put('/api/admin/update-match-status', async (req, res) => {
  try {
    const { match_id, status, admin_notes } = req.body;
    
    if (!match_id || !status) {
      return res.status(400).json({ 
        success: false, 
        error: 'Match ID and status are required' 
      });
    }
    
    const admin = await User.findOne({ role: 'admin' });
    
    if (!admin) {
      return res.status(400).json({ 
        success: false, 
        error: 'Admin not found' 
      });
    }
    
    const match = await MatchSuggestion.findById(match_id);
    
    if (!match) {
      return res.status(404).json({ 
        success: false, 
        error: 'Match not found' 
      });
    }
    
    await MatchSuggestion.updateOne(
      { _id: match_id },
      {
        $set: {
          adminReviewStatus: status,
          adminNotes: admin_notes || null,
          reviewedByAdminId: admin._id,
          reviewedAt: new Date()
        }
      }
    );
    
    res.json({ 
      success: true, 
      message: 'Status updated successfully' 
    });
    
  } catch (error) {
    console.error('Error updating match status:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Database error' 
    });
  }
});

app.get('/api/admin/requests', async (req, res) => {
  try {
    const { status } = req.query;
    
    const query = {};
    
    if (status) {
      query.status = status;
    }
    
    const requests = await ClientRequest.find(query)
      .populate('positionId')
      .populate('clientProfileId')
      .sort({ createdAt: -1 });
    
    const requestsWithCounts = await Promise.all(requests.map(async (request) => {
      const matchCount = await MatchSuggestion.countDocuments({ requestId: request._id });
      const requestObj = request.toObject();
      return {
        ...requestObj,
        position_name: request.positionId?.name,
        company_name: request.clientProfileId?.companyName,
        contact_name: request.clientProfileId?.contactName,
        phone: request.clientProfileId?.phone,
        match_count: matchCount
      };
    }));
    
    res.json({
      success: true,
      count: requestsWithCounts.length,
      requests: requestsWithCounts
    });
    
  } catch (error) {
    console.error('Error fetching requests:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Database error' 
    });
  }
});

app.get('/api/admin/consultants', async (req, res) => {
  try {
    const { status } = req.query;
    
    const query = {};
    
    if (status) {
      query.subscriptionStatus = status;
    }
    
    const consultants = await ConsultantProfile.find(query)
      .populate('userId')
      .populate('positions')
      .sort({ createdAt: -1 });
    
    const consultantsWithCounts = await Promise.all(consultants.map(async (consultant) => {
      const matchCount = await MatchSuggestion.countDocuments({ consultantProfileId: consultant._id });
      const consultantObj = consultant.toObject();
      return {
        ...consultantObj,
        email: consultant.userId?.email,
        user_created: consultant.userId?.createdAt,
        positions: consultant.positions?.map(p => p.name).join(', '),
        match_count: matchCount
      };
    }));
    
    res.json({
      success: true,
      count: consultantsWithCounts.length,
      consultants: consultantsWithCounts
    });
    
  } catch (error) {
    console.error('Error fetching consultants:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Database error' 
    });
  }
});

app.get('/api/admin/clients', async (req, res) => {
  try {
    const query = {};
    
    const clients = await ClientProfile.find(query)
      .populate('userId')
      .sort({ createdAt: -1 });
    
    const clientsWithCounts = await Promise.all(clients.map(async (client) => {
      const requestCount = await ClientRequest.countDocuments({ clientProfileId: client._id });
      const clientObj = client.toObject();
      return {
        ...clientObj,
        email: client.userId?.email,
        user_created: client.userId?.createdAt,
        is_verified: client.userId?.isVerified,
        request_count: requestCount
      };
    }));
    
    res.json({
      success: true,
      count: clientsWithCounts.length,
      clients: clientsWithCounts
    });
    
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Database error' 
    });
  }
});

app.post('/api/admin/verify-consultant', async (req, res) => {
  try {
    const { consultantId } = req.body;
    
    if (!consultantId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Consultant ID is required' 
      });
    }
    
    const consultantProfile = await ConsultantProfile.findById(consultantId);
    
    if (!consultantProfile) {
      return res.status(404).json({ 
        success: false, 
        error: 'Consultant not found' 
      });
    }
    
    await User.updateOne(
      { _id: consultantProfile.userId },
      { $set: { isVerified: true } }
    );
    
    console.log(`✅ Admin verified consultant ID: ${consultantId}`);
    
    res.json({ 
      success: true, 
      message: 'Consultant verified successfully' 
    });
    
  } catch (error) {
    console.error('Error verifying consultant:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Database error' 
    });
  }
});

app.put('/api/admin/update-request-status', async (req, res) => {
  try {
    const { request_id, status } = req.body;
    
    if (!request_id || !status) {
      return res.status(400).json({ 
        success: false, 
        error: 'Request ID and status are required' 
      });
    }
    
    const validStatuses = ['submitted', 'under_review', 'contacting', 'shortlist_ready', 'closed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid status value' 
      });
    }
    
    await ClientRequest.updateOne(
      { _id: request_id },
      { $set: { status: status } }
    );
    
    if (status === 'under_review') {
      const matchCount = await MatchSuggestion.countDocuments({ requestId: request_id });
      
      if (matchCount === 0) {
        setTimeout(() => {
          generateMatchSuggestions(request_id).catch(console.error);
        }, 100);
      }
    }
    
    res.json({ 
      success: true, 
      message: 'Request status updated successfully' 
    });
    
  } catch (error) {
    console.error('Error updating request status:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Database error' 
    });
  }
});

app.get('/api/admin/stats', async (req, res) => {
  try {
    const consultantTotal = await ConsultantProfile.countDocuments();
    
    const verifiedConsultants = await ConsultantProfile.aggregate([
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $match: {
          'user.isVerified': true
        }
      },
      {
        $count: 'count'
      }
    ]);
    
    const activeSubscriptions = await ConsultantProfile.countDocuments({
      subscriptionStatus: 'active'
    });
    
    const clientTotal = await ClientProfile.countDocuments();
    
    const requestTotal = await ClientRequest.countDocuments();
    const pendingRequests = await ClientRequest.countDocuments({
      status: { $in: ['submitted', 'under_review'] }
    });
    
    const matchTotal = await MatchSuggestion.countDocuments();
    const activeMatches = await MatchSuggestion.countDocuments({
      adminReviewStatus: { $in: ['shortlisted', 'contacted'] }
    });
    
    const revenue = activeSubscriptions * 99;
    
    res.json({
      success: true,
      stats: {
        consultants: {
          total: consultantTotal,
          verified: verifiedConsultants[0]?.count || 0,
          pending: consultantTotal - (verifiedConsultants[0]?.count || 0),
          activeSubscriptions
        },
        clients: {
          total: clientTotal
        },
        requests: {
          total: requestTotal,
          pending: pendingRequests
        },
        matches: {
          total: matchTotal,
          active: activeMatches
        },
        revenue: revenue,
        monthlyGrowth: 15
      }
    });
    
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Database error' 
    });
  }
});

app.get('/api/admin/consultant/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const consultant = await ConsultantProfile.findById(id)
      .populate('userId')
      .populate('positions');
    
    if (!consultant) {
      return res.status(404).json({ 
        success: false, 
        error: 'Consultant not found' 
      });
    }
    
    const matchCount = await MatchSuggestion.countDocuments({ consultantProfileId: id });
    
    const consultantData = {
      ...consultant.toObject(),
      email: consultant.userId?.email,
      user_created: consultant.userId?.createdAt,
      is_verified: consultant.userId?.isVerified,
      positions: consultant.positions?.map(p => p.name).join(', '),
      match_count: matchCount,
      availability_count: consultant.availability?.length || 0
    };
    
    res.json({
      success: true,
      consultant: consultantData
    });
    
  } catch (error) {
    console.error('Error fetching consultant details:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Database error' 
    });
  }
});

app.get('/api/admin/request/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const request = await ClientRequest.findById(id)
      .populate('positionId')
      .populate('clientProfileId');
    
    if (!request) {
      return res.status(404).json({ 
        success: false, 
        error: 'Request not found' 
      });
    }
    
    const matches = await MatchSuggestion.find({ requestId: id })
      .populate({
        path: 'consultantProfileId',
        populate: { path: 'userId' }
      })
      .sort({ matchScore: -1 });
    
    const matchesData = matches.map(m => {
      const matchObj = m.toObject();
      return {
        ...matchObj,
        consultant_name: m.consultantProfileId?.fullName,
        consultant_city: m.consultantProfileId?.baseCity,
        consultant_country: m.consultantProfileId?.baseCountry,
        consultant_email: m.consultantProfileId?.userId?.email
      };
    });
    
    const requestData = {
      ...request.toObject(),
      position_name: request.positionId?.name,
      company_name: request.clientProfileId?.companyName,
      contact_name: request.clientProfileId?.contactName,
      phone: request.clientProfileId?.phone,
      client_location: request.clientProfileId?.location,
      match_count: matchesData.length,
      matches: matchesData
    };
    
    res.json({
      success: true,
      request: requestData
    });
    
  } catch (error) {
    console.error('Error fetching request details:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Database error' 
    });
  }
});

/* =========================
   15. User Dashboard Data
========================= */
app.get('/api/user/dashboard/:email', async (req, res) => {
  try {
    const { email } = req.params;
    
    const user = await User.findOne({ email, isVerified: true });
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
    }
    
    let data = { user: { email: user.email, role: user.role } };
    
    if (user.role === 'consultant') {
      const consultantProfile = await ConsultantProfile.findOne({ userId: user._id })
        .populate('positions');
      
      const matches = await MatchSuggestion.find({ consultantProfileId: consultantProfile?._id })
        .populate({
          path: 'requestId',
          populate: { path: 'clientProfileId' }
        })
        .sort({ createdAt: -1 })
        .limit(10);
      
      const matchesData = matches.map(m => {
        const matchObj = m.toObject();
        return {
          ...matchObj,
          request_title: m.requestId?.title,
          work_mode: m.requestId?.workMode,
          work_city: m.requestId?.workCity,
          work_country: m.requestId?.workCountry,
          company_name: m.requestId?.clientProfileId?.companyName
        };
      });
      
      data.profile = consultantProfile || null;
      data.matches = matchesData;
      data.matchCount = matchesData.length;
      
    } else if (user.role === 'client') {
      const clientProfile = await ClientProfile.findOne({ userId: user._id });
      
      const requests = await ClientRequest.find({ clientProfileId: clientProfile?._id })
        .populate('positionId')
        .sort({ createdAt: -1 });
      
      const requestsData = await Promise.all(requests.map(async (request) => {
        const matchCount = await MatchSuggestion.countDocuments({ requestId: request._id });
        const requestObj = request.toObject();
        return {
          ...requestObj,
          position_name: request.positionId?.name,
          match_count: matchCount
        };
      }));
      
      data.profile = clientProfile || null;
      data.requests = requestsData;
      data.requestCount = requestsData.length;
    }
    
    res.json({ 
      success: true, 
      data 
    });
    
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Database error' 
    });
  }
});

/* =========================
   16. Check Email Status
========================= */
app.get('/api/check-email-status/:email', async (req, res) => {
  try {
    const { email } = req.params;

    const user = await User.findOne({ email });

    if (!user) {
      return res.json({
        email,
        exists: false,
        is_verified: false
      });
    }

    let subscription_status = null;
    if (user.role === 'consultant') {
      const consultantProfile = await ConsultantProfile.findOne({ userId: user._id });
      subscription_status = consultantProfile?.subscriptionStatus;
    }

    const response = {
      email: user.email,
      exists: true,
      is_verified: user.isVerified,
      role: user.role,
      subscription_status
    };

    res.json(response);

  } catch (error) {
    console.error('Error checking email status:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to check status' 
    });
  }
});

/* =========================
   17. Get Positions List
========================= */
app.get('/api/positions', async (req, res) => {
  try {
    const positions = await Position.find({ isActive: true }).sort({ name: 1 });
    
    res.json({
      success: true,
      count: positions.length,
      positions
    });
    
  } catch (error) {
    console.error('Error fetching positions:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Database error' 
    });
  }
});

/* =========================
   18. Stripe Webhook
========================= */
app.post('/api/stripe-webhook', express.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('❌ Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        const subscription = event.data.object;
        await ConsultantProfile.updateOne(
          { stripeSubscriptionId: subscription.id },
          {
            $set: {
              subscriptionStatus: subscription.status,
              subscriptionEndDate: new Date(subscription.current_period_end * 1000)
            }
          }
        );
        console.log(`✅ Updated subscription ${subscription.id} to ${subscription.status}`);
        break;

      case 'customer.subscription.deleted':
        const deletedSubscription = event.data.object;
        await ConsultantProfile.updateOne(
          { stripeSubscriptionId: deletedSubscription.id },
          { $set: { subscriptionStatus: 'canceled' } }
        );
        console.log(`✅ Marked subscription ${deletedSubscription.id} as canceled`);
        break;

      case 'invoice.payment_succeeded':
        const invoice = event.data.object;
        console.log(`✅ Payment succeeded for invoice ${invoice.id}`);
        break;

      case 'invoice.payment_failed':
        const failedInvoice = event.data.object;
        console.log(`❌ Payment failed for invoice ${failedInvoice.id}`);
        if (failedInvoice.subscription) {
          await ConsultantProfile.updateOne(
            { stripeSubscriptionId: failedInvoice.subscription },
            { $set: { subscriptionStatus: 'past_due' } }
          );
        }
        break;
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/* =========================
   404 Handler
========================= */
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    error: 'Endpoint not found' 
  });
});

/* =========================
   Error Handler
========================= */
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err);
  
  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : err.message;
  
  res.status(statusCode).json({ 
    success: false, 
    error: message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

/* =========================
   Graceful Shutdown
========================= */
let server;

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

async function gracefulShutdown(signal) {
  console.log(`\n⚠️ Received ${signal}, starting graceful shutdown...`);
  
  try {
    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed');
    
    if (server) {
      server.close(() => {
        console.log('✅ HTTP server closed');
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  } catch (error) {
    console.error('❌ Error during graceful shutdown:', error);
    process.exit(1);
  }
}

/* =========================
   Start Server
========================= */
const PORT = process.env.PORT || 5000;

server = app.listen(PORT, async () => {
  console.log('\n🚀 ==================================');
  console.log(`🚀 Web Consultant Hub API starting on port ${PORT}...`);
  console.log(`📁 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
  console.log('=====================================\n');
  
  const dbConnected = await connectToMongoDB();
  
  if (dbConnected) {
    await initializeDatabase();
    await testBrevoConnection();
    console.log('\n✅ Server is fully initialized and ready');
  } else {
    console.warn('\n⚠️ Server started but database connection failed');
  }
  
  console.log('\n✅ Server is running');
  console.log('📋 Available endpoints:');
  console.log('   🔐 AUTH ENDPOINTS:');
  console.log('   POST   /api/check-registration          - Check if email is registered');
  console.log('   POST   /api/send-magic-link              - Send magic link (registered users only)');
  console.log('   POST   /api/verify-magic-link            - Verify magic link');
  console.log('   GET    /api/verify-token                 - Verify session token');
  console.log('   GET    /api/check-email-status/:email    - Check email status');
  console.log('');
  console.log('   👤 CONSULTANT ENDPOINTS:');
  console.log('   POST   /api/save-consultant-signup-data  - Save consultant signup data');
  console.log('   GET    /api/get-consultant-signup-data   - Get consultant signup data');
  console.log('   POST   /api/save-consultant-profile      - Save consultant profile');
  console.log('   POST   /api/create-subscription          - Create Stripe subscription');
  console.log('');
  console.log('   🏢 CLIENT ENDPOINTS:');
  console.log('   POST   /api/save-client-signup-data      - Save client signup data');
  console.log('   GET    /api/get-client-signup-data       - Get client signup data');
  console.log('   POST   /api/save-client-profile          - Save client profile');
  console.log('   POST   /api/create-client-request        - Create client request');
  console.log('');
  console.log('   📊 DASHBOARD ENDPOINTS:');
  console.log('   GET    /api/user/dashboard/:email        - Get user dashboard data');
  console.log('   GET    /api/positions                    - Get available positions');
  console.log('');
  console.log('   👑 ADMIN ENDPOINTS:');
  console.log('   GET    /api/admin/match-suggestions      - View match suggestions');
  console.log('   PUT    /api/admin/update-match-status    - Update match status');
  console.log('   GET    /api/admin/requests               - View all client requests');
  console.log('   GET    /api/admin/consultants            - View all consultants');
  console.log('   GET    /api/admin/clients                - View all clients');
  console.log('   GET    /api/admin/stats                  - View admin statistics');
  console.log('   GET    /api/admin/consultant/:id         - Get consultant details');
  console.log('   GET    /api/admin/request/:id            - Get request details');
  console.log('   POST   /api/admin/verify-consultant      - Verify consultant');
  console.log('   PUT    /api/admin/update-request-status  - Update request status');
  console.log('');
  console.log('   💳 PAYMENT ENDPOINTS:');
  console.log('   POST   /api/stripe-webhook               - Stripe webhook handler');
  console.log('=====================================\n');
});