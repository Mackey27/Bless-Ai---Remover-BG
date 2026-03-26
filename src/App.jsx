import { useEffect, useMemo, useRef, useState } from "react";
import EditorSection from "./components/EditorSection.jsx";
import Footer from "./components/Footer.jsx";
import Header from "./components/Header.jsx";
import HeroSection from "./components/HeroSection.jsx";
import HistoryPanel from "./components/HistoryPanel.jsx";
import Toast from "./components/Toast.jsx";
import {
  isFirebaseAuthConfigured,
  signInWithGooglePopup,
  signOutFromGoogle,
  subscribeToAuthChanges,
} from "./lib/firebaseAuth.js";
import { loadPersistedHistory, savePersistedHistory } from "./lib/historyStore.js";
import { getBackgroundRemovalProvider, removeBackgroundWithApi } from "./lib/removeBg.js";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const createImageRecord = (name, original, processed = null, processedBase = null) => ({
  id: Date.now() + Math.random(),
  name,
  original,
  processed,
  processedBase,
});

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(event.target?.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const removeBgTypeMap = {
  auto: "auto",
  person: "person",
  product: "product",
  animal: "animal",
  logo: "graphic",
  food: "product",
};

const removeBgFallbackTypes = {
  auto: ["auto", "product", "person", "animal", "graphic"],
  person: ["person", "auto"],
  product: ["product", "auto", "graphic"],
  animal: ["animal", "auto"],
  logo: ["graphic", "auto", "product"],
  food: ["product", "auto", "graphic"],
};

const supportedImageExtensions = [".png", ".jpg", ".jpeg", ".webp", ".heic", ".heif"];
let heicConverterPromise;
const MAX_HEIC_DIMENSION = 2200;
const MAX_PERSISTED_HISTORY_CHARS = 4_000_000;

function getGoogleAuthErrorMessage(error) {
  const errorCode = error?.code || "";

  if (errorCode === "auth/cancelled-popup-request") {
    return "Google sign-in is already opening. Please use the existing popup.";
  }

  if (errorCode === "auth/popup-closed-by-user") {
    return "Google sign-in was closed before finishing.";
  }

  if (errorCode === "auth/configuration-not-found") {
    return "Firebase Google sign-in is not enabled yet. In Firebase Console, open Authentication, enable Google, add a support email, and make sure localhost is an authorized domain.";
  }

  if (errorCode === "auth/unauthorized-domain") {
    return "This domain is not authorized for Firebase sign-in. Add localhost in Firebase Authentication authorized domains.";
  }

  return error?.message || "Google sign-in failed.";
}

function getFileExtension(fileName) {
  return fileName.slice(Math.max(0, fileName.lastIndexOf("."))).toLowerCase();
}

function isHeicFile(file) {
  const extension = getFileExtension(file.name);
  return (
    file.type === "image/heic" ||
    file.type === "image/heif" ||
    extension === ".heic" ||
    extension === ".heif"
  );
}

function isSupportedImageFile(file) {
  if (file.type.startsWith("image/")) return true;
  return supportedImageExtensions.includes(getFileExtension(file.name));
}

function renameWithExtension(fileName, nextExtension) {
  const dotIndex = fileName.lastIndexOf(".");
  const baseName = dotIndex === -1 ? fileName : fileName.slice(0, dotIndex);
  return `${baseName}${nextExtension}`;
}

function rasterizeFile(file, { maxDimension = MAX_HEIC_DIMENSION, type = "image/jpeg", quality = 0.9 } = {}) {
  return new Promise((resolve, reject) => {
    const imageUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      const longestEdge = Math.max(image.naturalWidth, image.naturalHeight, 1);
      const scale = Math.min(1, maxDimension / longestEdge);
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      canvas.width = width;
      canvas.height = height;
      context.drawImage(image, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(imageUrl);

          if (!blob) {
            reject(new Error("Image conversion failed."));
            return;
          }

          const extension = type === "image/png" ? ".png" : ".jpg";
          resolve(
            new File([blob], renameWithExtension(file.name, extension), {
              type,
            }),
          );
        },
        type,
        quality,
      );
    };

    image.onerror = () => {
      URL.revokeObjectURL(imageUrl);
      reject(new Error("Image conversion failed."));
    };

    image.src = imageUrl;
  });
}

