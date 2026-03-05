import mongoose from "mongoose";

const corporateEmployeeSchema = new mongoose.Schema(
    {
        // Employee details
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        companyId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        employeeId: {
            type: String,
            required: true,
            unique: true, // Company-specific employee ID
        },
        personalInfo: {
            firstName: {
                type: String,
                required: true,
            },
            lastName: {
                type: String,
                required: true,
            },
            email: {
                type: String,
                required: true,
                lowercase: true,
            },
            phoneNumber: {
                type: String,
                required: true,
            },
            department: String,
            designation: String,
            workLocation: String,
        },
        // Residential address for route assignment
        residentialAddress: {
            street: String,
            area: String,
            city: String,
            state: String,
            postalCode: String,
            coordinates: {
                latitude: Number,
                longitude: Number,
            },
        },
        // Transportation details
        transportDetails: {
            assignedRoute: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Route",
            },
            seatNumber: Number,
            pickupPoint: String,
            dropOffPoint: String,
            shiftType: {
                type: String,
                enum: ["MORNING", "EVENING", "NIGHT", "FULL_DAY"],
                default: "FULL_DAY",
            },
            transportStatus: {
                type: String,
                enum: ["ACTIVE", "INACTIVE", "SUSPENDED", "TERMINATED"],
                default: "ACTIVE",
            },
        },
        // Subscription management
        subscriptionDetails: {
            currentSubscription: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Subscription",
            },
            subscriptionType: {
                type: String,
                enum: ["COMPANY_PAID", "INDIVIDUAL_PAID", "HYBRID"],
                default: "COMPANY_PAID",
            },
            startDate: Date,
            endDate: Date,
            autoRenewal: {
                type: Boolean,
                default: true,
            },
        },
        // Attendance tracking
        attendance: {
            monthlyAttendance: [{
                month: String, // "2024-01"
                totalWorkingDays: Number,
                daysPresent: Number,
                daysAbsent: Number,
                daysLate: Number,
                noShowDays: Number,
                utilizationRate: Number,
            }],
            dailyAttendance: [{
                date: Date,
                status: {
                    type: String,
                    enum: ["PRESENT", "ABSENT", "LATE", "NO_SHOW", "ON_LEAVE"],
                },
                pickupTime: Date,
                dropOffTime: Date,
                vehicleId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "B2CPartnerVehicle",
                },
                driverId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "B2CPartnerDriver",
                },
                tripId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "B2CPartnerTrip",
                },
                notes: String,
            }],
        },
        // Billing and cost allocation
        billing: {
            monthlyCost: {
                type: Number,
                default: 0,
            },
            costCenter: String,
            billableToCompany: {
                type: Boolean,
                default: true,
            },
            personalContribution: {
                type: Number,
                default: 0,
            },
        },
        // Notifications and preferences
        preferences: {
            notifications: {
                dailyReminder: {
                    type: Boolean,
                    default: true,
                },
                delayAlerts: {
                    type: Boolean,
                    default: true,
                },
                routeChanges: {
                    type: Boolean,
                    default: true,
                },
                paymentAlerts: {
                    type: Boolean,
                    default: true,
                },
            },
            reminderTime: {
                type: String,
                default: "30", // minutes before pickup
            },
        },
        // Access control
        accessControl: {
            isActive: {
                type: Boolean,
                default: true,
            },
            accessLevel: {
                type: String,
                enum: ["EMPLOYEE", "MANAGER", "ADMIN"],
                default: "EMPLOYEE",
            },
            permissions: [{
                type: String,
                enum: ["VIEW_SCHEDULE", "REQUEST_CHANGES", "REPORT_ISSUES", "MANAGE_TEAM"],
            }],
        },
        // Emergency contacts
        emergencyContacts: [{
            name: String,
            relationship: String,
            phoneNumber: String,
            isPrimary: {
                type: Boolean,
                default: false,
            },
        }],
        // Document verification
        documents: {
            employeeIdCard: String,
            addressProof: String,
            verificationStatus: {
                type: String,
                enum: ["PENDING", "VERIFIED", "REJECTED"],
                default: "PENDING",
            },
            verifiedAt: Date,
            verifiedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            },
        },
        // Feedback and ratings
        feedback: {
            totalRides: {
                type: Number,
                default: 0,
            },
            averageRating: {
                type: Number,
                default: 0,
                min: 0,
                max: 5,
            },
            feedbackHistory: [{
                tripId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "B2CPartnerTrip",
                },
                rating: {
                    type: Number,
                    min: 1,
                    max: 5,
                },
                comments: String,
                suggestions: String,
                driverRating: Number,
                vehicleRating: Number,
                punctualityRating: Number,
                route: String,
                tripDate: Date,
                startTime: String,
                vehicleName: String,
                vehicleNumber: String,
                driverName: String,
                seatNumber: String,
                submittedAt: {
                    type: Date,
                    default: Date.now,
                },
            }],
        },
        // Status tracking
        statusHistory: [{
            status: String,
            changedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            },
            changedAt: {
                type: Date,
                default: Date.now,
            },
            reason: String,
        }],
        createdAt: {
            type: Date,
            default: Date.now,
        },
        updatedAt: {
            type: Date,
            default: Date.now,
        },
    },
    { 
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);

// Indexes for search optimization
corporateEmployeeSchema.index({ companyId: 1, "transportDetails.transportStatus": 1 });
corporateEmployeeSchema.index({ userId: 1 });
corporateEmployeeSchema.index({ employeeId: 1, companyId: 1 });
corporateEmployeeSchema.index({ "transportDetails.assignedRoute": 1 });
corporateEmployeeSchema.index({ "attendance.dailyAttendance.date": 1 });

// Virtual for full name
corporateEmployeeSchema.virtual('fullName').get(function() {
    return `${this.personalInfo.firstName} ${this.personalInfo.lastName}`;
});

// Virtual for current month attendance
corporateEmployeeSchema.virtual('currentMonthAttendance').get(function() {
    const currentMonth = new Date().toISOString().slice(0, 7); // "2024-01"
    return this.attendance.monthlyAttendance.find(att => att.month === currentMonth);
});

// Pre-save middleware
corporateEmployeeSchema.pre('save', function(next) {
    // Update employee email in personal info if user email changes
    if (this.isModified('userId') && this.userId) {
        // This would typically be handled in a separate service
    }
    next();
});

const CorporateEmployee = mongoose.model("CorporateEmployee", corporateEmployeeSchema);

export default CorporateEmployee;
