import { useState, useEffect, useCallback } from "react";
import api from "../utils/api";

// Cache for dropdown options to avoid redundant API calls
const dropdownCache = new Map();
const cacheExpiry = 5 * 60 * 1000; // 5 minutes cache

/**
 * Hook to fetch dropdown options from the backend
 * @param {string|string[]} categories - Single category or array of categories to fetch
 * @returns {object} - { options, loading, error, refetch }
 */
export const useDropdownOptions = (categories) => {
    const [options, setOptions] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const categoriesArray = Array.isArray(categories) ? categories : [categories];

    const fetchOptions = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const now = Date.now();
            const categoriesToFetch = [];
            const cachedOptions = {};

            // Check cache first
            for (const category of categoriesArray) {
                const cached = dropdownCache.get(category);
                if (cached && now - cached.timestamp < cacheExpiry) {
                    cachedOptions[category] = cached.data;
                } else {
                    categoriesToFetch.push(category);
                }
            }

            // If all categories are cached, use cached data
            if (categoriesToFetch.length === 0) {
                setOptions(cachedOptions);
                setLoading(false);
                return;
            }

            // Fetch non-cached categories
            const response = await api.post("/dropdowns/multiple", {
                categories: categoriesToFetch,
            });

            const fetchedDropdowns = response.data.data.dropdowns || {};

            // Update cache
            for (const category of categoriesToFetch) {
                if (fetchedDropdowns[category]) {
                    dropdownCache.set(category, {
                        data: fetchedDropdowns[category],
                        timestamp: now,
                    });
                }
            }

            // Merge cached and fetched options
            setOptions({ ...cachedOptions, ...fetchedDropdowns });
        } catch (err) {
            console.error("[v0] Error fetching dropdown options:", err);
            setError(err.message || "Failed to fetch dropdown options");
        } finally {
            setLoading(false);
        }
    }, [categoriesArray.join(",")]);

    useEffect(() => {
        if (categoriesArray.length > 0 && categoriesArray[0]) {
            fetchOptions();
        }
    }, [fetchOptions]);

    const refetch = useCallback(() => {
        // Clear cache for these categories
        for (const category of categoriesArray) {
            dropdownCache.delete(category);
        }
        fetchOptions();
    }, [fetchOptions, categoriesArray]);

    return { options, loading, error, refetch };
};

/**
 * Hook to fetch a single dropdown category
 * @param {string} category - Category to fetch
 * @returns {object} - { options (array), loading, error, refetch }
 */
export const useSingleDropdown = (category) => {
    const { options, loading, error, refetch } = useDropdownOptions([category]);

    const categoryOptions = options[category]?.options || [];

    return {
        options: categoryOptions,
        name: options[category]?.name || "",
        description: options[category]?.description || "",
        loading,
        error,
        refetch,
    };
};

/**
 * Clear all cached dropdown options
 */
export const clearDropdownCache = () => {
    dropdownCache.clear();
};

/**
 * Clear specific category from cache
 * @param {string} category - Category to clear
 */
export const clearCategoryCache = (category) => {
    dropdownCache.delete(category);
};

// Dropdown category constants for easy reference
export const DROPDOWN_CATEGORIES = {
    VEHICLE_CATEGORIES_PASSENGER: "VEHICLE_CATEGORIES_PASSENGER",
    VEHICLE_CATEGORIES_GOODS: "VEHICLE_CATEGORIES_GOODS",
    VEHICLE_CATEGORIES_MANAGED: "VEHICLE_CATEGORIES_MANAGED",
    LOCATIONS: "LOCATIONS",
    CITIES: "CITIES",
    COUNTRIES: "COUNTRIES",
    CURRENCIES: "CURRENCIES",
    LICENSE_TYPES: "LICENSE_TYPES",
    RENTAL_DURATIONS: "RENTAL_DURATIONS",
    BUDGET_RANGES_DAILY: "BUDGET_RANGES_DAILY",
    BUDGET_RANGES_WEEKLY: "BUDGET_RANGES_WEEKLY",
    BUDGET_RANGES_MONTHLY: "BUDGET_RANGES_MONTHLY",
    BUDGET_RANGES_LONGTERM: "BUDGET_RANGES_LONGTERM",
    VEHICLE_FEATURES: "VEHICLE_FEATURES",
    MIN_SEATS_PASSENGER: "MIN_SEATS_PASSENGER",
    MIN_SEATS_GOODS: "MIN_SEATS_GOODS",
    MIN_SEATS_MANAGED: "MIN_SEATS_MANAGED",
    SERVICE_TYPES: "SERVICE_TYPES",
    NATIONALITIES: "NATIONALITIES",
    PAYMENT_METHODS: "PAYMENT_METHODS",
};

export default useDropdownOptions;