async function normalizeUploadFile(file) {
  if (!isHeicFile(file)) {
    return file;
  }

  if (!heicConverterPromise) {
    heicConverterPromise = import("heic2any").then((module) => module.default);
  }

  const heic2any = await heicConverterPromise;
  const converted = await heic2any({
    blob: file,
    toType: "image/png",
  });

  const convertedBlob = Array.isArray(converted) ? converted[0] : converted;
  const convertedFile = new File([convertedBlob], renameWithExtension(file.name, ".png"), {
    type: "image/png",
  });

  return rasterizeFile(convertedFile, {
    maxDimension: MAX_HEIC_DIMENSION,
    type: "image/jpeg",
    quality: 0.9,
  });
}

function renderStyledImage({
  processedImage,
  backgroundType,
  backgroundColor,
  backgroundImage,
  shadowEnabled,
  shadowBlur,
  shadowOpacity,
}) {
  if (!processedImage) return Promise.resolve(null);

  return new Promise((resolve) => {
    const subject = new Image();
    subject.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = subject.width;
      canvas.height = subject.height;

      const drawSubject = () => {
        if (shadowEnabled) {
          ctx.shadowColor = `rgba(0, 0, 0, ${shadowOpacity / 100})`;
          ctx.shadowBlur = shadowBlur;
          ctx.shadowOffsetY = shadowBlur / 4;
        }
        ctx.drawImage(subject, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      };

      if (backgroundType === "color") {
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        drawSubject();
        return;
      }

      if (backgroundType === "image" && backgroundImage) {
        const bg = new Image();
        bg.onload = () => {
          ctx.drawImage(bg, 0, 0, canvas.width, canvas.height);
          drawSubject();
        };
        bg.src = backgroundImage;
        return;
      }

      drawSubject();
    };
    subject.src = processedImage;
  });
}

function cleanupResidualBackground(imageDataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const { data, width, height } = imageData;
      const visited = new Uint8Array(width * height);
      const queue = [];

      const isLightBackground = (offset) => {
        const alpha = data[offset + 3];
        if (alpha < 16) return true;

        const r = data[offset];
        const g = data[offset + 1];
        const b = data[offset + 2];
        const brightness = (r + g + b) / 3;
        const colorSpread = Math.max(r, g, b) - Math.min(r, g, b);

        return brightness > 215 && colorSpread < 35;
      };

      const enqueue = (x, y) => {
        if (x < 0 || y < 0 || x >= width || y >= height) return;
        const index = y * width + x;
        if (visited[index]) return;
        visited[index] = 1;
        queue.push(index);
      };

      for (let x = 0; x < width; x += 1) {
        enqueue(x, 0);
        enqueue(x, height - 1);
      }

      for (let y = 0; y < height; y += 1) {
        enqueue(0, y);
        enqueue(width - 1, y);
      }

      while (queue.length) {
        const index = queue.shift();
        const x = index % width;
        const y = Math.floor(index / width);
        const offset = index * 4;

        if (!isLightBackground(offset)) {
          continue;
        }

        data[offset + 3] = 0;

        enqueue(x + 1, y);
        enqueue(x - 1, y);
        enqueue(x, y + 1);
        enqueue(x, y - 1);
      }

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.src = imageDataUrl;
  });
}

function measureVisibleAlphaRatio(imageDataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let visiblePixels = 0;

      for (let index = 3; index < data.length; index += 4) {
        if (data[index] > 24) {
          visiblePixels += 1;
        }
      }

      resolve(visiblePixels / (canvas.width * canvas.height));
    };
    img.src = imageDataUrl;
  });
}

