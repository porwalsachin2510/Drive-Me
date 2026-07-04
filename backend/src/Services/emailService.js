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
export const sendPassEmail = async (email, monthlyPass, type, options = {}) => {
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
            // Optionally attach the monthly pass certificate PDF (and any other files)
            ...(Array.isArray(options.attachments) && options.attachments.length > 0
                ? { attachments: options.attachments }
                : {}),
        };

        await transporter.sendMail(mailOptions);
        console.log(`[v0] ${type} email sent to:`, email);

    } catch (error) {
        console.error(`[v0] Error sending ${type} email:`, error);
        throw error;
    }
};

// Build a shared, accurate Cancellation & Refund policy block for monthly pass emails.
// Mirrors the backend logic in bookingController.cancelBooking:
//  - Cancellation is allowed ONLY before the driver starts the trip.
//  - You are refunded the FULL amount paid for the pass; a time-based cancellation fee
//    is then deducted from that full amount (the only thing that ever reduces the refund).
//  - Online/Wallet payments are refunded to the in-app wallet; CASH is returned by the operator.
const generateCancellationPolicySection = (monthlyPass) => {
    const currency = monthlyPass?.currency || 'AED';
    const totalAmount = Number(monthlyPass?.totalAmount || 0);
    const travelDays = Number(
        monthlyPass?.travelDaysCount || monthlyPass?.totalTrips || 0
    );
    const perDay = travelDays > 0 ? totalAmount / travelDays : 0;
    const isCash = (monthlyPass?.paymentMethod || '').toUpperCase() === 'CASH';

    const fmt = (amt) => `${currency} ${Number(amt || 0).toFixed(2)}`;
    const totalText = totalAmount > 0 ? ` (${fmt(totalAmount)})` : '';
    const perDayNote = perDay > 0
        ? `<li style="color:#777;">For reference, your pass works out to about <strong>${fmt(perDay)} per travel day</strong> across ${travelDays} travel day${travelDays === 1 ? '' : 's'} &mdash; but you are refunded for the whole pass, not per day.</li>`
        : '';

    const refundChannelText = isCash
        ? `Because this pass was paid in <strong>CASH</strong>, the operator will return the refundable amount to you directly (offline). Any cancellation fee is retained by the platform.`
        : `Your refund will be credited to your <strong>DriveMe wallet</strong> automatically after cancellation.`;

    return `
        <div class="pass-details" style="border-left:4px solid #e53e3e;background:#fff5f5;padding:16px;border-radius:8px;margin:20px 0;">
            <h3 style="color:#e53e3e;margin-top:0;">🛑 Cancellation &amp; Refund Policy</h3>
            <p style="margin:6px 0 12px;color:#444;">
                You can cancel this pass <strong>only before the driver starts your trip</strong>.
                Once the driver (your operator or their assigned driver) starts a trip, that booking
                can no longer be cancelled.
            </p>

            <p style="margin:6px 0;color:#444;"><strong>How much do I get back?</strong></p>
            <ul style="margin:6px 0 12px;padding-left:20px;color:#444;">
                <li>You are refunded the <strong>full amount you paid</strong> for this pass${totalText}.
                    Because you can only cancel before your trip starts, the entire pass is treated as refundable.</li>
                <li>A cancellation fee is then deducted from that full amount based on timing:</li>
                ${perDayNote}
            </ul>

            <table style="width:100%;border-collapse:collapse;margin:8px 0;color:#444;">
                <tr><td style="padding:4px 0;">Within 12 hours of booking</td><td style="text-align:right;"><strong>FREE (no fee)</strong></td></tr>
                <tr><td style="padding:4px 0;">After 12 hours of booking</td><td style="text-align:right;"><strong>10% fee</strong></td></tr>
                <tr><td style="padding:4px 0;">After the operator accepts</td><td style="text-align:right;"><strong>20% fee</strong></td></tr>
                <tr><td style="padding:4px 0;">Within 24 hours of travel</td><td style="text-align:right;"><strong>30% fee</strong></td></tr>
            </table>

            <p style="margin:12px 0 6px;color:#444;"><strong>You get a FULL refund (no fee) when:</strong></p>
            <ul style="margin:6px 0 12px;padding-left:20px;color:#444;">
                <li>The operator/driver <strong>rejects</strong> your booking.</li>
                <li>You change your mind and cancel <strong>before the service starts</strong> within the free window above.</li>
                <li>The operator <strong>stops/cancels the route</strong> midway or for any operational reason.</li>
            </ul>

            <p style="margin:8px 0 0;color:#444;">
                <strong>💳 How your refund is paid:</strong> ${refundChannelText}
            </p>
        </div>
    `;
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

                    ${generateCancellationPolicySection(monthlyPass)}
                    
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

// Send an invoice email to a corporate client (new issue or reminder).
// `options.pdfBuffer` (Buffer) is attached as a PDF when provided.
export const sendInvoiceEmail = async (toEmail, invoice, options = {}) => {
    try {
        if (!toEmail) {
            console.log("[v0] sendInvoiceEmail skipped: no recipient email");
            return { success: false, message: "No recipient email" };
        }

        const transporter = createTransporter();
        const isReminder = options.isReminder;
        const cur = invoice.currency || "AED";
        const amount = (invoice.total || 0).toLocaleString();
        const dueDate = invoice.dueDate
            ? new Date(invoice.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
            : "N/A";
        const frontendUrl = (process.env.FRONTEND_URL || "").split(",")[0] || "";

        const subject = isReminder
            ? `Payment Reminder: Invoice ${invoice.invoiceNumber} (${amount} ${cur})`
            : `New Invoice ${invoice.invoiceNumber} from ${invoice.fleetOwnerName || "DriveMeGo"}`;

        const mailOptions = {
            from: process.env.EMAIL_FROM || process.env.EMAIL_USER || '"DriveMeGo" <noreply@drivemekw.com>',
            to: toEmail,
            subject,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background:#dc2626; color:#fff; padding:20px; border-radius:10px;">
                        <h2 style="margin:0;">DriveMeGo</h2>
                        <p style="margin:4px 0 0; opacity:.9;">${isReminder ? "Payment Reminder" : "New Invoice"}</p>
                    </div>
                    <div style="background:#f8f9fa; padding:30px; border-radius:10px; margin:20px 0;">
                        <p style="color:#333;">Dear ${invoice.corporateName || "Client"},</p>
                        <p style="color:#666; line-height:1.6;">
                            ${isReminder
                    ? `This is a friendly reminder that the following invoice is awaiting payment.`
                    : `A new invoice has been issued for your contract <strong>${invoice.contractNumber || ""}</strong>.`}
                        </p>
                        <div style="background:#fff; padding:20px; border-radius:8px; border-left:4px solid #dc2626; margin:20px 0;">
                            <p style="margin:6px 0;"><strong>Invoice #:</strong> ${invoice.invoiceNumber}</p>
                            <p style="margin:6px 0;"><strong>Amount:</strong> ${amount} ${cur}</p>
                            <p style="margin:6px 0;"><strong>Due Date:</strong> ${dueDate}</p>
                            <p style="margin:6px 0;"><strong>Status:</strong> ${invoice.status}</p>
                        </div>
                        ${frontendUrl
                    ? `<div style="text-align:center; margin-top:20px;">
                                 <a href="${frontendUrl}/corporate/billing" style="background:#dc2626; color:#fff; padding:12px 24px; text-decoration:none; border-radius:6px; display:inline-block; font-weight:bold;">View & Pay Invoice</a>
                               </div>`
                    : ""}
                    </div>
                    <p style="color:#999; font-size:12px; text-align:center;">Secure Payments by Stripe</p>
                </div>
            `,
            ...(options.pdfBuffer
                ? {
                    attachments: [
                        {
                            filename: `${invoice.invoiceNumber || "invoice"}.pdf`,
                            content: options.pdfBuffer,
                            contentType: "application/pdf",
                        },
                    ],
                }
                : {}),
        };

        await transporter.sendMail(mailOptions);
        console.log(`[v0] Invoice email sent to: ${toEmail} (${invoice.invoiceNumber})`);
        return { success: true };
    } catch (error) {
        console.error("[v0] Error sending invoice email:", error.message);
        return { success: false, message: error.message };
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
                            <a href="${process.env.FRONTEND_URL.split(",")[0]}/b2c-partner/bookings" 
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
                            <a href="${process.env.FRONTEND_URL.split(",")[0]}/" 
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
                            <a href="${process.env.FRONTEND_URL.split(",")[0]}/b2c-partner/bookings" 
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

// Send Welcome Email with Terms and Conditions
export const sendWelcomeEmailWithTerms = async ({ email, fullName, role, termsVersion, commissionRange, companyName }) => {
    try {
        const transporter = createTransporter();

        const roleDisplayName = {
            'CORPORATE': 'Corporate User',
            'B2B_PARTNER': 'B2B Partner',
            'B2C_PARTNER': 'B2C Partner'
        }[role] || role;

        const roleDescription = {
            'CORPORATE': 'request fleet services from B2B Partners and create contracts',
            'B2B_PARTNER': 'provide fleet services to Corporate clients',
            'B2C_PARTNER': 'provide transportation services to commuters'
        }[role] || 'use our platform services';

        const commissionExplanation = {
            'CORPORATE': `If you use our Admin negotiation service to get better prices from B2B Partners, a commission of ${commissionRange.min}% to ${commissionRange.max}% of the savings achieved may be charged.`,
            'B2B_PARTNER': `A commission of ${commissionRange.min}% to ${commissionRange.max}% will be charged on each contract you enter with Corporate clients through our platform.`,
            'B2C_PARTNER': `A commission of ${commissionRange.min}% to ${commissionRange.max}% will be charged on each booking you accept from commuters.`
        }[role] || `Commission rates range from ${commissionRange.min}% to ${commissionRange.max}%.`;

        const mailOptions = {
            from: process.env.EMAIL_FROM || '"DriveMe" <noreply@driveme.com>',
            to: email,
            subject: 'Welcome to DriveMe - Your Account is Ready!',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Welcome to DriveMe</title>
                </head>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4;">
                    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                        <div style="background: linear-gradient(135deg, #1a73e8 0%, #0d47a1 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                            <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to DriveMe!</h1>
                            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Your ${roleDisplayName} account is now active</p>
                        </div>
                        
                        <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px;">
                            <p>Dear ${fullName},</p>
                            <p>Thank you for joining DriveMe! Your account has been successfully created and verified.</p>
                            
                            <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #1a73e8;">
                                <h3 style="color: #1a73e8; margin-top: 0;">Account Details</h3>
                                <p style="margin: 5px 0;"><strong>Account Type:</strong> ${roleDisplayName}</p>
                                ${companyName ? `<p style="margin: 5px 0;"><strong>Company:</strong> ${companyName}</p>` : ''}
                                <p style="margin: 5px 0;"><strong>Email:</strong> ${email}</p>
                            </div>

                            <div style="background: #fff3e0; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ff9800;">
                                <h3 style="color: #e65100; margin-top: 0;">Commission Terms Accepted</h3>
                                <p style="margin: 5px 0;"><strong>Terms Version:</strong> ${termsVersion}</p>
                                <p style="margin: 10px 0 5px 0;"><strong>Commission Disclosure:</strong></p>
                                <p style="margin: 0; color: #555;">${commissionExplanation}</p>
                                <p style="margin: 15px 0 0 0; font-size: 13px; color: #666;">
                                    The exact commission rate applicable to your account will be set by the Admin based on various factors including service area, volume, and partnership level.
                                </p>
                            </div>

                            <div style="background: #e8f5e9; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4caf50;">
                                <h3 style="color: #2e7d32; margin-top: 0;">What You Can Do Now</h3>
                                <ul style="margin: 0; padding-left: 20px;">
                                    <li>Log in to your dashboard</li>
                                    <li>${roleDescription}</li>
                                    <li>View your commission settings in your profile</li>
                                    <li>Contact support if you have any questions</li>
                                </ul>
                            </div>

                            <div style="text-align: center; margin: 30px 0;">
                                <a href="${process.env.FRONTEND_URL.split(",")[0] || 'https://driveme.com'}/login" style="background: #1a73e8; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                                    Go to Dashboard
                                </a>
                            </div>

                            <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 20px;">
                                <p style="color: #666; font-size: 13px; margin: 0;">
                                    By using our services, you confirm your acceptance of our Terms and Conditions (Version ${termsVersion}).
                                    You can view the full terms at any time in your account settings.
                                </p>
                            </div>

                            <div style="text-align: center; margin-top: 30px; color: #666; font-size: 14px;">
                                <p>Thank you for choosing DriveMe!</p>
                                <p>For support, contact us at <a href="mailto:support@driveme.com" style="color: #1a73e8;">support@driveme.com</a></p>
                            </div>
                        </div>
                    </div>
                </body>
                </html>
            `,
        };

        await transporter.sendMail(mailOptions);
        console.log(`[v0] Welcome email with T&C sent to: ${email}`);

        return { success: true, message: 'Welcome email sent successfully' };
    } catch (error) {
        console.error('[v0] Error sending welcome email:', error);
        return { success: false, message: error.message };
    }
};

// Send Negotiation Request Email to Admin
export const sendNegotiationRequestEmail = async ({ negotiation, quotation, corporate, b2bPartner }) => {
    try {
        const transporter = createTransporter();

        // Get admin emails (in production, you'd fetch admin users)
        const adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_USER;

        const mailOptions = {
            from: process.env.EMAIL_FROM || '"DriveMe" <noreply@driveme.com>',
            to: adminEmail,
            subject: `New Negotiation Request - ${negotiation.negotiationNumber}`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <title>New Negotiation Request</title>
                </head>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #f4f4f4;">
                    <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px;">
                        <h2 style="color: #1a73e8; border-bottom: 2px solid #1a73e8; padding-bottom: 10px;">
                            New Negotiation Request
                        </h2>
                        
                        <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin: 20px 0;">
                            <p style="margin: 0;"><strong>Negotiation #:</strong> ${negotiation.negotiationNumber}</p>
                            <p style="margin: 5px 0 0 0;"><strong>Quotation #:</strong> ${quotation?.quotationNumber || 'N/A'}</p>
                        </div>

                        <h3 style="color: #333; margin-top: 25px;">Corporate Details</h3>
                        <p><strong>Name:</strong> ${corporate?.fullName || 'N/A'}</p>
                        <p><strong>Company:</strong> ${corporate?.companyName || 'N/A'}</p>
                        <p><strong>Email:</strong> ${corporate?.email || 'N/A'}</p>

                        <h3 style="color: #333; margin-top: 25px;">B2B Partner Details</h3>
                        <p><strong>Name:</strong> ${b2bPartner?.fullName || 'N/A'}</p>
                        <p><strong>Company:</strong> ${b2bPartner?.companyName || 'N/A'}</p>
                        <p><strong>Email:</strong> ${b2bPartner?.email || 'N/A'}</p>

                        <h3 style="color: #333; margin-top: 25px;">Price Information</h3>
                        <p><strong>Current Price:</strong> ${negotiation.currency} ${negotiation.originalPrice}</p>
                        ${negotiation.corporateRequest?.expectedPrice ? `<p><strong>Expected Price:</strong> ${negotiation.currency} ${negotiation.corporateRequest.expectedPrice}</p>` : ''}
                        
                        ${negotiation.corporateRequest?.message ? `
                        <h3 style="color: #333; margin-top: 25px;">Corporate's Message</h3>
                        <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; font-style: italic;">
                            "${negotiation.corporateRequest.message}"
                        </div>
                        ` : ''}

                        <div style="text-align: center; margin-top: 30px;">
                            <a href="${process.env.FRONTEND_URL.split(",")[0] || 'https://driveme.com'}/admin/negotiations/${negotiation._id}" 
                               style="background: #1a73e8; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                                View Negotiation
                            </a>
                        </div>

                        <p style="color: #666; font-size: 13px; margin-top: 30px; text-align: center;">
                            This is an automated message from DriveMe Platform.
                        </p>
                    </div>
                </body>
                </html>
            `,
        };

        await transporter.sendMail(mailOptions);
        console.log(`[v0] Negotiation request email sent to admin`);

        return { success: true, message: 'Email sent successfully' };
    } catch (error) {
        console.error('[v0] Error sending negotiation request email:', error);
        return { success: false, message: error.message };
    }
};

// Send Negotiation Update Email
export const sendNegotiationUpdateEmail = async ({ negotiation, recipient, recipientType, action, message, proposedPrice }) => {
    try {
        const transporter = createTransporter();

        const actionMessages = {
            'STARTED': 'Admin has started working on your negotiation request.',
            'SENT_OFFER': `Admin has sent a new price proposal${proposedPrice ? ` of ${negotiation.currency} ${proposedPrice}` : ''}.`,
            'SENT_MESSAGE': 'You have received a message regarding the negotiation.',
            'COMPLETED': 'The negotiation has been completed successfully!',
            'FAILED': 'Unfortunately, the negotiation could not achieve a better price.',
            'CANCELLED': 'The negotiation has been cancelled.',
        };

        const statusColor = {
            'STARTED': '#1a73e8',
            'SENT_OFFER': '#ff9800',
            'SENT_MESSAGE': '#1a73e8',
            'COMPLETED': '#4caf50',
            'FAILED': '#f44336',
            'CANCELLED': '#9e9e9e',
        }[action] || '#1a73e8';

        const mailOptions = {
            from: process.env.EMAIL_FROM || '"DriveMe" <noreply@driveme.com>',
            to: recipient?.email,
            subject: `Negotiation Update - ${negotiation.negotiationNumber}`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <title>Negotiation Update</title>
                </head>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #f4f4f4;">
                    <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px;">
                        <h2 style="color: ${statusColor}; border-bottom: 2px solid ${statusColor}; padding-bottom: 10px;">
                            Negotiation Update
                        </h2>
                        
                        <p>Dear ${recipient?.fullName || 'User'},</p>
                        
                        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${statusColor};">
                            <p style="margin: 0; font-size: 16px;">${actionMessages[action] || 'There is an update on your negotiation.'}</p>
                        </div>

                        ${message ? `
                        <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin: 20px 0;">
                            <strong>Message:</strong>
                            <p style="margin: 10px 0 0 0;">${message}</p>
                        </div>
                        ` : ''}

                        <div style="background: #fafafa; padding: 15px; border-radius: 8px; margin: 20px 0;">
                            <p style="margin: 0;"><strong>Negotiation #:</strong> ${negotiation.negotiationNumber}</p>
                            <p style="margin: 5px 0;"><strong>Original Price:</strong> ${negotiation.currency} ${negotiation.originalPrice}</p>
                            ${negotiation.negotiatedPrice ? `<p style="margin: 5px 0;"><strong>Negotiated Price:</strong> ${negotiation.currency} ${negotiation.negotiatedPrice}</p>` : ''}
                            ${negotiation.priceSaved > 0 ? `<p style="margin: 5px 0; color: #4caf50;"><strong>Savings:</strong> ${negotiation.currency} ${negotiation.priceSaved}</p>` : ''}
                        </div>

                        <div style="text-align: center; margin-top: 30px;">
                            <a href="${process.env.FRONTEND_URL.split(",")[0] || 'https://driveme.com'}/b2b-partner-profile?tab=negotiations&id=${negotiation._id}" 
                               style="background: ${statusColor}; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                                View Details
                            </a>
                        </div>

                        <p style="color: #666; font-size: 13px; margin-top: 30px; text-align: center;">
                            This is an automated message from DriveMe Platform.
                        </p>
                    </div>
                </body>
                </html>
            `,
        };

        await transporter.sendMail(mailOptions);
        console.log(`[v0] Negotiation update email sent to ${recipientType}: ${recipient?.email}`);

        return { success: true, message: 'Email sent successfully' };
    } catch (error) {
        console.error('[v0] Error sending negotiation update email:', error);
        return { success: false, message: error.message };
    }
};

// EMI Payment Reminder Email
export const sendEMIReminderEmail = async ({ to, corporateName, contractNumber, installmentNumber, amount, currency, dueDate, daysUntilDue }) => {
    try {
        const transporter = createTransporter();

        const urgencyColor = daysUntilDue === 0 ? '#dc2626' : daysUntilDue <= 3 ? '#f59e0b' : '#667eea';
        const urgencyText = daysUntilDue === 0 ? 'Due Today' : `Due in ${daysUntilDue} Days`;

        const mailOptions = {
            from: process.env.EMAIL_FROM || '"DriveMe" <noreply@driveme.com>',
            to,
            subject: `EMI Payment Reminder - ${urgencyText} | Contract ${contractNumber}`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                </head>
                <body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: 'Segoe UI', Tahoma, sans-serif;">
                    <div style="max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; margin-top: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
                        <div style="text-align: center; margin-bottom: 30px;">
                            <h1 style="color: #111827; margin: 0;">EMI Payment Reminder</h1>
                            <p style="color: ${urgencyColor}; font-weight: bold; font-size: 18px;">${urgencyText}</p>
                        </div>
                        
                        <p style="color: #374151;">Dear ${corporateName},</p>
                        
                        <p style="color: #374151;">This is a reminder that your EMI payment is ${daysUntilDue === 0 ? 'due today' : `due in ${daysUntilDue} days`}.</p>
                        
                        <div style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); padding: 25px; border-radius: 12px; margin: 25px 0; border-left: 4px solid ${urgencyColor};">
                            <h3 style="margin: 0 0 15px 0; color: #111827;">Payment Details</h3>
                            <table style="width: 100%; border-collapse: collapse;">
                                <tr>
                                    <td style="padding: 8px 0; color: #6b7280;">Contract Number:</td>
                                    <td style="padding: 8px 0; color: #111827; font-weight: 600; text-align: right;">${contractNumber}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; color: #6b7280;">Installment #:</td>
                                    <td style="padding: 8px 0; color: #111827; font-weight: 600; text-align: right;">${installmentNumber}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; color: #6b7280;">Amount Due:</td>
                                    <td style="padding: 8px 0; color: #111827; font-weight: 700; text-align: right; font-size: 18px;">${currency} ${amount.toFixed(2)}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; color: #6b7280;">Due Date:</td>
                                    <td style="padding: 8px 0; color: ${urgencyColor}; font-weight: 600; text-align: right;">${dueDate}</td>
                                </tr>
                            </table>
                        </div>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${process.env.FRONTEND_URL?.split(",")[0] || 'https://driveme.com'}/corporate/contracts" 
                               style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px;">
                                Make Payment Now
                            </a>
                        </div>
                        
                        <p style="color: #6b7280; font-size: 13px; text-align: center; margin-top: 30px;">
                            Please ensure timely payment to avoid late fees. Contact us if you have any questions.
                        </p>
                    </div>
                </body>
                </html>
            `,
        };

        await transporter.sendMail(mailOptions);
        return { success: true };
    } catch (error) {
        console.error('[v0] Error sending EMI reminder email:', error);
        return { success: false, error: error.message };
    }
};

// EMI Overdue Warning Email
export const sendEMIOverdueEmail = async ({ to, corporateName, contractNumber, overdueCount, totalOverdue, currency, warningLevel, suspensionThreshold }) => {
    try {
        const transporter = createTransporter();

        const isCritical = warningLevel === 'CRITICAL';
        const headerColor = isCritical ? '#dc2626' : '#f59e0b';

        const mailOptions = {
            from: process.env.EMAIL_FROM || '"DriveMe" <noreply@driveme.com>',
            to,
            subject: isCritical
                ? `URGENT: Service Suspension Warning - ${overdueCount} Overdue EMIs | Contract ${contractNumber}`
                : `Payment Overdue Notice - ${overdueCount} Pending EMIs | Contract ${contractNumber}`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                </head>
                <body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: 'Segoe UI', Tahoma, sans-serif;">
                    <div style="max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; margin-top: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
                        <div style="background: ${headerColor}; color: white; padding: 20px; border-radius: 12px 12px 0 0; margin: -40px -40px 30px -40px; text-align: center;">
                            <h1 style="margin: 0; font-size: 24px;">${isCritical ? 'SERVICE SUSPENSION WARNING' : 'PAYMENT OVERDUE NOTICE'}</h1>
                        </div>
                        
                        <p style="color: #374151;">Dear ${corporateName},</p>
                        
                        ${isCritical ? `
                        <div style="background: #fee2e2; border: 1px solid #fecaca; padding: 15px; border-radius: 8px; margin: 20px 0;">
                            <p style="margin: 0; color: #991b1b; font-weight: 600;">
                                Your account has ${overdueCount} overdue EMI payments. This exceeds our threshold of ${suspensionThreshold} and your services may be suspended if payment is not received immediately.
                            </p>
                        </div>
                        ` : `
                        <p style="color: #374151;">
                            We noticed that you have ${overdueCount} overdue EMI payment(s) for Contract ${contractNumber}. Please make the payment at your earliest convenience to avoid service disruption.
                        </p>
                        `}
                        
                        <div style="background: ${isCritical ? '#fef2f2' : '#fef3c7'}; padding: 25px; border-radius: 12px; margin: 25px 0; border-left: 4px solid ${headerColor};">
                            <h3 style="margin: 0 0 15px 0; color: #111827;">Outstanding Amount</h3>
                            <table style="width: 100%; border-collapse: collapse;">
                                <tr>
                                    <td style="padding: 8px 0; color: #6b7280;">Contract Number:</td>
                                    <td style="padding: 8px 0; color: #111827; font-weight: 600; text-align: right;">${contractNumber}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; color: #6b7280;">Overdue Installments:</td>
                                    <td style="padding: 8px 0; color: ${headerColor}; font-weight: 700; text-align: right;">${overdueCount}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; color: #6b7280;">Total Outstanding:</td>
                                    <td style="padding: 8px 0; color: ${headerColor}; font-weight: 700; text-align: right; font-size: 20px;">${currency} ${totalOverdue.toFixed(2)}</td>
                                </tr>
                            </table>
                            <p style="margin: 15px 0 0 0; font-size: 13px; color: #6b7280;">
                                * Amount includes late fees as per your contract terms
                            </p>
                        </div>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${process.env.FRONTEND_URL?.split(",")[0] || 'https://driveme.com'}/corporate/contracts" 
                               style="background: ${headerColor}; color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px;">
                                Pay Now
                            </a>
                        </div>
                        
                        ${isCritical ? `
                        <p style="color: #991b1b; font-weight: 600; text-align: center;">
                            Failure to make payment immediately may result in suspension of all transportation services for your employees.
                        </p>
                        ` : ''}
                        
                        <p style="color: #6b7280; font-size: 13px; text-align: center; margin-top: 30px;">
                            If you have already made this payment, please disregard this notice. For assistance, contact our support team.
                        </p>
                    </div>
                </body>
                </html>
            `,
        };

        await transporter.sendMail(mailOptions);
        return { success: true };
    } catch (error) {
        console.error('[v0] Error sending EMI overdue email:', error);
        return { success: false, error: error.message };
    }
};

// EMI Payment Invoice Email
export const sendEMIInvoiceEmail = async ({ to, corporateName, contractNumber, installmentNumber, amount, lateFee, totalPaid, currency, paymentMethod, paymentDate, transactionId, remainingInstallments, remainingAmount }) => {
    try {
        const transporter = createTransporter();

        const mailOptions = {
            from: process.env.EMAIL_FROM || '"DriveMe" <noreply@driveme.com>',
            to,
            subject: `Payment Receipt - EMI #${installmentNumber} | Contract ${contractNumber}`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                </head>
                <body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: 'Segoe UI', Tahoma, sans-serif;">
                    <div style="max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; margin-top: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
                        <div style="text-align: center; margin-bottom: 30px;">
                            <div style="background: #dcfce7; color: #166534; padding: 10px 20px; border-radius: 20px; display: inline-block; font-weight: 600;">
                                Payment Successful
                            </div>
                            <h1 style="color: #111827; margin: 20px 0 10px 0;">EMI Payment Receipt</h1>
                            <p style="color: #6b7280; margin: 0;">Transaction ID: ${transactionId}</p>
                        </div>
                        
                        <p style="color: #374151;">Dear ${corporateName},</p>
                        
                        <p style="color: #374151;">Thank you for your payment. Here is your receipt for EMI installment #${installmentNumber}.</p>
                        
                        <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); padding: 25px; border-radius: 12px; margin: 25px 0; border: 1px solid #bbf7d0;">
                            <h3 style="margin: 0 0 20px 0; color: #166534; border-bottom: 1px solid #bbf7d0; padding-bottom: 10px;">Payment Details</h3>
                            <table style="width: 100%; border-collapse: collapse;">
                                <tr>
                                    <td style="padding: 10px 0; color: #6b7280;">Contract Number:</td>
                                    <td style="padding: 10px 0; color: #111827; font-weight: 600; text-align: right;">${contractNumber}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px 0; color: #6b7280;">Installment #:</td>
                                    <td style="padding: 10px 0; color: #111827; font-weight: 600; text-align: right;">${installmentNumber}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px 0; color: #6b7280;">EMI Amount:</td>
                                    <td style="padding: 10px 0; color: #111827; font-weight: 600; text-align: right;">${currency} ${amount.toFixed(2)}</td>
                                </tr>
                                ${lateFee > 0 ? `
                                <tr>
                                    <td style="padding: 10px 0; color: #dc2626;">Late Fee:</td>
                                    <td style="padding: 10px 0; color: #dc2626; font-weight: 600; text-align: right;">${currency} ${lateFee.toFixed(2)}</td>
                                </tr>
                                ` : ''}
                                <tr style="border-top: 2px solid #bbf7d0;">
                                    <td style="padding: 15px 0; color: #111827; font-weight: 700; font-size: 16px;">Total Paid:</td>
                                    <td style="padding: 15px 0; color: #166534; font-weight: 700; text-align: right; font-size: 20px;">${currency} ${totalPaid.toFixed(2)}</td>
                                </tr>
                            </table>
                        </div>
                        
                        <div style="background: #f9fafb; padding: 20px; border-radius: 12px; margin: 25px 0;">
                            <table style="width: 100%; border-collapse: collapse;">
                                <tr>
                                    <td style="padding: 8px 0; color: #6b7280;">Payment Method:</td>
                                    <td style="padding: 8px 0; color: #111827; text-align: right;">${paymentMethod}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; color: #6b7280;">Payment Date:</td>
                                    <td style="padding: 8px 0; color: #111827; text-align: right;">${paymentDate}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; color: #6b7280;">Remaining Installments:</td>
                                    <td style="padding: 8px 0; color: #111827; text-align: right;">${remainingInstallments}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; color: #6b7280;">Outstanding Balance:</td>
                                    <td style="padding: 8px 0; color: #111827; font-weight: 600; text-align: right;">${currency} ${remainingAmount.toFixed(2)}</td>
                                </tr>
                            </table>
                        </div>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${process.env.FRONTEND_URL?.split(",")[0] || 'https://driveme.com'}/corporate/contracts" 
                               style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold;">
                                View Contract Details
                            </a>
                        </div>
                        
                        <p style="color: #6b7280; font-size: 13px; text-align: center; margin-top: 30px;">
                            This is an automated receipt. Please keep it for your records.
                        </p>
                    </div>
                </body>
                </html>
            `,
        };

        await transporter.sendMail(mailOptions);
        return { success: true };
    } catch (error) {
        console.error('[v0] Error sending EMI invoice email:', error);
        return { success: false, error: error.message };
    }
};

// Send Suspension Email
export const sendSuspensionEmail = async ({ email, fullName, reason, durationDays, suspensionEndDate }) => {
    try {
        const transporter = createTransporter();
        const formattedEndDate = new Date(suspensionEndDate).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const mailOptions = {
            from: process.env.EMAIL_FROM || '"DriveMe" <noreply@driveme.com>',
            to: email,
            subject: 'Account Suspended - DriveMe',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Account Suspended</title>
                </head>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0;">
                    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                        <div style="background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                            <h1 style="color: white; margin: 0; font-size: 28px;">Account Suspended</h1>
                        </div>
                        
                        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
                            <h3 style="color: #333; margin-top: 0;">Hello ${fullName},</h3>
                            
                            <div style="background: #f8d7da; border: 1px solid #dc3545; padding: 20px; border-radius: 8px; margin: 20px 0;">
                                <p style="margin: 0; color: #721c24;"><strong>Your DriveMe account has been suspended.</strong></p>
                            </div>
                            
                            <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #dc3545; margin: 20px 0;">
                                <h4 style="color: #333; margin-top: 0;">Suspension Details:</h4>
                                <p><strong>Reason:</strong> ${reason}</p>
                                <p><strong>Duration:</strong> ${durationDays} days</p>
                                <p><strong>Suspension ends:</strong> ${formattedEndDate}</p>
                            </div>
                            
                            <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border: 1px solid #ffeaa7;">
                                <p style="margin: 0; color: #856404;"><strong>What can you do?</strong></p>
                                <ul style="color: #856404; margin: 10px 0 0 0; padding-left: 20px;">
                                    <li>Review our Terms and Conditions</li>
                                    <li>Reflect on the reason for suspension</li>
                                    <li>If you believe this is an error, contact our admin</li>
                                </ul>
                            </div>
                            
                            <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
                                <p style="margin: 0 0 10px 0; color: #1565c0;"><strong>Need to appeal this decision?</strong></p>
                                <p style="margin: 0; color: #1565c0;">Contact our admin team at:</p>
                                <p style="margin: 10px 0 0 0;">
                                    <a href="mailto:admin@driveme.com" style="background: #1565c0; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
                                        Email Admin Team
                                    </a>
                                </p>
                            </div>
                            
                            <div style="text-align: center; margin-top: 30px; color: #666; font-size: 14px;">
                                <p>DriveMe - Your Trusted Transportation Partner</p>
                            </div>
                        </div>
                    </div>
                </body>
                </html>
            `,
        };

        await transporter.sendMail(mailOptions);
        console.log(`[v0] Suspension email sent to: ${email}`);
        return { success: true };
    } catch (error) {
        console.error('[v0] Error sending suspension email:', error);
        return { success: false, error: error.message };
    }
};

