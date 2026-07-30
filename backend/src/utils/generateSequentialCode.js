/**
 * generateSequentialCode
 * -----------------------
 * Produces the next human-friendly sequential code (e.g. LEAD-00042,
 * DG-EMP-0007) for a Mongoose model. Unlike `estimatedDocumentCount() + 1`,
 * this derives the next number from the HIGHEST existing code, so it does
 * NOT collide after documents are deleted.
 *
 * @param {import("mongoose").Model} Model  The Mongoose model.
 * @param {string} field                    The field holding the code (e.g. "leadCode").
 * @param {string} prefix                   The code prefix, including trailing dash (e.g. "LEAD-").
 * @param {number} pad                      Zero-padding width for the numeric part.
 * @returns {Promise<string>} The next unique code.
 */
export const generateSequentialCode = async (Model, field, prefix, pad = 5) => {
    // Find the document with the lexicographically-highest code for this prefix.
    // Because the numeric part is zero-padded to a fixed width, lexicographic
    // ordering matches numeric ordering.
    const last = await Model.findOne({ [field]: { $regex: `^${prefix}\\d+$` } })
        .sort({ [field]: -1 })
        .select(field)
        .lean()

    let next = 1
    if (last && last[field]) {
        const parsed = parseInt(String(last[field]).replace(prefix, ""), 10)
        if (!Number.isNaN(parsed)) next = parsed + 1
    }

    return `${prefix}${String(next).padStart(pad, "0")}`
}

export default generateSequentialCode