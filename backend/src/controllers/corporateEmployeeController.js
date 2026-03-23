import CorporateEmployee from "../models/CorporateEmployee.js";
import User from "../models/User.js";
import Contract from "../models/Contract.js";
import Route from "../models/Route.js";
import CorporateBooking from "../models/CorporateBooking.js";
import { sendEmail } from "../Services/emailService.js";
import csv from "csv-parser";
import fs from "fs";

// Helper to resolve companyId from the authenticated user
const resolveCompanyId = async (userId) => {
    const user = await User.findById(userId).select("companyId role");
    if (!user) throw new Error("User not found");
    // For CORPORATE users, the companyId is their own _id (they ARE the company)
    return user.companyId || userId;
};

const generateEmployeeId = async (companyId) => {
    const count = await CorporateEmployee.countDocuments({ companyId });
    return `EMP-${companyId.slice(-4)}-${String(count + 1).padStart(4, '0')}`;
};

// Bulk upload employees
export const bulkUploadEmployees = async (req, res) => {
    try {
        const { employees } = req.body;
        const managerId = req.userId;
        const companyId = await resolveCompanyId(req.userId);

        if (!employees || !Array.isArray(employees)) {
            return res.status(400).json({
                success: false,
                message: "Invalid employee data format"
            });
        }

        const results = {
            success: [],
            errors: [],
            duplicates: []
        };

        for (const employeeData of employees) {
            try {
                // Check if employee already exists
                const existingEmployee = await CorporateEmployee.findOne({
                    $or: [
                        { "personalInfo.email": employeeData.email },
                        { employeeId: employeeData.employeeId },
                        { "personalInfo.phoneNumber": employeeData.contactNumber || employeeData.whatsappNumber }
                    ]
                });

                if (existingEmployee) {
                    results.duplicates.push({
                        employee: employeeData,
                        reason: "Employee already exists",
                        existingId: existingEmployee._id
                    });
                    continue;
                }

                // Create user account for employee with a random temporary password
                // The real password will be set by the employee via invitation link
                const crypto = await import('crypto');
                const tempPassword = crypto.default.randomBytes(16).toString('hex');
                
                const user = new User({
                    fullName: employeeData.fullName,
                    email: employeeData.email,
                    password: tempPassword, // Random temp password - employee will set their own via invitation
                    role: "CORPORATE_EMPLOYEE",
                    companyId: companyId,
                    whatsappNumber: employeeData.contactNumber || employeeData.whatsappNumber || "N/A",
                    status: "ACTIVE",
                    isPasswordSet: false // Mark that password needs to be set
                });

                await user.save();

                // Parse full name into first/last
                const nameParts = (employeeData.fullName || "").trim().split(/\s+/);
                const firstName = nameParts[0] || "";
                const lastName = nameParts.slice(1).join(" ") || firstName;

                const generatedEmployeeId = await generateEmployeeId(companyId);

                // Create corporate employee record with correct schema mapping
                const corporateEmployee = new CorporateEmployee({
                    userId: user._id,
                    companyId: companyId,
                    employeeId: employeeData.employeeId || generatedEmployeeId,
                    personalInfo: {
                        firstName,
                        lastName,
                        email: employeeData.email,
                        phoneNumber: employeeData.contactNumber || employeeData.whatsappNumber || "",
                        department: employeeData.department || "",
                        designation: employeeData.designation || "",
                        workLocation: employeeData.workLocation || ""
                    },
                    residentialAddress: employeeData.residentialAddress || {},
                    transportDetails: {
                        assignedRoute: employeeData.routeId || employeeData.transportDetails?.assignedRoute || undefined,
                        seatNumber: employeeData.seatNumber || employeeData.transportDetails?.seatNumber || undefined,
                        pickupPoint: employeeData.pickupLocation || employeeData.transportDetails?.pickupPoint || "",
                        dropOffPoint: employeeData.dropoffLocation || employeeData.transportDetails?.dropOffPoint || "",
                        shiftType: employeeData.workShift || employeeData.transportDetails?.shiftType || "FULL_DAY",
                        transportStatus: "ACTIVE"
                    },
                    accessControl: {
                        isActive: true,
                        accessLevel: "EMPLOYEE"
                    },
                    documents: {
                        verificationStatus: "PENDING"
                    }
                });

                await corporateEmployee.save();

                // Send invitation email
                await sendEmployeeInvitation(user, employeeData);

                results.success.push({
                    employeeId: employeeData.employeeId,
                    fullName: employeeData.fullName,
                    email: employeeData.email,
                    userId: user._id,
                    corporateEmployeeId: corporateEmployee._id
                });

            } catch (error) {
                results.errors.push({
                    employee: employeeData,
                    error: error.message
                });
            }
        }

        res.status(201).json({
            success: true,
            message: "Employee bulk upload completed",
            data: {
                results,
                summary: {
                    total: employees.length,
                    successful: results.success.length,
                    errors: results.errors.length,
                    duplicates: results.duplicates.length
                }
            }
        });

    } catch (error) {
        console.error("Error in bulk employee upload:", error);
        res.status(500).json({
            success: false,
            message: "Error uploading employees",
            error: error.message
        });
    }
};

