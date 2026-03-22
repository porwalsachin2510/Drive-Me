"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import api from "../../../utils/api";
import "./AdminContent.css";

function AdminContent() {
  const [pages, setPages] = useState([]);
  const [selectedPage, setSelectedPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [siteSettings, setSiteSettings] = useState({
    socialLinks: {
      facebook: "",
      instagram: "",
      tiktok: "",
      linkedin: "",
      twitter: "",
    },
    contactEmail: "",
    contactPhone: "",
    address: "",
  });
  const [activeSection, setActiveSection] = useState("pages"); // pages or settings
  const editorRef = useRef(null);

  useEffect(() => {
    fetchPages();
    fetchSiteSettings();
  }, []);

  const fetchPages = async () => {
    try {
      setLoading(true);
      const response = await api.get("/pages/admin/all");
      if (response.data.success) {
        setPages(response.data.data);
        if (response.data.data.length > 0 && !selectedPage) {
          setSelectedPage(response.data.data[0]);
        }
      }
    } catch (error) {
      setMessage({ type: "error", text: "Failed to fetch pages" });
    } finally {
      setLoading(false);
    }
  };

  const fetchSiteSettings = async () => {
    try {
      const response = await api.get("/pages/admin/settings/all");
      if (response.data.success) {
        setSiteSettings(response.data.data);
      }
    } catch (error) {
      console.error("Failed to fetch site settings:", error);
    }
  };

  const handlePageSelect = (page) => {
    setSelectedPage(page);
    setMessage({ type: "", text: "" });
  };

  const handleSavePage = async () => {
    if (!selectedPage) return;

    try {
      setSaving(true);
      const content = editorRef.current?.innerHTML || selectedPage.content;

      const response = await api.put(`/pages/admin/${selectedPage.slug}`, {
        title: selectedPage.title,
        content: content,
        metaDescription: selectedPage.metaDescription,
        isPublished: selectedPage.isPublished,
      });

      if (response.data.success) {
        setMessage({ type: "success", text: "Page saved successfully!" });
        fetchPages();
      }
    } catch (error) {
      setMessage({ type: "error", text: "Failed to save page" });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      const response = await api.put(
        "/pages/admin/settings/update",
        siteSettings,
      );

      if (response.data.success) {
        setMessage({ type: "success", text: "Settings saved successfully!" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Failed to save settings" });
    } finally {
      setSaving(false);
    }
  };

  // Rich Text Editor Functions
  const execCommand = useCallback((command, value = null) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  }, []);

  const formatBlock = (tag) => {
    execCommand("formatBlock", tag);
  };

  const insertLink = () => {
    const url = prompt("Enter URL:");
    if (url) {
      execCommand("createLink", url);
    }
  };

  const insertImage = () => {
    const url = prompt("Enter image URL:");
    if (url) {
      execCommand("insertImage", url);
    }
  };

  const setTextColor = (color) => {
    execCommand("foreColor", color);
  };

  const setBackgroundColor = (color) => {
    execCommand("hiliteColor", color);
  };

  const pageSlugLabels = {
    "terms-and-conditions": "Terms & Conditions",
    "privacy-policy": "Privacy Policy",
    "refund-policy": "Refund Policy",
    "contact-us": "Contact Us",
  };

  if (loading) {
    return (
      <div className="admin-content-loading">
        <div className="loading-spinner"></div>
        <p>Loading content management...</p>
      </div>
    );
  }

  return (
    <div className="admin-content">
      <div className="admin-content-header">
        <h1>Content Management</h1>
        <p>Manage your website pages and site settings</p>
      </div>

      {/* Section Tabs */}
      <div className="content-section-tabs">
        <button
          className={`section-tab ${activeSection === "pages" ? "active" : ""}`}
          onClick={() => setActiveSection("pages")}
        >
          Page Editor
        </button>
        <button
          className={`section-tab ${activeSection === "settings" ? "active" : ""}`}
          onClick={() => setActiveSection("settings")}
        >
          Site Settings
        </button>
      </div>

      {message.text && (
        <div className={`content-message ${message.type}`}>{message.text}</div>
      )}

      {activeSection === "pages" ? (
        <div className="content-editor-container">
          {/* Page Selector */}
          <div className="page-selector">
            <h3>Select Page to Edit</h3>
            <div className="page-list">
              {pages.map((page) => (
                <button
                  key={page.slug}
                  className={`page-item ${selectedPage?.slug === page.slug ? "active" : ""}`}
                  onClick={() => handlePageSelect(page)}
                >
                  <span className="page-title">
                    {pageSlugLabels[page.slug] || page.title}
                  </span>
                  <span
                    className={`page-status ${page.isPublished ? "published" : "draft"}`}
                  >
                    {page.isPublished ? "Published" : "Draft"}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Editor Section */}
          {selectedPage && (
            <div className="editor-section">
              <div className="editor-header">
                <input
                  type="text"
                  className="page-title-input"
                  value={selectedPage.title}
                  onChange={(e) =>
                    setSelectedPage({ ...selectedPage, title: e.target.value })
                  }
                  placeholder="Page Title"
                />
                <label className="publish-toggle">
                  <input
                    type="checkbox"
                    checked={selectedPage.isPublished}
                    onChange={(e) =>
                      setSelectedPage({
                        ...selectedPage,
                        isPublished: e.target.checked,
                      })
                    }
                  />
                  <span>Published</span>
                </label>
              </div>

              {/* Rich Text Toolbar */}
              <div className="editor-toolbar">
                <div className="toolbar-group">
                  <select
                    onChange={(e) => formatBlock(e.target.value)}
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Heading
                    </option>
                    <option value="h1">Heading 1</option>
                    <option value="h2">Heading 2</option>
                    <option value="h3">Heading 3</option>
                    <option value="h4">Heading 4</option>
                    <option value="p">Paragraph</option>
                  </select>
                </div>

                <div className="toolbar-group">
                  <button onClick={() => execCommand("bold")} title="Bold">
                    <strong>B</strong>
                  </button>
                  <button onClick={() => execCommand("italic")} title="Italic">
                    <em>I</em>
                  </button>
                  <button
                    onClick={() => execCommand("underline")}
                    title="Underline"
                  >
                    <u>U</u>
                  </button>
                  <button
                    onClick={() => execCommand("strikeThrough")}
                    title="Strikethrough"
                  >
                    <s>S</s>
                  </button>
                </div>

                <div className="toolbar-group">
                  <button
                    onClick={() => execCommand("justifyLeft")}
                    title="Align Left"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M3 3h18v2H3V3zm0 4h12v2H3V7zm0 4h18v2H3v-2zm0 4h12v2H3v-2zm0 4h18v2H3v-2z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => execCommand("justifyCenter")}
                    title="Align Center"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M3 3h18v2H3V3zm3 4h12v2H6V7zm-3 4h18v2H3v-2zm3 4h12v2H6v-2zm-3 4h18v2H3v-2z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => execCommand("justifyRight")}
                    title="Align Right"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M3 3h18v2H3V3zm6 4h12v2H9V7zm-6 4h18v2H3v-2zm6 4h12v2H9v-2zm-6 4h18v2H3v-2z" />
                    </svg>
                  </button>
                </div>

                <div className="toolbar-group">
                  <button
                    onClick={() => execCommand("insertUnorderedList")}
                    title="Bullet List"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M4 4h2v2H4V4zm4 0h14v2H8V4zM4 10h2v2H4v-2zm4 0h14v2H8v-2zm-4 6h2v2H4v-2zm4 0h14v2H8v-2z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => execCommand("insertOrderedList")}
                    title="Numbered List"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M3 4h2v2H3V4zm0 6h2v2H3v-2zm0 6h2v2H3v-2zm5-12h14v2H8V4zm0 6h14v2H8v-2zm0 6h14v2H8v-2z" />
                    </svg>
                  </button>
                </div>

                <div className="toolbar-group">
                  <button onClick={insertLink} title="Insert Link">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z" />
                    </svg>
                  </button>
                  <button onClick={insertImage} title="Insert Image">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
                    </svg>
                  </button>
                </div>

                <div className="toolbar-group">
                  <label title="Text Color">
                    <input
                      type="color"
                      onChange={(e) => setTextColor(e.target.value)}
                      className="color-picker"
                    />
                    <span className="color-icon">A</span>
                  </label>
                  <label title="Background Color">
                    <input
                      type="color"
                      onChange={(e) => setBackgroundColor(e.target.value)}
                      className="color-picker"
                    />
                    <span className="color-icon bg">A</span>
                  </label>
                </div>

                <div className="toolbar-group">
                  <button
                    onClick={() => execCommand("removeFormat")}
                    title="Clear Formatting"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M3.27 5L2 6.27l6.97 6.97L6.5 19h3l1.57-3.66L16.73 21 18 19.73 3.27 5zM6 5v.18L8.82 8h2.4l-.72 1.68 2.1 2.1L14.21 8H20V5H6z" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Editor Content Area */}
              <div
                ref={editorRef}
                className="editor-content"
                contentEditable
                dangerouslySetInnerHTML={{ __html: selectedPage.content }}
                suppressContentEditableWarning
              />

              {/* Meta Description */}
              <div className="meta-section">
                <label>Meta Description (for SEO)</label>
                <textarea
                  value={selectedPage.metaDescription || ""}
                  onChange={(e) =>
                    setSelectedPage({
                      ...selectedPage,
                      metaDescription: e.target.value,
                    })
                  }
                  placeholder="Enter a brief description for search engines..."
                  rows={3}
                />
              </div>

              {/* Save Button */}
              <div className="editor-actions">
                <button
                  className="save-btn"
                  onClick={handleSavePage}
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save Page"}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="settings-container">
          {/* Social Media Links Card */}
          <div className="settings-card">
            <div className="settings-card-header">
              <div className="settings-card-icon social">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
                </svg>
              </div>
              <div>
                <h3>Social Media Links</h3>
                <p>
                  Add your social media profile URLs. These will appear in the
                  website footer.
                </p>
              </div>
            </div>
            <div className="settings-card-body">
              <div className="settings-grid">
                <div className="setting-item">
                  <label>
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="#1877F2"
                    >
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                    </svg>
                    Facebook
                  </label>
                  <input
                    type="url"
                    value={siteSettings.socialLinks?.facebook || ""}
                    onChange={(e) =>
                      setSiteSettings({
                        ...siteSettings,
                        socialLinks: {
                          ...siteSettings.socialLinks,
                          facebook: e.target.value,
                        },
                      })
                    }
                    placeholder="https://facebook.com/yourpage"
                  />
                </div>

                <div className="setting-item">
                  <label>
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="#E4405F"
                    >
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                    </svg>
                    Instagram
                  </label>
                  <input
                    type="url"
                    value={siteSettings.socialLinks?.instagram || ""}
                    onChange={(e) =>
                      setSiteSettings({
                        ...siteSettings,
                        socialLinks: {
                          ...siteSettings.socialLinks,
                          instagram: e.target.value,
                        },
                      })
                    }
                    placeholder="https://instagram.com/yourpage"
                  />
                </div>

                <div className="setting-item">
                  <label>
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="#000000"
                    >
                      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
                    </svg>
                    TikTok
                  </label>
                  <input
                    type="url"
                    value={siteSettings.socialLinks?.tiktok || ""}
                    onChange={(e) =>
                      setSiteSettings({
                        ...siteSettings,
                        socialLinks: {
                          ...siteSettings.socialLinks,
                          tiktok: e.target.value,
                        },
                      })
                    }
                    placeholder="https://tiktok.com/@yourpage"
                  />
                </div>

                <div className="setting-item">
                  <label>
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="#0A66C2"
                    >
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                    </svg>
                    LinkedIn
                  </label>
                  <input
                    type="url"
                    value={siteSettings.socialLinks?.linkedin || ""}
                    onChange={(e) =>
                      setSiteSettings({
                        ...siteSettings,
                        socialLinks: {
                          ...siteSettings.socialLinks,
                          linkedin: e.target.value,
                        },
                      })
                    }
                    placeholder="https://linkedin.com/company/yourpage"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Contact Information Card */}
          <div className="settings-card">
            <div className="settings-card-header">
              <div className="settings-card-icon contact">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
              </div>
              <div>
                <h3>Contact Information</h3>
                <p>Your business contact details displayed on the website.</p>
              </div>
            </div>
            <div className="settings-card-body">
              <div className="settings-grid">
                <div className="setting-item">
                  <label>
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#e53e3e"
                      strokeWidth="2"
                    >
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <polyline points="22,6 12,13 2,6" />
                    </svg>
                    Contact Email
                  </label>
                  <input
                    type="email"
                    value={siteSettings.contactEmail || ""}
                    onChange={(e) =>
                      setSiteSettings({
                        ...siteSettings,
                        contactEmail: e.target.value,
                      })
                    }
                    placeholder="hello@drivemekw.com"
                  />
                </div>

                <div className="setting-item">
                  <label>
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#e53e3e"
                      strokeWidth="2"
                    >
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.81.32 1.62.56 2.41a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.79.24 1.6.43 2.41.56A2 2 0 0 1 22 16.92z" />
                    </svg>
                    Contact Phone
                  </label>
                  <input
                    type="tel"
                    value={siteSettings.contactPhone || ""}
                    onChange={(e) =>
                      setSiteSettings({
                        ...siteSettings,
                        contactPhone: e.target.value,
                      })
                    }
                    placeholder="+965 9676 1400"
                  />
                </div>

                <div className="setting-item full-width">
                  <label>
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#e53e3e"
                      strokeWidth="2"
                    >
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                    Business Address
                  </label>
                  <textarea
                    value={siteSettings.address || ""}
                    onChange={(e) =>
                      setSiteSettings({
                        ...siteSettings,
                        address: e.target.value,
                      })
                    }
                    placeholder="Enter your business address..."
                    rows={3}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="settings-actions">
            <button
              className="save-btn"
              onClick={handleSaveSettings}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save All Settings"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminContent;