// Send Activation Email
export const sendActivationEmail = async ({ email, fullName, message, previousReason, isNewActivation }) => {
    try {
        const transporter = createTransporter();

        // Different content based on new activation vs reactivation
        const emailTitle = isNewActivation ? "Welcome to DriveMeGo!" : "Welcome Back!";
        const emailSubtitle = isNewActivation ? "Your account has been activated" : "Your account has been reactivated";
        const emailSubject = isNewActivation
            ? "Account Activated - Welcome to DriveMeGo!"
            : "Account Reactivated - Welcome Back to DriveMeGo!";
        const mainMessage = isNewActivation
            ? "Great news! Your DriveMeGo account has been activated. You can now log in and start using our services."
            : "Great news! Your DriveMeGo account has been reactivated.";

        const mailOptions = {
            from: process.env.EMAIL_FROM || '"DriveMeGo" <noreply@drivemego.com>',
            to: email,
            subject: emailSubject,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>${isNewActivation ? 'Account Activated' : 'Account Reactivated'}</title>
                </head>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0;">
                    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                        <div style="background: linear-gradient(135deg, #28a745 0%, #218838 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                            <h1 style="color: white; margin: 0; font-size: 28px;">${emailTitle}</h1>
                            <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">${emailSubtitle}</p>
                        </div>
                        
                        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
                            <h3 style="color: #333; margin-top: 0;">Hello ${fullName},</h3>
                            
                            <div style="background: #d4edda; border: 1px solid #28a745; padding: 20px; border-radius: 8px; margin: 20px 0;">
                                <p style="margin: 0; color: #155724;"><strong>${mainMessage}</strong></p>
                            </div>
                            
                            ${message ? `
                            <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #28a745; margin: 20px 0;">
                                <h4 style="color: #333; margin-top: 0;">Message from Admin:</h4>
                                <p style="color: #666;">${message}</p>
                            </div>
                            ` : ''}
                            
                            ${!isNewActivation ? `
                            <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border: 1px solid #ffeaa7;">
                                <p style="margin: 0; color: #856404;"><strong>Important Reminder:</strong></p>
                                <p style="margin: 10px 0 0 0; color: #856404;">
                                    Please ensure you follow our platform guidelines and Terms of Service to avoid future account suspensions.
                                    ${previousReason ? `<br><br>Previous suspension reason: <em>${previousReason}</em>` : ''}
                                </p>
                            </div>
                            ` : ''}
                            
                            <div style="text-align: center; margin: 30px 0;">
                                <a href="${process.env.FRONTEND_URL?.split(",")[0] || 'https://drivemego.com'}/login" 
                                   style="background: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                                    Login to Your Account
                                </a>
                            </div>
                            
                            <div style="text-align: center; margin-top: 30px; color: #666; font-size: 14px;">
                                <p>Thank you for being part of DriveMeGo!</p>
                                <p>DriveMeGo - Your Trusted Transportation Partner</p>
                            </div>
                        </div>
                    </div>
                </body>
                </html>
            `,
        };

        await transporter.sendMail(mailOptions);
        console.log(`[v0] Activation email sent to: ${email}`);
        return { success: true };
    } catch (error) {
        console.error('[v0] Error sending activation email:', error);
        return { success: false, error: error.message };
    }
};

// Send User Appeal Email to Admin
export const sendUserAppealEmail = async ({ userEmail, userName, userMessage, adminEmail }) => {
    try {
        const transporter = createTransporter();

        const mailOptions = {
            from: process.env.EMAIL_FROM || '"DriveMe" <noreply@driveme.com>',
            to: adminEmail,
            replyTo: userEmail,
            subject: `Account Reactivation Request from ${userName}`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Reactivation Request</title>
                </head>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0;">
                    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                            <h1 style="color: white; margin: 0; font-size: 28px;">Account Reactivation Request</h1>
                        </div>
                        
                        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
                            <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                                <p style="margin: 0; color: #1565c0;"><strong>Request from:</strong> ${userName}</p>
                                <p style="margin: 5px 0 0 0; color: #1565c0;"><strong>Email:</strong> ${userEmail}</p>
                            </div>
                            
                            <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #667eea; margin: 20px 0;">
                                <h4 style="color: #333; margin-top: 0;">User's Message:</h4>
                                <p style="color: #666; white-space: pre-wrap;">${userMessage}</p>
                            </div>
                            
                            <div style="text-align: center; margin: 30px 0;">
                                <a href="${process.env.FRONTEND_URL?.split(",")[0] || 'https://driveme.com'}/admin-login" 
                                   style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                                    Review User in Admin Panel
                                </a>
                            </div>
                            
                            <p style="color: #666; font-size: 14px; text-align: center;">
                                You can reply directly to this email to respond to the user.
                            </p>
                        </div>
                    </div>
                </body>
                </html>
            `,
        };

        await transporter.sendMail(mailOptions);
        console.log(`[v0] User appeal email sent to admin: ${adminEmail}`);
        return { success: true };
    } catch (error) {
        console.error('[v0] Error sending user appeal email:', error);
        return { success: false, error: error.message };
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
