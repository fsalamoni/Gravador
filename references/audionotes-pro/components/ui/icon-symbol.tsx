// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SymbolWeight, SymbolViewProps } from "expo-symbols";
import { ComponentProps } from "react";
import { OpaqueColorValue, type StyleProp, type TextStyle } from "react-native";

type IconMapping = Record<SymbolViewProps["name"], ComponentProps<typeof MaterialIcons>["name"]>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * SF Symbols to Material Icons mappings for AudioNotes Pro
 */
const MAPPING = {
  // Navigation
  "house.fill": "home",
  "magnifyingglass": "search",
  "gearshape.fill": "settings",
  "paperplane.fill": "send",
  "chevron.left.forwardslash.chevron.right": "code",
  "chevron.right": "chevron-right",
  "chevron.left": "chevron-left",
  "chevron.down": "expand-more",
  "chevron.up": "expand-less",
  "xmark": "close",
  "xmark.circle.fill": "cancel",

  // Recording
  "mic.fill": "mic",
  "mic": "mic-none",
  "mic.slash.fill": "mic-off",
  "stop.fill": "stop",
  "pause.fill": "pause",
  "play.fill": "play-arrow",
  "record.circle": "fiber-manual-record",
  "waveform": "graphic-eq",

  // Content
  "doc.text.fill": "description",
  "doc.text": "article",
  "list.bullet": "format-list-bulleted",
  "checklist": "checklist",
  "brain.head.profile": "psychology",
  "sparkles": "auto-awesome",
  "bubble.left.and.bubble.right.fill": "chat",
  "bubble.left.fill": "chat-bubble",

  // Actions
  "star.fill": "star",
  "star": "star-border",
  "trash.fill": "delete",
  "trash": "delete-outline",
  "square.and.arrow.up": "share",
  "square.and.arrow.down": "download",
  "plus": "add",
  "plus.circle.fill": "add-circle",
  "pencil": "edit",
  "pencil.line": "edit",
  "ellipsis": "more-horiz",
  "ellipsis.circle": "more-horiz",

  // Status
  "checkmark.circle.fill": "check-circle",
  "checkmark.circle": "check-circle-outline",
  "checkmark": "check",
  "exclamationmark.circle.fill": "error",
  "clock.fill": "schedule",
  "clock": "access-time",
  "calendar": "calendar-today",

  // Cloud & Sync
  "icloud.fill": "cloud",
  "icloud.and.arrow.up": "cloud-upload",
  "icloud.and.arrow.down": "cloud-download",
  "arrow.clockwise": "refresh",
  "arrow.triangle.2.circlepath": "sync",

  // Media
  "speaker.wave.2.fill": "volume-up",
  "speaker.slash.fill": "volume-off",
  "forward.fill": "fast-forward",
  "backward.fill": "fast-rewind",
  "goforward.15": "forward-10",
  "gobackward.15": "replay-10",

  // Misc
  "info.circle": "info",
  "info.circle.fill": "info",
  "questionmark.circle": "help",
  "person.fill": "person",
  "person.circle.fill": "account-circle",
  "tag.fill": "label",
  "folder.fill": "folder",
  "photo": "image",
  "link": "link",
  "lock.fill": "lock",
  "bell.fill": "notifications",
  "bell.slash.fill": "notifications-off",

  // New icons for v2 features
  "arrow.down.doc.fill": "save-alt",
  "bolt.fill": "bolt",
  "mic.circle.fill": "mic",
  "play.circle.fill": "play-circle-filled",
  "person.2.fill": "group",
  "brain": "psychology",
  "doc.badge.plus": "note-add",
  "square.and.pencil": "edit-note",
  "arrow.up.right.square": "open-in-new",
  "doc.on.clipboard": "content-paste",
  "checkmark.square.fill": "check-box",
  "square": "check-box-outline-blank",
} as IconMapping;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