// Upload employees from CSV file
export const uploadEmployeesFromCSV = async (req, res) => {
    try {
        const managerId = req.userId;
        const companyId = await resolveCompanyId(req.userId);

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "No CSV file uploaded"
            });
        }

        const employees = [];
        const parser = csv();
        
        parser.on('data', (data) => {
            employees.push({
                employeeId: data['Employee ID'] || data['employeeId'],
                fullName: data['Full Name'] || data['fullName'],
                email: data['Email'] || data['email'],
                contactNumber: data['Contact Number'] || data['contactNumber'],
                department: data['Department'] || data['department'],
                designation: data['Designation'] || data['designation'],
                workShift: data['Work Shift'] || data['workShift'],
                pickupLocation: data['Pickup Location'] || data['pickupLocation'],
                dropoffLocation: data['Dropoff Location'] || data['dropoffLocation'],
                routeId: data['Route ID'] || data['routeId'],
                seatNumber: data['Seat Number'] || data['seatNumber']
            });
        });

        parser.on('end', async () => {
            try {
                const results = await processEmployeeUpload(employees, managerId, companyId);
                res.status(201).json({
                    success: true,
                    message: "CSV upload completed",
                    data: results
                });
            } catch (error) {
                res.status(500).json({
                    success: false,
                    message: "Error processing CSV",
                    error: error.message
                });
            }
        });

        parser.write(req.file.buffer);
        parser.end();

    } catch (error) {
        console.error("Error uploading CSV:", error);
        res.status(500).json({
            success: false,
            message: "Error uploading CSV file",
            error: error.message
        });
    }
};

// Get employees with pagination and filters
export const getEmployees = async (req, res) => {
    try {
        const managerId = req.userId;
        const companyId = await resolveCompanyId(req.userId);
        const { 
            page = 1, 
            limit = 20, 
            department, 
            designation, 
            workShift, 
            isActive,
            search 
        } = req.query;

        const query = { companyId };
        
        if (department) query["personalInfo.department"] = department;
        if (designation) query["personalInfo.designation"] = designation;
        if (workShift) query["transportDetails.shiftType"] = workShift;
        if (isActive !== undefined) query["accessControl.isActive"] = isActive === 'true';
        
        if (search) {
            query.$or = [
                { "personalInfo.firstName": { $regex: search, $options: 'i' } },
                { "personalInfo.lastName": { $regex: search, $options: 'i' } },
                { "personalInfo.email": { $regex: search, $options: 'i' } },
                { employeeId: { $regex: search, $options: 'i' } },
                { "personalInfo.phoneNumber": { $regex: search, $options: 'i' } }
            ];
        }

        const employees = await CorporateEmployee.find(query)
            .populate('userId', 'email isActive fullName')
            .populate('transportDetails.assignedRoute', 'routeName fromLocation toLocation')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await CorporateEmployee.countDocuments(query);

        res.status(200).json({
            success: true,
            data: {
                employees,
                pagination: {
                    currentPage: page,
                    totalPages: Math.ceil(total / limit),
                    totalEmployees: total,
                    hasNext: page * limit < total,
                    hasPrev: page > 1
                }
            }
        });

    } catch (error) {
        console.error("Error getting employees:", error);
        res.status(500).json({
            success: false,
            message: "Error retrieving employees",
            error: error.message
        });
    }
};

// Update employee
export const updateEmployee = async (req, res) => {
    try {
        const { employeeId } = req.params;
        const companyId = await resolveCompanyId(req.userId);
        const updates = req.body;

        const employee = await CorporateEmployee.findOne({
            _id: employeeId,
            companyId
        });

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: "Employee not found"
            });
        }

        // Apply nested updates correctly
        if (updates.personalInfo) {
            Object.assign(employee.personalInfo, updates.personalInfo);
        }
        if (updates.transportDetails) {
            Object.assign(employee.transportDetails, updates.transportDetails);
        }
        if (updates.residentialAddress) {
            Object.assign(employee.residentialAddress, updates.residentialAddress);
        }
        if (updates.accessControl) {
            Object.assign(employee.accessControl, updates.accessControl);
        }
        if (updates.employeeId) {
            employee.employeeId = updates.employeeId;
        }
        await employee.save();

        // Update user account if needed
        if (updates.personalInfo?.email || updates.personalInfo?.firstName) {
            const userUpdate = {};
            if (updates.personalInfo?.email) userUpdate.email = updates.personalInfo.email;
            if (updates.personalInfo?.firstName) {
                userUpdate.fullName = `${updates.personalInfo.firstName} ${updates.personalInfo.lastName || employee.personalInfo.lastName || ''}`.trim();
            }
            await User.findByIdAndUpdate(employee.userId, userUpdate);
        }

        res.status(200).json({
            success: true,
            message: "Employee updated successfully",
            data: {
                employeeId: employee._id,
                updates
            }
        });

    } catch (error) {
        console.error("Error updating employee:", error);
        res.status(500).json({
            success: false,
            message: "Error updating employee",
            error: error.message
        });
    }
};

