"use client";

import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, Link } from "react-router-dom";
import {
  loginSuccess,
  authStart,
  authError,
  clearError,
} from "../../Redux/slices/authSlice";
import api from "../../utils/api";
import Navbar from "../../Components/Navbar/Navbar";
import Footer from "../../Components/Footer/Footer";
import OTPVerification from "../../Components/OTPVerification/OTPVerification";
import {
  selectLoading,
  selectError,
} from "../../Redux/selectors/authSelectors";
import "./register.css";

const Register = () => {
  const [selectedRole, setSelectedRole] = useState("COMMUTER");

  const [success, setSuccess] = useState("");

  const [isOpen, setIsOpen] = useState(true);

  const [showOTPVerification, setShowOTPVerification] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");

  const loading = useSelector(selectLoading);
  const error = useSelector(selectError);

  const navigate = useNavigate();

  const dispatch = useDispatch();

  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem("activeTab") || "commuters";
  });

  const roles = [
    { id: "COMMUTER", label: "COMMUTER", icon: "👤" },
    { id: "CORPORATE", label: "CORPORATE", icon: "🏢" },
    { id: "B2C_PARTNER", label: "B2C PARTNER", icon: "🚗" },
    { id: "B2B_PARTNER", label: "B2B PARTNER", icon: "🏭" },
    { id: "CORPORATE_EMPLOYEE", label: "CORPORATE EMPLOYEE", icon: "👔" },
  ];

  const roleRedirectMap = {
    COMMUTER: "/",
    CORPORATE: "/",
    B2C_PARTNER: "/",
    B2B_PARTNER: "/",
    CORPORATE_EMPLOYEE: "/",
  };

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    whatsappNumber: "",
    password: "",
    companyName: "",
    companyAddress: "",
    companyLogo: null,
    tradeLicense: null,
    serviceType: "",
    yearsOfExperience: "",
    serviceDescription: "",
    fleetManagement: [
      {
        vehicleType: "",
        model: "",
        year: "",
        seatingCapacity: "",
        quantityAvailable: "",
        images: [],
      },
    ],
    routeListings: [
      {
        fromLocation: "",
        toLocation: "",
        inboundStart: "",
        routeStartDate: "",
        oneWayPrice: "",
        roundTripPrice: "",
        totalSeats: "",
        availableSeats: "",
        monthlyPrice: "",
        stopPoints: [], // [{ location, time }]
        driverImage: null,
        availableDays: [],
        driverName: "",
        nationality: "",
        licenseNumber: "",
        experience: "",
        vehicleModel: "",
        vehiclePlate: "",
        images: [],
      },
    ],
    acceptedPaymentMethods: [],
  });

  const toggleDay = (day, routeIndex) => {
    const routes = [...formData.routeListings];
    const days = routes[routeIndex].availableDays || [];

    routes[routeIndex].availableDays = days.includes(day)
      ? days.filter((d) => d !== day)
      : [...days, day];

    setFormData({ ...formData, routeListings: routes });
  };

  const handleRoleSelect = (role) => {
    setSelectedRole(role);
    dispatch(authError(""));
    setFormData((prev) => ({
      ...prev,
      acceptedPaymentMethods: [],
    }));
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    dispatch(clearError());
  };

  const handleFileChange = (e) => {
    const { name } = e.target;
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData((prev) => ({
          ...prev,
          [name]: {
            file: file,
            preview: reader.result,
            fileName: file.name,
          },
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  // const handleVehicleChange = (index, field, value) => {
  //   const updatedFleet = [...formData.fleetManagement];
  //   updatedFleet[index][field] = value;
  //   setFormData((prev) => ({
  //     ...prev,
  //     fleetManagement: updatedFleet,
  //   }));
  // };

  // const handleVehicleImageChange = (vehicleIndex, imageIndex, file) => {
  //   const updatedFleet = [...formData.fleetManagement];
  //   const imageArray = [...(updatedFleet[vehicleIndex].images || [])];

  //   if (file) {
  //     const reader = new FileReader();
  //     reader.onloadend = () => {
  //       imageArray[imageIndex] = {
  //         file: file,
  //         preview: reader.result,
  //         fileName: file.name,
  //       };
  //       updatedFleet[vehicleIndex].images = imageArray.filter(
  //         (img) => img !== undefined
  //       );
  //       setFormData((prev) => ({
  //         ...prev,
  //         fleetManagement: updatedFleet,
  //       }));
  //     };
  //     reader.readAsDataURL(file);
  //   }
  // };

  // const removeVehicleImage = (vehicleIndex, imageIndex) => {
  //   const updatedFleet = [...formData.fleetManagement];
  //   updatedFleet[vehicleIndex].images = updatedFleet[
  //     vehicleIndex
  //   ].images.filter((_, idx) => idx !== imageIndex);
  //   setFormData((prev) => ({
  //     ...prev,
  //     fleetManagement: updatedFleet,
  //   }));
  // };

  // const canAddMoreVehicleImages = (vehicleIndex) => {
  //   return (formData.fleetManagement[vehicleIndex].images || []).length < 10;
  // };

  // const addVehicle = () => {
  //   setFormData((prev) => ({
  //     ...prev,
  //     fleetManagement: [
  //       ...prev.fleetManagement,
  //       {
  //         vehicleType: "",
  //         model: "",
  //         year: "",
  //         seatingCapacity: "",
  //         quantityAvailable: "",
  //         images: [],
  //       },
  //     ],
  //   }));
  // };

  // const deleteVehicle = (index) => {
  //   setFormData((prev) => ({
  //     ...prev,
  //     fleetManagement: prev.fleetManagement.filter((_, i) => i !== index),
  //   }));
  // };

  const handleRouteChange = (index, field, value) => {
    setFormData((prev) => {
      const routes = [...prev.routeListings];
      if (!routes[index]) return prev;
      routes[index][field] = value;
      return { ...prev, routeListings: routes };
    });
  };

  // const handleRouteChange = (index, field, value) => {
  //   const updatedRoutes = [...formData.routeListings];
  //   updatedRoutes[index][field] = value;
  //   setFormData((prev) => ({
  //     ...prev,
  //     routeListings: updatedRoutes,
  //   }));
  // };

  // const handleStopPointChange = (routeIndex, stopIndex, value) => {
  //   const updatedRoutes = [...formData.routeListings];
  //   const updatedStopPoints = [...updatedRoutes[routeIndex].stopPoints];
  //   updatedStopPoints[stopIndex] = value;
  //   updatedRoutes[routeIndex].stopPoints = updatedStopPoints;
  //   setFormData((prev) => ({
  //     ...prev,
  //     routeListings: updatedRoutes,
  //   }));
  // };

  const addStopPoint = (routeIndex) => {
    const routes = [...formData.routeListings];
    routes[routeIndex].stopPoints.push({ location: "", time: "" });
    setFormData({ ...formData, routeListings: routes });
  };

  const removeStopPoint = (routeIndex, stopIndex) => {
    const updatedRoutes = [...formData.routeListings];
    updatedRoutes[routeIndex].stopPoints = updatedRoutes[
      routeIndex
    ].stopPoints.filter((_, idx) => idx !== stopIndex);
    setFormData((prev) => ({
      ...prev,
      routeListings: updatedRoutes,
    }));
  };

  const handleRouteImageChange = (routeIndex, imageIndex, file) => {
    const updatedRoutes = [...formData.routeListings];
    const imageArray = [...(updatedRoutes[routeIndex].images || [])];

    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        imageArray[imageIndex] = {
          file: file,
          preview: reader.result,
          fileName: file.name,
        };
        updatedRoutes[routeIndex].images = imageArray.filter(
          (img) => img !== undefined
        );
        setFormData((prev) => ({
          ...prev,
          routeListings: updatedRoutes,
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const removeRouteImage = (routeIndex, imageIndex) => {
    const updatedRoutes = [...formData.routeListings];
    updatedRoutes[routeIndex].images = updatedRoutes[routeIndex].images.filter(
      (_, idx) => idx !== imageIndex
    );
    setFormData((prev) => ({
      ...prev,
      routeListings: updatedRoutes,
    }));
  };

  const canAddMoreRouteImages = (routeIndex) => {
    return (formData.routeListings[routeIndex].images || []).length < 10;
  };

  const handleCompanyLogoChange = (file) => {
    if (!file) return;

    setFormData((prev) => ({
      ...prev,
      companyLogo: {
        file,
        preview: URL.createObjectURL(file),
      },
    }));
  };

  const removeCompanyLogo = () => {
    setFormData((prev) => ({
      ...prev,
      companyLogo: null,
    }));
  };

  const handleDriverImageChange = (routeIndex, file) => {
    if (!file) return;

    const routes = [...formData.routeListings];
    routes[routeIndex].driverImage = {
      file,
      preview: URL.createObjectURL(file),
      fileName: file.name,
    };

    setFormData((prev) => ({
      ...prev,
      routeListings: routes,
    }));
  };

  const removeDriverImage = (routeIndex) => {
    const routes = [...formData.routeListings];
    routes[routeIndex].driverImage = null;

    setFormData((prev) => ({
      ...prev,
      routeListings: routes,
    }));
  };


  const addRoute = () => {
    setFormData((prev) => ({
      ...prev,
      routeListings: [
        ...prev.routeListings,
        {
          fromLocation: "",
          toLocation: "",
          inboundStart: "",
          routeStartDate: "",
          oneWayPrice: "",
          roundTripPrice: "",
          totalSeats: "",
          availableSeats: "",
          stopPoints: [],
          driverName: "",
          nationality: "",
          licenseNumber: "",
          experience: "",
          vehicleModel: "",
          vehiclePlate: "",
          images: [],
        },
      ],
    }));
  };

  const deleteRoute = (index) => {
    setFormData((prev) => ({
      ...prev,
      routeListings: prev.routeListings.filter((_, i) => i !== index),
    }));
  };

  const handlePaymentMethodChange = (method) => {
    setFormData((prev) => ({
      ...prev,
      acceptedPaymentMethods: prev.acceptedPaymentMethods.includes(method)
        ? prev.acceptedPaymentMethods.filter((m) => m !== method)
        : [...prev.acceptedPaymentMethods, method],
    }));
  };

  const validateForm = () => {
    if (
      !formData.fullName ||
      !formData.email ||
      !formData.whatsappNumber ||
      !formData.password
    ) {
      dispatch(authError("Please fill in all required fields"));
      return false;
    }

    if (
      selectedRole === "CORPORATE" &&
      (!formData.companyName || !formData.companyAddress)
    ) {
      dispatch(authError("Please fill in company details"));
      return false;
    }

    if (
      selectedRole === "CORPORATE_EMPLOYEE" &&
      !formData.companyName
    ) {
      dispatch(authError("Company name is required for corporate employee registration"));
      return false;
    }

    if (selectedRole === "B2C_PARTNER") {
      if (!formData.serviceType || !formData.yearsOfExperience) {
        dispatch(authError("Please fill in all service provider information"));
        return false;
      }
    }

    // if (selectedRole === "B2B_PARTNER") {
    //   let hasAtLeastOneVehicleWithImage = false;
    //   for (const vehicle of formData.fleetManagement) {
    //     if (vehicle.images && vehicle.images.length > 0) {
    //       hasAtLeastOneVehicleWithImage = true;
    //       break;
    //     }
    //   }

    //   if (
    //     formData.fleetManagement.length === 0 ||
    //     !hasAtLeastOneVehicleWithImage ||
    //     formData.acceptedPaymentMethods.length === 0
    //   ) {
    //     dispatch(
    //       authError(
    //         "Please add at least one vehicle with at least one image and select payment methods"
    //       )
    //     );
    //     return false;
    //   }
    // }

    if (selectedRole === "B2B_PARTNER") {
      if (formData.acceptedPaymentMethods.length === 0) {
        dispatch(authError("Please select payment methods"));
        return false;
      }
    }
    
    return true;
  };

  console.log("Frontend formData By User", formData);

  const handleSubmit = async (e) => {
    
    e.preventDefault();

    setSuccess("");
    dispatch(authError(""));

    if (!validateForm()) {
      return;
    }

    dispatch(authStart());

    try {
      const submitData = new FormData();
      submitData.append("role", selectedRole);
      submitData.append("fullName", formData.fullName);
      submitData.append("email", formData.email);
      submitData.append("whatsappNumber", formData.whatsappNumber);
      submitData.append("password", formData.password);

      if (formData.companyLogo) {
        submitData.append("companyLogo", formData.companyLogo.file);
      }

      if (selectedRole === "CORPORATE") {
        submitData.append("companyName", formData.companyName);
        submitData.append("companyAddress", formData.companyAddress);
        if (formData.tradeLicense?.file) {
          submitData.append("tradeLicense", formData.tradeLicense.file);
        }
      }

      if (selectedRole === "B2B_PARTNER") {
        submitData.append(
          "acceptedPaymentMethods",
          JSON.stringify(formData.acceptedPaymentMethods)
        );
      }

      if (selectedRole === "CORPORATE_EMPLOYEE") {
        submitData.append("companyName", formData.companyName);
        console.log("CORPORATE_EMPLOYEE Registration Data:", {
          role: selectedRole,
          fullName: formData.fullName,
          email: formData.email,
          companyName: formData.companyName
        });
      }

      if (selectedRole === "B2C_PARTNER") {
        submitData.append("serviceType", formData.serviceType);
        submitData.append("yearsOfExperience", formData.yearsOfExperience);
        submitData.append("serviceDescription", formData.serviceDescription);

        submitData.append(
          "acceptedPaymentMethods",
          JSON.stringify(formData.acceptedPaymentMethods)
        );
      }

      console.log("submitData", submitData);

      const response = await api.post(
        "/auth/register",
        submitData,
        {
          withCredentials: true,
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      if (response.data.success) {
        if (response.data.requiresVerification) {
          // Show OTP verification screen
          setPendingEmail(response.data.email);
          setShowOTPVerification(true);
          setSuccess("Registration initiated! Please check your email for verification code.");
        } else {
          // Legacy flow (shouldn't happen with new backend)
          dispatch(
            loginSuccess({
              user: response.data.user,
              token: response.data.token,
            })
          );

          localStorage.setItem("token", response.data.token);
          localStorage.setItem("user", JSON.stringify(response.data.user));
          setSuccess("Registration successful! Redirecting...");

          const userRole = response.data.user?.role;
          const redirectPath = roleRedirectMap[userRole] || "/login";

          setTimeout(() => {
            navigate(redirectPath);
          }, 1500);
        }
      }
    } catch (err) {
      dispatch(
        authError(
          err.response?.data?.message ||
            "Registration failed. Please try again."
        )
      );
      console.error("Registration error:", err);
    }
  };

  const handleBackToRegister = () => {
    setShowOTPVerification(false);
    setPendingEmail("");
    setSuccess("");
  };

  const handleOTPVerified = (user) => {
    setShowOTPVerification(false);
    setSuccess("Email verified and registration completed successfully!");
    
    const userRole = user?.role;
    const redirectPath = roleRedirectMap[userRole] || "/dashboard";

    setTimeout(() => {
      navigate(redirectPath);
    }, 1500);
  };

  return (
    <div>
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      {showOTPVerification ? (
        <OTPVerification
          email={pendingEmail}
          onBack={handleBackToRegister}
          onSuccess={handleOTPVerified}
        />
      ) : (
        <div className="register-container">
          <div className="register-card">
            <div className="register-header">
              <h1 className="register-title">Join DriveMe</h1>
              <p className="register-subtitle">
                Create your account and start moving
              </p>
            </div>

            {error && <div className="register-error-message">{error}</div>}
            {success && <div className="register-success-message">{success}</div>}

            <div className="register-role-selector">
              {roles.map((role) => (
                <button
                  key={role.id}
                  className={`register-role-button ${
                    selectedRole === role.id ? "register-active" : ""
                  }`}
                  onClick={() => handleRoleSelect(role.id)}
                  type="button"
                >
                  <span className="register-role-button-icon">{role.icon}</span>
                  <span className="register-role-button-text">{role.label}</span>
                </button>
              ))}
            </div>

            <div className="register-form-divider"></div>

            <form onSubmit={handleSubmit}>
              {/* Common Fields for All Roles */}
              <div className="register-form-row">
                <div className="register-form-group">
                  <label className="register-form-label">
                    {selectedRole === "CORPORATE_EMPLOYEE" ? "Employee Name" : "Full Name"} <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    className="register-form-input"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleInputChange}
                    placeholder={selectedRole === "CORPORATE_EMPLOYEE" ? "Enter employee name" : "Enter your name"}
                    required
                  />
                </div>
                <div className="register-form-group">
                  <label className="register-form-label">
                    WhatsApp Number <span className="register-required">*</span>
                  </label>
                  <input
                    type="tel"
                    className="register-form-input"
                    name="whatsappNumber"
                    value={formData.whatsappNumber}
                    onChange={handleInputChange}
                    placeholder="+1 (555) 000-0000"
                    required
                  />
                </div>
              </div>

              <div className="register-form-row">
                <div className="register-form-group">
                  <label className="register-form-label">
                    Email Address <span className="register-required">*</span>
                  </label>
                  <input
                    type="email"
                    className="register-form-input"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="your@email.com"
                    required
                  />
                </div>
                <div className="register-form-group">
                  <label className="register-form-label">
                    Password <span className="register-required">*</span>
                  </label>
                  <input
                    type="password"
                    className="register-form-input"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>

              {/* Corporate Role Specific */}
              {selectedRole === "CORPORATE" && (
                <>
                  <div className="register-form-divider"></div>
                  <div className="register-corp-section-header">
                    <span className="register-section-icon">🏢</span>
                    <span>Company Details</span>
                  </div>

                  <div className="register-form-row">
                    <div className="register-form-group">
                      <label className="register-form-label">Company Name</label>
                      <input
                        type="text"
                        className="register-form-input"
                        name="companyName"
                        value={formData.companyName}
                        onChange={handleInputChange}
                        placeholder="e.g. ABC Trading Co."
                      />
                    </div>
                    <div className="register-form-group">
                      <label className="register-form-label">
                        Trade License / Logo
                      </label>
                      <div className="register-file-input-wrapper">
                        <input
                          type="file"
                          id="tradeLicense"
                          name="tradeLicense"
                          onChange={handleFileChange}
                          accept="image/*,.pdf"
                        />
                        <label
                          htmlFor="tradeLicense"
                          className="register-file-input-label"
                        >
                          {formData.tradeLicense
                            ? `${formData.tradeLicense.fileName} ✓`
                            : "Choose File"}
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="register-form-row full">
                    <div className="register-form-group">
                      <label className="register-form-label">
                        Company Address
                      </label>
                      <textarea
                        className="register-form-input"
                        name="companyAddress"
                        value={formData.companyAddress}
                        onChange={handleInputChange}
                        placeholder="Full office address..."
                      ></textarea>
                    </div>
                  </div>
                </>
              )}

              {/* Corporate Employee Specific */}
              {selectedRole === "CORPORATE_EMPLOYEE" && (
                <>
                  <div className="register-form-divider"></div>
                  <div className="register-corp-section-header">
                    <span className="register-section-icon">👔</span>
                    <span>Company Information</span>
                  </div>

                  <div className="register-form-row">
                    <div className="register-form-group">
                      <label className="register-form-label">
                        Company Name <span className="register-required">*</span>
                      </label>
                      <input
                        type="text"
                        className="register-form-input"
                        name="companyName"
                        value={formData.companyName}
                        onChange={handleInputChange}
                        placeholder="e.g. MillPixel Software Solutions"
                        required
                      />
                    </div>
                  </div>
                </>
              )}

              {/* B2C Partner Specific - Simple Registration (no company fields) */}
              {selectedRole === "B2C_PARTNER" && (
                <>
                  <div className="register-form-divider"></div>
                  <div className="register-corp-section-header">
                    <span className="register-section-icon">🚗</span>
                    <span>Service Provider Information</span>
                  </div>

                  <div className="register-form-row">
                    <div className="register-form-group">
                      <label className="register-form-label">
                        Service Type
                      </label>
                      <select
                        className="register-form-input"
                        name="serviceType"
                        value={formData.serviceType || ""}
                        onChange={handleInputChange}
                      >
                        <option value="">Select service type</option>
                        <option value="individual">Individual Vehicle Owner</option>
                        <option value="smallfleet">Small Fleet Owner</option>
                      </select>
                    </div>
                    <div className="register-form-group">
                      <label className="register-form-label">
                        Years of Experience
                      </label>
                      <input
                        type="number"
                        className="register-form-input"
                        name="yearsOfExperience"
                        placeholder="0"
                        value={formData.yearsOfExperience || ""}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>

                  <div className="register-form-row register-full">
                    <div className="register-form-group">
                      <label className="register-form-label">
                        Brief Description about your services
                      </label>
                      <textarea
                        className="register-form-input"
                        name="serviceDescription"
                        placeholder="Tell us about your transportation services..."
                        value={formData.serviceDescription || ""}
                        onChange={handleInputChange}
                        rows="3"
                      ></textarea>
                    </div>
                  </div>
                </>
              )}

              {/* Payment Methods */}
              {(selectedRole === "B2B_PARTNER" ||
                selectedRole === "B2C_PARTNER") && (
                <>
                  <div className="register-form-divider"></div>
                  <div className="register-corp-section-header">
                    <span className="register-section-icon">💳</span>
                    <span>Payment Methods</span>
                  </div>
                  <div className="register-payment-methods">
                    {[
                      "Cash",
                      "Credit Card",
                      "Bank Transfer",
                      "Mobile Wallet",
                    ].map((method) => (
                      <button
                        key={method}
                        type="button"
                        className={`register-payment-option ${
                          formData.acceptedPaymentMethods.includes(method)
                            ? "register-selected"
                            : ""
                        }`}
                        onClick={() => handlePaymentMethodChange(method)}
                      >
                        {method}
                      </button>
                    ))}
                  </div>
                </>
              )}

              <button
                type="submit"
                className="register-submit-btn"
                disabled={loading}
              >
                {loading ? "Creating Account..." : "Create Account"}
              </button>
            </form>

            <div className="register-signin-link">
              Already have an account? <Link to="/login">Sign in here</Link>
            </div>
          </div>
        </div>
      )}
      <Footer />
    </div>
  );
};

export default Register;
