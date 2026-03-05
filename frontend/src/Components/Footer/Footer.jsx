import { useNavigate } from "react-router-dom";
import "./footer.css";

const Footer = () => {

  const navigate = useNavigate();
  
  const handleAdminLogin = () => {
    navigate("/admin-login");
  };

  return (
    <footer className="my-footer">
      {/* Red top border */}
      <div className="my-footer-top-border"></div>

      <div className="my-footer-content">
        {/* Left Section - Logo and Description */}
        <div className="my-footer-left">
          <div className="footer-logo">
            <div className="footer-logo-box">driveme</div>
          </div>
          <p className="footer-tagline">"smart mobility, made for the GCC"</p>
          <p className="footer-description">
            The premier transportation marketplace connecting Kuwait and UAE.
            Reliable rides, verified drivers, and corporate solutions.
          </p>
          <div className="footer-social-icons">
            <a href="#" className="social-icon" title="Chat">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
            </a>
            <a
              href="mailto:hello@drivemekw.com"
              className="social-icon"
              title="Email"
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="2" y="4" width="20" height="16" rx="2"></rect>
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path>
              </svg>
            </a>
          </div>
        </div>

        {/* Middle Sections */}
        <div className="my-footer-middle">
          {/* Services Column */}
          <div className="footer-column">
            <h3 className="footer-column-title">Services</h3>
            <ul className="footer-links">
              <li>
                <a href="#home-to-work">Home to Work</a>
              </li>
              <li>
                <a href="#corporate-solutions">Corporate Solutions</a>
              </li>
              <li>
                <a href="#find-driver">Find a Driver</a>
              </li>
            </ul>
          </div>

          {/* Legal Column */}
          <div className="footer-column">
            <h3 className="footer-column-title">Legal</h3>
            <ul className="footer-links">
              <li>
                <a href="#terms">Terms & Conditions</a>
              </li>
              <li>
                <a href="#privacy">Privacy Policy (KW/UAE)</a>
              </li>
              <li>
                <a href="#refund">Refund Policy</a>
              </li>
            </ul>
          </div>
        </div>

        {/* Right Section - Contact Us */}
        <div className="my-footer-right">
          <h3 className="footer-column-title">Contact Us</h3>
          <ul className="footer-contact-list">
            <li>
              <span className="contact-icon">✉</span>
              <a href="mailto:hello@drivemekw.com">hello@drivemekw.com</a>
            </li>
            <li>
              <span className="contact-icon">☎</span>
              <a href="tel:+9656761400">+965 9676 1400</a>
            </li>
            <li>
              <span className="contact-icon">💬</span>
              <span>WhatsApp Support Available</span>
            </li>
            <li>
              <span className="contact-icon">📍</span>
              <span>Kuwait & UAE</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Divider */}
      <div className="footer-divider"></div>

      {/* Bottom Section */}
      <div className="footer-bottom">
        <p className="footer-copyright">© 2025 DRIVEME. All rights reserved.</p>
        <div className="footer-bottom-right">
          <a href="#stripe" className="footer-bottom-link">
            Secure Payments by Stripe
          </a>
          <span
            className="footer-bottom-link admin-link"
            onClick={handleAdminLogin}
          >
            🔒 Admin Log
          </span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
