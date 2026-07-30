import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import * as demandAPI from "../../services/demandAPI";
import "./EnquiryForm.css";

const emptyForm = {
  name: "",
  phone: "",
  email: "",
  category: "CUSTOMER",
  company: "",
  message: "",
};

const EnquiryForm = () => {
  const { slug } = useParams();
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null); // holds success message

  const loadCampaign = useCallback(async () => {
    try {
      setLoading(true);
      const res = await demandAPI.getPublicCampaign(slug);
      setCampaign(res.data);
    } catch (err) {
      if (err.response?.status === 404) setNotFound(true);
      else if (err.response?.status === 403) setCampaign({ closed: true });
      else setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    loadCampaign();
  }, [loadCampaign]);

  const validate = () => {
    const next = {};
    if (!form.name.trim()) next.name = "Please enter your name";
    if (!form.phone.trim() && !form.email.trim()) {
      next.phone = "Enter a phone number or email so we can reach you";
    }
    if (form.phone && form.phone.replace(/[^\d]/g, "").length < 7) {
      next.phone = "Please enter a valid phone number";
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      next.email = "Please enter a valid email address";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    try {
      setSubmitting(true);
      const res = await demandAPI.submitPublicLead(slug, {
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        category: form.category,
        company: form.company.trim(),
        message: form.message.trim(),
      });
      setDone(res.message || "Thank you! Your enquiry has been received.");
    } catch (err) {
      const status = err.response?.status;
      if (status === 429) {
        setErrors({
          form: "Too many submissions. Please wait a minute and try again.",
        });
      } else {
        setErrors({
          form:
            err.response?.data?.message ||
            "Something went wrong. Please try again.",
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="enq-wrap">
        <div className="enq-card enq-center">
          <div className="enq-spinner" />
          <p>Loading…</p>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="enq-wrap">
        <div className="enq-card enq-center">
          <h1 className="enq-title">Link not found</h1>
          <p className="enq-muted">
            This enquiry link is invalid or has expired.
          </p>
        </div>
      </div>
    );
  }

  if (campaign?.closed) {
    return (
      <div className="enq-wrap">
        <div className="enq-card enq-center">
          <h1 className="enq-title">Enquiries closed</h1>
          <p className="enq-muted">
            This campaign is no longer accepting enquiries. Thank you for your
            interest.
          </p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="enq-wrap">
        <div className="enq-card enq-center">
          <div className="enq-check" aria-hidden="true">
            ✓
          </div>
          <h1 className="enq-title">Thank you!</h1>
          <p className="enq-muted">{done}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="enq-wrap">
      <main className="enq-card">
        <header className="enq-head">
          <h1 className="enq-title text-balance">
            {campaign?.name || "Get in touch"}
          </h1>
          {campaign?.description && (
            <p className="enq-muted text-pretty">{campaign.description}</p>
          )}
        </header>

        <form onSubmit={handleSubmit} noValidate>
          {errors.form && (
            <div className="enq-alert" role="alert">
              {errors.form}
            </div>
          )}

          <div className="enq-field">
            <label htmlFor="enq-name">
              Full name <span className="enq-req">*</span>
            </label>
            <input
              id="enq-name"
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              aria-invalid={!!errors.name}
              autoComplete="name"
            />
            {errors.name && <span className="enq-err">{errors.name}</span>}
          </div>

          <div className="enq-row">
            <div className="enq-field">
              <label htmlFor="enq-phone">Phone</label>
              <input
                id="enq-phone"
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                aria-invalid={!!errors.phone}
                autoComplete="tel"
              />
              {errors.phone && <span className="enq-err">{errors.phone}</span>}
            </div>
            <div className="enq-field">
              <label htmlFor="enq-email">Email</label>
              <input
                id="enq-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                aria-invalid={!!errors.email}
                autoComplete="email"
              />
              {errors.email && <span className="enq-err">{errors.email}</span>}
            </div>
          </div>

          <div className="enq-field">
            <label htmlFor="enq-category">I am a</label>
            <select
              id="enq-category"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              <option value="CUSTOMER">Customer</option>
              <option value="PARTNER">Partner</option>
            </select>
          </div>

          <div className="enq-field">
            <label htmlFor="enq-company">Company (optional)</label>
            <input
              id="enq-company"
              type="text"
              value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
              autoComplete="organization"
            />
          </div>

          <div className="enq-field">
            <label htmlFor="enq-message">Message (optional)</label>
            <textarea
              id="enq-message"
              rows={4}
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
            />
          </div>

          <button type="submit" className="enq-submit" disabled={submitting}>
            {submitting ? "Submitting…" : "Submit enquiry"}
          </button>
          <p className="enq-fine">
            By submitting, you agree to be contacted about your enquiry.
          </p>
        </form>
      </main>
    </div>
  );
};

export default EnquiryForm;
