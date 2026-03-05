"use client";

import { useState, useRef, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  createDriver,
  clearDriverError,
  clearDriverSuccess,
} from "../../../../Redux/slices/driverSlice";
import "./b2b_adddrivermodal.css";

function B2B_AddDriverModal({ onClose }) {
  const dispatch = useDispatch();
  // eslint-disable-next-line no-unused-vars
  const { loading, error, success } = useSelector((state) => state.driver);

  const licenseInputRef = useRef(null);
  const passportInputRef = useRef(null);
  const visaInputRef = useRef(null);
  const medicalCertificateInputRef = useRef(null);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    licenseNumber: "",
    licenseExpiry: "",
    licenseType: "Light",
    dateOfBirth: "",
    nationality: "",
    addressStreet: "",
    addressCity: "",
    addressCountry: "",
    experienceYears: "",
    experienceDescription: "",
  });

  const [files, setFiles] = useState({
    license: null,
    passport: null,
    visa: null,
    medicalCertificate: null,
  });

  const [fileNames, setFileNames] = useState({
    license: "",
    passport: "",
    visa: "",
    medicalCertificate: "",
  });

  const [validationErrors, setValidationErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (validationErrors[name]) {
      setValidationErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  const handleFileChange = (e, fieldName) => {
    const file = e.target.files?.[0];
    if (file) {
      const allowedTypes = [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/gif",
        "image/webp",
        "application/pdf",
      ];
      if (!allowedTypes.includes(file.type)) {
        setValidationErrors((prev) => ({
          ...prev,
          [fieldName]: "Invalid file type. Only images and PDFs are allowed.",
        }));
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        setValidationErrors((prev) => ({
          ...prev,
          [fieldName]: "File size exceeds 10MB limit.",
        }));
        return;
      }

      setFiles((prev) => ({
        ...prev,
        [fieldName]: file,
      }));

      setFileNames((prev) => ({
        ...prev,
        [fieldName]: file.name,
      }));

      setValidationErrors((prev) => ({
        ...prev,
        [fieldName]: "",
      }));
    }
  };

  const validateForm = () => {
    const errors = {};

    if (!formData.name.trim()) errors.name = "Full name is required";
    if (!formData.email.trim()) errors.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
      errors.email = "Invalid email format";

    if (!formData.phone.trim()) errors.phone = "Phone number is required";
    else if (!/^\+?[\d\s\-()]{10,}$/.test(formData.phone.replace(/\s+/g, "")))
      errors.phone = "Invalid phone number";

    if (!formData.licenseNumber.trim())
      errors.licenseNumber = "License number is required";
    if (!formData.licenseExpiry)
      errors.licenseExpiry = "License expiry date is required";
    else {
      const expiryDate = new Date(formData.licenseExpiry);
      if (expiryDate <= new Date()) {
        errors.licenseExpiry = "License expiry date must be in the future";
      }
    }

    if (!formData.dateOfBirth) errors.dateOfBirth = "Date of birth is required";
    if (!formData.nationality.trim())
      errors.nationality = "Nationality is required";
    if (!formData.addressStreet.trim())
      errors.addressStreet = "Street address is required";
    if (!formData.addressCity.trim()) errors.addressCity = "City is required";
    if (!formData.addressCountry.trim())
      errors.addressCountry = "Country is required";

    if (!formData.experienceYears)
      errors.experienceYears = "Years of experience is required";
    else if (isNaN(formData.experienceYears) || formData.experienceYears < 0)
      errors.experienceYears = "Must be a valid number";

    if (!files.license) errors.license = "License document is required";

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const formDataToSend = new FormData();

    formDataToSend.append("name", formData.name);
    formDataToSend.append("email", formData.email);
    formDataToSend.append("phone", formData.phone);
    formDataToSend.append("licenseNumber", formData.licenseNumber);
    formDataToSend.append("licenseExpiry", formData.licenseExpiry);
    formDataToSend.append("licenseType", formData.licenseType);
    formDataToSend.append("dateOfBirth", formData.dateOfBirth);
    formDataToSend.append("nationality", formData.nationality);

    formDataToSend.append("street", formData.addressStreet);
    formDataToSend.append("city", formData.addressCity);
    formDataToSend.append("country", formData.addressCountry);

    formDataToSend.append("experienceYears", formData.experienceYears);
    formDataToSend.append(
      "experienceDescription",
      formData.experienceDescription
    );

    if (files.license) formDataToSend.append("license", files.license);
    if (files.passport) formDataToSend.append("passport", files.passport);
    if (files.visa) formDataToSend.append("visa", files.visa);
    if (files.medicalCertificate)
      formDataToSend.append("medicalCertificate", files.medicalCertificate);

    try {
      // eslint-disable-next-line no-unused-vars
      const result = await dispatch(createDriver(formDataToSend)).unwrap();
      setSuccessMessage(
        "B2B Partner Driver registered successfully! Login credentials sent to driver's email.",
      );

      setFormData({
        name: "",
        email: "",
        phone: "",
        licenseNumber: "",
        licenseExpiry: "",
        licenseType: "Light",
        dateOfBirth: "",
        nationality: "",
        addressStreet: "",
        addressCity: "",
        addressCountry: "",
        experienceYears: "",
        experienceDescription: "",
      });
      setFiles({
        license: null,
        passport: null,
        visa: null,
        medicalCertificate: null,
      });
      setFileNames({
        license: "",
        passport: "",
        visa: "",
        medicalCertificate: "",
      });

      setTimeout(() => {
        dispatch(clearDriverSuccess());
        onClose();
      }, 1500);
    } catch (err) {
      console.error("Error creating driver:", err);
    }
  };

  const handleModalClose = () => {
    dispatch(clearDriverError());
    dispatch(clearDriverSuccess());
    onClose();
  };

  const handleLicenseClick = useCallback(() => {
    licenseInputRef.current?.click();
  }, []);

  const handlePassportClick = useCallback(() => {
    passportInputRef.current?.click();
  }, []);

  const handleVisaClick = useCallback(() => {
    visaInputRef.current?.click();
  }, []);

  const handleMedicalCertificateClick = useCallback(() => {
    medicalCertificateInputRef.current?.click();
  }, []);

  return (
    <div className="modal-overlay" onClick={handleModalClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add New Driver</h2>
          <button
            className="modal-close"
            onClick={handleModalClose}
            disabled={loading}
          >
            ✕
          </button>
        </div>

        {successMessage && (
          <div className="success-message">
            <span>✓</span> {successMessage}
          </div>
        )}

        {error && (
          <div className="error-message">
            <span>✕</span> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="modal-form" noValidate>
          <div className="section-title">Basic Information</div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="name">Full Name *</label>
              <input
                type="text"
                id="name"
                name="name"
                placeholder="e.g. Mohammed Ali"
                value={formData.name}
                onChange={handleChange}
                className={validationErrors.name ? "error" : ""}
                disabled={loading}
              />
              {validationErrors.name && (
                <span className="error-text">{validationErrors.name}</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="dateOfBirth">Date of Birth *</label>
              <input
                type="date"
                id="dateOfBirth"
                name="dateOfBirth"
                value={formData.dateOfBirth}
                onChange={handleChange}
                className={validationErrors.dateOfBirth ? "error" : ""}
                disabled={loading}
              />
              {validationErrors.dateOfBirth && (
                <span className="error-text">
                  {validationErrors.dateOfBirth}
                </span>
              )}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="email">Email Address *</label>
              <input
                type="email"
                id="email"
                name="email"
                placeholder="driver@example.com"
                value={formData.email}
                onChange={handleChange}
                className={validationErrors.email ? "error" : ""}
                disabled={loading}
              />
              {validationErrors.email && (
                <span className="error-text">{validationErrors.email}</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="phone">Phone Number *</label>
              <input
                type="tel"
                id="phone"
                name="phone"
                placeholder="+965 XXXX XXXX"
                value={formData.phone}
                onChange={handleChange}
                className={validationErrors.phone ? "error" : ""}
                disabled={loading}
              />
              {validationErrors.phone && (
                <span className="error-text">{validationErrors.phone}</span>
              )}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="nationality">Nationality *</label>
              <input
                type="text"
                id="nationality"
                name="nationality"
                placeholder="e.g. Indian"
                value={formData.nationality}
                onChange={handleChange}
                className={validationErrors.nationality ? "error" : ""}
                disabled={loading}
              />
              {validationErrors.nationality && (
                <span className="error-text">
                  {validationErrors.nationality}
                </span>
              )}
            </div>
          </div>

          <div className="section-title">License Information</div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="licenseNumber">License Number *</label>
              <input
                type="text"
                id="licenseNumber"
                name="licenseNumber"
                placeholder="License number"
                value={formData.licenseNumber}
                onChange={handleChange}
                className={validationErrors.licenseNumber ? "error" : ""}
                disabled={loading}
              />
              {validationErrors.licenseNumber && (
                <span className="error-text">
                  {validationErrors.licenseNumber}
                </span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="licenseExpiry">License Expiry *</label>
              <input
                type="date"
                id="licenseExpiry"
                name="licenseExpiry"
                value={formData.licenseExpiry}
                onChange={handleChange}
                className={validationErrors.licenseExpiry ? "error" : ""}
                disabled={loading}
              />
              {validationErrors.licenseExpiry && (
                <span className="error-text">
                  {validationErrors.licenseExpiry}
                </span>
              )}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="licenseType">License Type *</label>
            <select
              id="licenseType"
              name="licenseType"
              value={formData.licenseType}
              onChange={handleChange}
              disabled={loading}
            >
              <option value="Light">Light</option>
              <option value="Heavy">Heavy</option>
              <option value="Commercial">Commercial</option>
              <option value="Private">Private</option>
            </select>
          </div>

          <div className="section-title">Address</div>

          <div className="form-group">
            <label htmlFor="addressStreet">Street Address *</label>
            <input
              type="text"
              id="addressStreet"
              name="addressStreet"
              placeholder="Street address"
              value={formData.addressStreet}
              onChange={handleChange}
              className={validationErrors.addressStreet ? "error" : ""}
              disabled={loading}
            />
            {validationErrors.addressStreet && (
              <span className="error-text">
                {validationErrors.addressStreet}
              </span>
            )}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="addressCity">City *</label>
              <input
                type="text"
                id="addressCity"
                name="addressCity"
                placeholder="City"
                value={formData.addressCity}
                onChange={handleChange}
                className={validationErrors.addressCity ? "error" : ""}
                disabled={loading}
              />
              {validationErrors.addressCity && (
                <span className="error-text">
                  {validationErrors.addressCity}
                </span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="addressCountry">Country *</label>
              <input
                type="text"
                id="addressCountry"
                name="addressCountry"
                placeholder="Country"
                value={formData.addressCountry}
                onChange={handleChange}
                className={validationErrors.addressCountry ? "error" : ""}
                disabled={loading}
              />
              {validationErrors.addressCountry && (
                <span className="error-text">
                  {validationErrors.addressCountry}
                </span>
              )}
            </div>
          </div>

          <div className="section-title">Experience</div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="experienceYears">Years of Experience *</label>
              <input
                type="number"
                id="experienceYears"
                name="experienceYears"
                placeholder="e.g. 5"
                min="0"
                value={formData.experienceYears}
                onChange={handleChange}
                className={validationErrors.experienceYears ? "error" : ""}
                disabled={loading}
              />
              {validationErrors.experienceYears && (
                <span className="error-text">
                  {validationErrors.experienceYears}
                </span>
              )}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="experienceDescription">
              Description (Optional)
            </label>
            <textarea
              id="experienceDescription"
              name="experienceDescription"
              placeholder="Brief description of driving experience"
              value={formData.experienceDescription}
              onChange={handleChange}
              disabled={loading}
              rows="3"
            />
          </div>

          <div className="section-title">Documents</div>

          <div className="form-group">
            <label>License Document * (Required)</label>
            <div className="file-input-wrapper">
              <input
                type="file"
                ref={licenseInputRef}
                onChange={(e) => handleFileChange(e, "license")}
                accept="image/*,.pdf"
                disabled={loading}
                className="file-input"
              />
              <button
                type="button"
                className="file-button"
                onClick={handleLicenseClick}
                disabled={loading}
              >
                {fileNames.license ? "✓ " + fileNames.license : "Choose File"}
              </button>
            </div>
            {validationErrors.license && (
              <span className="error-text">{validationErrors.license}</span>
            )}
          </div>

          <div className="form-group">
            <label>Passport (Optional)</label>
            <div className="file-input-wrapper">
              <input
                type="file"
                ref={passportInputRef}
                onChange={(e) => handleFileChange(e, "passport")}
                accept="image/*,.pdf"
                disabled={loading}
                className="file-input"
              />
              <button
                type="button"
                className="file-button"
                onClick={handlePassportClick}
                disabled={loading}
              >
                {fileNames.passport ? "✓ " + fileNames.passport : "Choose File"}
              </button>
            </div>
            {validationErrors.passport && (
              <span className="error-text">{validationErrors.passport}</span>
            )}
          </div>

          <div className="form-group">
            <label>Visa (Optional)</label>
            <div className="file-input-wrapper">
              <input
                type="file"
                ref={visaInputRef}
                onChange={(e) => handleFileChange(e, "visa")}
                accept="image/*,.pdf"
                disabled={loading}
                className="file-input"
              />
              <button
                type="button"
                className="file-button"
                onClick={handleVisaClick}
                disabled={loading}
              >
                {fileNames.visa ? "✓ " + fileNames.visa : "Choose File"}
              </button>
            </div>
            {validationErrors.visa && (
              <span className="error-text">{validationErrors.visa}</span>
            )}
          </div>

          <div className="form-group">
            <label>Medical Certificate (Optional)</label>
            <div className="file-input-wrapper">
              <input
                type="file"
                ref={medicalCertificateInputRef}
                onChange={(e) => handleFileChange(e, "medicalCertificate")}
                accept="image/*,.pdf"
                disabled={loading}
                className="file-input"
              />
              <button
                type="button"
                className="file-button"
                onClick={handleMedicalCertificateClick}
                disabled={loading}
              >
                {fileNames.medicalCertificate
                  ? "✓ " + fileNames.medicalCertificate
                  : "Choose File"}
              </button>
            </div>
            {validationErrors.medicalCertificate && (
              <span className="error-text">
                {validationErrors.medicalCertificate}
              </span>
            )}
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn-cancel"
              onClick={handleModalClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button type="submit" className="btn-register" disabled={loading}>
              {loading ? "Registering..." : "Register Driver"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default B2B_AddDriverModal;
