import DropdownOptions from "../models/DropdownOptions.js";

// Default dropdown options to seed
const defaultDropdownOptions = [
    {
        category: "VEHICLE_CATEGORIES_PASSENGER",
        name: "Passenger Vehicle Categories",
        description: "Vehicle categories for passenger transport",
        isSystemDefault: true,
        options: [
            { value: "SEDAN", label: "Sedan", icon: "car", order: 1 },
            { value: "SUV", label: "SUV", icon: "suv", order: 2 },
            { value: "LUXURY_COACH", label: "Luxury Coach", icon: "coach", order: 3 },
            { value: "MINIVAN", label: "Minivan", icon: "minivan", order: 4 },
            { value: "COASTER_BUS", label: "Coaster Bus", icon: "bus", order: 5 },
        ],
    },
    {
        category: "VEHICLE_CATEGORIES_GOODS",
        name: "Goods Carrier Categories",
        description: "Vehicle categories for goods transport",
        isSystemDefault: true,
        options: [
            { value: "PICKUP_1TON", label: "Pickup 1 Ton", icon: "pickup", order: 1 },
            { value: "PICKUP_3TON", label: "Pickup 3 Ton", icon: "pickup", order: 2 },
            { value: "TRUCK_7TON", label: "Truck 7 Ton", icon: "truck", order: 3 },
            { value: "REEFER_TRUCK", label: "Reefer Truck", icon: "reefer", order: 4 },
            { value: "FLATBED_TRAILER", label: "Flatbed Trailer", icon: "trailer", order: 5 },
        ],
    },
    {
        category: "VEHICLE_CATEGORIES_MANAGED",
        name: "Managed Services Categories",
        description: "Vehicle categories for managed fleet services",
        isSystemDefault: true,
        options: [
            { value: "ANY_TYPE", label: "Any Type", icon: "any", order: 1 },
            { value: "SHUTTLE_BUS", label: "Shuttle Bus", icon: "shuttle", order: 2 },
            { value: "EXECUTIVE_VAN", label: "Executive Van", icon: "van", order: 3 },
        ],
    },
    {
        category: "LOCATIONS",
        name: "Service Locations",
        description: "Available service locations",
        isSystemDefault: true,
        options: [
            { value: "Dubai", label: "Dubai", order: 1 },
            { value: "Abu Dhabi", label: "Abu Dhabi", order: 2 },
            { value: "Sharjah", label: "Sharjah", order: 3 },
            { value: "Ajman", label: "Ajman", order: 4 },
            { value: "Kuwait City", label: "Kuwait City", order: 5 },
            { value: "Doha", label: "Doha", order: 6 },
            { value: "Riyadh", label: "Riyadh", order: 7 },
            { value: "Jeddah", label: "Jeddah", order: 8 },
        ],
    },
    {
        category: "CITIES",
        name: "Cities",
        description: "Available cities",
        isSystemDefault: true,
        options: [
            { value: "Dubai", label: "Dubai", order: 1 },
            { value: "Abu Dhabi", label: "Abu Dhabi", order: 2 },
            { value: "Sharjah", label: "Sharjah", order: 3 },
            { value: "Ajman", label: "Ajman", order: 4 },
            { value: "Kuwait City", label: "Kuwait City", order: 5 },
            { value: "Doha", label: "Doha", order: 6 },
            { value: "Riyadh", label: "Riyadh", order: 7 },
            { value: "Jeddah", label: "Jeddah", order: 8 },
            { value: "Muscat", label: "Muscat", order: 9 },
            { value: "Manama", label: "Manama", order: 10 },
        ],
    },
    {
        category: "COUNTRIES",
        name: "Countries",
        description: "Available countries",
        isSystemDefault: true,
        options: [
            { value: "UAE", label: "United Arab Emirates", order: 1 },
            { value: "Kuwait", label: "Kuwait", order: 2 },
            { value: "Saudi Arabia", label: "Saudi Arabia", order: 3 },
            { value: "Qatar", label: "Qatar", order: 4 },
            { value: "Bahrain", label: "Bahrain", order: 5 },
            { value: "Oman", label: "Oman", order: 6 },
            { value: "India", label: "India", order: 7 },
            { value: "Pakistan", label: "Pakistan", order: 8 },
            { value: "Philippines", label: "Philippines", order: 9 },
            { value: "Bangladesh", label: "Bangladesh", order: 10 },
        ],
    },
    {
        category: "CURRENCIES",
        name: "Currencies",
        description: "Supported currencies",
        isSystemDefault: true,
        options: [
            { value: "AED", label: "AED - UAE Dirham", order: 1 },
            { value: "KWD", label: "KWD - Kuwaiti Dinar", order: 2 },
            { value: "SAR", label: "SAR - Saudi Riyal", order: 3 },
            { value: "BHD", label: "BHD - Bahraini Dinar", order: 4 },
            { value: "OMR", label: "OMR - Omani Rial", order: 5 },
            { value: "QAR", label: "QAR - Qatari Riyal", order: 6 },
        ],
    },
    {
        category: "LICENSE_TYPES",
        name: "Driver License Types",
        description: "Types of driving licenses",
        isSystemDefault: true,
        options: [
            { value: "Light", label: "Light", description: "Light vehicles", order: 1 },
            { value: "Heavy", label: "Heavy", description: "Heavy vehicles", order: 2 },
            { value: "Commercial", label: "Commercial", description: "Commercial vehicles", order: 3 },
            { value: "Private", label: "Private", description: "Private vehicles", order: 4 },
        ],
    },
    {
        category: "RENTAL_DURATIONS",
        name: "Rental Duration Options",
        description: "Available rental duration types",
        isSystemDefault: true,
        options: [
            { value: "daily", label: "Daily Rental", description: "Perfect for short-term needs", metadata: { unit: "days", placeholder: "e.g. 5" }, order: 1 },
            { value: "weekly", label: "Weekly Rental", description: "Save up to 20% vs daily", metadata: { unit: "weeks", placeholder: "e.g. 2" }, order: 2 },
            { value: "monthly", label: "Monthly Rental", description: "Most popular - Save up to 72%", metadata: { unit: "months", placeholder: "e.g. 3" }, order: 3 },
            { value: "long-term", label: "Long-term (Yearly)", description: "Best value for extended periods", metadata: { unit: "years", placeholder: "e.g. 1" }, order: 4 },
        ],
    },
    {
        category: "BUDGET_RANGES_DAILY",
        name: "Daily Budget Ranges",
        description: "Budget ranges for daily rentals. Currency is added dynamically based on user location.",
        isSystemDefault: true,
        options: [
            { value: "0-1500", label: "Less than 1,500 (Budget)", order: 1 },
            { value: "1500-3000", label: "1,500-3,000 (Economy)", order: 2 },
            { value: "3000-6000", label: "3,000-6,000 (Standard)", order: 3 },
            { value: "6000+", label: "6,000+ (Premium)", order: 4 },
        ],
    },
    {
        category: "BUDGET_RANGES_WEEKLY",
        name: "Weekly Budget Ranges",
        description: "Budget ranges for weekly rentals. Currency is added dynamically based on user location.",
        isSystemDefault: true,
        options: [
            { value: "0-9000", label: "Less than 9,000 (Budget)", order: 1 },
            { value: "9000-18000", label: "9,000-18,000 (Economy)", order: 2 },
            { value: "18000-35000", label: "18,000-35,000 (Standard)", order: 3 },
            { value: "35000+", label: "35,000+ (Premium)", order: 4 },
        ],
    },
    {
        category: "BUDGET_RANGES_MONTHLY",
        name: "Monthly Budget Ranges",
        description: "Budget ranges for monthly rentals. Currency is added dynamically based on user location.",
        isSystemDefault: true,
        options: [
            { value: "0-10000", label: "Less than 10,000 (Budget)", order: 1 },
            { value: "10000-25000", label: "10,000-25,000 (Economy)", order: 2 },
            { value: "25000-50000", label: "25,000-50,000 (Standard)", order: 3 },
            { value: "50000+", label: "50,000+ (Premium)", order: 4 },
        ],
    },
    {
        category: "BUDGET_RANGES_LONGTERM",
        name: "Long-term Budget Ranges",
        description: "Budget ranges for long-term rentals. Currency is added dynamically based on user location.",
        isSystemDefault: true,
        options: [
            { value: "0-8000", label: "Less than 8,000/month (Budget)", order: 1 },
            { value: "8000-20000", label: "8,000-20,000/month (Economy)", order: 2 },
            { value: "20000-40000", label: "20,000-40,000/month (Standard)", order: 3 },
            { value: "40000+", label: "40,000+/month (Premium)", order: 4 },
        ],
    },
    {
        category: "VEHICLE_FEATURES",
        name: "Vehicle Features",
        description: "Available vehicle features",
        isSystemDefault: true,
        options: [
            { value: "GPS Tracking", label: "GPS Tracking", order: 1 },
            { value: "Dash Camera", label: "Dash Camera", order: 2 },
            { value: "Premium Sound System", label: "Premium Sound System", order: 3 },
            { value: "Leather Seats", label: "Leather Seats", order: 4 },
            { value: "Sunroof", label: "Sunroof", order: 5 },
            { value: "Backup Camera", label: "Backup Camera", order: 6 },
            { value: "Parking Sensors", label: "Parking Sensors", order: 7 },
            { value: "Bluetooth", label: "Bluetooth", order: 8 },
            { value: "USB Charging", label: "USB Charging", order: 9 },
            { value: "Child Safety Seats", label: "Child Safety Seats", order: 10 },
        ],
    },
    {
        category: "MIN_SEATS_PASSENGER",
        name: "Minimum Seats - Passenger",
        description: "Minimum seat requirements for passenger vehicles",
        isSystemDefault: true,
        options: [
            { value: "1", label: "Minimum Seats Required *", metadata: { placeholder: "5 Seats" }, order: 1 },
        ],
    },
    {
        category: "MIN_SEATS_GOODS",
        name: "Minimum Capacity - Goods",
        description: "Minimum cargo capacity for goods vehicles",
        isSystemDefault: true,
        options: [
            { value: "3", label: "Cargo Capacity Required *", metadata: { placeholder: "3 Tons" }, order: 1 },
        ],
    },
    {
        category: "MIN_SEATS_MANAGED",
        name: "Minimum Seats - Managed",
        description: "Minimum seat requirements for managed services",
        isSystemDefault: true,
        options: [
            { value: "30", label: "Minimum Seats Required", metadata: { placeholder: "30 Seats" }, order: 1 },
        ],
    },
    {
        category: "SERVICE_TYPES",
        name: "Service Types",
        description: "Types of vehicle services",
        isSystemDefault: true,
        options: [
            { value: "PASSENGER", label: "Passenger Vehicle", description: "Cars, SUVs, Vans, Buses", icon: "car", order: 1 },
            { value: "GOODS_CARRIER", label: "Goods Carrier", description: "Trucks, Pickups for cargo", icon: "truck", order: 2 },
            { value: "MANAGED_SERVICES", label: "Managed Services", description: "Full fleet management", icon: "building", order: 3 },
        ],
    },
    {
        category: "NATIONALITIES",
        name: "Nationalities",
        description: "Driver nationalities",
        isSystemDefault: true,
        options: [
            { value: "Indian", label: "Indian", order: 1 },
            { value: "Pakistani", label: "Pakistani", order: 2 },
            { value: "Filipino", label: "Filipino", order: 3 },
            { value: "Bangladeshi", label: "Bangladeshi", order: 4 },
            { value: "Nepali", label: "Nepali", order: 5 },
            { value: "Sri Lankan", label: "Sri Lankan", order: 6 },
            { value: "Egyptian", label: "Egyptian", order: 7 },
            { value: "Emirati", label: "Emirati", order: 8 },
            { value: "Kuwaiti", label: "Kuwaiti", order: 9 },
            { value: "Saudi", label: "Saudi", order: 10 },
        ],
    },
    {
        category: "PAYMENT_METHODS",
        name: "Payment Methods",
        description: "Accepted payment methods",
        isSystemDefault: true,
        options: [
            { value: "Cash", label: "Cash", order: 1 },
            { value: "Credit Card", label: "Credit Card", order: 2 },
            { value: "Bank Transfer", label: "Bank Transfer", order: 3 },
            { value: "Mobile Wallet", label: "Mobile Wallet", order: 4 },
        ],
    },
];