// Delete employee
export const deleteEmployee = async (req, res) => {
    try {
        const { employeeId } = req.params;
        const companyId = await resolveCompanyId(req.userId);

        const employee = await CorporateEmployee.findOne({
            _id: employeeId,
            companyId
        });

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: "Employee not found"
            });
        }

        // Deactivate employee instead of deleting
        employee.accessControl.isActive = false;
        employee.transportDetails.transportStatus = "TERMINATED";
        await employee.save();

        // Deactivate user account
        await User.findByIdAndUpdate(employee.userId, { isActive: false });

        res.status(200).json({
            success: true,
            message: "Employee deactivated successfully"
        });

    } catch (error) {
        console.error("Error deactivating employee:", error);
        res.status(500).json({
            success: false,
            message: "Error deactivating employee",
            error: error.message
        });
    }
};

// Get employee attendance report
export const getEmployeeAttendance = async (req, res) => {
    try {
        const managerId = req.userId;
        const companyId = await resolveCompanyId(req.userId);
        const { 
            startDate, 
            endDate, 
            employeeId, 
            department,
            page = 1,
            limit = 50 
        } = req.query;

        const query = { companyId };
        
        if (startDate && endDate) {
            query.date = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }
        
        if (employeeId) query.employeeId = employeeId;
        if (department) query.department = department;

        // This would integrate with a travel history or attendance tracking system
        const attendance = await getAttendanceData(query, page, limit);

        res.status(200).json({
            success: true,
            data: {
                attendance,
                pagination: {
                    currentPage: page,
                    totalPages: Math.ceil(attendance.total / limit),
                    totalRecords: attendance.total,
                    hasNext: page * limit < attendance.total,
                    hasPrev: page > 1
                }
            }
        });

    } catch (error) {
        console.error("Error getting attendance:", error);
        res.status(500).json({
            success: false,
            message: "Error retrieving attendance",
            error: error.message
        });
    }
};

// Get route utilization report
export const getRouteUtilization = async (req, res) => {
    try {
        const managerId = req.userId;
        const companyId = await resolveCompanyId(req.userId);
        const { 
            startDate, 
            endDate, 
            routeId,
            page = 1,
            limit = 20 
        } = req.query;

        const query = { companyId };
        
        if (startDate && endDate) {
            query.date = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }
        
        if (routeId) query.routeId = routeId;

        const utilization = await getRouteUtilizationData(query, page, limit);

        res.status(200).json({
            success: true,
            data: {
                utilization,
                pagination: {
                    currentPage: page,
                    totalPages: Math.ceil(utilization.total / limit),
                    totalRecords: utilization.total,
                    hasNext: page * limit < utilization.total,
                    hasPrev: page > 1
                }
            }
        });

    } catch (error) {
        console.error("Error getting route utilization:", error);
        res.status(500).json({
            success: false,
            message: "Error retrieving route utilization",
            error: error.message
        });
    }
};

// Approve employee registration
export const approveEmployeeRegistration = async (req, res) => {
    try {
        const { employeeId } = req.params;
        const managerId = req.userId;
        const companyId = await resolveCompanyId(req.userId);

        const employee = await CorporateEmployee.findOne({
            _id: employeeId,
            companyId
        });

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: "Employee not found"
            });
        }

        employee.documents.verificationStatus = "VERIFIED";
        employee.documents.verifiedAt = new Date();
        employee.documents.verifiedBy = managerId;
        employee.accessControl.isActive = true;
        await employee.save();

        // Activate user account
        await User.findByIdAndUpdate(employee.userId, { isActive: true });

        // Send approval notification
        await sendEmployeeApproval(employee);

        res.status(200).json({
            success: true,
            message: "Employee registration approved successfully"
        });

    } catch (error) {
        console.error("Error approving employee:", error);
        res.status(500).json({
            success: false,
            message: "Error approving employee",
            error: error.message
        });
    }
};

