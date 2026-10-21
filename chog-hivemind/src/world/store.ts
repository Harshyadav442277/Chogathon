"use client";
// Tiny external store shared by the 3D scene and the DOM HUD.
import { useSyncExternalStore } from "react";

export type Positions = {
  tick: number; ids: number[]; names: string[]; x: number[]; z: number[]; house: number[]; poi: number[]; mood: string[];
  bubbles: { id: number; chog: number; kind: string; text: string }[];
};

type State = {
  positions: Positions | null;
  selectedChog: number | null;
  selectedPoi: number | null;
  hover: { id: number; x: number; y: number } | null;
  flyTo: { x: number; z: number; dist?: number; at: number } | null;
  myChogs: number[];
};

let state: State = { positions: null, selectedChog: null, selectedPoi: null, hover: null, flyTo: null, myChogs: [] };
const subs = new Set<() => void>();

export const getWorld = () => state;
export function setWorld(patch: Partial<State>) {
  state = { ...state, ...patch };
  subs.forEach((f) => f());
}
const subscribe = (f: () => void) => {
  subs.add(f);
  return () => subs.delete(f);
};
export function useWorld<T>(sel: (s: State) => T): T {
  return useSyncExternalStore(subscribe, () => sel(state), () => sel(state));
}

export const HOUSE_COLORS = ["#ff4d6d", "#4dabf7", "#b197fc", "#ffd43b"];
export const HOUSE_NAMES = ["House Laser", "House Teardrop", "House Glass", "House Moonbeam"];
export const HOUSE_IDS = ["laser", "teardrop", "glass", "moonbeam"];