// Seed default dropdown options
export const seedDropdownOptions = async (req, res) => {
    try {
        let seededCount = 0;
        let skippedCount = 0;

        for (const defaultOption of defaultDropdownOptions) {
            const existing = await DropdownOptions.findOne({ category: defaultOption.category });
            if (!existing) {
                await DropdownOptions.create({
                    ...defaultOption,
                    createdBy: req?.userId || null,
                });
                seededCount++;
            } else {
                skippedCount++;
            }
        }

        if (res) {
            return res.status(200).json({
                success: true,
                message: `Seeded ${seededCount} dropdown options, skipped ${skippedCount} existing`,
            });
        }

        console.log(`[v0] Seeded ${seededCount} dropdown options, skipped ${skippedCount} existing`);
        return { seededCount, skippedCount };
    } catch (error) {
        console.error("[v0] Error seeding dropdown options:", error);
        if (res) {
            return res.status(500).json({
                success: false,
                message: "Failed to seed dropdown options",
                error: error.message,
            });
        }
        throw error;
    }
};

// Get all dropdown categories
export const getAllDropdownCategories = async (req, res) => {
    try {
        const dropdowns = await DropdownOptions.find({ isActive: true })
            .select("category name description options isSystemDefault")
            .sort({ category: 1 });

        res.status(200).json({
            success: true,
            data: { dropdowns },
        });
    } catch (error) {
        console.error("[v0] Error fetching dropdown categories:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch dropdown categories",
            error: error.message,
        });
    }
};

