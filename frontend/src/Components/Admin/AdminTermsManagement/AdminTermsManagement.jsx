import React, { useState, useEffect } from "react";
import {
  FileText,
  Edit2,
  Save,
  X,
  Plus,
  Eye,
  Clock,
  Users,
  Percent,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import api from "../../../utils/api";
import "./AdminTermsManagement.css";

// Default terms content for initial setup
const getDefaultContent = () => ({
  general: `Welcome to DriveMe Platform. By registering and using our services, you agree to the following terms and conditions:

1. ACCEPTANCE OF TERMS
By creating an account and using our platform, you acknowledge that you have read, understood, and agree to be bound by these Terms and Conditions.

2. PLATFORM SERVICES
DriveMe provides a digital platform connecting transportation service providers with customers seeking transportation solutions. We act as an intermediary to facilitate these connections.

3. USER RESPONSIBILITIES
- You must provide accurate and complete information during registration
- You are responsible for maintaining the confidentiality of your account credentials
- You agree to use the platform only for lawful purposes
- You must comply with all applicable local laws and regulations

4. PAYMENTS AND COMMISSION
The platform charges a commission on transactions facilitated through our services. The commission rate ranges from 0% to 35% depending on your account type, service area, transaction volume, and partnership level. The specific commission rate applicable to your account will be communicated to you and may be adjusted by the platform administration.

5. SERVICE FEES
All fees and charges will be clearly communicated before any transaction is confirmed. You agree to pay all applicable fees associated with your use of the platform.

6. PRIVACY AND DATA PROTECTION
We collect and process your personal data in accordance with our Privacy Policy. By using our services, you consent to such processing.

7. DISPUTE RESOLUTION
Any disputes arising from the use of our platform will be resolved through our internal dispute resolution process first, before escalating to external arbitration if necessary.

8. LIMITATION OF LIABILITY
DriveMe is not liable for any indirect, incidental, or consequential damages arising from the use of our platform.

9. MODIFICATIONS
We reserve the right to modify these terms at any time. Continued use of the platform after modifications constitutes acceptance of the new terms.

10. TERMINATION
We reserve the right to suspend or terminate accounts that violate these terms or engage in fraudulent activity.

For any questions about these terms, please contact our support team.`,
  commissionDisclosure: `COMMISSION DISCLOSURE

As a user of DriveMe platform, you acknowledge and agree that:

1. COMMISSION STRUCTURE
The platform charges a commission on all transactions processed through our services. Commission rates range from 0% to 35% based on:
- Your user type and role
- Service area and market conditions
- Transaction volume and history
- Partnership level and agreements
- Special promotions or incentives

2. COMMISSION CALCULATION
Commission is calculated as a percentage of the total transaction amount and is automatically deducted before settlement.

3. ADMIN SERVICES
In exchange for the commission, DriveMe provides:
- Platform access and maintenance
- Customer support and dispute resolution
- Payment processing and security
- Marketing and visibility on the platform
- Quality assurance and verification services
- Negotiation services (for eligible users)

4. RATE CHANGES
Commission rates may be adjusted by the platform administration. You will be notified of any changes to your specific commission rate.

5. TRANSPARENCY
You can view your current commission rate and transaction history in your account dashboard at any time.

By proceeding with registration, you confirm your understanding and acceptance of these commission terms.`,
});

const AdminTermsManagement = () => {
  const [activeTab, setActiveTab] = useState("current");
  const [termsData, setTermsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [versionHistory, setVersionHistory] = useState([]);
  // eslint-disable-next-line no-unused-vars
  const [existingVersion, setExistingVersion] = useState(null);

  // Form state for editing
  const [formData, setFormData] = useState({
    generalTerms: "",
    commissionDisclosure: "",
    roleSpecificTerms: {
      B2C_PARTNER: "",
      B2B_PARTNER: "",
      CORPORATE: "",
      COMMUTER: "",
    },
    commissionRanges: {
      B2C_PARTNER: { min: 0, max: 35 },
      B2B_PARTNER: { min: 0, max: 35 },
      CORPORATE: { min: 0, max: 35 },
    },
    adminServicesDescription: "",
  });

  useEffect(() => {
    fetchTermsData();
    fetchVersionHistory();
  }, []);

  const fetchTermsData = async () => {
    try {
      setLoading(true);
      // Use /terms/latest to get the active terms
      const response = await api.get("/terms/latest");
      if (response.data.success && response.data.data) {
        const data = response.data.data;
        setTermsData(data);
        setExistingVersion(data.version || null);

        // Map backend data structure to frontend form
        const content = data.content || {};
        const defaultContent = getDefaultContent();

        setFormData({
          generalTerms: content.general || defaultContent.general,
          commissionDisclosure:
            content.commissionDisclosure || defaultContent.commissionDisclosure,
          roleSpecificTerms: {
            B2C_PARTNER: content.b2cPartner || "",
            B2B_PARTNER: content.b2bPartner || "",
            CORPORATE: content.corporate || "",
            COMMUTER: content.commuter || "",
          },
          commissionRanges: {
            B2C_PARTNER: data.commissionRanges?.b2cPartner || {
              min: 0,
              max: 35,
            },
            B2B_PARTNER: data.commissionRanges?.b2bPartner || {
              min: 0,
              max: 35,
            },
            CORPORATE: data.commissionRanges?.corporate || { min: 0, max: 35 },
          },
          adminServicesDescription: data.adminServices?.description || "",
        });
      } else {
        // No existing terms, use defaults
        const defaultContent = getDefaultContent();
        setFormData({
          generalTerms: defaultContent.general,
          commissionDisclosure: defaultContent.commissionDisclosure,
          roleSpecificTerms: {
            B2C_PARTNER: "",
            B2B_PARTNER: "",
            CORPORATE: "",
            COMMUTER: "",
          },
          commissionRanges: {
            B2C_PARTNER: { min: 0, max: 35 },
            B2B_PARTNER: { min: 0, max: 35 },
            CORPORATE: { min: 0, max: 35 },
          },
          adminServicesDescription: "",
        });
      }
    } catch (err) {
      console.error("Error fetching terms:", err);
      // If no terms exist yet, use defaults
      const defaultContent = getDefaultContent();
      setFormData({
        generalTerms: defaultContent.general,
        commissionDisclosure: defaultContent.commissionDisclosure,
        roleSpecificTerms: {
          B2C_PARTNER: "",
          B2B_PARTNER: "",
          CORPORATE: "",
          COMMUTER: "",
        },
        commissionRanges: {
          B2C_PARTNER: { min: 0, max: 35 },
          B2B_PARTNER: { min: 0, max: 35 },
          CORPORATE: { min: 0, max: 35 },
        },
        adminServicesDescription: "",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchVersionHistory = async () => {
    try {
      // Use /terms to get all versions (admin route)
      const response = await api.get("/terms");
      if (response.data.success) {
        setVersionHistory(response.data.data || []);
      }
    } catch (err) {
      console.error("Error fetching version history:", err);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      // Validate required fields
      const defaultContent = getDefaultContent();
      const generalTerms =
        formData.generalTerms?.trim() || defaultContent.general;
      const commissionDisclosure =
        formData.commissionDisclosure?.trim() ||
        defaultContent.commissionDisclosure;

      if (!generalTerms) {
        setError("General Terms & Conditions is required");
        setSaving(false);
        return;
      }

      if (!commissionDisclosure) {
        setError("Commission Disclosure is required");
        setSaving(false);
        return;
      }

      // Transform frontend form data to backend structure
      const payload = {
        version: `${Date.now()}`, // Generate unique version
        content: {
          general: generalTerms,
          commissionDisclosure: commissionDisclosure,
          b2cPartner: formData.roleSpecificTerms.B2C_PARTNER || "",
          b2bPartner: formData.roleSpecificTerms.B2B_PARTNER || "",
          corporate: formData.roleSpecificTerms.CORPORATE || "",
          commuter: formData.roleSpecificTerms.COMMUTER || "",
        },
        commissionRanges: {
          b2cPartner: {
            min: Number(formData.commissionRanges.B2C_PARTNER?.min) || 0,
            max: Number(formData.commissionRanges.B2C_PARTNER?.max) || 35,
          },
          b2bPartner: {
            min: Number(formData.commissionRanges.B2B_PARTNER?.min) || 0,
            max: Number(formData.commissionRanges.B2B_PARTNER?.max) || 35,
          },
          corporate: {
            min: Number(formData.commissionRanges.CORPORATE?.min) || 0,
            max: Number(formData.commissionRanges.CORPORATE?.max) || 35,
          },
        },
        effectiveFrom: new Date(),
      };

      // Always create a new version (POST request)
      const response = await api.post("/terms", payload);

      if (response.data.success) {
        setSuccess("Terms and conditions saved successfully!");
        setIsEditing(false);
        setExistingVersion(payload.version);
        fetchTermsData();
        fetchVersionHistory();
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err) {
      console.error("Error saving terms:", err);
      const errorMessage =
        err.response?.data?.error ||
        err.response?.data?.message ||
        "Failed to save terms and conditions";
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleRoleTermsChange = (role, value) => {
    setFormData((prev) => ({
      ...prev,
      roleSpecificTerms: {
        ...prev.roleSpecificTerms,
        [role]: value,
      },
    }));
  };

  const handleCommissionRangeChange = (role, field, value) => {
    const numValue = parseInt(value) || 0;
    setFormData((prev) => ({
      ...prev,
      commissionRanges: {
        ...prev.commissionRanges,
        [role]: {
          ...prev.commissionRanges[role],
          [field]: Math.min(Math.max(numValue, 0), 100),
        },
      },
    }));
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const roleLabels = {
    B2C_PARTNER: "B2C Partner",
    B2B_PARTNER: "B2B Partner",
    CORPORATE: "Corporate",
    COMMUTER: "Commuter",
  };

  // Helper function to get role-specific terms content
  const getRoleTermsContent = (role) => {
    // Map frontend role keys to backend keys
    const roleKeyMap = {
      B2C_PARTNER: "b2cPartner",
      B2B_PARTNER: "b2bPartner",
      CORPORATE: "corporate",
      COMMUTER: "commuter",
    };
    const backendKey = roleKeyMap[role];
    return termsData?.content?.[backendKey] || formData.roleSpecificTerms[role];
  };

  // Helper function to get commission range for display
  const getCommissionRange = (role) => {
    const roleKeyMap = {
      B2C_PARTNER: "b2cPartner",
      B2B_PARTNER: "b2bPartner",
      CORPORATE: "corporate",
    };
    const backendKey = roleKeyMap[role];
    return (
      termsData?.commissionRanges?.[backendKey] ||
      formData.commissionRanges[role] || { min: 0, max: 35 }
    );
  };

  if (loading) {
    return (
      <div className="admin-terms-loading">
        <div className="loading-spinner"></div>
        <p>Loading terms and conditions...</p>
      </div>
    );
  }

  return (
    <div className="admin-terms-management">
      <div className="admin-terms-header">
        <div className="header-left">
          <FileText size={28} />
          <div>
            <h1>Registration Terms & Conditions</h1>
            <p>Manage legal terms shown during user registration</p>
          </div>
        </div>
        <div className="header-actions">
          {!isEditing ? (
            <button className="btn-edit" onClick={() => setIsEditing(true)}>
              <Edit2 size={18} />
              Edit Terms
            </button>
          ) : (
            <>
              <button
                className="btn-cancel"
                onClick={() => {
                  setIsEditing(false);
                  fetchTermsData();
                }}
              >
                <X size={18} />
                Cancel
              </button>
              <button
                className="btn-save"
                onClick={handleSave}
                disabled={saving}
              >
                <Save size={18} />
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      {success && (
        <div className="alert alert-success">
          <CheckCircle size={20} />
          {success}
        </div>
      )}

      <div className="admin-terms-tabs">
        <button
          className={`tab-btn ${activeTab === "current" ? "active" : ""}`}
          onClick={() => setActiveTab("current")}
        >
          <FileText size={18} />
          Current Terms
        </button>
        <button
          className={`tab-btn ${activeTab === "commission" ? "active" : ""}`}
          onClick={() => setActiveTab("commission")}
        >
          <Percent size={18} />
          Commission Settings
        </button>
        <button
          className={`tab-btn ${activeTab === "roles" ? "active" : ""}`}
          onClick={() => setActiveTab("roles")}
        >
          <Users size={18} />
          Role-Specific Terms
        </button>
        <button
          className={`tab-btn ${activeTab === "history" ? "active" : ""}`}
          onClick={() => setActiveTab("history")}
        >
          <Clock size={18} />
          Version History
        </button>
      </div>

      <div className="admin-terms-content">
        {activeTab === "current" && (
          <div className="terms-section">
            <div className="section-card">
              <h3>General Terms & Conditions</h3>
              <p className="section-description">
                These terms are displayed to all users during registration. They
                include general platform usage terms.
              </p>
              {isEditing ? (
                <textarea
                  className="terms-textarea"
                  value={formData.generalTerms}
                  onChange={(e) =>
                    handleInputChange("generalTerms", e.target.value)
                  }
                  placeholder="Enter general terms and conditions..."
                  rows={10}
                />
              ) : (
                <div className="terms-preview">
                  {termsData?.content?.general ||
                    formData.generalTerms ||
                    "No general terms configured yet."}
                </div>
              )}
            </div>

            <div className="section-card">
              <h3>Commission Disclosure</h3>
              <p className="section-description">
                This disclosure is shown to B2C Partners, B2B Partners, and
                Corporate users during registration. It explains the commission
                structure (0% to 35%).
              </p>
              {isEditing ? (
                <textarea
                  className="terms-textarea"
                  value={formData.commissionDisclosure}
                  onChange={(e) =>
                    handleInputChange("commissionDisclosure", e.target.value)
                  }
                  placeholder="Enter commission disclosure text..."
                  rows={5}
                />
              ) : (
                <div className="terms-preview commission-disclosure">
                  <AlertCircle size={18} />
                  {termsData?.content?.commissionDisclosure ||
                    formData.commissionDisclosure ||
                    "A commission of 0% to 35% may apply based on your transactions. Review the terms for complete details."}
                </div>
              )}
            </div>

            <div className="section-card">
              <h3>Admin Services Description</h3>
              <p className="section-description">
                Describe the services admin provides that justify the commission
                (negotiation, support, payment processing, etc.)
              </p>
              {isEditing ? (
                <textarea
                  className="terms-textarea"
                  value={formData.adminServicesDescription}
                  onChange={(e) =>
                    handleInputChange(
                      "adminServicesDescription",
                      e.target.value,
                    )
                  }
                  placeholder="Enter admin services description..."
                  rows={5}
                />
              ) : (
                <div className="terms-preview">
                  {termsData?.adminServicesDescription ||
                    "No services description configured."}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "commission" && (
          <div className="terms-section">
            <div className="section-card">
              <h3>Commission Ranges by User Role</h3>
              <p className="section-description">
                Configure the minimum and maximum commission percentages for
                each user role. These values are displayed during registration.
              </p>

              <div className="commission-grid">
                {["B2C_PARTNER", "B2B_PARTNER", "CORPORATE"].map((role) => (
                  <div key={role} className="commission-card">
                    <div className="commission-card-header">
                      <Users size={20} />
                      <h4>{roleLabels[role]}</h4>
                    </div>
                    <div className="commission-inputs">
                      <div className="commission-input-group">
                        <label>Min %</label>
                        {isEditing ? (
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={formData.commissionRanges[role]?.min || 0}
                            onChange={(e) =>
                              handleCommissionRangeChange(
                                role,
                                "min",
                                e.target.value,
                              )
                            }
                          />
                        ) : (
                          <span className="commission-value">
                            {getCommissionRange(role)?.min ?? 0}%
                          </span>
                        )}
                      </div>
                      <div className="commission-separator">to</div>
                      <div className="commission-input-group">
                        <label>Max %</label>
                        {isEditing ? (
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={formData.commissionRanges[role]?.max || 35}
                            onChange={(e) =>
                              handleCommissionRangeChange(
                                role,
                                "max",
                                e.target.value,
                              )
                            }
                          />
                        ) : (
                          <span className="commission-value">
                            {getCommissionRange(role)?.max ?? 35}%
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "roles" && (
          <div className="terms-section">
            <div className="section-card">
              <h3>Role-Specific Terms</h3>
              <p className="section-description">
                Add specific terms for each user role. These are shown in
                addition to the general terms during registration.
              </p>

              <div className="role-terms-grid">
                {Object.keys(roleLabels).map((role) => (
                  <div key={role} className="role-terms-card">
                    <div className="role-terms-header">
                      <Users size={20} />
                      <h4>{roleLabels[role]}</h4>
                    </div>
                    {isEditing ? (
                      <textarea
                        className="role-terms-textarea"
                        value={formData.roleSpecificTerms[role] || ""}
                        onChange={(e) =>
                          handleRoleTermsChange(role, e.target.value)
                        }
                        placeholder={`Enter specific terms for ${roleLabels[role]}...`}
                        rows={6}
                      />
                    ) : (
                      <div className="role-terms-preview">
                        {getRoleTermsContent(role) ||
                          "No specific terms for this role."}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "history" && (
          <div className="terms-section">
            <div className="section-card">
              <h3>Version History</h3>
              <p className="section-description">
                View previous versions of terms and conditions. Users who
                registered are linked to the version they accepted.
              </p>

              {versionHistory.length > 0 ? (
                <div className="version-history-list">
                  {versionHistory.map((version, index) => (
                    <div
                      key={version._id}
                      className={`version-item ${version.isActive ? "active" : ""}`}
                    >
                      <div className="version-info">
                        <span className="version-number">
                          v{version.version || versionHistory.length - index}
                        </span>
                        {version.isActive && (
                          <span className="active-badge">Current</span>
                        )}
                      </div>
                      <div className="version-meta">
                        <span className="version-date">
                          <Clock size={14} />
                          {formatDate(version.createdAt)}
                        </span>
                        <span className="version-author">
                          Updated by: {version.updatedBy?.fullName || "Admin"}
                        </span>
                      </div>
                      <button className="btn-view-version">
                        <Eye size={16} />
                        View
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="no-history">
                  <Clock size={40} />
                  <p>No version history available yet.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {termsData && (
        <div className="terms-footer">
          <div className="footer-info">
            <span>
              Last updated:{" "}
              {termsData.updatedAt ? formatDate(termsData.updatedAt) : "Never"}
            </span>
            {termsData.updatedBy && (
              <span>by {termsData.updatedBy.fullName || "Admin"}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminTermsManagement;
