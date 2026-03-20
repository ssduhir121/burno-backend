require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const crypto = require('crypto');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const SibApiV3Sdk = require('sib-api-v3-sdk');
const fs = require('fs');
const path = require('path');
const fileUpload = require('express-fileupload');

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
   Create Upload Directories
========================= */
const createUploadDirectories = () => {
  const dirs = [
    './public',
    './public/uploads',
    './public/uploads/cv',
    './public/uploads/temp',
    './public/uploads/support'
  ];
  
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`📁 Created directory: ${dir}`);
    }
  });
};

createUploadDirectories();

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

// File upload middleware
app.use(fileUpload({
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  abortOnLimit: true,
  createParentPath: true,
  responseOnLimit: 'File size exceeds the 5MB limit',
  useTempFiles: true,
  tempFileDir: './public/uploads/temp/',
  debug: process.env.NODE_ENV === 'development'
}));

// Serve static files from public directory
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

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
    dob: { type: Date, default: null },
  phone: { type: String, default: '' },
  baseCountry: { type: String, default: '' },
  baseCity: { type: String, default: '' },
  workModePreference: { type: String, enum: ['remote', 'on-site', 'hybrid'], default: 'remote' },
  travelWillingness: { type: Boolean, default: false },
  travelRadiusKm: { type: Number, default: null },
  yearsExperience: { type: String, default: '' },
  cvUrl: { type: String, default: '' }, // Path to locally stored CV file
  cvFileName: { type: String, default: '' }, // Original filename
  linkedinUrl: { type: String, default: '' },
  githubUrl: { type: String, default: '' },
  preferredWorkLocation: { type: String, default: '' }, // Work location from signup
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


// Support Request Schema
const supportRequestSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  role: { type: String, enum: ['consultant', 'client', 'both', 'other'], default: 'consultant' },
  subject: { type: String, required: true },
  message: { type: String, required: true },
  priority: { type: String, enum: ['low', 'normal', 'high', 'critical'], default: 'normal' },
  status: { type: String, enum: ['new', 'in_progress', 'resolved', 'closed'], default: 'new' },
  ticketId: { type: String, unique: true },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  attachments: [{ type: String }], // URLs to attached files
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  resolvedAt: { type: Date, default: null }
});

