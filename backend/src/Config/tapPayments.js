import axios from "axios"
import crypto from "crypto"

class TapPayments {
    constructor() {
        this.apiKey = process.env.TAP_SECRET_KEY
        this.baseURL = "https://api.tap.company/v2"
        this.publicKey = process.env.TAP_PUBLIC_KEY
    }

    async createCharge(data) {
        try {
            const response = await axios.post(
                `${this.baseURL}/charges`,
                {
                    amount: data.amount,
                    currency: data.currency,
                    customer: {
                        first_name: data.customer.firstName,
                        last_name: data.customer.lastName,
                        email: data.customer.email,
                        phone: {
                            country_code: data.customer.countryCode,
                            number: data.customer.phone,
                        },
                    },
                    source: {
                        id: "src_all", // Accept all payment methods
                    },
                    redirect: {
                        url: data.redirectUrl,
                    },
                    post: {
                        url: data.webhookUrl,
                    },
                    metadata: data.metadata,
                    description: data.description,
                },
                {
                    headers: {
                        Authorization: `Bearer ${this.apiKey}`,
                        "Content-Type": "application/json",
                    },
                },
            )
            return response.data
        } catch (error) {
            console.error("[v0] Tap Payments charge creation error:", error.response?.data || error.message)
            throw error
        }
    }

    async retrieveCharge(chargeId) {
        try {
            const response = await axios.get(`${this.baseURL}/charges/${chargeId}`, {
                headers: {
                    Authorization: `Bearer ${this.apiKey}`,
                },
            })
            return response.data
        } catch (error) {
            console.error("[v0] Tap Payments retrieve charge error:", error.response?.data || error.message)
            throw error
        }
    }

    async createTransfer(data) {
        try {
            const response = await axios.post(
                `${this.baseURL}/transfers`,
                {
                    amount: data.amount,
                    currency: data.currency,
                    destination: {
                        id: data.destinationId,
                        type: "bank_account",
                    },
                    metadata: data.metadata,
                    description: data.description,
                },
                {
                    headers: {
                        Authorization: `Bearer ${this.apiKey}`,
                        "Content-Type": "application/json",
                    },
                },
            )
            return response.data
        } catch (error) {
            console.error("[v0] Tap Payments transfer error:", error.response?.data || error.message)
            throw error
        }
    }

    verifyWebhook(payload, signature) {
        // Tap Payments webhook verification logic
        // They use HMAC SHA256
        const hash = crypto.createHmac("sha256", this.apiKey).update(JSON.stringify(payload)).digest("hex")
        return hash === signature
    }
}

export default new TapPayments()
