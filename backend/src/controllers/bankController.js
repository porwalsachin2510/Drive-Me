import bankValidationService from "../Services/bankValidationService.js";
import User from "../models/User.js";

// Get supported banks for a country
export const getSupportedBanks = async (req, res) => {
    try {
        const { country } = req.query;
        
        if (!country) {
            return res.status(400).json({
                success: false,
                message: "Country parameter is required"
            });
        }

        const supportedBanks = bankValidationService.getSupportedBanks(country);
        
        if (supportedBanks.error) {
            return res.status(400).json({
                success: false,
                message: supportedBanks.error
            });
        }

        res.json({
            success: true,
            data: supportedBanks
        });
    } catch (error) {
        console.error("Error getting supported banks:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get supported banks"
        });
    }
};

// Validate IBAN
export const validateIBAN = async (req, res) => {
    try {
        const { iban, country } = req.body;
        
        if (!iban || !country) {
            return res.status(400).json({
                success: false,
                message: "IBAN and country are required"
            });
        }

        const validation = bankValidationService.validateIBAN(iban, country);
        
        res.json({
            success: true,
            data: {
                valid: validation.valid,
                error: validation.error,
                formatted: validation.valid ? bankValidationService.formatIBAN(iban) : null
            }
        });
    } catch (error) {
        console.error("Error validating IBAN:", error);
        res.status(500).json({
            success: false,
            message: "Failed to validate IBAN"
        });
    }
};

// Validate bank account
export const validateBankAccount = async (req, res) => {
    try {
        const { accountNumber, bankCode, country } = req.body;
        
        if (!accountNumber || !bankCode || !country) {
            return res.status(400).json({
                success: false,
                message: "Account number, bank code, and country are required"
            });
        }

        const validation = bankValidationService.validateBankAccount(accountNumber, bankCode, country);
        
        res.json({
            success: true,
            data: validation
        });
    } catch (error) {
        console.error("Error validating bank account:", error);
        res.status(500).json({
            success: false,
            message: "Failed to validate bank account"
        });
    }
};

// Get withdrawal limits
export const getWithdrawalLimits = async (req, res) => {
    try {
        const { currency, userLevel = "STANDARD" } = req.query;
        
        if (!currency) {
            return res.status(400).json({
                success: false,
                message: "Currency parameter is required"
            });
        }

        const userId = req.userId;
        const user = await User.findById(userId);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const limits = bankValidationService.checkWithdrawalLimits(0, currency, user.level || userLevel);
        
        res.json({
            success: true,
            data: {
                limits: limits.limits,
                userLevel: user.level || userLevel,
                currency
            }
        });
    } catch (error) {
        console.error("Error getting withdrawal limits:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get withdrawal limits"
        });
    }
};

// Get processing times
export const getProcessingTimes = async (req, res) => {
    try {
        const { country } = req.query;
        
        if (!country) {
            return res.status(400).json({
                success: false,
                message: "Country parameter is required"
            });
        }

        const processingTimes = bankValidationService.getBankProcessingTimes(country);
        
        res.json({
            success: true,
            data: {
                country,
                processingTimes
            }
        });
    } catch (error) {
        console.error("Error getting processing times:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get processing times"
        });
    }
};
