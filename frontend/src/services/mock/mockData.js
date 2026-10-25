// ============================================================================
// SINGLE SOURCE OF STATIC MOCK DATA
// ----------------------------------------------------------------------------
// Everything in this file is FIXED and deterministic. There is intentionally
// NO Math.random(), NO timers, and NO data mutation. When the real backend is
// ready, switch API_CONFIG.useMock to false and these values are ignored.
// ============================================================================

export const PCB_MODELS = [
  "Raspberry Pi 4 Model B",
  "Jetson Nano Carrier Board",
  "Custom STM32 MCU Controller",
  "ESP32-WROOM IoT Gateway",
  "Dual-Motor Drive PCB v2.1",
];

export const DEFECT_TYPES = {
  SOLDER_BRIDGE: "Solder Bridge",
  MISSING_COMP: "Missing Component",
  POLARITY: "Polarity Mismatch",
  MISALIGNMENT: "Misalignment",
  WRONG_PART: "Wrong Part",
  NONE: "None",
};

// ---- Dashboard statistics -----------------------------------------------
export const MOCK_STATISTICS = {
  today: {
    inspected: 1259,
    pass: 1161,
    fail: 98,
    passRate: 78,
    avgCycleTime: 1.34,
    systemUptime: "14h 32m",
    rpiTemp: "48.2°C",
    cpu: "24%",
    fps: 29.8,
  },
  yesterday: {
    inspected: 1210,
    pass: 1113,
    fail: 97,
    passRate: 92.0,
    avgCycleTime: 1.41,
  },
};

// ---- Latest inspection result (static) -----------------------------------
export const MOCK_INSPECTION_RESULT = {
  inspectionId: "INSP-2026-0001",
  pcbId: "PCB-2026-7954",
  timestamp: "2026-07-24T14:32:05.000Z",
  status: "PASS",
  confidence: 98.5,
  cycleTime: "1.34s",
  model: "YOLOv8x-PCB-v3.2",
  gradCamLayer: "YOLO_head/cv3_d1",
  componentsCount: 42,
  detections: [
    { id: "U1", label: "U1 (STM32F4)", confidence: 99.8, bbox: { left: 40, top: 35, width: 25, height: 28 } },
    { id: "U2", label: "U2 (LM1117)", confidence: 99.4, bbox: { left: 15, top: 15, width: 15, height: 20 } },
    { id: "C12", label: "C12 (CAP)", confidence: 98.4, bbox: { left: 70, top: 60, width: 14, height: 18 } },
  ],
  defects: [],
  xaiExplanation:
    "No structural anomalies detected on the PCB. Grad-CAM activations align with expected component pad locations and trace orientations at high confidence.",
  verificationDetails: {
    presence: [
      { component: "U1 (Main IC)", status: "PASS", confidence: 99.8 },
      { component: "U2 (Voltage Regulator)", status: "PASS", confidence: 99.4 },
      { component: "C12 (Filter Cap)", status: "PASS", confidence: 98.4 },
      { component: "C13 (Filter Cap)", status: "PASS", confidence: 99.1 },
      { component: "R8 (Pull-up)", status: "PASS", confidence: 97.9 },
      { component: "D4 (Ind LED)", status: "PASS", confidence: 98.7 },
    ],
    position: [
      { component: "U1", offset: "0.01mm, -0.02mm", limit: "0.10mm", status: "PASS" },
      { component: "U2", offset: "0.03mm, 0.04mm", limit: "0.15mm", status: "PASS" },
      { component: "C12", offset: "0.02mm, 0.01mm", limit: "0.15mm", status: "PASS" },
      { component: "R8", offset: "0.05mm, -0.05mm", limit: "0.20mm", status: "PASS" },
    ],
    orientation: [
      { component: "U1", rotation: "0.2°", limit: "1.0°", status: "PASS" },
      { component: "D4 (Ind LED)", rotation: "0.5°", limit: "5.0°", status: "PASS" },
      { component: "R8", rotation: "1.1°", limit: "5.0°", status: "PASS" },
    ],
    count: {
      ic: { detected: 2, expected: 2, status: "PASS" },
      capacitors: { detected: 14, expected: 14, status: "PASS" },
      resistors: { detected: 24, expected: 24, status: "PASS" },
    },
  },
  componentDetails: [
    { name: "U1 (Main IC)", status: "PASS", confidence: 99.8, reason: "All pins detected, orientation correct", presence: true, position: true, orientation: true, count: true },
    { name: "C12 (Filter Cap)", status: "PASS", confidence: 98.4, reason: "Capacitance within tolerance", presence: true, position: true, orientation: true, count: true },
    { name: "R8 (Pull-up)", status: "PASS", confidence: 97.9, reason: "Resistance value nominal", presence: true, position: true, orientation: true, count: true },
  ],
};

