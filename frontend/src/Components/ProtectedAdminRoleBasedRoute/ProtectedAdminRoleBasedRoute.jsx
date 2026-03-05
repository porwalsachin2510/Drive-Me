import { Navigate } from "react-router-dom";
import { useSelector } from "react-redux";
import {
  selectIsAuthenticated,
  selectUserRole,
} from "../../Redux/selectors/authSelectors";

const ProtectedAdminRoleBasedRoute = ({ children, allowedRoles = null }) => {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const userRole = useSelector(selectUserRole);

  if (!isAuthenticated) {
    return <Navigate to="/admin-login" />;
  }

  if (allowedRoles && !allowedRoles.includes(userRole)) {
    return <Navigate to="/admin-login" />;
  }

  return children;
};

export default ProtectedAdminRoleBasedRoute;
