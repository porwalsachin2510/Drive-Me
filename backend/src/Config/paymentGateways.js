// Payment Gateway Configuration for UAE and Kuwait
export const PAYMENT_GATEWAYS = {
  UAE: {
    STRIPE: {
      enabled: true,
      publishableKey: process.env.STRIPE_UAE_PUBLISHABLE_KEY,
      secretKey: process.env.STRIPE_UAE_SECRET_KEY,
      webhookSecret: process.env.STRIPE_UAE_WEBHOOK_SECRET,
      supportedMethods: ['card', 'apple_pay', 'google_pay'],
      currency: 'AED',
      country: 'AE',
    },
    TAP: {
      enabled: true,
      secretKey: process.env.TAP_UAE_SECRET_KEY,
      publishableKey: process.env.TAP_UAE_PUBLISHABLE_KEY,
      supportedMethods: ['card', 'knet', 'apple_pay', 'google_pay'],
      currency: 'AED',
      country: 'AE',
    },
  },
  KUWAIT: {
    TAP: {
      enabled: true,
      secretKey: process.env.TAP_KUWAIT_SECRET_KEY,
      publishableKey: process.env.TAP_KUWAIT_PUBLISHABLE_KEY,
      supportedMethods: ['card', 'knet', 'apple_pay', 'google_pay'],
      currency: 'KWD',
      country: 'KW',
    },
    KNET: {
      enabled: true,
      merchantId: process.env.KNET_MERCHANT_ID,
      terminalId: process.env.KNET_TERMINAL_ID,
      secretKey: process.env.KNET_SECRET_KEY,
      currency: 'KWD',
      country: 'KW',
    },
  },
};

// UPI Configuration for UAE and Kuwait
export const UPI_CONFIG = {
  UAE: {
    enabled: true,
    supportedApps: ['phonepe', 'googlepay', 'paytm', 'bhim'],
    merchantVPA: process.env.UAE_MERCHANT_VPA,
    upiGateway: 'razorpay',
  },
  KUWAIT: {
    enabled: true,
    supportedApps: ['knet', 'benefit', 'zaincash', 'stcpay'],
    merchantVPA: process.env.KUWAIT_MERCHANT_VPA,
    upiGateway: 'tap',
  },
};

// Local payment methods
export const LOCAL_PAYMENT_METHODS = {
  UAE: [
    {
      id: 'card',
      name: 'Credit/Debit Card',
      icon: '💳',
      gateway: 'STRIPE',
      enabled: true,
    },
    {
      id: 'apple_pay',
      name: 'Apple Pay',
      icon: '🍎',
      gateway: 'STRIPE',
      enabled: true,
    },
    {
      id: 'google_pay',
      name: 'Google Pay',
      icon: '🤖',
      gateway: 'STRIPE',
      enabled: true,
    },
    {
      id: 'knet',
      name: 'KNET',
      icon: '🔵',
      gateway: 'TAP',
      enabled: true,
    },
    {
      id: 'upi',
      name: 'UPI',
      icon: '📱',
      gateway: 'UPI',
      enabled: true,
    },
    {
      id: 'wallet',
      name: 'Wallet Balance',
      icon: '💰',
      gateway: 'WALLET',
      enabled: true,
    },
  ],
  KUWAIT: [
    {
      id: 'card',
      name: 'Credit/Debit Card',
      icon: '💳',
      gateway: 'TAP',
      enabled: true,
    },
    {
      id: 'knet',
      name: 'KNET',
      icon: '🔵',
      gateway: 'TAP',
      enabled: true,
    },
    {
      id: 'benefit',
      name: 'Benefit',
      icon: '🟣',
      gateway: 'TAP',
      enabled: true,
    },
    {
      id: 'zaincash',
      name: 'Zain Cash',
      icon: '🟢',
      gateway: 'TAP',
      enabled: true,
    },
    {
      id: 'stcpay',
      name: 'STC Pay',
      icon: '🔴',
      gateway: 'TAP',
      enabled: true,
    },
    {
      id: 'upi',
      name: 'UPI',
      icon: '📱',
      gateway: 'UPI',
      enabled: true,
    },
    {
      id: 'wallet',
      name: 'Wallet Balance',
      icon: '💰',
      gateway: 'WALLET',
      enabled: true,
    },
  ],
};

// Get payment gateway by country and method
export const getPaymentGateway = (country, paymentMethod) => {
  const countryConfig = PAYMENT_GATEWAYS[country];
  if (!countryConfig) {
    throw new Error(`Payment gateway not configured for country: ${country}`);
  }

  // Find the gateway that supports the payment method
  for (const [gatewayName, gatewayConfig] of Object.entries(countryConfig)) {
    if (gatewayConfig.enabled && gatewayConfig.supportedMethods.includes(paymentMethod)) {
      return {
        name: gatewayName,
        ...gatewayConfig,
      };
    }
  }

  throw new Error(`Payment method ${paymentMethod} not supported in ${country}`);
};

// Get available payment methods for a country
export const getAvailablePaymentMethods = (country) => {
  return LOCAL_PAYMENT_METHODS[country] || [];
};

// Detect country from currency
export const detectCountryFromCurrency = (currency) => {
  switch (currency.toUpperCase()) {
    case 'AED':
      return 'UAE';
    case 'KWD':
      return 'KUWAIT';
    default:
      return 'UAE'; // Default to UAE
  }
};

// Calculate commission based on payment method and country
export const calculateCommission = (amount, paymentMethod, country) => {
  let commissionRate = 0.05; // Default 5%

  // Different commission rates for different payment methods
  const commissionRates = {
    UAE: {
      card: 0.025,      // 2.5%
      apple_pay: 0.025, // 2.5%
      google_pay: 0.025, // 2.5%
      knet: 0.015,      // 1.5%
      upi: 0.01,        // 1%
      wallet: 0,        // 0%
    },
    KUWAIT: {
      card: 0.03,       // 3%
      knet: 0.02,       // 2%
      benefit: 0.02,    // 2%
      zaincash: 0.025,  // 2.5%
      stcpay: 0.025,    // 2.5%
      upi: 0.015,       // 1.5%
      wallet: 0,        // 0%
    },
  };

  const countryRates = commissionRates[country];
  if (countryRates && countryRates[paymentMethod]) {
    commissionRate = countryRates[paymentMethod];
  }

  return {
    commissionAmount: amount * commissionRate,
    commissionRate,
    netAmount: amount * (1 - commissionRate),
  };
};

export default {
  PAYMENT_GATEWAYS,
  UPI_CONFIG,
  LOCAL_PAYMENT_METHODS,
  getPaymentGateway,
  getAvailablePaymentMethods,
  detectCountryFromCurrency,
  calculateCommission,
};
