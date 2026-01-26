/**
 * useAsfImage Hook - Load ASF files and convert to usable images
 * Based on C# Utils.GetAsf() pattern
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { loadAsf, getFrameCanvas, type AsfData } from "../../../engine/asf";

export interface AsfImageData {
  asf: AsfData | null;
  dataUrl: string | null;
  width: number;
  height: number;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook to load an ASF file and get image data
 */
export function useAsfImage(path: string | null, frameIndex: number = 0): AsfImageData {
  const [asf, setAsf] = useState<AsfData | null>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!path) {
      setAsf(null);
      setDataUrl(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    // Normalize path - remove leading backslash and convert to forward slashes
    let normalizedPath = path.replace(/\\/g, "/");
    if (normalizedPath.startsWith("/")) {
      normalizedPath = normalizedPath.substring(1);
    }

    // Prepend resources path
    const fullPath = `/resources/${normalizedPath}`;

    loadAsf(fullPath)
      .then((data) => {
        if (cancelled) return;
        if (data) {
          setAsf(data);
          // Generate data URL for the specified frame
          if (data.frames.length > 0) {
            const idx = Math.min(frameIndex, data.frames.length - 1);
            const canvas = getFrameCanvas(data.frames[idx]);
            setDataUrl(canvas.toDataURL());
          }
        } else {
          setError(`Failed to load ASF: ${fullPath}`);
        }
        setIsLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [path, frameIndex]);

  return {
    asf,
    dataUrl,
    width: asf?.width ?? 0,
    height: asf?.height ?? 0,
    isLoading,
    error,
  };
}

/**
 * Hook to load multiple ASF files
 */
export function useMultipleAsfImages(
  paths: (string | null)[]
): Map<string, AsfImageData> {
  const [results, setResults] = useState<Map<string, AsfImageData>>(new Map());

  useEffect(() => {
    const newResults = new Map<string, AsfImageData>();
    let cancelled = false;

    const loadAll = async () => {
      for (const path of paths) {
        if (!path) continue;

        // Normalize path
        let normalizedPath = path.replace(/\\/g, "/");
        if (normalizedPath.startsWith("/")) {
          normalizedPath = normalizedPath.substring(1);
        }
        const fullPath = `/resources/${normalizedPath}`;

        try {
          const data = await loadAsf(fullPath);
          if (cancelled) return;

          if (data && data.frames.length > 0) {
            const canvas = getFrameCanvas(data.frames[0]);
            newResults.set(path, {
              asf: data,
              dataUrl: canvas.toDataURL(),
              width: data.width,
              height: data.height,
              isLoading: false,
              error: null,
            });
          }
        } catch (err) {
          if (cancelled) return;
          newResults.set(path, {
            asf: null,
            dataUrl: null,
            width: 0,
            height: 0,
            isLoading: false,
            error: (err as Error).message,
          });
        }
      }

      if (!cancelled) {
        setResults(new Map(newResults));
      }
    };

    loadAll();

    return () => {
      cancelled = true;
    };
  }, [paths.join(",")]);

  return results;
}

/**
 * Get frame data URL from ASF for a specific frame
 */
export function getAsfFrameDataUrl(asf: AsfData | null, frameIndex: number): string | null {
  if (!asf || asf.frames.length === 0) return null;
  const idx = Math.min(frameIndex, asf.frames.length - 1);
  const canvas = getFrameCanvas(asf.frames[idx]);
  return canvas.toDataURL();
}

/**
 * Hook to create a ColumnView-style clipped image (transparent from top based on percent)
 */
export function useColumnView(
  path: string | null,
  percent: number // 0 to 1, how much to show from bottom
): { dataUrl: string | null; width: number; height: number; isLoading: boolean } {
  const { asf, isLoading } = useAsfImage(path, 0);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!asf || asf.frames.length === 0) {
      setDataUrl(null);
      return;
    }

    const frame = asf.frames[0];
    const srcCanvas = getFrameCanvas(frame);

    // Create a new canvas for the clipped result
    if (!canvasRef.current) {
      canvasRef.current = document.createElement("canvas");
    }
    const canvas = canvasRef.current;
    canvas.width = frame.width;
    canvas.height = frame.height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Calculate visible height from bottom
    const visibleHeight = Math.floor(frame.height * Math.max(0, Math.min(1, percent)));
    const startY = frame.height - visibleHeight;

    if (visibleHeight > 0) {
      // Draw only the bottom portion
      ctx.drawImage(
        srcCanvas,
        0, startY, frame.width, visibleHeight, // source
        0, startY, frame.width, visibleHeight  // destination
      );
    }

    setDataUrl(canvas.toDataURL());
  }, [asf, percent]);

  return {
    dataUrl,
    width: asf?.width ?? 0,
    height: asf?.height ?? 0,
    isLoading,
  };
}