// Get dropdown options by category
export const getDropdownByCategory = async (req, res) => {
    try {
        const { category } = req.params;

        const dropdown = await DropdownOptions.findOne({
            category,
            isActive: true,
        });

        if (!dropdown) {
            return res.status(404).json({
                success: false,
                message: "Dropdown category not found",
            });
        }

        // Return only active options sorted by order
        const activeOptions = dropdown.options
            .filter(opt => opt.isActive)
            .sort((a, b) => a.order - b.order);

        res.status(200).json({
            success: true,
            data: {
                category: dropdown.category,
                name: dropdown.name,
                description: dropdown.description,
                options: activeOptions,
            },
        });
    } catch (error) {
        console.error("[v0] Error fetching dropdown by category:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch dropdown options",
            error: error.message,
        });
    }
};

// Get multiple dropdown categories at once (for frontend efficiency)
export const getMultipleDropdowns = async (req, res) => {
    try {
        const { categories } = req.body;

        if (!categories || !Array.isArray(categories)) {
            return res.status(400).json({
                success: false,
                message: "Categories array is required",
            });
        }

        const dropdowns = await DropdownOptions.find({
            category: { $in: categories },
            isActive: true,
        });

        // Transform to a map for easier frontend consumption
        const dropdownMap = {};
        for (const dropdown of dropdowns) {
            dropdownMap[dropdown.category] = {
                name: dropdown.name,
                description: dropdown.description,
                options: dropdown.options
                    .filter(opt => opt.isActive)
                    .sort((a, b) => a.order - b.order),
            };
        }

        res.status(200).json({
            success: true,
            data: { dropdowns: dropdownMap },
        });
    } catch (error) {
        console.error("[v0] Error fetching multiple dropdowns:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch dropdowns",
            error: error.message,
        });
    }
};

