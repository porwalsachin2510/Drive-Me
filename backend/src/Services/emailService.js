import nodemailer from 'nodemailer';
import crypto from 'crypto';

// Email configuration
const createTransporter = () => {
    return nodemailer.createTransport({
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: process.env.EMAIL_PORT || 587,
        secure: process.env.EMAIL_SECURE === 'true',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });
};

// Send Pass Email
export const sendPassEmail = async (email, monthlyPass, type) => {
    try {
        let subject, htmlContent;

        switch (type) {
            case 'ACTIVATION':
                subject = '🎫 Your Monthly Pass is Activated!';
                htmlContent = generateActivationEmail(monthlyPass);
                break;
            case 'RENEWAL_REMINDER':
                subject = '⏰ Your Monthly Pass is Expiring Soon';
                htmlContent = generateRenewalReminderEmail(monthlyPass);
                break;
            case 'EXPIRY_NOTICE':
                subject = '⚠️ Your Monthly Pass Has Expired';
                htmlContent = generateExpiryNoticeEmail(monthlyPass);
                break;
            default:
                subject = '🎫 Monthly Pass Update';
                htmlContent = generateGenericEmail(monthlyPass);
        }

        const transporter = createTransporter();
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject,
            html: htmlContent,
        };

        await transporter.sendMail(mailOptions);
        console.log(`[v0] ${type} email sent to:`, email);

    } catch (error) {
        console.error(`[v0] Error sending ${type} email:`, error);
        throw error;
    }
};