// Support Reply Schema (for threaded conversations)
const supportReplySchema = new mongoose.Schema({
  supportRequestId: { type: mongoose.Schema.Types.ObjectId, ref: 'SupportRequest', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userRole: { type: String, enum: ['consultant', 'client', 'admin'], required: true },
  message: { type: String, required: true },
  attachments: [{ type: String }],
  isInternal: { type: Boolean, default: false }, // For admin-only notes
  createdAt: { type: Date, default: Date.now }
});

// Update your availabilityBlockSchema (replace the existing one)
const availabilityBlockSchema = new mongoose.Schema({
  date: { type: String, required: true }, // Store as YYYY-MM-DD string
  status: { type: String, enum: ['available', 'unavailable', 'busy'], required: true },
  startTime: { type: String, default: '09:00' },
  endTime: { type: String, default: '17:00' },
  timezone: { type: String, default: 'UTC' },
  notes: { type: String, default: '' }
});

// User Availability Schema (main collection for storing availability)
const userAvailabilitySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userType: { type: String, enum: ['consultant', 'client', 'admin'], required: true },
  availability: [availabilityBlockSchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

/* =========================
   Agenda Item Schema (New)
========================= */

// Agenda Item Schema (for tracking engagements, missions, interviews)
const agendaItemSchema = new mongoose.Schema({
  // Who this agenda belongs to
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userType: { type: String, enum: ['consultant', 'client', 'admin'], required: true },
  
  // Related entities
  matchId: { type: mongoose.Schema.Types.ObjectId, ref: 'MatchSuggestion', default: null },
  requestId: { type: mongoose.Schema.Types.ObjectId, ref: 'ClientRequest', default: null },
  consultantProfileId: { type: mongoose.Schema.Types.ObjectId, ref: 'ConsultantProfile', default: null },
  clientProfileId: { type: mongoose.Schema.Types.ObjectId, ref: 'ClientProfile', default: null },
  
  // Agenda details
  title: { type: String, required: true },
  description: { type: String, default: '' },
  type: { type: String, enum: ['mission', 'interview', 'meeting', 'deadline', 'reminder'], required: true },
  status: { type: String, enum: ['scheduled', 'in_progress', 'completed', 'cancelled', 'pending'], default: 'scheduled' },
  
  // Timing
  startDate: { type: Date, required: true },
  endDate: { type: Date, default: null },
  startTime: { type: String, default: '' },
  endTime: { type: String, default: '' },
  duration: { type: Number, default: null }, // in hours
  
  // Location (for on-site or virtual meetings)
  location: { type: String, default: '' },
  meetingLink: { type: String, default: '' },
  
  // Additional data
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  reminders: [{
    type: { type: String, enum: ['email', 'push', 'sms'], default: 'email' },
    sentAt: { type: Date, default: null },
    scheduledFor: { type: Date }
  }],
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Indexes for efficient queries
agendaItemSchema.index({ userId: 1, startDate: 1 });
agendaItemSchema.index({ userId: 1, status: 1 });
agendaItemSchema.index({ matchId: 1 });
agendaItemSchema.index({ startDate: 1, endDate: 1 });


// Create Models
const SupportRequest = mongoose.model('SupportRequest', supportRequestSchema);
const SupportReply = mongoose.model('SupportReply', supportReplySchema);
const User = mongoose.model('User', userSchema);
const Position = mongoose.model('Position', positionSchema);
const ConsultantProfile = mongoose.model('ConsultantProfile', consultantProfileSchema);
const ClientProfile = mongoose.model('ClientProfile', clientProfileSchema);
const ClientRequest = mongoose.model('ClientRequest', clientRequestSchema);
const MatchSuggestion = mongoose.model('MatchSuggestion', matchSuggestionSchema);
const EmailLog = mongoose.model('EmailLog', emailLogSchema);
const UserAvailability = mongoose.model('UserAvailability', userAvailabilitySchema);
const AgendaItem = mongoose.model('AgendaItem', agendaItemSchema);
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
        email: process.env.EMAIL_FROM || 'noreply@webconsultanthub.com'
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


async function sendSupportConfirmationEmail(email, name, ticketId, subject) {
  try {
    let sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
    
    sendSmtpEmail.sender = {
      name: "Web Consultant Hub Support",
      email: process.env.EMAIL_FROM || 'support@webconsultanthub.com'
    };
    
    sendSmtpEmail.to = [{ 
      email: email,
      name: name
    }];
    
    sendSmtpEmail.subject = `Support Request Received - Ticket #${ticketId}`;
    
    sendSmtpEmail.htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Support Request Confirmation</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">Web Consultant Hub</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0;">Support Request Received</p>
        </div>
        
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #ddd; border-top: none;">
          <h2 style="color: #444; margin-top: 0;">Hello ${name},</h2>
          
          <p>Thank you for contacting Web Consultant Hub support. We have received your request and our team will get back to you as soon as possible.</p>
          
          <div style="background: #e8f4fd; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0 0 10px 0;"><strong>Ticket ID:</strong> ${ticketId}</p>
            <p style="margin: 0 0 10px 0;"><strong>Subject:</strong> ${subject}</p>
            <p style="margin: 0;"><strong>Status:</strong> New</p>
          </div>
          
          <p>Our support team typically responds within 24 hours during business days. You can expect a response via email shortly.</p>
          
          <p style="color: #666; font-size: 14px;">If you have any additional information to add to your request, please reply to this email.</p>
          
          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
          
          <p style="color: #999; font-size: 12px; text-align: center;">
            &copy; ${new Date().getFullYear()} Web Consultant Hub. All rights reserved.<br>
            This is an automated message, please do not reply directly to this email.
          </p>
        </div>
      </html>
    `;
    
    sendSmtpEmail.textContent = `
      Support Request Received - Ticket #${ticketId}
      
      Hello ${name},
      
      Thank you for contacting Web Consultant Hub support. We have received your request and our team will get back to you as soon as possible.
      
      Ticket ID: ${ticketId}
      Subject: ${subject}
      Status: New
      
      Our support team typically responds within 24 hours during business days.
      
      If you have any additional information to add to your request, please reply to this email.
    `;
    
    const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
    return { success: true, messageId: data.messageId };
    
  } catch (error) {
    console.error('❌ Failed to send support confirmation email:', error);
    throw error;
  }
}


async function notifyAdminsOfNewSupportRequest(supportRequest) {
  try {
    // Find all admin users
    const admins = await User.find({ role: 'admin' });
    
    if (admins.length === 0) {
      console.log('⚠️ No admin users found for notification');
      return;
    }
    
    const priorityColors = {
      low: '#3b82f6', // blue
      normal: '#10b981', // green
      high: '#f59e0b', // orange
      critical: '#ef4444' // red
    };
    
    const priorityLabels = {
      low: 'Low',
      normal: 'Normal',
      high: 'High',
      critical: 'Critical'
    };
    
    for (const admin of admins) {
      try {
        let sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
        
        sendSmtpEmail.sender = {
          name: "Web Consultant Hub Support",
          email: process.env.EMAIL_FROM || 'support@webconsultanthub.com'
        };
        
        sendSmtpEmail.to = [{ 
          email: admin.email,
          name: 'Admin'
        }];
        
        sendSmtpEmail.subject = `[${priorityLabels[supportRequest.priority]}] New Support Request - ${supportRequest.ticketId}`;
        
        sendSmtpEmail.htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>New Support Request</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: ${priorityColors[supportRequest.priority] || '#667eea'}; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 28px;">New Support Request</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0;">Priority: ${priorityLabels[supportRequest.priority] || 'Normal'}</p>
            </div>
            
            <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #ddd; border-top: none;">
              <h2 style="color: #444; margin-top: 0;">Ticket #${supportRequest.ticketId}</h2>
              
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 10px 0; font-weight: bold; width: 120px;">From:</td>
                  <td style="padding: 10px 0;">${supportRequest.name} (${supportRequest.email})</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; font-weight: bold;">Role:</td>
                  <td style="padding: 10px 0;">${supportRequest.role}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; font-weight: bold;">Subject:</td>
                  <td style="padding: 10px 0;">${supportRequest.subject}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; font-weight: bold;">Priority:</td>
                  <td style="padding: 10px 0;">
                    <span style="background: ${priorityColors[supportRequest.priority] || '#10b981'}; color: white; padding: 3px 10px; border-radius: 3px; font-size: 12px;">
                      ${priorityLabels[supportRequest.priority] || 'Normal'}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; font-weight: bold;">User ID:</td>
                  <td style="padding: 10px 0;">${supportRequest.userId || 'Not registered'}</td>
                </tr>
              </table>
              
              <div style="margin: 20px 0; padding: 15px; background: white; border-left: 4px solid #667eea; border-radius: 0 5px 5px 0;">
                <p style="margin: 0; white-space: pre-wrap;">${supportRequest.message}</p>
              </div>
              
              ${supportRequest.attachments && supportRequest.attachments.length > 0 ? `
                <div style="margin: 20px 0;">
                  <p style="font-weight: bold; margin-bottom: 10px;">Attachments:</p>
                  <ul style="margin: 0; padding-left: 20px;">
                    ${supportRequest.attachments.map(att => `<li><a href="${process.env.FRONTEND_URL}${att}">${att.split('/').pop()}</a></li>`).join('')}
                  </ul>
                </div>
              ` : ''}
              
              <div style="text-align: center; margin-top: 30px;">
                <a href="${process.env.FRONTEND_URL}/admin/support/${supportRequest._id}" style="background: #667eea; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">View in Admin Panel</a>
              </div>
              
              <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
              
              <p style="color: #999; font-size: 12px; text-align: center;">
                Received: ${new Date(supportRequest.createdAt).toLocaleString()}
              </p>
            </div>
          </body>
          </html>
        `;
        
        await apiInstance.sendTransacEmail(sendSmtpEmail);
        console.log(`📧 Admin notification sent to ${admin.email}`);
      } catch (adminEmailError) {
        console.error(`❌ Failed to send notification to admin ${admin.email}:`, adminEmailError);
      }
    }
    
  } catch (error) {
    console.error('❌ Error notifying admins:', error);
    throw error;
  }
}

/* =========================
   Helper Functions
========================= */

// Get position category based on name
function getPositionCategory(position) {
  if (position.includes('Developer') || position.includes('Engineer')) return 'Development';
  if (position.includes('Designer')) return 'Design';
  if (position.includes('Manager')) return 'Management';
  if (position.includes('Analyst') || position.includes('Scientist')) return 'Data';
  if (position.includes('Consultant')) return 'Consulting';
  if (position.includes('Architect')) return 'Architecture';
  return 'Other';
}

// Generate unique filename for CV
function generateCVFilename(originalName, userId) {
  const timestamp = Date.now();
  const randomString = crypto.randomBytes(8).toString('hex');
  const extension = path.extname(originalName);
  const sanitizedName = originalName
    .replace(extension, '')
    .replace(/[^a-zA-Z0-9]/g, '-')
    .toLowerCase()
    .substring(0, 30);
  
  return `cv_${userId}_${sanitizedName}_${timestamp}_${randomString}${extension}`;
}

/* =========================
   Initialize Database with Default Data
========================= */

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
    features: ['consultant-auth', 'client-auth', 'magic-links', 'stripe', 'email', 'file-upload']
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
    } 
    
    else if (user.role === 'client') {
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

    console.log('🔍 Verifying magic link:');
    console.log('   - Token:', token ? token.substring(0, 10) + '...' : 'MISSING');
    console.log('   - Email:', email);
    console.log('   - UserType:', userType);

    // Validate required fields
    if (!token) {
      console.log('❌ No token provided');
      return res.status(400).json({
        success: false,
        error: 'Token is required'
      });
    }

    if (!email) {
      console.log('❌ No email provided');
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    if (!userType) {
      console.log('❌ No userType provided');
      return res.status(400).json({
        success: false,
        error: 'User type is required'
      });
    }

    // Find user by email
    const user = await User.findOne({ email });

    if (!user) {
      console.log('❌ User not found for email:', email);
      return res.status(400).json({
        success: false,
        error: 'User not found. Please sign up first.',
        requiresSignup: true
      });
    }

    console.log('✅ User found:', { 
      id: user._id, 
      email: user.email, 
      role: user.role,
      hasToken: !!user.magicLinkToken,
      tokenExpires: user.magicLinkExpiresAt
    });

    // Check if token matches
    if (user.magicLinkToken !== token) {
      console.log('❌ Token mismatch');
      console.log('   - Stored token:', user.magicLinkToken ? user.magicLinkToken.substring(0, 10) + '...' : 'null');
      console.log('   - Provided token:', token.substring(0, 10) + '...');
      
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }

    // Check if token is expired
    if (!user.magicLinkExpiresAt || user.magicLinkExpiresAt < new Date()) {
      console.log('❌ Token expired at:', user.magicLinkExpiresAt);
      return res.status(400).json({
        success: false,
        error: 'Token has expired'
      });
    }

    // Check if userType matches
    if (user.role !== userType) {
      console.log('❌ Role mismatch:', { provided: userType, stored: user.role });
      return res.status(400).json({
        success: false,
        error: `This account is registered as a ${user.role}. Please use the correct login type.`
      });
    }

    console.log('✅ Token verified successfully for user:', user.email);

    // Mark user as verified if not already
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

    // Clear the magic link token (one-time use)
    await User.updateOne(
      { _id: user._id },
      { 
        $set: { 
          magicLinkToken: null,
          magicLinkExpiresAt: null
        } 
      }
    );

    // Generate session token
    const sessionToken = crypto.randomBytes(32).toString('hex');

    // Get profile data and determine redirect path
    let profile = null;
    let hasProfile = false;
    let redirectPath = '/';
    let profileCompletion = {
      basicInfo: false,
      availability: false,
      payment: false
    };

    if (user.role === 'consultant') {
      const consultantProfile = await ConsultantProfile.findOne({ userId: user._id })
        .populate('positions');
      
      hasProfile = !!consultantProfile;
      profile = consultantProfile;
      
      if (consultantProfile) {
        // SIMPLIFIED CHECKS:
        // basicInfo: just check if fullName exists (phone and baseCountry are optional)
        profileCompletion.basicInfo = !!(consultantProfile.fullName);
        
        // availability: check if array exists and has items
        profileCompletion.availability = consultantProfile.availability && 
                                         consultantProfile.availability.length > 0;
        
        // payment: check subscription status
        profileCompletion.payment = consultantProfile.subscriptionStatus === 'active';
        
        console.log('📊 Consultant Profile Data:');
        console.log('   - fullName:', consultantProfile.fullName);
        console.log('   - phone:', consultantProfile.phone);
        console.log('   - baseCountry:', consultantProfile.baseCountry);
        console.log('   - availability count:', consultantProfile.availability?.length || 0);
        console.log('   - subscriptionStatus:', consultantProfile.subscriptionStatus);
        console.log('   - subscriptionEndDate:', consultantProfile.subscriptionEndDate);
        
        console.log('📊 Profile Completion:');
        console.log('   - basicInfo:', profileCompletion.basicInfo);
        console.log('   - availability:', profileCompletion.availability);
        console.log('   - payment:', profileCompletion.payment);
        
        // CORRECT REDIRECT LOGIC:
        // First check subscription (most important)
        if (consultantProfile.subscriptionStatus === 'active') {
          redirectPath = '/consultant/dashboard';
          console.log('➡️ REDIRECT: Subscription ACTIVE - going to DASHBOARD');
        } 
        // Then check availability
        else if (!profileCompletion.availability) {
          redirectPath = '/consultant/profile-setup?step=availability';
          console.log('➡️ REDIRECT: Availability needed');
        } 
        // Then check basic info
        else if (!profileCompletion.basicInfo) {
          redirectPath = '/consultant/profile-setup?step=basic';
          console.log('➡️ REDIRECT: Basic info needed');
        } 
        // Finally, if all else fails, go to subscription
        else {
          redirectPath = '/consultant/subscription';
          console.log('➡️ REDIRECT: Subscription needed');
        }
      } else {
        redirectPath = '/consultant/profile-setup?step=basic';
        console.log('➡️ REDIRECT: No profile found');
      }
    } else if (user.role === 'client') {
      const clientProfile = await ClientProfile.findOne({ userId: user._id });
      hasProfile = !!clientProfile;
      profile = clientProfile;
      
      if (clientProfile) {
        profileCompletion.basicInfo = !!(clientProfile.companyName && clientProfile.contactName);
        redirectPath = '/client/dashboard';
        console.log('✅ Client profile found, redirecting to dashboard');
      } else {
        redirectPath = '/client/profile-setup';
        console.log('⚠️ No client profile found, redirecting to profile setup');
      }
    } else if (user.role === 'admin') {
      hasProfile = true;
      redirectPath = '/admin/dashboard';
      profileCompletion = { basicInfo: true, availability: true, payment: true };
      console.log('✅ Admin user, redirecting to admin dashboard');
    }

    // Return success response
    const response = {
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
    };

    console.log('✅ Sending success response:', {
      redirectTo: redirectPath,
      hasProfile,
      role: user.role,
      payment: profileCompletion.payment,
      basicInfo: profileCompletion.basicInfo,
      availability: profileCompletion.availability
    });

    res.json(response);

  } catch (error) {
    console.error('❌ Error verifying magic link:', error);
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
   5. Combined Consultant Signup with File Upload
========================= */
app.post('/api/consultant/signup', async (req, res) => {
  try {
    console.log('='.repeat(60));
    console.log('📝 CONSULTANT SIGNUP REQUEST RECEIVED');
    console.log('='.repeat(60));
    
    // Log content type for debugging
    console.log('📋 Content-Type:', req.headers['content-type']);
    
    // Log all received fields
    console.log('📦 Form fields received:');
    console.log('   - fullName:', req.body.fullName || 'MISSING');
    console.log('   - email:', req.body.email || 'MISSING');
    console.log('   - jobTitle:', req.body.jobTitle || 'MISSING');
    console.log('   - yearsOfExperience:', req.body.yearsOfExperience || 'MISSING');
    console.log('   - workLocation:', req.body.workLocation || 'MISSING');
    
    // Log files
    if (req.files) {
      console.log('📎 Files received:', Object.keys(req.files));
      if (req.files.cvFile) {
        console.log('   📄 CV File details:');
        console.log('      - Name:', req.files.cvFile.name);
        console.log('      - Size:', req.files.cvFile.size, 'bytes');
        console.log('      - Type:', req.files.cvFile.mimetype);
        console.log('      - MD5:', req.files.cvFile.md5);
      }
    } else {
      console.log('📎 No files received');
    }

    // Get form fields from req.body
    const { 
      fullName, 
      email, 
      jobTitle, 
      yearsOfExperience, 
      workLocation 
    } = req.body;

    // Validate required fields
    const missingFields = [];
    if (!fullName || fullName.trim() === '') missingFields.push('fullName');
    if (!email || email.trim() === '') missingFields.push('email');
    if (!jobTitle || jobTitle.trim() === '') missingFields.push('jobTitle');
    if (!yearsOfExperience || yearsOfExperience.trim() === '') missingFields.push('yearsOfExperience');
    if (!workLocation || workLocation.trim() === '') missingFields.push('workLocation');
    
    if (missingFields.length > 0) {
      console.log('❌ Validation failed - Missing fields:', missingFields);
      return res.status(400).json({
        success: false,
        error: `Missing required fields: ${missingFields.join(', ')}`,
        missingFields
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.log('❌ Invalid email format:', email);
      return res.status(400).json({
        success: false,
        error: 'Invalid email format'
      });
    }

    // Validate file upload
    if (!req.files || !req.files.cvFile) {
      console.log('❌ No CV file uploaded');
      return res.status(400).json({
        success: false,
        error: 'CV file is required'
      });
    }

    const cvFile = req.files.cvFile;
    
    // Validate file type
    const allowedTypes = [
      'application/pdf', 
      'application/msword', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/octet-stream' // Sometimes PDFs come as this
    ];
    
    // Check file extension as backup
    const fileExtension = path.extname(cvFile.name).toLowerCase();
    const allowedExtensions = ['.pdf', '.doc', '.docx'];
    
    if (!allowedTypes.includes(cvFile.mimetype) && !allowedExtensions.includes(fileExtension)) {
      console.log('❌ Invalid file type:', cvFile.mimetype, 'Extension:', fileExtension);
      return res.status(400).json({
        success: false,
        error: 'Invalid file type. Only PDF and Word documents are allowed.'
      });
    }

    // Check file size (5MB limit)
    const maxSize = 5 * 1024 * 1024; // 5MB in bytes
    if (cvFile.size > maxSize) {
      console.log('❌ File too large:', cvFile.size, 'bytes');
      return res.status(400).json({
        success: false,
        error: 'File size exceeds 5MB limit'
      });
    }

    console.log('✅ All validations passed');
    console.log('📝 Processing signup for:', email);

    // Check if user already exists
    let user = await User.findOne({ email });

    if (user) {
      // If user exists but is not a consultant, error
      if (user.role !== 'consultant') {
        console.log('❌ Email registered as different role:', user.role);
        return res.status(400).json({
          success: false,
          error: `This email is registered as a ${user.role}. Please use the correct login type.`
        });
      }
      
      console.log('👤 User already exists:', user._id);
    } else {
      // Create new user
      user = await User.create({
        email: email.toLowerCase().trim(),
        role: 'consultant',
        isVerified: false,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log('✅ New consultant user created:', user._id);
    }

    // Handle CV file upload
    let cvUrl = '';
    let cvFileName = '';
    
    try {
      // Generate unique filename
      const timestamp = Date.now();
      const randomString = crypto.randomBytes(8).toString('hex');
      const ext = path.extname(cvFile.name);
      const sanitizedName = cvFile.name
        .replace(ext, '')
        .replace(/[^a-zA-Z0-9]/g, '-')
        .toLowerCase()
        .substring(0, 30);
      
      const filename = `cv_${user._id}_${sanitizedName}_${timestamp}_${randomString}${ext}`;
      const uploadPath = path.join(__dirname, 'public/uploads/cv', filename);
      
      // Ensure directory exists
      const uploadDir = path.join(__dirname, 'public/uploads/cv');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      
      // Move file to upload directory
      await cvFile.mv(uploadPath);
      
      cvUrl = `/uploads/cv/${filename}`;
      cvFileName = cvFile.name;
      
      console.log('📎 CV saved:', { original: cvFile.name, saved: filename, path: cvUrl });
    } catch (fileError) {
      console.error('❌ Error saving CV file:', fileError);
      return res.status(500).json({
        success: false,
        error: 'Failed to save CV file',
        details: fileError.message
      });
    }

    // Find or create consultant profile
    let consultantProfile = await ConsultantProfile.findOne({ userId: user._id });

    try {
      if (!consultantProfile) {
        consultantProfile = await ConsultantProfile.create({
          userId: user._id,
          fullName: fullName.trim(),
          yearsExperience: yearsOfExperience,
          cvUrl: cvUrl,
          cvFileName: cvFileName,
          preferredWorkLocation: workLocation.trim(),
          createdAt: new Date(),
          updatedAt: new Date()
        });
        console.log('✅ New consultant profile created');
      } else {
        await ConsultantProfile.updateOne(
          { _id: consultantProfile._id },
          {
            $set: {
              fullName: fullName.trim(),
              yearsExperience: yearsOfExperience,
              cvUrl: cvUrl,
              cvFileName: cvFileName,
              preferredWorkLocation: workLocation.trim(),
              updatedAt: new Date()
            }
          }
        );
        console.log('✅ Consultant profile updated');
      }
    } catch (dbError) {
      console.error('❌ Error saving consultant profile:', dbError);
      return res.status(500).json({
        success: false,
        error: 'Failed to save consultant profile',
        details: dbError.message
      });
    }

    // Handle job title - create or find position
    if (jobTitle && jobTitle.trim()) {
      try {
        // Check if position exists
        let position = await Position.findOne({ name: jobTitle.trim() });
        
        if (!position) {
          // Create new position if it doesn't exist
          position = await Position.create({
            name: jobTitle.trim(),
            category: getPositionCategory(jobTitle),
            isActive: true,
            createdAt: new Date()
          });
          console.log('✅ New position created:', position.name);
        }
        
        // Add position to consultant profile
        await ConsultantProfile.updateOne(
          { userId: user._id },
          { $addToSet: { positions: position._id } }
        );
        console.log('✅ Position added to consultant:', position.name);
      } catch (posError) {
        console.error('❌ Error handling position:', posError);
        // Continue even if position fails - not critical
      }
    }

    // Parse work location and update baseCity/baseCountry
    if (workLocation && workLocation.trim()) {
      try {
        let baseCity = '';
        let baseCountry = '';
        const location = workLocation.trim();
        
        if (location.toLowerCase() === 'remote') {
          baseCity = 'Remote';
          baseCountry = 'Remote';
        } else if (location.includes(',')) {
          const parts = location.split(',').map(p => p.trim());
          baseCity = parts[0] || '';
          baseCountry = parts[1] || '';
        } else {
          baseCity = location;
        }
        
        await ConsultantProfile.updateOne(
          { userId: user._id },
          { 
            $set: { 
              baseCity,
              baseCountry
            } 
          }
        );
      } catch (locError) {
        console.error('❌ Error updating location:', locError);
        // Continue even if location update fails
      }
    }

    // Generate and send magic link
    let magicLinkSent = false;
    try {
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

      await User.updateOne(
        { _id: user._id },
        { 
          $set: { 
            magicLinkToken: token, 
            magicLinkExpiresAt: expiresAt,
            updatedAt: new Date()
          } 
        }
      );

      const magicLink = `${process.env.FRONTEND_URL}/auth/verify?token=${token}&email=${encodeURIComponent(email)}&type=consultant`;

      // Send email
      await emailService.sendMagicLinkEmail(email, magicLink, 'consultant');
      magicLinkSent = true;
      console.log(`📧 Magic link sent to ${email}`);
      
      // Log email in database
      await EmailLog.create({
        recipientEmail: email,
        emailType: 'magic_link_signup',
        status: 'sent',
        sentAt: new Date()
      }).catch(err => console.error('Error logging email:', err));
      
    } catch (emailError) {
      console.error('❌ Failed to send magic link:', emailError);
      // Continue - we'll still return success but inform user
    }

    // Return success response
    console.log('✅ Signup completed successfully for:', email);
    console.log('='.repeat(60));
    
    res.status(201).json({
      success: true,
      message: magicLinkSent 
        ? 'Signup successful! Check your email for the magic link.' 
        : 'Signup successful! However, there was an issue sending the email. Please contact support.',
      email: email,
      userId: user._id,
      cvUrl: cvUrl,
      requiresVerification: true,
      magicLinkSent: magicLinkSent
    });

  } catch (error) {
    console.error('❌ Fatal error in consultant signup:', error);
    console.error('   Error stack:', error.stack);
    
    // Check for specific error types
    if (error.name === 'MongoError' || error.name === 'MongoServerError') {
      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          error: 'Email already exists'
        });
      }
    }
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.message
      });
    }
    
    res.status(500).json({ 
      success: false,
      error: 'Failed to complete signup. Please try again.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/* =========================
   6. Get Consultant Signup Data
========================= */
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

//     const user = await User.findOne({ email, role: 'consultant' });

//     if (!user) {
//       console.log('❌ Consultant not found for email:', email);
//       return res.status(404).json({
//         success: false,
//         error: 'Consultant not found'
//       });
//     }

//     console.log('✅ User found:', { id: user._id, email: user.email });

//     const consultantProfile = await ConsultantProfile.findOne({ userId: user._id }).populate('positions');

//     // Get job title from positions
//     let jobTitle = '';
//     if (consultantProfile && consultantProfile.positions && consultantProfile.positions.length > 0) {
//       const position = await Position.findById(consultantProfile.positions[0]);
//       jobTitle = position ? position.name : '';
//     }

//     // Determine work location
//     let workLocation = '';
//     if (consultantProfile) {
//       if (consultantProfile.preferredWorkLocation) {
//         workLocation = consultantProfile.preferredWorkLocation;
//       } else if (consultantProfile.baseCity === 'Remote' && consultantProfile.baseCountry === 'Remote') {
//         workLocation = 'Remote';
//       } else if (consultantProfile.baseCity && consultantProfile.baseCountry) {
//         workLocation = `${consultantProfile.baseCity}, ${consultantProfile.baseCountry}`;
//       } else if (consultantProfile.baseCity) {
//         workLocation = consultantProfile.baseCity;
//       } else if (consultantProfile.baseCountry) {
//         workLocation = consultantProfile.baseCountry;
//       }
//     }

//     const responseData = {
//       success: true,
//       data: {
//         fullName: consultantProfile?.fullName || '',
//         email: user.email,
//         jobTitle: jobTitle,
//         yearsOfExperience: consultantProfile?.yearsExperience || '',
//         workLocation: workLocation,
//         cvUrl: consultantProfile?.cvUrl || '',
//         cvFileName: consultantProfile?.cvFileName || ''
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


// In the /api/get-consultant-signup-data endpoint, update the response data:
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

    // Get job title from positions
    let jobTitle = '';
    if (consultantProfile && consultantProfile.positions && consultantProfile.positions.length > 0) {
      const position = await Position.findById(consultantProfile.positions[0]);
      jobTitle = position ? position.name : '';
    }

    // Determine work location
    let workLocation = '';
    if (consultantProfile) {
      if (consultantProfile.preferredWorkLocation) {
        workLocation = consultantProfile.preferredWorkLocation;
      } else if (consultantProfile.baseCity === 'Remote' && consultantProfile.baseCountry === 'Remote') {
        workLocation = 'Remote';
      } else if (consultantProfile.baseCity && consultantProfile.baseCountry) {
        workLocation = `${consultantProfile.baseCity}, ${consultantProfile.baseCountry}`;
      } else if (consultantProfile.baseCity) {
        workLocation = consultantProfile.baseCity;
      } else if (consultantProfile.baseCountry) {
        workLocation = consultantProfile.baseCountry;
      }
    }

    const responseData = {
      success: true,
      data: {
        fullName: consultantProfile?.fullName || '',
        email: user.email,
        jobTitle: jobTitle,
        yearsOfExperience: consultantProfile?.yearsExperience || '',
        workLocation: workLocation,
        cvUrl: consultantProfile?.cvUrl || '',
        cvFileName: consultantProfile?.cvFileName || '',
        dob: consultantProfile?.dob ? consultantProfile.dob.toISOString().split('T')[0] : '' // ADD THIS LINE
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
   7. Download CV
========================= */
app.get('/api/download-cv/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const consultantProfile = await ConsultantProfile.findOne({ userId });
    
    if (!consultantProfile || !consultantProfile.cvUrl) {
      return res.status(404).json({
        success: false,
        error: 'CV not found'
      });
    }
    
    const filePath = path.join(__dirname, 'public', consultantProfile.cvUrl);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: 'CV file not found on server'
      });
    }
    
    res.download(filePath, consultantProfile.cvFileName || 'cv.pdf');
    
  } catch (error) {
    console.error('Error downloading CV:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to download CV',
      details: error.message 
    });
  }
});

/* =========================
   8. Save Consultant Signup Data (Legacy - kept for compatibility)
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
   9. Save Consultant Profile
========================= */
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

//     const user = await User.findOne({ email, role: 'consultant', isVerified: true });

//     if (!user) {
//       return res.status(400).json({
//         success: false,
//         error: 'Consultant not found or not verified'
//       });
//     }

//     if (step === 'profile') {
//       const { 
//         full_name, phone, base_country, dob, base_city, 
//         work_mode, travel_willingness, travel_radius,
//         years_experience, linkedin, github, positions
//       } = formData;
      
//       let consultantProfile = await ConsultantProfile.findOne({ userId: user._id });

//       if (!consultantProfile) {
//         consultantProfile = await ConsultantProfile.create({
//           userId: user._id,
//           fullName: full_name,
//           phone: phone,
//           dob: dob ? new Date(dob) : null,
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
//       const { availability_blocks } = formData;
      
//       if (availability_blocks && Array.isArray(availability_blocks)) {
//         const consultantProfile = await ConsultantProfile.findOne({ userId: user._id });

//         if (consultantProfile) {
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



// Update the availability section in your /api/save-consultant-profile endpoint
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
      // Your existing profile saving code...
      
    } else if (step === 'availability') {
      const { availability_blocks } = formData;
      
      console.log('📅 Processing availability blocks:', availability_blocks);
      
      if (!availability_blocks || !Array.isArray(availability_blocks)) {
        return res.status(400).json({
          success: false,
          error: 'Availability blocks must be an array'
        });
      }

      const consultantProfile = await ConsultantProfile.findOne({ userId: user._id });

      if (!consultantProfile) {
        return res.status(404).json({
          success: false,
          error: 'Consultant profile not found'
        });
      }

      // Transform the availability blocks to match the schema
      const availability = availability_blocks.map(block => ({
        startDate: block.start_date ? new Date(block.start_date) : null,
        endDate: block.end_date ? new Date(block.end_date) : null,
        startTime: block.start_time || '',
        endTime: block.end_time || '',
        timezone: block.timezone || 'UTC',
        isRecurring: false,
        recurrencePattern: ''
      }));

      console.log('🔄 Updating availability with:', availability);

      // Update the consultant profile with availability
      await ConsultantProfile.updateOne(
        { _id: consultantProfile._id },
        { 
          $set: { 
            availability: availability,
            updatedAt: new Date()
          } 
        }
      );

      console.log('✅ Availability saved successfully for consultant:', user.email);
    }

    res.json({
      success: true,
      message: `Profile ${step} saved successfully`
    });

  } catch (error) {
    console.error('❌ Error saving consultant profile:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to save profile',
      details: error.message 
    });
  }
});
/* =========================
   10. Create Stripe Subscription
========================= */
// app.post('/api/create-subscription', async (req, res) => {
//   try {
//     const { email, paymentMethodId } = req.body;

