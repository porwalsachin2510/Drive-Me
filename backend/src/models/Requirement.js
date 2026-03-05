import mongoose from "mongoose";

const requirementSchema = new mongoose.Schema(
    {
        // Corporate who created the requirement
        corporateId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        
        // Requirement details
        title: {
            type: String,
            required: true,
            trim: true,
        },
        
        description: {
            type: String,
            required: true,
        },
        
        // Vehicle requirements
        vehicleRequirements: [{
            vehicleType: {
                type: String,
                required: true,
                enum: ["BUS", "VAN", "MINIBUS", "SEDAN", "SUV", "TRUCK"],
            },
            capacity: {
                type: Number,
                required: true,
                min: 1,
            },
            quantity: {
                type: Number,
                required: true,
                min: 1,
            },
            features: [{
                type: String,
                enum: ["AC", "NON_AC", "GPS", "CAMERA", "USB_CHARGING", "WIFI", "ENTERTAINMENT", "DISABLED_ACCESS"],
            }],
            preferredBrands: [String],
            ageLimit: {
                type: Number, // Maximum vehicle age in years
                default: 5,
            },
        }],
        
        // Route information
        routeInfo: {
            fromLocation: {
                type: String,
                required: true,
            },
            toLocation: {
                type: String,
                required: true,
            },
            stops: [{
                location: String,
                coordinates: {
                    latitude: Number,
                    longitude: Number,
                },
            }],
            estimatedDistance: {
                type: Number, // in km
                required: true,
            },
            estimatedDuration: {
                type: String, // e.g., "2 hours 30 minutes"
                required: true,
            },
        },
        
        // Schedule requirements
        scheduleRequirements: {
            serviceType: {
                type: String,
                required: true,
                enum: ["DAILY", "WEEKLY", "MONTHLY", "CUSTOM"],
            },
            operatingDays: [{
                type: String,
                enum: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
            }],
            startTime: {
                type: String,
                required: true, // e.g., "08:00"
            },
            endTime: {
                type: String,
                required: true, // e.g., "18:00"
            },
            frequency: {
                type: String,
                enum: ["SINGLE_TRIP", "ROUND_TRIP", "MULTIPLE_TRIPS"],
                default: "ROUND_TRIP",
            },
        },
        
        // Contract details
        contractDetails: {
            duration: {
                type: Number, // in months
                required: true,
                min: 1,
            },
            startDate: {
                type: Date,
                required: true,
            },
            endDate: {
                type: Date,
                required: true,
            },
            budgetRange: {
                min: {
                    type: Number,
                    required: true,
                },
                max: {
                    type: Number,
                    required: true,
                },
                currency: {
                    type: String,
                    default: "KWD",
                },
            },
            paymentTerms: {
                type: String,
                enum: ["MONTHLY", "QUARTERLY", "ANNUALLY"],
                default: "MONTHLY",
            },
        },
        
        // Driver requirements
        driverRequirements: {
            required: {
                type: Boolean,
                default: true,
            },
            licenseType: {
                type: String,
                enum: ["LIGHT", "MEDIUM", "HEAVY", "COMMERCIAL"],
            },
            experience: {
                type: Number, // minimum years of experience
                default: 2,
            },
            languages: [String],
            backgroundCheck: {
                type: Boolean,
                default: true,
            },
        },
        
        // Fuel requirements
        fuelRequirements: {
            included: {
                type: Boolean,
                default: true,
            },
            type: {
                type: String,
                enum: ["PETROL", "DIESEL", "HYBRID", "ELECTRIC", "ANY"],
                default: "ANY",
            },
        },
        
        // Additional requirements
        additionalRequirements: {
            insurance: {
                type: Boolean,
                default: true,
            },
            maintenance: {
                type: Boolean,
                default: true,
            },
            tracking: {
                type: Boolean,
                default: true,
            },
            emergencySupport: {
                type: Boolean,
                default: true,
            },
            specialInstructions: String,
        },
        
        // Status and workflow
        status: {
            type: String,
            enum: ["DRAFT", "PUBLISHED", "CLOSED", "CANCELLED"],
            default: "DRAFT",
        },
        
        // Quotations received
        quotations: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "Quotation",
        }],
        
        // Selected quotation (if any)
        selectedQuotation: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Quotation",
            default: null,
        },
        
        // Visibility settings
        visibility: {
            type: String,
            enum: ["PUBLIC", "PRIVATE", "INVITE_ONLY"],
            default: "PUBLIC",
        },
        
        // Invited partners (for private requirements)
        invitedPartners: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        }],
        
        // Deadline for quotations
        quotationDeadline: {
            type: Date,
            required: true,
        },
        
        // Metadata
        tags: [String],
        priority: {
            type: String,
            enum: ["LOW", "MEDIUM", "HIGH", "URGENT"],
            default: "MEDIUM",
        },
        
        // Soft delete
        isDeleted: {
            type: Boolean,
            default: false,
        },
        
        // Created and updated timestamps
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        lastModifiedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
    },
    {
        timestamps: true,
    }
);

// Indexes for better performance
requirementSchema.index({ corporateId: 1, status: 1 });
requirementSchema.index({ status: 1, visibility: 1 });
requirementSchema.index({ "routeInfo.fromLocation": 1, "routeInfo.toLocation": 1 });
requirementSchema.index({ quotationDeadline: 1 });
requirementSchema.index({ createdAt: -1 });

// Virtual for checking if requirement is still open for quotations
requirementSchema.virtual('isOpenForQuotations').get(function() {
    return this.status === 'PUBLISHED' && new Date() <= this.quotationDeadline;
});

// Virtual for days until deadline
requirementSchema.virtual('daysUntilDeadline').get(function() {
    const now = new Date();
    const deadline = new Date(this.quotationDeadline);
    const diffTime = deadline - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
});

// Pre-save middleware to validate dates
requirementSchema.pre('save', function(next) {
    if (this.contractDetails.startDate >= this.contractDetails.endDate) {
        return next(new Error('End date must be after start date'));
    }
    
    if (this.quotationDeadline <= new Date()) {
        return next(new Error('Quotation deadline must be in the future'));
    }
    
    next();
});

// Static methods
requirementSchema.statics.findOpenRequirements = function(filters = {}) {
    return this.find({
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
        quotationDeadline: { $gt: new Date() },
        isDeleted: false,
        ...filters
    }).populate('corporateId', 'companyName');
};

requirementSchema.statics.findCorporateRequirements = function(corporateId, filters = {}) {
    return this.find({
        corporateId,
        isDeleted: false,
        ...filters
    }).populate('quotations').populate('selectedQuotation');
};

// Instance methods
requirementSchema.methods.addQuotation = function(quotationId) {
    if (!this.quotations.includes(quotationId)) {
        this.quotations.push(quotationId);
    }
    return this.save();
};

requirementSchema.methods.selectQuotation = function(quotationId) {
    this.selectedQuotation = quotationId;
    this.status = 'CLOSED';
    return this.save();
};

requirementSchema.methods.publish = function() {
    this.status = 'PUBLISHED';
    return this.save();
};

requirementSchema.methods.close = function() {
    this.status = 'CLOSED';
    return this.save();
};

const Requirement = mongoose.model("Requirement", requirementSchema);

export default Requirement;
