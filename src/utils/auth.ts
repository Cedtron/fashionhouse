import Cookies from "js-cookie";

export function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token") || Cookies.get("token") || null;
}

export function getUser() {
  try {
    const localUser = typeof window !== "undefined" ? localStorage.getItem("user") : null;
    const cookieUser = Cookies.get("user");
    const user = localUser || cookieUser;
    return user ? JSON.parse(user) : null;
  } catch (e) {
    return null;
  }
}
export function isLoggedIn(){ return !!getToken() } export function getRole(){ const u=getUser(); return u?.role; }
