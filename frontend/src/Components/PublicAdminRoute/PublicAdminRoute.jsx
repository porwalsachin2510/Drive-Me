import { Navigate } from "react-router-dom";
import { useSelector } from "react-redux";
import {
  selectIsAuthenticated,
  selectUserRole,
} from "../../Redux/selectors/authSelectors";


const PublicAdminRoute = ({ children }) => {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const userRole = useSelector(selectUserRole);

  if (isAuthenticated && userRole === "Admin") {
    return <Navigate to="/admin-profile" />;
  }

  return children;
};

export default PublicAdminRoute;
