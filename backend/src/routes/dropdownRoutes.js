import express from "express";
import { verifyToken, checkAdminRole } from "../middleware/auth.js";
import {
    seedDropdownOptions,
    getAllDropdownCategories,
    getDropdownByCategory,
    getMultipleDropdowns,
    updateDropdownCategory,
    addDropdownOption,
    updateDropdownOption,
    deleteDropdownOption,
    reorderDropdownOptions,
    createDropdownCategory,
} from "../controllers/dropdownController.js";

const router = express.Router();

// Public routes (for fetching dropdown options)
router.get("/category/:category", getDropdownByCategory);
router.post("/multiple", getMultipleDropdowns);

// Admin routes
router.get("/", verifyToken, checkAdminRole, getAllDropdownCategories);
router.post("/seed", verifyToken, checkAdminRole, seedDropdownOptions);
router.post("/", verifyToken, checkAdminRole, createDropdownCategory);
router.put("/category/:category", verifyToken, checkAdminRole, updateDropdownCategory);
router.post("/category/:category/options", verifyToken, checkAdminRole, addDropdownOption);
router.put("/category/:category/options/:optionId", verifyToken, checkAdminRole, updateDropdownOption);
router.delete("/category/:category/options/:optionId", verifyToken, checkAdminRole, deleteDropdownOption);
router.put("/category/:category/reorder", verifyToken, checkAdminRole, reorderDropdownOptions);

export default router;