// Send invitation emails to selected employees
export const sendInvitationEmails = async (req, res) => {
    try {
        const managerId = req.userId;
        const companyId = await resolveCompanyId(req.userId);
        const { employeeIds } = req.body;

        if (!employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Please provide an array of employee IDs to send invitations"
            });
        }

        const manager = await User.findById(managerId).select("companyName fullName");
        const results = { sent: [], failed: [] };

        // Import crypto for token generation
        const crypto = await import('crypto');

        for (const empId of employeeIds) {
            try {
                const employee = await CorporateEmployee.findOne({
                    _id: empId,
                    companyId
                }).populate("userId", "email fullName isPasswordSet");

                if (!employee || !employee.userId) {
                    results.failed.push({ employeeId: empId, reason: "Employee not found or no user account" });
                    continue;
                }

                const userAccount = await User.findById(employee.userId._id);
                if (!userAccount) {
                    results.failed.push({ employeeId: empId, reason: "User account not found" });
                    continue;
                }

                // Generate password setup token
                const passwordSetupToken = crypto.default.randomBytes(32).toString('hex');
                const tokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days expiry

                // Update user with password setup token
                userAccount.passwordSetupToken = passwordSetupToken;
                userAccount.passwordSetupTokenExpiry = tokenExpiry;
                await userAccount.save();

                const setPasswordUrl = `${process.env.FRONTEND_URL.split(",")[1]}/set-password?token=${passwordSetupToken}`;

                console.log("Sending invitation email to:", employee.userId.email);

                const emailResult = await sendEmail(
                    employee.userId.email,
                    "You are invited to join Corporate Transport - DriveMe",
                    `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                            <div style="background: linear-gradient(135deg, #1a237e 0%, #0d47a1 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
                                <h1 style="margin: 0; font-size: 24px;">Welcome to DriveMe Corporate Transport</h1>
                            </div>
                            <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
                                <p>Hello <strong>${employee.personalInfo?.firstName || employee.fullName || 'Employee'} ${employee.personalInfo?.lastName || ''}</strong>,</p>
                                <p>You have been invited by <strong>${manager?.companyName || manager?.fullName || 'your company'}</strong> to use the DriveMe corporate transport service.</p>
                                <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #1a237e; margin: 20px 0;">
                                    <h3 style="color: #1a237e; margin-top: 0;">Your Account Details</h3>
                                    <p><strong>Email:</strong> ${employee.userId.email}</p>
                                    <p><strong>Employee ID:</strong> ${employee.employeeId}</p>
                                    <p><strong>Department:</strong> ${employee.personalInfo?.department || 'N/A'}</p>
                                </div>
                                <div style="background: #fff3cd; padding: 15px; border-radius: 8px; border-left: 4px solid #ffc107; margin: 20px 0;">
                                    <p style="margin: 0; color: #856404; font-weight: 500;">Please click the button below to set up your password and activate your account.</p>
                                </div>
                                <div style="text-align: center; margin: 25px 0;">
                                    <a href="${setPasswordUrl}" style="background: #1a237e; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Set Your Password</a>
                                </div>
                                <p style="color: #666; font-size: 13px; text-align: center;">This link will expire in 7 days. If you have any questions, contact your transport coordinator.</p>
                                <p style="color: #999; font-size: 12px; text-align: center; margin-top: 20px;">If the button doesn't work, copy and paste this link in your browser:<br><a href="${setPasswordUrl}" style="color: #1a237e; word-break: break-all;">${setPasswordUrl}</a></p>
                            </div>
                        </div>
                    `
                );

                if (!emailResult.success) {
                    results.failed.push({
                        employeeId: empId,
                        reason: emailResult.message
                    });
                    continue;
                }

                results.sent.push({
                    employeeId: empId,
                    name: employee.fullName || `${employee.personalInfo?.firstName || ''} ${employee.personalInfo?.lastName || ''}`.trim(),
                    email: employee.userId.email
                });

            } catch (error) {
                results.failed.push({ employeeId: empId, reason: error.message });
            }
        }

        res.status(200).json({
            success: true,
            message: `Invitations sent: ${results.sent.length} successful, ${results.failed.length} failed`,
            data: {
                results,
                summary: {
                    total: employeeIds.length,
                    sent: results.sent.length,
                    failed: results.failed.length
                }
            }
        });

    } catch (error) {
        console.error("Error sending invitation emails:", error);
        res.status(500).json({
            success: false,
            message: "Error sending invitation emails",
            error: error.message
        });
    }
};

