import User from "../models/User.js";
import CorporateEmployee from "../models/CorporateEmployee.js";
import Route from "../models/Route.js";
import MonthlyPass from "../models/MonthlyPass.js";
import { generateOTP, sendVerificationOTP } from "../Services/emailService.js";
import { PASSENGER_ROLES, passengerRoleForOwner } from "../utils/roleFamilies.js";
import bcrypt from "bcryptjs";

// @desc    Get all employees for a corporate
// @route   GET /api/employees/corporate/:corporateId
// @access  Private (CORPORATE only)
export const getCorporateEmployees = async (req, res) => {
    try {
        const corporateId = req.userId;
        const { page = 1, limit = 10, search, status, department } = req.query;

        // Build query
        const query = {
            role: { $in: PASSENGER_ROLES },
            companyId: corporateId
        };

        if (search) {
            query.$or = [
                { fullName: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } },
                { whatsappNumber: { $regex: search, $options: "i" } }
            ];
        }

        const employees = await User.find(query)
            .select("-password")
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await User.countDocuments(query);

        res.json({
            success: true,
            data: {
                employees,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        console.error("Error fetching corporate employees:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch employees"
        });
    }
};

// @desc    Add single employee
// @route   POST /api/employees/add
// @access  Private (CORPORATE only)
export const addEmployee = async (req, res) => {
    try {
        const corporateId = req.userId;
        const {
            fullName,
            email,
            whatsappNumber,
            department,
            designation,
            workLocation,
            residentialAddress,
            assignedRoute,
            pickupPoint,
            dropOffPoint,
            shiftType
        } = req.body;

        // Check if email already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: "Email already registered"
            });
        }

        // Get corporate details
        const corporate = await User.findById(corporateId);
        if (!corporate) {
            return res.status(404).json({
                success: false,
                message: "Corporate not found"
            });
        }

        // Generate temporary password
        const tempPassword = Math.random().toString(36).slice(-8);
        const hashedPassword = await bcrypt.hash(tempPassword, 10);

        // Create user — tag with the segment's passenger role so a school
        // customer's students are stored as SCHOOL_STUDENT, not CORPORATE_EMPLOYEE.
        const user = new User({
            role: passengerRoleForOwner(corporate.role),
            fullName,
            email,
            whatsappNumber,
            password: hashedPassword,
            companyName: corporate.companyName,
            companyId: corporateId,
            isEmailVerified: false
        });

        await user.save();

        // Create corporate employee record
        const corporateEmployee = new CorporateEmployee({
            userId: user._id,
            companyId: corporateId,
            employeeId: `EMP${Date.now()}`,
            personalInfo: {
                firstName: fullName.split(' ')[0],
                lastName: fullName.split(' ').slice(1).join(' '),
                email,
                phoneNumber: whatsappNumber,
                department,
                designation,
                workLocation
            },
            residentialAddress,
            transportDetails: {
                assignedRoute,
                pickupPoint,
                dropOffPoint,
                shiftType: shiftType || "FULL_DAY",
                transportStatus: "ACTIVE"
            }
        });

        await corporateEmployee.save();

        // Send welcome email with credentials
        const otp = generateOTP();
        await sendVerificationOTP(email, fullName, otp);

        res.status(201).json({
            success: true,
            message: "Employee added successfully",
            data: {
                employee: {
                    _id: user._id,
                    fullName: user.fullName,
                    email: user.email,
                    department,
                    designation,
                    temporaryPassword: tempPassword
                }
            }
        });
    } catch (error) {
        console.error("Error adding employee:", error);
        res.status(500).json({
            success: false,
            message: "Failed to add employee"
        });
    }
};

