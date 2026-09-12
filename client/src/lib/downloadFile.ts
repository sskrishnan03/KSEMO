/**
 * Reliable cross-browser file download utility.
 * Fetches the resource and creates a same-origin blob URL so the download attribute
 * is strictly honored with the exact target filename, bypassing browser cross-origin
 * restrictions or server key naming.
 */
export async function downloadFile(url: string, filename: string): Promise<void> {
  if (!url) return;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Fetch failed: ${res.statusText}`);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => {
      URL.revokeObjectURL(blobUrl);
    }, 2000);
  } catch {
    // Fallback using direct anchor with download and filename query params
    const separator = url.includes("?") ? "&" : "?";
    const downloadUrl = `${url}${separator}download=1&filename=${encodeURIComponent(filename)}`;
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}
