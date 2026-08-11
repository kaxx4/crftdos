export function getDeviceId(): string {
  if (typeof window === "undefined") return "server";
  let id = localStorage.getItem("stallos_device_id");
  if (!id) {
    id = "dev-" + crypto.randomUUID();
    localStorage.setItem("stallos_device_id", id);
  }
  return id;
}
