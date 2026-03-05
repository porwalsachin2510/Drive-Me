"use client";

import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  getContractById,
  signContract,
  corporateAcceptContract,
  corporateRejectContract,
} from "../../../Redux/slices/contractSlice";
import {
  createPayment,
  getPaymentByContract
} from "../../../Redux/slices/paymentSlice";
import { getPaymentScheduleByContract } from "../../../Redux/slices/paymentScheduleSlice";
import PaymentMethodSelector from "../../../Components/Corporate/PaymentMethodSelector/PaymentMethodSelector";
import PaymentScheduleSection from "../../../Components/Corporate/PaymentScheduleSection/PaymentScheduleSection";
import LoadingSpinner from "../../../Components/LoadingSpinner/LoadingSpinner";
import Footer from "../../../Components/Footer/Footer";
import Navbar from "../../../Components/Navbar/Navbar";
import "./CorporateContractDetails.css";

// Normalize payment method strings between DB format and code format
// DB stores: "Cash", "Credit Card", "Bank Transfer", "Mobile Wallet"
// Code uses: "CASH", "CARD", "BANK_TRANSFER", "WALLET"
const PAYMENT_METHOD_NORMALIZE = {
  "Cash": "CASH",
  "Credit Card": "CARD",
  "Bank Transfer": "BANK_TRANSFER",
  "Mobile Wallet": "WALLET",
  "CASH": "CASH",
  "CARD": "CARD",
  "BANK_TRANSFER": "BANK_TRANSFER",
  "WALLET": "WALLET",
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

  const [activeTab, setActiveTab] = useState("commuters");
    const [showPaymentMethodModal, setShowPaymentMethodModal] = useState(false);
    const [processingPayment, setProcessingPayment] = useState(false);

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

  useEffect(() => {
    if (!id) return;

    const interval = setInterval(() => {
      dispatch(getContractById({ contractId: id, silent: true }));
      dispatch(getPaymentByContract({ contractId: id, silent: true }));
      dispatch(getPaymentScheduleByContract({ contractId: id, silent: true }));
    }, 5000);

    return () => clearInterval(interval);
  }, [dispatch, id]);


  const { currentContract, loading, error } = useSelector(
    (state) => state.contract
  );

  const {
    currentPayment,
    // eslint-disable-next-line no-unused-vars
    paymentLink,
    loading: paymentLoading,
  } = useSelector((state) => state.payment);

  const contract = currentContract?.data?.contract;

  console.log("CorporateContractDetails - Contract:", contract);
  console.log("CorporateContractDetails - Payment:", currentPayment);


  const [showSignModal, setShowSignModal] = useState(false);
  const [signature, setSignature] = useState("");
  const [showRejectContractModal, setShowRejectContractModal] = useState(false);
  const [contractRejectionReason, setContractRejectionReason] = useState("");
  

  

  const handleAcceptContract = async () => {
    try {
      await dispatch(
        corporateAcceptContract({
          contractId: contract._id,
          acceptanceNotes: "Accepted by corporate owner",
        })
      ).unwrap();
      alert("Contract accepted successfully!");
      dispatch(getContractById({ contractId: id }));
    } catch (error) {
      alert(error || "Failed to accept contract");
    }
  };

  const handleRejectContract = async () => {
    if (!contractRejectionReason.trim()) {
      alert("Please provide a reason for rejection");
      return;
    }
    try {
      await dispatch(
        corporateRejectContract({
          contractId: contract._id,
          rejectionReason: contractRejectionReason,
        })
      ).unwrap();
      setShowRejectContractModal(false);
      setContractRejectionReason("");
      alert("Contract rejected successfully");
      dispatch(getContractById({ contractId: id }));
    } catch (error) {
      alert(error || "Failed to reject contract");
    }
  };

  const handleSignContract = async () => {
    if (!signature.trim()) {
      alert("Please enter your signature");
      return;
    }

    try {
      await dispatch(
        signContract({
          contractId: contract._id,
          signature,
          ipAddress: "0.0.0.0", // In production, get actual IP
        })
      ).unwrap();
      setShowSignModal(false);
      setSignature("");
      alert("Contract signed successfully!");
      dispatch(getContractById({ contractId: id }));
    } catch (error) {
      alert(error || "Failed to sign contract");
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
           currency: contract.financials?.currency || "AED",
         })
       ).unwrap();

       console.log("Payment creation result:", result);

       // Handle card/wallet payments - backend returns paymentSession with paymentUrl
       if (result.data?.paymentSession?.paymentUrl) {
         console.log("Redirecting to payment gateway:", result.data.paymentSession.paymentUrl);
         window.location.href = result.data.paymentSession.paymentUrl;
       } else if (paymentMethod === "BANK_TRANSFER") {
         // Bank transfer - show reference info
         const ref = result.data?.payment?.reference || "N/A";
         alert(
           `Bank Transfer Payment Created\n\nReference: ${ref}\n\nPlease complete the bank transfer and it will be verified by admin.`
         );
         dispatch(getContractById({ contractId: id }));
         dispatch(getPaymentByContract({ contractId: id }));
       } else if (paymentMethod === "CASH") {
         // Cash payment - show reference info
         const ref = result.data?.payment?.reference || "N/A";
         alert(
           `Cash Payment Created\n\nReference: ${ref}\n\n${result.message || "Payment record created. Awaiting admin verification."}`
         );
         dispatch(getContractById({ contractId: id }));
         dispatch(getPaymentByContract({ contractId: id }));
       } else {
         // Fallback for any other method
         alert(result.message || "Payment initiated successfully");
         dispatch(getContractById({ contractId: id }));
         dispatch(getPaymentByContract({ contractId: id }));
       }
     } catch (error) {
       console.error("Payment error:", error);
       alert(error || "Failed to initiate payment");
     } finally {
       setProcessingPayment(false);
     }
  };
  


  if (loading && !currentContract) {
    return (
      <div className="corporate-contract-details-loading">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="corporate-contract-details-error">
        <div className="error-icon">⚠️</div>
        <h3>Error Loading Contract</h3>
        <p>{error}</p>
        <button onClick={() => navigate("/corporate/contracts")}>
          Back to Contracts
        </button>
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="corporate-contract-details-error">
        <div className="error-icon">📄</div>
        <h3>Contract Not Found</h3>
        <button onClick={() => navigate("/corporate/contracts")}>
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

    const needsPayment =
      contract.status === "PENDING_PAYMENT" &&
      (!currentPayment ||
        currentPayment.status === "FAILED" ||
        currentPayment.status === "PENDING");

    const needsFinalPayment =
      contract.status === "ACTIVE" &&
      contract.financials?.advancePayment?.paidAt &&
      !contract.financials?.finalPayment?.paidAt;

    const showMakePaymentButton = needsPayment || needsFinalPayment;
  
   const hasAssignedVehicles =
     contract.status === "ACTIVE" &&
     contract.financials?.advancePayment?.paidAt &&
     contract.vehicles?.some(
       (v) => v.assignedVehicles && v.assignedVehicles.length > 0
    );
  
  return (
    <>
      {/* ✅ Navbar MUST be rendered */}
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
      <div className="corporate-contract-details-container">
        <button
          className="corporate-contract-back-btn"
          onClick={() => navigate("/corporate/contracts")}
        >
          ← Back to Contracts
        </button>

        <div className="corporate-contract-header">
          <h1>Contract Details</h1>
          <span
            className="corporate-contract-status"
            style={{ backgroundColor: getStatusColor(contract.status) }}
          >
            {contract.status.replace(/_/g, " ")}
          </span>
        </div>

        <div className="corporate-contract-sections">
          {/* Fleet Owner Information */}
          <div className="corporate-contract-section">
            <h2>Fleet Owner Information</h2>
            <div className="corporate-contract-info-grid">
              <div className="corporate-contract-info-item">
                <span className="label">Company Name:</span>
                <span className="value">
                  {contract.fleetOwnerId?.companyName ||
                    contract.fleetOwnerId?.fullName ||
                    "N/A"}
                </span>
              </div>
              <div className="corporate-contract-info-item">
                <span className="label">Contact Person:</span>
                <span className="value">
                  {contract.fleetOwnerId?.fullName || "N/A"}
                </span>
              </div>
              <div className="corporate-contract-info-item">
                <span className="label">Email:</span>
                <span className="value">
                  {contract.fleetOwnerId?.email || "N/A"}
                </span>
              </div>
              <div className="corporate-contract-info-item">
                <span className="label">Phone:</span>
                <span className="value">
                  {contract.fleetOwnerId?.whatsappNumber || "N/A"}
                </span>
              </div>
            </div>
          </div>

          {/* Vehicles */}
          <div className="corporate-contract-section">
            <h2>Vehicles ({contract.vehicles?.length || 0})</h2>
            <div className="corporate-contract-vehicles-grid">
              {contract.vehicles?.map((vehicle, index) => (
                <div key={index} className="corporate-contract-vehicle-card">
                  <div className="corporate-contract-vehicle-name">
                    {vehicle.vehicleId?.vehicleName || "Unknown Vehicle"}
                  </div>
                  <div className="corporate-contract-vehicle-details">
                    <span>
                      Category: {vehicle.vehicleId?.vehicleCategory || "N/A"}
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

          {/* Contract Document */}
          {contract.contractDocument?.url && (
            <div className="corporate-contract-section">
              <h2>Contract Document</h2>
              <div className="corporate-contract-document">
                <a
                  href={contract.contractDocument.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  📄 View Contract Document
                </a>
                <p className="uploaded-info">
                  Uploaded on{" "}
                  {new Date(
                    contract.contractDocument.uploadedAt
                  ).toLocaleDateString()}
                </p>
              </div>
            </div>
          )}

          {/* Financial Details */}
          <div className="corporate-contract-section">
            <h2>Financial Details</h2>
            <div className="corporate-contract-financials">
              <div className="financial-item">
                <span className="label">Total Amount:</span>
                <span className="value">
                  {contract.quotationId?.currency || "KWD"}{" "}
                  {contract.financials?.totalAmount?.toFixed(2) || "0.00"}
                </span>
              </div>
              <div className="financial-item">
                <span className="label">Advance Payment (50%):</span>
                <span className="value">
                  {contract.quotationId?.currency || "KWD"}{" "}
                  {contract.financials?.advancePayment?.amount?.toFixed(2) ||
                    "0.00"}
                  {contract.financials?.advancePayment?.paidAt && " ✓ Paid"}
                </span>
              </div>
              {contract.financials?.advancePayment?.paidAt && (
                <div className="financial-item">
                  <span className="label">Remaining Amount (50%):</span>
                  <span className="value">
                    {contract.quotationId?.currency || "KWD"}{" "}
                    {contract.financials?.remainingAmount?.toFixed(2) || "0.00"}
                    {contract.financials?.finalPayment?.paidAt && " ✓ Paid"}
                  </span>
                </div>
              )}
              <div className="financial-item">
                <span className="label">Security Deposit:</span>
                <span className="value">
                  {contract.quotationId?.currency || "KWD"}{" "}
                  {contract.financials?.securityDeposit?.amount?.toFixed(2) ||
                    "0.00"}
                  {contract.financials?.securityDeposit?.paidAt && " ✓ Paid"}
                </span>
              </div>
            </div>
          </div>

          {currentPayment && (
            <div className="corporate-contract-section">
              <h2>Payment Information</h2>
              <div className="corporate-contract-payment-info">
                <div className="payment-info-item">
                  <span className="label">Payment Method:</span>
                  <span className="value">
                    {currentPayment.paymentMethod?.replace(/_/g, " ")}
                  </span>
                </div>
                <div className="payment-info-item">
                  <span className="label">Payment Provider:</span>
                  <span className="value">
                    {currentPayment.paymentProvider}
                  </span>
                </div>
                <div className="payment-info-item">
                  <span className="label">Amount Paid:</span>
                  <span className="value">
                    {currentPayment.currency}{" "}
                    {currentPayment.amount?.toFixed(2)}
                  </span>
                </div>
                <div className="payment-info-item">
                  <span className="label">Payment Type:</span>
                  <span className="value">
                    {currentPayment.paymentType?.toUpperCase()}
                  </span>
                </div>
                <div className="payment-info-item">
                  <span className="label">Payment Status:</span>
                  <span
                    className={`payment-status status-${currentPayment.status?.toLowerCase()}`}
                  >
                    {currentPayment.status}
                  </span>
                </div>
                {currentPayment.gatewayReference && (
                  <div className="payment-info-item">
                    <span className="label">Transaction Reference:</span>
                    <span className="value">
                      {currentPayment.gatewayReference}
                    </span>
                  </div>
                )}
                {currentPayment.gatewayTransactionId && (
                  <div className="payment-info-item">
                    <span className="label">Transaction ID:</span>
                    <span className="value">
                      {currentPayment.gatewayTransactionId}
                    </span>
                  </div>
                )}
                {currentPayment.paymentMetadata?.cardLast4 && (
                  <div className="payment-info-item">
                    <span className="label">Card:</span>
                    <span className="value">
                      {currentPayment.paymentMetadata.cardType || "Card"} ending
                      in {currentPayment.paymentMetadata.cardLast4}
                    </span>
                  </div>
                )}
                {currentPayment.verifiedAt && (
                  <div className="payment-info-item">
                    <span className="label">Paid On:</span>
                    <span className="value">
                      {new Date(currentPayment.verifiedAt).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Digital Signatures */}
          <div className="corporate-contract-section">
            <h2>Digital Signatures</h2>
            <div className="corporate-contract-signatures">
              <div className="signature-status">
                <span className="label">Corporate Owner:</span>
                <span
                  className={`status ${
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
              <div className="signature-status">
                <span className="label">Fleet Owner:</span>
                <span
                  className={`status ${
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

          {contract.status === "DRAFT" && !contract.contractDocument?.url && (
            <div className="corporate-contract-waiting-section">
              <div className="waiting-icon">⏳</div>
              <h2>Waiting for Fleet Owner Response</h2>
              <p>Your contract request has been sent to the fleet owner.</p>
              <p>The fleet owner will upload the contract document soon.</p>
              <div className="waiting-details">
                <div className="waiting-info-item">
                  <span className="label">Contract Number:</span>
                  <span className="value">{contract.contractNumber}</span>
                </div>
                <div className="waiting-info-item">
                  <span className="label">Requested On:</span>
                  <span className="value">
                    {new Date(contract.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="waiting-info-item">
                  <span className="label">Fleet Owner:</span>
                  <span className="value">
                    {contract.fleetOwnerId?.companyName ||
                      contract.fleetOwnerId?.fullName ||
                      "N/A"}
                  </span>
                </div>
              </div>
              <div className="waiting-actions">
                <button
                  className="btn-secondary"
                  onClick={() => navigate("/corporate/contracts")}
                >
                  Back to Contracts
                </button>
              </div>
            </div>
          )}

          {showMakePaymentButton &&
            contract.fleetOwnerId?.acceptedPaymentMethods &&
            contract.fleetOwnerId.acceptedPaymentMethods.length > 0 && (
              <div className="corporate-contract-section payment-methods-section">
                <h2>Accepted Payment Methods</h2>
                <p className="payment-methods-subtitle">
                  The fleet owner accepts the following payment methods. Please
                  select one to proceed with payment.
                </p>
                <div className="accepted-payment-methods">
                  {contract.fleetOwnerId.acceptedPaymentMethods.map(
                    (method) => {
                      const normalized = normalizeMethod(method);
                      const methodInfo = PAYMENT_METHOD_INFO[normalized];

                      return (
                        <div key={method} className="payment-method-badge">
                          <span className="method-icon">
                            {methodInfo?.icon || "\uD83D\uDCB0"}
                          </span>
                          <span className="method-name">
                            {methodInfo?.name || method}
                          </span>
                        </div>
                      );
                    }
                  )}
                </div>
              </div>
            )}

          {/* Actions */}
          <div className="corporate-contract-actions">
            {/* Accept/Reject for PENDING or DRAFT contracts */}
            {["PENDING", "DRAFT", "PENDING_SIGNATURES"].includes(contract.status) && (
              <>
                <button
                  className="corporate-contract-btn-success"
                  onClick={handleAcceptContract}
                  style={{ backgroundColor: "#4CAF50", color: "#fff" }}
                >
                  Accept Contract
                </button>
                <button
                  className="corporate-contract-btn-secondary"
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
                  className="corporate-contract-btn-primary"
                  onClick={() => setShowSignModal(true)}
                >
                  Sign Contract
                </button>
              )}

            {showMakePaymentButton && (
              <button
                className="corporate-contract-btn-success"
                onClick={() => setShowPaymentMethodModal(true)}
                disabled={processingPayment || paymentLoading}
              >
                {processingPayment || paymentLoading
                  ? "Processing..."
                  : "Make Payment"}
              </button>
            )}

            {currentPayment?.status === "PENDING" &&
              currentPayment.paymentMethod === "BANK_TRANSFER" && (
                <div className="payment-pending-notice">
                  <p>
                    ⏳ Your bank transfer is pending verification. Please ensure
                    payment is completed.
                  </p>
                </div>
              )}
            
            {hasAssignedVehicles && (
              <button
                className="corporate-contract-btn-info"
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
          {/* Payment Schedule Section for active contracts */}
          {(contract.status === "ACTIVE" ||
            contract.status === "PENDING_PAYMENT") && (
            <PaymentScheduleSection
              contractId={contract._id}
              currency={contract.quotationId?.currency || "AED"}
            />
          )}
        </div>

        {/* Sign Modal */}
        {showSignModal && (
          <div className="corporate-contract-modal-overlay">
            <div className="corporate-contract-modal">
              <h2>Sign Contract</h2>
              <p>Please enter your full name as your digital signature:</p>
              <input
                type="text"
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                placeholder="Enter your full name"
                className="corporate-contract-input"
              />
              <div className="corporate-contract-modal-actions">
                <button
                  className="corporate-contract-btn-secondary"
                  onClick={() => setShowSignModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="corporate-contract-btn-primary"
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
          <div className="corporate-contract-modal-overlay">
            <div className="corporate-contract-modal">
              <h2>Reject Contract</h2>
              <p>Please provide a reason for rejecting this contract:</p>
              <textarea
                value={contractRejectionReason}
                onChange={(e) => setContractRejectionReason(e.target.value)}
                placeholder="Enter rejection reason..."
                className="corporate-contract-input"
                rows="4"
                style={{ width: "100%", resize: "vertical" }}
              />
              <div className="corporate-contract-modal-actions">
                <button
                  className="corporate-contract-btn-secondary"
                  onClick={() => {
                    setShowRejectContractModal(false);
                    setContractRejectionReason("");
                  }}
                >
                  Cancel
                </button>
                <button
                  className="corporate-contract-btn-primary"
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
            acceptedMethods={
              (contract.fleetOwnerId?.acceptedPaymentMethods || []).map(normalizeMethod)
            }
            onSelectMethod={handleSelectPaymentMethod}
            onClose={() => setShowPaymentMethodModal(false)}
            contract={contract}
          />
        )}
      </div>
      <Footer />
    </>
  );
};

export default CorporateContractDetails;
