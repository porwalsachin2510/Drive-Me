// ==========================================================================
// Primary Owner service — single source of truth for "the real platform owner"
// ==========================================================================
//
// The platform has exactly one real owner: a super-admin account that also
// receives all platform commission. That account is identified by
// `process.env.ADMIN_USER_ID`, so it is the canonical, single source of truth
// for ownership across the whole backend.
//
// The owner account is immutable to every other admin — it can never be
// suspended, deleted, or have its super-admin status / permissions changed by
// anyone but the owner themselves — and it ALWAYS resolves to full super-admin
// access, even if its stored flags were somehow altered.

const PRIMARY_OWNER_ID = process.env.ADMIN_USER_ID || null;

// The full set of admin module permissions. Granted to every super admin and
// always to the primary owner. Kept here so every code path stays in sync.
export const ALL_ADMIN_MODULES = {
    overview: true,
    b2cManagement: true,
    ridePooling: true,
    b2bListings: true,
    users: true,
    wallets: true,
    vehicleApproval: true,
    commission: true,
    negotiations: true,
    settlement: true,
    dropdowns: true,
    reports: true,
    finance: true,
    communication: true,
    ads: true,
    paymentVerification: true,
    content: true,
    adminManagement: true,
    termsAndConditions: true,
};

// True when the given id refers to the primary owner account.
export const isPrimaryOwnerId = (id) =>
    Boolean(PRIMARY_OWNER_ID && id && id.toString() === PRIMARY_OWNER_ID.toString());

// Given a plain user object (e.g. from `user.toJSON()`), returns a copy that:
//  - carries an `isPrimaryOwner` boolean, and
//  - for the owner, forces `adminPermissions` to full super-admin access.
// Non-owner users are returned with just the `isPrimaryOwner: false` flag added.
export const withOwnerPermissions = (userObj) => {
    if (!userObj || !userObj._id) return userObj;
    const owner = isPrimaryOwnerId(userObj._id);
    if (!owner) {
        return { ...userObj, isPrimaryOwner: false };
    }
    return {
        ...userObj,
        isPrimaryOwner: true,
        adminPermissions: {
            isSuperAdmin: true,
            modules: { ...ALL_ADMIN_MODULES },
        },
    };
};