// ---- Inspection history (static, deterministic) --------------------------
export const MOCK_INSPECTION_HISTORY = [
  {
    id: "PCB-2026-1001",
    timestamp: "2026-07-24T08:05:00.000Z",
    model: "Raspberry Pi 4 Model B",
    status: "PASS",
    defect: "None",
    confidence: "98.5",
    cycleTime: "1.31",
    operator: "Operator_Pi4_01",
    componentsCount: 42,
    defectCoordinates: null,
    gradCamExplanation:
      "No structural anomalies detected on the PCB. Grad-CAM activations align with expected component pad locations.",
    verificationDetails: {
      presence: [
        { component: "U1 (Main IC)", status: "PASS", confidence: 99.8 },
        { component: "U2 (Voltage Regulator)", status: "PASS", confidence: 99.4 },
        { component: "C12 (Filter Cap)", status: "PASS", confidence: 98.4 },
        { component: "C13 (Filter Cap)", status: "PASS", confidence: 99.1 },
        { component: "R8 (Pull-up)", status: "PASS", confidence: 97.9 },
        { component: "D4 (Ind LED)", status: "PASS", confidence: 98.7 },
      ],
      position: [
        { component: "U1", offset: "0.01mm, -0.02mm", limit: "0.10mm", status: "PASS" },
        { component: "U2", offset: "0.03mm, 0.04mm", limit: "0.15mm", status: "PASS" },
        { component: "C12", offset: "0.02mm, 0.01mm", limit: "0.15mm", status: "PASS" },
        { component: "R8", offset: "0.05mm, -0.05mm", limit: "0.20mm", status: "PASS" },
      ],
      orientation: [
        { component: "U1", rotation: "0.2°", limit: "1.0°", status: "PASS" },
        { component: "D4 (Ind LED)", rotation: "0.5°", limit: "5.0°", status: "PASS" },
        { component: "R8", rotation: "1.1°", limit: "5.0°", status: "PASS" },
      ],
    },
  },
  {
    id: "PCB-2026-1002",
    timestamp: "2026-07-24T07:58:00.000Z",
    model: "ESP32-WROOM IoT Gateway",
    status: "FAIL",
    defect: "Missing Component",
    confidence: "72.4",
    cycleTime: "1.47",
    operator: "Operator_Pi4_02",
    componentsCount: 38,
    defectCoordinates: { x: 260, y: 180, radius: 45 },
    gradCamExplanation:
      "Defect Detected: Missing Component. YOLO model located a structural anomaly at region (260, 180). Grad-CAM highlighting reflects significant deviation in pixel intensity gradients.",
    verificationDetails: {
      presence: [
        { component: "U1 (Main IC)", status: "PASS", confidence: 99.8 },
        { component: "U2 (Voltage Regulator)", status: "PASS", confidence: 99.4 },
        { component: "C12 (Filter Cap)", status: "FAIL", confidence: 12.3 },
        { component: "C13 (Filter Cap)", status: "PASS", confidence: 99.1 },
        { component: "R8 (Pull-up)", status: "PASS", confidence: 97.9 },
        { component: "D4 (Ind LED)", status: "PASS", confidence: 98.7 },
      ],
      position: [
        { component: "U1", offset: "0.01mm, -0.02mm", limit: "0.10mm", status: "PASS" },
        { component: "U2", offset: "0.03mm, 0.04mm", limit: "0.15mm", status: "PASS" },
        { component: "C12", offset: "0.02mm, 0.01mm", limit: "0.15mm", status: "PASS" },
        { component: "R8", offset: "0.05mm, -0.05mm", limit: "0.20mm", status: "PASS" },
      ],
      orientation: [
        { component: "U1", rotation: "0.2°", limit: "1.0°", status: "PASS" },
        { component: "D4 (Ind LED)", rotation: "0.5°", limit: "5.0°", status: "PASS" },
        { component: "R8", rotation: "1.1°", limit: "5.0°", status: "PASS" },
      ],
    },
  },
  {
    id: "PCB-2026-1003",
    timestamp: "2026-07-24T07:31:00.000Z",
    model: "Custom STM32 MCU Controller",
    status: "PASS",
    defect: "None",
    confidence: "97.9",
    cycleTime: "1.28",
    operator: "Operator_Pi4_01",
    componentsCount: 40,
    defectCoordinates: null,
    gradCamExplanation:
      "No structural anomalies detected on the PCB. Grad-CAM activations align with expected component pad locations.",
    verificationDetails: {
      presence: [
        { component: "U1 (Main IC)", status: "PASS", confidence: 99.8 },
        { component: "U2 (Voltage Regulator)", status: "PASS", confidence: 99.4 },
        { component: "C12 (Filter Cap)", status: "PASS", confidence: 98.4 },
        { component: "C13 (Filter Cap)", status: "PASS", confidence: 99.1 },
        { component: "R8 (Pull-up)", status: "PASS", confidence: 97.9 },
        { component: "D4 (Ind LED)", status: "PASS", confidence: 98.7 },
      ],
      position: [
        { component: "U1", offset: "0.01mm, -0.02mm", limit: "0.10mm", status: "PASS" },
        { component: "U2", offset: "0.03mm, 0.04mm", limit: "0.15mm", status: "PASS" },
        { component: "C12", offset: "0.02mm, 0.01mm", limit: "0.15mm", status: "PASS" },
        { component: "R8", offset: "0.05mm, -0.05mm", limit: "0.20mm", status: "PASS" },
      ],
      orientation: [
        { component: "U1", rotation: "0.2°", limit: "1.0°", status: "PASS" },
        { component: "D4 (Ind LED)", rotation: "0.5°", limit: "5.0°", status: "PASS" },
        { component: "R8", rotation: "1.1°", limit: "5.0°", status: "PASS" },
      ],
    },
  },
  {
    id: "PCB-2026-1004",
    timestamp: "2026-07-24T06:52:00.000Z",
    model: "Jetson Nano Carrier Board",
    status: "PASS",
    defect: "None",
    confidence: "98.2",
    cycleTime: "1.36",
    operator: "Operator_Pi4_03",
    componentsCount: 51,
    defectCoordinates: null,
    gradCamExplanation:
      "No structural anomalies detected on the PCB. Grad-CAM activations align with expected component pad locations.",
    verificationDetails: {
      presence: [
        { component: "U1 (Main IC)", status: "PASS", confidence: 99.8 },
        { component: "U2 (Voltage Regulator)", status: "PASS", confidence: 99.4 },
        { component: "C12 (Filter Cap)", status: "PASS", confidence: 98.4 },
        { component: "C13 (Filter Cap)", status: "PASS", confidence: 99.1 },
        { component: "R8 (Pull-up)", status: "PASS", confidence: 97.9 },
        { component: "D4 (Ind LED)", status: "PASS", confidence: 98.7 },
      ],
      position: [
        { component: "U1", offset: "0.01mm, -0.02mm", limit: "0.10mm", status: "PASS" },
        { component: "U2", offset: "0.03mm, 0.04mm", limit: "0.15mm", status: "PASS" },
        { component: "C12", offset: "0.02mm, 0.01mm", limit: "0.15mm", status: "PASS" },
        { component: "R8", offset: "0.05mm, -0.05mm", limit: "0.20mm", status: "PASS" },
      ],
      orientation: [
        { component: "U1", rotation: "0.2°", limit: "1.0°", status: "PASS" },
        { component: "D4 (Ind LED)", rotation: "0.5°", limit: "5.0°", status: "PASS" },
        { component: "R8", rotation: "1.1°", limit: "5.0°", status: "PASS" },
      ],
    },
  },
  {
    id: "PCB-2026-1005",
    timestamp: "2026-07-23T18:22:00.000Z",
    model: "Raspberry Pi 4 Model B",
    status: "FAIL",
    defect: "Solder Bridge",
    confidence: "81.7",
    cycleTime: "1.52",
    operator: "Operator_Pi4_02",
    componentsCount: 42,
    defectCoordinates: { x: 320, y: 210, radius: 48 },
    gradCamExplanation:
      "Defect Detected: Solder Bridge. YOLO model located a structural anomaly at region (320, 210). Grad-CAM highlighting reflects significant deviation in pixel intensity gradients.",
    verificationDetails: {
      presence: [
        { component: "U1 (Main IC)", status: "PASS", confidence: 99.8 },
        { component: "U2 (Voltage Regulator)", status: "PASS", confidence: 99.4 },
        { component: "C12 (Filter Cap)", status: "PASS", confidence: 98.4 },
        { component: "C13 (Filter Cap)", status: "PASS", confidence: 99.1 },
        { component: "R8 (Pull-up)", status: "PASS", confidence: 97.9 },
        { component: "D4 (Ind LED)", status: "PASS", confidence: 98.7 },
      ],
      position: [
        { component: "U1", offset: "0.01mm, -0.02mm", limit: "0.10mm", status: "PASS" },
        { component: "U2", offset: "0.03mm, 0.04mm", limit: "0.15mm", status: "PASS" },
        { component: "C12", offset: "0.02mm, 0.01mm", limit: "0.15mm", status: "PASS" },
        { component: "R8", offset: "0.05mm, -0.05mm", limit: "0.20mm", status: "PASS" },
      ],
      orientation: [
        { component: "U1", rotation: "0.2°", limit: "1.0°", status: "PASS" },
        { component: "D4 (Ind LED)", rotation: "0.5°", limit: "5.0°", status: "PASS" },
        { component: "R8", rotation: "1.1°", limit: "5.0°", status: "PASS" },
      ],
    },
  },
  {
    id: "PCB-2026-1006",
    timestamp: "2026-07-23T17:05:00.000Z",
    model: "ESP32-WROOM IoT Gateway",
    status: "PASS",
    defect: "None",
    confidence: "98.8",
    cycleTime: "1.29",
    operator: "Operator_Pi4_01",
    componentsCount: 38,
    defectCoordinates: null,
    gradCamExplanation:
      "No structural anomalies detected on the PCB. Grad-CAM activations align with expected component pad locations.",
    verificationDetails: {
      presence: [
        { component: "U1 (Main IC)", status: "PASS", confidence: 99.8 },
        { component: "U2 (Voltage Regulator)", status: "PASS", confidence: 99.4 },
        { component: "C12 (Filter Cap)", status: "PASS", confidence: 98.4 },
        { component: "C13 (Filter Cap)", status: "PASS", confidence: 99.1 },
        { component: "R8 (Pull-up)", status: "PASS", confidence: 97.9 },
        { component: "D4 (Ind LED)", status: "PASS", confidence: 98.7 },
      ],
      position: [
        { component: "U1", offset: "0.01mm, -0.02mm", limit: "0.10mm", status: "PASS" },
        { component: "U2", offset: "0.03mm, 0.04mm", limit: "0.15mm", status: "PASS" },
        { component: "C12", offset: "0.02mm, 0.01mm", limit: "0.15mm", status: "PASS" },
        { component: "R8", offset: "0.05mm, -0.05mm", limit: "0.20mm", status: "PASS" },
      ],
      orientation: [
        { component: "U1", rotation: "0.2°", limit: "1.0°", status: "PASS" },
        { component: "D4 (Ind LED)", rotation: "0.5°", limit: "5.0°", status: "PASS" },
        { component: "R8", rotation: "1.1°", limit: "5.0°", status: "PASS" },
      ],
    },
  },
  {
    id: "PCB-2026-1007",
    timestamp: "2026-07-23T15:40:00.000Z",
    model: "Dual-Motor Drive PCB v2.1",
    status: "PASS",
    defect: "None",
    confidence: "97.5",
    cycleTime: "1.41",
    operator: "Operator_Pi4_03",
    componentsCount: 36,
    defectCoordinates: null,
    gradCamExplanation:
      "No structural anomalies detected on the PCB. Grad-CAM activations align with expected component pad locations.",
    verificationDetails: {
      presence: [
        { component: "U1 (Main IC)", status: "PASS", confidence: 99.8 },
        { component: "U2 (Voltage Regulator)", status: "PASS", confidence: 99.4 },
        { component: "C12 (Filter Cap)", status: "PASS", confidence: 98.4 },
        { component: "C13 (Filter Cap)", status: "PASS", confidence: 99.1 },
        { component: "R8 (Pull-up)", status: "PASS", confidence: 97.9 },
        { component: "D4 (Ind LED)", status: "PASS", confidence: 98.7 },
      ],
      position: [
        { component: "U1", offset: "0.01mm, -0.02mm", limit: "0.10mm", status: "PASS" },
        { component: "U2", offset: "0.03mm, 0.04mm", limit: "0.15mm", status: "PASS" },
        { component: "C12", offset: "0.02mm, 0.01mm", limit: "0.15mm", status: "PASS" },
        { component: "R8", offset: "0.05mm, -0.05mm", limit: "0.20mm", status: "PASS" },
      ],
      orientation: [
        { component: "U1", rotation: "0.2°", limit: "1.0°", status: "PASS" },
        { component: "D4 (Ind LED)", rotation: "0.5°", limit: "5.0°", status: "PASS" },
        { component: "R8", rotation: "1.1°", limit: "5.0°", status: "PASS" },
      ],
    },
  },
  {
    id: "PCB-2026-1008",
    timestamp: "2026-07-23T14:12:00.000Z",
    model: "Custom STM32 MCU Controller",
    status: "PASS",
    defect: "None",
    confidence: "98.1",
    cycleTime: "1.33",
    operator: "Operator_Pi4_02",
    componentsCount: 40,
    defectCoordinates: null,
    gradCamExplanation:
      "No structural anomalies detected on the PCB. Grad-CAM activations align with expected component pad locations.",
    verificationDetails: {
      presence: [
        { component: "U1 (Main IC)", status: "PASS", confidence: 99.8 },
        { component: "U2 (Voltage Regulator)", status: "PASS", confidence: 99.4 },
        { component: "C12 (Filter Cap)", status: "PASS", confidence: 98.4 },
        { component: "C13 (Filter Cap)", status: "PASS", confidence: 99.1 },
        { component: "R8 (Pull-up)", status: "PASS", confidence: 97.9 },
        { component: "D4 (Ind LED)", status: "PASS", confidence: 98.7 },
      ],
      position: [
        { component: "U1", offset: "0.01mm, -0.02mm", limit: "0.10mm", status: "PASS" },
        { component: "U2", offset: "0.03mm, 0.04mm", limit: "0.15mm", status: "PASS" },
        { component: "C12", offset: "0.02mm, 0.01mm", limit: "0.15mm", status: "PASS" },
        { component: "R8", offset: "0.05mm, -0.05mm", limit: "0.20mm", status: "PASS" },
      ],
      orientation: [
        { component: "U1", rotation: "0.2°", limit: "1.0°", status: "PASS" },
        { component: "D4 (Ind LED)", rotation: "0.5°", limit: "5.0°", status: "PASS" },
        { component: "R8", rotation: "1.1°", limit: "5.0°", status: "PASS" },
      ],
    },
  },
  {
    id: "PCB-2026-1009",
    timestamp: "2026-07-23T11:55:00.000Z",
    model: "Jetson Nano Carrier Board",
    status: "FAIL",
    defect: "Misalignment",
    confidence: "77.3",
    cycleTime: "1.58",
    operator: "Operator_Pi4_01",
    componentsCount: 51,
    defectCoordinates: { x: 240, y: 150, radius: 42 },
    gradCamExplanation:
      "Defect Detected: Misalignment. YOLO model located a structural anomaly at region (240, 150). Grad-CAM highlighting reflects significant deviation in pixel intensity gradients.",
    verificationDetails: {
      presence: [
        { component: "U1 (Main IC)", status: "PASS", confidence: 99.8 },
        { component: "U2 (Voltage Regulator)", status: "PASS", confidence: 99.4 },
        { component: "C12 (Filter Cap)", status: "PASS", confidence: 98.4 },
        { component: "C13 (Filter Cap)", status: "PASS", confidence: 99.1 },
        { component: "R8 (Pull-up)", status: "PASS", confidence: 97.9 },
        { component: "D4 (Ind LED)", status: "PASS", confidence: 98.7 },
      ],
      position: [
        { component: "U1", offset: "0.01mm, -0.02mm", limit: "0.10mm", status: "PASS" },
        { component: "U2", offset: "0.18mm, -0.12mm", limit: "0.15mm", status: "FAIL" },
        { component: "C12", offset: "0.02mm, 0.01mm", limit: "0.15mm", status: "PASS" },
        { component: "R8", offset: "0.05mm, -0.05mm", limit: "0.20mm", status: "PASS" },
      ],
      orientation: [
        { component: "U1", rotation: "0.2°", limit: "1.0°", status: "PASS" },
        { component: "D4 (Ind LED)", rotation: "0.5°", limit: "5.0°", status: "PASS" },
        { component: "R8", rotation: "1.1°", limit: "5.0°", status: "PASS" },
      ],
    },
  },
  {
    id: "PCB-2026-1010",
    timestamp: "2026-07-23T10:20:00.000Z",
    model: "Raspberry Pi 4 Model B",
    status: "PASS",
    defect: "None",
    confidence: "98.9",
    cycleTime: "1.27",
    operator: "Operator_Pi4_03",
    componentsCount: 42,
    defectCoordinates: null,
    gradCamExplanation:
      "No structural anomalies detected on the PCB. Grad-CAM activations align with expected component pad locations.",
    verificationDetails: {
      presence: [
        { component: "U1 (Main IC)", status: "PASS", confidence: 99.8 },
        { component: "U2 (Voltage Regulator)", status: "PASS", confidence: 99.4 },
        { component: "C12 (Filter Cap)", status: "PASS", confidence: 98.4 },
        { component: "C13 (Filter Cap)", status: "PASS", confidence: 99.1 },
        { component: "R8 (Pull-up)", status: "PASS", confidence: 97.9 },
        { component: "D4 (Ind LED)", status: "PASS", confidence: 98.7 },
      ],
      position: [
        { component: "U1", offset: "0.01mm, -0.02mm", limit: "0.10mm", status: "PASS" },
        { component: "U2", offset: "0.03mm, 0.04mm", limit: "0.15mm", status: "PASS" },
        { component: "C12", offset: "0.02mm, 0.01mm", limit: "0.15mm", status: "PASS" },
        { component: "R8", offset: "0.05mm, -0.05mm", limit: "0.20mm", status: "PASS" },
      ],
      orientation: [
        { component: "U1", rotation: "0.2°", limit: "1.0°", status: "PASS" },
        { component: "D4 (Ind LED)", rotation: "0.5°", limit: "5.0°", status: "PASS" },
        { component: "R8", rotation: "1.1°", limit: "5.0°", status: "PASS" },
      ],
    },
  },
];

