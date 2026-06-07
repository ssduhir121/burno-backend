
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

// Availability Sub-schema (legacy - kept for compatibility)
const availabilitySchema = new mongoose.Schema({
  startDate: { type: Date, default: null },
  endDate: { type: Date, default: null },
  startTime: { type: String, default: '' },
  endTime: { type: String, default: '' },
  timezone: { type: String, default: 'UTC' },
  isRecurring: { type: Boolean, default: false },
  recurrencePattern: { type: String, default: '' }
});

const consultantProfileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  
  // Basic Information
  fullName: { type: String, default: '' },
  phone: { type: String, default: '' },
  dob: { type: Date, default: null },
  ageRange: { type: String, default: '' }, // 18-24, 25-34, 35-44, 45-54, 55-64, 65+
  
  // Location
  baseCountry: { type: String, default: '' },
  baseCity: { type: String, default: '' },
  workModePreference: { type: String, enum: ['remote', 'on-site', 'hybrid'], default: 'remote' },
  travelWillingness: { type: Boolean, default: false },
  travelRadiusKm: { type: Number, default: null },
  preferredWorkLocation: { type: String, default: '' },
  
  // Professional Information
  yearsExperience: { type: String, default: '' }, // 0-2, 3-5, 6-10, 10+
  positions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Position' }],
  certificates: [certificateSchema],
  
  // CV/Resume
  cvUrl: { type: String, default: '' },
  cvFileName: { type: String, default: '' },
  cvUpdatedAt: { type: Date, default: null },
  
  // Social Links
  linkedinUrl: { type: String, default: '' },
  githubUrl: { type: String, default: '' },
  
  // Statistics
  rating: { type: Number, default: 0, min: 0, max: 5 },
  totalReviews: { type: Number, default: 0 },
  completedProjects: { type: Number, default: 0 },
  profileViews: { type: Number, default: 0 },
  earningsYtd: { type: Number, default: 0 }, // Year-to-date earnings in EUR
  
  // Financial
  hourlyRate: { type: Number, default: 0 }, // Hourly rate in EUR
  
  // Subscription
  subscriptionStatus: { 
    type: String, 
    enum: ['active', 'inactive', 'canceled', 'past_due', 'trialing'], 
    default: 'inactive' 
  },
  stripeCustomerId: { type: String, default: '' },
  stripeSubscriptionId: { type: String, default: '' },
  subscriptionEndDate: { type: Date, default: null },
  subscriptionStartDate: { type: Date, default: null },
  
  // Legacy compatibility
  availability: [availabilitySchema], // Kept for backward compatibility
  
  // Timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true // This automatically manages createdAt and updatedAt
});



// Add indexes for better query performance
consultantProfileSchema.index({ subscriptionStatus: 1 });
consultantProfileSchema.index({ 'positions': 1 });
consultantProfileSchema.index({ baseCountry: 1 });
consultantProfileSchema.index({ rating: -1 });

// Virtual for formatted location
consultantProfileSchema.virtual('location').get(function() {
  if (this.baseCity && this.baseCountry) {
    return `${this.baseCity}, ${this.baseCountry}`;
  } else if (this.baseCountry) {
    return this.baseCountry;
  }
  return 'Remote';
});

// Virtual for subscription active status
consultantProfileSchema.virtual('subscriptionActive').get(function() {
  return this.subscriptionStatus === 'active';
});

// Method to check if profile is complete
consultantProfileSchema.methods.isProfileComplete = function() {
  return !!(
    this.fullName && 
    this.fullName.trim() !== '' &&
    this.baseCountry &&
    this.positions && 
    this.positions.length > 0
  );
};



// Ensure virtuals are included in JSON output
consultantProfileSchema.set('toJSON', { virtuals: true });
consultantProfileSchema.set('toObject', { virtuals: true });

// Client Profile Schema
const clientProfileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  companyName: { type: String, default: '' },
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
    enum: ['suggested', 'contacted', 'interested', 'unavailable', 'shortlisted', 'rejected', 'accepted'],
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
  attachments: [{ type: String }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  resolvedAt: { type: Date, default: null }
});

