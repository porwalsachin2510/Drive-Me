import React from "react";
import { Navigate } from "react-router-dom";
import {
  getPortalToken,
  getPortalEmployee,
} from "../../services/demandPortalAPI";

/**
 * Guards Staff Portal routes. Requires a valid portal token AND (optionally)
 * a matching portalRole. If the role does not match, the user is redirected to
 * their own portal home instead of being locked out.
 */
const StaffPortalGuard = ({ role, children }) => {
  const token = getPortalToken();
  const employee = getPortalEmployee();

  if (!token || !employee) {
    return <Navigate to="/staff-login" replace />;
  }

  if (role && employee.portalRole !== role) {
    return (
      <Navigate
        to={
          employee.portalRole === "FINANCE" ? "/staff/finance" : "/staff/field"
        }
        replace
      />
    );
  }

  return children;
};

export default StaffPortalGuard;