// Get employee feedback aggregation for corporate view
export const getEmployeeFeedbackSummary = async (req, res) => {
    try {
        const managerId = req.userId;
        const companyId = await resolveCompanyId(req.userId);

        // Get all employees under this company with feedback data
        const employees = await CorporateEmployee.find({ companyId }).select("_id userId personalInfo feedback");

        // Aggregate feedback from CorporateEmployee.feedback.feedbackHistory
        let totalFeedbacks = 0;
        let allRatings = [];
        let recentFeedbacks = [];

        employees.forEach(emp => {
            const history = emp.feedback?.feedbackHistory || [];
            history.forEach(fb => {
                if (fb.rating) {
                    totalFeedbacks++;
                    allRatings.push(fb.rating);
                    recentFeedbacks.push({
                        passengerId: emp.userId,
                        employeeName: `${emp.personalInfo?.firstName || ''} ${emp.personalInfo?.lastName || ''}`.trim() || "Unknown",
                        rating: fb.rating,
                        feedback: fb.comments || fb.comment || "",
                        suggestions: fb.suggestions || "",
                        driverRating: fb.driverRating || null,
                        punctualityRating: fb.punctualityRating || null,
                        vehicleRating: fb.vehicleRating || null,
                        date: fb.submittedAt || fb.ratedAt,
                        route: fb.route || "",
                        tripDate: fb.tripDate
                    });
                }
            });
        });

        // Calculate average
        const averageRating = allRatings.length > 0
            ? allRatings.reduce((sum, r) => sum + r, 0) / allRatings.length
            : 0;

        // Calculate rating distribution
        const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        allRatings.forEach(r => {
            if (r >= 1 && r <= 5) ratingDistribution[Math.round(r)]++;
        });

        // Sort by date and take last 10
        recentFeedbacks.sort((a, b) => new Date(b.date) - new Date(a.date));
        recentFeedbacks = recentFeedbacks.slice(0, 10);

        res.status(200).json({
            success: true,
            data: {
                averageRating: Math.round(averageRating * 10) / 10,
                totalFeedbacks,
                totalEmployees: employees.length,
                ratingDistribution,
                recentFeedbacks
            }
        });

    } catch (error) {
        console.error("Error getting feedback summary:", error);
        res.status(500).json({
            success: false,
            message: "Error retrieving feedback summary",
            error: error.message
        });
    }
};

// Helper functions
const processEmployeeUpload = async (employees, managerId, companyId) => {
    const results = {
        success: [],
        errors: [],
        duplicates: []
    };

    for (const employeeData of employees) {
        try {
            // Check if employee already exists
            const existingEmployee = await CorporateEmployee.findOne({
                $or: [
                    { "personalInfo.email": employeeData.email },
                    { employeeId: employeeData.employeeId }
                ]
            });

            if (existingEmployee) {
                results.duplicates.push({
                    employee: employeeData,
                    reason: "Employee already exists"
                });
                continue;
            }

            // Create user account
            const user = new User({
                fullName: employeeData.fullName,
                email: employeeData.email,
                password: "tempPassword123",
                role: "CORPORATE_EMPLOYEE",
                companyId: companyId,
                isActive: false // Inactive until approved
            });

            await user.save();

            // Create corporate employee record with correct schema mapping
            const nameParts = (employeeData.fullName || "").trim().split(/\s+/);
            const firstName = nameParts[0] || "";
            const lastName = nameParts.slice(1).join(" ") || firstName;

            const corporateEmployee = new CorporateEmployee({
                userId: user._id,
                companyId: companyId,
                employeeId: employeeData.employeeId,
                personalInfo: {
                    firstName,
                    lastName,
                    email: employeeData.email,
                    phoneNumber: employeeData.contactNumber || employeeData.whatsappNumber || "",
                    department: employeeData.department || "",
                    designation: employeeData.designation || "",
                    workLocation: employeeData.workLocation || ""
                },
                residentialAddress: employeeData.residentialAddress || {},
                transportDetails: {
                    assignedRoute: employeeData.routeId || employeeData.transportDetails?.assignedRoute || undefined,
                    seatNumber: employeeData.seatNumber || undefined,
                    pickupPoint: employeeData.pickupLocation || employeeData.transportDetails?.pickupPoint || "",
                    dropOffPoint: employeeData.dropoffLocation || employeeData.transportDetails?.dropOffPoint || "",
                    shiftType: employeeData.workShift || employeeData.transportDetails?.shiftType || "FULL_DAY",
                    transportStatus: "ACTIVE"
                },
                accessControl: {
                    isActive: true,
                    accessLevel: "EMPLOYEE"
                },
                documents: {
                    verificationStatus: "PENDING"
                }
            });

            await corporateEmployee.save();

            results.success.push({
                employeeId: employeeData.employeeId,
                userId: user._id,
                corporateEmployeeId: corporateEmployee._id
            });

        } catch (error) {
            results.errors.push({
                employee: employeeData,
                error: error.message
            });
        }
    }

    return results;
};