// Support Reply Schema
const supportReplySchema = new mongoose.Schema({
  supportRequestId: { type: mongoose.Schema.Types.ObjectId, ref: 'SupportRequest', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userRole: { type: String, enum: ['consultant', 'client', 'admin'], required: true },
  message: { type: String, required: true },
  attachments: [{ type: String }],
  isInternal: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

// Update the availabilityBlockSchema to match frontend
const availabilityBlockSchema = new mongoose.Schema({
  date: { type: String, required: true },
  status: { type: String, enum: ['available', 'busy', 'limited', 'unavailable'], required: true },
  startTime: { type: String, default: '09:00' },
  endTime: { type: String, default: '17:00' },
  timezone: { type: String, default: 'UTC' },
  notes: { type: String, default: '' }
});

// User Availability Schema
const userAvailabilitySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userType: { type: String, enum: ['consultant', 'client', 'admin'], required: true },
  availability: [availabilityBlockSchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Agenda Item Schema
const agendaItemSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userType: { type: String, enum: ['consultant', 'client', 'admin'], required: true },
  matchId: { type: mongoose.Schema.Types.ObjectId, ref: 'MatchSuggestion', default: null },
  requestId: { type: mongoose.Schema.Types.ObjectId, ref: 'ClientRequest', default: null },
  consultantProfileId: { type: mongoose.Schema.Types.ObjectId, ref: 'ConsultantProfile', default: null },
  clientProfileId: { type: mongoose.Schema.Types.ObjectId, ref: 'ClientProfile', default: null },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  type: { type: String, enum: ['mission', 'interview', 'meeting', 'deadline', 'reminder'], required: true },
  status: { type: String, enum: ['scheduled', 'in_progress', 'completed', 'cancelled', 'pending'], default: 'scheduled' },
  startDate: { type: Date, required: true },
  endDate: { type: Date, default: null },
  startTime: { type: String, default: '' },
  endTime: { type: String, default: '' },
  duration: { type: Number, default: null },
  location: { type: String, default: '' },
  meetingLink: { type: String, default: '' },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  reminders: [{
    type: { type: String, enum: ['email', 'push', 'sms'], default: 'email' },
    sentAt: { type: Date, default: null },
    scheduledFor: { type: Date }
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Indexes
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
   Email Service with Brevo SMTP
========================= */

const nodemailer = require('nodemailer');

// Create SMTP transporter for Brevo
const smtpTransporter = nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 587,
  secure: false, // false for port 587, true for 465
  auth: {
    user: process.env.BREVO_SMTP_LOGIN, // Your Brevo email/login
    pass: process.env.BREVO_SMTP_KEY    // Your Brevo SMTP key (not API key)
  }
});

// Verify SMTP connection on startup
async function testBrevoConnection() {
  try {
    await smtpTransporter.verify();
    console.log('✅ Brevo SMTP connection successful');
    console.log(`   SMTP Host: smtp-relay.brevo.com:587`);
    console.log(`   SMTP User: ${process.env.BREVO_SMTP_LOGIN}`);
    return true;
  } catch (error) {
    console.error('❌ Brevo SMTP connection failed:', error.message);
    return false;
  }
}

const emailService = {
  sendMagicLinkEmail: async (email, magicLink, userType) => {
    try {
      const roleText = userType === 'consultant' ? 'Consultant' : (userType === 'admin' ? 'Admin' : 'Client');
      
      const htmlContent = `
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
      
      const textContent = `
        Your Magic Link for Web Consultant Hub (${roleText})
        
        Click the link below to sign in:
        ${magicLink}
        
        This link will expire in 15 minutes.
        
        If you didn't request this, please ignore this email.
      `;
      
      const mailOptions = {
        from: `"Web Consultant Hub" <${process.env.EMAIL_FROM || 'noreply@webconsultanthub.com'}>`,
        to: email,
        subject: `Your Magic Link for Web Consultant Hub`,
        html: htmlContent,
        text: textContent
      };
      
      const info = await smtpTransporter.sendMail(mailOptions);
      
      console.log(`📧 Email sent via Brevo SMTP to ${email}:`, info.messageId);
      
      return { 
        success: true, 
        messageId: info.messageId 
      };
      
    } catch (error) {
      console.error('❌ Failed to send email via Brevo SMTP:', error);
      throw error;
    }
  }
};

async function sendSupportConfirmationEmail(email, name, ticketId, subject) {
  try {
    const htmlContent = `
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
    
    const mailOptions = {
      from: `"Web Consultant Hub Support" <${process.env.EMAIL_FROM || 'support@webconsultanthub.com'}>`,
      to: email,
      subject: `Support Request Received - Ticket #${ticketId}`,
      html: htmlContent
    };
    
    const info = await smtpTransporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
    
  } catch (error) {
    console.error('❌ Failed to send support confirmation email:', error);
    throw error;
  }
}

// Update the other email functions similarly...
async function notifyAdminsOfNewSupportRequest(supportRequest) {
  try {
    const admins = await User.find({ role: 'admin' });
    
    if (admins.length === 0) {
      console.log('⚠️ No admin users found for notification');
      return;
    }
    
    const priorityColors = {
      low: '#3b82f6',
      normal: '#10b981',
      high: '#f59e0b',
      critical: '#ef4444'
    };
    
    const priorityLabels = {
      low: 'Low',
      normal: 'Normal',
      high: 'High',
      critical: 'Critical'
    };
    
    for (const admin of admins) {
      try {
        const htmlContent = `
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
        
        const mailOptions = {
          from: `"Web Consultant Hub Support" <${process.env.EMAIL_FROM || 'support@webconsultanthub.com'}>`,
          to: admin.email,
          subject: `[${priorityLabels[supportRequest.priority]}] New Support Request - ${supportRequest.ticketId}`,
          html: htmlContent
        };
        
        await smtpTransporter.sendMail(mailOptions);
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

async function sendSupportReplyEmail(email, name, ticketId, message) {
  try {
    const htmlContent = `
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
    
    const mailOptions = {
      from: `"Web Consultant Hub Support" <${process.env.EMAIL_FROM || 'support@webconsultanthub.com'}>`,
      to: email,
      subject: `New Reply to Your Support Ticket #${ticketId}`,
      html: htmlContent
    };
    
    const info = await smtpTransporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
    
  } catch (error) {
    console.error('❌ Failed to send reply email:', error);
    throw error;
  }
}

/* =========================
   Helper Functions
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
   Initialize Database with Default Data
========================= */

async function initializeDatabase() {
  try {
    console.log('🔄 Initializing database with default data...');

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
    version: '2.0.0',
    features: ['unified-auth', 'progressive-onboarding', 'consultant-auth', 'client-auth', 'magic-links', 'stripe', 'email', 'file-upload']
  });
});

/* =========================
   UNIFIED AUTHENTICATION ENDPOINTS (NEW)
========================= */

/* =========================
   1. Unified Email Entry (Single endpoint for both signup and login)
========================= */
// In the unified auth initiation endpoint (/api/auth/initiate), update the allowed user types:

app.post('/api/auth/initiate', async (req, res) => {
  try {
    const { email, userType } = req.body;

    if (!email || !userType) {
      return res.status(400).json({
        success: false,
        error: 'Email and userType are required'
      });
    }

    // ALLOW 'admin' as a valid user type
    if (!['consultant', 'client', 'admin'].includes(userType)) {
      return res.status(400).json({
        success: false,
        error: 'userType must be either "consultant", "client", or "admin"'
      });
    }

    console.log('🔐 Unified auth initiation for:', email, 'as', userType);

    const normalizedEmail = email.toLowerCase().trim();
    let user = await User.findOne({ email: normalizedEmail });
    let isNewUser = false;

    if (!user) {
      console.log('👤 Creating new user account for:', normalizedEmail);
      user = await User.create({
        email: normalizedEmail,
        role: userType,
        isVerified: false,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      isNewUser = true;
      
      // Only create profiles for consultants and clients, not admins
      if (userType === 'consultant') {
        await ConsultantProfile.create({
          userId: user._id,
          fullName: '',
          subscriptionStatus: 'inactive',
          createdAt: new Date(),
          updatedAt: new Date()
        });
        console.log('✅ Minimal consultant profile created');
      } else if (userType === 'client') {
        await ClientProfile.create({
          userId: user._id,
          companyName: '',
          contactName: '',
          createdAt: new Date(),
          updatedAt: new Date()
        });
        console.log('✅ Minimal client profile created');
      }
      // Admin users don't need a profile
    } else {
      if (user.role !== userType) {
        return res.status(400).json({
          success: false,
          error: `This email is registered as a ${user.role}. Please select the correct user type.`,
          registeredRole: user.role
        });
      }
      console.log('✅ Existing user found:', user.email);
    }

    // Generate magic link token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

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

    const magicLink = `${process.env.FRONTEND_URL}/auth/verify?token=${token}&email=${encodeURIComponent(normalizedEmail)}&type=${userType}`;

    // Send email
    let emailSent = false;
    let emailError = null;
    
    try {
      await emailService.sendMagicLinkEmail(normalizedEmail, magicLink, userType);
      emailSent = true;
      console.log(`📧 Magic link sent to ${normalizedEmail}`);
    } catch (error) {
      emailError = error.message;
      console.warn(`⚠️ Email sending failed for ${normalizedEmail}:`, error.message);
    }

    // Log email attempt
    try {
      await EmailLog.create({
        recipientEmail: normalizedEmail,
        emailType: isNewUser ? 'magic_link_signup' : 'magic_link_login',
        status: emailSent ? 'sent' : 'failed',
        errorMessage: emailError,
        sentAt: new Date()
      });
    } catch (logError) {
      console.error('Error logging email:', logError);
    }

    res.json({
      success: true,
      message: emailSent 
        ? `Magic link sent to ${normalizedEmail}. Check your inbox!` 
        : 'Account created! However, there was an issue sending the email. Please contact support.',
      email: normalizedEmail,
      userType: userType,
      isNewUser: isNewUser,
      emailSent: emailSent,
      expiresIn: '15 minutes'
    });

  } catch (error) {
    console.error('❌ Error in unified auth:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to initiate authentication',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/* =========================
   2. Unified Magic Link Verification (Returns dashboard data)
========================= */
/* =========================
   Unified Magic Link Verification (Returns dashboard data)
========================= */
app.post('/api/auth/verify', async (req, res) => {
  try {
    const { token, email, userType } = req.body;

    console.log('🔍 Verifying magic link:');
    console.log('   - Email:', email);
    console.log('   - UserType:', userType);
    console.log('   - Token:', token ? token.substring(0, 10) + '...' : 'MISSING');

    // Validate required fields
    if (!token || !email || !userType) {
      return res.status(400).json({
        success: false,
        error: 'Token, email, and userType are required'
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    
    // Find user with matching token that hasn't expired
    const user = await User.findOne({ 
      email: normalizedEmail,
      magicLinkToken: token,
      magicLinkExpiresAt: { $gt: new Date() }
    });

    if (!user) {
      console.log('❌ Invalid or expired token');
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired token. Please request a new magic link.'
      });
    }

    // Check role match
    if (user.role !== userType) {
      console.log('❌ Role mismatch:', { provided: userType, stored: user.role });
      return res.status(400).json({
        success: false,
        error: `This account is registered as a ${user.role}. Please use the correct login type.`
      });
    }

    console.log('✅ Token verified successfully for:', user.email);

    // IMMEDIATELY clear the token to prevent reuse (atomic operation)
    await User.updateOne(
      { _id: user._id, magicLinkToken: token }, // Ensure we only clear the exact token
      { 
        $set: { 
          magicLinkToken: null,
          magicLinkExpiresAt: null,
          isVerified: true,
          updatedAt: new Date()
        } 
      }
    );

    // Generate session token
    const sessionToken = crypto.randomBytes(32).toString('hex');

    // Get profile data and determine dashboard data
    let profile = null;
    let profileCompletion = {
      basicInfo: false,
      availability: false,
      payment: false,
      status: 'incomplete'
    };
    let dashboardData = {};

    // Handle different user roles
    if (user.role === 'consultant') {
      const consultantProfile = await ConsultantProfile.findOne({ userId: user._id })
        .populate('positions');
      
      profile = consultantProfile;
      
      if (consultantProfile) {
        // Check basic info completion
        profileCompletion.basicInfo = !!(consultantProfile.fullName && consultantProfile.fullName.trim() !== '');
        
        // Check availability from UserAvailability collection
        const userAvailability = await UserAvailability.findOne({ 
          userId: user._id, 
          userType: 'consultant' 
        });
        profileCompletion.availability = userAvailability && userAvailability.availability && userAvailability.availability.length > 0;
        
        // Check payment status
        profileCompletion.payment = consultantProfile.subscriptionStatus === 'active';
        
        // Update overall status
        if (profileCompletion.payment) {
          profileCompletion.status = 'complete';
        } else if (profileCompletion.basicInfo) {
          profileCompletion.status = 'partial';
        } else {
          profileCompletion.status = 'incomplete';
        }
        
        // Get upcoming agenda items
        const upcomingAgenda = await AgendaItem.find({
          userId: user._id,
          startDate: { $gte: new Date() },
          status: { $in: ['scheduled', 'in_progress'] }
        }).sort({ startDate: 1 }).limit(5);
        
        // Get recent matches
        const recentMatches = await MatchSuggestion.find({ 
          consultantProfileId: consultantProfile._id 
        })
          .sort({ createdAt: -1 })
          .limit(5)
          .populate({
            path: 'requestId',
            populate: { path: 'clientProfileId' }
          });
        
        dashboardData = {
          fullName: consultantProfile.fullName || '',
          subscriptionStatus: consultantProfile.subscriptionStatus,
          subscriptionEndDate: consultantProfile.subscriptionEndDate,
          matchCount: await MatchSuggestion.countDocuments({ consultantProfileId: consultantProfile._id }),
          activeMatches: await MatchSuggestion.countDocuments({ 
            consultantProfileId: consultantProfile._id,
            adminReviewStatus: { $in: ['shortlisted', 'contacted', 'accepted'] }
          }),
          upcomingAgenda: upcomingAgenda.map(item => ({
            id: item._id,
            title: item.title,
            type: item.type,
            date: item.startDate,
            time: item.startTime
          })),
          recentMatches: recentMatches.map(match => ({
            id: match._id,
            requestTitle: match.requestId?.title,
            companyName: match.requestId?.clientProfileId?.companyName,
            matchScore: match.matchScore,
            status: match.adminReviewStatus
          }))
        };
      }
      
    } else if (user.role === 'client') {
      const clientProfile = await ClientProfile.findOne({ userId: user._id });
      
      profile = clientProfile;
      
      if (clientProfile) {
        profileCompletion.basicInfo = !!(clientProfile.companyName && clientProfile.companyName.trim() !== '');
        profileCompletion.availability = true; // Clients don't need availability
        profileCompletion.payment = true; // Clients are free
        profileCompletion.status = profileCompletion.basicInfo ? 'complete' : 'partial';
        
        // Get recent requests
        const recentRequests = await ClientRequest.find({ clientProfileId: clientProfile._id })
          .sort({ createdAt: -1 })
          .limit(5)
          .populate('positionId');
        
        // Get upcoming interviews
        const upcomingInterviews = await AgendaItem.find({
          userId: user._id,
          type: 'interview',
          startDate: { $gte: new Date() },
          status: 'scheduled'
        }).sort({ startDate: 1 }).limit(5);
        
        dashboardData = {
          companyName: clientProfile.companyName || '',
          contactName: clientProfile.contactName || '',
          requestCount: await ClientRequest.countDocuments({ clientProfileId: clientProfile._id }),
          activeRequests: await ClientRequest.countDocuments({ 
            clientProfileId: clientProfile._id,
            status: { $in: ['submitted', 'under_review', 'contacting'] }
          }),
          recentRequests: recentRequests.map(req => ({
            id: req._id,
            title: req.title,
            position: req.positionId?.name,
            status: req.status,
            createdAt: req.createdAt
          })),
          upcomingInterviews: upcomingInterviews.map(interview => ({
            id: interview._id,
            title: interview.title,
            date: interview.startDate,
            time: interview.startTime,
            meetingLink: interview.meetingLink
          }))
        };
      }
      
    } else if (user.role === 'admin') {
      // Admin users have complete profiles by default
      profileCompletion = {
        basicInfo: true,
        availability: true,
        payment: true,
        status: 'complete'
      };
      
      // Get admin stats for dashboard
      const consultantTotal = await ConsultantProfile.countDocuments();
      const clientTotal = await ClientProfile.countDocuments();
      const requestTotal = await ClientRequest.countDocuments();
      const pendingMatches = await MatchSuggestion.countDocuments({ adminReviewStatus: 'suggested' });
      const newSupportTickets = await SupportRequest.countDocuments({ status: 'new' });
      
      dashboardData = {
        name: 'Admin',
        email: user.email,
        stats: {
          totalConsultants: consultantTotal,
          totalClients: clientTotal,
          totalRequests: requestTotal,
          pendingMatches: pendingMatches,
          newSupportTickets: newSupportTickets
        }
      };
    }

    console.log('✅ Sending success response - ALWAYS redirecting to dashboard');
    console.log('📊 Profile completion:', profileCompletion);
    console.log('👤 User role:', user.role);

    // ALWAYS redirect to dashboard (progressive onboarding)
    // Users will see a banner on dashboard to complete profile
    const redirectTo = '/dashboard';

    // Store session in memory or Redis if needed (optional)
    // For now, we'll rely on localStorage token on frontend

    res.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        isVerified: true,
        name: profile?.fullName || profile?.companyName || user.email?.split('@')[0]
      },
      token: sessionToken,
      profile,
      profileCompletion,
      dashboardData,
      redirectTo: redirectTo  // Always redirect to dashboard
    });

  } catch (error) {
    console.error('❌ Error verifying magic link:', error);
    res.status(500).json({ 
      success: false,
      error: 'Verification failed',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Clean up expired magic link tokens (run periodically)
app.post('/api/auth/cleanup-tokens', async (req, res) => {
  try {
    const result = await User.updateMany(
      { 
        magicLinkExpiresAt: { $lt: new Date() },
        magicLinkToken: { $ne: null }
      },
      { 
        $set: { 
          magicLinkToken: null,
          magicLinkExpiresAt: null 
        } 
      }
    );
    
    console.log(`🧹 Cleaned up ${result.modifiedCount} expired tokens`);
    res.json({ success: true, cleaned: result.modifiedCount });
  } catch (error) {
    console.error('Error cleaning up tokens:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
/* =========================
   3. Get Current User (Session check)
========================= */
app.get('/api/auth/me', async (req, res) => {
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
      message: 'Session is valid',
      user: {
        // In a real implementation, you'd decode the token and get user data
        // For now, we'll just return success
      }
    });

  } catch (error) {
    console.error('Session check error:', error);
    res.status(401).json({ 
      success: false, 
      error: 'Invalid session' 
    });
  }
});

/* =========================
   4. Check Email Status (Public - for frontend validation)
========================= */
app.get('/api/auth/check-email/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const { type } = req.query;

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.json({
        success: true,
        exists: false,
        message: 'Email is available for registration'
      });
    }

    // Determine if the role matches the requested type
    let isValidRole = true;
    if (type && user.role !== type) {
      isValidRole = false;
    }

    // Return the actual role from database
    res.json({
      success: true,
      exists: true,
      role: user.role,  // This will return 'admin' for admin users
      isValidRole: isValidRole,
      isVerified: user.isVerified,
      message: isValidRole 
        ? `Email is registered as a ${user.role}` 
        : `This email is registered as a ${user.role}, not as a ${type}`
    });

  } catch (error) {
    console.error('Error checking email:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to check email status' 
    });
  }
});

/* =========================
   CONSULTANT PROFILE ENDPOINTS
========================= */

/* =========================
   UPDATED CONSULTANT PROFILE ENDPOINTS
========================= */

/* =========================
   5. Complete Consultant Profile (Updated with ageRange, positions array)
========================= */
app.post('/api/consultant/complete-profile', async (req, res) => {
  try {
    const { 
      email, 
      fullName, 
      phone, 
      ageRange,
      baseCountry,
      yearsExperience,
      positions,
      jobTitle 
    } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    console.log('📝 Completing consultant profile for:', email);
    console.log('   Data:', { fullName, phone, ageRange, baseCountry, yearsExperience, positions });

    const user = await User.findOne({ email, role: 'consultant' });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Consultant not found'
      });
    }

    const consultantProfile = await ConsultantProfile.findOne({ userId: user._id });

    if (!consultantProfile) {
      return res.status(404).json({
        success: false,
        error: 'Consultant profile not found'
      });
    }

    const updateData = {
      updatedAt: new Date()
    };

    if (fullName) updateData.fullName = fullName;
    if (phone) updateData.phone = phone;
    if (baseCountry) updateData.baseCountry = baseCountry;
    if (yearsExperience) updateData.yearsExperience = yearsExperience;
    
    // Store ageRange as custom field (add to schema if needed)
    if (ageRange) updateData.ageRange = ageRange;

    await ConsultantProfile.updateOne(
      { _id: consultantProfile._id },
      { $set: updateData }
    );

    // Handle positions (areas of expertise)
    if (positions && Array.isArray(positions) && positions.length > 0) {
      const positionIds = [];
      for (const positionName of positions) {
        let position = await Position.findOne({ name: positionName });
        
        if (!position) {
          position = await Position.create({
            name: positionName,
            category: getPositionCategory(positionName),
            isActive: true,
            createdAt: new Date()
          });
        }
        positionIds.push(position._id);
      }
      
      await ConsultantProfile.updateOne(
        { _id: consultantProfile._id },
        { $addToSet: { positions: { $each: positionIds } } }
      );
    }

    console.log('✅ Consultant profile completed for:', email);

    res.json({
      success: true,
      message: 'Profile completed successfully',
      profileCompletion: {
        basicInfo: true,
        availability: false,
        payment: false
      }
    });

  } catch (error) {
    console.error('Error completing consultant profile:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to complete profile',
      details: error.message 
    });
  }
});

/* =========================
   6. Upload CV (Updated with better error handling)
========================= */
app.post('/api/consultant/upload-cv', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    if (!req.files || !req.files.cv) {
      return res.status(400).json({
        success: false,
        error: 'CV file is required'
      });
    }

    const user = await User.findOne({ email, role: 'consultant' });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Consultant not found'
      });
    }

    const cvFile = req.files.cv;
    const allowedExtensions = ['.pdf', '.doc', '.docx'];
    const fileExtension = path.extname(cvFile.name).toLowerCase();
    
    if (!allowedExtensions.includes(fileExtension)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid file type. Only PDF and Word documents are allowed.'
      });
    }

    const maxSize = 5 * 1024 * 1024;
    if (cvFile.size > maxSize) {
      return res.status(400).json({
        success: false,
        error: 'File size exceeds 5MB limit'
      });
    }

    const timestamp = Date.now();
    const randomString = crypto.randomBytes(8).toString('hex');
    const sanitizedName = cvFile.name
      .replace(fileExtension, '')
      .replace(/[^a-zA-Z0-9]/g, '-')
      .toLowerCase()
      .substring(0, 30);
    
    const filename = `cv_${user._id}_${sanitizedName}_${timestamp}_${randomString}${fileExtension}`;
    const uploadPath = path.join(__dirname, 'public/uploads/cv', filename);
    
    const uploadDir = path.join(__dirname, 'public/uploads/cv');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    await cvFile.mv(uploadPath);
    
    const cvUrl = `/uploads/cv/${filename}`;
    
    await ConsultantProfile.updateOne(
      { userId: user._id },
      { 
        $set: { 
          cvUrl: cvUrl,
          cvFileName: cvFile.name,
          cvUpdatedAt: new Date(),
          updatedAt: new Date()
        } 
      }
    );

    console.log('✅ CV uploaded for:', email);

    res.json({
      success: true,
      message: 'CV uploaded successfully',
      cvUrl: cvUrl,
      cvFileName: cvFile.name
    });

  } catch (error) {
    console.error('Error uploading CV:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to upload CV',
      details: error.message 
    });
  }
});

