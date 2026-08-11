import { v4 as uuidv4 } from "uuid";

export function getSessionId(): string {
  if (typeof window === "undefined") return "kiosk";
  let id = sessionStorage.getItem("kiosk_session_id");
  if (!id) {
    id = uuidv4();
    sessionStorage.setItem("kiosk_session_id", id);
  }
  return id;
}

export function clearSessionId() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem("kiosk_session_id");
}