//     if (!email) {
//       return res.status(400).json({
//         success: false,
//         error: 'Email is required'
//       });
//     }

//     console.log('💳 Creating subscription for:', email);

//     const user = await User.findOne({ email, role: 'consultant', isVerified: true });
    
//     if (!user) {
//       return res.status(400).json({
//         success: false,
//         error: 'Consultant not found or not verified'
//       });
//     }

//     let consultantProfile = await ConsultantProfile.findOne({ userId: user._id });

//     if (!consultantProfile) {
//       return res.status(400).json({
//         success: false,
//         error: 'Consultant profile not found'
//       });
//     }

//     // For mock payment, just update the subscription status directly
//     const subscriptionEndDate = new Date();
//     subscriptionEndDate.setFullYear(subscriptionEndDate.getFullYear() + 1);

//     await ConsultantProfile.updateOne(
//       { _id: consultantProfile._id },
//       {
//         $set: {
//           subscriptionStatus: 'active',
//           subscriptionEndDate: subscriptionEndDate,
//           updatedAt: new Date()
//         }
//       }
//     );

//     console.log('✅ Mock subscription activated for:', email);

//     res.json({
//       success: true,
//       message: 'Subscription activated successfully (mock)',
//       subscriptionStatus: 'active',
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

app.post('/api/create-subscription', async (req, res) => {
  try {
    const { email, paymentMethodId } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
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
      return res.status(400).json({
        success: false,
        error: 'Consultant profile not found'
      });
    }

    // Calculate subscription end date (1 year from now)
    const subscriptionEndDate = new Date();
    subscriptionEndDate.setFullYear(subscriptionEndDate.getFullYear() + 1);

    // Update the consultant profile with subscription status
    await ConsultantProfile.updateOne(
      { _id: consultantProfile._id },
      {
        $set: {
          subscriptionStatus: 'active',
          subscriptionEndDate: subscriptionEndDate,
          updatedAt: new Date()
        }
      }
    );

    console.log('✅ Subscription activated for:', email);
    console.log('   - Status: active');
    console.log('   - End Date:', subscriptionEndDate.toISOString().split('T')[0]);

    res.json({
      success: true,
      message: 'Subscription activated successfully',
      subscriptionStatus: 'active',
      subscriptionEndDate: subscriptionEndDate.toISOString().split('T')[0]
    });

  } catch (error) {
    console.error('❌ Error creating subscription:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to create subscription',
      details: error.message 
    });
  }
});
/* =========================
   11. Save Client Signup Data
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

    // Find or create the user
    let user = await User.findOne({ email });
    
    if (!user) {
      console.log('👤 User not found, creating new client user:', email);
      user = await User.create({
        email,
        role: 'client',
        isVerified: false,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log('✅ New client user created:', user._id);
    } else if (user.role !== 'client') {
      return res.status(400).json({
        success: false,
        error: `This email is registered as a ${user.role}. Please use the correct signup type.`
      });
    }

    // Now save/update the client profile
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
      console.log('✅ New client profile created for:', email);
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
      console.log('✅ Client profile updated for:', email);
    }

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
   12. Get Client Signup Data
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
   13. Save Client Profile
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
   14. Create Client Request
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
   15. Generate Match Suggestions
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
   16. Admin Endpoints
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
        client_company: s.requestId?.clientProfileId?.companyName,
        cv_url: s.consultantProfileId?.cvUrl,
        cv_file_name: s.consultantProfileId?.cvFileName
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
    
    // If status is accepted, create agenda items
    if (status === 'accepted') {
      await createAgendaFromMatch(match_id);
    }
    
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
    
    // Get availability for all consultants
    const allAvailability = await UserAvailability.find({
      userType: 'consultant',
      userId: { $in: consultants.map(c => c.userId?._id).filter(id => id) }
    });
    
    // Create availability map
    const availabilityMap = {};
    allAvailability.forEach(avail => {
      availabilityMap[avail.userId.toString()] = avail.availability;
    });
    
    const consultantsWithCounts = await Promise.all(consultants.map(async (consultant) => {
      const matchCount = await MatchSuggestion.countDocuments({ consultantProfileId: consultant._id });
      const consultantObj = consultant.toObject();
      
      // Get next available date
      let nextAvailable = null;
      const consultantAvailability = availabilityMap[consultant.userId?._id?.toString()] || [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Sort dates and find the next available date
      const availableDates = consultantAvailability
        .filter(block => block.status === 'available')
        .map(block => {
          const [year, month, day] = block.date.split('-').map(Number);
          return new Date(year, month - 1, day);
        })
        .filter(date => date >= today)
        .sort((a, b) => a - b);
      
      if (availableDates.length > 0) {
        nextAvailable = availableDates[0].toLocaleDateString();
      }
      
      return {
        ...consultantObj,
        email: consultant.userId?.email,
        user_created: consultant.userId?.createdAt,
        positions: consultant.positions?.map(p => p.name).join(', '),
        match_count: matchCount,
        cv_url: consultant.cvUrl,
        cv_file_name: consultant.cvFileName,
        dob: consultant.dob ? consultant.dob.toISOString().split('T')[0] : null,
        next_available: nextAvailable,
        availability_count: consultantAvailability.length
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
      availability_count: consultant.availability?.length || 0,
      cv_url: consultant.cvUrl,
      cv_file_name: consultant.cvFileName
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
        consultant_email: m.consultantProfileId?.userId?.email,
        cv_url: m.consultantProfileId?.cvUrl,
        cv_file_name: m.consultantProfileId?.cvFileName
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
   17. User Dashboard Data
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
   18. Check Email Status
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
   19. Get Positions List
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
   20. Stripe Webhook
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
   21. Submit Support Request
========================= */
app.post('/api/support/submit', async (req, res) => {
  try {
    const { name, email, role, subject, message, priority } = req.body;

    // Validate required fields
    const missingFields = [];
    if (!name || name.trim() === '') missingFields.push('name');
    if (!email || email.trim() === '') missingFields.push('email');
    if (!subject || subject.trim() === '') missingFields.push('subject');
    if (!message || message.trim() === '') missingFields.push('message');
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Missing required fields: ${missingFields.join(', ')}`
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format'
      });
    }

    console.log('📞 New support request received from:', email);

    // Generate unique ticket ID
    const ticketId = `SUP-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;
    
    // Find user if exists
    let user = null;
    try {
      user = await User.findOne({ email });
    } catch (userError) {
      console.warn('⚠️ Error finding user:', userError.message);
    }

    // Handle file attachments if any
    const attachments = [];
    if (req.files && req.files.attachments) {
      const files = Array.isArray(req.files.attachments) 
        ? req.files.attachments 
        : [req.files.attachments];
      
      for (const file of files) {
        try {
          // Validate file type
          const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
          if (!allowedTypes.includes(file.mimetype)) {
            continue; // Skip invalid file types
          }
          
          // Validate file size (max 5MB)
          if (file.size > 5 * 1024 * 1024) {
            continue; // Skip files over 5MB
          }
          
          // Generate unique filename
          const timestamp = Date.now();
          const randomString = crypto.randomBytes(8).toString('hex');
          const ext = path.extname(file.name);
          const sanitizedName = file.name
            .replace(ext, '')
            .replace(/[^a-zA-Z0-9]/g, '-')
            .toLowerCase()
            .substring(0, 30);
          
          const filename = `support_${timestamp}_${randomString}_${sanitizedName}${ext}`;
          const uploadPath = path.join(__dirname, 'public/uploads/support', filename);
          
          // Ensure directory exists
          const uploadDir = path.join(__dirname, 'public/uploads/support');
          if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
          }
          
          await file.mv(uploadPath);
          attachments.push(`/uploads/support/${filename}`);
          console.log('📎 Attachment saved:', filename);
        } catch (fileError) {
          console.error('❌ Error saving attachment:', fileError);
        }
      }
    }

    // Create support request
    const supportRequest = await SupportRequest.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      role: role || 'other',
      subject: subject.trim(),
      message: message.trim(),
      priority: priority || 'normal',
      status: 'new',
      ticketId,
      userId: user ? user._id : null,
      attachments,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    console.log('✅ Support request created with ticket ID:', ticketId);

    // Send confirmation email to user
    let emailSent = false;
    try {
      await sendSupportConfirmationEmail(email, name, ticketId, subject);
      emailSent = true;
      console.log(`📧 Confirmation email sent to ${email}`);
    } catch (emailError) {
      console.error('❌ Failed to send confirmation email:', emailError);
    }

    // Send notification to admins
    try {
      await notifyAdminsOfNewSupportRequest(supportRequest);
    } catch (notifyError) {
      console.error('❌ Failed to notify admins:', notifyError);
    }

    // Return success response
    res.status(201).json({
      success: true,
      message: 'Support request submitted successfully',
      ticketId: supportRequest.ticketId,
      emailSent,
      data: {
        ticketId: supportRequest.ticketId,
        name: supportRequest.name,
        email: supportRequest.email,
        subject: supportRequest.subject,
        status: supportRequest.status,
        createdAt: supportRequest.createdAt
      }
    });

  } catch (error) {
    console.error('❌ Error submitting support request:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to submit support request',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/* =========================
   22. Admin Support Endpoints
========================= */

// Get all support requests (with filters)
app.get('/api/admin/support-requests', async (req, res) => {
  try {
    const { status, priority, role, page = 1, limit = 20, search } = req.query;
    
    const query = {};
    
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (role) query.role = role;
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { subject: { $regex: search, $options: 'i' } },
        { ticketId: { $regex: search, $options: 'i' } }
      ];
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const total = await SupportRequest.countDocuments(query);
    const requests = await SupportRequest.find(query)
      .sort({ priority: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('userId', 'email role isVerified');
    
    // Get reply counts for each request
    const requestsWithData = await Promise.all(requests.map(async (request) => {
      const replyCount = await SupportReply.countDocuments({ supportRequestId: request._id });
      return {
        ...request.toObject(),
        replyCount
      };
    }));
    
    res.json({
      success: true,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit)),
      requests: requestsWithData
    });
    
  } catch (error) {
    console.error('Error fetching support requests:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Database error' 
    });
  }
});

// Get single support request with replies
app.get('/api/admin/support-requests/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const request = await SupportRequest.findById(id)
      .populate('userId', 'email role isVerified')
      .populate('assignedTo', 'email');
    
    if (!request) {
      return res.status(404).json({ 
        success: false, 
        error: 'Support request not found' 
      });
    }
    
    const replies = await SupportReply.find({ supportRequestId: id })
      .populate('userId', 'email role')
      .sort({ createdAt: 1 });
    
    res.json({
      success: true,
      request,
      replies,
      replyCount: replies.length
    });
    
  } catch (error) {
    console.error('Error fetching support request:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Database error' 
    });
  }
});