/* =========================
   8. Create Subscription (Updated with proper response)
========================= */
app.post('/api/consultant/create-subscription', async (req, res) => {
  try {
    const { email, paymentMethodId } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    console.log('💳 Creating subscription for:', email);

    const user = await User.findOne({ email, role: 'consultant' });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Consultant not found'
      });
    }

    const consultantProfile = await ConsultantProfile.findOne({ userId: user._id });

    if (!consultantProfile) {
      return res.status(404).json({
        success: false,
        error: 'Consultant profile not found'
      });
    }

    // For now, we'll use mock payment
    // In production, integrate with Stripe here
    
    const subscriptionEndDate = new Date();
    subscriptionEndDate.setFullYear(subscriptionEndDate.getFullYear() + 1);

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
   9. Get Consultant Profile (Updated with all fields)
========================= */
app.get('/api/consultant/profile/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const decodedEmail = decodeURIComponent(email);

    const user = await User.findOne({ email: decodedEmail, role: 'consultant' });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Consultant not found'
      });
    }

    const consultantProfile = await ConsultantProfile.findOne({ userId: user._id })
      .populate('positions');

    const userAvailability = await UserAvailability.findOne({
      userId: user._id,
      userType: 'consultant'
    });

    // Get subscription info
    const subscriptionEndDate = consultantProfile?.subscriptionEndDate;
    const subscriptionActive = consultantProfile?.subscriptionStatus === 'active';

    // Get earnings (mock data - replace with actual from database)
    const earningsYtd = consultantProfile?.earningsYtd || 0;
    
    // Get total reviews
    const totalReviews = consultantProfile?.totalReviews || 0;
    
    // Get member since
    const memberSince = user.createdAt ? user.createdAt.getFullYear() : 2024;

    res.json({
      success: true,
      profile: {
        ...consultantProfile.toObject(),
        email: user.email,
        subscriptionActive,
        subscriptionEndDate,
        earningsYtd,
        totalReviews,
        memberSince,
        ageRange: consultantProfile?.ageRange || '',
        cvFileName: consultantProfile?.cvFileName || '',
        cvUpdatedAt: consultantProfile?.cvUpdatedAt,
        nextBillingDate: subscriptionEndDate ? subscriptionEndDate.toISOString().split('T')[0] : null
      },
      availability: userAvailability?.availability || []
    });

  } catch (error) {
    console.error('Error fetching consultant profile:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch profile',
      details: error.message 
    });
  }
});

/* =========================
   15. Get Dashboard Data (Updated with all profile fields)
========================= */
app.get('/api/dashboard/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const decodedEmail = decodeURIComponent(email);

    const user = await User.findOne({ email: decodedEmail });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    let dashboardData = {
      user: {
        email: user.email,
        role: user.role,
        isVerified: user.isVerified
      }
    };

    if (user.role === 'consultant') {
      const consultantProfile = await ConsultantProfile.findOne({ userId: user._id })
        .populate('positions');
      
      const userAvailability = await UserAvailability.findOne({
        userId: user._id,
        userType: 'consultant'
      });

      const upcomingAgenda = await AgendaItem.find({
        userId: user._id,
        startDate: { $gte: new Date() },
        status: { $in: ['scheduled', 'in_progress'] }
      }).sort({ startDate: 1 }).limit(10);

      const recentMatches = await MatchSuggestion.find({ 
        consultantProfileId: consultantProfile?._id 
      })
        .sort({ createdAt: -1 })
        .limit(10)
        .populate({
          path: 'requestId',
          populate: { path: 'clientProfileId' }
        });

      // Calculate profile completion
      const basicInfoComplete = !!(consultantProfile?.fullName && consultantProfile?.fullName.trim() !== '');
      const availabilityComplete = userAvailability?.availability?.length > 0;
      const paymentComplete = consultantProfile?.subscriptionStatus === 'active';

      dashboardData.profile = {
        ...consultantProfile?.toObject(),
        fullName: consultantProfile?.fullName || '',
        title: consultantProfile?.positions?.[0]?.name || 'Strategic Consultant',
        baseCity: consultantProfile?.baseCity || '',
        baseCountry: consultantProfile?.baseCountry || '',
        rating: consultantProfile?.rating || 4.8,
        completedProjects: consultantProfile?.completedProjects || 12,
        hourlyRate: consultantProfile?.hourlyRate || 0,
        positions: consultantProfile?.positions || [],
        isVerified: user.isVerified,
        phone: consultantProfile?.phone || '',
        ageRange: consultantProfile?.ageRange || '',
        yearsExperience: consultantProfile?.yearsExperience || '',
        cvFileName: consultantProfile?.cvFileName || '',
        cvUpdatedAt: consultantProfile?.cvUpdatedAt,
        subscriptionActive: consultantProfile?.subscriptionStatus === 'active',
        subscriptionEndDate: consultantProfile?.subscriptionEndDate,
        earningsYtd: consultantProfile?.earningsYtd || 0,
        totalReviews: consultantProfile?.totalReviews || 0,
        memberSince: user.createdAt?.getFullYear() || 2024,
        nextBillingDate: consultantProfile?.subscriptionEndDate?.toISOString().split('T')[0]
      };
      
      dashboardData.availability = userAvailability?.availability || [];
      dashboardData.upcomingAgenda = upcomingAgenda;
      dashboardData.recentMatches = recentMatches;
      dashboardData.stats = {
        profileViews: consultantProfile?.profileViews || 0,
        matchRequests: await MatchSuggestion.countDocuments({ consultantProfileId: consultantProfile?._id }),
        interviews: await MatchSuggestion.countDocuments({ 
          consultantProfileId: consultantProfile?._id,
          adminReviewStatus: 'accepted'
        }),
        earnings: consultantProfile?.earningsYtd || 0
      };
      dashboardData.profileCompletion = {
        basicInfo: basicInfoComplete,
        availability: availabilityComplete,
        payment: paymentComplete,
        status: paymentComplete ? 'complete' : (basicInfoComplete ? 'partial' : 'incomplete')
      };
      
    } else if (user.role === 'client') {
      const clientProfile = await ClientProfile.findOne({ userId: user._id });

      const requests = await ClientRequest.find({ clientProfileId: clientProfile?._id })
        .populate('positionId')
        .sort({ createdAt: -1 })
        .limit(10);

      const upcomingInterviews = await AgendaItem.find({
        userId: user._id,
        type: 'interview',
        startDate: { $gte: new Date() },
        status: 'scheduled'
      }).sort({ startDate: 1 }).limit(10);

      dashboardData.profile = clientProfile;
      dashboardData.recentRequests = requests;
      dashboardData.upcomingInterviews = upcomingInterviews;
      dashboardData.stats = {
        requestCount: await ClientRequest.countDocuments({ clientProfileId: clientProfile?._id }),
        activeRequests: await ClientRequest.countDocuments({ 
          clientProfileId: clientProfile?._id,
          status: { $in: ['submitted', 'under_review', 'contacting'] }
        }),
        profileCompletion: {
          basicInfo: !!(clientProfile?.companyName && clientProfile?.contactName),
          availability: true,
          payment: true,
          status: (clientProfile?.companyName && clientProfile?.contactName) ? 'complete' : 'partial'
        }
      };
    }

    res.json({
      success: true,
      data: dashboardData
    });

  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch dashboard data',
      details: error.message 
    });
  }
});

