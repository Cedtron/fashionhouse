
import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import Cookies from "js-cookie";

interface PrivateRouteProps {
  children: ReactNode;
}

export default function PrivateRoute({ children }: PrivateRouteProps) {
  const isLoggedIn =
    localStorage.getItem("token") || Cookies.get("token");

  return isLoggedIn ? children : <Navigate to="/signin" replace />;
}
