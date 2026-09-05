import mongoose from "mongoose"

const contractSchema = new mongoose.Schema(
    {
        contractNumber: {
            type: String,
            unique: true,
        },
        quotationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Quotation",
            required: true,
        },
        corporateOwnerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        fleetOwnerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        // Service mode carried over from the quotation.
        // STANDARD = corporate runs operations itself.
        // MANAGED = B2B partner runs operations (routes, schedules, employees,
        // trips, invitations) on behalf of the corporate, who retains full
        // visibility and the ability to act too.
        serviceMode: {
            type: String,
            enum: ["STANDARD", "MANAGED"],
            default: "STANDARD",
        },

        // Activity log of operations performed on a MANAGED contract, so the
        // corporate can see everything the B2B partner did on their behalf.
        managedOperations: {
            activityLog: [
                {
                    action: String, // e.g. ROUTE_CREATED, SCHEDULE_CREATED, EMPLOYEE_ADDED, INVITATION_SENT, TRIPS_GENERATED, DRIVER_ASSIGNED, FUEL_ASSIGNED, ROUTE_ASSIGNED_TO_EMPLOYEE
                    description: String,
                    entityType: String, // ROUTE | SCHEDULE | EMPLOYEE | TRIP | VEHICLE | INVITATION
                    entityId: {
                        type: mongoose.Schema.Types.ObjectId,
                    },
                    performedBy: {
                        type: mongoose.Schema.Types.ObjectId,
                        ref: "User",
                    },
                    performedByName: String,
                    performedByRole: {
                        type: String,
                        // School segment mirrors the corporate/B2B segment. These
                        // roles ARE written by school flows, so the enum must
                        // accept them or every contract.save() on a school
                        // contract throws a validation error.
                        enum: ["B2B_PARTNER", "SCHOOL_PARTNER", "CORPORATE", "SCHOOL_CUSTOMER"],
                    },
                    meta: {
                        type: mongoose.Schema.Types.Mixed,
                    },
                    createdAt: {
                        type: Date,
                        default: Date.now,
                    },
                },
            ],
        },

        vehicles: [
            {
                vehicleId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Vehicle",
                    required: true,
                },
                quantity: {
                    type: Number,
                    required: true,
                    min: 1,
                },
                assignedVehicles: [
                    {
                        vehicleId: {
                            type: mongoose.Schema.Types.ObjectId,
                            ref: "Vehicle",
                        },
                        driverId: {
                            type: mongoose.Schema.Types.ObjectId,
                            refPath: "vehicles.assignedVehicles.driverModel",
                        },

                        driverModel: {
                            type: String,
                            enum: ["Driver", "CorporateDriver"],
                        },
                        fuelCardNumber: {
                            type: String,
                            default: null,
                        },
                        assignedDate: {
                            type: Date,
                            default: Date.now,
                        },
                        status: {
                            type: String,
                            enum: ["ACTIVE", "MAINTENANCE", "INACTIVE"],
                            default: "ACTIVE",
                        },
                        // Keep the original actor role for auditability. School
                        // partners must not be coerced into the B2B segment.
                        driverAssignedBy: {
                            type: String,
                            enum: ["B2B_PARTNER", "SCHOOL_PARTNER", "CORPORATE", "SCHOOL_CUSTOMER"],
                            default: "B2B_PARTNER",
                        },
                        fuelAssignedBy: {
                            type: String,
                            enum: ["B2B_PARTNER", "SCHOOL_PARTNER", "CORPORATE", "SCHOOL_CUSTOMER"],
                            default: "B2B_PARTNER",
                        },
                        fuelType: {
                            type: String,
                            enum: ["included", "notIncluded"],
                            default: "notIncluded",
                        },
                        route: {
                            type: String,
                            default: null,
                        },
                        // Changed from single ObjectId to array to support multiple routes per vehicle
                        routeDetails: [{
                            type: mongoose.Schema.Types.ObjectId,
                            ref: "Route",
                        }],
                        settings: {
                            mode: {
                                type: String,
                                enum: ["active", "maintenance"],
                                default: "active",
                            },
                        },
                    },
                ],
            },
        ],
        rentalPeriod: {
            startDate: {
                type: Date,
                required: true,
            },
            endDate: {
                type: Date,
                required: true,
            },
            durationType: {
                type: String,
                enum: ["DAILY", "WEEKLY", "MONTHLY", "LONG_TERM"],
                required: true,
            },
            duration: Number,
        },
        // financials: {
        //     currency: {
        //         type: String,
        //         enum: ["KWD", "AED", "SAR", "QAR", "BHD", "OMR", "USD", "EUR"],
        //         required: true,
        //     },

        //     totalAmount: {
        //         type: Number,
        //         required: true,
        //     },
        //     advancePayment: {
        //         amount: Number,
        //         paidAt: Date,
        //         transactionId: String,
        //     },
        //     remainingAmount: Number,
        //     finalPayment: {
        //         amount: Number,
        //         paidAt: Date,
        //         transactionId: String,
        //     },
        //     securityDeposit: {
        //         amount: Number,
        //         paidAt: Date,
        //         refundedAt: Date,
        //         refundTransactionId: String,
        //     },
        // },

        financials: {
            currency: {
                type: String,
                enum: ["KWD", "AED", "SAR", "QAR", "BHD", "OMR", "USD", "EUR"],
                required: true,
            },
            totalAmount: {
                type: Number,
                required: true,
            },
            // B2B partner management/service charge component of the total (MANAGED contracts).
            serviceCharge: {
                type: Number,
                default: 0,
            },
            advancePayment: {
                amount: Number,
                dueDate: Date,
                paidAt: Date,
                transactionId: String,
                status: {
                    type: String,
                    enum: ["PENDING", "PAID", "OVERDUE"],
                    default: "PENDING",
                },
            },
            remainingAmount: Number,
            finalPayment: {
                amount: Number,
                dueDate: Date,
                paidAt: Date,
                transactionId: String,
                status: {
                    type: String,
                    enum: ["PENDING", "PAID", "OVERDUE"],
                    default: "PENDING",
                },
            },
            securityDeposit: {
                amount: Number,
                dueDate: Date,
                paidAt: Date,
                refundedAt: Date,
                refundTransactionId: String,
                status: {
                    type: String,
                    enum: ["PENDING", "PAID", "REFUNDED", "OVERDUE", "WAIVED_FOR_EMI"],
                    default: "PENDING",
                },
            },
            installments: [
                {
                    installmentNumber: Number,
                    amount: Number,
                    dueDate: Date,
                    paidAt: Date,
                    transactionId: String,
                    status: {
                        type: String,
                        enum: ["PENDING", "PAID", "OVERDUE"],
                        default: "PENDING",
                    },
                },
            ],
            paymentStatus: {
                type: String,
                enum: ["NOT_STARTED", "PARTIAL", "COMPLETED", "OVERDUE"],
                default: "NOT_STARTED",
            },
            // Payment Mode: Standard (Advance+Final) or EMI
            paymentMode: {
                type: String,
                enum: ["STANDARD", "EMI"],
                default: "STANDARD",
            },
            // EMI Payment Reference (if EMI mode selected)
            emiPaymentId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "EMIPayment",
            },
            // EMI Plan Summary (quick access without joining EMIPayment)
            emiPlanSummary: {
                tenure: Number, // 3, 6, 9, 12, 18, 24 months
                monthlyEMI: Number,
                totalPaid: Number,
                totalRemaining: Number,
                nextDueDate: Date,
                installmentsPaid: Number,
                installmentsOverdue: Number,
            },
        },

        // ------------------------------------------------------------------
        // MANAGED-service SLA (Service Level Agreement) configuration.
        // Corporate defines the performance targets the B2B partner commits to.
        // Live performance (on-time %, vehicle availability %, complaint
        // resolution time) is computed from real operational data (Trips,
        // assigned vehicles, Complaints) and compared against these targets to
        // detect breaches and calculate penalties applied to monthly billing.
        // ------------------------------------------------------------------
        sla: {
            enabled: { type: Boolean, default: false },
            // Targets (percentages / hours)
            onTimeTargetPct: { type: Number, default: 95 },
            vehicleAvailabilityTargetPct: { type: Number, default: 98 },
            complaintResolutionHours: { type: Number, default: 24 },
            // Minutes after scheduled start after which a trip counts as "late".
            lateThresholdMinutes: { type: Number, default: 10 },
            // Penalty rules applied against the monthly operational bill on breach.
            penalty: {
                // % of the monthly operational bill charged per percentage point
                // that on-time / availability falls below its target.
                onTimePerPointPct: { type: Number, default: 1 },
                availabilityPerPointPct: { type: Number, default: 1 },
                // Flat amount (contract currency) per complaint resolved late / unresolved.
                perLateComplaint: { type: Number, default: 0 },
                // Cap on total penalty as % of the monthly operational bill.
                maxPenaltyPct: { type: Number, default: 25 },
            },
            updatedAt: Date,
        },

        // ------------------------------------------------------------------
        // MANAGED-service operation-based billing configuration.
        // Instead of a single fixed serviceCharge, managed billing is driven by
        // actual operations for the month (per-trip / per-seat / per-km) plus a
        // management fee. A monthly Invoice is generated from real trip data.
        // ------------------------------------------------------------------
        operationBilling: {
            enabled: { type: Boolean, default: false },
            model: {
                type: String,
                enum: ["PER_TRIP", "PER_SEAT", "PER_KM", "FIXED_MONTHLY"],
                default: "PER_TRIP",
            },
            ratePerTrip: { type: Number, default: 0 },
            // Per occupied seat, per trip.
            ratePerSeat: { type: Number, default: 0 },
            ratePerKm: { type: Number, default: 0 },
            fixedMonthlyAmount: { type: Number, default: 0 },
            // Management fee added on top of the operational cost.
            managementFeeType: {
                type: String,
                enum: ["FLAT", "PERCENT"],
                default: "PERCENT",
            },
            managementFeeValue: { type: Number, default: 0 },
            // Tax applied to the invoice subtotal.
            taxRatePct: { type: Number, default: 0 },
            // Day of month invoices are due (used to set invoice dueDate).
            billingDay: { type: Number, default: 7 },
            updatedAt: Date,
        },

        vehicleAccess: {
            isActive: {
                type: Boolean,
                default: false,
            },
            reason: String,
            blockedAt: Date,
            blockedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            },
        },

        // Admin Commission Tracking
        adminCommission: {
            // Commission from B2B Partner
            b2bPartner: {
                rate: {
                    type: Number,
                    min: 0,
                    max: 35,
                    default: 20,
                },
                amount: {
                    type: Number,
                    default: 0,
                },
                status: {
                    type: String,
                    enum: ["PENDING", "PAID", "WAIVED"],
                    default: "PENDING",
                },
                paidAt: Date,
                transactionId: String,
            },
            // Commission from Corporate (only if negotiation was used)
            corporate: {
                rate: {
                    type: Number,
                    min: 0,
                    max: 35,
                    default: 0,
                },
                amount: {
                    type: Number,
                    default: 0,
                },
                status: {
                    type: String,
                    enum: ["PENDING", "PAID", "WAIVED", "NOT_APPLICABLE"],
                    default: "NOT_APPLICABLE",
                },
                paidAt: Date,
                transactionId: String,
            },
            // Reference to negotiation if used
            negotiationId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "AdminNegotiation",
                default: null,
            },
            // Total commission
            totalCommission: {
                type: Number,
                default: 0,
            },
            // Payment tracking
            payments: [
                {
                    from: {
                        type: String,
                        // School segment mirrors the corporate/B2B segment.
                        enum: ["B2B_PARTNER", "SCHOOL_PARTNER", "CORPORATE", "SCHOOL_CUSTOMER"],
                    },
                    amount: Number,
                    paidAt: Date,
                    transactionId: String,
                },
            ],
        },

        // Negotiation Commission from Corporate (separate field for admin negotiation service)
        // This is the commission Corporate pays to Admin for negotiating with B2B Partner on their behalf
        negotiationCommission: {
            // Reference to the negotiation
            negotiationId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "AdminNegotiation",
                default: null,
            },
            // Commission amount (calculated as % of savings)
            adminCommission: {
                type: Number,
                default: 0,
            },
            // Commission rate (percentage of savings)
            adminCommissionRate: {
                type: Number,
                default: 25,
            },
            // Commission payment status
            commissionStatus: {
                type: String,
                enum: ["PENDING", "PAID", "WAIVED", "EMI_INCLUDED"],
                default: "PENDING",
            },
            // Amount saved via negotiation
            priceSavings: {
                type: Number,
                default: 0,
            },
            // Original price before negotiation
            originalPrice: {
                type: Number,
                default: 0,
            },
            // When commission was paid
            paidAt: Date,
            // Transaction reference
            transactionId: String,
        },

        contractDocument: {
            url: String,
            publicId: String,
            fileName: String,
            fileSize: Number,
            uploadedAt: Date,
            uploadedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            },
        },
        // Signed contract document uploaded by Corporate after signing
        signedContractDocument: {
            url: String,
            publicId: String,
            fileName: String,
            fileSize: Number,
            uploadedAt: Date,
            uploadedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            },
        },
        // B2B Partner verification of signed document
        signedDocumentVerification: {
            isVerified: {
                type: Boolean,
                default: false,
            },
            verifiedAt: Date,
            verifiedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            },
            verificationNotes: String,
            rejectionReason: String,
        },
        digitalSignatures: {
            corporateOwner: {
                signed: {
                    type: Boolean,
                    default: false,
                },
                signedAt: Date,
                signature: String,
                ipAddress: String,
            },
            fleetOwner: {
                signed: {
                    type: Boolean,
                    default: false,
                },
                signedAt: Date,
                signature: String,
                ipAddress: String,
            },
        },
        terms: {
            cancellationPolicy: String,
            lateFees: Number,
            insuranceCoverage: String,
            maintenanceResponsibility: String,
            fuelPolicy: String,
            driverRules: String,
            additionalTerms: String,
        },

        urgencyLevel: {
            type: String,
            enum: ["normal", "urgent", "very-urgent"],
        },
        preferredDeliveryDate: {
            type: Date,
        },

        // Due Date Extension Request for Final Payment
        dueDateExtensionRequest: {
            isRequested: {
                type: Boolean,
                default: false,
            },
            requestedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            },
            requestedDate: Date,
            newProposedDate: Date,
            reason: String,
            status: {
                type: String,
                enum: ["PENDING", "APPROVED", "REJECTED", "COUNTER_OFFERED"],
                default: "PENDING",
            },
            respondedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            },
            respondedDate: Date,
            responseNotes: String,
            counterOfferedDate: Date,
            history: [
                {
                    action: {
                        type: String,
                        enum: ["REQUESTED", "APPROVED", "REJECTED", "COUNTER_OFFERED"],
                    },
                    date: Date,
                    by: {
                        type: mongoose.Schema.Types.ObjectId,
                        ref: "User",
                    },
                    notes: String,
                    proposedDate: Date,
                },
            ],
        },

        status: {
            type: String,
            enum: [
                "DRAFT",
                "PENDING_CORPORATE_SIGNATURE",
                "PENDING_SIGNED_DOCUMENT_UPLOAD",
                "PENDING_B2B_VERIFICATION",
                "PENDING_FLEET_SIGNATURE",
                "PENDING_PAYMENT",
                "ACTIVE",
                "COMPLETED",
                "CANCELLED",
                "TERMINATED",
                "REJECTED",
                "APPROVED_PENDING_PAYMENT",
            ],
            default: "DRAFT",
        },
        statusHistory: [
            {
                status: String,
                changedAt: {
                    type: Date,
                    default: Date.now,
                },
                changedBy: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "User",
                },
                reason: String,
            },
        ],
        notes: [
            {
                message: String,
                createdBy: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "User",
                },
                createdAt: {
                    type: Date,
                    default: Date.now,
                },
            },
        ],
        createdAt: {
            type: Date,
            default: Date.now,
        },
        activatedAt: Date,
        completedAt: Date,
        cancelledAt: Date,
    },
    {
        timestamps: true,
    },
)

// Auto-generate contract number
contractSchema.pre("save", async function (next) {
    if (!this.contractNumber) {
        const count = await mongoose.model("Contract").countDocuments()
        this.contractNumber = `CNT${Date.now()}${String(count + 1).padStart(4, "0")}`
    }
    next()
})

const Contract = mongoose.model("Contract", contractSchema)

export default Contract