/* =========================
   AVAILABILITY ENDPOINTS (Updated for new format)
========================= */

/* =========================
   20. Get Availability (Updated for new format)
========================= */
app.get('/api/availability/:userType/:userId', async (req, res) => {
  try {
    const { userType, userId } = req.params;
    const months = parseInt(req.query.months) || 6;

    console.log(`📅 Fetching availability for ${userType}: ${userId}`);

    const today = new Date();
    const startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endDate = new Date(today.getFullYear(), today.getMonth() + months, today.getDate());

    let availability = {};

    let user = null;
    
    if (userId.includes('@')) {
      const decodedEmail = decodeURIComponent(userId);
      user = await User.findOne({ email: decodedEmail });
    } else if (mongoose.Types.ObjectId.isValid(userId)) {
      user = await User.findById(userId);
    }
    
    if (!user && userId !== 'all') {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    if (userId === 'all' && userType === 'admin') {
      const consultants = await ConsultantProfile.find({ subscriptionStatus: 'active' });
      const consultantUserIds = consultants.map(c => c.userId);
      
      const allAvailability = await UserAvailability.find({
        userType: 'consultant',
        userId: { $in: consultantUserIds }
      });
      
      allAvailability.forEach(userAvail => {
        userAvail.availability.forEach(block => {
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
            if (block.status === 'available') {
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
      const userAvailability = await UserAvailability.findOne({
        userId: user._id,
        userType: user.role
      });
      
      if (userAvailability && userAvailability.availability) {
        userAvailability.availability.forEach(block => {
          const [year, month, day] = block.date.split('-').map(Number);
          const blockDate = new Date(year, month - 1, day);
          
          if (blockDate >= startDate && blockDate <= endDate) {
            availability[block.date] = {
              status: block.status,
              startTime: block.startTime,
              endTime: block.endTime,
              timezone: block.timezone,
              notes: block.notes,
              type: block.status === 'available' ? 'available' : (block.status === 'busy' ? 'busy' : 'limited')
            };
          }
        });
      }
    }

    res.json({
      success: true,
      availability,
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

/* =========================
   21. Save Availability (Updated for new format with type)
========================= */
app.post('/api/availability/save', async (req, res) => {
  try {
    const { userId, userType, date, type, startTime, endTime, timezone, notes, recurring, recurringType } = req.body;

    if (!userId || !userType || !date || !type) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: userId, userType, date, type'
      });
    }

    console.log(`📅 Saving availability for ${userType} ${userId} on ${date}: ${type}`);

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

    const dateKey = date;
    
    const existingIndex = userAvailability.availability.findIndex(block => 
      block.date === dateKey
    );

    let availabilityBlock;
    
    if (type === 'available') {
      availabilityBlock = {
        date: dateKey,
        status: 'available',
        startTime: startTime || '09:00',
        endTime: endTime || '17:00',
        timezone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        notes: notes || ''
      };
    } else if (type === 'busy') {
      availabilityBlock = {
        date: dateKey,
        status: 'busy',
        startTime: startTime || '',
        endTime: endTime || '',
        timezone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        notes: notes || 'Currently on a project'
      };
    } else if (type === 'limited') {
      availabilityBlock = {
        date: dateKey,
        status: 'limited',
        startTime: startTime || '09:00',
        endTime: endTime || '17:00',
        timezone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        notes: notes || 'Limited availability'
      };
    } else {
      return res.status(400).json({
        success: false,
        error: 'Invalid type value. Must be "available", "busy", or "limited"'
      });
    }

    if (existingIndex !== -1) {
      userAvailability.availability[existingIndex] = availabilityBlock;
      console.log(`✏️ Updated ${type} for ${dateKey}`);
    } else {
      userAvailability.availability.push(availabilityBlock);
      console.log(`➕ Added ${type} for ${dateKey}`);
    }

    userAvailability.updatedAt = new Date();
    await userAvailability.save();

    // Handle recurring availability
    if (recurring && recurringType) {
      const startDate = new Date(dateKey);
      let nextDate = new Date(startDate);
      let addedCount = 0;
      
      // Add up to 12 recurring dates
      for (let i = 1; i <= 12 && addedCount < 12; i++) {
        if (recurringType === 'weekly') {
          nextDate.setDate(startDate.getDate() + (7 * i));
        } else if (recurringType === 'biweekly') {
          nextDate.setDate(startDate.getDate() + (14 * i));
        } else if (recurringType === 'monthly') {
          nextDate.setMonth(startDate.getMonth() + i);
        }
        
        const nextDateKey = nextDate.toISOString().split('T')[0];
        
        // Check if this date already has availability
        const nextExistingIndex = userAvailability.availability.findIndex(block => block.date === nextDateKey);
        
        const recurringBlock = { ...availabilityBlock, date: nextDateKey };
        
        if (nextExistingIndex !== -1) {
          userAvailability.availability[nextExistingIndex] = recurringBlock;
        } else {
          userAvailability.availability.push(recurringBlock);
          addedCount++;
        }
      }
      
      await userAvailability.save();
      console.log(`✅ Added ${addedCount} recurring ${recurringType} blocks`);
    }

    console.log(`✅ Availability saved for ${dateKey}: ${type}`);

    res.json({
      success: true,
      message: 'Availability saved successfully',
      date: dateKey,
      type,
      startTime: type === 'available' ? startTime : null,
      endTime: type === 'available' ? endTime : null
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
   21a. Delete Availability
========================= */
app.delete('/api/availability/:userId/:date', async (req, res) => {
  try {
    const { userId, date } = req.params;
    const decodedDate = decodeURIComponent(date);

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

    const userAvailability = await UserAvailability.findOne({
      userId: user._id,
      userType: user.role
    });
    
    if (!userAvailability) {
      return res.status(404).json({
        success: false,
        error: 'No availability found for this user'
      });
    }

    const beforeCount = userAvailability.availability.length;
    userAvailability.availability = userAvailability.availability.filter(block => block.date !== decodedDate);
    const afterCount = userAvailability.availability.length;
    
    if (beforeCount === afterCount) {
      return res.status(404).json({
        success: false,
        error: `No availability found for date ${decodedDate}`
      });
    }
    
    userAvailability.updatedAt = new Date();
    await userAvailability.save();

    console.log(`🗑️ Deleted availability for ${user.email} on ${decodedDate}`);

    res.json({
      success: true,
      message: 'Availability deleted successfully',
      date: decodedDate
    });

  } catch (error) {
    console.error('❌ Error deleting availability:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to delete availability',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/* =========================
   7. Save Consultant Availability
========================= */
app.post('/api/consultant/availability', async (req, res) => {
  try {
    const { email, availability } = req.body;

    if (!email || !availability) {
      return res.status(400).json({
        success: false,
        error: 'Email and availability are required'
      });
    }

    const user = await User.findOne({ email, role: 'consultant' });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Consultant not found'
      });
    }

    let userAvailability = await UserAvailability.findOne({
      userId: user._id,
      userType: 'consultant'
    });
    
    if (!userAvailability) {
      userAvailability = new UserAvailability({
        userId: user._id,
        userType: 'consultant',
        availability: []
      });
    }

    userAvailability.availability = availability;
    userAvailability.updatedAt = new Date();
    await userAvailability.save();

    console.log('✅ Availability saved for consultant:', email);

    res.json({
      success: true,
      message: 'Availability saved successfully'
    });

  } catch (error) {
    console.error('Error saving availability:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to save availability',
      details: error.message 
    });
  }
});

/* =========================
   8. Create Subscription
========================= */
app.post('/api/consultant/create-subscription', async (req, res) => {
  try {
    const { email, paymentMethodId } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    console.log('💳 Creating subscription for:', email);

    const user = await User.findOne({ email, role: 'consultant' });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Consultant not found'
      });
    }

    const consultantProfile = await ConsultantProfile.findOne({ userId: user._id });

    if (!consultantProfile) {
      return res.status(404).json({
        success: false,
        error: 'Consultant profile not found'
      });
    }

    // For now, we'll use mock payment
    // In production, integrate with Stripe here
    
    const subscriptionEndDate = new Date();
    subscriptionEndDate.setFullYear(subscriptionEndDate.getFullYear() + 1);

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
   9. Get Consultant Profile
========================= */
app.get('/api/consultant/profile/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const decodedEmail = decodeURIComponent(email);

    const user = await User.findOne({ email: decodedEmail, role: 'consultant' });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Consultant not found'
      });
    }

    const consultantProfile = await ConsultantProfile.findOne({ userId: user._id })
      .populate('positions');

    const userAvailability = await UserAvailability.findOne({
      userId: user._id,
      userType: 'consultant'
    });

    // Get subscription info
    const subscriptionEndDate = consultantProfile?.subscriptionEndDate;
    const subscriptionActive = consultantProfile?.subscriptionStatus === 'active';

    // Get earnings (mock data - replace with actual from database)
    const earningsYtd = consultantProfile?.earningsYtd || 0;
    
    // Get total reviews
    const totalReviews = consultantProfile?.totalReviews || 0;
    
    // Get member since
    const memberSince = user.createdAt ? user.createdAt.getFullYear() : 2024;

    res.json({
      success: true,
      profile: {
        ...consultantProfile.toObject(),
        email: user.email,
        subscriptionActive,
        subscriptionEndDate,
        earningsYtd,
        totalReviews,
        memberSince,
        ageRange: consultantProfile?.ageRange || '',
        cvFileName: consultantProfile?.cvFileName || '',
        cvUpdatedAt: consultantProfile?.cvUpdatedAt,
        nextBillingDate: subscriptionEndDate ? subscriptionEndDate.toISOString().split('T')[0] : null
      },
      availability: userAvailability?.availability || []
    });

  } catch (error) {
    console.error('Error fetching consultant profile:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch profile',
      details: error.message 
    });
  }
});

/* =========================
   10. Download CV
========================= */
app.get('/api/consultant/download-cv/:userId', async (req, res) => {
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
   CLIENT PROFILE ENDPOINTS
========================= */

/* =========================
   11. Complete Client Profile
========================= */
app.post('/api/client/complete-profile', async (req, res) => {
  try {
    const { email, companyName, contactName, phone, companySize, industry, location, website } = req.body;

    if (!email || !companyName || !contactName) {
      return res.status(400).json({
        success: false,
        error: 'Email, company name, and contact name are required'
      });
    }

    console.log('📝 Completing client profile for:', email);

    const user = await User.findOne({ email, role: 'client' });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Client not found'
      });
    }

    const clientProfile = await ClientProfile.findOne({ userId: user._id });

    if (!clientProfile) {
      return res.status(404).json({
        success: false,
        error: 'Client profile not found'
      });
    }

    await ClientProfile.updateOne(
      { _id: clientProfile._id },
      {
        $set: {
          companyName,
          contactName,
          phone: phone || '',
          companySize: companySize || '',
          industry: industry || '',
          location: location || '',
          website: website || '',
          updatedAt: new Date()
        }
      }
    );

    console.log('✅ Client profile completed for:', email);

    res.json({
      success: true,
      message: 'Profile completed successfully'
    });

  } catch (error) {
    console.error('Error completing client profile:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to complete profile',
      details: error.message 
    });
  }
});

/* =========================
   12. Get Client Profile
========================= */
app.get('/api/client/profile/:email', async (req, res) => {
  try {
    const { email } = req.params;

    const user = await User.findOne({ email, role: 'client' });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Client not found'
      });
    }

    const clientProfile = await ClientProfile.findOne({ userId: user._id });

    res.json({
      success: true,
      profile: clientProfile
    });

  } catch (error) {
    console.error('Error fetching client profile:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch profile',
      details: error.message 
    });
  }
});

/* =========================
   13. Create Client Request
========================= */
app.post('/api/client/create-request', async (req, res) => {
  try {
    const { 
      email, 
      position, 
      title, 
      description, 
      startDate, 
      endDate, 
      budgetType, 
      budgetAmount, 
      currency,
      workCountry,
      workCity,
      workMode 
    } = req.body;

    if (!email || !position || !title) {
      return res.status(400).json({
        success: false,
        error: 'Email, position, and title are required'
      });
    }

    console.log('📝 Creating client request for:', email);

    const user = await User.findOne({ email, role: 'client' });
    
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

    let positionDoc = await Position.findOne({ name: position });
    
    if (!positionDoc) {
      positionDoc = await Position.create({
        name: position,
        category: getPositionCategory(position),
        isActive: true,
        createdAt: new Date()
      });
    }

    const clientRequest = await ClientRequest.create({
      clientProfileId: clientProfile._id,
      positionId: positionDoc._id,
      title,
      description: description || '',
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      budgetType: budgetType || 'daily',
      budgetAmount: budgetAmount || null,
      currency: currency || 'EUR',
      workCountry: workCountry || '',
      workCity: workCity || '',
      workMode: workMode || 'remote',
      status: 'submitted',
      createdAt: new Date(),
      updatedAt: new Date()
    });

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
   14. Get Client Requests
========================= */
app.get('/api/client/requests/:email', async (req, res) => {
  try {
    const { email } = req.params;

    const user = await User.findOne({ email, role: 'client' });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Client not found'
      });
    }

    const clientProfile = await ClientProfile.findOne({ userId: user._id });

    if (!clientProfile) {
      return res.status(404).json({
        success: false,
        error: 'Client profile not found'
      });
    }

    const requests = await ClientRequest.find({ clientProfileId: clientProfile._id })
      .populate('positionId')
      .sort({ createdAt: -1 });

    const requestsWithMatches = await Promise.all(requests.map(async (request) => {
      const matchCount = await MatchSuggestion.countDocuments({ requestId: request._id });
      return {
        ...request.toObject(),
        positionName: request.positionId?.name,
        matchCount
      };
    }));

    res.json({
      success: true,
      requests: requestsWithMatches
    });

  } catch (error) {
    console.error('Error fetching client requests:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch requests',
      details: error.message 
    });
  }
});