const sendEmployeeInvitation = async (user, employeeData) => {
    try {
        await sendEmail({
            to: user.email,
            subject: "Welcome to Corporate Transport System - DriveMe",
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2>Welcome to DriveMe Corporate Transport</h2>
                    <p>Hello <strong>${employeeData.fullName || 'Employee'}</strong>,</p>
                    <p>You have been added to the corporate transport system.</p>
                    <div style="background: #f0f0f0; padding: 15px; border-radius: 8px; margin: 15px 0;">
                        <p><strong>Login Email:</strong> ${user.email}</p>
                        <p><strong>Temporary Password:</strong> tempPassword123</p>
                    </div>
                    <p>Please login and change your password immediately.</p>
                    <a href="${process.env.FRONTEND_URL.split(",")[1] || 'http://localhost:5173'}/login" style="background: #1a237e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 10px;">Login Now</a>
                </div>
            `
        });
    } catch (error) {
        console.error("Error sending employee invitation:", error);
    }
};

const sendEmployeeApproval = async (employee) => {
    try {
        const user = await User.findById(employee.userId);
        if (user) {
            await sendEmail({
                to: user.email,
                subject: "Your Registration Has Been Approved - DriveMe",
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2>Registration Approved!</h2>
                        <p>Hello <strong>${employee.fullName || user.fullName}</strong>,</p>
                        <p>Your registration for the corporate transport system has been approved.</p>
                        <p>You can now login and start using the service.</p>
                        <a href="${process.env.FRONTEND_URL.split(",")[1] || 'http://localhost:5173'}/login" style="background: #1a237e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 10px;">Login Now</a>
                    </div>
                `
            });
        }
    } catch (error) {
        console.error("Error sending employee approval:", error);
    }
};

const getAttendanceData = async (query, page, limit) => {
    try {
        // Build CorporateBooking query for attendance from real booking data
        const bookingQuery = { corporateOwnerId: query.companyId || query.managerId };

        if (query.date) {
            bookingQuery.travelDate = query.date;
        } else {
            // Default to last 30 days
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            bookingQuery.travelDate = { $gte: thirtyDaysAgo };
        }

        if (query.employeeId) bookingQuery.passengerId = query.employeeId;

        const CorporateBooking = (await import("../models/CorporateBooking.js")).default;
        const total = await CorporateBooking.countDocuments(bookingQuery);
        const bookings = await CorporateBooking.find(bookingQuery)
            .populate("passengerId", "fullName email")
            .populate("routeId", "fromLocation toLocation")
            .sort({ travelDate: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const attendance = bookings.map(b => ({
            _id: b._id,
            employee: b.passengerId,
            route: b.routeId,
            date: b.travelDate,
            status: b.status,
            pickupTime: b.pickupTime,
            dropoffTime: b.dropoffTime,
            noShow: b.status === "NO_SHOW" || b.status === "CANCELLED",
        }));

        return { attendance, total };
    } catch (error) {
        console.error("Error in getAttendanceData:", error);
        return { attendance: [], total: 0 };
    }
};

const getRouteUtilizationData = async (query, page, limit) => {
    try {
        const CorporateBooking = (await import("../models/CorporateBooking.js")).default;
        const corporateOwnerId = query.companyId || query.managerId;

        // Aggregate bookings by route to get utilization data
        const matchStage = { corporateOwnerId: (await import("mongoose")).default.Types.ObjectId.createFromHexString(corporateOwnerId.toString()) };

        if (query.date) {
            matchStage.travelDate = query.date;
        } else {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            matchStage.travelDate = { $gte: thirtyDaysAgo };
        }

        if (query.routeId) {
            matchStage.routeId = (await import("mongoose")).default.Types.ObjectId.createFromHexString(query.routeId.toString());
        }

        const utilization = await CorporateBooking.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: "$routeId",
                    totalTrips: { $sum: 1 },
                    completedTrips: { $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0] } },
                    cancelledTrips: { $sum: { $cond: [{ $in: ["$status", ["CANCELLED", "NO_SHOW"]] }, 1, 0] } },
                    uniquePassengers: { $addToSet: "$passengerId" },
                }
            },
            {
                $lookup: {
                    from: "routes",
                    localField: "_id",
                    foreignField: "_id",
                    as: "route"
                }
            },
            { $unwind: { path: "$route", preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    routeId: "$_id",
                    routeName: { $concat: [{ $ifNull: ["$route.fromLocation", "Unknown"] }, " -> ", { $ifNull: ["$route.toLocation", "Unknown"] }] },
                    totalTrips: 1,
                    completedTrips: 1,
                    cancelledTrips: 1,
                    uniquePassengers: { $size: "$uniquePassengers" },
                    utilizationRate: {
                        $cond: [
                            { $gt: ["$totalTrips", 0] },
                            { $multiply: [{ $divide: ["$completedTrips", "$totalTrips"] }, 100] },
                            0
                        ]
                    }
                }
            },
            { $sort: { totalTrips: -1 } },
            { $skip: (page - 1) * limit },
            { $limit: limit * 1 }
        ]);

        const totalRoutes = await CorporateBooking.aggregate([
            { $match: matchStage },
            { $group: { _id: "$routeId" } },
            { $count: "total" }
        ]);

        return {
            utilization,
            total: totalRoutes[0]?.total || 0
        };
    } catch (error) {
        console.error("Error in getRouteUtilizationData:", error);
        return { utilization: [], total: 0 };
    }
};

