import axios from 'axios';

// Bank validation service for different countries
class BankValidationService {
    constructor() {
        this.countryConfigs = {
            UAE: {
                ibanLength: 23,
                ibanPrefix: "AE",
                format: "AE[0-9]{2}[0-9]{3}[0-9]{16}",
                bankCodes: {
                    "NBD": "National Bank of Abu Dhabi",
                    "ADCB": "Abu Dhabi Commercial Bank",
                    "FAB": "First Abu Dhabi Bank",
                    "EmiratesNBD": "Emirates NBD",
                    "DubaiIslamic": "Dubai Islamic Bank",
                    "ADIB": "Abu Dhabi Islamic Bank",
                    "Mashreq": "Mashreq Bank",
                    "RAKBANK": "RAKBANK"
                }
            },
            KW: {
                ibanLength: 30,
                ibanPrefix: "KW",
                format: "KW[0-9]{2}[A-Z]{4}[0-9]{22}",
                bankCodes: {
                    "NBK": "National Bank of Kuwait",
                    "KFH": "Kuwait Finance House",
                    "GULF": "Gulf Bank",
                    "BOUK": "Bank of Kuwait",
                    "AhliUnited": "Ahli United Bank",
                    "Burgan": "Burgan Bank",
                    "KuwaitInternational": "Kuwait International Bank",
                    "AlAhli": "Al Ahli Bank of Kuwait"
                }
            },
            SA: {
                ibanLength: 24,
                ibanPrefix: "SA",
                format: "SA[0-9]{2}[0-9]{18}",
                bankCodes: {
                    "SABB": "Saudi British Bank",
                    "Riyad": "Riyad Bank",
                    "Alinma": "Alinma Bank",
                    "AlRajhi": "Al Rajhi Bank",
                    "SNB": "Saudi National Bank",
                    "Samba": "Samba Financial Group",
                    "BankAlJazira": "Bank Al Jazira",
                    "AlBilad": "Bank Al Bilad"
                }
            }
        };
    }

    // Validate IBAN format
    validateIBAN(iban, country) {
        try {
            const config = this.countryConfigs[country];
            if (!config) {
                return { valid: false, error: "Country not supported" };
            }

            // Remove spaces and convert to uppercase
            const cleanIBAN = iban.replace(/\s/g, '').toUpperCase();

            // Check length
            if (cleanIBAN.length !== config.ibanLength) {
                return { 
                    valid: false, 
                    error: `Invalid IBAN length. Expected ${config.ibanLength} characters for ${country}` 
                };
            }

            // Check prefix
            if (!cleanIBAN.startsWith(config.ibanPrefix)) {
                return { 
                    valid: false, 
                    error: `Invalid IBAN prefix. Expected ${config.ibanPrefix} for ${country}` 
                };
            }

            // Check format
            const regex = new RegExp(`^${config.format}$`);
            if (!regex.test(cleanIBAN)) {
                return { valid: false, error: "Invalid IBAN format" };
            }

            // IBAN checksum validation
            const rearranged = cleanIBAN.substring(4) + cleanIBAN.substring(0, 4);
            const numeric = this.convertToNumeric(rearranged);
            
            if (numeric % 97 !== 1) {
                return { valid: false, error: "Invalid IBAN checksum" };
            }

            return { valid: true };
        } catch (error) {
            return { valid: false, error: error.message };
        }
    }

    // Convert IBAN to numeric for checksum calculation
    convertToNumeric(iban) {
        let numeric = '';
        for (let i = 0; i < iban.length; i++) {
            const char = iban[i];
            if (/[A-Z]/.test(char)) {
                numeric += (char.charCodeAt(0) - 55).toString();
            } else {
                numeric += char;
            }
        }
        return numeric;
    }

