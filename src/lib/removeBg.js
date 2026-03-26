const REMOVE_BG_URL = "https://api.remove.bg/v1.0/removebg";
const PHOTOROOM_URL = "https://sdk.photoroom.com/v1/segment";

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function getConfiguredApiKey(envName, placeholder) {
  const apiKey = import.meta.env[envName]?.trim() ?? "";

  if (!apiKey || apiKey === placeholder) {
    return "";
  }

  return apiKey;
}

export function getRemoveBgApiKey() {
  return getConfiguredApiKey("VITE_REMOVEBG_API_KEY", "your_remove_bg_api_key_here");
}

export function getPhotoroomApiKey() {
  return getConfiguredApiKey("VITE_PHOTOROOM_API_KEY", "your_photoroom_api_key_here");
}

export function getBackgroundRemovalProvider() {
  if (getPhotoroomApiKey()) {
    return "photoroom";
  }

  if (getRemoveBgApiKey()) {
    return "removebg";
  }

  return "";
}

function createApiError(provider, status, fallbackMessage, data) {
  const error = new Error(fallbackMessage);
  error.provider = provider;
  error.status = status;
  error.payload = data;
  return error;
}

function getAvailableProviders() {
  const providers = [];

  if (getPhotoroomApiKey()) {
    providers.push("photoroom");
  }

  if (getRemoveBgApiKey()) {
    providers.push("removebg");
  }

  return providers;
}

function shouldTryAnotherProvider(error) {
  const message = error?.message?.toLowerCase?.() ?? "";

  return (
    error?.status === 402 ||
    message.includes("402") ||
    message.includes("credit") ||
    message.includes("quota") ||
    message.includes("payment required") ||
    message.includes("billing")
  );
}

async function removeBackgroundWithRemoveBg(file, { size = "auto", type = "auto" } = {}) {
  const apiKey = getRemoveBgApiKey();

  if (!apiKey) {
    throw new Error("Missing remove.bg API key. Set VITE_REMOVEBG_API_KEY in your environment.");
  }

  const formData = new FormData();
  formData.append("image_file", file);
  formData.append("size", size);
  formData.append("type", type);

  const response = await fetch(REMOVE_BG_URL, {
    method: "POST",
    headers: {
      "X-Api-Key": apiKey,
    },
    body: formData,
  });

  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    let data = null;

    try {
      data = await response.json();
      if (data?.errors?.[0]?.title) {
        message = data.errors[0].title;
      }
    } catch {
      // Ignore JSON parse errors and use the fallback message.
    }

    throw createApiError("removebg", response.status, message, data);
  }

  const blob = await response.blob();
  return blobToDataUrl(blob);
}

async function removeBackgroundWithPhotoroom(file, { size = "preview" } = {}) {
  const apiKey = getPhotoroomApiKey();

  if (!apiKey) {
    throw new Error("Missing Photoroom API key. Set VITE_PHOTOROOM_API_KEY in your environment.");
  }

  const formData = new FormData();
  formData.append("image_file", file);

  if (size && size !== "auto") {
    formData.append("size", size);
  }

  const response = await fetch(PHOTOROOM_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
    },
    body: formData,
  });

  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    let data = null;

    try {
      data = await response.json();
      message =
        data?.message ||
        data?.error?.message ||
        data?.errors?.[0]?.message ||
        data?.errors?.[0]?.title ||
        message;
    } catch {
      // Ignore JSON parse errors and use the fallback message.
    }

    throw createApiError("photoroom", response.status, message, data);
  }

  const blob = await response.blob();
  return blobToDataUrl(blob);
}

export async function removeBackgroundWithApi(file, options = {}) {
  const providers = getAvailableProviders();
  let lastError = null;

  if (providers.length === 0) {
    throw new Error(
      "Missing background removal API key. Set VITE_PHOTOROOM_API_KEY or VITE_REMOVEBG_API_KEY in your environment.",
    );
  }

  for (const [index, provider] of providers.entries()) {
    try {
      if (provider === "photoroom") {
        return await removeBackgroundWithPhotoroom(file, {
          size: options.size === "auto" ? "preview" : options.size,
        });
      }

      return await removeBackgroundWithRemoveBg(file, options);
    } catch (error) {
      lastError = error;

      if (!shouldTryAnotherProvider(error) || index === providers.length - 1) {
        throw error;
      }
    }
  }

  throw lastError ?? new Error("Background removal failed.");
}
