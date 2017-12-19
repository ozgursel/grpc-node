export enum Status {
  OK = 0,
  CANCELLED,
  UNKNOWN,
  INVALID_ARGUMENT,
  DEADLINE_EXCEEDED,
  NOT_FOUND,
  ALREADY_EXISTS,
  PERMISSION_DENIED,
  RESOURCE_EXHAUSTED,
  FAILED_PRECONDITION,
  ABORTED,
  OUT_OF_RANGE,
  UNIMPLEMENTED,
  INTERNAL,
  UNAVAILABLE,
  DATA_LOSS,
  UNAUTHENTICATED
}

export enum PropagateFlags {
  DEADLINE = 1,
  CENSUS_STATS_CONTEXT = 2,
  CENSUS_TRACING_CONTEXT = 4,
  CANCELLATION = 8,
  DEFAULTS = 65535
}
