import React, { useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { resolveTheme, type StixTheme } from "../theme";

export interface StixDetailsPanelProps {
  /** The selected node's id. */
  id: string;
  /**
   * The backing STIX object as plain JSON, or `null` for nodes that are not
   * backed by one (dangling references and embedded STIX 2.0 observables).
   */
  stixObject: Record<string, any> | null;
  theme?: Partial<StixTheme>;
  /**
   * Renders the "Copy JSON" button when provided. React Native needs
   * `@react-native-clipboard/clipboard` for this, so the caller supplies the
   * behaviour instead of the package pulling in another dependency.
   */
  onCopyJson?(json: string): void;
  onClose?(): void;
  testID?: string;
}

/** The properties shown as a table, in the order the web package shows them. */
const SUMMARY_FIELDS = [
  "type",
  "name",
  "value",
  "path",
  "description",
  "pattern",
  "pattern_type",
  "created",
  "modified",
  "labels",
  "confidence",
  "revoked",
];

/**
 * Detail panel for the selected node (`showDetailsPanel`), mirroring the web
 * package: key fields, the full JSON and an optional copy button.
 */
export function StixDetailsPanel({
  id,
  stixObject,
  theme,
  onCopyJson,
  onClose,
  testID = "stix2vis-details",
}: StixDetailsPanelProps) {
  const resolvedTheme = resolveTheme(theme);
  const [showJson, setShowJson] = useState(false);

  const jsonString = useMemo(
    () => (stixObject ? JSON.stringify(stixObject, null, 2) : ""),
    [stixObject]
  );

  const fields = useMemo(() => {
    if (!stixObject) return [] as [string, any][];

    return SUMMARY_FIELDS.filter(
      (property) =>
        stixObject[property] !== undefined && stixObject[property] !== null
    ).map((property) => [property, stixObject[property]] as [string, any]);
  }, [stixObject]);

  const heading = stixObject
    ? String(stixObject.name ?? stixObject.value ?? stixObject.type ?? id)
    : id;

  return (
    <View
      testID={testID}
      style={[
        styles.panel,
        {
          backgroundColor: resolvedTheme.surface,
          borderTopColor: resolvedTheme.border,
        },
      ]}
    >
      <View style={styles.headingRow}>
        <Text
          testID="stix2vis-details-heading"
          style={[styles.heading, { color: resolvedTheme.text }]}
          numberOfLines={2}
        >
          {heading}
        </Text>
        {stixObject && onCopyJson ? (
          <TouchableOpacity
            testID="stix2vis-details-copy"
            accessibilityRole="button"
            accessibilityLabel="Copy JSON"
            onPress={() => onCopyJson(jsonString)}
            hitSlop={6}
          >
            <Text style={[styles.action, { color: resolvedTheme.accent }]}>
              Copy JSON
            </Text>
          </TouchableOpacity>
        ) : null}
        {onClose ? (
          <TouchableOpacity
            testID="stix2vis-details-close"
            accessibilityRole="button"
            accessibilityLabel="Close details"
            onPress={onClose}
            hitSlop={6}
          >
            <Text style={[styles.action, { color: resolvedTheme.mutedText }]}>
              Close
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {!stixObject ? (
        <Text
          testID="stix2vis-details-empty"
          style={[styles.explanation, { color: resolvedTheme.mutedText }]}
        >
          This node is referenced by the bundle but has no STIX object behind it
          (a dangling reference or an embedded observable).
        </Text>
      ) : (
        <ScrollView style={styles.scroll} testID="stix2vis-details-fields">
          {fields.map(([property, value]) => (
            <View key={property} style={styles.fieldRow}>
              <Text
                style={[styles.fieldName, { color: resolvedTheme.mutedText }]}
              >
                {property}
              </Text>
              <Text
                testID={`stix2vis-details-${property}`}
                style={[styles.fieldValue, { color: resolvedTheme.text }]}
              >
                {Array.isArray(value) ? value.join(", ") : String(value)}
              </Text>
            </View>
          ))}

          <TouchableOpacity
            testID="stix2vis-details-toggle-json"
            accessibilityRole="button"
            onPress={() => setShowJson((previous) => !previous)}
            style={styles.jsonToggle}
          >
            <Text style={[styles.action, { color: resolvedTheme.mutedText }]}>
              {showJson ? "Hide full JSON" : "Full JSON"}
            </Text>
          </TouchableOpacity>

          {showJson ? (
            <Text
              testID="stix2vis-details-json"
              selectable
              style={[
                styles.json,
                {
                  backgroundColor: resolvedTheme.text,
                  color: resolvedTheme.background,
                },
              ]}
            >
              {jsonString}
            </Text>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
    maxHeight: 300,
  },
  headingRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  heading: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
  },
  action: {
    fontSize: 12,
  },
  explanation: {
    fontSize: 13,
    marginTop: 8,
  },
  scroll: {
    marginTop: 8,
  },
  fieldRow: {
    flexDirection: "row",
    paddingVertical: 1,
    gap: 8,
  },
  fieldName: {
    fontSize: 12,
    minWidth: 96,
  },
  fieldValue: {
    fontSize: 12,
    flex: 1,
  },
  jsonToggle: {
    marginTop: 10,
    paddingVertical: 2,
  },
  json: {
    fontFamily: "monospace",
    fontSize: 11,
    borderRadius: 6,
    padding: 10,
    marginTop: 6,
  },
});

export default StixDetailsPanel;