// Assign pickup and dropoff stops to employee
export const assignStopsToEmployee = async (req, res) => {
    try {
        const { employeeId } = req.params;
        const { pickupStop, dropoffStop, routeId } = req.body;
        const managerId = req.userId;

        // Validate required fields
        if (!pickupStop || !dropoffStop || !routeId) {
            return res.status(400).json({
                success: false,
                message: "pickupStop, dropoffStop, and routeId are required"
            });
        }

        // Get employee
        const employee = await CorporateEmployee.findOne({
            _id: employeeId,
            companyId: await resolveCompanyId(req.userId)
        });

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: "Employee not found"
            });
        }

        // Validate route exists
        const route = await Route.findById(routeId);
        if (!route) {
            return res.status(404).json({
                success: false,
                message: "Route not found"
            });
        }

        // Validate stops exist in route
        const pickupStopObj = route.stopPoints.find(s => s._id.toString() === pickupStop);
        const dropoffStopObj = route.stopPoints.find(s => s._id.toString() === dropoffStop);

        if (!pickupStopObj || !dropoffStopObj) {
            return res.status(400).json({
                success: false,
                message: "Invalid pickup or dropoff stop. Stop not found in route."
            });
        }

        // Update employee stops
        employee.transportDetails.assignedRoute = routeId;
        employee.transportDetails.pickupPoint = pickupStopObj.location;
        employee.transportDetails.dropOffPoint = dropoffStopObj.location;

        await employee.save();

        // Send notification email
        const user = await User.findById(employee.userId);
        if (user && user.email) {
            await sendEmail({
                to: user.email,
                subject: "Your Transport Stops Have Been Updated",
                html: `
                    <h2>Hello ${user.fullName},</h2>
                    <p>Your transport stops have been updated in the Drive-Me system.</p>
                    <p><strong>Pickup Stop:</strong> ${pickupStopObj.location} at ${pickupStopObj.time}</p>
                    <p><strong>Dropoff Stop:</strong> ${dropoffStopObj.location}</p>
                    <p>Please confirm these stops in your employee dashboard.</p>
                    <p>Best regards,<br/>Drive-Me Transport System</p>
                `
            });
        }

        res.status(200).json({
            success: true,
            message: "Stops assigned successfully",
            data: {
                employeeId: employee._id,
                pickupPoint: pickupStopObj.location,
                dropoffPoint: dropoffStopObj.location,
                route: {
                    id: route._id,
                    name: route.fromLocation + " → " + route.toLocation
                }
            }
        });

    } catch (error) {
        console.error("Error assigning stops:", error);
        res.status(500).json({
            success: false,
            message: "Error assigning stops to employee",
            error: error.message
        });
    }
};

