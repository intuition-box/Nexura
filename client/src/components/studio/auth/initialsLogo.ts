/** A square PNG with the project's initials, for hubs created before a logo is uploaded. */
export async function initialsLogo(name: string): Promise<Blob> {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, "#9b7cff");
  g.addColorStop(0.45, "#7c5cfc");
  g.addColorStop(1, "#5aa8ff");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const initials = name.trim().split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase() || "N";
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 104px Geist, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(initials, size / 2, size / 2 + 6);
  return new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error("Couldn't create the logo"))), "image/png"));
}
