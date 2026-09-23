import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { resolveStixIcon, type StixIconMap } from "../icons";
import { groupColor, resolveTheme, type StixTheme } from "../theme";

export interface StixToolbarProps {
  /** STIX types present in the graph, sorted. */
  legend: string[];
  /** Types currently hidden by the legend toggles. */
  hiddenTypes: string[];
  onToggleType(type: string): void;
  searchQuery: string;
  onSearchQueryChange(value: string): void;
  onSubmitSearch(): void;
  /** Message shown when the search matched nothing. */
  searchMessage?: string | null;
  onZoomIn(): void;
  onZoomOut(): void;
  onFit(): void;
  /**
   * Renders the "Export JSON" button when provided. React Native has no
   * `<a download>`, so the caller decides where the JSON goes (clipboard,
   * filesystem, share sheet…).
   */
  onExportJson?(): void;
  icons?: StixIconMap;
  theme?: Partial<StixTheme>;
  testID?: string;
}

/**
 * Search, legend toggles, viewport controls and export — the React Native
 * equivalent of the web package's toolbar (`showToolbar`).
 */
export function StixToolbar({
  legend,
  hiddenTypes,
  onToggleType,
  searchQuery,
  onSearchQueryChange,
  onSubmitSearch,
  searchMessage,
  onZoomIn,
  onZoomOut,
  onFit,
  onExportJson,
  icons,
  theme,
  testID = "stix2vis-toolbar",
}: StixToolbarProps) {
  const resolvedTheme = resolveTheme(theme);

  return (
    <View
      testID={testID}
      style={[
        styles.toolbar,
        {
          backgroundColor: resolvedTheme.surface,
          borderBottomColor: resolvedTheme.border,
        },
      ]}
    >
      <View style={styles.searchRow}>
        <TextInput
          testID="stix2vis-search-input"
          value={searchQuery}
          onChangeText={onSearchQueryChange}
          onSubmitEditing={onSubmitSearch}
          placeholder="Search id or label…"
          placeholderTextColor={resolvedTheme.mutedText}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel="Search nodes by id or label"
          style={[
            styles.searchInput,
            { borderColor: resolvedTheme.border, color: resolvedTheme.text },
          ]}
        />
        <ToolbarButton
          testID="stix2vis-search-submit"
          label="Go"
          onPress={onSubmitSearch}
          theme={resolvedTheme}
        />
        {searchMessage ? (
          <Text
            testID="stix2vis-search-message"
            style={[styles.searchMessage, { color: resolvedTheme.danger }]}
          >
            {searchMessage}
          </Text>
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.legendRow}
      >
        {legend.map((type) => {
          const hidden = hiddenTypes.includes(type);
          const icon = resolveStixIcon(type, icons);

          return (
            <TouchableOpacity
              key={type}
              testID={`stix2vis-legend-${type}`}
              accessibilityRole="button"
              accessibilityState={{ selected: !hidden }}
              accessibilityLabel={hidden ? `Show ${type}` : `Hide ${type}`}
              onPress={() => onToggleType(type)}
              style={[
                styles.chip,
                {
                  borderColor: resolvedTheme.border,
                  backgroundColor: resolvedTheme.surface,
                  opacity: hidden ? 0.4 : 1,
                },
              ]}
            >
              <View
                style={[
                  styles.chipDot,
                  {
                    backgroundColor: icon
                      ? groupColor(type, resolvedTheme)
                      : resolvedTheme.mutedText,
                  },
                ]}
              />
              <Text style={[styles.chipLabel, { color: resolvedTheme.text }]}>
                {type}
              </Text>
            </TouchableOpacity>
          );
        })}

        <View
          style={[styles.separator, { backgroundColor: resolvedTheme.border }]}
        />

        <ToolbarButton
          testID="stix2vis-zoom-out"
          label="−"
          accessibilityLabel="Zoom out"
          onPress={onZoomOut}
          theme={resolvedTheme}
        />
        <ToolbarButton
          testID="stix2vis-fit"
          label="Fit"
          accessibilityLabel="Fit the graph to the screen"
          onPress={onFit}
          theme={resolvedTheme}
        />
        <ToolbarButton
          testID="stix2vis-zoom-in"
          label="+"
          accessibilityLabel="Zoom in"
          onPress={onZoomIn}
          theme={resolvedTheme}
        />
        {onExportJson ? (
          <ToolbarButton
            testID="stix2vis-export-json"
            label="Export JSON"
            onPress={onExportJson}
            theme={resolvedTheme}
          />
        ) : null}
      </ScrollView>
    </View>
  );
}

/**
 * Small bordered button used by the toolbar.
 *
 * Kept in this file because it is an implementation detail of the toolbar —
 * consumers style it through the theme, not by composing buttons.
 */
function ToolbarButton({
  testID,
  label,
  onPress,
  theme,
  accessibilityLabel,
}: {
  testID: string;
  label: string;
  onPress(): void;
  theme: StixTheme;
  accessibilityLabel?: string;
}) {
  return (
    <TouchableOpacity
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      hitSlop={6}
      style={[
        styles.button,
        { borderColor: theme.border, backgroundColor: theme.surface },
      ]}
    >
      <Text style={[styles.buttonLabel, { color: theme.text }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 6,
    paddingHorizontal: 8,
    gap: 6,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  searchInput: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 13,
  },
  searchMessage: {
    fontSize: 12,
    marginLeft: 4,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  chipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chipLabel: {
    fontSize: 12,
  },
  separator: {
    width: StyleSheet.hairlineWidth,
    alignSelf: "stretch",
    marginHorizontal: 4,
  },
  button: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    minWidth: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonLabel: {
    fontSize: 13,
  },
});

export default StixToolbar;