// ---- Analytics (static datasets) -----------------------------------------
export const DEFECT_CHART_DATA = [
  { name: DEFECT_TYPES.SOLDER_BRIDGE, count: 32, color: "#FF4D6D" },
  { name: DEFECT_TYPES.MISSING_COMP, count: 24, color: "#FFC857" },
  { name: DEFECT_TYPES.POLARITY, count: 16, color: "#6EE7FF" },
  { name: DEFECT_TYPES.MISALIGNMENT, count: 12, color: "#00E5FF" },
  { name: DEFECT_TYPES.WRONG_PART, count: 6, color: "#a855f7" },
];

export const HOURLY_THROUGHPUT_DATA = [
  { hour: "08:00", inspected: 120, pass: 114, fail: 6 },
  { hour: "09:00", inspected: 145, pass: 138, fail: 7 },
  { hour: "10:00", inspected: 160, pass: 148, fail: 12 },
  { hour: "11:00", inspected: 155, pass: 146, fail: 9 },
  { hour: "12:00", inspected: 110, pass: 104, fail: 6 },
  { hour: "13:00", inspected: 130, pass: 122, fail: 8 },
  { hour: "14:00", inspected: 150, pass: 142, fail: 8 },
  { hour: "15:00", inspected: 165, pass: 156, fail: 9 },
  { hour: "16:00", inspected: 172, pass: 162, fail: 10 },
  { hour: "17:00", inspected: 115, pass: 110, fail: 5 },
];