// Add reply to support request
app.post('/api/admin/support-requests/:id/reply', async (req, res) => {
  try {
    const { id } = req.params;
    const { message, isInternal = false } = req.body;
    const adminId = req.body.adminId; // You'd get this from auth middleware
    
    if (!message || message.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }
    
    const request = await SupportRequest.findById(id);
    if (!request) {
      return res.status(404).json({ 
        success: false, 
        error: 'Support request not found' 
      });
    }
    
    // Find admin user
    const admin = await User.findOne({ role: 'admin' });
    if (!admin) {
      return res.status(400).json({ 
        success: false, 
        error: 'Admin not found' 
      });
    }
    
    // Create reply
    const reply = await SupportReply.create({
      supportRequestId: id,
      userId: admin._id,
      userRole: 'admin',
      message: message.trim(),
      isInternal: isInternal === true,
      createdAt: new Date()
    });
    
    // Update request status
    await SupportRequest.updateOne(
      { _id: id },
      { 
        $set: { 
          status: 'in_progress',
          updatedAt: new Date()
        } 
      }
    );
    
    // If not internal, send email notification to user
    if (!isInternal) {
      try {
        await sendSupportReplyEmail(request.email, request.name, request.ticketId, message);
      } catch (emailError) {
        console.error('Failed to send reply email:', emailError);
      }
    }
    
    res.json({
      success: true,
      message: 'Reply added successfully',
      reply
    });
    
  } catch (error) {
    console.error('Error adding reply:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Database error' 
    });
  }
});