// ADMIN: Update dropdown category
export const updateDropdownCategory = async (req, res) => {
    try {
        const { category } = req.params;
        const { name, description, isActive } = req.body;

        const dropdown = await DropdownOptions.findOne({ category });

        if (!dropdown) {
            return res.status(404).json({
                success: false,
                message: "Dropdown category not found",
            });
        }

        if (name) dropdown.name = name;
        if (description !== undefined) dropdown.description = description;
        if (isActive !== undefined) dropdown.isActive = isActive;
        dropdown.updatedBy = req.userId;

        await dropdown.save();

        res.status(200).json({
            success: true,
            message: "Dropdown category updated successfully",
            data: { dropdown },
        });
    } catch (error) {
        console.error("[v0] Error updating dropdown category:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update dropdown category",
            error: error.message,
        });
    }
};

// ADMIN: Add option to dropdown
export const addDropdownOption = async (req, res) => {
    try {
        const { category } = req.params;
        const { value, label, icon, description, order, metadata } = req.body;

        if (!value || !label) {
            return res.status(400).json({
                success: false,
                message: "Value and label are required",
            });
        }

        const dropdown = await DropdownOptions.findOne({ category });

        if (!dropdown) {
            return res.status(404).json({
                success: false,
                message: "Dropdown category not found",
            });
        }

        // Check if value already exists
        const existingOption = dropdown.options.find(opt => opt.value === value);
        if (existingOption) {
            return res.status(400).json({
                success: false,
                message: "Option with this value already exists",
            });
        }

        // Determine order if not provided
        const maxOrder = dropdown.options.length > 0
            ? Math.max(...dropdown.options.map(opt => opt.order || 0))
            : 0;

        dropdown.options.push({
            value,
            label,
            icon: icon || null,
            description: description || null,
            order: order || maxOrder + 1,
            metadata: metadata || {},
            isActive: true,
        });

        dropdown.updatedBy = req.userId;
        await dropdown.save();

        res.status(201).json({
            success: true,
            message: "Option added successfully",
            data: { dropdown },
        });
    } catch (error) {
        console.error("[v0] Error adding dropdown option:", error);
        res.status(500).json({
            success: false,
            message: "Failed to add dropdown option",
            error: error.message,
        });
    }
};

