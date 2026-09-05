import { Navigate } from "react-router-dom";
import { useSelector } from "react-redux";
import {
  selectIsAuthenticated,
  selectUserRole,
} from "../../Redux/selectors/authSelectors";
import { expandRoleFamilies } from "../../utils/roleFamilies";

const ProtectedRoleBasedRoute = ({ children, allowedRoles = null }) => {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const userRole = useSelector(selectUserRole);

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  // Expand role families so a route that allows CORPORATE also admits
  // SCHOOL_CUSTOMER, and one that allows B2B_PARTNER also admits SCHOOL_PARTNER.
  if (allowedRoles && !expandRoleFamilies(allowedRoles).includes(userRole)) {
    return <Navigate to="/login" />;
  }

  return children;
};

export default ProtectedRoleBasedRoute;
