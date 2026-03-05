"use client";
import "./PDFViewerModal.css";

const PDFViewerModal = ({ pdfUrl, onClose }) => {
  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = pdfUrl;
    link.download = pdfUrl.split("/").pop();
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="pdf-viewer-modal-overlay" onClick={onClose}>
      <div
        className="pdf-viewer-modal-container"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pdf-viewer-modal-header">
          <h3>Contract Document</h3>
          <div className="pdf-viewer-modal-actions">
            <button
              className="pdf-viewer-download-btn"
              onClick={handleDownload}
            >
              Download PDF
            </button>
            <button className="pdf-viewer-close-btn" onClick={onClose}>
              ✕
            </button>
          </div>
        </div>
        <div className="pdf-viewer-modal-body">
          <iframe
            src={`${pdfUrl}#toolbar=1&navpanes=1&scrollbar=1`}
            title="Contract PDF"
            className="pdf-viewer-iframe"
          />
        </div>
      </div>
    </div>
  );
};

export default PDFViewerModal;