export const TREND_7_DAYS = [
  { day: "Oct 19", date: "Oct 19", fullDate: "2026-10-19", weekday: "Mon", passRate: 94.2, avgTime: 1.68, inspected: 120, pass: 113, fail: 7, hasData: true },
  { day: "Oct 20", date: "Oct 20", fullDate: "2026-10-20", weekday: "Tue", passRate: 93.8, avgTime: 1.64, inspected: 115, pass: 108, fail: 7, hasData: true },
  { day: "Oct 21", date: "Oct 21", fullDate: "2026-10-21", weekday: "Wed", passRate: 95.1, avgTime: 1.58, inspected: 130, pass: 124, fail: 6, hasData: true },
  { day: "Oct 22", date: "Oct 22", fullDate: "2026-10-22", weekday: "Thu", passRate: 92.6, avgTime: 1.69, inspected: 110, pass: 102, fail: 8, hasData: true },
  { day: "Oct 23", date: "Oct 23", fullDate: "2026-10-23", weekday: "Fri", passRate: 94.8, avgTime: 1.61, inspected: 125, pass: 118, fail: 7, hasData: true },
  { day: "Oct 24", date: "Oct 24", fullDate: "2026-10-24", weekday: "Sat", passRate: 96.0, avgTime: 1.55, inspected: 80, pass: 77, fail: 3, hasData: true },
  { day: "Oct 25", date: "Oct 25", fullDate: "2026-10-25", weekday: "Sun", passRate: 93.9, avgTime: 1.62, inspected: 65, pass: 61, fail: 4, hasData: true },
];

