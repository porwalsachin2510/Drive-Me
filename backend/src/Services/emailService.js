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
