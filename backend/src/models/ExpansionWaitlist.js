import mongoose from "mongoose";

/**
 * ExpansionWaitlist
 * --------------------------------------------------------------
 * Captures interest from users located in countries where Drive Me Go
 * is not yet available (e.g. India). When the service launches in their
 * country, the team can reach out to everyone on this list.
 */
const expansionWaitlistSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
        },
        fullName: {
            type: String,
            trim: true,
            default: null,
        },
        // The country the user is currently in (the unsupported country).
        country: {
            type: String,
            required: true,
            trim: true,
        },
        city: {
            type: String,
            trim: true,
            default: null,
        },
        // Optional commute corridor the user is interested in.
        pickupLocation: {
            type: String,
            trim: true,
            default: null,
        },
        dropoffLocation: {
            type: String,
            trim: true,
            default: null,
        },
        // Where the signup came from, for analytics.
        source: {
            type: String,
            default: "home_page",
        },
        notified: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true }
);

// A given email can only join the waitlist once per country.
expansionWaitlistSchema.index({ email: 1, country: 1 }, { unique: true });
expansionWaitlistSchema.index({ country: 1, createdAt: -1 });

export default mongoose.model("ExpansionWaitlist", expansionWaitlistSchema);