// ADMIN: Update dropdown option
export const updateDropdownOption = async (req, res) => {
    try {
        const { category, optionId } = req.params;
        const { value, label, icon, description, order, isActive, metadata } = req.body;

        const dropdown = await DropdownOptions.findOne({ category });

        if (!dropdown) {
            return res.status(404).json({
                success: false,
                message: "Dropdown category not found",
            });
        }

        const option = dropdown.options.id(optionId);
        if (!option) {
            return res.status(404).json({
                success: false,
                message: "Option not found",
            });
        }

        if (value) option.value = value;
        if (label) option.label = label;
        if (icon !== undefined) option.icon = icon;
        if (description !== undefined) option.description = description;
        if (order !== undefined) option.order = order;
        if (isActive !== undefined) option.isActive = isActive;
        if (metadata !== undefined) option.metadata = metadata;

        dropdown.updatedBy = req.userId;
        await dropdown.save();

        res.status(200).json({
            success: true,
            message: "Option updated successfully",
            data: { dropdown },
        });
    } catch (error) {
        console.error("[v0] Error updating dropdown option:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update dropdown option",
            error: error.message,
        });
    }
};

// ADMIN: Delete dropdown option
export const deleteDropdownOption = async (req, res) => {
    try {
        const { category, optionId } = req.params;

        const dropdown = await DropdownOptions.findOne({ category });

        if (!dropdown) {
            return res.status(404).json({
                success: false,
                message: "Dropdown category not found",
            });
        }

        const option = dropdown.options.id(optionId);
        if (!option) {
            return res.status(404).json({
                success: false,
                message: "Option not found",
            });
        }

        // Instead of deleting, mark as inactive (soft delete)
        option.isActive = false;
        dropdown.updatedBy = req.userId;
        await dropdown.save();

        res.status(200).json({
            success: true,
            message: "Option deleted successfully",
            data: { dropdown },
        });
    } catch (error) {
        console.error("[v0] Error deleting dropdown option:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete dropdown option",
            error: error.message,
        });
    }
};

// ADMIN: Reorder dropdown options
export const reorderDropdownOptions = async (req, res) => {
    try {
        const { category } = req.params;
        const { orderedOptionIds } = req.body;

        if (!orderedOptionIds || !Array.isArray(orderedOptionIds)) {
            return res.status(400).json({
                success: false,
                message: "orderedOptionIds array is required",
            });
        }

        const dropdown = await DropdownOptions.findOne({ category });

        if (!dropdown) {
            return res.status(404).json({
                success: false,
                message: "Dropdown category not found",
            });
        }

        // Update order based on position in array
        orderedOptionIds.forEach((optionId, index) => {
            const option = dropdown.options.id(optionId);
            if (option) {
                option.order = index + 1;
            }
        });

        dropdown.updatedBy = req.userId;
        await dropdown.save();

        res.status(200).json({
            success: true,
            message: "Options reordered successfully",
            data: { dropdown },
        });
    } catch (error) {
        console.error("[v0] Error reordering dropdown options:", error);
        res.status(500).json({
            success: false,
            message: "Failed to reorder dropdown options",
            error: error.message,
        });
    }
};

// ADMIN: Create new dropdown category
export const createDropdownCategory = async (req, res) => {
    try {
        const { category, name, description, options } = req.body;

        if (!category || !name) {
            return res.status(400).json({
                success: false,
                message: "Category and name are required",
            });
        }

        // Check if category already exists
        const existing = await DropdownOptions.findOne({ category });
        if (existing) {
            return res.status(400).json({
                success: false,
                message: "Dropdown category already exists",
            });
        }

        const dropdown = await DropdownOptions.create({
            category,
            name,
            description: description || "",
            options: options || [],
            isSystemDefault: false,
            createdBy: req.userId,
        });

        res.status(201).json({
            success: true,
            message: "Dropdown category created successfully",
            data: { dropdown },
        });
    } catch (error) {
        console.error("[v0] Error creating dropdown category:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create dropdown category",
            error: error.message,
        });
    }
};
