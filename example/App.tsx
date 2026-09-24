import React, { useCallback, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

// A real app imports the published package:
//   import { Stix2Vis } from "stix2vis-native";
// The relative import keeps this example type-checked inside the repository.
import { Stix2Vis } from "../src";

/**
 * A STIX 2.1 bundle with the shapes you meet in the wild: an identity that
 * created the malware, the indicator that detects it, the relationship that
 * connects them, an infrastructure the malware uses, and a threat actor
 * referenced but not included in the bundle (to show `showDanglingRefs`).
 */
const BUNDLE = {
  type: "bundle",
  id: "bundle--44af6c39-c09b-49c5-9de2-39fc22653b2d",
  objects: [
    {
      type: "identity",
      spec_version: "2.1",
      id: "identity--11111111-1111-4111-8111-111111111111",
      name: "Example Corp",
      identity_class: "organization",
    },
    {
      type: "malware",
      spec_version: "2.1",
      id: "malware--9c4638ec-f1de-4ddb-abf4-1b760417654e",
      name: "Adversary-in-the-middle",
      description: "Harvests credentials from compromised endpoints.",
      is_family: false,
      created_by_ref: "identity--11111111-1111-4111-8111-111111111111",
      malware_types: ["backdoor"],
    },
    {
      type: "indicator",
      spec_version: "2.1",
      id: "indicator--8e2e2d2b-17d4-4cbf-938f-98ee46b3cd3f",
      pattern_type: "stix",
      pattern: "[file:hashes.'SHA-256' = 'aec07064...']",
      valid_from: "2024-01-01T00:00:00.000Z",
    },
    {
      type: "infrastructure",
      spec_version: "2.1",
      id: "infrastructure--22222222-2222-4222-8222-222222222222",
      name: "Attacker C2",
      infrastructure_types: ["command-and-control"],
    },
    {
      type: "relationship",
      spec_version: "2.1",
      id: "relationship--55555555-5555-4555-8555-555555555555",
      relationship_type: "indicates",
      source_ref: "indicator--8e2e2d2b-17d4-4cbf-938f-98ee46b3cd3f",
      target_ref: "malware--9c4638ec-f1de-4ddb-abf4-1b760417654e",
    },
    {
      type: "relationship",
      spec_version: "2.1",
      id: "relationship--66666666-6666-4666-8666-666666666666",
      relationship_type: "uses",
      source_ref: "malware--9c4638ec-f1de-4ddb-abf4-1b760417654e",
      target_ref: "infrastructure--22222222-2222-4222-8222-222222222222",
    },
    {
      type: "malware",
      spec_version: "2.1",
      id: "malware--77777777-7777-4777-8777-777777777777",
      name: "Related loader",
      is_family: false,
      // Not in the bundle: rendered as a ghost node with showDanglingRefs.
      created_by_ref: "threat-actor--33333333-3333-4333-8333-333333333333",
    },
  ],
};

export default function App() {
  const [selection, setSelection] = useState("Nothing selected");
  const [bundle, setBundle] = useState<unknown>(BUNDLE);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");

  const handleSelectionChange = useCallback(
    (next: { nodes: string[]; edges: string[] }) => {
      const parts: string[] = [];

      if (next.nodes.length > 0) parts.push(`node ${next.nodes[0]}`);
      if (next.edges.length > 0) parts.push(`edge ${next.edges[0]}`);

      setSelection(parts.length > 0 ? parts.join(" + ") : "Nothing selected");
    },
    []
  );

  /**
   * `stixJson` accepts a bundle, a single STIX object, an array of objects or a
   * JSON string, so pasted JSON goes straight in. Parsing it here reports
   * malformed input with your own message; hand the string over instead and the
   * package reports it through `onError`.
   */
  const loadPastedJson = useCallback((text: string) => {
    try {
      setBundle(JSON.parse(text));
    } catch (error) {
      Alert.alert("Not valid JSON", String(error));
    }
  }, []);

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>STIX 2.1 graph</Text>
        <Text style={styles.subtitle}>
          Drag to pan, pinch to zoom, tap a node or an edge.
        </Text>

        <View style={styles.row}>
          <Pressable
            style={styles.button}
            onPress={() => {
              setPasteText("");
              setPasteOpen(true);
            }}
          >
            <Text style={styles.buttonText}>Load JSON…</Text>
          </Pressable>
          <Pressable style={styles.button} onPress={() => setBundle(BUNDLE)}>
            <Text style={styles.buttonText}>Example bundle</Text>
          </Pressable>
        </View>

        <Stix2Vis
          stixJson={bundle}
          showToolbar
          showDetailsPanel
          showDanglingRefs
          graphStyle={styles.graph}
          onSelectionChange={handleSelectionChange}
          onNodeSelect={(_nodeId, stixObject) => {
            if (stixObject)
              console.log("Selected", stixObject.type, stixObject.name);
          }}
          onError={(error) => Alert.alert("STIX error", String(error))}
          onExportJson={(json) => Alert.alert("Visible graph", json)}
          theme={{ accent: "#0b8043" }}
        />

        <Text style={styles.selection}>{selection}</Text>
      </ScrollView>

      <Modal
        animationType="slide"
        transparent
        visible={pasteOpen}
        onRequestClose={() => setPasteOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Paste STIX JSON</Text>
              <Pressable onPress={() => setPasteOpen(false)}>
                <Text style={styles.modalAction}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  loadPastedJson(pasteText);
                  setPasteOpen(false);
                }}
              >
                <Text style={styles.modalAction}>Load</Text>
              </Pressable>
            </View>
            <TextInput
              style={styles.modalInput}
              value={pasteText}
              onChangeText={setPasteText}
              placeholder='{"type":"bundle","objects":[...]}'
              placeholderTextColor="#9ca3af"
              multiline
              autoCapitalize="none"
              autoCorrect={false}
              textAlignVertical="top"
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f6f7f9",
  },
  content: {
    padding: 12,
    gap: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
  },
  subtitle: {
    fontSize: 13,
    color: "#6b7280",
  },
  graph: {
    height: 420,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#dcdfe4",
    borderRadius: 8,
    backgroundColor: "#ffffff",
  },
  selection: {
    fontSize: 12,
    color: "#4b5563",
  },
  row: {
    flexDirection: "row",
    gap: 8,
  },
  button: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#c7cbd1",
    backgroundColor: "#ffffff",
  },
  buttonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#111827",
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(17, 24, 39, 0.45)",
  },
  modalCard: {
    height: "70%",
    gap: 8,
    padding: 12,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    backgroundColor: "#ffffff",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
  },
  modalAction: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 14,
    fontWeight: "600",
    color: "#0b8043",
  },
  modalInput: {
    flex: 1,
    padding: 10,
    fontSize: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#dcdfe4",
    borderRadius: 8,
    backgroundColor: "#fbfbfc",
  },
});