/* =========================
   DASHBOARD ENDPOINTS
========================= */

/* =========================
   15. Get Dashboard Data
========================= */
app.get('/api/dashboard/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const decodedEmail = decodeURIComponent(email);

    const user = await User.findOne({ email: decodedEmail });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    let dashboardData = {
      user: {
        email: user.email,
        role: user.role,
        isVerified: user.isVerified
      }
    };

    if (user.role === 'consultant') {
      const consultantProfile = await ConsultantProfile.findOne({ userId: user._id })
        .populate('positions');
      
      const userAvailability = await UserAvailability.findOne({
        userId: user._id,
        userType: 'consultant'
      });

      const upcomingAgenda = await AgendaItem.find({
        userId: user._id,
        startDate: { $gte: new Date() },
        status: { $in: ['scheduled', 'in_progress'] }
      }).sort({ startDate: 1 }).limit(10);

      const recentMatches = await MatchSuggestion.find({ 
        consultantProfileId: consultantProfile?._id 
      })
        .sort({ createdAt: -1 })
        .limit(10)
        .populate({
          path: 'requestId',
          populate: { path: 'clientProfileId' }
        });

      // Calculate profile completion
      const basicInfoComplete = !!(consultantProfile?.fullName && consultantProfile?.fullName.trim() !== '');
      const availabilityComplete = userAvailability?.availability?.length > 0;
      const paymentComplete = consultantProfile?.subscriptionStatus === 'active';

      dashboardData.profile = {
        ...consultantProfile?.toObject(),
        fullName: consultantProfile?.fullName || '',
        title: consultantProfile?.positions?.[0]?.name || 'Strategic Consultant',
        baseCity: consultantProfile?.baseCity || '',
        baseCountry: consultantProfile?.baseCountry || '',
        rating: consultantProfile?.rating || 4.8,
        completedProjects: consultantProfile?.completedProjects || 12,
        hourlyRate: consultantProfile?.hourlyRate || 0,
        positions: consultantProfile?.positions || [],
        isVerified: user.isVerified,
        phone: consultantProfile?.phone || '',
        ageRange: consultantProfile?.ageRange || '',
        yearsExperience: consultantProfile?.yearsExperience || '',
        cvFileName: consultantProfile?.cvFileName || '',
        cvUpdatedAt: consultantProfile?.cvUpdatedAt,
        subscriptionActive: consultantProfile?.subscriptionStatus === 'active',
        subscriptionEndDate: consultantProfile?.subscriptionEndDate,
        earningsYtd: consultantProfile?.earningsYtd || 0,
        totalReviews: consultantProfile?.totalReviews || 0,
        memberSince: user.createdAt?.getFullYear() || 2024,
        nextBillingDate: consultantProfile?.subscriptionEndDate?.toISOString().split('T')[0]
      };
      
      dashboardData.availability = userAvailability?.availability || [];
      dashboardData.upcomingAgenda = upcomingAgenda;
      dashboardData.recentMatches = recentMatches;
      dashboardData.stats = {
        profileViews: consultantProfile?.profileViews || 0,
        matchRequests: await MatchSuggestion.countDocuments({ consultantProfileId: consultantProfile?._id }),
        interviews: await MatchSuggestion.countDocuments({ 
          consultantProfileId: consultantProfile?._id,
          adminReviewStatus: 'accepted'
        }),
        earnings: consultantProfile?.earningsYtd || 0
      };
      dashboardData.profileCompletion = {
        basicInfo: basicInfoComplete,
        availability: availabilityComplete,
        payment: paymentComplete,
        status: paymentComplete ? 'complete' : (basicInfoComplete ? 'partial' : 'incomplete')
      };
      
    } else if (user.role === 'client') {
      const clientProfile = await ClientProfile.findOne({ userId: user._id });

      const requests = await ClientRequest.find({ clientProfileId: clientProfile?._id })
        .populate('positionId')
        .sort({ createdAt: -1 })
        .limit(10);

      const upcomingInterviews = await AgendaItem.find({
        userId: user._id,
        type: 'interview',
        startDate: { $gte: new Date() },
        status: 'scheduled'
      }).sort({ startDate: 1 }).limit(10);

      dashboardData.profile = clientProfile;
      dashboardData.recentRequests = requests;
      dashboardData.upcomingInterviews = upcomingInterviews;
      dashboardData.stats = {
        requestCount: await ClientRequest.countDocuments({ clientProfileId: clientProfile?._id }),
        activeRequests: await ClientRequest.countDocuments({ 
          clientProfileId: clientProfile?._id,
          status: { $in: ['submitted', 'under_review', 'contacting'] }
        }),
        profileCompletion: {
          basicInfo: !!(clientProfile?.companyName && clientProfile?.contactName),
          availability: true,
          payment: true,
          status: (clientProfile?.companyName && clientProfile?.contactName) ? 'complete' : 'partial'
        }
      };
    }

    res.json({
      success: true,
      data: dashboardData
    });

  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch dashboard data',
      details: error.message 
    });
  }
});

/* =========================
   16. Get Positions List
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
   SUPPORT ENDPOINTS
========================= */