function createLogoCutout(imageDataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const { data, width, height } = frame;
      const samples = [];
      const margin = Math.max(1, Math.floor(Math.min(width, height) * 0.04));

      const samplePixel = (x, y) => {
        const offset = (y * width + x) * 4;
        samples.push([data[offset], data[offset + 1], data[offset + 2]]);
      };

      for (let x = 0; x < width; x += margin) {
        samplePixel(x, 0);
        samplePixel(x, height - 1);
      }

      for (let y = 0; y < height; y += margin) {
        samplePixel(0, y);
        samplePixel(width - 1, y);
      }

      const background = samples.reduce(
        (acc, [r, g, b]) => [acc[0] + r, acc[1] + g, acc[2] + b],
        [0, 0, 0],
      ).map((value) => value / Math.max(samples.length, 1));

      for (let offset = 0; offset < data.length; offset += 4) {
        const r = data[offset];
        const g = data[offset + 1];
        const b = data[offset + 2];
        const brightness = (r + g + b) / 3;
        const colorDistance = Math.sqrt(
          (r - background[0]) ** 2 + (g - background[1]) ** 2 + (b - background[2]) ** 2,
        );

        const looksLikeBackground =
          colorDistance < 52 ||
          (brightness < 35 && background.reduce((sum, value) => sum + value, 0) / 3 < 70) ||
          (brightness > 235 && background.reduce((sum, value) => sum + value, 0) / 3 > 200);

        data[offset + 3] = looksLikeBackground ? 0 : 255;
      }

      ctx.putImageData(frame, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.src = imageDataUrl;
  });
}

