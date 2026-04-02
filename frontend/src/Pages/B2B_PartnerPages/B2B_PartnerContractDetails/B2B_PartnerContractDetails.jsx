"use client";

import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  getContractById,
  uploadContractDocument,
  approveContract,
  signContract,
  assignVehicles,
  respondToDueDateExtension,
} from "../../../Redux/slices/contractSlice";
import LoadingSpinner from "../../../Components/LoadingSpinner/LoadingSpinner";
import PDFViewerModal from "../../../Components/B2B_Partner/PDFViewerModal/PDFViewerModal";
import Footer from "../../../Components/Footer/Footer";
import Navbar from "../../../Components/Navbar/Navbar";
import B2B_FleetVehicleAssignmentSection from "../../../Components/B2B_Partner/B2B_FleetVehicleAssignmentSection/B2B_FleetVehicleAssignmentSection";
import B2B_VehicleAssignmentForm from "../../../Components/B2B_Partner/B2B_VehicleAssignmentForm/B2B_VehicleAssignmentForm";
import "./B2B_PartnerContractDetails.css";

const B2B_PartnerContractDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { currentContract, loading, error } = useSelector(
    (state) => state.contract
  );

  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState("");
  const [showPDFViewer, setShowPDFViewer] = useState(false);
  const [showSignModal, setShowSignModal] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [signatureNotes, setSignatureNotes] = useState("");
  const [signature, setSignature] = useState("");
  const [userIpAddress, setUserIpAddress] = useState("");
  const [documentUrl, setDocumentUrl] = useState(null);
 const [activeTab, setActiveTab] = useState("commuters");
 const [showVehicleAssignmentForm, setShowVehicleAssignmentForm] =
    useState(false);
  const [showExtensionResponseModal, setShowExtensionResponseModal] = useState(false);
  const [extensionResponse, setExtensionResponse] = useState({
    action: "",
    responseNotes: "",
    counterOfferedDate: "",
  });
  const [processingExtension, setProcessingExtension] = useState(false);
  
  useEffect(() => {
    if (id) {
      dispatch(getContractById({ contractId: id }));
    }
  }, [dispatch, id]);

  useEffect(() => {
    if (!id) return;

    const interval = setInterval(() => {
      dispatch(getContractById({ contractId: id, silent: true })); // SAME dispatch, koi naya nahi
    }, 5000);

    return () => clearInterval(interval);
  }, [dispatch, id]);

  useEffect(() => {
    const fetchIpAddress = async () => {
      try {
        const response = await fetch("https://api.ipify.org?format=json");
        const data = await response.json();
        setUserIpAddress(data.ip);
        console.log("User IP address:", data.ip);
      } catch (error) {
        console.error("Failed to fetch IP address:", error);
        setUserIpAddress("Unknown");
      }
    };
    fetchIpAddress();
  }, []);

  useEffect(() => {
    if (currentContract && currentContract?.data?.contract?.contractDocument) {
      setDocumentUrl(currentContract?.data?.contract?.contractDocument.url);
    }
  }, [currentContract]);

  const handleFileChange = (event) => {
    const file = event.target.files[0];

    console.log("File selected:", file ? file.name : "No file");
    console.log("File type:", file ? file.type : "N/A");
    console.log(
      "File size:",
      file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : "N/A"
    );

    if (!file) {
      setUploadFile(null);
      return;
    }

    if (file.type !== "application/pdf") {
      alert("Only PDF files are allowed for contract documents.");
      event.target.value = null;
      setUploadFile(null);
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert("File size must be less than 10MB.");
      event.target.value = null;
      setUploadFile(null);
      return;
    }

    setUploadFile(file);
  };

  const handleUploadDocument = async () => {
    if (!uploadFile) {
      alert("Please select a document first");
      return;
    }

    console.log("Starting document upload...");
    console.log("Contract ID:", id);
    console.log("Upload File:", uploadFile);
    console.log("File name:", uploadFile.name);
    console.log("File type:", uploadFile.type);
    console.log("File size:", uploadFile.size, "bytes");

    setUploading(true);

    try {
      // Create FormData and append the file
      const formData = new FormData();
      formData.append("document", uploadFile);

      // Log FormData contents for debugging
      console.log("FormData created");
      console.log("FormData has document:", formData.has("document"));
      console.log(
        "FormData entries:",
        Array.from(formData.entries()).map(([key, value]) => ({
          key,
          value: value instanceof File ? `File: ${value.name}` : value,
        })),
      );

      const result = await dispatch(
        uploadContractDocument({ contractId: id, formData }),
      ).unwrap();

      console.log("Upload result:", result);

      alert("Contract document uploaded successfully!");
      setUploadFile(null);

      // Clear the file input
      const fileInput = document.getElementById("contract-file-input");
      if (fileInput) {
        fileInput.value = null;
      }

      // Refresh contract data
      dispatch(getContractById({ contractId: id }));
    } catch (error) {
      console.error("Upload error:", error);
      alert(`Failed to upload document: ${error}`);
    } finally {
      setUploading(false);
    }
  };

  const handleApproveContract = async () => {
    try {
      const result = await dispatch(
        approveContract({
          contractId: id,
          approvalNotes: approvalNotes,
        })
      ).unwrap();

      console.log("Approval result:", result);
      alert("Contract approved successfully!");
      setShowApprovalModal(false);
      setApprovalNotes("");
      dispatch(getContractById({ contractId: id }));
    } catch (error) {
      console.error("Approval error:", error);
      alert(error || "Failed to approve contract");
    }
  };

  const handleSignContract = async () => {
    if (!signature || signature.trim().length < 3) {
      alert("Please enter your full name as digital signature");
      return;
    }

    try {
      console.log("Signing contract with signature:", signature);
      console.log("IP Address:", userIpAddress);

      const result = await dispatch(
        signContract({
          contractId: id,
          signature: signature.trim(),
          ipAddress: userIpAddress,
        })
      ).unwrap();

      console.log("Sign result:", result);
      alert("Contract signed successfully!");
      setShowSignModal(false);
      setSignature("");
      dispatch(getContractById({ contractId: id }));
    } catch (error) {
      console.error("Sign error:", error);
      alert(error || "Failed to sign contract");
    }
  };

  const handleViewDocument = () => {
    console.log("Opening PDF viewer");
    setShowPDFViewer(true);
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const calculateRentalDays = (startDate, endDate) => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const handleVehicleAssignmentComplete = async (assignmentData) => {
    try {
      console.log("Vehicle assignment data:", assignmentData);
      await dispatch(
        assignVehicles({
          contractId: id,
          vehicleAssignments: assignmentData,
        })
      ).unwrap();

      alert("Vehicles assigned successfully!");
      setShowVehicleAssignmentForm(false);
      dispatch(getContractById({ contractId: id }));
    } catch (error) {
      console.error("Assignment error:", error);
      alert(error || "Failed to assign vehicles");
    }
  };

  const handleExtensionResponse = async () => {
    if (!extensionResponse.action) {
      alert("Please select an action");
      return;
    }

    if (extensionResponse.action === "COUNTER_OFFERED" && !extensionResponse.counterOfferedDate) {
      alert("Please select a counter offered date");
      return;
    }

    setProcessingExtension(true);
    try {
      await dispatch(
        respondToDueDateExtension({
          contractId: id,
          action: extensionResponse.action,
          responseNotes: extensionResponse.responseNotes,
          counterOfferedDate: extensionResponse.counterOfferedDate || undefined,
        })
      ).unwrap();

      alert(`Due date extension ${extensionResponse.action.toLowerCase().replace("_", " ")} successfully!`);
      setShowExtensionResponseModal(false);
      setExtensionResponse({ action: "", responseNotes: "", counterOfferedDate: "" });
      dispatch(getContractById({ contractId: id }));
    } catch (error) {
      console.error("Extension response error:", error);
      alert(error || "Failed to respond to extension request");
    } finally {
      setProcessingExtension(false);
    }
  };

  if (loading && !currentContract) return <LoadingSpinner />;

  // Only show error if there's no existing contract data (don't show error during background poll failures)
  if (error && !currentContract) {
    return (
      <div className="b2b-contract-details-container">
        <div className="b2b-contract-error">
          <h3>Error Loading Contract</h3>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!currentContract) {
    return (
      <div className="b2b-contract-details-container">
        <div className="b2b-contract-loading">Loading contract details...</div>
      </div>
    );
  }

  const contract =
    currentContract?.data?.contract ||
    currentContract?.contract ||
    currentContract;
  const quotation = contract.quotationId || {};
  const corporateOwner = contract.corporateOwnerId || {};
  const fleetOwner = contract.fleetOwnerId || {};
  const rentalPeriod = contract.rentalPeriod || {};
  const financials = contract.financials || {};
  const vehicles = contract.vehicles || [];
  const digitalSignatures = contract.digitalSignatures || {};
  const status = contract.status?.toUpperCase() || "DRAFT";
  const statusClass = status.toLowerCase().replace("_", "-");

  const totalVehicles = vehicles.reduce((sum, v) => sum + (v.quantity || 0), 0);
  const rentalDays = calculateRentalDays(
    rentalPeriod.startDate,
    rentalPeriod.endDate
  );

  return (
    <>
      {/* ✅ Navbar MUST be rendered */}
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
      <div className="b2b-contract-details-container">
        <button
          className="b2b-contract-back-btn"
          onClick={() => navigate("/?tab=contracts")}
        >
          ← Back to Contracts
        </button>
        <div className="b2b-contract-header">
          <div>
            <h1>Contract #{contract.contractNumber || "N/A"}</h1>
            <p>Manage contract document and approval process</p>
          </div>
          <span className={`b2b-contract-status-badge status-${statusClass}`}>
            {status.replace("_", " ")}
          </span>
        </div>
        {/* Corporate Owner Info */}
        <div className="b2b-contract-section">
          <h2>Corporate Client Information</h2>
          <div className="b2b-contract-card">
            <div className="b2b-contract-info-grid">
              <div className="b2b-contract-info-item">
                <span className="b2b-contract-label">Company Name:</span>
                <span className="b2b-contract-value">
                  {corporateOwner.companyName ||
                    corporateOwner.fullName ||
                    "N/A"}
                </span>
              </div>
              <div className="b2b-contract-info-item">
                <span className="b2b-contract-label">Email:</span>
                <span className="b2b-contract-value">
                  {corporateOwner.email || "N/A"}
                </span>
              </div>
              <div className="b2b-contract-info-item">
                <span className="b2b-contract-label">WhatsApp:</span>
                <span className="b2b-contract-value">
                  {corporateOwner.whatsappNumber || "N/A"}
                </span>
              </div>
            </div>
          </div>
        </div>
        {/* Rental Period Details */}
        <div className="b2b-contract-section">
          <h2>Rental Period</h2>
          <div className="b2b-contract-card">
            <div className="b2b-contract-info-grid">
              <div className="b2b-contract-info-item">
                <span className="b2b-contract-label">Start Date:</span>
                <span className="b2b-contract-value">
                  {formatDate(rentalPeriod.startDate)}
                </span>
              </div>
              <div className="b2b-contract-info-item">
                <span className="b2b-contract-label">End Date:</span>
                <span className="b2b-contract-value">
                  {formatDate(rentalPeriod.endDate)}
                </span>
              </div>
              <div className="b2b-contract-info-item">
                <span className="b2b-contract-label">Duration:</span>
                <span className="b2b-contract-value">
                  {rentalPeriod.duration}{" "}
                  {rentalPeriod.durationType?.toLowerCase()} ({rentalDays} days)
                </span>
              </div>
              <div className="b2b-contract-info-item">
                <span className="b2b-contract-label">Total Vehicles:</span>
                <span className="b2b-contract-value">{totalVehicles}</span>
              </div>
            </div>
          </div>
        </div>
        {/* Vehicles Information */}
        <div className="b2b-contract-section">
          <h2>
            Vehicles Requested ({vehicles.length} types, {totalVehicles} total)
          </h2>
          {vehicles.map((vehicle, index) => {
            const vehicleData = vehicle.vehicleId || {};
            const photo =
              vehicleData.photos?.[0]?.url ||
              "/placeholder.svg?height=200&width=300";

            return (
              <div
                key={vehicle._id || index}
                className="b2b-contract-card"
                style={{ marginBottom: "16px" }}
              >
                <div className="b2b-contract-vehicle-card">
                  <img
                    src={photo || "/placeholder.svg"}
                    alt={vehicleData.vehicleName}
                    className="b2b-contract-vehicle-image"
                  />
                  <div className="b2b-contract-vehicle-info">
                    <h3>{vehicleData.vehicleName || "N/A"}</h3>
                    <p className="b2b-contract-vehicle-category">
                      {vehicleData.vehicleCategory?.replace(/_/g, " ") || "N/A"}
                    </p>
                    <p className="b2b-contract-vehicle-reg">
                      Registration: {vehicleData.registrationNumber || "N/A"}
                    </p>
                    <div className="b2b-contract-vehicle-quantity">
                      <strong>Quantity:</strong> {vehicle.quantity} vehicle(s)
                    </div>
                    {vehicle.assignedVehicles &&
                      vehicle.assignedVehicles.length > 0 && (
                        <div className="b2b-contract-assigned-vehicles">
                          <strong>Assigned:</strong>{" "}
                          {vehicle.assignedVehicles.length} vehicle(s)
                        </div>
                      )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {/* Financial Summary */}
        <div className="b2b-contract-section">
          <h2>Financial Summary</h2>
          <div className="b2b-contract-card">
            <div className="b2b-contract-info-grid">
              <div className="b2b-contract-info-item">
                <span className="b2b-contract-label">Total Amount:</span>
                <span className="b2b-contract-value b2b-contract-amount">
                  KWD {financials.totalAmount?.toFixed(2) || "0.00"}
                </span>
              </div>
              <div className="b2b-contract-info-item">
                <span className="b2b-contract-label">Advance Payment:</span>
                <span className="b2b-contract-value b2b-contract-amount">
                  KWD {financials.advancePayment?.amount?.toFixed(2) || "0.00"}
                </span>
              </div>
              <div className="b2b-contract-info-item">
                <span className="b2b-contract-label">Remaining Amount:</span>
                <span className="b2b-contract-value">
                  KWD {financials.remainingAmount?.toFixed(2) || "0.00"}
                </span>
              </div>
              <div className="b2b-contract-info-item">
                <span className="b2b-contract-label">Security Deposit:</span>
                <span className="b2b-contract-value">
                  KWD {financials.securityDeposit?.amount?.toFixed(2) || "0.00"}
                </span>
              </div>
            </div>

            {/* Pricing Breakdown from Quotation */}
            {quotation.quotedPrice && (
              <div
                className="b2b-contract-pricing-breakdown"
                style={{
                  marginTop: "24px",
                  paddingTop: "24px",
                  borderTop: "2px solid #e5e7eb",
                }}
              >
                <h3 style={{ marginBottom: "16px", fontSize: "18px" }}>
                  Pricing Breakdown
                </h3>
                <div className="b2b-contract-info-grid">
                  <div className="b2b-contract-info-item">
                    <span className="b2b-contract-label">Vehicle Rental:</span>
                    <span className="b2b-contract-value">
                      KWD{" "}
                      {quotation.quotedPrice.breakdown?.vehicleRental?.toFixed(
                        2,
                      ) || "0.00"}
                    </span>
                  </div>
                  <div className="b2b-contract-info-item">
                    <span className="b2b-contract-label">Driver Charges:</span>
                    <span className="b2b-contract-value">
                      KWD{" "}
                      {quotation.quotedPrice.breakdown?.driverCharges?.toFixed(
                        2,
                      ) || "0.00"}
                    </span>
                  </div>
                  <div className="b2b-contract-info-item">
                    <span className="b2b-contract-label">Fuel Charges:</span>
                    <span className="b2b-contract-value">
                      KWD{" "}
                      {quotation.quotedPrice.breakdown?.fuelCharges?.toFixed(
                        2,
                      ) || "0.00"}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        {/* Digital Signatures Status */}
        <div className="b2b-contract-section">
          <h2>Digital Signatures</h2>
          <div className="b2b-contract-card">
            <div className="b2b-contract-info-grid">
              <div className="b2b-contract-info-item">
                <span className="b2b-contract-label">Corporate Owner:</span>
                <span
                  className={`b2b-contract-signature-status ${
                    digitalSignatures.corporateOwner?.signed
                      ? "signed"
                      : "pending"
                  }`}
                >
                  {digitalSignatures.corporateOwner?.signed
                    ? "✓ Signed"
                    : "⏳ Pending"}
                </span>
                {digitalSignatures.corporateOwner?.signedAt && (
                  <span className="b2b-contract-signature-date">
                    {formatDate(digitalSignatures.corporateOwner.signedAt)}
                  </span>
                )}
              </div>
              <div className="b2b-contract-info-item">
                <span className="b2b-contract-label">Fleet Owner:</span>
                <span
                  className={`b2b-contract-signature-status ${
                    digitalSignatures.fleetOwner?.signed ? "signed" : "pending"
                  }`}
                >
                  {digitalSignatures.fleetOwner?.signed
                    ? "✓ Signed"
                    : "⏳ Pending"}
                </span>
                {digitalSignatures.fleetOwner?.signedAt && (
                  <span className="b2b-contract-signature-date">
                    {formatDate(digitalSignatures.fleetOwner.signedAt)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        {/* Document Upload Section */}
        {status === "DRAFT" && (
          <div className="b2b-contract-section">
            <h2>Upload Contract Document</h2>
            <div className="b2b-contract-upload-card">
              <div className="b2b-contract-upload-icon">📄</div>
              <h3>Upload Contract PDF</h3>
              <p>
                Please upload the signed contract document for the corporate
                client to review and sign digitally.
              </p>

              <input
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFileChange}
                style={{ display: "none" }}
                id="contract-file-input"
              />

              {!uploadFile ? (
                <label
                  htmlFor="contract-file-input"
                  className="b2b-contract-select-file-btn"
                >
                  Select PDF File
                </label>
              ) : (
                <div className="b2b-contract-file-selected">
                  <p>
                    <strong>Selected:</strong> {uploadFile.name}
                  </p>
                  <p style={{ fontSize: "14px", color: "#6b7280" }}>
                    Size: {(uploadFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  <div className="b2b-contract-upload-actions">
                    <label
                      htmlFor="contract-file-input"
                      className="b2b-contract-change-file-btn"
                    >
                      Change File
                    </label>
                    <button
                      className="b2b-contract-upload-btn"
                      onClick={handleUploadDocument}
                      disabled={uploading}
                    >
                      {uploading ? "Uploading..." : "Upload Document"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Document Uploaded View Section */}
        {status === "PENDING_CORPORATE_SIGNATURE" && documentUrl && (
          <div className="b2b-contract-section">
            <h2>Contract Document</h2>
            <div className="b2b-contract-approval-card">
              <div className="b2b-contract-approval-icon">📄</div>
              <h3>Document Uploaded Successfully</h3>
              <p>
                The contract document has been uploaded and sent to the
                corporate client for review and digital signature.
              </p>
              <div
                className="doc-b2b-contract-signature-info"
                style={{ marginTop: "16px" }}
              >
                <p>
                  <strong>Status:</strong> Waiting for Corporate Client to Sign
                </p>
                <p style={{ marginTop: "8px" }}>
                  <strong>Contract Document:</strong>
                </p>
                <button
                  className="b2b-contract-view-btn"
                  onClick={handleViewDocument}
                  style={{ marginTop: "12px" }}
                >
                  📄 View Uploaded Document
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Approval Section */}
        {status === "CORPORATE_SIGNED" && (
          <div className="b2b-contract-section">
            <h2>Contract Approval</h2>
            <div className="b2b-contract-approval-card">
              <div className="b2b-contract-approval-icon">✍️</div>
              <h3>Corporate Client Has Signed</h3>
              <p>
                The corporate client has digitally signed the contract. Please
                review and approve to proceed.
              </p>

              {digitalSignatures.corporateOwner &&
                digitalSignatures.corporateOwner.signed && (
                  <div className="b2b-contract-signature-info">
                    <p>
                      <strong>Signed by:</strong>{" "}
                      {corporateOwner.fullName || corporateOwner.companyName}
                    </p>
                    <p>
                      <strong>Signed on:</strong>{" "}
                      {formatDate(digitalSignatures.corporateOwner.signedAt)}
                    </p>
                  </div>
                )}

              <button
                className="b2b-contract-approve-btn"
                onClick={() => setShowApprovalModal(true)}
              >
                Review & Approve Contract
              </button>
            </div>
          </div>
        )}

        {status === "ACTIVE" && (
          <B2B_FleetVehicleAssignmentSection
            contract={contract}
            onAssignmentComplete={() => setShowVehicleAssignmentForm(true)}
          />
        )}

        {/* Due Date Extension Request Section */}
        {contract.dueDateExtensionRequest?.isRequested &&
          contract.dueDateExtensionRequest?.status === "PENDING" && (
            <div className="b2b-contract-section">
              <h2>Due Date Extension Request</h2>
              <div
                className="b2b-contract-card"
                style={{ borderLeft: "4px solid #f59e0b" }}
              >
                <div className="b2b-extension-request-info">
                  <div className="b2b-extension-header">
                    <span className="b2b-extension-badge pending">
                      Pending Review
                    </span>
                    <span className="b2b-extension-date">
                      Requested on:{" "}
                      {formatDate(
                        contract.dueDateExtensionRequest.requestedDate,
                      )}
                    </span>
                  </div>

                  <div
                    className="b2b-contract-info-grid"
                    style={{ marginTop: "16px" }}
                  >
                    <div className="b2b-contract-info-item">
                      <span className="b2b-contract-label">Requested By:</span>
                      <span className="b2b-contract-value">
                        {corporateOwner.companyName ||
                          corporateOwner.fullName ||
                          "Corporate Client"}
                      </span>
                    </div>
                    <div className="b2b-contract-info-item">
                      <span className="b2b-contract-label">
                        Current Due Date:
                      </span>
                      <span className="b2b-contract-value">
                        {formatDate(financials.finalPayment?.dueDate)}
                      </span>
                    </div>
                    <div className="b2b-contract-info-item">
                      <span className="b2b-contract-label">
                        Requested New Date:
                      </span>
                      <span
                        className="b2b-contract-value"
                        style={{ color: "#f59e0b", fontWeight: "600" }}
                      >
                        {formatDate(
                          contract.dueDateExtensionRequest.newProposedDate,
                        )}
                      </span>
                    </div>
                  </div>

                  <div
                    className="b2b-extension-reason"
                    style={{
                      marginTop: "16px",
                      padding: "16px",
                      background: "#fffbeb",
                      borderRadius: "8px",
                    }}
                  >
                    <span className="b2b-contract-label">
                      Reason for Extension:
                    </span>
                    <p style={{ margin: "8px 0 0 0", color: "#1a1a1a" }}>
                      {contract.dueDateExtensionRequest.reason}
                    </p>
                  </div>

                  <div
                    className="b2b-extension-actions"
                    style={{ marginTop: "20px", display: "flex", gap: "12px" }}
                  >
                    <button
                      className="b2b-contract-btn-primary"
                      onClick={() => {
                        setExtensionResponse({
                          action: "APPROVED",
                          responseNotes: "",
                          counterOfferedDate: "",
                        });
                        setShowExtensionResponseModal(true);
                      }}
                      style={{ backgroundColor: "#10b981" }}
                    >
                      Approve Extension
                    </button>
                    <button
                      className="b2b-contract-btn-primary"
                      onClick={() => {
                        setExtensionResponse({
                          action: "COUNTER_OFFERED",
                          responseNotes: "",
                          counterOfferedDate: "",
                        });
                        setShowExtensionResponseModal(true);
                      }}
                      style={{ backgroundColor: "#f59e0b" }}
                    >
                      Counter Offer
                    </button>
                    <button
                      className="b2b-contract-btn-secondary"
                      onClick={() => {
                        setExtensionResponse({
                          action: "REJECTED",
                          responseNotes: "",
                          counterOfferedDate: "",
                        });
                        setShowExtensionResponseModal(true);
                      }}
                      style={{ backgroundColor: "#ef4444", color: "#fff" }}
                    >
                      Reject Request
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

        {/* Digital Signature Required Section */}
        {status === "PENDING_FLEET_SIGNATURE" &&
          !digitalSignatures.fleetOwner?.signed && (
            <div className="b2b-contract-section">
              <h2>Digital Signature Required</h2>
              <div className="b2b-contract-approval-card">
                <div className="b2b-contract-approval-icon">✍️</div>
                <h3>Sign the Contract</h3>
                <p>
                  The corporate client has signed the contract. Please review
                  the contract document and add your digital signature to
                  proceed.
                </p>

                {documentUrl && (
                  <div
                    className="doc-b2b-contract-signature-info"
                    style={{ marginTop: "16px" }}
                  >
                    <p>
                      <strong>Contract Document:</strong>
                    </p>
                    <button
                      className="b2b-contract-view-btn"
                      onClick={handleViewDocument}
                    >
                      📄 View Contract Document
                    </button>
                  </div>
                )}

                {digitalSignatures.corporateOwner &&
                  digitalSignatures.corporateOwner.signed && (
                    <div className="b2b-contract-signature-info">
                      <p>
                        <strong>Corporate signed by:</strong>{" "}
                        {corporateOwner.fullName || corporateOwner.companyName}
                      </p>
                      <p>
                        <strong>Signed on:</strong>{" "}
                        {formatDate(digitalSignatures.corporateOwner.signedAt)}
                      </p>
                    </div>
                  )}

                <button
                  className="b2b-contract-approve-btn"
                  onClick={() => setShowSignModal(true)}
                >
                  ✍️ Sign Contract Digitally
                </button>
              </div>
            </div>
          )}

        {/* Sign Section */}
        {status === "APPROVED" && (
          <div className="b2b-contract-section">
            <h2>Sign Contract</h2>
            <div className="b2b-contract-sign-card">
              <div className="b2b-contract-sign-icon">✍️</div>
              <h3>Fleet Owner Signing</h3>
              <p>Please sign the contract to finalize the process.</p>

              {digitalSignatures.fleetOwner &&
                digitalSignatures.fleetOwner.signed && (
                  <div className="b2b-contract-signature-info">
                    <p>
                      <strong>Signed by:</strong>{" "}
                      {fleetOwner.fullName || fleetOwner.companyName}
                    </p>
                    <p>
                      <strong>Signed on:</strong>{" "}
                      {formatDate(digitalSignatures.fleetOwner.signedAt)}
                    </p>
                  </div>
                )}

              <button
                className="b2b-contract-sign-btn"
                onClick={() => setShowSignModal(true)}
              >
                Sign Contract
              </button>
            </div>
          </div>
        )}
        {/* Notes Section */}
        {contract.notes && contract.notes.length > 0 && (
          <div className="b2b-contract-section">
            <h2>Notes</h2>
            <div className="b2b-contract-card">
              {contract.notes.map((note, index) => (
                <div
                  key={note._id || index}
                  className="b2b-contract-note"
                  style={{
                    marginBottom: "12px",
                    padding: "12px",
                    background: "#f9fafb",
                    borderRadius: "8px",
                  }}
                >
                  <p style={{ margin: "0 0 8px 0", color: "#111827" }}>
                    {note.message}
                  </p>
                  <small style={{ color: "#6b7280" }}>
                    {formatDate(note.createdAt)}
                  </small>
                </div>
              ))}
            </div>
          </div>
        )}
        {/* Approval Modal */}
        {showApprovalModal && (
          <div
            className="b2b-contract-modal-overlay"
            onClick={() => setShowApprovalModal(false)}
          >
            <div
              className="b2b-contract-modal-content"
              onClick={(e) => e.stopPropagation()}
            >
              <h2>Approve Contract</h2>
              <p>
                Are you sure you want to approve this contract? This action
                cannot be undone.
              </p>

              <div className="b2b-contract-form-group">
                <label>Approval Notes (Optional)</label>
                <textarea
                  value={approvalNotes}
                  onChange={(e) => setApprovalNotes(e.target.value)}
                  placeholder="Add any notes or comments..."
                  rows={4}
                />
              </div>

              <div className="b2b-contract-modal-actions">
                <button
                  className="b2b-contract-btn-secondary"
                  onClick={() => setShowApprovalModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="b2b-contract-btn-primary"
                  onClick={handleApproveContract}
                >
                  Approve Contract
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Sign Modal */}
        {showSignModal && (
          <div
            className="b2b-contract-modal-overlay"
            onClick={() => setShowSignModal(false)}
          >
            <div
              className="b2b-contract-modal-content"
              onClick={(e) => e.stopPropagation()}
            >
              <h2>Digital Signature</h2>
              <p>
                By signing this contract, you agree to all terms and conditions
                outlined in the contract document.
              </p>

              <div className="b2b-contract-signature-notice">
                <p>
                  <strong>⚠️ Important:</strong>
                </p>
                <ul>
                  <li>This digital signature is legally binding</li>
                  <li>
                    You confirm that you have reviewed the contract document
                  </li>
                  <li>Your IP address ({userIpAddress}) will be recorded</li>
                  <li>This action cannot be undone</li>
                </ul>
              </div>

              <div className="b2b-contract-form-group">
                <label>Full Name (Digital Signature) *</label>
                <input
                  type="text"
                  value={signature}
                  onChange={(e) => setSignature(e.target.value)}
                  placeholder="Enter your full name..."
                  className="b2b-contract-signature-input"
                />
                <small>
                  Type your full legal name as it appears on official documents
                </small>
              </div>

              <div className="b2b-contract-signature-preview">
                <p>Signature Preview:</p>
                <div className="b2b-contract-signature-display">
                  {signature || "Your signature will appear here"}
                </div>
              </div>

              <div className="b2b-contract-modal-actions">
                <button
                  className="b2b-contract-btn-secondary"
                  onClick={() => setShowSignModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="b2b-contract-btn-primary"
                  onClick={handleSignContract}
                  disabled={!signature || signature.trim().length < 3}
                >
                  ✍️ Sign Contract
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Vehicle Assignment Form Modal */}
        {showVehicleAssignmentForm && (
          <div
            className="b2b-contract-modal-overlay"
            onClick={() => setShowVehicleAssignmentForm(false)}
          >
            <div
              className="b2b-contract-modal-content-large"
              onClick={(e) => e.stopPropagation()}
            >
              <B2B_VehicleAssignmentForm
                contract={contract}
                onComplete={handleVehicleAssignmentComplete}
                onCancel={() => setShowVehicleAssignmentForm(false)}
              />
            </div>
          </div>
        )}

        {/* PDF Viewer Modal */}
        {showPDFViewer && documentUrl && (
          <PDFViewerModal
            contractId={id}
            pdfUrl={documentUrl}
            onClose={() => setShowPDFViewer(false)}
          />
        )}

        {/* Due Date Extension Response Modal */}
        {showExtensionResponseModal && (
          <div
            className="b2b-contract-modal-overlay"
            onClick={() => setShowExtensionResponseModal(false)}
          >
            <div
              className="b2b-contract-modal-content"
              onClick={(e) => e.stopPropagation()}
            >
              <h2>
                {extensionResponse.action === "APPROVED" &&
                  "Approve Due Date Extension"}
                {extensionResponse.action === "REJECTED" &&
                  "Reject Due Date Extension"}
                {extensionResponse.action === "COUNTER_OFFERED" &&
                  "Counter Offer Due Date"}
              </h2>

              {extensionResponse.action === "APPROVED" && (
                <p style={{ marginBottom: "16px" }}>
                  By approving, the final payment due date will be changed to{" "}
                  <strong>
                    {formatDate(
                      contract.dueDateExtensionRequest?.newProposedDate,
                    )}
                  </strong>
                  .
                </p>
              )}

              {extensionResponse.action === "REJECTED" && (
                <p style={{ marginBottom: "16px", color: "#ef4444" }}>
                  The corporate client will be notified that their request has
                  been rejected. The original due date will remain unchanged.
                </p>
              )}

              {extensionResponse.action === "COUNTER_OFFERED" && (
                <>
                  <p style={{ marginBottom: "16px" }}>
                    You can offer a different date than what the corporate
                    client requested.
                  </p>
                  <div className="b2b-contract-form-group">
                    <label>Counter Offer Date *</label>
                    <input
                      type="date"
                      value={extensionResponse.counterOfferedDate}
                      onChange={(e) =>
                        setExtensionResponse({
                          ...extensionResponse,
                          counterOfferedDate: e.target.value,
                        })
                      }
                      min={new Date().toISOString().split("T")[0]}
                      style={{
                        width: "100%",
                        padding: "12px",
                        borderRadius: "8px",
                        border: "2px solid #e5e7eb",
                      }}
                    />
                  </div>
                </>
              )}

              <div className="b2b-contract-form-group">
                <label>
                  Response Notes{" "}
                  {extensionResponse.action === "REJECTED"
                    ? "(Required)"
                    : "(Optional)"}
                </label>
                <textarea
                  value={extensionResponse.responseNotes}
                  onChange={(e) =>
                    setExtensionResponse({
                      ...extensionResponse,
                      responseNotes: e.target.value,
                    })
                  }
                  placeholder={
                    extensionResponse.action === "APPROVED"
                      ? "Add any notes for the corporate client..."
                      : extensionResponse.action === "REJECTED"
                        ? "Please explain why you're rejecting the request..."
                        : "Explain the counter offer..."
                  }
                  rows={4}
                />
              </div>

              <div className="b2b-contract-modal-actions">
                <button
                  className="b2b-contract-btn-secondary"
                  onClick={() => {
                    setShowExtensionResponseModal(false);
                    setExtensionResponse({
                      action: "",
                      responseNotes: "",
                      counterOfferedDate: "",
                    });
                  }}
                  disabled={processingExtension}
                >
                  Cancel
                </button>
                <button
                  className="b2b-contract-btn-primary"
                  onClick={handleExtensionResponse}
                  disabled={processingExtension}
                  style={{
                    backgroundColor:
                      extensionResponse.action === "APPROVED"
                        ? "#10b981"
                        : extensionResponse.action === "REJECTED"
                          ? "#ef4444"
                          : "#f59e0b",
                  }}
                >
                  {processingExtension
                    ? "Processing..."
                    : extensionResponse.action === "APPROVED"
                      ? "Confirm Approval"
                      : extensionResponse.action === "REJECTED"
                        ? "Confirm Rejection"
                        : "Send Counter Offer"}
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

export default B2B_PartnerContractDetails;