/* =========================
   17. Submit Support Request
========================= */
app.post('/api/support/submit', async (req, res) => {
  try {
    const { name, email, role, subject, message, priority } = req.body;

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

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format'
      });
    }

    console.log('📞 New support request received from:', email);

    const ticketId = `SUP-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;
    
    let user = null;
    try {
      user = await User.findOne({ email });
    } catch (userError) {
      console.warn('⚠️ Error finding user:', userError.message);
    }

    const attachments = [];
    if (req.files && req.files.attachments) {
      const files = Array.isArray(req.files.attachments) 
        ? req.files.attachments 
        : [req.files.attachments];
      
      for (const file of files) {
        try {
          const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
          if (!allowedTypes.includes(file.mimetype)) {
            continue;
          }
          
          if (file.size > 5 * 1024 * 1024) {
            continue;
          }
          
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

    let emailSent = false;
    try {
      await sendSupportConfirmationEmail(email, name, ticketId, subject);
      emailSent = true;
      console.log(`📧 Confirmation email sent to ${email}`);
    } catch (emailError) {
      console.error('❌ Failed to send confirmation email:', emailError);
    }

    try {
      await notifyAdminsOfNewSupportRequest(supportRequest);
    } catch (notifyError) {
      console.error('❌ Failed to notify admins:', notifyError);
    }

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
   18. Get User's Support Requests
========================= */
app.get('/api/support/user/:email', async (req, res) => {
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

/* =========================
   19. Get Single Support Request
========================= */
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

/* =========================
   AVAILABILITY ENDPOINTS
========================= */

/* =========================
   20. Get Availability
========================= */
app.get('/api/availability/:userType/:userId', async (req, res) => {
  try {
    const { userType, userId } = req.params;
    const months = parseInt(req.query.months) || 6;

    console.log(`📅 Fetching availability for ${userType}: ${userId}`);

    const today = new Date();
    const startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endDate = new Date(today.getFullYear(), today.getMonth() + months, today.getDate());

    let availability = {};

    let user = null;
    
    if (userId.includes('@')) {
      const decodedEmail = decodeURIComponent(userId);
      user = await User.findOne({ email: decodedEmail });
    } else if (mongoose.Types.ObjectId.isValid(userId)) {
      user = await User.findById(userId);
    }
    
    if (!user && userId !== 'all') {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    if (userId === 'all' && userType === 'admin') {
      const consultants = await ConsultantProfile.find({ subscriptionStatus: 'active' });
      const consultantUserIds = consultants.map(c => c.userId);
      
      const allAvailability = await UserAvailability.find({
        userType: 'consultant',
        userId: { $in: consultantUserIds }
      });
      
      allAvailability.forEach(userAvail => {
        userAvail.availability.forEach(block => {
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
            if (block.status === 'available') {
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
      const userAvailability = await UserAvailability.findOne({
        userId: user._id,
        userType: user.role
      });
      
      if (userAvailability && userAvailability.availability) {
        userAvailability.availability.forEach(block => {
          const [year, month, day] = block.date.split('-').map(Number);
          const blockDate = new Date(year, month - 1, day);
          
          if (blockDate >= startDate && blockDate <= endDate) {
            availability[block.date] = {
              status: block.status,
              startTime: block.startTime,
              endTime: block.endTime,
              timezone: block.timezone,
              notes: block.notes,
              type: block.status === 'available' ? 'available' : (block.status === 'busy' ? 'busy' : 'limited')
            };
          }
        });
      }
    }

    res.json({
      success: true,
      availability,
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
/* =========================
   21. Save Availability
========================= */
app.post('/api/availability/save', async (req, res) => {
  try {
    const { userId, userType, date, type, startTime, endTime, timezone, notes, recurring, recurringType } = req.body;

    if (!userId || !userType || !date || !type) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: userId, userType, date, type'
      });
    }

    console.log(`📅 Saving availability for ${userType} ${userId} on ${date}: ${type}`);

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

    const dateKey = date;
    
    const existingIndex = userAvailability.availability.findIndex(block => 
      block.date === dateKey
    );

    let availabilityBlock;
    
    if (type === 'available') {
      availabilityBlock = {
        date: dateKey,
        status: 'available',
        startTime: startTime || '09:00',
        endTime: endTime || '17:00',
        timezone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        notes: notes || ''
      };
    } else if (type === 'busy') {
      availabilityBlock = {
        date: dateKey,
        status: 'busy',
        startTime: startTime || '',
        endTime: endTime || '',
        timezone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        notes: notes || 'Currently on a project'
      };
    } else if (type === 'limited') {
      availabilityBlock = {
        date: dateKey,
        status: 'limited',
        startTime: startTime || '09:00',
        endTime: endTime || '17:00',
        timezone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        notes: notes || 'Limited availability'
      };
    } else {
      return res.status(400).json({
        success: false,
        error: 'Invalid type value. Must be "available", "busy", or "limited"'
      });
    }

    if (existingIndex !== -1) {
      userAvailability.availability[existingIndex] = availabilityBlock;
      console.log(`✏️ Updated ${type} for ${dateKey}`);
    } else {
      userAvailability.availability.push(availabilityBlock);
      console.log(`➕ Added ${type} for ${dateKey}`);
    }

    userAvailability.updatedAt = new Date();
    await userAvailability.save();

    // Handle recurring availability
    if (recurring && recurringType) {
      const startDate = new Date(dateKey);
      let nextDate = new Date(startDate);
      let addedCount = 0;
      
      // Add up to 12 recurring dates
      for (let i = 1; i <= 12 && addedCount < 12; i++) {
        if (recurringType === 'weekly') {
          nextDate.setDate(startDate.getDate() + (7 * i));
        } else if (recurringType === 'biweekly') {
          nextDate.setDate(startDate.getDate() + (14 * i));
        } else if (recurringType === 'monthly') {
          nextDate.setMonth(startDate.getMonth() + i);
        }
        
        const nextDateKey = nextDate.toISOString().split('T')[0];
        
        // Check if this date already has availability
        const nextExistingIndex = userAvailability.availability.findIndex(block => block.date === nextDateKey);
        
        const recurringBlock = { ...availabilityBlock, date: nextDateKey };
        
        if (nextExistingIndex !== -1) {
          userAvailability.availability[nextExistingIndex] = recurringBlock;
        } else {
          userAvailability.availability.push(recurringBlock);
          addedCount++;
        }
      }
      
      await userAvailability.save();
      console.log(`✅ Added ${addedCount} recurring ${recurringType} blocks`);
    }

    console.log(`✅ Availability saved for ${dateKey}: ${type}`);

    res.json({
      success: true,
      message: 'Availability saved successfully',
      date: dateKey,
      type,
      startTime: type === 'available' ? startTime : null,
      endTime: type === 'available' ? endTime : null
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
   21a. Delete Availability
========================= */
app.delete('/api/availability/:userId/:date', async (req, res) => {
  try {
    const { userId, date } = req.params;
    const decodedDate = decodeURIComponent(date);

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

    const userAvailability = await UserAvailability.findOne({
      userId: user._id,
      userType: user.role
    });
    
    if (!userAvailability) {
      return res.status(404).json({
        success: false,
        error: 'No availability found for this user'
      });
    }

    const beforeCount = userAvailability.availability.length;
    userAvailability.availability = userAvailability.availability.filter(block => block.date !== decodedDate);
    const afterCount = userAvailability.availability.length;
    
    if (beforeCount === afterCount) {
      return res.status(404).json({
        success: false,
        error: `No availability found for date ${decodedDate}`
      });
    }
    
    userAvailability.updatedAt = new Date();
    await userAvailability.save();

    console.log(`🗑️ Deleted availability for ${user.email} on ${decodedDate}`);

    res.json({
      success: true,
      message: 'Availability deleted successfully',
      date: decodedDate
    });

  } catch (error) {
    console.error('❌ Error deleting availability:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to delete availability',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/* =========================
   AGENDA ENDPOINTS
========================= */

/* =========================
   22. Get Agenda
========================= */
app.get('/api/agenda/:email', async (req, res) => {
  try {
    const { email } = req.params;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const now = new Date();
    const sixMonthsLater = new Date();
    sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6);

    const agendaItems = await AgendaItem.find({
      userId: user._id,
      startDate: { $gte: now, $lte: sixMonthsLater }
    }).sort({ startDate: 1 });

    const currentMissions = agendaItems.filter(item => 
      item.type === 'mission' && 
      item.status === 'in_progress'
    );

    const upcomingEngagements = agendaItems.filter(item => 
      (item.type === 'interview' || item.type === 'meeting') && 
      item.status === 'scheduled'
    );

    const pendingRequests = agendaItems.filter(item => 
      item.type === 'deadline' && 
      item.status === 'pending'
    );

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
   23. Create Agenda Item
========================= */
app.post('/api/agenda/create', async (req, res) => {
  try {
    const { 
      email, 
      title, 
      description, 
      type, 
      startDate, 
      endDate, 
      startTime, 
      endTime,
      location,
      meetingLink,
      metadata 
    } = req.body;

    if (!email || !title || !type || !startDate) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: email, title, type, startDate'
      });
    }

    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

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
   24. Update Agenda Item
========================= */
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
   25. Delete Agenda Item
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
   ADMIN ENDPOINTS
========================= */

/* =========================
   26. Admin - Get All Consultants
========================= */
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
    
    const consultantsWithData = await Promise.all(consultants.map(async (consultant) => {
      const matchCount = await MatchSuggestion.countDocuments({ consultantProfileId: consultant._id });
      const userAvailability = await UserAvailability.findOne({
        userId: consultant.userId?._id,
        userType: 'consultant'
      });
      
      return {
        ...consultant.toObject(),
        email: consultant.userId?.email,
        userCreated: consultant.userId?.createdAt,
        isVerified: consultant.userId?.isVerified,
        positions: consultant.positions?.map(p => p.name).join(', '),
        matchCount,
        cvUrl: consultant.cvUrl,
        cvFileName: consultant.cvFileName,
        availabilityCount: userAvailability?.availability?.length || 0
      };
    }));
    
    res.json({
      success: true,
      count: consultantsWithData.length,
      consultants: consultantsWithData
    });
    
  } catch (error) {
    console.error('Error fetching consultants:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Database error' 
    });
  }
});

/* =========================
   27. Admin - Get All Clients
========================= */
app.get('/api/admin/clients', async (req, res) => {
  try {
    const clients = await ClientProfile.find({})
      .populate('userId')
      .sort({ createdAt: -1 });
    
    const clientsWithData = await Promise.all(clients.map(async (client) => {
      const requestCount = await ClientRequest.countDocuments({ clientProfileId: client._id });
      
      return {
        ...client.toObject(),
        email: client.userId?.email,
        userCreated: client.userId?.createdAt,
        isVerified: client.userId?.isVerified,
        requestCount
      };
    }));
    
    res.json({
      success: true,
      count: clientsWithData.length,
      clients: clientsWithData
    });
    
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Database error' 
    });
  }
});

/* =========================
   28. Admin - Get All Requests
========================= */
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
    
    const requestsWithData = await Promise.all(requests.map(async (request) => {
      const matchCount = await MatchSuggestion.countDocuments({ requestId: request._id });
      
      return {
        ...request.toObject(),
        positionName: request.positionId?.name,
        companyName: request.clientProfileId?.companyName,
        contactName: request.clientProfileId?.contactName,
        matchCount
      };
    }));
    
    res.json({
      success: true,
      count: requestsWithData.length,
      requests: requestsWithData
    });
    
  } catch (error) {
    console.error('Error fetching requests:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Database error' 
    });
  }
});

/* =========================
   29. Admin - Get Match Suggestions
========================= */
app.get('/api/admin/match-suggestions', async (req, res) => {
  try {
    const { request_id, status } = req.query;
    
    const query = {};
    if (request_id) query.requestId = request_id;
    if (status) query.adminReviewStatus = status;
    
    const suggestions = await MatchSuggestion.find(query)
      .populate({
        path: 'requestId',
        populate: { path: 'clientProfileId' }
      })
      .populate({
        path: 'consultantProfileId',
        populate: { path: 'userId' }
      })
      .sort({ matchScore: -1, createdAt: -1 });
    
    const formattedSuggestions = suggestions.map(s => ({
      ...s.toObject(),
      requestTitle: s.requestId?.title,
      workMode: s.requestId?.workMode,
      workCity: s.requestId?.workCity,
      workCountry: s.requestId?.workCountry,
      consultantName: s.consultantProfileId?.fullName,
      consultantEmail: s.consultantProfileId?.userId?.email,
      companyName: s.requestId?.clientProfileId?.companyName,
      cvUrl: s.consultantProfileId?.cvUrl,
      cvFileName: s.consultantProfileId?.cvFileName
    }));
    
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

/* =========================
   30. Admin - Update Match Status
========================= */
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

/* =========================
   31. Admin - Get Stats
========================= */
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
      adminReviewStatus: { $in: ['shortlisted', 'contacted', 'accepted'] }
    });
    
    const supportTotal = await SupportRequest.countDocuments();
    const supportNew = await SupportRequest.countDocuments({ status: 'new' });
    const supportInProgress = await SupportRequest.countDocuments({ status: 'in_progress' });
    
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
        support: {
          total: supportTotal,
          new: supportNew,
          inProgress: supportInProgress
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

/* =========================
   32. Admin - Get Support Requests
========================= */
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

/* =========================
   33. Admin - Add Support Reply
========================= */
app.post('/api/admin/support-requests/:id/reply', async (req, res) => {
  try {
    const { id } = req.params;
    const { message, isInternal = false } = req.body;
    
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
    
    const admin = await User.findOne({ role: 'admin' });
    if (!admin) {
      return res.status(400).json({ 
        success: false, 
        error: 'Admin not found' 
      });
    }
    
    const reply = await SupportReply.create({
      supportRequestId: id,
      userId: admin._id,
      userRole: 'admin',
      message: message.trim(),
      isInternal: isInternal === true,
      createdAt: new Date()
    });
    
    await SupportRequest.updateOne(
      { _id: id },
      { 
        $set: { 
          status: 'in_progress',
          updatedAt: new Date()
        } 
      }
    );
    
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

/* =========================
   34. Admin - Update Support Status
========================= */
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

/* =========================
   35. Admin - Get Support Stats
========================= */
app.get('/api/admin/support-stats', async (req, res) => {
  try {
    // Verify admin authorization
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        error: 'Unauthorized - No token provided' 
      });
    }
    
    // You should verify the token here and check if user is admin
    // For now, we'll assume the token is valid (add proper verification)
    
    const total = await SupportRequest.countDocuments();
    const newCount = await SupportRequest.countDocuments({ status: 'new' });
    const inProgress = await SupportRequest.countDocuments({ status: 'in_progress' });
    const resolved = await SupportRequest.countDocuments({ status: 'resolved' });
    const closed = await SupportRequest.countDocuments({ status: 'closed' });
    
    // Count by priority
    const low = await SupportRequest.countDocuments({ priority: 'low' });
    const normal = await SupportRequest.countDocuments({ priority: 'normal' });
    const high = await SupportRequest.countDocuments({ priority: 'high' });
    const critical = await SupportRequest.countDocuments({ priority: 'critical' });
    
    // Calculate average response time (time from creation to first admin reply)
    const supportRequests = await SupportRequest.find({ 
      status: { $in: ['resolved', 'closed'] },
      createdAt: { $exists: true }
    }).limit(100);
    
    let totalResponseTime = 0;
    let responseCount = 0;
    
    for (const request of supportRequests) {
      const firstReply = await SupportReply.findOne({ 
        supportRequestId: request._id,
        userRole: 'admin'
      }).sort({ createdAt: 1 });
      
      if (firstReply && request.createdAt) {
        const responseTime = (firstReply.createdAt - request.createdAt) / (1000 * 60 * 60); // in hours
        totalResponseTime += responseTime;
        responseCount++;
      }
    }
    
    const avgResponseTime = responseCount > 0 ? Math.round(totalResponseTime / responseCount) : 0;
    
    res.json({
      success: true,
      stats: {
        total,
        new: newCount,
        inProgress,
        resolved,
        closed,
        avgResponseTime,
        byPriority: {
          low,
          normal,
          high,
          critical
        }
      }
    });
    
  } catch (error) {
    console.error('Error fetching support stats:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch support statistics',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});


/* =========================
   36. Admin - Get Single Support Request with Replies
========================= */
app.get('/api/admin/support-requests/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verify admin authorization
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        error: 'Unauthorized - No token provided' 
      });
    }
    
    const request = await SupportRequest.findById(id)
      .populate('assignedTo', 'email name');
    
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
      request: request,
      replies: replies
    });
    
  } catch (error) {
    console.error('Error fetching support request:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch support request',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});



/* =========================
   37. Admin - Assign Support Request
========================= */
app.put('/api/admin/support-requests/:id/assign', async (req, res) => {
  try {
    const { id } = req.params;
    const { adminId } = req.body;
    
    // Verify admin authorization
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        error: 'Unauthorized - No token provided' 
      });
    }
    
    const admin = await User.findOne({ role: 'admin' });
    if (!admin) {
      return res.status(404).json({ 
        success: false, 
        error: 'Admin not found' 
      });
    }
    
    const request = await SupportRequest.findByIdAndUpdate(
      id,
      { 
        $set: { 
          assignedTo: admin._id,
          updatedAt: new Date()
        } 
      },
      { new: true }
    );
    
    if (!request) {
      return res.status(404).json({ 
        success: false, 
        error: 'Support request not found' 
      });
    }
    
    res.json({
      success: true,
      message: 'Ticket assigned successfully',
      request
    });
    
  } catch (error) {
    console.error('Error assigning support request:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to assign support request',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});
/* =========================
   LEGACY ENDPOINTS (Deprecated - kept for compatibility)
========================= */

app.post('/api/check-registration', async (req, res) => {
  console.warn('⚠️ DEPRECATED: /api/check-registration - Use /api/auth/check-email/:email instead');
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    res.json({
      success: true,
      isRegistered: !!user,
      role: user?.role,
      isVerified: user?.isVerified
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/send-magic-link', async (req, res) => {
  console.warn('⚠️ DEPRECATED: /api/send-magic-link - Use /api/auth/initiate instead');
  try {
    const { email, userType } = req.body;
    const user = await User.findOne({ email });
    if (!user || user.role !== userType) {
      return res.status(400).json({ success: false, error: 'Invalid email or user type' });
    }
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await User.updateOne({ _id: user._id }, { magicLinkToken: token, magicLinkExpiresAt: expiresAt });
    const magicLink = `${process.env.FRONTEND_URL}/auth/verify?token=${token}&email=${encodeURIComponent(email)}&type=${userType}`;
    await emailService.sendMagicLinkEmail(email, magicLink, userType);
    res.json({ success: true, message: 'Magic link sent' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/verify-magic-link', async (req, res) => {
  console.warn('⚠️ DEPRECATED: /api/verify-magic-link - Use /api/auth/verify instead');
  try {
    const { token, email, userType } = req.body;
    const user = await User.findOne({ email });
    if (!user || user.magicLinkToken !== token || user.magicLinkExpiresAt < new Date() || user.role !== userType) {
      return res.status(400).json({ success: false, error: 'Invalid or expired token' });
    }
    await User.updateOne({ _id: user._id }, { isVerified: true, magicLinkToken: null, magicLinkExpiresAt: null });
    res.json({ success: true, user: { id: user._id, email: user.email, role: user.role } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/* =========================
   Stripe Webhook
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
app.get('/api/debug/routes', (req, res) => {
  const routes = [];
  
  // Collect all registered routes
  app._router.stack.forEach((middleware) => {
    if (middleware.route) {
      // Routes registered directly on the app
      routes.push({
        path: middleware.route.path,
        methods: Object.keys(middleware.route.methods)
      });
    } else if (middleware.name === 'router') {
      // Routes registered in routers (if any)
      middleware.handle.stack.forEach((handler) => {
        if (handler.route) {
          routes.push({
            path: handler.route.path,
            methods: Object.keys(handler.route.methods)
          });
        }
      });
    }
  });
  
  res.json({
    success: true,
    routes: routes.sort((a, b) => a.path.localeCompare(b.path))
  });
});


/* =========================
   CLIENT ADDITIONAL ENDPOINTS (Add these before the 404 handler)
========================= */

/* =========================
   Client - Get All Consultants (for Find Consultants tab)
========================= */
app.get('/api/client/consultants', async (req, res) => {
  try {
    const { search, expertise, location, page = 1, limit = 20 } = req.query;
    
    let query = { subscriptionStatus: 'active' };
    
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { baseCountry: { $regex: search, $options: 'i' } },
        { baseCity: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (expertise) {
      const positions = await Position.find({ name: { $regex: expertise, $options: 'i' } });
      const positionIds = positions.map(p => p._id);
      if (positionIds.length > 0) {
        query.positions = { $in: positionIds };
      }
    }
    
    if (location) {
      query.$or = [
        { baseCountry: { $regex: location, $options: 'i' } },
        { baseCity: { $regex: location, $options: 'i' } }
      ];
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await ConsultantProfile.countDocuments(query);
    
    const consultants = await ConsultantProfile.find(query)
      .populate('userId')
      .populate('positions')
      .sort({ rating: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    // Get availability counts for each consultant
    const consultantsWithData = await Promise.all(consultants.map(async (consultant) => {
      const userAvailability = await UserAvailability.findOne({
        userId: consultant.userId,
        userType: 'consultant'
      });
      
      const availableDays = userAvailability?.availability?.filter(
        block => block.status === 'available' && new Date(block.date) >= new Date()
      ).length || 0;
      
      return {
        _id: consultant._id,
        name: consultant.fullName,
        title: consultant.positions?.[0]?.name || 'Independent Consultant',
        location: consultant.baseCity && consultant.baseCountry 
          ? `${consultant.baseCity}, ${consultant.baseCountry}`
          : consultant.baseCountry || 'Remote',
        expertise: consultant.positions?.map(p => p.name).join(', ') || 'General',
        rating: consultant.rating || 0,
        reviewCount: consultant.totalReviews || 0,
        hourlyRate: consultant.hourlyRate || 0,
        experience: consultant.yearsExperience || 'Not specified',
        availableDays,
        avatar: consultant.cvUrl ? `/uploads/cv/${consultant.cvFileName}` : null,
        isVerified: consultant.userId?.isVerified || false
      };
    }));
    
    res.json({
      success: true,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit)),
      consultants: consultantsWithData
    });
    
  } catch (error) {
    console.error('Error fetching consultants:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch consultants',
      details: error.message 
    });
  }
});

/* =========================
   Client - Get Single Consultant Details
========================= */
app.get('/api/client/consultant/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const consultant = await ConsultantProfile.findById(id)
      .populate('userId')
      .populate('positions')
      .populate('certificates');
    
    if (!consultant) {
      return res.status(404).json({
        success: false,
        error: 'Consultant not found'
      });
    }
    
    // Get availability
    const userAvailability = await UserAvailability.findOne({
      userId: consultant.userId,
      userType: 'consultant'
    });
    
    // Get completed projects count from matches
    const completedProjects = await MatchSuggestion.countDocuments({
      consultantProfileId: consultant._id,
      adminReviewStatus: 'accepted'
    });
    
    // Get upcoming availability
    const upcomingAvailability = userAvailability?.availability?.filter(
      block => block.status === 'available' && new Date(block.date) >= new Date()
    ).slice(0, 10) || [];
    
    res.json({
      success: true,
      consultant: {
        ...consultant.toObject(),
        email: consultant.userId?.email,
        isVerified: consultant.userId?.isVerified || false,
        completedProjects,
        availability: userAvailability?.availability || [],
        upcomingAvailability
      }
    });
    
  } catch (error) {
    console.error('Error fetching consultant details:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch consultant details',
      details: error.message 
    });
  }
});

/* =========================
   Client - Update Match Status (Shortlist/Contact/Reject)
========================= */
app.put('/api/client/update-match-status', async (req, res) => {
  try {
    const { matchId, status, email } = req.body;
    
    if (!matchId || !status || !email) {
      return res.status(400).json({ 
        success: false, 
        error: 'Match ID, status, and email are required' 
      });
    }
    
    const validStatuses = ['shortlisted', 'contacted', 'rejected'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid status. Must be shortlisted, contacted, or rejected' 
      });
    }
    
    const user = await User.findOne({ email, role: 'client' });
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        error: 'Client not found' 
      });
    }
    
    const match = await MatchSuggestion.findById(matchId)
      .populate('requestId')
      .populate('consultantProfileId');
    
    if (!match) {
      return res.status(404).json({ 
        success: false, 
        error: 'Match not found' 
      });
    }
    
    // Verify this match belongs to the client
    const clientProfile = await ClientProfile.findOne({ userId: user._id });
    if (match.requestId.clientProfileId.toString() !== clientProfile._id.toString()) {
      return res.status(403).json({ 
        success: false, 
        error: 'Unauthorized - This match does not belong to your company' 
      });
    }
    
    await MatchSuggestion.updateOne(
      { _id: matchId },
      {
        $set: {
          adminReviewStatus: status,
          updatedAt: new Date()
        }
      }
    );
    
    // If shortlisted, create agenda items for both parties
    if (status === 'shortlisted') {
      const consultantUser = await User.findById(match.consultantProfileId.userId);
      const interviewDate = new Date();
      interviewDate.setDate(interviewDate.getDate() + 7); // Schedule interview 7 days from now
      
      // Create agenda for client
      await AgendaItem.create({
        userId: user._id,
        userType: 'client',
        title: `Interview with ${match.consultantProfileId.fullName}`,
        description: `Interview for position: ${match.requestId.title}`,
        type: 'interview',
        status: 'scheduled',
        startDate: interviewDate,
        matchId: match._id,
        requestId: match.requestId._id,
        consultantProfileId: match.consultantProfileId._id,
        clientProfileId: clientProfile._id,
        metadata: {
          matchScore: match.matchScore,
          consultantName: match.consultantProfileId.fullName
        }
      });
      
      // Create agenda for consultant
      if (consultantUser) {
        await AgendaItem.create({
          userId: consultantUser._id,
          userType: 'consultant',
          title: `Interview with ${clientProfile.companyName}`,
          description: `Interview for position: ${match.requestId.title}`,
          type: 'interview',
          status: 'scheduled',
          startDate: interviewDate,
          matchId: match._id,
          requestId: match.requestId._id,
          consultantProfileId: match.consultantProfileId._id,
          clientProfileId: clientProfile._id,
          metadata: {
            matchScore: match.matchScore,
            companyName: clientProfile.companyName
          }
        });
      }
    }
    
    res.json({ 
      success: true, 
      message: `Match ${status} successfully`,
      status
    });
    
  } catch (error) {
    console.error('Error updating match status:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update match status',
      details: error.message 
    });
  }
});

/* =========================
   Client - Get Request Details with Matches
========================= */
app.get('/api/client/request/:requestId', async (req, res) => {
  try {
    const { requestId } = req.params;
    const { email } = req.query;
    
    const request = await ClientRequest.findById(requestId)
      .populate('positionId')
      .populate('clientProfileId');
    
    if (!request) {
      return res.status(404).json({
        success: false,
        error: 'Request not found'
      });
    }
    
    // Verify ownership if email provided
    if (email) {
      const user = await User.findOne({ email, role: 'client' });
      if (user) {
        const clientProfile = await ClientProfile.findOne({ userId: user._id });
        if (request.clientProfileId._id.toString() !== clientProfile._id.toString()) {
          return res.status(403).json({
            success: false,
            error: 'Unauthorized'
          });
        }
      }
    }
    
    const matches = await MatchSuggestion.find({ requestId: request._id })
      .populate({
        path: 'consultantProfileId',
        populate: { path: 'userId positions' }
      })
      .sort({ matchScore: -1 });
    
    const matchesWithDetails = matches.map(match => ({
      _id: match._id,
      consultantName: match.consultantProfileId?.fullName || 'Unknown Consultant',
      consultantLocation: match.consultantProfileId?.baseCity && match.consultantProfileId?.baseCountry
        ? `${match.consultantProfileId.baseCity}, ${match.consultantProfileId.baseCountry}`
        : match.consultantProfileId?.baseCountry || 'Remote',
      expertise: match.consultantProfileId?.positions?.map(p => p.name).join(', ') || 'General',
      matchScore: match.matchScore,
      status: match.adminReviewStatus,
      hourlyRate: match.consultantProfileId?.hourlyRate || 0,
      rating: match.consultantProfileId?.rating || 0,
      cvUrl: match.consultantProfileId?.cvUrl,
      cvFileName: match.consultantProfileId?.cvFileName,
      email: match.consultantProfileId?.userId?.email
    }));
    
    res.json({
      success: true,
      request: {
        ...request.toObject(),
        positionName: request.positionId?.name
      },
      matches: matchesWithDetails,
      matchCount: matchesWithDetails.length
    });
    
  } catch (error) {
    console.error('Error fetching request details:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch request details',
      details: error.message 
    });
  }
});

/* =========================
   Client - Get Request Status Summary
========================= */
app.get('/api/client/requests-summary/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const decodedEmail = decodeURIComponent(email);
    
    const user = await User.findOne({ email: decodedEmail, role: 'client' });
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        error: 'Client not found' 
      });
    }
    
    const clientProfile = await ClientProfile.findOne({ userId: user._id });
    if (!clientProfile) {
      return res.status(404).json({ 
        success: false, 
        error: 'Client profile not found' 
      });
    }
    
    const totalRequests = await ClientRequest.countDocuments({ clientProfileId: clientProfile._id });
    const activeRequests = await ClientRequest.countDocuments({ 
      clientProfileId: clientProfile._id,
      status: { $in: ['submitted', 'under_review', 'contacting'] }
    });
    const closedRequests = await ClientRequest.countDocuments({ 
      clientProfileId: clientProfile._id,
      status: 'closed' 
    });
    
    // Get total matches across all requests
    const allRequests = await ClientRequest.find({ clientProfileId: clientProfile._id }, { _id: 1 });
    const requestIds = allRequests.map(r => r._id);
    const totalMatches = await MatchSuggestion.countDocuments({ requestId: { $in: requestIds } });
    const shortlistedMatches = await MatchSuggestion.countDocuments({ 
      requestId: { $in: requestIds },
      adminReviewStatus: 'shortlisted'
    });
    const contactedMatches = await MatchSuggestion.countDocuments({ 
      requestId: { $in: requestIds },
      adminReviewStatus: 'contacted'
    });
    
    res.json({
      success: true,
      summary: {
        totalRequests,
        activeRequests,
        closedRequests,
        totalMatches,
        shortlistedMatches,
        contactedMatches
      }
    });
    
  } catch (error) {
    console.error('Error fetching requests summary:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch requests summary',
      details: error.message 
    });
  }
});

/* =========================
   Client - Send Message to Consultant (Simple messaging)
========================= */
app.post('/api/client/send-message', async (req, res) => {
  try {
    const { fromEmail, toConsultantId, subject, message } = req.body;
    
    if (!fromEmail || !toConsultantId || !subject || !message) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }
    
    const client = await User.findOne({ email: fromEmail, role: 'client' });
    if (!client) {
      return res.status(404).json({
        success: false,
        error: 'Client not found'
      });
    }
    
    const consultant = await ConsultantProfile.findById(toConsultantId).populate('userId');
    if (!consultant) {
      return res.status(404).json({
        success: false,
        error: 'Consultant not found'
      });
    }
    
    const clientProfile = await ClientProfile.findOne({ userId: client._id });
    
    // Create a support ticket as a message (or create a separate messaging system)
    const ticketId = `MSG-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;
    
    const supportRequest = await SupportRequest.create({
      name: clientProfile?.companyName || client.email,
      email: fromEmail,
      role: 'client',
      subject: `Regarding consultant: ${consultant.fullName} - ${subject}`,
      message: message,
      priority: 'normal',
      status: 'new',
      ticketId,
      userId: client._id,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    console.log(`📧 Message from client ${fromEmail} to consultant ${consultant.fullName}`);
    
    res.json({
      success: true,
      message: 'Message sent successfully',
      ticketId: supportRequest.ticketId
    });
    
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to send message',
      details: error.message 
    });
  }
});

