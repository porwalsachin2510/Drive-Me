import express from "express"
import {
    getFleetOwnerDrivers,
    getAvailableDrivers,
    createDriver,
    updateDriver,
    deleteDriver,
    getAllDrivers,
    createCorporateDriver,
    getAvailableCorporateDrivers,
    getAllCorporateDrivers,
    createB2CPartnerDriver,
    getB2CPartnerDrivers,
    updateB2CPartnerDriver,
    deleteB2CPartnerDriver,
} from "../controllers/driverController.js"
import { getCorporateStats } from "../controllers/corporateStatsController.js"
import { verifyToken, checkFleetOwnerRole, checkCorporateOwnerRole, checkB2CPartnerRole } from "../middleware/auth.js"
import { uploadDriverDocuments, handleMulterError } from "../Config/multerConfig.js"

const router = express.Router()

// Corporate stats endpoint (used by CorporateProfilePage)
router.get("/stats", verifyToken, getCorporateStats)

router.post("/", verifyToken, checkFleetOwnerRole, uploadDriverDocuments, handleMulterError, createDriver)

router.get("/", verifyToken, checkFleetOwnerRole, getFleetOwnerDrivers)
router.get("/available", verifyToken, checkFleetOwnerRole, getAvailableDrivers)
router.get("/all", verifyToken, getAllDrivers)
router.put("/:driverId", verifyToken, checkFleetOwnerRole, updateDriver)
router.delete("/:driverId", verifyToken, checkFleetOwnerRole, deleteDriver)


router.post("/create-corporate-driver", verifyToken, checkCorporateOwnerRole, uploadDriverDocuments, handleMulterError, createCorporateDriver)
router.get("/corporate-drivers", verifyToken, checkCorporateOwnerRole, getAllCorporateDrivers)
router.get("/available-corporate-driver", verifyToken, checkCorporateOwnerRole, getAvailableCorporateDrivers)

// B2C Partner Driver Routes
router.post("/create-b2c-driver", verifyToken, checkB2CPartnerRole, uploadDriverDocuments, handleMulterError, createB2CPartnerDriver)
router.get("/b2c-drivers", verifyToken, checkB2CPartnerRole, getB2CPartnerDrivers)
router.put("/b2c-driver/:driverId", verifyToken, checkB2CPartnerRole, uploadDriverDocuments, handleMulterError, updateB2CPartnerDriver)
router.delete("/b2c-driver/:driverId", verifyToken, checkB2CPartnerRole, deleteB2CPartnerDriver)

export default router