    // Validate bank account number
    validateBankAccount(accountNumber, bankCode, country) {
        try {
            const config = this.countryConfigs[country];
            if (!config) {
                return { valid: false, error: "Country not supported" };
            }

            // Check if bank code exists
            if (!config.bankCodes[bankCode]) {
                return { 
                    valid: false, 
                    error: "Invalid bank code",
                    availableBanks: Object.keys(config.bankCodes)
                };
            }

            // Basic account number validation
            if (!accountNumber || accountNumber.length < 8) {
                return { valid: false, error: "Invalid account number" };
            }

            return { 
                valid: true, 
                bankName: config.bankCodes[bankCode],
                bankCode
            };
        } catch (error) {
            return { valid: false, error: error.message };
        }
    }

    // Get supported banks for a country
    getSupportedBanks(country) {
        const config = this.countryConfigs[country];
        if (!config) {
            return { error: "Country not supported" };
        }

        return {
            banks: config.bankCodes,
            ibanLength: config.ibanLength,
            ibanPrefix: config.ibanPrefix
        };
    }

    // Format IBAN for display
    formatIBAN(iban) {
        // Add spaces every 4 characters for better readability
        return iban.replace(/(.{4})(?!$)/g, '$1 ');
    }

    // Validate withdrawal details
    validateWithdrawalDetails(withdrawalData) {
        const { iban, bankCode, accountHolderName, amount, currency, country } = withdrawalData;

        const errors = [];

        // Validate IBAN
        const ibanValidation = this.validateIBAN(iban, country);
        if (!ibanValidation.valid) {
            errors.push(`IBAN: ${ibanValidation.error}`);
        }

        // Validate bank account
        const accountValidation = this.validateBankAccount(accountNumber, bankCode, country);
        if (!accountValidation.valid) {
            errors.push(`Bank Account: ${accountValidation.error}`);
        }

        // Validate account holder name
        if (!accountHolderName || accountHolderName.length < 3) {
            errors.push("Account holder name is required");
        }

        // Validate amount
        if (!amount || amount <= 0) {
            errors.push("Invalid withdrawal amount");
        }

        // Validate currency
        const supportedCurrencies = ["AED", "KWD", "SAR", "BHD", "OMR", "QAR"];
        if (!supportedCurrencies.includes(currency)) {
            errors.push("Unsupported currency");
        }

        return {
            valid: errors.length === 0,
            errors,
            bankName: accountValidation.bankName
        };
    }

    // Generate withdrawal reference
    generateWithdrawalReference(userId) {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8).toUpperCase();
        return `WD-${userId}-${timestamp}-${random}`;
    }

    // Get bank processing times
    getBankProcessingTimes(country) {
        const processingTimes = {
            UAE: {
                local: "Same day",
                international: "2-3 business days"
            },
            KW: {
                local: "Same day",
                international: "3-5 business days"
            },
            SA: {
                local: "Same day",
                international: "2-4 business days"
            }
        };

        return processingTimes[country] || {
            local: "1-2 business days",
            international: "3-5 business days"
        };
    }

    // Check withdrawal limits
    checkWithdrawalLimits(amount, currency, userLevel = "STANDARD") {
        const limits = {
            AED: {
                STANDARD: { min: 50, max: 50000, daily: 100000 },
                PREMIUM: { min: 50, max: 100000, daily: 500000 },
                VIP: { min: 50, max: 500000, daily: 2000000 }
            },
            KWD: {
                STANDARD: { min: 5, max: 5000, daily: 10000 },
                PREMIUM: { min: 5, max: 10000, daily: 50000 },
                VIP: { min: 5, max: 50000, daily: 200000 }
            },
            SAR: {
                STANDARD: { min: 50, max: 50000, daily: 100000 },
                PREMIUM: { min: 50, max: 100000, daily: 500000 },
                VIP: { min: 50, max: 500000, daily: 2000000 }
            }
        };

        const currencyLimits = limits[currency] || limits.AED;
        const userLimits = currencyLimits[userLevel] || currencyLimits.STANDARD;

        if (amount < userLimits.min) {
            return {
                valid: false,
                error: `Minimum withdrawal amount is ${userLimits.min} ${currency}`
            };
        }

        if (amount > userLimits.max) {
            return {
                valid: false,
                error: `Maximum withdrawal amount is ${userLimits.max} ${currency}`
            };
        }

        return {
            valid: true,
            limits: userLimits
        };
    }
}

export default new BankValidationService();