// Assign route to employee (used by CorporateEmployeeManagement frontend)
export const assignRouteToEmployee = async (req, res) => {
    try {
        const { employeeId } = req.params;
        const { routeId, pickupLocation, dropoffLocation, startDate, endDate } = req.body;
        const managerId = req.userId;
        const companyId = await resolveCompanyId(req.userId);

        if (!routeId) {
            return res.status(400).json({
                success: false,
                message: "routeId is required"
            });
        }

        const employee = await CorporateEmployee.findOne({
            _id: employeeId,
            companyId
        });

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: "Employee not found"
            });
        }

        const route = await Route.findById(routeId);
        if (!route) {
            return res.status(404).json({
                success: false,
                message: "Route not found"
            });
        }

        // Get the contract for this employee
        const contract = await Contract.findOne({
            _id: route.contractId || { $exists: false }
        });

        if (!contract) {
            return res.status(404).json({
                success: false,
                message: "Associated contract not found"
            });
        }

        // Update employee transport details with route assignment
        employee.transportDetails = employee.transportDetails || {};
        employee.transportDetails.assignedRoute = routeId;
        employee.transportDetails.pickupPoint = pickupLocation || route.fromLocation;
        employee.transportDetails.dropOffPoint = dropoffLocation || route.toLocation;
        employee.routeId = routeId;

        await employee.save();

        // AUTO-CREATE BOOKINGS FOR EMPLOYEE
        // Create daily bookings starting from today for the next 30 days
        const assignmentStartDate = startDate ? new Date(startDate) : new Date();
        const assignmentEndDate = endDate ? new Date(endDate) : new Date(new Date().setDate(new Date().getDate() + 30));
        
        let bookingsCreated = 0;
        const bookingPromises = [];

        for (let d = new Date(assignmentStartDate); d <= assignmentEndDate; d.setDate(d.getDate() + 1)) {
            // Check if route is available on this day
            const daysOfWeek = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
            const dayOfWeek = daysOfWeek[d.getDay()];

            if (route.availableDays && route.availableDays.includes(dayOfWeek)) {
                const booking = new CorporateBooking({
                    passengerId: employee.userId,
                    corporateOwnerId: companyId,
                    routeId: routeId,
                    contractId: contract._id,
                    driverId: route.driverId || null,
                    vehicleId: route.vehicleId || null,
                    pickupLocation: employee.transportDetails.pickupPoint,
                    dropoffLocation: employee.transportDetails.dropOffPoint,
                    travelPath: route.travelPath || [],
                    bookingDate: new Date(),
                    travelDate: new Date(d),
                    numberOfSeats: 1,
                    bookingStatus: "CONFIRMED",
                    vehicleModel: route.vehicleModel || "TBD",
                    vehiclePlate: route.vehiclePlate || "TBD",
                    driverName: route.driverName || "TBD",
                    driverImage: route.driverImage || null,
                });

                bookingPromises.push(booking.save());
                bookingsCreated++;
            }
        }

        // Save all bookings in parallel
        if (bookingPromises.length > 0) {
            await Promise.all(bookingPromises);
            console.log(`[v0] Auto-created ${bookingsCreated} bookings for employee ${employeeId}`);
        }

        res.status(200).json({
            success: true,
            message: "Route assigned to employee successfully",
            data: {
                employeeId: employee._id,
                routeId: route._id,
                routeName: route.fromLocation + " → " + route.toLocation,
                pickupLocation: employee.transportDetails.pickupPoint,
                dropoffLocation: employee.transportDetails.dropOffPoint,
                bookingsCreated: bookingsCreated,
                bookingPeriod: {
                    startDate: assignmentStartDate,
                    endDate: assignmentEndDate
                }
            }
        });

    } catch (error) {
        console.error("[v0] Error assigning route to employee:", error);
        res.status(500).json({
            success: false,
            message: "Error assigning route to employee",
            error: error.message
        });
    }
};

// Deactivate employee
export const deactivateEmployee = async (req, res) => {
    try {
        const { employeeId } = req.params;
        const managerId = req.userId;
        const companyId = await resolveCompanyId(req.userId);

        const employee = await CorporateEmployee.findOne({
            _id: employeeId,
            companyId
        });

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: "Employee not found"
            });
        }

        employee.accessControl.isActive = false;
        employee.transportDetails.transportStatus = "TERMINATED";
        await employee.save();

        res.status(200).json({
            success: true,
            message: "Employee deactivated successfully",
            data: {
                employeeId: employee._id,
                fullName: employee.fullName,
                isActive: employee.accessControl.isActive
            }
        });

    } catch (error) {
        console.error("Error deactivating employee:", error);
        res.status(500).json({
            success: false,
            message: "Error deactivating employee",
            error: error.message
        });
    }
};

// Get corporate routes (for route assignment dropdown)
export const getCorporateRoutes = async (req, res) => {
    try {
        const managerId = req.userId;
        const companyId = await resolveCompanyId(req.userId);

        // Find routes associated with this corporate via contracts
        const contracts = await Contract.find({
            corporateId: companyId,
            status: { $in: ["ACTIVE", "APPROVED"] }
        }).select("routes");

        const contractRouteIds = contracts.reduce((acc, contract) => {
            if (contract.routes && Array.isArray(contract.routes)) {
                acc.push(...contract.routes);
            }
            return acc;
        }, []);

        // Get routes that belong to contracts OR are directly assigned to this corporate
        const routes = await Route.find({
            $or: [
                { _id: { $in: contractRouteIds } },
                { corporateId: companyId },
                { createdBy: managerId }
            ]
        }).select("fromLocation toLocation routeName stopPoints distance duration");

        res.status(200).json({
            success: true,
            data: {
                routes: routes.map(r => ({
                    _id: r._id,
                    routeName: r.routeName || `${r.fromLocation} → ${r.toLocation}`,
                    fromLocation: r.fromLocation,
                    toLocation: r.toLocation,
                    stopPoints: r.stopPoints,
                    distance: r.distance,
                    duration: r.duration
                }))
            }
        });

    } catch (error) {
        console.error("Error fetching corporate routes:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching routes",
            error: error.message
        });
    }
};