export default function App() {
  const uploadInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const comparisonContainerRef = useRef(null);
  const heroSectionRef = useRef(null);
  const editorSectionRef = useRef(null);
  const toastTimerRef = useRef(null);

  const [theme, setTheme] = useState("dark");
  const [images, setImages] = useState([]);
  const [currentImageId, setCurrentImageId] = useState(null);
  const [selectedMode, setSelectedMode] = useState("auto");
  const [selectedFormat, setSelectedFormat] = useState("png");
  const [backgroundType, setBackgroundType] = useState("transparent");
  const [backgroundColor, setBackgroundColor] = useState("#ffffff");
  const [backgroundImage, setBackgroundImage] = useState(null);
  const [shadowEnabled, setShadowEnabled] = useState(false);
  const [shadowBlur, setShadowBlur] = useState(20);
  const [shadowOpacity, setShadowOpacity] = useState(30);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [history, setHistory] = useState([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState("Analyzing image...");
  const [progress, setProgress] = useState(0);
  const [sliderPosition, setSliderPosition] = useState(50);
  const [toast, setToast] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [displayImage, setDisplayImage] = useState(null);
  const [currentUser, setCurrentUser] = useState(undefined);
  const [authReady, setAuthReady] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const backgroundRemovalProvider = getBackgroundRemovalProvider();
  const apiKeyConfigured = Boolean(backgroundRemovalProvider);
  const authConfigured = isFirebaseAuthConfigured();
  const canDownload = Boolean(currentUser);
  const [imageSize, setImageSize] = useState(null);
  const [comparisonBounds, setComparisonBounds] = useState({ width: 0, height: 0 });
  const panOffset = { x: 0, y: 0 };

  const currentImage = useMemo(
    () => images.find((image) => image.id === currentImageId) ?? null,
    [images, currentImageId],
  );

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") || "dark";
    document.documentElement.setAttribute("data-theme", savedTheme);
    setTheme(savedTheme);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    if (!authConfigured) {
      setCurrentUser(null);
      setAuthReady(true);
      return undefined;
    }

    const unsubscribe = subscribeToAuthChanges((user) => {
      setCurrentUser(user);
      setAuthReady(true);
    });

    return unsubscribe;
  }, [authConfigured]);

  useEffect(() => {
    if (!authReady) return undefined;

    let cancelled = false;

    async function restoreHistory() {
      try {
        const savedHistory = await loadPersistedHistory(currentUser ?? null);

        if (!cancelled) {
          setHistory(Array.isArray(savedHistory) ? savedHistory : []);
        }
      } catch {
        if (!cancelled) {
          setHistory([]);
        }
      } finally {
        if (!cancelled) {
          setHistoryLoaded(true);
        }
      }
    }

    setHistoryLoaded(false);
    restoreHistory();

    return () => {
      cancelled = true;
    };
  }, [authReady, currentUser]);

  useEffect(() => {
    if (!authReady || !historyLoaded) return;

    let persistedHistory = history;
    let serializedHistory = JSON.stringify(persistedHistory);

    while (serializedHistory.length > MAX_PERSISTED_HISTORY_CHARS && persistedHistory.length > 0) {
      persistedHistory = persistedHistory.slice(0, -1);
      serializedHistory = JSON.stringify(persistedHistory);
    }

    if (persistedHistory !== history) {
      setHistory(persistedHistory);
      return;
    }

    savePersistedHistory(currentUser ?? null, persistedHistory).catch(() => {
      // Large HEIC/HEIF conversions can exceed browser storage limits.
      // Keep the app usable even when persistence fails.
    });
  }, [authReady, currentUser, history, historyLoaded]);

  useEffect(() => {
    if (isProcessing) return;

    const nextPendingImage = images.find((image) => !image.processed);
    if (!nextPendingImage) return;

    processImage(nextPendingImage);
  }, [images, isProcessing, selectedMode]);

  useEffect(() => {
    const node = comparisonContainerRef.current;
    if (!node) return undefined;

    const updateBounds = () => {
      setComparisonBounds({
        width: node.clientWidth,
        height: node.clientHeight,
      });
    };

    updateBounds();

    const observer = new ResizeObserver(updateBounds);
    observer.observe(node);

    return () => observer.disconnect();
  }, [currentImage]);

  useEffect(() => {
    let cancelled = false;

    async function measureImage() {
      if (!currentImage?.original) {
        setImageSize(null);
        return;
      }

      const measured = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = reject;
        img.src = currentImage.original;
      });

      if (!cancelled) {
        setImageSize(measured);
      }
    }

    measureImage();

    return () => {
      cancelled = true;
    };
  }, [currentImage]);

  useEffect(() => {
    let cancelled = false;

    async function updateDisplayImage() {
      if (!currentImage?.processed) {
        setDisplayImage(null);
        return;
      }

      const result = await renderStyledImage({
        processedImage: currentImage.processed,
        backgroundType,
        backgroundColor,
        backgroundImage,
        shadowEnabled,
        shadowBlur,
        shadowOpacity,
      });

      if (!cancelled) {
        setDisplayImage(result);
      }
    }

    updateDisplayImage();

    return () => {
      cancelled = true;
    };
  }, [currentImage, backgroundType, backgroundColor, backgroundImage, shadowEnabled, shadowBlur, shadowOpacity]);

  useEffect(() => {
    const handleKeydown = (event) => {
      if (event.key === "Escape") {
        setHistoryOpen(false);
      }
      if (event.key.toLowerCase() === "h" && !event.ctrlKey && !event.metaKey) {
        if (document.activeElement?.tagName !== "INPUT") {
          setHistoryOpen((value) => !value);
        }
      }
    };

    const handleMove = (event) => {
      const clientX = "touches" in event ? event.touches[0]?.clientX : event.clientX;
      if (typeof clientX !== "number") return;
      const sliderSurface = document.querySelector(".comparison-stage");
      if (!sliderSurface) return;
      const rect = sliderSurface.getBoundingClientRect();
      const position = ((clientX - rect.left) / rect.width) * 100;
      setSliderPosition(Math.max(0, Math.min(100, position)));
    };

    const handleStop = () => {};

    const handlePaste = async (event) => {
      const imageItem = Array.from(event.clipboardData?.items ?? []).find((item) =>
        item.type.startsWith("image/"),
      );
      if (!imageItem) return;
      const file = imageItem.getAsFile();
      if (!file) return;
      const original = await readFileAsDataUrl(file);
      await queueImages([{ name: "pasted-image.png", original }]);
    };

    window.addEventListener("keydown", handleKeydown);
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("touchmove", handleMove);
    window.addEventListener("mouseup", handleStop);
    window.addEventListener("touchend", handleStop);
    document.addEventListener("paste", handlePaste);

    return () => {
      window.removeEventListener("keydown", handleKeydown);
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("mouseup", handleStop);
      window.removeEventListener("touchend", handleStop);
      document.removeEventListener("paste", handlePaste);
    };
  }, []);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 3000);
  };

  const prepareUploadItems = async (files, { preserveRelativePath = false } = {}) => {
    const items = [];
    const hasHeicFiles = files.some(isHeicFile);

    if (hasHeicFiles) {
      showToast("Converting HEIC/HEIF images for upload...");
    }

    for (const file of files) {
      const normalizedFile = await normalizeUploadFile(file);
      items.push({
        name: preserveRelativePath ? file.webkitRelativePath || normalizedFile.name : normalizedFile.name,
        original: await readFileAsDataUrl(normalizedFile),
      });
    }

    return items;
  };

  const tryRemoveBackground = async (file, mode) => {
    const requestedType = removeBgTypeMap[mode] ?? "auto";
    const candidateTypes = [...new Set(removeBgFallbackTypes[mode] ?? [requestedType, "auto"])];
    let lastError = null;

    for (const type of candidateTypes) {
      try {
        return await removeBackgroundWithApi(file, {
          size: "auto",
          type,
        });
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError ?? new Error("Background removal processing failed");
  };

  const exportImage = (src, fileName) =>
    new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.width = img.width;
        canvas.height = img.height;

        if (selectedFormat === "jpg") {
          ctx.fillStyle = backgroundType === "transparent" ? "#ffffff" : backgroundColor;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        ctx.drawImage(img, 0, 0);

        const mimeType =
          selectedFormat === "jpg" ? "image/jpeg" : selectedFormat === "webp" ? "image/webp" : "image/png";

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(false);
              return;
            }
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = fileName;
            anchor.click();
            URL.revokeObjectURL(url);
            resolve(true);
          },
          mimeType,
          0.92,
        );
      };
      img.src = src;
    });

  const processImage = async (image) => {
    if (image.processed) return;

    setCurrentImageId(image.id);
    setIsProcessing(true);
    setProgress(0);

    const stages = [
      ["Analyzing image...", 20],
      ["Detecting subject...", 40],
      ["Refining edges...", 60],
      ["Generating mask...", 80],
      ["Finalizing...", 95],
    ];

    for (const [status, value] of stages) {
      setProcessingStatus(status);
      setProgress(value);
      await delay(350);
    }

    try {
      const file = await fetch(image.original)
        .then((response) => response.blob())
        .then((blob) => new File([blob], image.name, { type: blob.type || "image/png" }));

      const apiResult = await tryRemoveBackground(file, selectedMode);
      let processed = await cleanupResidualBackground(apiResult);

      if (selectedMode === "logo") {
        const visibleRatio = await measureVisibleAlphaRatio(processed);
        if (visibleRatio < 0.03) {
          processed = await createLogoCutout(image.original);
        }
      }

      setImages((prev) =>
        prev.map((item) => (item.id === image.id ? { ...item, processed, processedBase: processed } : item)),
      );
      setHistory((prev) => {
        const entry = {
          id: Date.now() + Math.random(),
          name: image.name,
          original: image.original,
          processed,
          timestamp: new Date().toLocaleString(),
        };
        return [entry, ...prev].slice(0, 20);
      });

      setProgress(100);
      showToast("Background removed successfully!");
    } catch (error) {
      const errorMessage = error.message || "Background removal processing failed";
      const isForegroundError = /foreground/i.test(errorMessage);
      showToast(
        isForegroundError
          ? "The background removal API could not isolate that subject. Try Auto Detect or Product mode, or use a clearer photo."
          : errorMessage,
        "error",
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const queueImages = async (items) => {
    const nextImages = items.map((item) =>
      createImageRecord(item.name, item.original, item.processed, item.processedBase ?? item.processed),
    );
    setImages((prev) => [...prev, ...nextImages]);

    if (nextImages[0]) {
      setCurrentImageId(nextImages[0].id);
    }
  };

  const handleFilesSelected = async (event) => {
    const files = Array.from(event.target.files ?? []).filter(isSupportedImageFile);
    if (!files.length) {
      showToast("No supported image files found. Try PNG, JPG, WebP, HEIC, or HEIF.", "error");
      event.target.value = "";
      return;
    }

    try {
      const items = await prepareUploadItems(files, { preserveRelativePath: true });
      await queueImages(items);
      showToast(`${items.length} image${items.length === 1 ? "" : "s"} added to the queue`);
    } catch {
      showToast("Some HEIC images could not be converted. Try another file or convert it before upload.", "error");
    }

    event.target.value = "";
  };

  const handleClipboardPaste = async () => {
    try {
      const clipboardItems = await navigator.clipboard.read();
      const collected = [];

      for (const item of clipboardItems) {
        for (const type of item.types) {
          if (!type.startsWith("image/")) continue;
          const blob = await item.getType(type);
          const file = new File([blob], "clipboard-image.png", { type: blob.type });
          collected.push({ name: file.name, original: await readFileAsDataUrl(file) });
        }
      }

      if (!collected.length) {
        showToast("No image found in clipboard", "error");
        return;
      }

      await queueImages(collected);
      showToast(`${collected.length} image${collected.length === 1 ? "" : "s"} added to the queue`);
    } catch {
      showToast("Unable to paste from clipboard", "error");
    }
  };

  const handleDownload = () => {
    if (!canDownload) {
      showToast("Please sign in with Google before downloading.", "error");
      return;
    }

    if (!displayImage) return;

    exportImage(displayImage, `backless-${Date.now()}.${selectedFormat}`).then((downloaded) => {
      if (downloaded) {
        showToast(`Image downloaded as ${selectedFormat.toUpperCase()}!`);
      }
    });
  };

  const handleDownloadAll = async () => {
    if (!canDownload) {
      showToast("Please sign in with Google before downloading.", "error");
      return;
    }

    const processedImages = images.filter((image) => image.processed);

    if (!processedImages.length) {
      showToast("No processed images available to download yet.", "error");
      return;
    }

    for (const [index, image] of processedImages.entries()) {
      const source = currentImage?.id === image.id && displayImage ? displayImage : image.processed;
      const safeBaseName = image.name.replace(/[\\/:*?"<>|]/g, "-").replace(/\.[^.]+$/, "") || `image-${index + 1}`;
      const fileName = `${safeBaseName}.${selectedFormat}`;
      await new Promise((resolve) => setTimeout(resolve, index === 0 ? 0 : 180));
      await exportImage(source, fileName);
    }

    showToast(`Started downloading ${processedImages.length} processed image${processedImages.length === 1 ? "" : "s"}.`);
  };

  const previewFrame = useMemo(() => {
    if (!imageSize?.width || !imageSize?.height || !comparisonBounds.width || !comparisonBounds.height) {
      return null;
    }

    const ratio = imageSize.width / imageSize.height;
    let width = comparisonBounds.width;
    let height = width / ratio;

    if (height > comparisonBounds.height) {
      height = comparisonBounds.height;
      width = height * ratio;
    }

    return {
      width: Math.max(1, width),
      height: Math.max(1, height),
    };
  }, [imageSize, comparisonBounds]);

  const scrollToSection = (target) => {
    if (target === "features") {
      if (currentImage) {
        setCurrentImageId(null);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            heroSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
          });
        });
        return;
      }

      heroSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    if (target === "editor") {
      if (!currentImage && images.length > 0) {
        setCurrentImageId(images[0].id);
        requestAnimationFrame(() => {
          editorSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
        return;
      }

      if (currentImage) {
        editorSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        showToast("Upload an image first to open the editor.", "error");
      }
      return;
    }

    if (target === "history") {
      setHistoryOpen(true);
    }
  };

  const handleGoogleSignIn = async () => {
    if (isSigningIn) return;

    if (!authConfigured) {
      showToast("Add Firebase env keys in .env to enable Google sign-in.", "error");
      return;
    }

    setIsSigningIn(true);

    try {
      await signInWithGooglePopup();
      showToast("Signed in with Google.");
    } catch (error) {
      showToast(getGoogleAuthErrorMessage(error), "error");
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleGoogleSignOut = async () => {
    try {
      await signOutFromGoogle();
      showToast("Signed out.");
    } catch (error) {
      showToast(error.message || "Sign out failed.", "error");
    }
  };

  return (
    <div className="app-shell">
      <div className="bg-pattern" />
      <Header
        theme={theme}
        onToggleTheme={() => setTheme((value) => (value === "dark" ? "light" : "dark"))}
        onNavigate={scrollToSection}
        authReady={authReady}
        authConfigured={authConfigured}
        currentUser={currentUser}
        isSigningIn={isSigningIn}
        onSignIn={handleGoogleSignIn}
        onSignOut={handleGoogleSignOut}
      />

      <main className="app-main shell">
        {!currentImage ? (
          <div ref={heroSectionRef}>
            <HeroSection
              onBrowseClick={() => uploadInputRef.current?.click()}
              onBrowseFolderClick={() => folderInputRef.current?.click()}
              onPasteClick={handleClipboardPaste}
              onFilesSelected={handleFilesSelected}
              uploadZoneRef={null}
              isDragOver={isDragOver}
              onDragEnter={(event) => {
                event.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                if (!event.currentTarget.contains(event.relatedTarget)) {
                  setIsDragOver(false);
                }
              }}
              onDrop={async (event) => {
                event.preventDefault();
                setIsDragOver(false);
                const files = Array.from(event.dataTransfer.files ?? []).filter(isSupportedImageFile);
                if (!files.length) {
                  showToast("Please upload PNG, JPG, WebP, HEIC, or HEIF images.", "error");
                  return;
                }
                try {
                  const items = await prepareUploadItems(files);
                  await queueImages(items);
                  showToast(`${items.length} image${items.length === 1 ? "" : "s"} added to the queue`);
                } catch {
                  showToast("Some HEIC images could not be converted. Try another file or convert it before upload.", "error");
                }
              }}
            />
          </div>
        ) : (
          <div ref={editorSectionRef}>
            <EditorSection
              isProcessing={isProcessing}
              comparisonContainerRef={comparisonContainerRef}
              processingStatus={processingStatus}
              progress={progress}
              currentImage={currentImage}
              displayImage={displayImage}
              previewFrame={previewFrame}
              sliderPosition={sliderPosition}
              panOffset={panOffset}
              onSliderStart={(event) => {
                event.stopPropagation();
                const clientX = "touches" in event ? event.touches[0].clientX : event.clientX;
                const rect = document.querySelector(".comparison-stage")?.getBoundingClientRect();
                if (!rect) return;
                const position = ((clientX - rect.left) / rect.width) * 100;
                setSliderPosition(Math.max(0, Math.min(100, position)));
              }}
              onBack={() => setCurrentImageId(null)}
              zoomLevel={zoomLevel}
              onZoomIn={() => setZoomLevel((value) => Math.min(200, value + 25))}
              onZoomOut={() => setZoomLevel((value) => Math.max(25, value - 25))}
              selectedFormat={selectedFormat}
              onFormatChange={setSelectedFormat}
              onDownload={handleDownload}
              canDownload={canDownload}
              backgroundType={backgroundType}
              onBackgroundTypeChange={setBackgroundType}
              backgroundColor={backgroundColor}
              onBackgroundColorChange={setBackgroundColor}
              onCustomColorChange={(event) => setBackgroundColor(event.target.value)}
              onBackgroundUpload={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                setBackgroundImage(await readFileAsDataUrl(file));
                event.target.value = "";
              }}
              shadowEnabled={shadowEnabled}
              onShadowToggle={() => setShadowEnabled((value) => !value)}
              shadowBlur={shadowBlur}
              onShadowBlurChange={(event) => setShadowBlur(Number(event.target.value))}
              shadowOpacity={shadowOpacity}
              onShadowOpacityChange={(event) => setShadowOpacity(Number(event.target.value))}
              images={images}
              onSelectImage={async (id) => {
                const next = images.find((image) => image.id === id);
                if (!next) return;
                setCurrentImageId(id);
              }}
              onAddMore={() => uploadInputRef.current?.click()}
              onAddFolder={() => folderInputRef.current?.click()}
              onDownloadAll={handleDownloadAll}
            />
          </div>
        )}

        <input
          ref={uploadInputRef}
          type="file"
          accept="image/*,.heic,.heif"
          multiple
          className="hidden-input"
          onChange={handleFilesSelected}
        />
        <input
          ref={folderInputRef}
          type="file"
          accept="image/*,.heic,.heif"
          multiple
          directory=""
          webkitdirectory=""
          className="hidden-input"
          onChange={handleFilesSelected}
        />

        {!apiKeyConfigured ? (
          <p className="api-hint">
            Add `VITE_PHOTOROOM_API_KEY=...` or `VITE_REMOVEBG_API_KEY=...` in `.env`, then restart the Vite dev server.
          </p>
        ) : null}
        {!authConfigured ? (
          <p className="api-hint">Add Firebase Google Auth keys in `.env` to enable Gmail login.</p>
        ) : null}
          {authReady && !canDownload ? (
            <p className="api-hint">Sign in with Google first before downloading processed images.</p>
          ) : null}
      </main>

      <HistoryPanel
        open={historyOpen}
        history={history}
        onClose={() => setHistoryOpen(false)}
        onRestore={async (id) => {
          const entry = history.find((item) => item.id === id);
          if (!entry) return;
          await queueImages([
            {
              name: entry.name,
              original: entry.original,
              processed: entry.processed,
              processedBase: entry.processed,
            },
          ]);
          setHistoryOpen(false);
        }}
      />

      <button type="button" className="history-toggle tool-btn" aria-label="Open history" onClick={() => setHistoryOpen((value) => !value)}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      </button>

      <Toast toast={toast} />
      <Footer />
    </div>
  );
}