// Update support request status
app.put('/api/admin/support-requests/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const validStatuses = ['new', 'in_progress', 'resolved', 'closed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status value'
      });
    }
    
    const updateData = {
      status,
      updatedAt: new Date()
    };
    
    if (status === 'resolved') {
      updateData.resolvedAt = new Date();
    }
    
    await SupportRequest.updateOne(
      { _id: id },
      { $set: updateData }
    );
    
    res.json({
      success: true,
      message: 'Status updated successfully'
    });
    
  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Database error' 
    });
  }
});

// Assign support request to admin
app.put('/api/admin/support-requests/:id/assign', async (req, res) => {
  try {
    const { id } = req.params;
    const { adminId } = req.body;
    
    const admin = await User.findById(adminId);
    if (!admin || admin.role !== 'admin') {
      return res.status(400).json({
        success: false,
        error: 'Invalid admin ID'
      });
    }
    
    await SupportRequest.updateOne(
      { _id: id },
      { 
        $set: { 
          assignedTo: adminId,
          updatedAt: new Date()
        } 
      }
    );
    
    res.json({
      success: true,
      message: 'Request assigned successfully'
    });
    
  } catch (error) {
    console.error('Error assigning request:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Database error' 
    });
  }
});

// Get support stats for admin dashboard
app.get('/api/admin/support-stats', async (req, res) => {
  try {
    const total = await SupportRequest.countDocuments();
    const newRequests = await SupportRequest.countDocuments({ status: 'new' });
    const inProgress = await SupportRequest.countDocuments({ status: 'in_progress' });
    const resolved = await SupportRequest.countDocuments({ status: 'resolved' });
    const closed = await SupportRequest.countDocuments({ status: 'closed' });
    
    const priorityStats = {
      low: await SupportRequest.countDocuments({ priority: 'low' }),
      normal: await SupportRequest.countDocuments({ priority: 'normal' }),
      high: await SupportRequest.countDocuments({ priority: 'high' }),
      critical: await SupportRequest.countDocuments({ priority: 'critical' })
    };
    
    const avgResponseTime = await calculateAverageResponseTime();
    
    res.json({
      success: true,
      stats: {
        total,
        new: newRequests,
        inProgress,
        resolved,
        closed,
        byPriority: priorityStats,
        avgResponseTime
      }
    });
    
  } catch (error) {
    console.error('Error fetching support stats:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Database error' 
    });
  }
});

// Helper function to calculate average response time
async function calculateAverageResponseTime() {
  try {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    const replies = await SupportReply.find({
      createdAt: { $gte: oneWeekAgo },
      isInternal: false
    }).populate('supportRequestId');
    
    let totalResponseTime = 0;
    let count = 0;
    
    for (const reply of replies) {
      const request = reply.supportRequestId;
      if (request) {
        const responseTime = reply.createdAt - request.createdAt;
        totalResponseTime += responseTime;
        count++;
      }
    }
    
    if (count === 0) return 0;
    
    const avgMs = totalResponseTime / count;
    const avgHours = Math.round(avgMs / (1000 * 60 * 60) * 10) / 10;
    return avgHours;
    
  } catch (error) {
    console.error('Error calculating average response time:', error);
    return 0;
  }
}