// @desc    Bulk upload employees
// @route   POST /api/employees/bulk-upload
// @access  Private (CORPORATE only)
export const bulkUploadEmployees = async (req, res) => {
    try {
        const corporateId = req.userId;
        const { employees } = req.body; // Array of employee objects

        if (!Array.isArray(employees) || employees.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid employees data"
            });
        }

        const corporate = await User.findById(corporateId);
        if (!corporate) {
            return res.status(404).json({
                success: false,
                message: "Corporate not found"
            });
        }

        const results = {
            successful: [],
            failed: []
        };

        for (const empData of employees) {
            try {
                // Check if email already exists
                const existingUser = await User.findOne({ email: empData.email });
                if (existingUser) {
                    results.failed.push({
                        email: empData.email,
                        reason: "Email already registered"
                    });
                    continue;
                }

                // Generate temporary password
                const tempPassword = Math.random().toString(36).slice(-8);
                const hashedPassword = await bcrypt.hash(tempPassword, 10);

                // Create user
                const user = new User({
                    role: passengerRoleForOwner(corporate.role),
                    fullName: empData.fullName,
                    email: empData.email,
                    whatsappNumber: empData.whatsappNumber,
                    password: hashedPassword,
                    companyName: corporate.companyName,
                    companyId: corporateId,
                    isEmailVerified: false
                });

                await user.save();

                // Create corporate employee record
                const corporateEmployee = new CorporateEmployee({
                    userId: user._id,
                    companyId: corporateId,
                    employeeId: `EMP${Date.now()}${Math.random().toString(36).slice(-3)}`,
                    personalInfo: {
                        firstName: empData.fullName.split(' ')[0],
                        lastName: empData.fullName.split(' ').slice(1).join(' '),
                        email: empData.email,
                        phoneNumber: empData.whatsappNumber,
                        department: empData.department,
                        designation: empData.designation,
                        workLocation: empData.workLocation
                    },
                    residentialAddress: empData.residentialAddress,
                    transportDetails: {
                        assignedRoute: empData.assignedRoute,
                        pickupPoint: empData.pickupPoint,
                        dropOffPoint: empData.dropOffPoint,
                        shiftType: empData.shiftType || "FULL_DAY",
                        transportStatus: "ACTIVE"
                    }
                });

                await corporateEmployee.save();

                results.successful.push({
                    fullName: empData.fullName,
                    email: empData.email,
                    temporaryPassword: tempPassword,
                    employeeId: corporateEmployee.employeeId
                });

            } catch (error) {
                results.failed.push({
                    email: empData.email,
                    reason: error.message
                });
            }
        }

        res.json({
            success: true,
            message: `Bulk upload completed. ${results.successful.length} successful, ${results.failed.length} failed`,
            data: results
        });
    } catch (error) {
        console.error("Error in bulk upload:", error);
        res.status(500).json({
            success: false,
            message: "Failed to complete bulk upload"
        });
    }
};

// @desc    Update employee transport details
// @route   PUT /api/employees/:employeeId/transport
// @access  Private (CORPORATE only)
export const updateEmployeeTransport = async (req, res) => {
    try {
        const corporateId = req.userId;
        const { employeeId } = req.params;
        const {
            assignedRoute,
            pickupPoint,
            dropOffPoint,
            shiftType,
            seatNumber
        } = req.body;

        const corporateEmployee = await CorporateEmployee.findOne({
            userId: employeeId,
            companyId: corporateId
        });

        if (!corporateEmployee) {
            return res.status(404).json({
                success: false,
                message: "Employee not found"
            });
        }

        // Update transport details
        corporateEmployee.transportDetails = {
            ...corporateEmployee.transportDetails,
            assignedRoute,
            pickupPoint,
            dropOffPoint,
            shiftType: shiftType || corporateEmployee.transportDetails.shiftType,
            seatNumber: seatNumber || corporateEmployee.transportDetails.seatNumber
        };

        await corporateEmployee.save();

        res.json({
            success: true,
            message: "Employee transport details updated successfully",
            data: corporateEmployee
        });
    } catch (error) {
        console.error("Error updating employee transport:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update employee transport"
        });
    }
};

// @desc    Get employee details with transport info
// @route   GET /api/employees/:employeeId
// @access  Private (CORPORATE only)
export const getEmployeeDetails = async (req, res) => {
    try {
        const corporateId = req.userId;
        const { employeeId } = req.params;

        const user = await User.findOne({
            _id: employeeId,
            role: { $in: PASSENGER_ROLES },
            companyId: corporateId
        }).select("-password");

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Employee not found"
            });
        }

        const corporateEmployee = await CorporateEmployee.findOne({
            userId: employeeId,
            companyId: corporateId
        }).populate('transportDetails.assignedRoute');

        res.json({
            success: true,
            data: {
                user,
                corporateEmployee
            }
        });
    } catch (error) {
        console.error("Error fetching employee details:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch employee details"
        });
    }
};

// @desc    Delete employee
// @route   DELETE /api/employees/:employeeId
// @access  Private (CORPORATE only)
export const deleteEmployee = async (req, res) => {
    try {
        const corporateId = req.userId;
        const { employeeId } = req.params;

        // Check if employee belongs to this corporate
        const employee = await User.findOne({
            _id: employeeId,
            role: { $in: PASSENGER_ROLES },
            companyId: corporateId
        });

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: "Employee not found"
            });
        }

        // Delete corporate employee record
        await CorporateEmployee.deleteOne({ userId: employeeId });

        // Delete user
        await User.deleteOne({ _id: employeeId });

        res.json({
            success: true,
            message: "Employee deleted successfully"
        });
    } catch (error) {
        console.error("Error deleting employee:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete employee"
        });
    }
};

// @desc    Get available routes for employee assignment
// @route   GET /api/employees/routes/available
// @access  Private (CORPORATE only)
export const getAvailableRoutes = async (req, res) => {
    try {
        const corporateId = req.userId;

        const routes = await Route.find({
            corporateId: corporateId,
            status: "ACTIVE"
        }).select('fromLocation toLocation stopPoints totalSeats availableDays routeStartDate');

        res.json({
            success: true,
            data: routes
        });
    } catch (error) {
        console.error("Error fetching available routes:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch available routes"
        });
    }
};
