export function getDeviceId(): string {
  if (typeof window === "undefined") return "server";
  let id = localStorage.getItem("stallos_device_id");
  if (!id) {
    id = "dev-" + Math.random().toString(36).slice(2, 10);
    localStorage.setItem("stallos_device_id", id);
  }
  return id;
}
