import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useReducer } from "react";
import { trpc } from "./trpc";

export interface LocalRecording {
  id: string; // local UUID before sync
  serverId?: number; // server ID after sync
  title: string;
  duration: number;
  localUri: string; // local file path
  mimeType: string;
  recordingMode: "ambient" | "meeting" | "call" | "voice_memo";
  isStarred: boolean;
  isSynced: boolean;
  status: "saved" | "uploading" | "uploaded" | "error";
  transcriptionStatus?: "pending" | "processing" | "completed" | "failed";
  summaryStatus?: "pending" | "processing" | "completed" | "failed";
  createdAt: string;
}

interface RecordingsState {
  recordings: LocalRecording[];
  isLoading: boolean;
  activeFilter: string;
}

type RecordingsAction =
  | { type: "SET_RECORDINGS"; payload: LocalRecording[] }
  | { type: "ADD_RECORDING"; payload: LocalRecording }
  | { type: "UPDATE_RECORDING"; payload: { id: string; updates: Partial<LocalRecording> } }
  | { type: "DELETE_RECORDING"; payload: string }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_FILTER"; payload: string };

function recordingsReducer(state: RecordingsState, action: RecordingsAction): RecordingsState {
  switch (action.type) {
    case "SET_RECORDINGS":
      return { ...state, recordings: action.payload };
    case "ADD_RECORDING":
      return { ...state, recordings: [action.payload, ...state.recordings] };
    case "UPDATE_RECORDING":
      return {
        ...state,
        recordings: state.recordings.map((r) =>
          r.id === action.payload.id ? { ...r, ...action.payload.updates } : r,
        ),
      };
    case "DELETE_RECORDING":
      return {
        ...state,
        recordings: state.recordings.filter((r) => r.id !== action.payload),
      };
    case "SET_LOADING":
      return { ...state, isLoading: action.payload };
    case "SET_FILTER":
      return { ...state, activeFilter: action.payload };
    default:
      return state;
  }
}

const STORAGE_KEY = "@audionotes_recordings";

interface RecordingsContextValue {
  state: RecordingsState;
  addRecording: (recording: LocalRecording) => void;
  updateRecording: (id: string, updates: Partial<LocalRecording>) => void;
  deleteRecording: (id: string) => void;
  setFilter: (filter: string) => void;
  filteredRecordings: LocalRecording[];
  refreshFromServer: () => void;
}

const RecordingsContext = createContext<RecordingsContextValue | null>(null);

export function RecordingsProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(recordingsReducer, {
    recordings: [],
    isLoading: false,
    activeFilter: "all",
  });

  // Load from local storage on mount
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          dispatch({ type: "SET_RECORDINGS", payload: JSON.parse(stored) });
        }
      } catch (e) {
        console.warn("[RecordingsContext] Failed to load from storage:", e);
      }
    })();
  }, []);

  // Persist to storage whenever recordings change
  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state.recordings)).catch(console.warn);
  }, [state.recordings]);

  const addRecording = useCallback((recording: LocalRecording) => {
    dispatch({ type: "ADD_RECORDING", payload: recording });
  }, []);

  const updateRecording = useCallback((id: string, updates: Partial<LocalRecording>) => {
    dispatch({ type: "UPDATE_RECORDING", payload: { id, updates } });
  }, []);

  const deleteRecording = useCallback((id: string) => {
    dispatch({ type: "DELETE_RECORDING", payload: id });
  }, []);

  const setFilter = useCallback((filter: string) => {
    dispatch({ type: "SET_FILTER", payload: filter });
  }, []);

  const refreshFromServer = useCallback(() => {
    // Will be triggered by tRPC query invalidation
  }, []);

  const filteredRecordings = state.recordings.filter((r) => {
    if (state.activeFilter === "all") return true;
    if (state.activeFilter === "starred") return r.isStarred;
    if (state.activeFilter === "today") {
      const today = new Date().toDateString();
      return new Date(r.createdAt).toDateString() === today;
    }
    return r.recordingMode === state.activeFilter;
  });

  return (
    <RecordingsContext.Provider
      value={{
        state,
        addRecording,
        updateRecording,
        deleteRecording,
        setFilter,
        filteredRecordings,
        refreshFromServer,
      }}
    >
      {children}
    </RecordingsContext.Provider>
  );
}

export function useRecordings() {
  const ctx = useContext(RecordingsContext);
  if (!ctx) throw new Error("useRecordings must be used within RecordingsProvider");
  return ctx;
}
