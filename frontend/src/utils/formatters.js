export const formatDate = (isoString) => {
  if (!isoString) return "";
  const date = new Date(isoString);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
};

export const formatDuration = (sec) => {
  const num = parseFloat(sec);
  if (isNaN(num)) return "0.00s";
  return `${num.toFixed(2)}s`;
};

export const formatPercentage = (val) => {
  const num = parseFloat(val);
  if (isNaN(num)) return "0.0%";
  return `${num.toFixed(1)}%`;
};

export const formatConfidence = (val) => {
  const num = parseFloat(val);
  if (isNaN(num)) return "—";
  if (num <= 1.0 && num > 0) {
    return `${(num * 100).toFixed(2)}%`;
  }
  return `${num.toFixed(2)}%`;
};

export const getBboxStyle = (bbox, imageDims) => {
  if (!bbox) return { left: "0%", top: "0%", width: "0%", height: "0%" };

  let x1 = bbox.x1 ?? bbox.left;
  let y1 = bbox.y1 ?? bbox.top;
  let x2 = bbox.x2;
  let y2 = bbox.y2;

  if (x2 === undefined && bbox.width !== undefined && x1 !== undefined) {
    x2 = x1 + bbox.width;
  }
  if (y2 === undefined && bbox.height !== undefined && y1 !== undefined) {
    y2 = y1 + bbox.height;
  }

  if (x1 === undefined || y1 === undefined || x2 === undefined || y2 === undefined) {
    return { left: "0%", top: "0%", width: "0%", height: "0%" };
  }

  // If normalized float coordinates (0 <= val <= 1.0)
  if (x1 <= 1.0 && y1 <= 1.0 && x2 <= 1.0 && y2 <= 1.0 && (x1 > 0 || y1 > 0 || x2 > 0 || y2 > 0)) {
    return {
      left: `${(x1 * 100).toFixed(2)}%`,
      top: `${(y1 * 100).toFixed(2)}%`,
      width: `${((x2 - x1) * 100).toFixed(2)}%`,
      height: `${((y2 - y1) * 100).toFixed(2)}%`,
    };
  }

  // Pixel coordinates relative to image width / height
  const imgWidth = imageDims?.width || 600;
  const imgHeight = imageDims?.height || 400;

  if (x2 > 100 || y2 > 100 || (imageDims && imageDims.width)) {
    return {
      left: `${((x1 / imgWidth) * 100).toFixed(2)}%`,
      top: `${((y1 / imgHeight) * 100).toFixed(2)}%`,
      width: `${(((x2 - x1) / imgWidth) * 100).toFixed(2)}%`,
      height: `${(((y2 - y1) / imgHeight) * 100).toFixed(2)}%`,
    };
  }

  // Percentage values 0 to 100
  return {
    left: `${x1}%`,
    top: `${y1}%`,
    width: `${x2 - x1}%`,
    height: `${y2 - y1}%`,
  };
};