// Generate Activation Email
const generateActivationEmail = (monthlyPass) => {
    const passTypeText = monthlyPass.passType === 'ROUND_TRIP' ? 'Round Trip' : 'One Way';
    const startDate = new Date(monthlyPass.startDate).toLocaleDateString();
    const endDate = new Date(monthlyPass.endDate).toLocaleDateString();

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Monthly Pass Activated</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .header h1 { color: white; margin: 0; font-size: 28px; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                .pass-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea; }
                .pass-details h3 { color: #667eea; margin-top: 0; }
                .detail-row { display: flex; justify-content: space-between; margin: 10px 0; padding: 10px 0; border-bottom: 1px solid #eee; }
                .detail-label { font-weight: bold; color: #666; }
                .detail-value { color: #333; }
                .cta-button { background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0; font-weight: bold; }
                .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
                .highlight { background: #fff3cd; padding: 10px; border-radius: 5px; border-left: 4px solid #ffc107; margin: 10px 0; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🎫 Your Monthly Pass is Activated!</h1>
                </div>
                <div class="content">
                    <p>Dear Passenger,</p>
                    <p>Congratulations! Your ${passTypeText} monthly pass has been successfully activated.</p>
                    
                    <div class="pass-details">
                        <h3>📋 Pass Details</h3>
                        <div class="detail-row">
                            <span class="detail-label">Pass Type:</span>
                            <span class="detail-value">${passTypeText}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Valid From:</span>
                            <span class="detail-value">${startDate}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Valid Until:</span>
                            <span class="detail-value">${endDate}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Outbound Trip:</span>
                            <span class="detail-value">${monthlyPass.outboundTripTime}</span>
                        </div>
                        ${monthlyPass.returnTripTime ? `
                        <div class="detail-row">
                            <span class="detail-label">Return Trip:</span>
                            <span class="detail-value">${monthlyPass.returnTripTime}</span>
                        </div>` : ''}
                        <div class="detail-row">
                            <span class="detail-label">Route:</span>
                            <span class="detail-value">${monthlyPass.pickupLocation} → ${monthlyPass.dropoffLocation}</span>
                        </div>
                    </div>

                    <div class="highlight">
                        <strong>📍 Important:</strong> Your pass is now active! You can travel daily at your scheduled times. Please show this email or your pass certificate when boarding.
                    </div>

                    <div style="text-align: center;">
                        <a href="#" class="cta-button">View My Passes</a>
                    </div>

                    <div class="footer">
                        <p>Thank you for choosing DriveMe!</p>
                        <p>For support, contact us at support@driveMe.com</p>
                    </div>
                </div>
            </div>
        </body>
        </html>
    `;
};

// Generate Renewal Reminder Email
const generateRenewalReminderEmail = (monthlyPass) => {
    const daysRemaining = Math.max(0, Math.ceil((new Date(monthlyPass.endDate) - new Date()) / (1000 * 60 * 60 * 24)));
    const passTypeText = monthlyPass.passType === 'ROUND_TRIP' ? 'Round Trip' : 'One Way';

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Pass Renewal Reminder</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #ffc107 0%, #ff9800 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .header h1 { color: white; margin: 0; font-size: 28px; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                .warning-box { background: #fff3cd; border: 1px solid #ffc107; padding: 20px; border-radius: 8px; margin: 20px 0; }
                .cta-button { background: #ffc107; color: #333; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0; font-weight: bold; }
                .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>⏰ Your Monthly Pass is Expiring Soon</h1>
                </div>
                <div class="content">
                    <p>Dear Passenger,</p>
                    
                    <div class="warning-box">
                        <strong>⚠️ Attention:</strong> Your ${passTypeText} monthly pass will expire in <strong>${daysRemaining} days</strong>.
                    </div>

                    <p>To continue enjoying your daily commute without interruption, please renew your pass before it expires.</p>

                    <div style="text-align: center;">
                        <a href="#" class="cta-button">Renew My Pass</a>
                    </div>

                    <div class="footer">
                        <p>Thank you for choosing DriveMe!</p>
                        <p>For support, contact us at support@driveMe.com</p>
                    </div>
                </div>
            </div>
        </body>
        </html>
    `;
};

// Generate Expiry Notice Email
const generateExpiryNoticeEmail = (monthlyPass) => {
    const passTypeText = monthlyPass.passType === 'ROUND_TRIP' ? 'Round Trip' : 'One Way';

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Pass Expired</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .header h1 { color: white; margin: 0; font-size: 28px; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                .alert-box { background: #f8d7da; border: 1px solid #dc3545; padding: 20px; border-radius: 8px; margin: 20px 0; }
                .cta-button { background: #dc3545; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0; font-weight: bold; }
                .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>⚠️ Your Monthly Pass Has Expired</h1>
                </div>
                <div class="content">
                    <p>Dear Passenger,</p>
                    
                    <div class="alert-box">
                        <strong>❌ Notice:</strong> Your ${passTypeText} monthly pass expired on ${new Date(monthlyPass.endDate).toLocaleDateString()}.
                    </div>

                    <p>To continue your daily commute, please purchase a new pass.</p>

                    <div style="text-align: center;">
                        <a href="#" class="cta-button">Buy New Pass</a>
                    </div>

                    <div class="footer">
                        <p>Thank you for choosing DriveMe!</p>
                        <p>For support, contact us at support@driveMe.com</p>
                    </div>
                </div>
            </div>
        </body>
        </html>
    `;
};

// Generate Generic Email
const generateGenericEmail = (monthlyPass) => {
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Monthly Pass Update</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .header h1 { color: white; margin: 0; font-size: 28px; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🎫 Monthly Pass Update</h1>
                </div>
                <div class="content">
                    <p>Dear Passenger,</p>
                    <p>There is an update regarding your monthly pass. Please check your account for more details.</p>
                    
                    <div class="footer">
                        <p>Thank you for choosing DriveMe!</p>
                        <p>For support, contact us at support@driveMe.com</p>
                    </div>
                </div>
            </div>
        </body>
        </html>
    `;
};
export const sendDriverCredentials = async (driverEmail, driverPassword, driverName, companyName) => {
    try {
        const transporter = createTransporter();

        const mailOptions = {
            from: process.env.EMAIL_FROM || '"DriveMe" <noreply@driveme.com>',
            to: driverEmail,
            subject: 'Welcome to DriveMe - Your Login Credentials',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; text-align: center;">
                        <h1 style="margin: 0; font-size: 28px;">🚗 Welcome to DriveMe</h1>
                        <h2 style="margin: 10px 0 20px 0; font-size: 20px;">Driver Account Created</h2>
                    </div>
                    
                    <div style="background: #f8f9fa; padding: 30px; border-radius: 10px; margin: 20px 0;">
                        <h3 style="color: #333; margin-top: 0;">Hello ${driverName},</h3>
                        <p style="color: #666; line-height: 1.6;">Your driver account has been successfully created on DriveMe platform. Below are your login credentials:</p>
                        
                        <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #667eea; margin: 20px 0;">
                            <h4 style="color: #333; margin-top: 0;">🔐 Your Login Credentials:</h4>
                            <div style="background: #e3f2fd; padding: 15px; border-radius: 5px; margin: 15px 0;">
                                <p style="margin: 0 0 10px 0; font-weight: bold; color: #333;">Email Address:</p>
                                <p style="margin: 0; font-size: 18px; color: #667eea; font-weight: bold;">${driverEmail}</p>
                            </div>
                            <div style="background: #e3f2fd; padding: 15px; border-radius: 5px; margin: 15px 0;">
                                <p style="margin: 0 0 10px 0; font-weight: bold; color: #333;">Password:</p>
                                <p style="margin: 0; font-size: 18px; color: #667eea; font-weight: bold;">${driverPassword}</p>
                            </div>
                        </div>
                        
                        <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border: 1px solid #ffeaa7;">
                            <p style="margin: 0; color: #856404;"><strong>⚠️ Important:</strong> Please change your password after first login for security reasons.</p>
                        </div>
                        
                        <div style="background: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0;">
                            <h4 style="color: #155724; margin-top: 0;">📱 Quick Login:</h4>
                            <p style="color: #155724; margin: 5px 0;">You can now login to your driver dashboard using the credentials above.</p>
                            <p style="margin: 10px 0;">
                                <a href="${process.env.FRONTEND_URL.split(",")[0]}/login" 
                                   style="background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                                    Login to Your Dashboard
                                </a>
                            </p>
                        </div>
                        
                        <div style="background: #f1f8e9; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
                            <p style="margin: 0; color: #666; font-size: 14px;">
                                ${companyName ? `<strong>Company:</strong> ${companyName}<br>` : ''}
                                <strong>Role:</strong> ${driverName.includes('Corporate') ? 'Corporate Driver' : 'B2B Partner Driver'}<br>
                                <strong>Platform:</strong> DriveMe Driver Management System
                            </p>
                        </div>
                    </div>
                    
                    <div style="background: #667eea; color: white; padding: 20px; border-radius: 0 0 10px 10px; text-align: center;">
                        <p style="margin: 0; font-size: 14px;">Need help? Contact our support team</p>
                        <p style="margin: 5px 0 0 0;">
                            <a href="mailto:support@driveme.com" style="color: white; text-decoration: underline;">support@driveme.com</a> | 
                            <a href="${process.env.FRONTEND_URL.split(",")[0]}/help" style="color: white; text-decoration: underline;">Help Center</a>
                        </p>
                    </div>
                </div>
            `,
        };

        await transporter.sendMail(mailOptions);
        console.log(`Driver credentials email sent to: ${driverEmail}`);

        return {
            success: true,
            message: 'Email sent successfully'
        };
    } catch (error) {
        console.error('Error sending driver credentials email:', error);
        return {
            success: false,
            message: error.message
        };
    }
};

// Send booking notifications
export const sendBookingNotification = async (userEmail, userName, message, bookingDetails) => {
    try {
        const transporter = createTransporter();

        const mailOptions = {
            from: process.env.EMAIL_FROM || '"DriveMe" <noreply@driveme.com>',
            to: userEmail,
            subject: `DriveMe - ${message}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px; text-align: center;">
                        <h2>🚗 DriveMe Notification</h2>
                    </div>
                    
                    <div style="background: #f8f9fa; padding: 30px; border-radius: 10px; margin: 20px 0;">
                        <h3 style="color: #333;">Hello ${userName},</h3>
                        <p style="color: #666; line-height: 1.6;">${message}</p>
                        
                        ${bookingDetails ? `
                        <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #667eea; margin: 20px 0;">
                            <h4 style="color: #333;">📋 Booking Details:</h4>
                            ${bookingDetails}
                        </div>
                        ` : ''}
                        
                        <div style="background: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
                            <p style="margin: 0; color: #155724;">
                                <a href="${process.env.FRONTEND_URL.split(",")[0]}/dashboard" 
                                   style="background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                                    View Your Dashboard
                                </a>
                            </p>
                        </div>
                    </div>
                </div>
            `,
        };

        await transporter.sendMail(mailOptions);
        console.log(`Booking notification sent to: ${userEmail}`);

        return {
            success: true,
            message: 'Notification sent successfully'
        };
    } catch (error) {
        console.error('Error sending booking notification:', error);
        return {
            success: false,
            message: error.message
        };
    }
};

// Generate 6-digit OTP
export const generateOTP = () => {
    return crypto.randomInt(100000, 999999).toString();
};

// Send OTP for email verification
export const sendVerificationOTP = async (userEmail, userName, otp) => {
    try {
        const transporter = createTransporter();

        const mailOptions = {
            from: process.env.EMAIL_FROM || '"DriveMe" <noreply@driveme.com>',
            to: userEmail,
            subject: 'DriveMe - Verify Your Email Address',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; text-align: center;">
                        <h1 style="margin: 0; font-size: 28px;">🚗 Welcome to DriveMe</h1>
                        <h2 style="margin: 10px 0 20px 0; font-size: 20px;">Verify Your Email</h2>
                    </div>
                    
                    <div style="background: #f8f9fa; padding: 30px; border-radius: 10px; margin: 20px 0;">
                        <h3 style="color: #333; margin-top: 0;">Hello ${userName},</h3>
                        <p style="color: #666; line-height: 1.6;">Thank you for registering with DriveMe! To complete your registration and ensure the security of your account, please verify your email address.</p>
                        
                        <div style="background: white; padding: 30px; border-radius: 8px; border-left: 4px solid #667eea; margin: 20px 0; text-align: center;">
                            <h4 style="color: #333; margin-top: 0;">🔐 Your Verification Code:</h4>
                            <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 15px 0; display: inline-block;">
                                <p style="margin: 0; font-size: 32px; color: #667eea; font-weight: bold; letter-spacing: 5px; font-family: monospace;">${otp}</p>
                            </div>
                            <p style="color: #666; font-size: 14px; margin: 15px 0;">This code will expire in <strong>10 minutes</strong></p>
                        </div>
                        
                        <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border: 1px solid #ffeaa7;">
                            <p style="margin: 0; color: #856404;"><strong>🔒 Security Notice:</strong> Never share this verification code with anyone. DriveMe staff will never ask for your OTP.</p>
                        </div>
                        
                        <div style="background: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0;">
                            <h4 style="color: #155724; margin-top: 0;">📱 Next Steps:</h4>
                            <ol style="color: #155724; margin: 10px 0; padding-left: 20px;">
                                <li>Enter the verification code in the registration form</li>
                                <li>Your email will be verified instantly</li>
                                <li>You can then access all DriveMe features</li>
                            </ol>
                        </div>
                        
                        <div style="background: #f1f8e9; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
                            <p style="margin: 0; color: #666; font-size: 14px;">
                                <strong>Account Details:</strong><br>
                                Email: ${userEmail}<br>
                                Platform: DriveMe Transport System
                            </p>
                        </div>
                        
                        <div style="background: #e8f5e8; padding: 15px; border-radius: 5px; margin: 20px 0;">
                            <p style="margin: 0; color: #2d6a2d; font-size: 14px;">
                                <strong>📧 Didn't request this?</strong><br>
                                If you didn't create an account with DriveMe, please ignore this email or contact our support team.
                            </p>
                        </div>
                    </div>
                    
                    <div style="background: #667eea; color: white; padding: 20px; border-radius: 0 0 10px 10px; text-align: center;">
                        <p style="margin: 0; font-size: 14px;">Need help? Contact our support team</p>
                        <p style="margin: 5px 0 0 0;">
                            <a href="mailto:support@driveme.com" style="color: white; text-decoration: underline;">support@driveme.com</a> | 
                            <a href="${process.env.FRONTEND_URL.split(",")[0]}/help" style="color: white; text-decoration: underline;">Help Center</a>
                        </p>
                    </div>
                </div>
            `,
        };

        await transporter.sendMail(mailOptions);
        console.log(`Verification OTP email sent to: ${userEmail}`);

        return {
            success: true,
            message: 'OTP sent successfully'
        };
    } catch (error) {
        console.error('Error sending verification OTP:', error);
        return {
            success: false,
            message: error.message
        };
    }
};

// Send OTP for password reset
export const sendPasswordResetOTP = async (userEmail, userName, otp) => {
    try {
        const transporter = createTransporter();

        const mailOptions = {
            from: process.env.EMAIL_FROM || '"DriveMe" <noreply@driveme.com>',
            to: userEmail,
            subject: 'DriveMe - Password Reset Request',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 30px; border-radius: 10px; text-align: center;">
                        <h1 style="margin: 0; font-size: 28px;">🔐 DriveMe Security</h1>
                        <h2 style="margin: 10px 0 20px 0; font-size: 20px;">Password Reset Request</h2>
                    </div>
                    
                    <div style="background: #f8f9fa; padding: 30px; border-radius: 10px; margin: 20px 0;">
                        <h3 style="color: #333; margin-top: 0;">Hello ${userName},</h3>
                        <p style="color: #666; line-height: 1.6;">We received a request to reset your password for your DriveMe account. Use the verification code below to proceed:</p>
                        
                        <div style="background: white; padding: 30px; border-radius: 8px; border-left: 4px solid #f5576c; margin: 20px 0; text-align: center;">
                            <h4 style="color: #333; margin-top: 0;">🔑 Reset Code:</h4>
                            <div style="background: #ffe0e0; padding: 20px; border-radius: 8px; margin: 15px 0; display: inline-block;">
                                <p style="margin: 0; font-size: 32px; color: #f5576c; font-weight: bold; letter-spacing: 5px; font-family: monospace;">${otp}</p>
                            </div>
                            <p style="color: #666; font-size: 14px; margin: 15px 0;">This code will expire in <strong>10 minutes</strong></p>
                        </div>
                        
                        <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border: 1px solid #ffeaa7;">
                            <p style="margin: 0; color: #856404;"><strong>⚠️ Security Alert:</strong> If you didn't request a password reset, please ignore this email and contact support immediately.</p>
                        </div>
                    </div>
                    
                    <div style="background: #667eea; color: white; padding: 20px; border-radius: 0 0 10px 10px; text-align: center;">
                        <p style="margin: 0; font-size: 14px;">Need help? Contact our support team</p>
                        <p style="margin: 5px 0 0 0;">
                            <a href="mailto:support@driveme.com" style="color: white; text-decoration: underline;">support@driveme.com</a>
                        </p>
                    </div>
                </div>
            `,
        };

        await transporter.sendMail(mailOptions);
        console.log(`Password reset OTP email sent to: ${userEmail}`);

        return {
            success: true,
            message: 'Password reset OTP sent successfully'
        };
    } catch (error) {
        return {
            success: false,
            message: error.message
        };
    }
};

// Send wallet notification email from admin
export const sendWalletNotificationEmail = async (userEmail, userName, notificationData) => {
    try {
        const { title, message, reason, actionRequired, walletBalance, currency } = notificationData;

        const actionButtonText = actionRequired === "ADD_FUNDS" ? "Add Funds Now"
            : actionRequired === "MAKE_PAYMENT" ? "Make Payment"
                : actionRequired === "REVIEW_TRANSACTION" ? "Review Transaction"
                    : "View Wallet";

        const reasonText = {
            "LOW_BALANCE": "Low Wallet Balance",
            "PAYMENT_PENDING": "Payment Pending",
            "BOOKING_ISSUE": "Booking Issue",
            "CONTRACT_PAYMENT": "Contract Payment Due",
            "COMMISSION_DUE": "Commission Due",
            "GENERAL": "Important Notice"
        }[reason] || "Important Notice";

        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${title}</title>
                <style>
                    body { font-family: 'Inter', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .email-card { background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
                    .header { background: linear-gradient(135deg, #2DD4BF 0%, #14B8A6 100%); padding: 30px; text-align: center; }
                    .header h1 { color: white; margin: 0; font-size: 24px; font-weight: 700; }
                    .header .badge { display: inline-block; background: rgba(255,255,255,0.2); color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; margin-top: 10px; }
                    .content { padding: 30px; }
                    .greeting { font-size: 18px; color: #1e293b; margin-bottom: 20px; }
                    .message-box { background: #f8fafc; border-left: 4px solid #2DD4BF; padding: 20px; border-radius: 0 8px 8px 0; margin: 20px 0; }
                    .message-box h3 { color: #1e293b; margin: 0 0 10px 0; font-size: 16px; }
                    .message-box p { color: #64748b; margin: 0; font-size: 14px; }
                    .balance-section { background: linear-gradient(135deg, #f0fdf9 0%, #e0f7f4 100%); padding: 20px; border-radius: 12px; text-align: center; margin: 20px 0; }
                    .balance-label { font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; }
                    .balance-value { font-size: 32px; font-weight: 700; color: #0D9488; margin: 8px 0; }
                    .balance-currency { font-size: 14px; color: #64748b; }
                    .cta-button { display: inline-block; background: #2DD4BF; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; margin: 20px 0; }
                    .cta-button:hover { background: #14B8A6; }
                    .warning-box { background: #FEF3C7; border: 1px solid #F59E0B; padding: 16px; border-radius: 8px; margin: 20px 0; }
                    .warning-box p { color: #92400E; margin: 0; font-size: 14px; }
                    .footer { background: #f8fafc; padding: 20px 30px; text-align: center; border-top: 1px solid #e2e8f0; }
                    .footer p { color: #64748b; font-size: 12px; margin: 5px 0; }
                    .footer a { color: #2DD4BF; text-decoration: none; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="email-card">
                        <div class="header">
                            <h1>${title}</h1>
                            <span class="badge">${reasonText}</span>
                        </div>
                        <div class="content">
                            <p class="greeting">Hello ${userName},</p>
                            
                            <div class="message-box">
                                <h3>Message from Admin</h3>
                                <p>${message}</p>
                            </div>
                            
                            <div class="balance-section">
                                <span class="balance-label">Your Current Wallet Balance</span>
                                <div class="balance-value">${walletBalance?.toFixed(2) || '0.00'}</div>
                                <span class="balance-currency">${currency || 'KWD'}</span>
                            </div>
                            
                            ${actionRequired && actionRequired !== "NONE" ? `
                            <div class="warning-box">
                                <p><strong>Action Required:</strong> ${actionButtonText.replace('Now', '').trim()} to continue using our services without interruption.</p>
                            </div>
                            ` : ''}
                            
                            <div style="text-align: center;">
                                <a href="${process.env.FRONTEND_URL?.split(",")[0] || 'https://driveme.com'}/wallet" class="cta-button">${actionButtonText}</a>
                            </div>
                        </div>
                        <div class="footer">
                            <p>This is an automated message from DriveMe Admin</p>
                            <p>Need help? <a href="mailto:support@driveme.com">Contact Support</a></p>
                            <p>DriveMe - Your Trusted Transportation Partner</p>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `;

        const transporter = createTransporter();
        const mailOptions = {
            from: process.env.EMAIL_FROM || '"DriveMe Admin" <admin@driveme.com>',
            to: userEmail,
            subject: `DriveMe: ${title}`,
            html: htmlContent,
        };

        await transporter.sendMail(mailOptions);
        console.log(`[v0] Wallet notification email sent to: ${userEmail}`);

        return {
            success: true,
            message: 'Wallet notification email sent successfully'
        };
    } catch (error) {
        console.error('[v0] Error sending wallet notification email:', error);
        return {
            success: false,
            message: error.message
        };
    }
};

// Send admin alert when user responds to wallet notification
export const sendAdminWalletResponseAlert = async (adminEmail, userData, responseData) => {
    try {
        const { userName, userEmail, userRole, responseType, newBalance, currency } = responseData;

        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>User Wallet Response</title>
                <style>
                    body { font-family: 'Inter', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .email-card { background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
                    .header { background: linear-gradient(135deg, #22C55E 0%, #16A34A 100%); padding: 30px; text-align: center; }
                    .header h1 { color: white; margin: 0; font-size: 22px; font-weight: 700; }
                    .content { padding: 30px; }
                    .user-card { background: #f8fafc; border-radius: 12px; padding: 20px; margin: 20px 0; display: flex; align-items: center; gap: 16px; }
                    .user-avatar { width: 50px; height: 50px; border-radius: 50%; background: linear-gradient(135deg, #2DD4BF, #14B8A6); display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 18px; }
                    .user-info h3 { margin: 0; color: #1e293b; font-size: 16px; }
                    .user-info p { margin: 4px 0 0 0; color: #64748b; font-size: 14px; }
                    .response-box { background: #D1FAE5; border: 1px solid #22C55E; padding: 16px; border-radius: 8px; margin: 20px 0; }
                    .response-box h4 { color: #166534; margin: 0 0 8px 0; }
                    .response-box p { color: #15803D; margin: 0; }
                    .balance-info { display: flex; justify-content: space-between; padding: 16px; background: #f8fafc; border-radius: 8px; margin: 20px 0; }
                    .balance-item { text-align: center; }
                    .balance-item .label { font-size: 11px; color: #64748b; text-transform: uppercase; }
                    .balance-item .value { font-size: 20px; font-weight: 700; color: #1e293b; }
                    .cta-button { display: inline-block; background: #2DD4BF; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; }
                    .footer { background: #f8fafc; padding: 20px 30px; text-align: center; border-top: 1px solid #e2e8f0; }
                    .footer p { color: #64748b; font-size: 12px; margin: 5px 0; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="email-card">
                        <div class="header">
                            <h1>User Responded to Wallet Alert</h1>
                        </div>
                        <div class="content">
                            <p>A user has responded to your wallet notification:</p>
                            
                            <div class="user-card">
                                <div class="user-avatar">${userName?.charAt(0) || 'U'}</div>
                                <div class="user-info">
                                    <h3>${userName}</h3>
                                    <p>${userEmail} | ${userRole?.replace(/_/g, ' ')}</p>
                                </div>
                            </div>
                            
                            <div class="response-box">
                                <h4>Action Taken</h4>
                                <p>${responseType === 'FUND_ADDED' ? 'User has added funds to their wallet'
                : responseType === 'PAYMENT_MADE' ? 'User has made a payment'
                    : responseType === 'TRANSACTION_REVIEWED' ? 'User has reviewed the transaction'
                        : 'User has responded to the notification'}</p>
                            </div>
                            
                            <div class="balance-info">
                                <div class="balance-item">
                                    <span class="label">New Balance</span>
                                    <span class="value">${newBalance?.toFixed(2) || '0.00'} ${currency || 'KWD'}</span>
                                </div>
                                <div class="balance-item">
                                    <span class="label">Response Time</span>
                                    <span class="value">${new Date().toLocaleString()}</span>
                                </div>
                            </div>
                            
                            <div style="text-align: center;">
                                <a href="${process.env.FRONTEND_URL?.split(",")[0] || 'https://driveme.com'}/admin" class="cta-button">View in Admin Dashboard</a>
                            </div>
                        </div>
                        <div class="footer">
                            <p>DriveMe Admin Notification System</p>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `;

        const transporter = createTransporter();
        const mailOptions = {
            from: process.env.EMAIL_FROM || '"DriveMe System" <system@driveme.com>',
            to: adminEmail,
            subject: `DriveMe: ${userName} responded to wallet notification`,
            html: htmlContent,
        };

        await transporter.sendMail(mailOptions);
        console.log(`[v0] Admin wallet response alert sent to: ${adminEmail}`);

        return {
            success: true,
            message: 'Admin alert email sent successfully'
        };
    } catch (error) {
        console.error('[v0] Error sending admin wallet response alert:', error);
        return {
            success: false,
            message: error.message
        };
    }
};

// Send booking warning email to B2C_PARTNER
export const sendBookingWarningEmail = async (partnerEmail, partnerName, bookingDetails) => {
    try {
        const transporter = createTransporter();

        const travelDateFormatted = bookingDetails.travelDate
            ? new Date(bookingDetails.travelDate).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            })
            : 'N/A';

        const cancellationTimeFormatted = bookingDetails.cancellationTime
            ? new Date(bookingDetails.cancellationTime).toLocaleString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            })
            : 'N/A';

        const mailOptions = {
            from: process.env.EMAIL_FROM || '"DriveMe" <noreply@driveme.com>',
            to: partnerEmail,
            subject: 'WARNING: Booking Acceptance Required - Action Needed Within ' + bookingDetails.hoursRemaining + ' Hours',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: linear-gradient(135deg, #f5af19 0%, #f12711 100%); color: white; padding: 30px; border-radius: 10px; text-align: center;">
                        <h1 style="margin: 0; font-size: 28px;">WARNING: Booking Acceptance Required</h1>
                        <p style="margin: 10px 0 0 0; font-size: 16px;">Action needed within ${bookingDetails.hoursRemaining} hours</p>
                    </div>
                    
                    <div style="background: #f8f9fa; padding: 30px; border-radius: 10px; margin: 20px 0;">
                        <h3 style="color: #333; margin-top: 0;">Hello ${partnerName},</h3>
                        
                        <div style="background: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 5px; margin: 20px 0;">
                            <p style="margin: 0; color: #856404; font-weight: bold;">
                                <span style="font-size: 20px;">IMPORTANT:</span> You have a pending booking that requires your acceptance.
                            </p>
                            <p style="margin: 10px 0 0 0; color: #856404;">
                                If you do not accept this booking within <strong>${bookingDetails.hoursRemaining} hours</strong>, 
                                it will be <strong>automatically cancelled</strong>.
                            </p>
                        </div>
                        
                        <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #ffc107; margin: 20px 0;">
                            <h4 style="color: #333; margin-top: 0;">Booking Details:</h4>
                            <table style="width: 100%; border-collapse: collapse;">
                                <tr>
                                    <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #666;"><strong>Booking ID:</strong></td>
                                    <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #333;">#${bookingDetails.bookingId}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #666;"><strong>Passenger:</strong></td>
                                    <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #333;">${bookingDetails.passengerName}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #666;"><strong>From:</strong></td>
                                    <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #333;">${bookingDetails.pickupLocation}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #666;"><strong>To:</strong></td>
                                    <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #333;">${bookingDetails.dropoffLocation}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #666;"><strong>Travel Date:</strong></td>
                                    <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #333;">${travelDateFormatted}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #666;"><strong>Amount:</strong></td>
                                    <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #333; font-weight: bold;">${bookingDetails.paymentAmount} ${bookingDetails.currency}</td>
                                </tr>
                            </table>
                        </div>
                        
                        <div style="background: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; border-radius: 5px; margin: 20px 0;">
                            <p style="margin: 0; color: #721c24;">
                                <strong>Auto-cancellation deadline:</strong> ${cancellationTimeFormatted}
                            </p>
                        </div>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${process.env.FRONTEND_URL}/b2c-partner/bookings" 
                               style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">
                                Accept Booking Now
                            </a>
                        </div>
                    </div>
                    
                    <div style="background: #667eea; color: white; padding: 20px; border-radius: 0 0 10px 10px; text-align: center;">
                        <p style="margin: 0; font-size: 14px;">Need help? Contact our support team</p>
                        <p style="margin: 5px 0 0 0;">
                            <a href="mailto:support@driveme.com" style="color: white; text-decoration: underline;">support@driveme.com</a>
                        </p>
                    </div>
                </div>
            `,
        };

        await transporter.sendMail(mailOptions);
        console.log(`[v0] Booking warning email sent to partner: ${partnerEmail}`);

        return {
            success: true,
            message: 'Warning email sent successfully'
        };
    } catch (error) {
        console.error('[v0] Error sending booking warning email:', error);
        return {
            success: false,
            message: error.message
        };
    }
};

// Send booking auto-cancelled email to both passenger and partner
export const sendBookingAutoCancelledEmail = async (recipientEmail, recipientName, bookingDetails, recipientType = 'passenger') => {
    try {
        const transporter = createTransporter();

        const travelDateFormatted = bookingDetails.travelDate
            ? new Date(bookingDetails.travelDate).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            })
            : 'N/A';

        const isPassenger = recipientType === 'passenger';

        const subject = isPassenger
            ? 'Your Booking Has Been Auto-Cancelled - Book With Another Partner'
            : 'Booking Auto-Cancelled Due to Timeout';

        const headerGradient = isPassenger
            ? 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)'
            : 'linear-gradient(135deg, #6c757d 0%, #495057 100%)';

        const headerText = isPassenger
            ? 'Booking Auto-Cancelled'
            : 'Booking Timeout - Auto-Cancelled';

        const mailOptions = {
            from: process.env.EMAIL_FROM || '"DriveMe" <noreply@driveme.com>',
            to: recipientEmail,
            subject: subject,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: ${headerGradient}; color: white; padding: 30px; border-radius: 10px; text-align: center;">
                        <h1 style="margin: 0; font-size: 28px;">${headerText}</h1>
                    </div>
                    
                    <div style="background: #f8f9fa; padding: 30px; border-radius: 10px; margin: 20px 0;">
                        <h3 style="color: #333; margin-top: 0;">Hello ${recipientName},</h3>
                        
                        ${isPassenger ? `
                        <div style="background: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; border-radius: 5px; margin: 20px 0;">
                            <p style="margin: 0; color: #721c24;">
                                <strong>We are sorry!</strong> Your booking has been automatically cancelled because 
                                <strong>${bookingDetails.partnerName}</strong> did not accept it within 24 hours.
                            </p>
                        </div>
                        
                        <p style="color: #666; line-height: 1.6;">
                            Don't worry! You can easily book with another B2C Partner for the same route. 
                            We apologize for the inconvenience caused.
                        </p>
                        ` : `
                        <div style="background: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 5px; margin: 20px 0;">
                            <p style="margin: 0; color: #856404;">
                                <strong>Notice:</strong> A booking from <strong>${bookingDetails.passengerName}</strong> 
                                has been automatically cancelled because you did not accept it within 24 hours.
                            </p>
                        </div>
                        
                        <p style="color: #666; line-height: 1.6;">
                            Please make sure to accept or reject bookings within 24 hours to maintain good service 
                            and avoid losing potential customers.
                        </p>
                        `}
                        
                        <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #dc3545; margin: 20px 0;">
                            <h4 style="color: #333; margin-top: 0;">Cancelled Booking Details:</h4>
                            <table style="width: 100%; border-collapse: collapse;">
                                <tr>
                                    <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #666;"><strong>Booking ID:</strong></td>
                                    <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #333;">#${bookingDetails.bookingId}</td>
                                </tr>
                                ${isPassenger ? `
                                <tr>
                                    <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #666;"><strong>Partner:</strong></td>
                                    <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #333;">${bookingDetails.partnerName}</td>
                                </tr>
                                ` : `
                                <tr>
                                    <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #666;"><strong>Passenger:</strong></td>
                                    <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #333;">${bookingDetails.passengerName}</td>
                                </tr>
                                `}
                                <tr>
                                    <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #666;"><strong>From:</strong></td>
                                    <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #333;">${bookingDetails.pickupLocation}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #666;"><strong>To:</strong></td>
                                    <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #333;">${bookingDetails.dropoffLocation}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #666;"><strong>Travel Date:</strong></td>
                                    <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #333;">${travelDateFormatted}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #666;"><strong>Amount:</strong></td>
                                    <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #333;">${bookingDetails.paymentAmount} ${bookingDetails.currency}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; color: #666;"><strong>Reason:</strong></td>
                                    <td style="padding: 8px 0; color: #dc3545;">${bookingDetails.reason}</td>
                                </tr>
                            </table>
                        </div>
                        
                        ${isPassenger ? `
                        <div style="background: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 5px; margin: 20px 0;">
                            <p style="margin: 0; color: #155724;">
                                <strong>What to do next?</strong> Browse available routes and book with another B2C Partner. 
                                Your journey doesn't have to wait!
                            </p>
                        </div>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${process.env.FRONTEND_URL}/" 
                               style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">
                                Find Another Route
                            </a>
                        </div>
                        ` : `
                        <div style="background: #d1ecf1; border: 1px solid #bee5eb; padding: 15px; border-radius: 5px; margin: 20px 0;">
                            <p style="margin: 0; color: #0c5460;">
                                <strong>Tip:</strong> Check your bookings regularly and accept or reject them promptly 
                                to provide the best service to your customers.
                            </p>
                        </div>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${process.env.FRONTEND_URL}/b2c-partner/bookings" 
                               style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">
                                View My Bookings
                            </a>
                        </div>
                        `}
                    </div>
                    
                    <div style="background: #667eea; color: white; padding: 20px; border-radius: 0 0 10px 10px; text-align: center;">
                        <p style="margin: 0; font-size: 14px;">Need help? Contact our support team</p>
                        <p style="margin: 5px 0 0 0;">
                            <a href="mailto:support@driveme.com" style="color: white; text-decoration: underline;">support@driveme.com</a>
                        </p>
                    </div>
                </div>
            `,
        };

        await transporter.sendMail(mailOptions);
        console.log(`[v0] Booking auto-cancelled email sent to ${recipientType}: ${recipientEmail}`);

        return {
            success: true,
            message: 'Auto-cancelled email sent successfully'
        };
    } catch (error) {
        console.error('[v0] Error sending booking auto-cancelled email:', error);
        return {
            success: false,
            message: error.message
        };
    }
};

// Generic email sending function
export const sendEmail = async (recipientEmail, subject, body, options = {}) => {
    try {
        const transporter = createTransporter();

        const mailOptions = {
            from: options.from || process.env.EMAIL_FROM || '"DriveMe" <noreply@driveme.com>',
            to: recipientEmail,
            subject: subject,
            html: body,
            // Additional options
            ...(options.cc && { cc: options.cc }),
            ...(options.bcc && { bcc: options.bcc }),
            ...(options.attachments && { attachments: options.attachments }),
            ...(options.replyTo && { replyTo: options.replyTo })
        };

        const result = await transporter.sendMail(mailOptions);
        console.log(`[v0] Email sent to: ${recipientEmail}, Message ID: ${result.messageId}`);
        
        return {
            success: true,
            messageId: result.messageId,
            message: 'Email sent successfully'
        };
    } catch (error) {
        console.error('[v0] Error sending email:', error);
        return {
            success: false,
            message: error.message,
            error: error
        };
    }
};
