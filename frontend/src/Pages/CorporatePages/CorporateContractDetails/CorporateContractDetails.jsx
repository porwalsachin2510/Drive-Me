"use client";

import { getActiveCurrency } from "../../../config/localeConfig";
import { useEffect, useState, useContext } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { SocketContext } from "../../../context/SocketContext";
import {
  getContractById,
  signContract,
  corporateAcceptContract,
  corporateRejectContract,
  uploadSignedContractDocument,
  downloadContractDocument,
} from "../../../Redux/slices/contractSlice";
import {
  createPayment,
  getPaymentByContract,
} from "../../../Redux/slices/paymentSlice";
import { getPaymentScheduleByContract } from "../../../Redux/slices/paymentScheduleSlice";
import PaymentMethodSelector from "../../../Components/Corporate/PaymentMethodSelector/PaymentMethodSelector";
import PaymentScheduleSection from "../../../Components/Corporate/PaymentScheduleSection/PaymentScheduleSection";
import EMIPaymentSection from "../../../Components/Corporate/EMIPaymentSection/EMIPaymentSection";
import PaymentOptionsComparison from "../../../Components/Corporate/PaymentOptionsComparison/PaymentOptionsComparison";
import LoadingSpinner from "../../../Components/LoadingSpinner/LoadingSpinner";
import Footer from "../../../Components/Footer/Footer";
import Navbar from "../../../Components/Navbar/Navbar";
import ManagedActivityLog from "../../../Components/Corporate/ManagedActivityLog/ManagedActivityLog";
import ManagedServiceBrief from "../../../Components/Corporate/ManagedServiceBrief/ManagedServiceBrief";
  import RosterChangeRequests from "../../../Components/Corporate/RosterChangeRequests/RosterChangeRequests";
  import ExtraServiceDays from "../../../Components/Corporate/ExtraServiceDays/ExtraServiceDays";
import SOSAlertsPanel from "../../../Components/Corporate/SOSAlertsPanel/SOSAlertsPanel";
import ManagedSLADashboard from "../../../Components/Corporate/ManagedSLADashboard/ManagedSLADashboard";
import ManagedBilling from "../../../Components/Corporate/ManagedBilling/ManagedBilling";
import { syncNegotiationCommission } from "../../../services/corporateOperationsAPI";
import "./CorporateContractDetails.css";
import { notify } from "../../../utils/toast";
import {
  customerRoleLabel,
  partnerRoleLabel,
  contractStatusLabel,
} from "../../../utils/roleFamilies";

// Normalize payment method strings between DB format and code format
// DB stores: "Cash", "Credit Card", "Bank Transfer", "Mobile Wallet"
// Code uses: "CASH", "CARD", "BANK_TRANSFER", "WALLET"
const PAYMENT_METHOD_NORMALIZE = {
  Cash: "CASH",
  "Credit Card": "CARD",
  "Bank Transfer": "BANK_TRANSFER",
  "Mobile Wallet": "WALLET",
  CASH: "CASH",
  CARD: "CARD",
  BANK_TRANSFER: "BANK_TRANSFER",
  WALLET: "WALLET",
};

const normalizeMethod = (method) => PAYMENT_METHOD_NORMALIZE[method] || method;

const PAYMENT_METHOD_INFO = {
  CARD: { icon: "\uD83D\uDCB3", name: "Credit/Debit Card" },
  WALLET: { icon: "\uD83D\uDCF1", name: "Mobile Wallet" },
  BANK_TRANSFER: { icon: "\uD83C\uDFE6", name: "Bank Transfer" },
  CASH: { icon: "\uD83D\uDCB5", name: "Cash Payment" },
};

const CorporateContractDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [searchParams, setSearchParams] = useSearchParams();
  const { socket } = useContext(SocketContext) || {};

  const [activeTab, setActiveTab] = useState("commuters");
  const [showPaymentMethodModal, setShowPaymentMethodModal] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [syncingCommission, setSyncingCommission] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [statusMessage, setStatusMessage] = useState({ type: "", text: "" });

  // Get selectors FIRST before using in useEffects
  const { currentContract, loading, error } = useSelector(
    (state) => state.contract,
  );

  const {
    currentPayment,
    // eslint-disable-next-line no-unused-vars
    paymentLink,
    loading: paymentLoading,
  } = useSelector((state) => state.payment);

  const contract = currentContract?.data?.contract;
  const customerLabel = customerRoleLabel(contract?.corporateOwnerId?.role);
  const partnerLabel = partnerRoleLabel(contract?.fleetOwnerId?.role);

  useEffect(() => {
    if (id && id !== "undefined" && id !== null) {
      dispatch(getContractById({ contractId: id }));
      dispatch(getPaymentByContract({ contractId: id })).catch((error) => {
        // Payment doesn't exist yet, that's okay
        console.log("getPaymentByContract Action Error ", error);
      });

      dispatch(getPaymentScheduleByContract({ contractId: id })).catch(
        (error) => {
          // Schedule might not exist yet
          console.log("getPaymentScheduleByContract Action Error ", error);
        },
      );
    }
  }, [dispatch, id]);

  // Auto-sync negotiation commission if contract is missing it but quotation has it
  useEffect(() => {
    const checkAndSyncNegotiationCommission = async () => {
      if (!contract || syncingCommission) return;

      // Check if contract is missing negotiationCommission but quotation has completed negotiation
      const quotation = contract.quotationId;
      const hasCompletedNegotiation =
        quotation?.adminNegotiation?.status === "COMPLETED" &&
        quotation?.adminNegotiation?.negotiationId;
      const missingNegotiationCommission =
        !contract.negotiationCommission ||
        !contract.negotiationCommission.adminCommission;

      if (hasCompletedNegotiation && missingNegotiationCommission) {
        console.log(
          "[v0] Contract is missing negotiation commission, syncing...",
        );
        setSyncingCommission(true);
        try {
          const result = await syncNegotiationCommission(contract._id);
          if (result.success) {
            console.log("[v0] Negotiation commission synced successfully");
            // Refresh contract data
            dispatch(getContractById({ contractId: id }));
          }
        } catch (error) {
          console.error("[v0] Failed to sync negotiation commission:", error);
        } finally {
          setSyncingCommission(false);
        }
      }
    };

    checkAndSyncNegotiationCommission();
  }, [contract, id, dispatch, syncingCommission]);

  // Listen for real-time contract updates via socket
  useEffect(() => {
    if (!socket || !id) return;

    const handleContractUpdate = (data) => {
      console.log("[v0] Corporate received contract update:", data);
      // Refresh contract data
      dispatch(getContractById({ contractId: id }));
      dispatch(getPaymentByContract({ contractId: id }));
      dispatch(getPaymentScheduleByContract({ contractId: id }));

      // Show status message
      if (data.type === "SIGNED_DOCUMENT_VERIFIED") {
        setStatusMessage({
          type: "success",
          text:
            data.message ||
            `Your signed document has been approved! Waiting for ${partnerLabel} signature.`,
        });
      } else if (data.type === "SIGNED_DOCUMENT_REJECTED") {
        setStatusMessage({
          type: "error",
          text:
            data.message ||
            "Your signed document was rejected. Please re-upload a corrected document.",
        });
      } else if (data.type === "CONTRACT_FULLY_SIGNED") {
        setStatusMessage({
          type: "success",
          text:
            data.message ||
            "Contract is fully signed! Please proceed with payment.",
        });
      } else {
        setStatusMessage({
          type: "info",
          text: data.message || "Contract has been updated.",
        });
      }
      setTimeout(() => setStatusMessage({ type: "", text: "" }), 8000);
    };

    // Listen for contract-related events
    socket.on("signed_document_verified", handleContractUpdate);
    socket.on("signed_document_rejected", handleContractUpdate);
    socket.on("contract_fully_signed", handleContractUpdate);
    socket.on("contract_update", handleContractUpdate);
    socket.on("new-notification", (notification) => {
      if (
        notification.type?.includes("SIGNED_DOCUMENT") ||
        notification.type?.includes("CONTRACT")
      ) {
        handleContractUpdate(notification);
      }
    });

    return () => {
      socket.off("signed_document_verified", handleContractUpdate);
      socket.off("signed_document_rejected", handleContractUpdate);
      socket.off("contract_fully_signed", handleContractUpdate);
      socket.off("contract_update", handleContractUpdate);
    };
  }, [socket, id, dispatch]);

  useEffect(() => {
    if (!id) return;

    const interval = setInterval(() => {
      dispatch(getContractById({ contractId: id, silent: true }));
      dispatch(getPaymentByContract({ contractId: id, silent: true }));
      dispatch(getPaymentScheduleByContract({ contractId: id, silent: true }));
    }, 5000);

    return () => clearInterval(interval);
  }, [dispatch, id]);

  const [showSignModal, setShowSignModal] = useState(false);
  const [signature, setSignature] = useState("");
  const [showRejectContractModal, setShowRejectContractModal] = useState(false);
  const [contractRejectionReason, setContractRejectionReason] = useState("");

  // Signed document upload states
  const [signedDocumentFile, setSignedDocumentFile] = useState(null);
  const [uploadingSignedDoc, setUploadingSignedDoc] = useState(false);
  const [showUploadSignedDocModal, setShowUploadSignedDocModal] =
    useState(false);

  const handleAcceptContract = async () => {
    try {
      await dispatch(
        corporateAcceptContract({
          contractId: contract._id,
          acceptanceNotes: "Accepted by corporate owner",
        }),
      ).unwrap();
      notify("Contract accepted successfully!");
      dispatch(getContractById({ contractId: id }));
    } catch (error) {
      notify(error || "Failed to accept contract");
    }
  };

  const handleRejectContract = async () => {
    if (!contractRejectionReason.trim()) {
      notify("Please provide a reason for rejection");
      return;
    }
    try {
      await dispatch(
        corporateRejectContract({
          contractId: contract._id,
          rejectionReason: contractRejectionReason,
        }),
      ).unwrap();
      setShowRejectContractModal(false);
      setContractRejectionReason("");
      notify("Contract rejected successfully");
      dispatch(getContractById({ contractId: id }));
    } catch (error) {
      notify(error || "Failed to reject contract");
    }
  };

  const handleSignContract = async () => {
    if (!signature.trim()) {
      notify("Please enter your signature");
      return;
    }

    try {
      await dispatch(
        signContract({
          contractId: contract._id,
          signature,
          ipAddress: "0.0.0.0", // In production, get actual IP
        }),
      ).unwrap();
      setShowSignModal(false);
      setSignature("");
      notify("Contract signed successfully!");
      dispatch(getContractById({ contractId: id }));
    } catch (error) {
      notify(error || "Failed to sign contract");
    }
  };

  // Handle signed document file selection
  const handleSignedDocFileChange = (event) => {
    const file = event.target.files[0];

    if (!file) {
      setSignedDocumentFile(null);
      return;
    }

    if (file.type !== "application/pdf") {
      notify("Only PDF files are allowed for signed contract documents.");
      event.target.value = null;
      setSignedDocumentFile(null);
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      notify("File size must be less than 10MB.");
      event.target.value = null;
      setSignedDocumentFile(null);
      return;
    }

    setSignedDocumentFile(file);
  };

  // Handle upload signed document
  const handleUploadSignedDocument = async () => {
    if (!signedDocumentFile) {
      notify("Please select a signed document file first");
      return;
    }

    setUploadingSignedDoc(true);

    try {
      const formData = new FormData();
      formData.append("signedDocument", signedDocumentFile);

      await dispatch(
        uploadSignedContractDocument({ contractId: contract._id, formData }),
      ).unwrap();

      notify(
        `Signed contract document uploaded successfully! Waiting for ${partnerLabel} verification.`,
      );
      setShowUploadSignedDocModal(false);
      setSignedDocumentFile(null);
      dispatch(getContractById({ contractId: id }));
    } catch (error) {
      console.error("Upload signed document error:", error);
      notify(error || "Failed to upload signed document");
    } finally {
      setUploadingSignedDoc(false);
    }
  };

  // Handle download contract document
  const handleDownloadDocument = async (type = "original") => {
    try {
      const result = await dispatch(
        downloadContractDocument({ contractId: contract._id, type }),
      ).unwrap();

      if (result.data?.documentUrl) {
        // Open in new tab or trigger download
        const link = document.createElement("a");
        link.href = result.data.documentUrl;
        link.download =
          result.data.fileName || `contract_${contract.contractNumber}.pdf`;
        link.target = "_blank";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      console.error("Download error:", error);
      notify(error || "Failed to download document");
    }
  };

  const handleSelectPaymentMethod = async (paymentMethod) => {
    console.log("Selected payment method:", paymentMethod);
    setShowPaymentMethodModal(false);
    setProcessingPayment(true);

    try {
      let paymentType = "advance";
      if (contract.financials?.advancePayment?.paidAt) {
        paymentType = "final";
      }

      console.log("Payment type:", paymentType);

      const result = await dispatch(
        createPayment({
          contractId: contract._id,
          paymentMethod,
          paymentType,
          currency: contract.financials?.currency || getActiveCurrency(),
        }),
      ).unwrap();

      console.log("Payment creation result:", result);

      // Handle card/wallet payments - backend returns paymentSession with paymentUrl
      if (result.data?.paymentSession?.paymentUrl) {
        console.log(
          "Redirecting to payment gateway:",
          result.data.paymentSession.paymentUrl,
        );
        window.location.href = result.data.paymentSession.paymentUrl;
      } else if (paymentMethod === "BANK_TRANSFER") {
        // Bank transfer - show reference info
        const ref = result.data?.payment?.reference || "N/A";
        notify(
          `Bank Transfer Payment Created\n\nReference: ${ref}\n\nPlease complete the bank transfer and it will be verified by admin.`,
        );
        dispatch(getContractById({ contractId: id }));
        dispatch(getPaymentByContract({ contractId: id }));
      } else if (paymentMethod === "CASH") {
        // Cash payment - show reference info
        const ref = result.data?.payment?.reference || "N/A";
        notify(
          `Cash Payment Created\n\nReference: ${ref}\n\n${result.message || "Payment record created. Awaiting admin verification."}`,
        );
        dispatch(getContractById({ contractId: id }));
        dispatch(getPaymentByContract({ contractId: id }));
      } else {
        // Fallback for any other method
        notify(result.message || "Payment initiated successfully");
        dispatch(getContractById({ contractId: id }));
        dispatch(getPaymentByContract({ contractId: id }));
      }
    } catch (error) {
      console.error("Payment error:", error);
      notify(error || "Failed to initiate payment");
    } finally {
      setProcessingPayment(false);
    }
  };

  if (loading && !currentContract) {
    return (
      <div className="drivemego-corporate-contract-details-loading">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="drivemego-corporate-contract-details-error">
        <div className="drivemego-error-icon">⚠️</div>
        <h3>Error Loading Contract</h3>
        <p>{error}</p>
        <button onClick={() => navigate("/corporate-profile?tab=contracts")}>
          Back to Contracts
        </button>
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="drivemego-corporate-contract-details-error">
        <div className="drivemego-error-icon">📄</div>
        <h3>Contract Not Found</h3>
        <button onClick={() => navigate("/corporate-profile?tab=contracts")}>
          Back to Contracts
        </button>
      </div>
    );
  }

  const getStatusColor = (status) => {
    switch (status) {
      case "DRAFT":
        return "#FFA500";
      case "PENDING_CORPORATE_SIGNATURE":
        return "#2196F3";
      case "PENDING_FLEET_SIGNATURE":
        return "#9C27B0";
      case "APPROVED_PENDING_PAYMENT":
        return "#FF9800";
      case "ACTIVE":
        return "#4CAF50";
      case "COMPLETED":
        return "#00BCD4";
      case "REJECTED":
        return "#F44336";
      default:
        return "#757575";
    }
  };

  // Check payment mode - EMI mode has different payment flow
  const isEMIPaymentMode = contract.financials?.paymentMode === "EMI";
  const isAdvancePaid = !!contract.financials?.advancePayment?.paidAt;
  const isPaymentConditionMet = isEMIPaymentMode || isAdvancePaid;

  const needsPayment =
    contract.status === "PENDING_PAYMENT" &&
    (!currentPayment ||
      currentPayment.status === "FAILED" ||
      currentPayment.status === "PENDING");

  // For EMI mode, there's no "final payment" - payments are done via EMI schedule
  // For STANDARD mode, final payment is needed after advance payment
  const needsFinalPayment =
    !isEMIPaymentMode &&
    contract.status === "ACTIVE" &&
    contract.financials?.advancePayment?.paidAt &&
    !contract.financials?.finalPayment?.paidAt;

  // eslint-disable-next-line no-unused-vars
  const showMakePaymentButton = needsPayment || needsFinalPayment;

  const hasAssignedVehicles =
    contract.status === "ACTIVE" &&
    isPaymentConditionMet &&
    contract.vehicles?.some(
      (v) => v.assignedVehicles && v.assignedVehicles.length > 0,
    );

  // Managed-service contracts expose several operational areas (brief, roster,
  // safety, activity, SLA, billing). Instead of stacking them all on one endless
  // page, each area gets its own tab so the corporate user can jump straight to
  // what they need. Tabs are driven by the URL (?section=) so they are
  // deep-linkable, shareable, and work with browser back/forward.
  const isManaged = contract.serviceMode === "MANAGED";

  const contractTabs = [
    { key: "overview", label: "Overview", icon: "📋" },
    ...(isManaged
      ? [
          { key: "brief", label: "Service Brief", icon: "📝" },
          { key: "roster", label: "Roster & Routes", icon: "🔁" },
          { key: "extra-days", label: "Extra Service Days", icon: "📅" },
          { key: "safety", label: "Safety & SOS", icon: "🆘" },
          { key: "activity", label: "Operations Activity", icon: "📈" },
          { key: "sla", label: "SLA & Performance", icon: "🎯" },
          { key: "billing", label: "Operational Billing", icon: "🧾" },
        ]
      : []),
  ];

  const validTabKeys = contractTabs.map((t) => t.key);
  const requestedSection = searchParams.get("section") || "overview";
  const activeSection = validTabKeys.includes(requestedSection)
    ? requestedSection
    : "overview";

  const goToSection = (sectionKey) => {
    const params = new URLSearchParams(searchParams);
    if (sectionKey === "overview") {
      params.delete("section");
    } else {
      params.set("section", sectionKey);
    }
    setSearchParams(params);
    // Bring the newly selected tab content into view on smaller screens.
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <>
      {/* ✅ Navbar MUST be rendered */}
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
      <div className="drivemego-corporate-contract-details-container">
        <button
          className="drivemego-corporate-contract-back-btn"
          onClick={() => navigate("/corporate-profile?tab=contracts")}
        >
          ← Back to Contracts
        </button>

        <div className="drivemego-corporate-contract-header">
          <h1>Contract Details</h1>
          <span
            className="drivemego-corporate-contract-status"
            style={{ backgroundColor: getStatusColor(contract.status) }}
          >
            {contractStatusLabel(
              contract.status,
              contract.corporateOwnerId?.role,
              contract.fleetOwnerId?.role,
            )}
          </span>
        </div>

        {/* Tabbed navigation: keeps the contract essentials on "Overview" and
            gives each managed-service area its own dedicated tab. Only managed
            contracts show the extra operational tabs. */}
        {contractTabs.length > 1 && (
          <div
            className="drivemego-corporate-contract-tabs"
            role="tablist"
            aria-label="Contract sections"
          >
            {contractTabs.map((tab) => (
              <button
                key={tab.key}
                role="tab"
                aria-selected={activeSection === tab.key}
                className={`drivemego-corporate-contract-tab ${
                  activeSection === tab.key ? "active" : ""
                }`}
                onClick={() => goToSection(tab.key)}
              >
                <span
                  className="drivemego-corporate-contract-tab-icon"
                  aria-hidden="true"
                >
                  {tab.icon}
                </span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        )}

        <div className="drivemego-corporate-contract-sections">
          {/* ===== OVERVIEW TAB: contract essentials, documents, financials,
              signatures, payment & actions ===== */}
          {activeSection === "overview" && (
            <>
              {/* Fleet Owner Information */}
              <div className="drivemego-corporate-contract-section">
                <h2>{partnerLabel} Information</h2>
                <div className="drivemego-corporate-contract-info-grid">
                  <div className="drivemego-corporate-contract-info-item">
                    <span className="drivemego-label">Company Name:</span>
                    <span className="drivemego-value">
                      {contract.fleetOwnerId?.companyName ||
                        contract.fleetOwnerId?.fullName ||
                        "N/A"}
                    </span>
                  </div>
                  <div className="drivemego-corporate-contract-info-item">
                    <span className="drivemego-label">Contact Person:</span>
                    <span className="drivemego-value">
                      {contract.fleetOwnerId?.fullName || "N/A"}
                    </span>
                  </div>
                  <div className="drivemego-corporate-contract-info-item">
                    <span className="drivemego-label">Email:</span>
                    <span className="drivemego-value">
                      {contract.fleetOwnerId?.email || "N/A"}
                    </span>
                  </div>
                  <div className="drivemego-corporate-contract-info-item">
                    <span className="drivemego-label">Phone:</span>
                    <span className="drivemego-value">
                      {contract.fleetOwnerId?.whatsappNumber || "N/A"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Vehicles */}
              <div className="drivemego-corporate-contract-section">
                <h2>Vehicles ({contract.vehicles?.length || 0})</h2>
                <div className="drivemego-corporate-contract-vehicles-grid">
                  {contract.vehicles?.map((vehicle, index) => (
                    <div
                      key={index}
                      className="drivemego-corporate-contract-vehicle-card"
                    >
                      <div className="drivemego-corporate-contract-vehicle-name">
                        {vehicle.vehicleId?.vehicleName || "Unknown Vehicle"}
                      </div>
                      <div className="drivemego-corporate-contract-vehicle-details">
                        <span>
                          Category:{" "}
                          {vehicle.vehicleId?.vehicleCategory || "N/A"}
                        </span>
                        <span>Quantity: {vehicle.quantity || 0}</span>
                        <span>
                          Reg: {vehicle.vehicleId?.registrationNumber || "N/A"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ===== MANAGED SERVICE BRIEF TAB =====
              The corporate fills in its operations brief here (work locations &
              shifts, route/coverage requests, employee roster, SLA and messaging)
              that the B2B partner then executes on the corporate's behalf. */}
          {isManaged && activeSection === "brief" && (
            <div className="drivemego-corporate-contract-section">
              <ManagedServiceBrief contractId={contract._id} mode="corporate" />
            </div>
          )}

          {/* ===== ROSTER & ROUTE CHANGE REQUESTS TAB =====
              Continuous roster/route change requests (employees join, leave &
              move; routes get tweaked) raised by corporate and executed by the
              partner, then applied to the live brief on completion. */}
          {isManaged && activeSection === "roster" && (
            <div className="drivemego-corporate-contract-section">
              <RosterChangeRequests
                contractId={contract._id}
                mode="corporate"
              />
            </div>
          )}

          {/* ===== EXTRA SERVICE DAYS TAB =====
              Ad-hoc extra-day requests beyond the recurring schedule (e.g. a
              school picnic or event). The client requests; the partner approves
              with a charge and billing choice. */}
          {isManaged && activeSection === "extra-days" && (
            <div className="drivemego-corporate-contract-section">
              <ExtraServiceDays contractId={contract._id} mode="corporate" />
            </div>
          )}

          {/* ===== SAFETY & SOS ALERTS TAB =====
              Live safety / SOS alerts raised by employees during trips, visible
              to the corporate owner in real time. */}
          {isManaged && activeSection === "safety" && (
            <div className="drivemego-corporate-contract-section">
              <h2 className="drivemego-corporate-contract-section-title">
                Safety &amp; SOS Alerts
              </h2>
              <SOSAlertsPanel contractId={contract._id} />
            </div>
          )}

          {/* ===== OPERATIONS ACTIVITY TAB =====
              Operations performed by the B2B partner on behalf of corporate. */}
          {isManaged && activeSection === "activity" && (
            <div className="drivemego-corporate-contract-section">
              <ManagedActivityLog contractId={contract._id} />
            </div>
          )}

          {/* ===== SLA & PERFORMANCE TAB =====
              SLA & Performance tracking (on-time %, availability %, complaint
              resolution, breaches & penalties) computed from real operations. */}
          {isManaged && activeSection === "sla" && (
            <div className="drivemego-corporate-contract-section">
              <ManagedSLADashboard contractId={contract._id} mode="corporate" />
            </div>
          )}

          {/* ===== OPERATIONAL BILLING TAB =====
              Operation-based billing (per-trip/seat/km + management fee) with
              monthly invoices generated from real trip data. */}
          {isManaged && activeSection === "billing" && (
            <div className="drivemego-corporate-contract-section">
              <ManagedBilling contractId={contract._id} mode="corporate" />
            </div>
          )}

          {/* ===== OVERVIEW TAB (continued): documents, financials, signatures,
              payment & actions ===== */}
          {activeSection === "overview" && (
            <>
              {/* Contract Document */}
              {contract.contractDocument?.url && (
                <div className="drivemego-corporate-contract-section">
                  <h2>Contract Document</h2>
                  <div className="drivemego-corporate-contract-document">
                    <div className="drivemego-document-card">
                      <div className="drivemego-document-info">
                        <span className="drivemego-document-icon">📄</span>
                        <div className="drivemego-document-details">
                          <strong>Original Contract Document</strong>
                          <p className="drivemego-uploaded-info">
                            Uploaded on{" "}
                            {new Date(
                              contract.contractDocument.uploadedAt,
                            ).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="drivemego-document-actions">
                        <a
                          href={contract.contractDocument.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="drivemego-btn-view-doc"
                        >
                          View
                        </a>
                        <button
                          className="drivemego-btn-download-doc"
                          onClick={() => handleDownloadDocument("original")}
                        >
                          Download
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Signed Contract Document (if uploaded) */}
                  {contract.signedContractDocument?.url && (
                    <div
                      className="drivemego-corporate-contract-document"
                      style={{ marginTop: "16px" }}
                    >
                      <div className="drivemego-document-card signed-doc">
                        <div className="drivemego-document-info">
                          <span className="drivemego-document-icon">📝</span>
                          <div className="drivemego-document-details">
                            <strong>Signed Contract Document</strong>
                            <p className="drivemego-uploaded-info">
                              Uploaded on{" "}
                              {new Date(
                                contract.signedContractDocument.uploadedAt,
                              ).toLocaleDateString()}
                            </p>
                            {contract.signedDocumentVerification
                              ?.isVerified && (
                              <span className="drivemego-verification-badge drivemego-verified">
                                Verified by {partnerLabel}
                              </span>
                            )}
                            {contract.status === "PENDING_B2B_VERIFICATION" && (
                              <span className="drivemego-verification-badge drivemego-pending">
                                Pending {partnerLabel} Verification
                              </span>
                            )}
                            {contract.signedDocumentVerification
                              ?.rejectionReason && (
                              <span className="drivemego-verification-badge drivemego-rejected">
                                Rejected:{" "}
                                {
                                  contract.signedDocumentVerification
                                    .rejectionReason
                                }
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="drivemego-document-actions">
                          <a
                            href={contract.signedContractDocument.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="drivemego-btn-view-doc"
                          >
                            View
                          </a>
                          <button
                            className="drivemego-btn-download-doc"
                            onClick={() => handleDownloadDocument("signed")}
                          >
                            Download
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Upload Signed Document Section */}
              {contract.status === "PENDING_CORPORATE_SIGNATURE" &&
                contract.contractDocument?.url &&
                !contract.signedContractDocument?.url && (
                  <div className="drivemego-corporate-contract-section drivemego-upload-signed-section">
                    <h2>Upload Signed Contract</h2>
                    <div className="drivemego-upload-signed-card">
                      <div className="drivemego-upload-signed-instructions">
                        <div className="drivemego-instruction-step">
                          <span className="drivemego-step-number">1</span>
                          <div className="drivemego-step-content">
                            <strong>Download the Contract</strong>
                            <p>
                              Download the original contract document using the
                              button above.
                            </p>
                          </div>
                        </div>
                        <div className="drivemego-instruction-step">
                          <span className="drivemego-step-number">2</span>
                          <div className="drivemego-step-content">
                            <strong>Sign the Contract</strong>
                            <p>
                              Print, sign, and scan the document OR use a
                              digital signature tool to sign the PDF.
                            </p>
                          </div>
                        </div>
                        <div className="drivemego-instruction-step">
                          <span className="drivemego-step-number">3</span>
                          <div className="drivemego-step-content">
                            <strong>Upload Signed Document</strong>
                            <p>
                              Upload the signed contract document for{" "}
                              {partnerLabel} verification.
                            </p>
                          </div>
                        </div>
                      </div>
                      <button
                        className="drivemego-btn-upload-signed"
                        onClick={() => setShowUploadSignedDocModal(true)}
                      >
                        Upload Signed Contract Document
                      </button>
                    </div>
                  </div>
                )}

              {/* Status: Waiting for B2B Verification */}
              {contract.status === "PENDING_B2B_VERIFICATION" && (
                <div className="drivemego-corporate-contract-section drivemego-waiting-verification-section">
                  <div className="drivemego-waiting-verification-card">
                    <div className="drivemego-waiting-icon-large">⏳</div>
                    <h3>Waiting for {partnerLabel} Verification</h3>
                    <p>
                      Your signed contract document has been uploaded and is
                      pending verification from the {partnerLabel}. They will
                      review your signature and approve the document.
                    </p>
                    <div className="drivemego-verification-timeline">
                      <div className="drivemego-timeline-item drivemego-done">
                        <span className="drivemego-timeline-icon">1</span>
                        <span>Contract Document Received</span>
                      </div>
                      <div className="drivemego-timeline-item drivemego-done">
                        <span className="timeline-icon">2</span>
                        <span>Signed Document Uploaded</span>
                      </div>
                      <div className="drivemego-timeline-item drivemego-active">
                        <span className="drivemego-timeline-icon">3</span>
                        <span>{partnerLabel} Verification</span>
                      </div>
                      <div className="drivemego-timeline-item drivemego-pending">
                        <span className="drivemego-timeline-icon">4</span>
                        <span>{partnerLabel} Signature</span>
                      </div>
                      <div className="drivemego-timeline-item drivemego-pending">
                        <span className="drivemego-timeline-icon">5</span>
                        <span>Payment</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Financial Details */}
              <div className="drivemego-corporate-contract-section">
                <h2>Financial Details</h2>
                <div className="drivemego-corporate-contract-financials">
                  <div className="drivemego-financial-item">
                    <span className="drivemego-label">Total Amount:</span>
                    <span className="drivemego-value">
                      {contract.financials?.currency || getActiveCurrency()}{" "}
                      {contract.financials?.totalAmount?.toFixed(2) || "0.00"}
                    </span>
                  </div>

                  {contract.serviceMode === "MANAGED" && (
                    <div className="drivemego-financial-item">
                      <span className="drivemego-label">
                        Partner Management / Service Charge:
                      </span>
                      <span className="drivemego-value">
                        {contract.financials?.currency || getActiveCurrency()}{" "}
                        {contract.financials?.serviceCharge?.toFixed(2) ||
                          "0.00"}
                      </span>
                    </div>
                  )}

                  <div className="drivemego-financial-item">
                    <span className="drivemego-label">
                      Advance Payment (50%):
                    </span>
                    <span className="drivemego-value">
                      {contract.financials?.currency || getActiveCurrency()}{" "}
                      {contract.financials?.advancePayment?.amount?.toFixed(
                        2,
                      ) || "0.00"}
                      {contract.financials?.advancePayment?.paidAt && " ✓ Paid"}
                    </span>
                  </div>
                  {contract.financials?.advancePayment?.paidAt && (
                    <div className="drivemego-financial-item">
                      <span className="drivemego-label">
                        Remaining Amount (50%):
                      </span>
                      <span className="drivemego-value">
                        {contract.financials?.currency || getActiveCurrency()}{" "}
                        {contract.financials?.remainingAmount?.toFixed(2) ||
                          "0.00"}
                        {contract.financials?.finalPayment?.paidAt && " ✓ Paid"}
                      </span>
                    </div>
                  )}
                  <div className="drivemego-financial-item">
                    <span className="drivemego-label">Security Deposit:</span>
                    <span className="drivemego-value">
                      {contract.financials?.currency || getActiveCurrency()}{" "}
                      {contract.financials?.securityDeposit?.amount?.toFixed(
                        2,
                      ) || "0.00"}
                      {contract.financials?.securityDeposit?.paidAt &&
                        " ✓ Paid"}
                    </span>
                  </div>
                  {contract.financials?.paymentMode === "EMI" && (
                    <div className="drivemego-financial-item drivemego-emi-mode-badge">
                      <span className="drivemego-label">Payment Mode:</span>
                      <span className="drivemego-value drivemego-emi-value">
                        EMI (Installments)
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Payment Options - Show comparison for PENDING_PAYMENT status */}
              {contract.status === "PENDING_PAYMENT" &&
                contract.financials?.paymentMode !== "EMI" && (
                  <div className="corporate-contract-section payment-options-section">
                    <PaymentOptionsComparison
                      contract={contract}
                      onSelectStandardPayment={() =>
                        setShowPaymentMethodModal(true)
                      }
                      onRefresh={() =>
                        dispatch(getContractById({ contractId: id }))
                      }
                      processingPayment={processingPayment}
                    />
                  </div>
                )}

              {/* EMI Payment Section - Show only if EMI mode is active (user already chose EMI) */}
              {contract.financials?.paymentMode === "EMI" && (
                <div className="corporate-contract-section">
                  <h2>EMI Payment Schedule</h2>
                  <EMIPaymentSection
                    contract={contract}
                    onRefresh={() =>
                      dispatch(getContractById({ contractId: id }))
                    }
                  />
                </div>
              )}

              {/* Negotiation Commission Section - Show if contract has negotiation commission */}
              {contract.negotiationCommission &&
                contract.negotiationCommission.adminCommission > 0 && (
                  <div className="drivemego-corporate-contract-section drivemego-corporate-negotiation-commission-section">
                    <h2>Negotiation Service Fees</h2>
                    <div className="drivemego-negotiation-commission-info">
                      <p className="drivemego-commission-description">
                        A negotiation service was used to reduce your quotation
                        price. The admin commission is charged as a percentage
                        of the savings achieved.
                      </p>
                      <div className="drivemego-corporate-contract-financials">
                        <div className="drivemego-financial-item">
                          <span className="drivemego-label">
                            Original Price:
                          </span>
                          <span className="drivemego-value">
                            {contract.financials?.currency ||
                              getActiveCurrency()}{" "}
                            {contract.negotiationCommission.originalPrice?.toFixed(
                              2,
                            ) || "0.00"}
                          </span>
                        </div>
                        <div className="drivemego-financial-item highlight-savings">
                          <span className="drivemego-label">
                            Price After Negotiation:
                          </span>
                          <span className="drivemego-value">
                            {contract.financials?.currency ||
                              getActiveCurrency()}{" "}
                            {contract.financials?.totalAmount?.toFixed(2) ||
                              "0.00"}
                          </span>
                        </div>
                        <div className="drivemego-financial-item drivemego-highlight-savings">
                          <span className="drivemego-label">Your Savings:</span>
                          <span className="drivemego-value drivemego-savings-value">
                            {contract.financials?.currency ||
                              getActiveCurrency()}{" "}
                            {contract.negotiationCommission.priceSavings?.toFixed(
                              2,
                            ) || "0.00"}
                          </span>
                        </div>
                        <div className="drivemego-financial-item">
                          <span className="drivemego-label">
                            Commission Rate:
                          </span>
                          <span className="drivemego-value">
                            {contract.negotiationCommission
                              .adminCommissionRate || 25}
                            % of savings
                          </span>
                        </div>
                        <div className="drivemego-financial-item drivemego-commission-item">
                          <span className="drivemego-label">
                            Negotiation Commission:
                          </span>
                          <span className="drivemego-value">
                            {contract.financials?.currency ||
                              getActiveCurrency()}{" "}
                            {contract.negotiationCommission.adminCommission?.toFixed(
                              2,
                            ) || "0.00"}
                            <span
                              className={`drivemego-commission-status ${contract.negotiationCommission.commissionStatus?.toLowerCase()}`}
                            >
                              {contract.negotiationCommission
                                .commissionStatus === "PAID"
                                ? " ✓ Paid"
                                : " (Pending)"}
                            </span>
                          </span>
                        </div>
                        <div className="drivemego-financial-item drivemego-commission-total">
                          <span className="drivemego-label">
                            Total Payable (Price + Negotiation Fee):
                          </span>
                          <span className="drivemego-value">
                            {contract.financials?.currency ||
                              getActiveCurrency()}{" "}
                            {(
                              (contract.financials?.totalAmount || 0) +
                              (contract.negotiationCommission.adminCommission ||
                                0)
                            ).toFixed(2)}
                          </span>
                        </div>
                      </div>
                      <p className="drivemego-commission-note">
                        Note: The negotiation commission is automatically
                        deducted when you make the advance payment.
                      </p>
                    </div>
                  </div>
                )}

              {currentPayment && (
                <div className="drivemego-corporate-contract-section">
                  <h2>Payment Information</h2>
                  <div className="drivemego-corporate-contract-payment-info">
                    <div className="drivemego-payment-info-item">
                      <span className="drivemego-label">Payment Method:</span>
                      <span className="drivemego-value">
                        {currentPayment.paymentMethod?.replace(/_/g, " ")}
                      </span>
                    </div>
                    <div className="drivemego-payment-info-item">
                      <span className="drivemego-label">Payment Provider:</span>
                      <span className="drivemego-value">
                        {currentPayment.paymentProvider}
                      </span>
                    </div>
                    <div className="drivemego-payment-info-item">
                      <span className="drivemego-label">Amount Paid:</span>
                      <span className="drivemego-value">
                        {currentPayment.currency}{" "}
                        {currentPayment.amount?.toFixed(2)}
                      </span>
                    </div>
                    <div className="drivemego-payment-info-item">
                      <span className="drivemego-label">Payment Type:</span>
                      <span className="drivemego-value">
                        {currentPayment.paymentType?.toUpperCase()}
                      </span>
                    </div>
                    <div className="drivemego-payment-info-item">
                      <span className="drivemego-label">Payment Status:</span>
                      <span
                        className={`drivemego-payment-status status-${currentPayment.status?.toLowerCase()}`}
                      >
                        {currentPayment.status}
                      </span>
                    </div>
                    {currentPayment.gatewayReference && (
                      <div className="drivemego-payment-info-item">
                        <span className="drivemego-label">
                          Transaction Reference:
                        </span>
                        <span className="drivemego-value">
                          {currentPayment.gatewayReference}
                        </span>
                      </div>
                    )}
                    {currentPayment.gatewayTransactionId && (
                      <div className="drivemego-payment-info-item">
                        <span className="drivemego-label">Transaction ID:</span>
                        <span className="drivemego-value">
                          {currentPayment.gatewayTransactionId}
                        </span>
                      </div>
                    )}
                    {currentPayment.paymentMetadata?.cardLast4 && (
                      <div className="drivemego-payment-info-item">
                        <span className="drivemego-label">Card:</span>
                        <span className="drivemego-value">
                          {currentPayment.paymentMetadata.cardType || "Card"}{" "}
                          ending in {currentPayment.paymentMetadata.cardLast4}
                        </span>
                      </div>
                    )}
                    {currentPayment.verifiedAt && (
                      <div className="drivemego-payment-info-item">
                        <span className="drivemego-label">Paid On:</span>
                        <span className="drivemego-value">
                          {new Date(currentPayment.verifiedAt).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Digital Signatures */}
              <div className="drivemego-corporate-contract-section">
                <h2>Digital Signatures</h2>
                <div className="drivemego-corporate-contract-signatures">
                  <div className="drivemego-signature-status">
                    <span className="drivemego-label">{customerLabel}:</span>
                    <span
                      className={`drivemego-status ${
                        contract.digitalSignatures?.corporateOwner?.signed
                          ? "signed"
                          : "pending"
                      }`}
                    >
                      {contract.digitalSignatures?.corporateOwner?.signed
                        ? "✓ Signed"
                        : "Pending"}
                    </span>
                  </div>
                  <div className="drivemego-signature-status">
                    <span className="label">{partnerLabel}:</span>
                    <span
                      className={`drivemego-status ${
                        contract.digitalSignatures?.fleetOwner?.signed
                          ? "signed"
                          : "pending"
                      }`}
                    >
                      {contract.digitalSignatures?.fleetOwner?.signed
                        ? "✓ Signed"
                        : "Pending"}
                    </span>
                  </div>
                </div>
              </div>

              {contract.status === "DRAFT" &&
                !contract.contractDocument?.url && (
                  <div className="drivemego-corporate-contract-waiting-section">
                    <div className="drivemego-waiting-icon">⏳</div>
                    <h2>Waiting for Fleet Owner Response</h2>
                    <p>
                      Your contract request has been sent to the fleet owner.
                    </p>
                    <p>
                      The fleet owner will upload the contract document soon.
                    </p>
                    <div className="drivemego-waiting-details">
                      <div className="drivemego-waiting-info-item">
                        <span className="drivemego-label">
                          Contract Number:
                        </span>
                        <span className="drivemego-value">
                          {contract.contractNumber}
                        </span>
                      </div>
                      <div className="drivemego-waiting-info-item">
                        <span className="drivemego-label">Requested On:</span>
                        <span className="drivemego-value">
                          {new Date(contract.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="drivemego-waiting-info-item">
                        <span className="drivemego-label">Fleet Owner:</span>
                        <span className="drivemego-value">
                          {contract.fleetOwnerId?.companyName ||
                            contract.fleetOwnerId?.fullName ||
                            "N/A"}
                        </span>
                      </div>
                    </div>
                    <div className="drivemego-waiting-actions">
                      <button
                        className="drivemego-btn-secondary"
                        onClick={() =>
                          navigate("/corporate-profile?tab=contracts")
                        }
                      >
                        Back to Contracts
                      </button>
                    </div>
                  </div>
                )}

              {/* Show Accepted Payment Methods only for final payment or when EMI is already active */}
              {(needsFinalPayment ||
                (contract.status === "ACTIVE" &&
                  contract.financials?.paymentMode !== "EMI")) &&
                contract.fleetOwnerId?.acceptedPaymentMethods &&
                contract.fleetOwnerId.acceptedPaymentMethods.length > 0 && (
                  <div className="drivemego-corporate-contract-section drivemego-payment-methods-section">
                    <h2>Accepted Payment Methods</h2>
                    <p className="drivemego-payment-methods-subtitle">
                      The fleet owner accepts the following payment methods.
                      Please select one to proceed with payment.
                    </p>
                    <div className="drivemego-accepted-payment-methods">
                      {contract.fleetOwnerId.acceptedPaymentMethods.map(
                        (method) => {
                          const normalized = normalizeMethod(method);
                          const methodInfo = PAYMENT_METHOD_INFO[normalized];

                          return (
                            <div
                              key={method}
                              className="drivemego-payment-method-badge"
                            >
                              <span className="drivemego-method-icon">
                                {methodInfo?.icon || "\uD83D\uDCB0"}
                              </span>
                              <span className="drivemego-method-name">
                                {methodInfo?.name || method}
                              </span>
                            </div>
                          );
                        },
                      )}
                    </div>
                  </div>
                )}

              {/* Actions */}
              <div className="drivemego-corporate-contract-actions">
                {/* Accept/Reject for PENDING or DRAFT contracts - Only show if document has been uploaded */}
                {["PENDING", "DRAFT", "PENDING_SIGNATURES"].includes(
                  contract.status,
                ) &&
                  contract.contractDocument?.url && (
                    <>
                      <button
                        className="drivemego-corporate-contract-btn-success"
                        onClick={handleAcceptContract}
                        style={{ backgroundColor: "#4CAF50", color: "#fff" }}
                      >
                        Accept Contract
                      </button>
                      <button
                        className="drivemego-corporate-contract-btn-secondary"
                        onClick={() => setShowRejectContractModal(true)}
                        style={{ backgroundColor: "#F44336", color: "#fff" }}
                      >
                        Reject Contract
                      </button>
                    </>
                  )}

                {contract.status === "PENDING_CORPORATE_SIGNATURE" &&
                  !contract.digitalSignatures?.corporateOwner?.signed && (
                    <button
                      className="drivemego-corporate-contract-btn-primary"
                      onClick={() => setShowSignModal(true)}
                    >
                      Sign Contract
                    </button>
                  )}

                {/* Show Make Payment button only for final payment (not for initial payment where comparison is shown) */}
                {needsFinalPayment && (
                  <button
                    className="drivemego-corporate-contract-btn-success"
                    onClick={() => setShowPaymentMethodModal(true)}
                    disabled={processingPayment || paymentLoading}
                  >
                    {processingPayment || paymentLoading
                      ? "Processing..."
                      : "Make Final Payment"}
                  </button>
                )}

                {currentPayment?.status === "PENDING" &&
                  currentPayment.paymentMethod === "BANK_TRANSFER" && (
                    <div className="drivemego-payment-pending-notice">
                      <p>
                        ⏳ Your bank transfer is pending verification. Please
                        ensure payment is completed.
                      </p>
                    </div>
                  )}

                {hasAssignedVehicles && (
                  <button
                    className="drivemego-corporate-contract-btn-info"
                    onClick={() =>
                      navigate("/corporate/assigned-vehicles", {
                        state: { contractId: contract._id },
                      })
                    }
                  >
                    View Assigned Vehicles
                  </button>
                )}
              </div>

              {/* Payment Schedule Section for active contracts */}
              {(contract.status === "ACTIVE" ||
                contract.status === "PENDING_PAYMENT") && (
                <PaymentScheduleSection
                  contractId={contract._id}
                  currency={
                    contract.quotationId?.currency || getActiveCurrency()
                  }
                  contract={contract}
                />
              )}
            </>
          )}
        </div>

        {/* Sign Modal */}
        {showSignModal && (
          <div className="drivemego-corporate-contract-modal-overlay">
            <div className="drivemego-corporate-contract-modal">
              <h2>Sign Contract</h2>
              <p>Please enter your full name as your digital signature:</p>
              <input
                type="text"
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                placeholder="Enter your full name"
                className="drivemego-corporate-contract-input"
              />
              <div className="drivemego-corporate-contract-modal-actions">
                <button
                  className="drivemego-corporate-contract-btn-secondary"
                  onClick={() => setShowSignModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="drivemego-corporate-contract-btn-primary"
                  onClick={handleSignContract}
                >
                  Confirm Signature
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reject Contract Modal */}
        {showRejectContractModal && (
          <div className="drivemego-corporate-contract-modal-overlay">
            <div className="drivemego-corporate-contract-modal">
              <h2>Reject Contract</h2>
              <p>Please provide a reason for rejecting this contract:</p>
              <textarea
                value={contractRejectionReason}
                onChange={(e) => setContractRejectionReason(e.target.value)}
                placeholder="Enter rejection reason..."
                className="drivemego-corporate-contract-input"
                rows="4"
                style={{ width: "100%", resize: "vertical" }}
              />
              <div className="drivemego-corporate-contract-modal-actions">
                <button
                  className="drivemego-corporate-contract-btn-secondary"
                  onClick={() => {
                    setShowRejectContractModal(false);
                    setContractRejectionReason("");
                  }}
                >
                  Cancel
                </button>
                <button
                  className="drivemego-corporate-contract-btn-primary"
                  onClick={handleRejectContract}
                  style={{ backgroundColor: "#F44336" }}
                >
                  Confirm Rejection
                </button>
              </div>
            </div>
          </div>
        )}

        {showPaymentMethodModal && (
          <PaymentMethodSelector
            acceptedMethods={(
              contract.fleetOwnerId?.acceptedPaymentMethods || []
            ).map(normalizeMethod)}
            onSelectMethod={handleSelectPaymentMethod}
            onClose={() => setShowPaymentMethodModal(false)}
            contract={contract}
            paymentType={needsFinalPayment ? "final" : "advance"}
          />
        )}

        {/* Upload Signed Document Modal */}
        {showUploadSignedDocModal && (
          <div className="drivemego-corporate-contract-modal-overlay">
            <div className="drivemego-corporate-contract-modal drivemego-upload-signed-modal">
              <h2>Upload Signed Contract Document</h2>
              <p className="drivemego-modal-description">
                Please upload the signed contract document (PDF only, max 10MB).
                Make sure your signature is clearly visible on the document.
              </p>

              <div className="drivemego-upload-area">
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handleSignedDocFileChange}
                  id="signed-doc-input"
                  style={{ display: "none" }}
                />

                {!signedDocumentFile ? (
                  <label
                    htmlFor="signed-doc-input"
                    className="drivemego-upload-drop-zone"
                  >
                    <div className="drivemego-upload-icon">📄</div>
                    <p>Click to select signed contract PDF</p>
                    <span className="drivemego-upload-hint">
                      PDF files only, max 10MB
                    </span>
                  </label>
                ) : (
                  <div className="drivemego-selected-file-info">
                    <div className="drivemego-file-icon">📄</div>
                    <div className="drivemego-file-details">
                      <strong>{signedDocumentFile.name}</strong>
                      <span className="drivemego-file-size">
                        {(signedDocumentFile.size / 1024 / 1024).toFixed(2)} MB
                      </span>
                    </div>
                    <label
                      htmlFor="signed-doc-input"
                      className="drivemego-btn-change-file"
                    >
                      Change
                    </label>
                  </div>
                )}
              </div>

              <div className="drivemego-upload-notice">
                <strong>Important:</strong>
                <ul>
                  <li>Ensure your signature is clear and complete</li>
                  <li>All pages of the contract should be included</li>
                  <li>The document will be verified by the {partnerLabel}</li>
                </ul>
              </div>

              <div className="drivemego-corporate-contract-modal-actions">
                <button
                  className="drivemego-corporate-contract-btn-secondary"
                  onClick={() => {
                    setShowUploadSignedDocModal(false);
                    setSignedDocumentFile(null);
                  }}
                  disabled={uploadingSignedDoc}
                >
                  Cancel
                </button>
                <button
                  className="drivemego-corporate-contract-btn-primary"
                  onClick={handleUploadSignedDocument}
                  disabled={!signedDocumentFile || uploadingSignedDoc}
                >
                  {uploadingSignedDoc
                    ? "Uploading..."
                    : "Upload Signed Document"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      <Footer />
    </>
  );
};

export default CorporateContractDetails;
