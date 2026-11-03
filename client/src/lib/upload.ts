import { buildUrl } from "./queryClient";
import { resilientFetch } from "@/lib/resilientFetch";

export async function uploadFile(file: File, folder = "images") {
  try {
    const reader = new FileReader();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });


    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    try {
      const token = localStorage.getItem('accessToken');
      if (token) headers['Authorization'] = `Bearer ${token}`;
    } catch (e) { /* ignore */ }

    const response = await resilientFetch(buildUrl('/api/upload/avatar'), {
      method: 'POST',
      headers,
      body: JSON.stringify({ imageData: dataUrl, fileName: file.name })
    });

    if (!response.ok) {
      throw new Error('Upload failed');
    }

    const result = await response.json();
    return result.url || dataUrl;
  } catch (err) {
    console.warn("Upload failed, using data URL directly", String(err));
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  }
}
