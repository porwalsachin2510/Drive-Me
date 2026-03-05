import Stripe from "stripe"

// Initialize Stripe with UAE account
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2023-10-16",
})

export default stripe
