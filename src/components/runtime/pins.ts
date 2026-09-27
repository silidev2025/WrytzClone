"use client";

import { createContext, useContext } from "react";

/**
 * Elements pinned to the top or bottom of the screen are drawn in fixed layers that sit
 * over the app column (provided by AppRuntime). In the editor there are no layers, so
 * pinned elements simply stay where they were placed.
 */
export interface PinLayers {
  top: HTMLElement | null;
  bottom: HTMLElement | null;
}

export const PinLayerContext = createContext<PinLayers>({ top: null, bottom: null });

export function usePinLayers(): PinLayers {
  return useContext(PinLayerContext);
}