export const MOCK_ANALYTICS = {
  kpis: [
    { label: "Yield Rate", value: 93.9, suffix: "%", decimals: 1, trend: "+1.7%", up: true },
    { label: "Today's Defects", value: 56, suffix: "", decimals: 0, trend: "-4.2%", up: true },
    { label: "Avg Confidence", value: 97.2, suffix: "%", decimals: 1, trend: "+0.3%", up: true },
    { label: "Inspection Time", value: 0.94, suffix: "s", decimals: 2, trend: "-0.06s", up: true },
  ],
  qualitySummary: [
    { name: "PASS RATE", value: 93.9, color: "#00FF9C" },
    { name: "DEFECT RATE", value: 6.1, color: "#FF4D6D" },
  ],
  donutStats: [
    { label: "Today's Target", value: 95.0 },
    { label: "Yesterday's Yield", value: 92.2 },
    { label: "Daily Improvement", value: 1.7, up: true },
  ],
  yieldRate: 93.9,
  defectChart: DEFECT_CHART_DATA,
  hourlyThroughput: HOURLY_THROUGHPUT_DATA,
  trend7Days: TREND_7_DAYS,
};

// ---- Settings -------------------------------------------------------------
export const MOCK_SETTINGS = {
  yolo: {
    weights: "YOLOv8x-PCB-v3.2",
    confidenceThreshold: 0.65,
    iouThreshold: 0.45,
  },
  camera: {
    videoNode: "/dev/video0",
    targetFps: 30,
  },
  gradCam: {
    targetLayer: "model.model.22.cv3.d1",
    overlayTransparency: 0.6,
  },
  alerts: {
    warningAudio: true,
    autoArchiveFailures: true,
  },
  hardware: {
    socModel: "Broadcom BCM2711",
    architecture: "AArch64 (64-bit)",
    os: "Debian Bullseye (6.1 LTS)",
    memory: "4.0 GB LPDDR4",
  },
};

// ---- Reports --------------------------------------------------------------
export const MOCK_REPORTS = [
  { id: "REP-2026-07A", title: "Daily Operations Inspection Summary", date: "July 24, 2026", size: "142 KB", type: "Daily Summary", status: "COMPILED" },
  { id: "REP-2026-07B", title: "Weekly Solder Bridge Quality Assessment", date: "July 20, 2026", size: "840 KB", type: "Weekly Audit", status: "COMPILED" },
  { id: "REP-2026-06C", title: "Raspberry Pi Inference Performance Logs", date: "July 15, 2026", size: "1.2 MB", type: "Diagnostic Log", status: "COMPILED" },
  { id: "REP-2026-06D", title: "STM32 Line Production Verification", date: "July 08, 2026", size: "480 KB", type: "Full Compliance Report", status: "ARCHIVED" },
];