// Send reply email to user
async function sendSupportReplyEmail(email, name, ticketId, message) {
  try {
    let sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
    
    sendSmtpEmail.sender = {
      name: "Web Consultant Hub Support",
      email: process.env.EMAIL_FROM || 'support@webconsultanthub.com'
    };
    
    sendSmtpEmail.to = [{ 
      email: email,
      name: name
    }];
    
    sendSmtpEmail.subject = `New Reply to Your Support Ticket #${ticketId}`;
    
    sendSmtpEmail.htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Support Reply</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #667eea; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">Support Team Reply</h1>
        </div>
        
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #ddd; border-top: none;">
          <h2 style="color: #444; margin-top: 0;">Hello ${name},</h2>
          
          <p>Our support team has replied to your ticket <strong>#${ticketId}</strong>:</p>
          
          <div style="margin: 20px 0; padding: 15px; background: white; border-left: 4px solid #667eea; border-radius: 0 5px 5px 0;">
            <p style="margin: 0; white-space: pre-wrap;">${message}</p>
          </div>
          
          <p>You can reply to this email to continue the conversation.</p>
          
          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
          
          <p style="color: #999; font-size: 12px; text-align: center;">
            &copy; ${new Date().getFullYear()} Web Consultant Hub. All rights reserved.
          </p>
        </div>
      </html>
    `;
    
    const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
    return { success: true, messageId: data.messageId };
    
  } catch (error) {
    console.error('❌ Failed to send reply email:', error);
    throw error;
  }
}

/* =========================
   23. User Support Endpoints
========================= */

// Get user's support requests
app.get('/api/user/support-requests/:email', async (req, res) => {
  try {
    const { email } = req.params;
    
    const requests = await SupportRequest.find({ email: email.toLowerCase() })
      .sort({ createdAt: -1 });
    
    const requestsWithData = await Promise.all(requests.map(async (request) => {
      const replyCount = await SupportReply.countDocuments({ 
        supportRequestId: request._id,
        isInternal: false 
      });
      
      const lastReply = await SupportReply.findOne({ 
        supportRequestId: request._id,
        isInternal: false 
      }).sort({ createdAt: -1 });
      
      return {
        ...request.toObject(),
        replyCount,
        lastReplyAt: lastReply?.createdAt
      };
    }));
    
    res.json({
      success: true,
      count: requestsWithData.length,
      requests: requestsWithData
    });
    
  } catch (error) {
    console.error('Error fetching user support requests:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Database error' 
    });
  }
});

// Get single support request with replies (for user)
app.get('/api/user/support-requests/:email/:ticketId', async (req, res) => {
  try {
    const { email, ticketId } = req.params;
    
    const request = await SupportRequest.findOne({ 
      email: email.toLowerCase(),
      ticketId 
    });
    
    if (!request) {
      return res.status(404).json({ 
        success: false, 
        error: 'Support request not found' 
      });
    }
    
    const replies = await SupportReply.find({ 
      supportRequestId: request._id,
      isInternal: false 
    })
      .populate('userId', 'email role')
      .sort({ createdAt: 1 });
    
    res.json({
      success: true,
      request,
      replies
    });
    
  } catch (error) {
    console.error('Error fetching support request:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Database error' 
    });
  }
});

// Check ticket status (public endpoint, no auth required)
app.get('/api/support/ticket/:ticketId', async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { email } = req.query;
    
    const query = { ticketId };
    if (email) {
      query.email = email.toLowerCase();
    }
    
    const request = await SupportRequest.findOne(query);
    
    if (!request) {
      return res.status(404).json({ 
        success: false, 
        error: 'Ticket not found' 
      });
    }
    
    // Only return limited information
    res.json({
      success: true,
      ticket: {
        ticketId: request.ticketId,
        status: request.status,
        subject: request.subject,
        createdAt: request.createdAt,
        updatedAt: request.updatedAt,
        resolvedAt: request.resolvedAt
      }
    });
    
  } catch (error) {
    console.error('Error checking ticket status:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Database error' 
    });
  }
});

/* =========================
   24. Availability Calendar Endpoints (Fixed for Email Lookup)
========================= */
/* =========================
   Get Availability (FIXED - Use local date strings for keys)
========================= */
/* =========================
   Get Availability for Admin (Enhanced)
========================= */
app.get('/api/availability/:userType/:userId', async (req, res) => {
  try {
    const { userType, userId } = req.params;
    const months = parseInt(req.query.months) || 6;
    const showAgenda = req.query.showAgenda === 'true';

    console.log(`📅 Fetching availability for ${userType}: ${userId}`);

    // Calculate date range (next 6 months)
    const today = new Date();
    const startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endDate = new Date(today.getFullYear(), today.getMonth() + months, today.getDate());

    let availability = {};
    let agenda = [];

    // Find the user
    let user = null;
    
    if (userId.includes('@')) {
      const decodedEmail = decodeURIComponent(userId);
      console.log('🔍 Looking up user by email:', decodedEmail);
      user = await User.findOne({ email: decodedEmail });
    } else if (mongoose.Types.ObjectId.isValid(userId)) {
      console.log('🔍 Looking up user by ID:', userId);
      user = await User.findById(userId);
    }
    
    if (!user && userId !== 'all') {
      console.log('❌ User not found for:', userId);
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    if (userId === 'all' && userType === 'admin') {
      // Admin view - get all consultants with their profiles
      const consultants = await ConsultantProfile.find({})
        .populate('userId')
        .populate('positions');
      
      const consultantUserIds = consultants.map(c => c.userId?._id).filter(id => id);
      
      // Get all availability data
      const allAvailability = await UserAvailability.find({
        userType: 'consultant',
        userId: { $in: consultantUserIds }
      });
      
      // Create a map of availability by consultant
      const consultantAvailabilityMap = {};
      allAvailability.forEach(avail => {
        consultantAvailabilityMap[avail.userId.toString()] = avail.availability;
      });
      
      // Build availability for each consultant
      consultants.forEach(consultant => {
        const consultantId = consultant.userId?._id?.toString();
        if (!consultantId) return;
        
        const consultantAvail = consultantAvailabilityMap[consultantId] || [];
        
        consultantAvail.forEach(block => {
          // Parse the date string
          const [year, month, day] = block.date.split('-').map(Number);
          const blockDate = new Date(year, month - 1, day);
          
          if (blockDate >= startDate && blockDate <= endDate) {
            if (!availability[block.date]) {
              availability[block.date] = {
                availableCount: 0,
                totalCount: consultants.length,
                consultants: []
              };
            }
            
            // Add consultant to this date's list
            availability[block.date].consultants.push({
              userId: consultant.userId._id,
              name: consultant.fullName || consultant.userId?.email,
              status: block.status,
              timeRange: block.status === 'available' ? { start: block.startTime, end: block.endTime } : null
            });
            
            // Count available consultants separately
            if (block.status === 'available') {
              availability[block.date].availableCount++;
            }
          }
        });
      });
      
      console.log(`📊 Admin aggregated availability for ${Object.keys(availability).length} dates`);
      
    } else if (user) {
      console.log(`✅ Found user: ${user.email} (${user._id})`);
      
      const userAvailability = await UserAvailability.findOne({
        userId: user._id,
        userType: user.role
      });
      
      if (userAvailability && userAvailability.availability) {
        console.log(`📊 Found ${userAvailability.availability.length} availability blocks`);
        
        userAvailability.availability.forEach(block => {
          // Parse the date string
          const [year, month, day] = block.date.split('-').map(Number);
          const blockDate = new Date(year, month - 1, day);
          
          if (blockDate >= startDate && blockDate <= endDate) {
            availability[block.date] = {
              status: block.status,
              timeRange: block.status === 'available' ? { start: block.startTime, end: block.endTime } : null,
              notes: block.notes
            };
            console.log(`  ✅ Added ${block.date}: ${block.status}`);
          }
        });
      }
    }

    res.json({
      success: true,
      availability,
      agenda,
      dateRange: {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0]
      }
    });

  } catch (error) {
    console.error('❌ Error fetching availability:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch availability',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});
// Save availability for user (FIXED)

/* =========================
   24. Save Availability (New Format Only)
========================= */
/* =========================
   Save Availability (FIXED - Store all statuses)
========================= */
app.post('/api/availability/save', async (req, res) => {
  try {
    const { userId, userType, date, status, timeRange, notes } = req.body;

    if (!userId || !userType || !date || !status) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: userId, userType, date, status'
      });
    }

    console.log(`📅 Saving availability for ${userType} ${userId} on ${date}: ${status}`);

    // Find user
    let user = null;
    
    if (userId.includes('@')) {
      user = await User.findOne({ email: userId });
    } else if (mongoose.Types.ObjectId.isValid(userId)) {
      user = await User.findById(userId);
    }
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    if (user.role !== userType) {
      return res.status(400).json({
        success: false,
        error: `User role mismatch. Expected ${userType}, found ${user.role}`
      });
    }

    // Find or create user availability document
    let userAvailability = await UserAvailability.findOne({
      userId: user._id,
      userType: user.role
    });
    
    if (!userAvailability) {
      userAvailability = new UserAvailability({
        userId: user._id,
        userType: user.role,
        availability: []
      });
    }

    // Store date as string directly
    const dateKey = date; // Already in YYYY-MM-DD format
    
    console.log(`📅 Storing date: ${date} -> ${dateKey}`);
    
    // Check if availability for this date already exists
    const existingIndex = userAvailability.availability.findIndex(block => 
      block.date === dateKey
    );

    // Create the availability block based on status
    let availabilityBlock;
    
    if (status === 'available') {
      availabilityBlock = {
        date: dateKey,
        status: 'available',
        startTime: timeRange?.start || '09:00',
        endTime: timeRange?.end || '17:00',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        notes: notes || ''
      };
    } else if (status === 'busy') {
      availabilityBlock = {
        date: dateKey,
        status: 'busy',
        startTime: '',
        endTime: '',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        notes: notes || 'Currently on a project'
      };
    } else if (status === 'unavailable') {
      availabilityBlock = {
        date: dateKey,
        status: 'unavailable',
        startTime: '',
        endTime: '',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        notes: notes || 'Not available'
      };
    } else {
      return res.status(400).json({
        success: false,
        error: 'Invalid status value'
      });
    }

    // Add or update the availability block
    if (existingIndex !== -1) {
      userAvailability.availability[existingIndex] = availabilityBlock;
      console.log(`✏️ Updated ${status} for ${dateKey}`);
    } else {
      userAvailability.availability.push(availabilityBlock);
      console.log(`➕ Added ${status} for ${dateKey}`);
    }

    userAvailability.updatedAt = new Date();
    await userAvailability.save();

    console.log(`✅ Availability saved for ${dateKey}: ${status}`);

    res.json({
      success: true,
      message: 'Availability saved successfully',
      date: dateKey,
      status,
      timeRange: status === 'available' ? timeRange : null
    });

  } catch (error) {
    console.error('❌ Error saving availability:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to save availability',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});
/* =========================
   25. Agenda Widget Endpoint (FIXED)
========================= */
/* =========================
   Get Availability (FIXED - Use string dates)
========================= */
app.get('/api/availability/:userType/:userId', async (req, res) => {
  try {
    const { userType, userId } = req.params;
    const months = parseInt(req.query.months) || 6;
    const showAgenda = req.query.showAgenda === 'true';

    console.log(`📅 Fetching availability for ${userType}: ${userId}`);

    // Calculate date range (next 6 months)
    const today = new Date();
    const startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endDate = new Date(today.getFullYear(), today.getMonth() + months, today.getDate());

    let availability = {};
    let agenda = [];

    // Find the user
    let user = null;
    
    if (userId.includes('@')) {
      const decodedEmail = decodeURIComponent(userId);
      console.log('🔍 Looking up user by email:', decodedEmail);
      user = await User.findOne({ email: decodedEmail });
    } else if (mongoose.Types.ObjectId.isValid(userId)) {
      console.log('🔍 Looking up user by ID:', userId);
      user = await User.findById(userId);
    }
    
    if (!user && userId !== 'all') {
      console.log('❌ User not found for:', userId);
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    if (userId === 'all' && userType === 'admin') {
      // Admin view - get all consultants
      const consultants = await ConsultantProfile.find({ subscriptionStatus: 'active' });
      const consultantUserIds = consultants.map(c => c.userId);
      
      const allAvailability = await UserAvailability.find({
        userType: 'consultant',
        userId: { $in: consultantUserIds }
      });
      
      allAvailability.forEach(userAvail => {
        userAvail.availability.forEach(block => {
          // Parse the date string
          const [year, month, day] = block.date.split('-').map(Number);
          const blockDate = new Date(year, month - 1, day);
          
          if (blockDate >= startDate && blockDate <= endDate) {
            if (!availability[block.date]) {
              availability[block.date] = {
                availableCount: 1,
                totalCount: consultants.length,
                consultants: [{
                  userId: userAvail.userId,
                  timeRange: { start: block.startTime, end: block.endTime }
                }]
              };
            } else {
              availability[block.date].availableCount++;
              availability[block.date].consultants.push({
                userId: userAvail.userId,
                timeRange: { start: block.startTime, end: block.endTime }
              });
            }
          }
        });
      });
      
    } else if (user) {
      console.log(`✅ Found user: ${user.email} (${user._id})`);
      
      const userAvailability = await UserAvailability.findOne({
        userId: user._id,
        userType: user.role
      });
      
      console.log(`📊 UserAvailability found:`, userAvailability ? 'Yes' : 'No');
      
      if (userAvailability && userAvailability.availability) {
        console.log(`📊 Found ${userAvailability.availability.length} availability blocks`);
        
        userAvailability.availability.forEach(block => {
          // Parse the date string
          const [year, month, day] = block.date.split('-').map(Number);
          const blockDate = new Date(year, month - 1, day);
          
          console.log(`  📅 Block date: ${block.date} -> ${blockDate.toDateString()}`);
          console.log(`  📅 Start date: ${startDate.toDateString()}`);
          console.log(`  📅 End date: ${endDate.toDateString()}`);
          
          if (blockDate >= startDate && blockDate <= endDate) {
            availability[block.date] = {
              status: block.status,
              timeRange: { start: block.startTime, end: block.endTime },
              notes: block.notes
            };
            console.log(`  ✅ Added ${block.date}: ${block.status}`);
          } else {
            console.log(`  ⏭️ Skipped date (out of range)`);
          }
        });
        
        console.log(`📊 Availability keys after processing:`, Object.keys(availability));
      } else {
        console.log('⚠️ No availability found in UserAvailability collection');
      }

      // Fetch agenda items if requested
      if (showAgenda) {
        const agendaItems = await AgendaItem.find({
          userId: user._id,
          startDate: { $gte: startDate, $lte: endDate },
          status: { $in: ['scheduled', 'in_progress'] }
        }).sort({ startDate: 1 });
        
        agenda = agendaItems.map(item => ({
          id: item._id,
          title: item.title,
          type: item.type,
          date: item.startDate.toISOString().split('T')[0],
          time: item.startTime,
          status: item.status,
          meetingLink: item.meetingLink
        }));
      }
    }

    console.log(`📤 Returning availability for ${Object.keys(availability).length} dates:`, Object.keys(availability));
    
    res.json({
      success: true,
      availability,
      agenda,
      dateRange: {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0]
      }
    });

  } catch (error) {
    console.error('❌ Error fetching availability:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch availability',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});
// Get agenda for dashboard widget
app.get('/api/agenda/:userType/:userId', async (req, res) => {
  try {
    const { userType, userId } = req.params;

    console.log(`📋 Fetching agenda for ${userType}: ${userId}`);

    // Find user by email or ID
    let user = null;
    
    if (userId.includes('@')) {
      user = await User.findOne({ email: userId });
    } else if (mongoose.Types.ObjectId.isValid(userId)) {
      user = await User.findById(userId);
    }
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const now = new Date();
    const sixMonthsLater = new Date();
    sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6);

    // Get agenda items from database
    const agendaItems = await AgendaItem.find({
      userId: user._id,
      startDate: { $gte: now, $lte: sixMonthsLater }
    }).sort({ startDate: 1 });

    let currentMissions = [];
    let upcomingEngagements = [];
    let pendingRequests = [];

    // If no agenda items in the database, try to derive from matches and requests
    if (agendaItems.length === 0 && user.role === 'consultant') {
      // Get consultant profile
      const consultantProfile = await ConsultantProfile.findOne({ userId: user._id });
      
      if (consultantProfile) {
        // Get active matches from match suggestions
        const activeMatches = await MatchSuggestion.find({ 
          consultantProfileId: consultantProfile._id,
          adminReviewStatus: { $in: ['accepted', 'shortlisted', 'contacted'] }
        }).populate({
          path: 'requestId',
          populate: { path: 'clientProfileId' }
        });

        currentMissions = activeMatches
          .filter(match => match.adminReviewStatus === 'accepted')
          .map(match => ({
            id: match._id,
            title: match.requestId?.title || 'Project',
            client: match.requestId?.clientProfileId?.companyName,
            startDate: match.requestId?.startDate,
            endDate: match.requestId?.endDate,
            status: match.adminReviewStatus,
            type: 'mission'
          }));

        upcomingEngagements = activeMatches
          .filter(match => match.adminReviewStatus === 'shortlisted' || match.adminReviewStatus === 'contacted')
          .map(match => ({
            id: match._id,
            title: `Interview with ${match.requestId?.clientProfileId?.companyName}`,
            client: match.requestId?.clientProfileId?.companyName,
            date: match.createdAt,
            time: 'To be scheduled',
            type: 'interview',
            status: match.adminReviewStatus
          }));

        // Get pending match requests
        const pendingMatches = await MatchSuggestion.find({ 
          consultantProfileId: consultantProfile._id,
          adminReviewStatus: 'suggested'
        }).populate({
          path: 'requestId',
          populate: { path: 'clientProfileId' }
        });

        pendingRequests = pendingMatches.map(match => ({
          id: match._id,
          title: match.requestId?.title || 'Project Opportunity',
          sender: match.requestId?.clientProfileId?.companyName,
          matchScore: match.matchScore,
          message: `You have been matched with a ${match.requestId?.positionId?.name} opportunity`,
          type: 'match'
        }));
      }
    } else if (agendaItems.length === 0 && user.role === 'client') {
      // Get client profile
      const clientProfile = await ClientProfile.findOne({ userId: user._id });
      
      if (clientProfile) {
        // Get client requests
        const clientRequests = await ClientRequest.find({ 
          clientProfileId: clientProfile._id 
        });

        // Get active matches
        const activeMatches = await MatchSuggestion.find({ 
          requestId: { $in: clientRequests.map(r => r._id) },
          adminReviewStatus: { $in: ['accepted', 'shortlisted', 'contacted'] }
        }).populate('consultantProfileId');

        currentMissions = activeMatches
          .filter(match => match.adminReviewStatus === 'accepted')
          .map(match => ({
            id: match._id,
            title: match.consultantProfileId?.fullName || 'Consultant',
            consultant: match.consultantProfileId?.fullName,
            startDate: match.requestId?.startDate,
            endDate: match.requestId?.endDate,
            status: match.adminReviewStatus,
            type: 'mission'
          }));

        upcomingEngagements = activeMatches
          .filter(match => match.adminReviewStatus === 'shortlisted')
          .map(match => ({
            id: match._id,
            title: `Interview with ${match.consultantProfileId?.fullName}`,
            consultant: match.consultantProfileId?.fullName,
            date: match.createdAt,
            time: 'To be scheduled',
            type: 'interview',
            status: match.adminReviewStatus
          }));

        // Get pending requests status
        const pendingClientRequests = clientRequests.filter(r => 
          r.status === 'submitted' || r.status === 'under_review'
        );

        pendingRequests = pendingClientRequests.map(request => ({
          id: request._id,
          title: request.title,
          sender: 'Admin Team',
          status: request.status,
          message: `Your request "${request.title}" is ${request.status.replace('_', ' ')}`,
          type: 'request'
        }));

        // Get match suggestions
        const matchSuggestions = await MatchSuggestion.find({ 
          requestId: { $in: clientRequests.map(r => r._id) },
          adminReviewStatus: 'suggested'
        }).populate('consultantProfileId');

        pendingRequests.push(...matchSuggestions.map(match => ({
          id: match._id,
          title: `${match.consultantProfileId?.fullName} - ${match.matchScore}% match`,
          sender: 'System',
          matchScore: match.matchScore,
          message: `A consultant has been suggested for your request`,
          type: 'match'
        })));
      }
    } else {
      // Use agenda items from database
      currentMissions = agendaItems.filter(item => 
        item.type === 'mission' && 
        item.status === 'in_progress'
      ).map(item => ({
        id: item._id,
        title: item.title,
        description: item.description,
        startDate: item.startDate,
        endDate: item.endDate,
        status: item.status,
        metadata: item.metadata
      }));

      upcomingEngagements = agendaItems.filter(item => 
        (item.type === 'interview' || item.type === 'meeting') && 
        item.status === 'scheduled'
      ).map(item => ({
        id: item._id,
        title: item.title,
        type: item.type,
        date: item.startDate,
        time: item.startTime,
        location: item.location,
        meetingLink: item.meetingLink,
        status: item.status
      }));

      pendingRequests = agendaItems.filter(item => 
        item.type === 'deadline' && 
        item.status === 'pending'
      ).map(item => ({
        id: item._id,
        title: item.title,
        description: item.description,
        dueDate: item.startDate,
        status: item.status
      }));
    }

    res.json({
      success: true,
      agenda: {
        currentMissions,
        upcomingEngagements,
        pendingRequests
      }
    });

  } catch (error) {
    console.error('❌ Error fetching agenda:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch agenda',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/* =========================
   26. Create Agenda Item Endpoint
========================= */

// Create a new agenda item (for interviews, meetings, etc.)
app.post('/api/agenda/create', async (req, res) => {
  try {
    const { 
      userId, 
      userType, 
      title, 
      description, 
      type, 
      startDate, 
      endDate, 
      startTime, 
      endTime,
      location,
      meetingLink,
      matchId,
      requestId,
      consultantProfileId,
      clientProfileId,
      metadata 
    } = req.body;

    if (!userId || !userType || !title || !type || !startDate) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: userId, userType, title, type, startDate'
      });
    }

    // Find user
    const user = await User.findOne({ 
      $or: [
        { _id: userId },
        { email: userId }
      ]
    });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Create agenda item
    const agendaItem = new AgendaItem({
      userId: user._id,
      userType: user.role,
      title,
      description: description || '',
      type,
      status: 'scheduled',
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
      startTime: startTime || '',
      endTime: endTime || '',
      location: location || '',
      meetingLink: meetingLink || '',
      matchId: matchId || null,
      requestId: requestId || null,
      consultantProfileId: consultantProfileId || null,
      clientProfileId: clientProfileId || null,
      metadata: metadata || {},
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await agendaItem.save();

    console.log(`✅ Agenda item created: ${title} for user ${user.email}`);

    res.json({
      success: true,
      message: 'Agenda item created successfully',
      agendaItem
    });

  } catch (error) {
    console.error('❌ Error creating agenda item:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create agenda item',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/* =========================
   27. Update Agenda Item Endpoint
========================= */

// Update agenda item status or details
app.put('/api/agenda/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;
    const { status, startDate, endDate, startTime, endTime, meetingLink, notes } = req.body;

    const agendaItem = await AgendaItem.findById(itemId);
    
    if (!agendaItem) {
      return res.status(404).json({
        success: false,
        error: 'Agenda item not found'
      });
    }

    const updates = {};
    if (status) updates.status = status;
    if (startDate) updates.startDate = new Date(startDate);
    if (endDate) updates.endDate = new Date(endDate);
    if (startTime) updates.startTime = startTime;
    if (endTime) updates.endTime = endTime;
    if (meetingLink) updates.meetingLink = meetingLink;
    if (notes) updates.description = notes;
    
    updates.updatedAt = new Date();

    await AgendaItem.updateOne(
      { _id: itemId },
      { $set: updates }
    );

    console.log(`✅ Agenda item ${itemId} updated`);

    res.json({
      success: true,
      message: 'Agenda item updated successfully'
    });

  } catch (error) {
    console.error('❌ Error updating agenda item:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update agenda item',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/* =========================
   28. Delete Agenda Item Endpoint
========================= */

app.delete('/api/agenda/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;

    const result = await AgendaItem.deleteOne({ _id: itemId });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Agenda item not found'
      });
    }

    console.log(`✅ Agenda item ${itemId} deleted`);

    res.json({
      success: true,
      message: 'Agenda item deleted successfully'
    });

  } catch (error) {
    console.error('❌ Error deleting agenda item:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to delete agenda item',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/* =========================
   29. Auto-create Agenda Items from Matches
========================= */

// This function should be called when a match is accepted
async function createAgendaFromMatch(matchId) {
  try {
    const match = await MatchSuggestion.findById(matchId)
      .populate('requestId')
      .populate('consultantProfileId')
      .populate({
        path: 'requestId',
        populate: { path: 'clientProfileId' }
      });
    
    if (!match) {
      console.error(`Match ${matchId} not found`);
      return;
    }

    // Create agenda item for consultant
    const consultantUser = await User.findById(match.consultantProfileId.userId);
    if (consultantUser) {
      await AgendaItem.create({
        userId: consultantUser._id,
        userType: 'consultant',
        title: `Project: ${match.requestId.title}`,
        description: `You have been matched with ${match.requestId.clientProfileId.companyName} for ${match.requestId.title}`,
        type: 'mission',
        status: 'scheduled',
        startDate: match.requestId.startDate || new Date(),
        endDate: match.requestId.endDate || null,
        matchId: match._id,
        requestId: match.requestId._id,
        consultantProfileId: match.consultantProfileId._id,
        clientProfileId: match.requestId.clientProfileId._id,
        metadata: {
          matchScore: match.matchScore,
          companyName: match.requestId.clientProfileId.companyName
        }
      });
      console.log(`✅ Created agenda item for consultant ${consultantUser.email}`);
    }

    // Create agenda item for client
    const clientUser = await User.findById(match.requestId.clientProfileId.userId);
    if (clientUser) {
      await AgendaItem.create({
        userId: clientUser._id,
        userType: 'client',
        title: `Consultant: ${match.consultantProfileId.fullName}`,
        description: `${match.consultantProfileId.fullName} has been matched for your request: ${match.requestId.title}`,
        type: 'mission',
        status: 'scheduled',
        startDate: match.requestId.startDate || new Date(),
        endDate: match.requestId.endDate || null,
        matchId: match._id,
        requestId: match.requestId._id,
        consultantProfileId: match.consultantProfileId._id,
        clientProfileId: match.requestId.clientProfileId._id,
        metadata: {
          matchScore: match.matchScore,
          consultantName: match.consultantProfileId.fullName
        }
      });
      console.log(`✅ Created agenda item for client ${clientUser.email}`);
    }

  } catch (error) {
    console.error('❌ Error creating agenda from match:', error);
  }
}


/* =========================
   MIGRATION: Move Legacy Availability to New Format (One-Time)
========================= */
app.post('/api/admin/migrate-to-new-availability', async (req, res) => {
  try {
    console.log('🔄 Starting one-time migration to new availability format...');
    
    // Find all consultants with availability data
    const consultants = await ConsultantProfile.find({
      availability: { $exists: true, $ne: [] }
    }).populate('userId');
    
    let migrated = 0;
    let totalBlocks = 0;
    
    for (const consultant of consultants) {
      if (!consultant.userId) {
        console.log(`⚠️ Skipping consultant ${consultant._id} - no user found`);
        continue;
      }
      
      if (!consultant.availability || consultant.availability.length === 0) {
        continue;
      }
      
      // Check if already have data in new format
      let userAvailability = await UserAvailability.findOne({
        userId: consultant.userId._id,
        userType: 'consultant'
      });
      
      if (!userAvailability) {
        userAvailability = new UserAvailability({
          userId: consultant.userId._id,
          userType: 'consultant',
          availability: []
        });
      }
      
      // Convert legacy availability blocks
      let newBlocks = 0;
      for (const legacyBlock of consultant.availability) {
        if (legacyBlock.startDate) {
          const dateKey = legacyBlock.startDate.toISOString().split('T')[0];
          const existingIndex = userAvailability.availability.findIndex(block => 
            block.date.toISOString().split('T')[0] === dateKey
          );
          
          if (existingIndex === -1) {
            userAvailability.availability.push({
              date: legacyBlock.startDate,
              status: 'available',
              startTime: legacyBlock.startTime || '09:00',
              endTime: legacyBlock.endTime || '17:00',
              timezone: legacyBlock.timezone || 'UTC',
              notes: 'Migrated from legacy data'
            });
            newBlocks++;
            totalBlocks++;
          }
        }
      }
      
      if (newBlocks > 0) {
        userAvailability.updatedAt = new Date();
        await userAvailability.save();
        migrated++;
        console.log(`✅ Migrated ${newBlocks} blocks for ${consultant.userId.email}`);
      }
    }
    
    console.log(`✅ Migration complete: ${migrated} consultants migrated, ${totalBlocks} total blocks migrated`);
    
    // Optional: Remove legacy availability data after migration
    if (req.body.removeLegacy === true) {
      await ConsultantProfile.updateMany(
        { availability: { $exists: true } },
        { $unset: { availability: "" } }
      );
      console.log('🗑️ Legacy availability data removed from ConsultantProfile');
    }
    
    res.json({
      success: true,
      message: 'Migration completed successfully',
      migrated,
      totalBlocks,
      legacyRemoved: req.body.removeLegacy || false
    });
    
  } catch (error) {
    console.error('❌ Migration error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});



// Debug endpoint to check admin availability data
app.get('/api/debug/admin-availability-data', async (req, res) => {
  try {
    const consultants = await ConsultantProfile.find({})
      .populate('userId');
    
    const allAvailability = await UserAvailability.find({
      userType: 'consultant'
    });
    
    const result = [];
    
    for (const consultant of consultants) {
      const availability = allAvailability.find(a => 
        a.userId.toString() === consultant.userId?._id?.toString()
      );
      
      result.push({
        name: consultant.fullName,
        email: consultant.userId?.email,
        subscriptionStatus: consultant.subscriptionStatus,
        availability: availability ? availability.availability : [],
        availabilityCount: availability ? availability.availability.length : 0
      });
    }
    
    res.json({
      success: true,
      consultants: result
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add this temporary debug endpoint
app.get('/api/debug/user-availability/:email', async (req, res) => {
  try {
    const { email } = req.params;
    
    // Find the user
    const user = await User.findOne({ email });
    if (!user) {
      return res.json({ success: false, error: 'User not found' });
    }
    
    console.log('🔍 Found user:', { id: user._id, email: user.email, role: user.role });
    
    // Find availability in UserAvailability collection
    const userAvailability = await UserAvailability.findOne({
      userId: user._id,
      userType: user.role
    });
    
    console.log('📦 UserAvailability data:', userAvailability);
    
    // Also check legacy availability
    const consultantProfile = await ConsultantProfile.findOne({ userId: user._id });
    console.log('👤 Consultant profile availability:', consultantProfile?.availability);
    
    res.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        role: user.role
      },
      userAvailability: userAvailability ? {
        id: userAvailability._id,
        userId: userAvailability.userId,
        userType: userAvailability.userType,
        availability: userAvailability.availability,
        count: userAvailability.availability.length
      } : null,
      legacyAvailability: consultantProfile?.availability || []
    });
    
  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Call this function when a match is accepted
// You can add this to your match status update endpoint

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
  console.log('   POST   /api/consultant/signup            - Complete consultant signup (with CV upload)');
  console.log('   GET    /api/get-consultant-signup-data   - Get consultant signup data');
  console.log('   GET    /api/download-cv/:userId          - Download consultant CV');
  console.log('   POST   /api/save-consultant-signup-data  - Save consultant signup data (legacy)');
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
console.log('   📞 SUPPORT ENDPOINTS:');
console.log('   POST   /api/support/submit                    - Submit support request');
console.log('   GET    /api/support/ticket/:ticketId          - Check ticket status (public)');
console.log('   GET    /api/user/support-requests/:email      - Get user support requests');
console.log('   GET    /api/user/support-requests/:email/:ticketId - Get specific request');
console.log('');
console.log('   👑 ADMIN SUPPORT ENDPOINTS:');
console.log('   GET    /api/admin/support-requests            - Get all support requests');
console.log('   GET    /api/admin/support-requests/:id        - Get request with replies');
console.log('   POST   /api/admin/support-requests/:id/reply  - Add reply to request');
console.log('   PUT    /api/admin/support-requests/:id/status - Update request status');
console.log('   PUT    /api/admin/support-requests/:id/assign - Assign to admin');
console.log('   GET    /api/admin/support-stats               - Get support statistics');

});