/**
 * Validates all required fields for the search vehicles form
 * @param {Object} filters - The filter object containing search parameters
 * @returns {Object} - Object with isValid boolean and error messages array
 */
export const validateSearchFilters = (filters) => {
    const errors = [];

    if (!filters.vehicleType || filters.vehicleType.trim() === "") {
        errors.push("Vehicle type is required");
    }

    if (!filters.seats || filters.seats === "" || filters.seats === "0") {
        errors.push("Number of seats is required");
    }

    if (!filters.location || filters.location.trim() === "") {
        errors.push("Pickup location is required");
    }

    if (!filters.date || filters.date.trim() === "") {
        errors.push("Pickup date is required");
    }

    if (!filters.duration || filters.duration === "" || filters.duration === "0") {
        errors.push("Duration is required");
    }

    if (!filters.budget || filters.budget === "" || filters.budget === "0") {
        errors.push("Budget is required");
    }

    return {
        isValid: errors.length === 0,
        errors,
    };
};

/**
 * Check if any required field is empty
 * @param {Object} filters - The filter object
 * @returns {Boolean} - True if all required fields are filled
 */
export const isSearchFormComplete = (filters) => {
    // Check basic fields
    const basicFieldsComplete =
        filters.vehicleType &&
        filters.vehicleType.trim() !== "" &&
        filters.minseatsrequired &&
        filters.minseatsrequired !== "" &&
        filters.minseatsrequired !== "0" &&
        filters.minseatsrequired !== 0 &&
        filters.location &&
        filters.location.trim() !== "" &&
        filters.startDate &&
        filters.startDate.trim() !== "" &&
        filters.durationValue &&
        filters.durationValue !== "" &&
        filters.durationValue !== "0" &&
        filters.durationValue !== 0 &&
        filters.budget &&
        filters.budget.trim() !== "" &&
        filters.budget !== "0";

    // Check that at least one Additional Requirement is selected
    const hasAdditionalRequirement = filters.driverRequired || filters.fuelIncluded;

    // Check that at least one Preferred Feature is selected
    const hasPreferredFeatures =
        filters.features && Array.isArray(filters.features) && filters.features.length > 0;

    return basicFieldsComplete && hasAdditionalRequirement && hasPreferredFeatures;
};
