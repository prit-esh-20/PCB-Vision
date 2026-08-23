export const MOCK_PCB_TYPES = [
  { id: "all", name: "All PCB Types" },
  { id: "stm32-mcu", name: "STM32 MCU Controller" },
  { id: "esp32-gateway", name: "ESP32-WROOM IoT Gateway" },
  { id: "raspberry-pi-interface", name: "Raspberry Pi Interface Board" },
  { id: "motor-driver", name: "Dual-Motor Driver PCB" },
  { id: "power-management", name: "Power Management PCB" },
  { id: "custom", name: "Custom PCB" },
];

export const DEFAULT_PCB_TYPE_ID = "all";

// Backend integration seam: swap this body for an API call
// (e.g. apiClient.get("/pcb-types")) without touching any UI component.
export async function fetchPcbTypes() {
  return MOCK_PCB_TYPES;
}