/* =========================
   Client - Get Industry List
========================= */
app.get('/api/client/industries', async (req, res) => {
  try {
    const industries = [
      'Technology', 'Finance', 'Healthcare', 'Manufacturing', 
      'Retail', 'Consulting', 'Education', 'Real Estate', 
      'Transportation', 'Energy', 'Media', 'Telecommunications',
      'Agriculture', 'Hospitality', 'Nonprofit', 'Government',
      'Other'
    ];
    
    res.json({
      success: true,
      industries
    });
    
  } catch (error) {
    console.error('Error fetching industries:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch industries' 
    });
  }
});

/* =========================
   Client - Get Company Sizes
========================= */
app.get('/api/client/company-sizes', async (req, res) => {
  try {
    const companySizes = [
      '1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'
    ];
    
    res.json({
      success: true,
      companySizes
    });
    
  } catch (error) {
    console.error('Error fetching company sizes:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch company sizes' 
    });
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
  console.log('   🔐 UNIFIED AUTH ENDPOINTS (NEW):');
  console.log('   POST   /api/auth/initiate                - Unified email entry (signup/login)');
  console.log('   POST   /api/auth/verify                  - Verify magic link & get dashboard');
  console.log('   GET    /api/auth/me                      - Get current user session');
  console.log('   GET    /api/auth/check-email/:email      - Check email status');
  console.log('');
  console.log('   👤 CONSULTANT ENDPOINTS:');
  console.log('   POST   /api/consultant/complete-profile  - Complete consultant profile');
  console.log('   POST   /api/consultant/upload-cv         - Upload CV file');
  console.log('   POST   /api/consultant/availability      - Save availability');
  console.log('   POST   /api/consultant/create-subscription - Create subscription');
  console.log('   GET    /api/consultant/profile/:email    - Get consultant profile');
  console.log('   GET    /api/consultant/download-cv/:userId - Download CV');
  console.log('');
  console.log('   🏢 CLIENT ENDPOINTS:');
  console.log('   POST   /api/client/complete-profile      - Complete client profile');
  console.log('   POST   /api/client/create-request        - Create client request');
  console.log('   GET    /api/client/profile/:email        - Get client profile');
  console.log('   GET    /api/client/requests/:email       - Get client requests');
  console.log('');
  console.log('   📊 DASHBOARD ENDPOINTS:');
  console.log('   GET    /api/dashboard/:email             - Get dashboard data');
  console.log('   GET    /api/positions                    - Get available positions');
  console.log('');
  console.log('   📅 AVAILABILITY ENDPOINTS:');
  console.log('   GET    /api/availability/:userType/:userId - Get availability');
  console.log('   POST   /api/availability/save            - Save availability');
  console.log('');
  console.log('   📋 AGENDA ENDPOINTS:');
  console.log('   GET    /api/agenda/:email                - Get agenda items');
  console.log('   POST   /api/agenda/create                - Create agenda item');
  console.log('   PUT    /api/agenda/:itemId               - Update agenda item');
  console.log('   DELETE /api/agenda/:itemId               - Delete agenda item');
  console.log('');
  console.log('   📞 SUPPORT ENDPOINTS:');
  console.log('   POST   /api/support/submit               - Submit support request');
  console.log('   GET    /api/support/user/:email          - Get user support requests');
  console.log('   GET    /api/support/ticket/:ticketId     - Get ticket details');
  console.log('');
  console.log('   👑 ADMIN ENDPOINTS:');
  console.log('   GET    /api/admin/consultants            - List all consultants');
  console.log('   GET    /api/admin/clients                - List all clients');
  console.log('   GET    /api/admin/requests               - List all requests');
  console.log('   GET    /api/admin/match-suggestions      - View match suggestions');
  console.log('   PUT    /api/admin/update-match-status    - Update match status');
  console.log('   GET    /api/admin/stats                  - Admin statistics');
  console.log('   GET    /api/admin/support-requests       - List support requests');
  console.log('   POST   /api/admin/support-requests/:id/reply - Reply to support');
  console.log('   PUT    /api/admin/support-requests/:id/status - Update support status');
  console.log('=====================================\n');
});

// Debug endpoint to list all routes (add this after all your routes)


module.exports = app;