// src/utils/timeUtils.js

export function normalizeTime(inputTime) {
    if (!inputTime || typeof inputTime !== "string") return "";

    let time = inputTime.trim().toUpperCase();

    // Case 1: Already contains AM/PM
    if (time.includes("AM") || time.includes("PM")) {
        const [hourMin, period] = time.split(" ");
        const [h, m] = hourMin.split(":").map(Number);

        if (isNaN(h) || isNaN(m)) return "";

        return `${h}:${m.toString().padStart(2, "0")} ${period[0]}m`;
    }

    // Case 2: 24-hour or no AM/PM
    let [hour, minute] = time.split(":").map(Number);

    if (isNaN(hour) || isNaN(minute)) return "";

    let period = "Am";

    if (hour >= 12) {
        period = "Pm";
        if (hour > 12) hour -= 12;
    }

    if (hour === 0) hour = 12;

    return `${hour}:${minute.toString().padStart(2, "0")} ${period}`;
}

const SUPPORTED_COUNTRIES = [
    {
        code: "UAE",
        label: "United Arab Emirates",
        display: "UAE",
    },
    {
        code: "Kuwait",
        label: "Kuwait",
        display: "Kuwait",
    },
];

export const isServiceAvailable = (country) =>
    SUPPORTED_COUNTRIES.some(
      (c) => c.display === country || c.label === country
    );

export const getDisplayCountry = (country) => {
    const found = SUPPORTED_COUNTRIES.find(
      (c) => c.display === country || c.label === country
    );
    return found?.display || country;
};
  
export const getTotalVehicleQuantity = (vehicles = []) => {
    return vehicles.reduce((total, vehicle) => {
        return total + (Number(vehicle.quantity) || 0);
    }, 0);
}
