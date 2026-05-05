import React, { useState, useEffect } from "react";
import {
  X,
  FileText,
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import api from "../../utils/api";
import "./TermsAndConditionsModal.css";

const TermsAndConditionsModal = ({
  isOpen,
  onClose,
  onAccept,
  userRole,
  isAccepting = false,
}) => {
  const [terms, setTerms] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [expandedSections, setExpandedSections] = useState({});

  useEffect(() => {
    if (isOpen && userRole) {
      fetchTerms();
    }
  }, [isOpen, userRole]);

  const fetchTerms = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get(`/terms/latest?role=${userRole}`);
      if (response.data.success && response.data.data) {
        const data = response.data.data;
        // Transform backend data to modal format
        const transformedTerms = transformBackendTerms(data, userRole);
        setTerms(transformedTerms);
      } else {
        // Use default terms if no data
        setTerms(getDefaultTerms());
      }
    } catch (err) {
      console.error("Error fetching terms:", err);
      // Use default terms if API fails
      setTerms(getDefaultTerms());
    } finally {
      setLoading(false);
    }
  };

  // Transform backend terms data to modal format
  const transformBackendTerms = (data, role) => {
    const roleKeyMap = {
      B2C_PARTNER: "b2cPartner",
      B2B_PARTNER: "b2bPartner",
      CORPORATE: "corporate",
      COMMUTER: "commuter",
    };
    const roleKey = roleKeyMap[role] || "b2cPartner";

    // Handle both formats: full terms object and role-specific terms from getForRole
    const isRoleSpecificFormat = data.generalTerms !== undefined;

    let generalTerms, commissionDisclosure, roleSpecificTerms, roleCommission;

    if (isRoleSpecificFormat) {
      // Data from getForRole: { generalTerms, commissionDisclosure, roleSpecificTerms, commissionRange }
      generalTerms = data.generalTerms;
      commissionDisclosure = data.commissionDisclosure;
      roleSpecificTerms = data.roleSpecificTerms;
      roleCommission = data.commissionRange || { min: 0, max: 35 };
    } else {
      // Data from full terms object: { content: { general, commissionDisclosure, b2cPartner, ... }, commissionRanges }
      const content = data.content || {};
      generalTerms = content.general;
      commissionDisclosure = content.commissionDisclosure;
      roleSpecificTerms = content[roleKey];
      roleCommission = data.commissionRanges?.[roleKey] || { min: 0, max: 35 };
    }

    const sections = [];

    // Add general terms section
    if (generalTerms) {
      sections.push({
        title: "General Terms & Conditions",
        content: generalTerms,
        isHighlighted: false,
      });
    }

    // Add commission disclosure section
    if (commissionDisclosure) {
      sections.push({
        title: "Commission Disclosure",
        content: commissionDisclosure,
        isHighlighted: true,
      });
    }

    // Add role-specific terms if available
    if (roleSpecificTerms) {
      const roleLabel =
        {
          b2cPartner: "B2C Partner",
          b2bPartner: "B2B Partner",
          corporate: "Corporate",
          commuter: "Commuter",
        }[roleKey] || role.replace("_", " ");

      sections.push({
        title: `${roleLabel} Specific Terms`,
        content: roleSpecificTerms,
        isHighlighted: false,
      });
    }

    return {
      version: data.version || "1.0.0",
      title: `Terms and Conditions for ${role.replace("_", " ")}`,
      effectiveDate: data.effectiveFrom || new Date().toISOString(),
      userType: role,
      sections,
      commissionRanges: {
        [roleKey]: roleCommission,
        default: roleCommission,
      },
    };
  };

  const getDefaultTerms = () => {
    const roleConfig = {
      CORPORATE: {
        title: "Corporate User Terms and Conditions",
        commissionRange: { min: 0, max: 35 },
        description:
          "As a Corporate user, you can request fleet services from B2B Partners through our platform.",
        services: [
          "Access to verified B2B Partner fleet services",
          "Quotation request and management system",
          "Contract creation and management",
          "Admin negotiation service to get better prices",
          "Secure payment processing",
          "24/7 customer support",
        ],
        commissionExplanation:
          "If you use our Admin negotiation service to get better prices from B2B Partners, a commission of 0% to 35% of the savings achieved may be charged. The exact rate will be set by Admin based on the negotiation outcome.",
      },
      B2B_PARTNER: {
        title: "B2B Partner Terms and Conditions",
        commissionRange: { min: 0, max: 35 },
        description:
          "As a B2B Partner, you can provide fleet services to Corporate clients through our platform.",
        services: [
          "Access to Corporate client requests",
          "Quotation creation and management",
          "Contract management system",
          "Fleet and driver management tools",
          "Secure payment processing",
          "Business analytics dashboard",
        ],
        commissionExplanation:
          "A commission of 0% to 35% will be charged on each contract you enter with Corporate clients through our platform. The exact rate will be set by Admin based on your partnership level and service volume.",
      },
      B2C_PARTNER: {
        title: "B2C Partner Terms and Conditions",
        commissionRange: { min: 0, max: 35 },
        description:
          "As a B2C Partner, you can provide transportation services to commuters through our platform.",
        services: [
          "Access to commuter booking requests",
          "Monthly pass management",
          "Route optimization tools",
          "Real-time booking notifications",
          "Secure payment processing",
          "Performance analytics",
        ],
        commissionExplanation:
          "A commission of 0% to 35% will be charged on each booking you accept from commuters. The exact rate will be set by Admin based on your service area and performance.",
      },
    };

    const config = roleConfig[userRole] || roleConfig.CORPORATE;

    return {
      version: "1.0.0",
      title: config.title,
      effectiveDate: new Date().toISOString(),
      userType: userRole,
      sections: [
        {
          title: "1. Service Overview",
          content: config.description,
        },
        {
          title: "2. Services Provided",
          content: `DriveMe provides the following services to ${userRole.replace("_", " ")} users:\n\n${config.services.map((s, i) => `${i + 1}. ${s}`).join("\n")}`,
        },
        {
          title: "3. Commission Structure",
          content: config.commissionExplanation,
          isHighlighted: true,
        },
        {
          title: "4. Payment Terms",
          content:
            "All payments are processed securely through our platform. Commission amounts will be automatically deducted from transactions. You will receive detailed statements of all transactions and commission charges.",
        },
        {
          title: "5. User Responsibilities",
          content:
            "You agree to:\n\n1. Provide accurate and truthful information\n2. Maintain the confidentiality of your account\n3. Comply with all applicable laws and regulations\n4. Not engage in fraudulent activities\n5. Maintain professional conduct in all interactions",
        },
        {
          title: "6. Data Privacy",
          content:
            "We are committed to protecting your privacy. Your personal and business data will be handled in accordance with our Privacy Policy. We do not sell or share your data with third parties without your consent.",
        },
        {
          title: "7. Termination",
          content:
            "Either party may terminate this agreement with 30 days written notice. Upon termination, all pending transactions will be completed and final settlements will be made within 45 days.",
        },
        {
          title: "8. Dispute Resolution",
          content:
            "Any disputes arising from the use of our services will be resolved through mediation first. If mediation fails, disputes will be settled through arbitration in accordance with applicable laws.",
        },
        {
          title: "9. Modifications",
          content:
            "DriveMe reserves the right to modify these terms with 30 days advance notice. Continued use of the platform after modifications constitutes acceptance of the new terms.",
        },
        {
          title: "10. Contact Information",
          content:
            "For any questions regarding these terms, please contact us at:\n\nEmail: support@driveme.com\nPhone: +971-XXX-XXXX\nAddress: DriveMe Headquarters",
        },
      ],
      commissionRanges: {
        [userRole.toLowerCase().replace("_", "")]: config.commissionRange,
      },
    };
  };

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    if (scrollHeight - scrollTop <= clientHeight + 50) {
      setHasScrolledToBottom(true);
    }
  };

  const toggleSection = (index) => {
    setExpandedSections((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const handleAccept = () => {
    if (onAccept) {
      onAccept({
        version: terms?.version || "1.0.0",
        acceptedAt: new Date().toISOString(),
      });
    }
  };

  if (!isOpen) return null;

  const commissionRange = terms?.commissionRanges?.[
    userRole.toLowerCase().replace("_", "")
  ] ||
    terms?.commissionRanges?.default || { min: 0, max: 35 };

  return (
    <div className="tac-modal-overlay">
      <div className="tac-modal-container">
        <div className="tac-modal-header">
          <div className="tac-header-icon">
            <FileText size={24} />
          </div>
          <div className="tac-header-content">
            <h2>{terms?.title || "Terms and Conditions"}</h2>
            <p className="tac-version">Version {terms?.version || "1.0.0"}</p>
          </div>
          <button className="tac-close-btn" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div className="tac-commission-banner">
          <AlertCircle size={20} />
          <div className="tac-commission-text">
            <strong>Commission Disclosure:</strong>
            <span>
              A commission of {commissionRange.min}% to {commissionRange.max}%
              may be charged based on your transactions and services used.
            </span>
          </div>
        </div>

        <div className="tac-modal-body" onScroll={handleScroll}>
          {loading ? (
            <div className="tac-loading">
              <div className="tac-spinner"></div>
              <p>Loading terms and conditions...</p>
            </div>
          ) : error ? (
            <div className="tac-error">
              <AlertCircle size={48} />
              <p>{error}</p>
              <button onClick={fetchTerms}>Try Again</button>
            </div>
          ) : (
            <div className="tac-content">
              {terms?.sections?.map((section, index) => (
                <div
                  key={index}
                  className={`tac-section ${section.isHighlighted ? "tac-section-highlighted" : ""}`}
                >
                  <div
                    className="tac-section-header"
                    onClick={() => toggleSection(index)}
                  >
                    <h3>{section.title}</h3>
                    {expandedSections[index] !== false ? (
                      <ChevronUp size={20} />
                    ) : (
                      <ChevronDown size={20} />
                    )}
                  </div>
                  {expandedSections[index] !== false && (
                    <div className="tac-section-content">
                      <p style={{ whiteSpace: "pre-line" }}>
                        {section.content}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="tac-modal-footer">
          <div className="tac-scroll-indicator">
            {!hasScrolledToBottom && (
              <span className="tac-scroll-hint">
                <ChevronDown size={16} />
                Scroll to read all terms
              </span>
            )}
            {hasScrolledToBottom && (
              <span className="tac-scroll-complete">
                <CheckCircle size={16} />
                You have reviewed all terms
              </span>
            )}
          </div>
          <div className="tac-footer-actions">
            <button
              className="tac-btn-cancel"
              onClick={onClose}
              disabled={isAccepting}
            >
              Cancel
            </button>
            <button
              className="tac-btn-accept"
              onClick={handleAccept}
              disabled={isAccepting}
            >
              {isAccepting ? (
                <>
                  <span className="tac-btn-spinner"></span>
                  Accepting...
                </>
              ) : (
                <>
                  <CheckCircle size={18} />I Accept the Terms
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermsAndConditionsModal;
