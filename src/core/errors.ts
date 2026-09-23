/**
 * Error types thrown by the graph builder.
 *
 * They mirror the errors of the `stix2vis` web package one-for-one, so
 * applications that surface STIX problems to users can switch between the two
 * packages without changing their error handling.
 */

/**
 * Thrown when the `stixJson` value cannot be read as STIX content: it must be a
 * non-empty object/Map that is a single STIX object or a bundle with at least
 * one object, a non-empty array of objects, or a JSON string of either.
 */
export class STIXContentError extends Error {
  constructor(message: string | null = null, opts: ErrorOptions | null = null) {
    if (!message)
      message =
        "Invalid STIX content: expected a non-empty mapping" +
        " (object or Map) which is a single STIX object or bundle with" +
        " at least one object, or a non-empty array of objects.";

    super(message, opts ?? undefined);
    this.name = "STIXContentError";
  }
}

/**
 * Thrown when one of the objects in the content is not a STIX object. STIX
 * objects require at least `type` and `id` properties.
 */
export class InvalidSTIXObjectError extends STIXContentError {
  /** The offending object, as it was supplied. */
  stixObject: any;

  constructor(stixObject: any, opts: ErrorOptions | null = null) {
    let message =
      "Invalid STIX object: requires at least type and id" + " properties";
    let stixId = stixObject?.get?.("id");
    if (stixId) message += ": " + stixId;

    super(message, opts);

    this.name = "InvalidSTIXObjectError";
    this.stixObject = stixObject;
  }
}

/** Thrown when `config` is not a JSON/JavaScript object (or a JSON string). */
export class InvalidConfigError extends Error {
  constructor(message: string | null = null, opts: ErrorOptions | null = null) {
    if (!message)
      message =
        "Invalid configuration value: must be a JSON or" +
        " Javascript object.";

    super(message, opts ?? undefined);
    this.name = "InvalidConfigError";
  }
}

/** Thrown when `config.include`/`exclude` uses an unknown `$` operator. */
export class InvalidMatchOperator extends Error {
  constructor(op: string | null = null, opts: ErrorOptions | null = null) {
    let message = "In match criteria, invalid operator: " + op;

    super(message, opts ?? undefined);
    this.name = "InvalidMatchOperator";
  }
}

/**
 * True when the error came from this package, i.e. when it was thrown because
 * of invalid STIX content or configuration rather than a bug. Useful for
 * deciding whether showing the raw error to a user is helpful.
 */
export function isStixVisError(error: unknown): boolean {
  return (
    error instanceof STIXContentError ||
    error instanceof InvalidConfigError ||
    error instanceof InvalidMatchOperator
  );
}
