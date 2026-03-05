import crypto from 'crypto';
import { UPI_CONFIG } from '../config/paymentGateways.js';

class UPIService {
  constructor() {
    this.config = UPI_CONFIG;
  }

  // Generate UPI payment request
  generateUPIPaymentRequest(paymentData) {
    const {
      amount,
      currency,
      orderId,
      description,
      customerEmail,
      customerPhone,
      country
    } = paymentData;

    const countryConfig = this.config[country];
    if (!countryConfig || !countryConfig.enabled) {
      throw new Error(`UPI not available in ${country}`);
    }

    // Generate transaction ID
    const transactionId = `UPI_${Date.now()}_${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    
    // Create payment request
    const paymentRequest = {
      merchantVPA: countryConfig.merchantVPA,
      transactionId,
      amount: amount.toFixed(2),
      currency,
      description,
      orderId,
      customerEmail,
      customerPhone,
      timestamp: new Date().toISOString(),
      gateway: countryConfig.upiGateway,
    };

    // Generate signature
    const signature = this.generateSignature(paymentRequest);
    paymentRequest.signature = signature;

    return {
      paymentRequest,
      upiUrl: this.generateUPIUrl(paymentRequest),
      qrCode: this.generateQRCode(paymentRequest),
    };
  }

  // Generate UPI URL for payment
  generateUPIUrl(paymentRequest) {
    const {
      merchantVPA,
      amount,
      description,
      transactionId,
    } = paymentRequest;

    const params = new URLSearchParams({
      pa: merchantVPA,
      pn: 'DriveMe Transport',
      am: amount,
      cu: 'INR',
      tn: description,
      tr: transactionId,
    });

    return `upi://pay?${params.toString()}`;
  }

  // Generate QR code for UPI payment
  generateQRCode(paymentRequest) {
    // In production, use a QR code library like qrcode
    const upiUrl = this.generateUPIUrl(paymentRequest);
    return {
      data: upiUrl,
      size: 256,
      format: 'png',
    };
  }

  // Generate signature for payment request
  generateSignature(paymentRequest) {
    const { merchantVPA, amount, transactionId, timestamp } = paymentRequest;
    const signatureString = `${merchantVPA}|${amount}|${transactionId}|${timestamp}`;
    
    return crypto
      .createHash('sha256')
      .update(signatureString)
      .digest('hex');
  }

  // Verify UPI payment
  async verifyUPIPayment(transactionId, country) {
    try {
      const countryConfig = this.config[country];
      if (!countryConfig) {
        throw new Error(`UPI not configured for ${country}`);
      }

      // In production, integrate with actual UPI gateway
      // For now, simulate verification
      const mockVerification = {
        success: true,
        transactionId,
        status: 'COMPLETED',
        amount: 100,
        currency: country === 'UAE' ? 'AED' : 'KWD',
        verifiedAt: new Date().toISOString(),
        gatewayTransactionId: `UPI_GATEWAY_${transactionId}`,
      };

      return mockVerification;
    } catch (error) {
      console.error('UPI verification error:', error);
      throw error;
    }
  }

  // Process UPI refund
  async processUPIRefund(originalTransactionId, refundAmount, reason, country) {
    try {
      const refundTransactionId = `REFUND_${Date.now()}_${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
      
      const refundData = {
        originalTransactionId,
        refundTransactionId,
        refundAmount,
        reason,
        country,
        timestamp: new Date().toISOString(),
      };

      // In production, integrate with actual UPI gateway
      const mockRefund = {
        success: true,
        refundTransactionId,
        status: 'PROCESSING',
        refundAmount,
        reason,
        processedAt: new Date().toISOString(),
      };

      return mockRefund;
    } catch (error) {
      console.error('UPI refund error:', error);
      throw error;
    }
  }

  // Get supported UPI apps for country
  getSupportedUPIApps(country) {
    const countryConfig = this.config[country];
    if (!countryConfig) {
      return [];
    }

    return countryConfig.supportedApps.map(app => ({
      id: app,
      name: this.getAppName(app),
      icon: this.getAppIcon(app),
      deepLink: this.getAppDeepLink(app),
    }));
  }

  // Get app display name
  getAppName(appId) {
    const appNames = {
      phonepe: 'PhonePe',
      googlepay: 'Google Pay',
      paytm: 'Paytm',
      bhim: 'BHIM',
      knet: 'KNET',
      benefit: 'Benefit',
      zaincash: 'Zain Cash',
      stcpay: 'STC Pay',
    };
    return appNames[appId] || appId;
  }

  // Get app icon
  getAppIcon(appId) {
    const appIcons = {
      phonepe: '📱',
      googlepay: '🤖',
      paytm: '💰',
      bhim: '🏦',
      knet: '🔵',
      benefit: '🟣',
      zaincash: '🟢',
      stcpay: '🔴',
    };
    return appIcons[appId] || '📱';
  }

  // Get app deep link
  getAppDeepLink(appId) {
    const deepLinks = {
      phonepe: 'phonepe://',
      googlepay: 'gpay://',
      paytm: 'paytm://',
      bhim: 'bhim://',
      knet: 'knet://',
      benefit: 'benefit://',
      zaincash: 'zaincash://',
      stcpay: 'stcpay://',
    };
    return deepLinks[appId] || '#';
  }

  // Check if UPI is available for country
  isUPIAvailable(country) {
    const countryConfig = this.config[country];
    return countryConfig && countryConfig.enabled;
  }
}

export default new UPIService();
