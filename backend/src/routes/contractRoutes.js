import express from "express"
import {
    createContractFromQuotation,
    getContractById,
    getContractByQuotation,
    uploadContractDocument,
    signContract,
    processContractPayment,
    getCorporateContracts,
    getFleetOwnerContracts,
    approveContract,
    rejectContract,
    corporateAcceptContract,
    corporateRejectContract,
    assignVehicles,
    getAssignedVehiclesForContract,
    assignRouteToVehicle,
    assignDriverOrFuelToVehicle,
    getContractRoutes,
    requestDueDateExtension,
    respondToDueDateExtension,
    getDueDateExtensionRequests,
    updateCorporateDriver,
    syncNegotiationCommission,
    uploadSignedContractDocument,
    verifySignedContractDocument,
    downloadContractDocument
} from "../controllers/contractController.js"
import { verifyToken, checkFleetOwnerRole, checkCorporateOwnerRole, requireRole } from "../middleware/auth.js"
import { upload, handleMulterError } from "../Config/multerConfig.js"

const router = express.Router()

// @route   POST /api/contracts/create-from-quotation
// @desc    Create contract from accepted quotation
// @access  Private (CORPORATE only)
router.post("/create-from-quotation", verifyToken, checkCorporateOwnerRole, createContractFromQuotation)


// @route   GET /api/contracts/corporate/all
// @desc    Get all contracts for corporate owner
// @access  Private (CORPORATE only)
router.get("/corporate/all", verifyToken, checkCorporateOwnerRole, getCorporateContracts)

// @route   GET /api/contracts/fleet/all
// @desc    Get all contracts for fleet owner
// @access  Private (B2B_PARTNER only)
router.get("/fleet/all", verifyToken, checkFleetOwnerRole, getFleetOwnerContracts)

// @route   GET /api/contracts/by-quotation/:quotationId
// @desc    Get contract by quotation ID
// @access  Private (CORPORATE or B2B_PARTNER)
router.get("/by-quotation/:quotationId", verifyToken, requireRole(["CORPORATE", "B2B_PARTNER"]), getContractByQuotation)

// @route   GET /api/contracts/:contractId
// @desc    Get contract details
// @access  Private (CORPORATE or B2B_PARTNER)
router.get("/:contractId", verifyToken, requireRole(["CORPORATE", "B2B_PARTNER"]), getContractById)

// @route   POST /api/contracts/:contractId/upload-document
// @desc    Fleet owner uploads contract document
// @access  Private (B2B_PARTNER only)
router.post(
    "/:contractId/upload-document",
    verifyToken,
    checkFleetOwnerRole,
    upload.single("document"), // Field name must match frontend FormData key
    handleMulterError,
    uploadContractDocument,
)
// @route   POST /api/contracts/:contractId/sign
// @desc    Sign contract digitally
// @access  Private (CORPORATE or B2B_PARTNER)
router.post("/:contractId/sign", verifyToken, requireRole(["CORPORATE", "B2B_PARTNER"]), signContract)

// @route   POST /api/contracts/:contractId/payment
// @desc    Process contract payment
// @access  Private (CORPORATE only)
router.post("/:contractId/payment", verifyToken, checkCorporateOwnerRole, processContractPayment)

// @route   POST /api/contracts/:contractId/approve
// @desc    Fleet owner approves signed contract
// @access  Private (B2B_PARTNER only)
router.post("/:contractId/approve", verifyToken, checkFleetOwnerRole, approveContract)

// @route   POST /api/contracts/:contractId/reject
// @desc    Fleet owner rejects signed contract
// @access  Private (B2B_PARTNER only)
router.post("/:contractId/reject", verifyToken, checkFleetOwnerRole, rejectContract)

// @route   POST /api/contracts/:contractId/corporate-accept
// @desc    Corporate owner accepts contract
// @access  Private (CORPORATE only)
router.post("/:contractId/corporate-accept", verifyToken, checkCorporateOwnerRole, corporateAcceptContract)

// @route   POST /api/contracts/:contractId/corporate-reject
// @desc    Corporate owner rejects contract
// @access  Private (CORPORATE only)
router.post("/:contractId/corporate-reject", verifyToken, checkCorporateOwnerRole, corporateRejectContract)

// @route   POST /api/contracts/:contractId/assign-vehicles
// @desc    Fleet owner assigns vehicles to contract
// @access  Private (B2B_PARTNER only)
router.post("/:contractId/assign-vehicles", verifyToken, checkFleetOwnerRole, assignVehicles)


// Get assigned vehicles for a contract
router.get("/assigned-vehicles/:contractId", verifyToken, checkCorporateOwnerRole, getAssignedVehiclesForContract)

// Assign driver or fuel to vehicle
router.post("/assign-driver-fuel/:contractId/:assignedVehicleId", verifyToken, checkCorporateOwnerRole, assignDriverOrFuelToVehicle)

// Assign route to vehicle
router.post("/assign-route/:contractId/:assignedVehicleId", verifyToken, checkCorporateOwnerRole, assignRouteToVehicle)

// Update/Change driver assigned by Corporate
router.put("/update-corporate-driver/:contractId/:assignedVehicleId", verifyToken, checkCorporateOwnerRole, updateCorporateDriver)

// Get contract routes
router.get("/routes/:contractId", verifyToken, checkCorporateOwnerRole, getContractRoutes)

// @route   POST /api/contracts/:contractId/request-due-date-extension
// @desc    Corporate requests due date extension for final payment
// @access  Private (CORPORATE only)
router.post("/:contractId/request-due-date-extension", verifyToken, checkCorporateOwnerRole, requestDueDateExtension)

// @route   POST /api/contracts/:contractId/respond-due-date-extension
// @desc    B2B Partner responds to due date extension request
// @access  Private (B2B_PARTNER only)
router.post("/:contractId/respond-due-date-extension", verifyToken, checkFleetOwnerRole, respondToDueDateExtension)

// @route   GET /api/contracts/fleet/due-date-requests
// @desc    Get contracts with pending due date extension requests for B2B Partner
// @access  Private (B2B_PARTNER only)
router.get("/fleet/due-date-requests", verifyToken, checkFleetOwnerRole, getDueDateExtensionRequests)

// @route   POST /api/contracts/:contractId/sync-negotiation-commission
// @desc    Sync negotiation commission from quotation to contract (for existing contracts)
// @access  Private (CORPORATE or B2B_PARTNER)
router.post("/:contractId/sync-negotiation-commission", verifyToken, requireRole(["CORPORATE", "B2B_PARTNER"]), syncNegotiationCommission)

// @route   POST /api/contracts/:contractId/upload-signed-document
// @desc    Corporate uploads signed contract document
// @access  Private (CORPORATE only)
router.post(
    "/:contractId/upload-signed-document",
    verifyToken,
    checkCorporateOwnerRole,
    upload.single("signedDocument"),
    handleMulterError,
    uploadSignedContractDocument
)

// @route   POST /api/contracts/:contractId/verify-signed-document
// @desc    B2B Partner verifies signed contract document
// @access  Private (B2B_PARTNER only)
router.post("/:contractId/verify-signed-document", verifyToken, checkFleetOwnerRole, verifySignedContractDocument)

// @route   GET /api/contracts/:contractId/download-document
// @desc    Download contract document (original or signed)
// @access  Private (CORPORATE or B2B_PARTNER)
router.get("/:contractId/download-document", verifyToken, requireRole(["CORPORATE", "B2B_PARTNER"]), downloadContractDocument)

export default router
