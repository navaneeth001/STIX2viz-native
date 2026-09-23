/**
 * STIX 2.1 embedded references: properties that point at other STIX objects and
 * are drawn as edges.
 *
 * Each entry is `[propertyPath, edgeLabel, forward]`:
 *  - `propertyPath` is a dot-separated path inside the object (array values
 *    yield one edge per element),
 *  - `edgeLabel` is the edge label used in the graph,
 *  - `forward` means "the object that carries the property is the source of the
 *    edge". When `false` the edge points the other way, which reads better for
 *    containment-style properties (e.g. a file's `parent_directory_ref`).
 *
 * The `null` key holds relationships that apply to every STIX type.
 */
export type EmbeddedRelationship = [
  propertyPath: string,
  label: string,
  forward: boolean,
];

export const embeddedRelationships: Map<string | null, EmbeddedRelationship[]> =
  new Map([
    [
      null,
      [
        ["created_by_ref", "created-by", true],
        ["object_marking_refs", "applies-to", false],
      ],
    ],
    ["directory", [["contains_refs", "contains", true]]],
    ["domain-name", [["resolves_to_refs", "resolves-to", true]]],
    ["email-addr", [["belongs_to_ref", "belongs-to", true]]],
    [
      "email-message",
      [
        ["from_ref", "from", true],
        ["sender_ref", "sent-by", true],
        ["to_refs", "to", true],
        ["cc_refs", "cc", true],
        ["bcc_refs", "bcc", true],
        ["raw_email_ref", "raw-binary-of", false],
      ],
    ],
    [
      "file",
      [
        ["contains_refs", "contains", true],
        ["content_ref", "contents-of", false],
        ["parent_directory_ref", "parent-of", false],
      ],
    ],
    ["grouping", [["object_refs", "refers-to", true]]],
    ["ipv4-addr", [["resolves_to_refs", "resolves-to", true]]],
    ["ipv6-addr", [["resolves_to_refs", "resolves-to", true]]],
    ["language-content", [["object_ref", "applies-to", true]]],
    ["malware", [["sample_refs", "sample-of", false]]],
    ["malware-analysis", [["analysis_sco_refs", "captured-by", false]]],
    [
      "network-traffic",
      [
        ["src_ref", "source-of", false],
        ["dst_ref", "destination-of", false],
        ["src_payload_ref", "source-payload-of", false],
        ["dst_payload_ref", "destination-payload-of", false],
        ["encapsulates_refs", "encapsulated-by", false],
        ["encapsulated_by_ref", "encapsulated-by", true],
      ],
    ],
    ["note", [["object_refs", "refers-to", true]]],
    ["observed-data", [["object_refs", "refers-to", true]]],
    ["opinion", [["object_refs", "refers-to", true]]],
    [
      "process",
      [
        ["opened_connection_refs", "opened-by", false],
        ["creator_user_ref", "created-by", true],
        ["image_ref", "image-of", false],
        ["parent_ref", "parent-of", false],
      ],
    ],
    ["report", [["object_refs", "refers-to", true]]],
    [
      "sighting",
      [
        ["sighting_of_ref", "sighting-of", true],
        ["observed_data_refs", "observed", true],
        ["where_sighted_refs", "saw", false],
      ],
    ],
    ["windows-registry-key", [["creator_user_ref", "created-by", true]]],
  ]);

/**
 * Converts a user-supplied `embeddedRelationships` config value (an array of
 * `[path, label, forward]` tuples, typically plain arrays from JSON) into the
 * internal tuple form.
 */
export function normalizeEmbeddedRelationships(
  value: any
): EmbeddedRelationship[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((entry: any) => Array.isArray(entry) && entry.length >= 2)
    .map(
      (entry: any) =>
        [
          String(entry[0]),
          String(entry[1]),
          entry[2] === undefined ? true : entry[2] === true,
        ] as EmbeddedRelationship
    );
}
